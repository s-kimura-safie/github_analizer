import sys
import json
import os
import re
import dataclasses
from datetime import datetime, timedelta, timezone
from typing import Generator
from zoneinfo import ZoneInfo

import config as cfg
import numpy as np
import requests
from holiday_jp import HolidayJp
from tqdm import tqdm


@dataclasses.dataclass
class PullRequest:
    title: str
    created: datetime
    first_review: datetime | None
    closed: datetime | None
    is_merged: bool
    num_comments: int

    @staticmethod
    def daterange(start: datetime, end: datetime) -> Generator[datetime, None, None]:
        current = start
        while current <= end:
            yield current
            current += timedelta(days=1)

    def is_closed(self) -> bool:
        return self.closed is not None

    def elapsed(self) -> timedelta:
        end = self.closed or datetime.now().astimezone(ZoneInfo("Asia/Tokyo"))
        return end - self.created

    def calc_business_days(self, end_dt: datetime) -> timedelta:
        business_days = 0
        for dt in self.daterange(self.created, end_dt):
            if HolidayJp(dt.date()).is_business_day:
                business_days += 1
        return timedelta(days=business_days - 1) if business_days > 0 else timedelta(0)

    def elapsed_business_days(self) -> timedelta:
        end_dt = self.closed or datetime.now().astimezone(ZoneInfo("Asia/Tokyo"))
        return self.calc_business_days(end_dt)

    def first_review_elapsed_business_days(self) -> timedelta:
        end_dt = self.first_review or datetime.now().astimezone(ZoneInfo("Asia/Tokyo"))
        return self.calc_business_days(end_dt)


def validate_date(date_string: str) -> None:
    pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(pattern, date_string):
        print("date format must be yyyy-mm-dd")
        sys.exit(1)


def validate_period(from_date: str, to_date: str) -> None:
    if from_date > to_date:
        print("from_date must be earlier than to_date")
        sys.exit(1)


def convert_to_jst(time_str: str | None) -> datetime | None:
    if time_str is None:
        return None
    time_dt = datetime.strptime(time_str.replace("Z", ""), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    return time_dt.astimezone(ZoneInfo("Asia/Tokyo"))


def search_pr_by_authors(usernames: list[str], from_date: str, to_date: str, token: str) -> dict:
    headers = {
        "Accept": "application/vnd.github.text-match+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    usernames = usernames.copy()
    usernames.insert(0, "")  # Insert empty string to add prefix for the first element

    query_webapp = "type:pr org:SafieDev"
    query_webapp += " author:".join(usernames)
    query_webapp += f" created:{from_date}..{to_date}"
    print("Search query for webapp: ")
    print(query_webapp)

    query_rest = "type:pr+org:SafieDev"
    query_rest += "+author:".join(usernames)
    query_rest += f"+created:{from_date}..{to_date}&sort=created&order=desc&per_page=100"
    url = f"https://api.github.com/search/issues?q={query_rest}"
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(response)
        sys.exit(1)

    pulls = response.json()

    if False:  # for debug
        search_cache = f"search_result_{from_date}_{to_date}.json"
        json.dump(pulls, open(search_cache, "w"), indent=2)

    if len(pulls["items"]) < pulls["total_count"] or pulls["incomplete_results"]:
        print("Cannot retrive all pull requests (should be <= 100)")
        sys.exit(1)

    return pulls


def check_pr_update(item: dict, search_api_cache: dict) -> bool:
    url = item["html_url"]
    if url in search_api_cache:
        updated_at = search_api_cache[url]
        if item["updated_at"] == updated_at:
            return False
    return True


def get_requested_reviewers(
    owner: str,
    repository: str,
    pr_number: int,
    token: str,
    pulls_api_cache: dict,
    refresh: bool,
) -> list[str]:
    # Use GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers

    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}/requested_reviewers"

    if url not in pulls_api_cache or refresh:
        headers = {
            "Accept": "application/vnd.github.text-match+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(response)
            sys.exit(1)
        response_json = response.json()
        pulls_api_cache[url] = response_json
    else:
        response_json = pulls_api_cache[url]

    reviewers = [reviewer["login"] for reviewer in response_json["users"]]
    return reviewers


def refresh_reviews_api_cache(
    owner: str,
    repository: str,
    pr_number: int,
    token: str,
    pulls_api_cache: dict,
    refresh: bool,
) -> None:
    # Use GET /repos/{owner}/{repo}/pulls/{pr_number}/reviews

    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}/reviews"

    if url not in pulls_api_cache or refresh:
        headers = {
            "Accept": "application/vnd.github.text-match+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(response)
            sys.exit(1)
        response_json = response.json()
        pulls_api_cache[url] = response_json


def get_completed(
    owner: str,
    repository: str,
    pr_number: int,
    author: str,
    requested: list[str],
    pulls_api_cache: dict,
) -> list[str]:
    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}/reviews"

    response_json = pulls_api_cache[url]

    reviewers = []
    for review in response_json:
        reviewers.append(review["user"]["login"])
    reviewers = list(set(reviewers))  # Remove duplicates

    if author in reviewers:  # Remove self comment
        reviewers.remove(author)

    for reviewer in requested:
        if reviewer in reviewers:
            reviewers.remove(reviewer)  # Remove re-requested reviewer from reviewed reviewers

    return reviewers


def get_first_person_review(
    owner: str, repository: str, pr_number: int, author: str, pulls_api_cache: dict
) -> datetime | None:
    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}/reviews"

    response_json = pulls_api_cache[url]

    for review in response_json:
        if review["user"]["login"] == author:
            continue
        elif review["user"]["login"] == "copilot-pull-request-reviewer[bot]":
            continue
        return convert_to_jst(review["submitted_at"])

    return None


