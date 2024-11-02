import sys
import json
import os
import re
from datetime import datetime, timedelta

import config as cfg
import numpy as np  # 40 ms
import requests
from tqdm import tqdm


def validate_date(date_string: str) -> None:
    pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(pattern, date_string):
        print("date format must be yyyy-mm-dd")
        sys.exit(1)


def validate_period(from_date: str, to_date: str) -> None:
    if from_date > to_date:
        print("from_date must be earlier than to_date")
        sys.exit(1)


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
    repository: str, pr_number: int, token: str, pulls_api_cache: dict, reflesh: bool
) -> list[str]:
    # Use GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers

    url = f"https://api.github.com/repos/SafieDev/{repository}/pulls/{pr_number}/requested_reviewers"

    if url not in pulls_api_cache or reflesh:
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

    reviewers = []
    for reviewer in response_json["users"]:
        reviewers.append(reviewer["login"])
    return reviewers


def get_completed_reviewers(
    repository: str, pr_number: int, author: str, requested: list, token: str, pulls_api_cache: dict, reflesh: bool
) -> list[str]:
    # Use GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews

    url = f"https://api.github.com/repos/SafieDev/{repository}/pulls/{pr_number}/reviews"

    if url not in pulls_api_cache or reflesh:
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


def update_data(
    data: np.ndarray, repo_name: str, pr_number: int, author: str, authors: list, requested: list, completed: list
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


def get_github_data(authors, author_count, requested_count, completed_count, from_date, to_date, pr_details):
    authors = [author.replace("-safie", "") for author in authors]
    authors = [author.replace("-sf", "") for author in authors]
    return {
        "period": [from_date, to_date],
        "labels": authors,
        "datasets": [
            {
                "label": "Author",
                "data": author_count.tolist(),
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
        "pr_details": pr_details
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
    print(
        f"Call GitHub REST API {2 * num_pr_tot} times. Check GitHub rate limit for more details. Use cache if available."
    )
    n = len(authors)
    data = np.zeros((2, n, n), dtype=int)  # 1st-axis: requested/reviewed, 2nd-axis: author, 3rd-axis: reviewer
    author_count = np.zeros(n, dtype=int)

    items = pulls["items"]
    num_items = len(items)
    pr_details = []
    for i in tqdm(range(num_items)):
        item = items[i]
        repo_name = item["repository_url"].split("/")[-1]
        pr_number = item["number"]
        author = item["user"]["login"]
        title = item["title"]
        html_url = item["html_url"]
        status = item["state"]
        created_day = item["created_at"]
        closed_day = item["closed_at"]
        reflesh = check_pr_update(item, search_api_cache)
        requested = get_requested_reviewers(repo_name, pr_number, token, pulls_api_cache, reflesh)
        completed = get_completed_reviewers(repo_name, pr_number, author, requested, token, pulls_api_cache, reflesh)
        search_api_cache[item["html_url"]] = item["updated_at"]  # Update timestamp
        author_count[authors.index(author)] += 1
        update_data(data, repo_name, pr_number, author, authors, requested, completed)
        pr_detail = {
            "author": author,
            "title": title,
            "html_url": html_url,
            "status": status,
            "created_day": created_day,
            "closed_day": closed_day,
            "requested": requested,
            "completed": completed,
        }
        pr_details.append(pr_detail)
    json.dump(pulls_api_cache, open(pulls_api_cache_filename, "w"), indent=2)
    json.dump(search_api_cache, open(search_api_cache_filename, "w"), indent=2)
    print("Author-reviewer matrix (review-requested, review-completed): ")
    requested_count = np.sum(data[0], axis=0)
    completed_count = np.sum(data[1], axis=0)
    for i in range(n):
        print(f"{authors[i]}: {author_count[i]}, {requested_count[i]}, {completed_count[i]}")

    data = get_github_data(authors, author_count, requested_count, completed_count, from_date, to_date, pr_details)
    json.dump(data, open("github_data.json", "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
