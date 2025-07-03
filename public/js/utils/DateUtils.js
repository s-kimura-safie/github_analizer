/**
 * 日付関連のユーティリティクラス
 */
class DateUtils {
    /**
     * 日付をYYYY-MM-DD形式にフォーマット
     * @param {Date} date - 日付オブジェクト
     * @returns {string} フォーマットされた日付文字列
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    /**
     * 指定日数前の日付を取得
       * @param {number} daysAgo - 何日前か
       * @returns {string} YYYY-MM-DD形式の日付
       */
    getDaysAgo(daysAgo) {
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0];
    }

    /**
     * 今日の日付を取得
     * @returns {string} YYYY-MM-DD形式の今日の日付
     */
    getToday() {
        return new Date().toISOString().split('T')[0];
    }
}