def refresh_cache(url: str, api_cache: dict, token: str) -> None:
    headers = {
        "Accept": "application/vnd.github.text-match+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(response)
        sys.exit(1)
    api_cache[url] = response.json()


def refresh_pulls_api_cache(
    owner: str,
    repository: str,
    pr_number: int,
    pulls_api_cache: dict,
    token: str,
    refresh: bool,
) -> None:
    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}"
    if url not in pulls_api_cache or refresh:
        refresh_cache(url, pulls_api_cache, token)


def get_pull_request(owner: str, repository: str, pr_number: int, author: str, pulls_api_cache: dict) -> PullRequest:
    url = f"https://api.github.com/repos/{owner}/{repository}/pulls/{pr_number}"
    assert url in pulls_api_cache

    response_json = pulls_api_cache[url]
    title = response_json["title"]
    created = convert_to_jst(response_json["created_at"])
    assert created is not None
    closed = convert_to_jst(response_json["closed_at"])
    is_merged = response_json["merged"]
    num_comments = response_json["comments"] + response_json["review_comments"]
    return PullRequest(title, created, None, closed, is_merged, num_comments)


def update_matrix_data(
    data: np.ndarray,
    repo_name: str,
    pr_number: int,
    author: str,
    authors: list[str],
    requested: list[str],
    completed: list[str],
) -> None:
    author_index = authors.index(author)
    for reviewer in requested:
        try:
            reviewer_index = authors.index(reviewer)
        except ValueError:
            print(f"Review requested to other group member: {reviewer} in {repo_name} #{pr_number}")
            continue
        data[0][author_index][reviewer_index] += 1

    for reviewer in completed:
        try:
            reviewer_index = authors.index(reviewer)
        except ValueError:
            print(f"Reviewed by other group member: {reviewer} in {repo_name} #{pr_number}")
            continue
        data[1][author_index][reviewer_index] += 1


def get_github_data(
    authors,
    author_count,
    requested_count,
    completed_count,
    from_date,
    to_date,
    pr_details,
):
    authors = [author.replace("-safie", "") for author in authors]
    authors = [author.replace("-sf", "") for author in authors]
    return {
        "period": [from_date, to_date],
        "labels": authors,
        "datasets": [
            {
                "label": "Author",
                "data": author_count,
            },
            {
                "label": "Review Requested",
                "data": requested_count.tolist(),
            },
            {
                "label": "Review Completed",
                "data": completed_count.tolist(),
            },
        ],
        "pr_details": pr_details,
    }


