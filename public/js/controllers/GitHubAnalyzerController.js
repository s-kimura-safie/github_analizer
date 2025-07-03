/**
 * GitHubアナライザーのメインコントローラークラス
 * 各コンポーネントを統合して全体の動作を制御
 */
class GitHubAnalyzerController {
    constructor() {
        this.apiService = new GitHubApiService();
        this.dataProcessor = new DataProcessor();
        this.chartManager = new ChartManager('reviewChart', this.dataProcessor);
        this.modalManager = new ModalManager('prModal', 'prModalContent', '.close');
        this.tableBuilder = new TableBuilder();
        this.dateUtils = new DateUtils();
        this.notificationManager = new NotificationManager();

        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.updateChart();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // 手動日付選択のボタン
        document.getElementById("runButton")?.addEventListener("click", () => {
            this.handleManualDateSelection();
        });

        // 週間ボタン
        document.getElementById("weekly-btn")?.addEventListener("click", () => {
            this.handleWeeklyData();
        });

        // 月間ボタン
        document.getElementById("monthly-btn")?.addEventListener("click", () => {
            this.handleMonthlyData();
        });
    }

    /**
     * 手動日付選択の処理
     */
    handleManualDateSelection() {
        const fromDate = document.getElementById("fromDateInput").value;
        const toDate = document.getElementById("toDateInput").value;

        if (!fromDate || !toDate) {
            this.notificationManager.showAlert("両方の日付を選択してください");
            return;
        }

        this.fetchGithubData(fromDate, toDate);
    }

    /**
     * 週間データの処理
     */
    handleWeeklyData() {
        const toDate = this.dateUtils.getToday();
        const fromDate = this.dateUtils.getDaysAgo(7);
        this.fetchGithubData(fromDate, toDate);
    }

    /**
     * 月間データの処理
     */
    handleMonthlyData() {
        const toDate = this.dateUtils.getToday();
        const fromDate = this.dateUtils.getDaysAgo(30);
        this.fetchGithubData(fromDate, toDate);
    }

    /**
     * GitHubデータを取得
     * @param {string} fromDate - 開始日
     * @param {string} toDate - 終了日
     */
    async fetchGithubData(fromDate, toDate) {
        this.notificationManager.showLoading("Fetching data from Github...");

        try {
            const data = await this.apiService.fetchData(fromDate, toDate);

            if (data.error) {
                throw new Error(data.error);
            }

            this.notificationManager.showSuccess();
            this.updateChart();
        } catch (error) {
            console.error("Error:", error);
            this.notificationManager.showError("データの取得に失敗しました");
        } finally {
            this.notificationManager.hideLoading();
        }
    }

    /**
     * チャートを更新
     */
    async updateChart() {
        try {
            const data = await this.apiService.getReviewData();

            // データ処理
            const filteredData = this.dataProcessor.filterNonMembers(data);
            const configuredData = this.dataProcessor.configureDatasets(filteredData);

            // チャートの作成
            this.chartManager.createChart(configuredData, (person) => {
                this.showAuthorPRs(person);
            });
        } catch (error) {
            console.error("Error:", error);
            this.notificationManager.showError();
        }
    }

    /**
     * 作成者のPR情報を表示
     * @param {string} person - 対象者
     */
    async showAuthorPRs(person) {
        try {
            const data = await this.apiService.getReviewData();
            const prData = data["pr_details"];
            const { authorPrs, requestedPrs, completedPrs } =
                this.dataProcessor.filterPRsByPerson(prData, person);

            this.displayOnModal(person, authorPrs, requestedPrs, completedPrs);
        } catch (error) {
            console.error("Error fetching PR info:", error);
            this.notificationManager.showError("PR情報の取得に失敗しました");
        }
    }

    /**
     * モーダルにPR情報を表示
     * @param {string} person - 対象者
     * @param {Array} authorPrs - 作成者のPR
     * @param {Array} requestedPrs - リクエストされたPR
     * @param {Array} completedPrs - 完了済みPR
     */
    displayOnModal(person, authorPrs, requestedPrs, completedPrs) {
        // モーダルコンテンツをクリア
        this.modalManager.clearContent();

        // タイトルを設定
        this.modalManager.setTitle(`${person}'s PRs`);

        // Authorテーブルを作成
        const authorTableContent = this.tableBuilder.createAuthorTable(authorPrs);
        const authorHeader = this.tableBuilder.createSectionHeader("Author");
        this.modalManager.appendContent(authorHeader);
        this.modalManager.appendContent(authorTableContent);

        // Requestedテーブルを作成
        const { tableContent: requestedTableContent, table: tableReq } =
            this.tableBuilder.createRequestedTable(requestedPrs, completedPrs);
        const toggleContent = this.tableBuilder.createCompletedToggle(tableReq);
        const requestedHeader = this.tableBuilder.createSectionHeader("Requested", toggleContent);

        // レビュー済みPRを初期状態で非表示
        this.tableBuilder.hideCompletedPRs(tableReq);

        this.modalManager.appendContent(requestedHeader);
        this.modalManager.appendContent(requestedTableContent);

        // モーダルを表示
        this.modalManager.show();
    }

    /**
     * デフォルトの日付を設定
     */
    async setDefaultDates() {
        try {
            const data = await this.apiService.getReviewData();
            const fromDate = data["period"][0];
            const toDate = data["period"][1];

            const toDateInput = document.getElementById("toDateInput");
            const fromDateInput = document.getElementById("fromDateInput");

            if (fromDateInput) fromDateInput.value = fromDate;
            if (toDateInput) toDateInput.value = toDate;
        } catch (error) {
            console.error("Error setting default dates:", error);
        }
    }
}

// DOMContentLoadedでアプリケーションを自動初期化
document.addEventListener("DOMContentLoaded", () => {
    const analyzer = new GitHubAnalyzerController();
});
