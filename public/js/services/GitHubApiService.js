/**
 * GitHub API との通信を担当するサービスクラス
 */
class GitHubApiService {
    /**
     * 指定した期間のGitHubデータを取得
     * @param {string} fromDate - 開始日 (YYYY-MM-DD)
     * @param {string} toDate - 終了日 (YYYY-MM-DD)
     * @returns {Promise<Object>} GitHub データ
     */
    async fetchData(fromDate, toDate) {
        const response = await fetch('/run-python', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fromDate, toDate })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * レビューデータを取得
     * @returns {Promise<Object>} レビューデータ
     */
    async getReviewData() {
        const response = await fetch('/api/review-data', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }
}