def process_single_pr(item, authors, token, pulls_api_cache, search_api_cache, data, pull_requests):
    owner = item["repository_url"].split("/")[-2]
    repo_name = item["repository_url"].split("/")[-1]
    pr_number = item["number"]
    author = item["user"]["login"]
    title = item["title"]
    html_url = item["html_url"]
    status = item["state"]
    created_day = item["created_at"]
    closed_day = item["closed_at"]

    # Cash が古い場合は更新
    refresh = check_pr_update(item, search_api_cache)
    search_api_cache[item["html_url"]] = item["updated_at"]  # Update timestamp
    refresh_reviews_api_cache(owner, repo_name, pr_number, token, pulls_api_cache, refresh)
    refresh_pulls_api_cache(owner, repo_name, pr_number, pulls_api_cache, token, refresh)

    # PR の情報を取得
    pull_request = get_pull_request(owner, repo_name, pr_number, author, pulls_api_cache)
    if status == "closed" and not pull_request.is_merged:  # PR がクローズされているがマージされていない場合
        return None

    pull_request.first_review = get_first_person_review(owner, repo_name, pr_number, author, pulls_api_cache)
    pull_requests[author].append(pull_request)

    # Author-reviewer matrix
    requested = get_requested_reviewers(owner, repo_name, pr_number, token, pulls_api_cache, refresh)
    completed = get_completed(owner, repo_name, pr_number, author, requested, pulls_api_cache)
    update_matrix_data(data, repo_name, pr_number, author, authors, requested, completed)

    # PR の詳細情報を取得
    lifetime_day = pull_request.elapsed_business_days().days
    lifetime_hour = pull_request.elapsed_business_days().seconds // 3600
    first_review_hour = int(pull_request.first_review_elapsed_business_days().total_seconds() // 3600)
    first_review_min = int((pull_request.first_review_elapsed_business_days().total_seconds() % 3600) // 60)

    return {
        "author": author,
        "title": title,
        "html_url": html_url,
        "status": status,
        "is_merged": pull_request.is_merged,
        "created_day": created_day,
        "closed_day": closed_day,
        "requested": requested,
        "completed": completed,
        "num_comments": pull_request.num_comments,
        "lifetime_day": lifetime_day,
        "lifetime_hour": lifetime_hour,
        "first_review_hour": first_review_hour,
        "first_review_min": first_review_min,
    }


# Excute main
def main():
    if len(sys.argv) > 1:
        from_date = sys.argv[1]
        to_date = sys.argv[2]
    try:
        datetime.strptime(from_date, "%Y-%m-%d")
        datetime.strptime(to_date, "%Y-%m-%d")
    except ValueError:
        print(json.dumps({"error": "Invalid date format"}))
        sys.exit(1)

    token = cfg.github_token
    authors = cfg.authors

    # Load search API cache
    search_api_cache_filename = "search_api_cache.json"
    if os.path.exists(search_api_cache_filename):
        with open(search_api_cache_filename, "r") as f:
            search_api_cache = json.load(f)
    else:
        search_api_cache = {}

    # Search pull requests
    pulls = search_pr_by_authors(authors, from_date, to_date, token)  # Rate limit: 10 times per minute
    num_pr_tot = pulls["total_count"]
    print(f"Log: # searched pull requests: {num_pr_tot}", file=sys.stderr)

    # Load pulls API cache
    pulls_api_cache_filename = "pulls_api_cache.json"
    if os.path.exists(pulls_api_cache_filename):
        with open(pulls_api_cache_filename, "r") as f:
            pulls_api_cache = json.load(f)
    else:
        pulls_api_cache = {}

    # Calculate author-reviewer matrix
    print(f"Call GitHub REST API {2 * num_pr_tot} times. Check GitHub rate limit for more details. Use cache if available.")
    n = len(authors)
    data = np.zeros((2, n, n), dtype=int)  # (requested/reviewed, author, reviewer)
    pull_requests: dict[str, list[PullRequest]] = {author: [] for author in authors}
    author_count = np.zeros(n, dtype=int)

    items = pulls["items"]
    num_items = len(items)
    pr_details = []
    for item in tqdm(items):
        pr_detail = process_single_pr(item, authors, token, pulls_api_cache, search_api_cache, data, pull_requests)
        if pr_detail:
            pr_details.append(pr_detail)
    json.dump(pulls_api_cache, open(pulls_api_cache_filename, "w"), indent=2)
    json.dump(search_api_cache, open(search_api_cache_filename, "w"), indent=2)

    print("Author-reviewer matrix (review-requested, review-completed): ")
    author_count = [len(pull_requests[author]) for author in authors]
    requested_count = np.sum(data[0], axis=0)
    completed_count = np.sum(data[1], axis=0)
    for i in range(n):
        print(f"{authors[i]}: {author_count[i]}, {requested_count[i]}, {completed_count[i]}")

    data_json = get_github_data(
        authors,
        author_count,
        requested_count,
        completed_count,
        from_date,
        to_date,
        pr_details,
    )
    json.dump(data_json, open("github_data.json", "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
