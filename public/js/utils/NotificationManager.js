/**
 * 通知とローディング表示を管理するクラス
 */
class NotificationManager {
    constructor() {
        this.resultDiv = document.getElementById("result");
        this.loading = document.getElementById('loading');
    }

    /**
     * ローディング表示を開始
     * @param {string} message - 表示メッセージ
     */
    showLoading(message = "Loading...") {
        if (this.resultDiv) {
            this.resultDiv.textContent = message;
            this.resultDiv.style.visibility = "visible";
        }
        if (this.loading) {
            this.loading.style.display = 'block';
        }
    }

    /**
     * ローディング表示を終了
     */
    hideLoading() {
        if (this.loading) {
            this.loading.style.display = 'none';
        }
    }

    /**
     * 成功メッセージを表示
     * @param {string} message - 表示メッセージ
     * @param {number} duration - 表示時間（ミリ秒）
     */
    showSuccess(message = "Successfully data updated", duration = 5000) {
        if (this.resultDiv) {
            this.resultDiv.textContent = message;
            this.resultDiv.style.visibility = "visible";

            setTimeout(() => {
                this.resultDiv.style.visibility = "hidden";
            }, duration);
        }
    }

    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    showError(message = "Failed to fetch or display data") {
        if (this.resultDiv) {
            this.resultDiv.textContent = message;
            this.resultDiv.style.visibility = "visible";
        }
    }

    /**
     * アラートを表示
     * @param {string} message - アラートメッセージ
     */
    showAlert(message) {
        alert(message);
    }
}
