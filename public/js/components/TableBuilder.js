/**
 * PRテーブルの作成と管理を担当するクラス
 */
class TableBuilder {
    constructor() {
        this.dateUtils = new DateUtils();
    }

    /**
     * PRデータを表に挿入
     * @param {Array} prs - PRデータ配列
     * @param {HTMLElement} tbody - テーブルのtbody要素
     * @param {boolean} isCompleted - 完了済みかどうか
     */
    insertPRData(prs, tbody, isCompleted = false) {
        prs.forEach((pr) => {
            const row = document.createElement("tr");
            const isClosedPR = pr.status.toLowerCase().includes("close");

            if (isClosedPR) {
                row.classList.add("closed");
            }
            if (isCompleted) {
                row.classList.add("completed");
            }

            const createdDay = new Date(pr.created_day);
            const strCreatedDay = this.dateUtils.formatDate(createdDay);

            let strClosedDay;
            if (pr.closed_day === null) {
                strClosedDay = "-";
            } else {
                const closedDay = new Date(pr.closed_day);
                strClosedDay = this.dateUtils.formatDate(closedDay);
            }

            const numComments = pr.num_comments || 0;

            let lifetime;
            if (pr.lifetime_day === null) {
                lifetime = "-";
            } else {
                lifetime = pr.lifetime_day * 24 + pr.lifetime_hour + "h";
            }

            let firstReview;
            if (pr.first_review_min === null) {
                firstReview = "-";
            } else {
                firstReview = pr.first_review_hour + "h" + pr.first_review_min + "m";
            }

            row.innerHTML = `
        <td>${strCreatedDay}</td>
        <td>${strClosedDay}</td>
        <td>${lifetime}</td>
        <td>${firstReview}</td>
        <td>${pr.title}</td>
        <td>${pr.status}</td>
        <td>${numComments}</td>
        <td><a href="${pr.html_url}" target="_blank">Link</a></td>
      `;

            tbody.appendChild(row);
        });
    }

    /**
     * Author PRsのテーブルを作成
     * @param {Array} authorPrs - AuthorのPRデータ
     * @returns {DocumentFragment} テーブルコンテンツ
     */
    createAuthorTable(authorPrs) {
        const template = document.getElementById("pr-table-template");
        const authorTableContent = template.content.cloneNode(true);
        const tableAuth = authorTableContent.querySelector("table");
        tableAuth.classList.add("pr-table-author");
        const tbodyAuthor = authorTableContent.querySelector("tbody");
        this.insertPRData(authorPrs, tbodyAuthor);
        return authorTableContent;
    }

    /**
     * Requested PRsのテーブルを作成
     * @param {Array} requestedPrs - リクエストされたPRデータ
     * @param {Array} completedPrs - 完了済みPRデータ
     * @returns {Object} テーブルコンテンツと表要素
     */
    createRequestedTable(requestedPrs, completedPrs) {
        const template = document.getElementById("pr-table-template");
        const requestedTableContent = template.content.cloneNode(true);
        const tableReq = requestedTableContent.querySelector("table");
        tableReq.classList.add("pr-table-requested");
        const tbodyRequested = requestedTableContent.querySelector("tbody");

        // リクエストされたPRとレビュー済みPRを追加
        this.insertPRData(requestedPrs, tbodyRequested);
        this.insertPRData(completedPrs, tbodyRequested, true);

        return { tableContent: requestedTableContent, table: tableReq };
    }

    /**
     * 完了済みPRの表示/非表示トグルを作成
     * @param {HTMLElement} tableReq - テーブル要素
     * @returns {DocumentFragment} トグルコンテンツ
     */
    createCompletedToggle(tableReq) {
        const toggleTemplate = document.getElementById("completed-toggle-template");
        const toggleContent = toggleTemplate.content.cloneNode(true);
        const toggleCheckbox = toggleContent.querySelector("#showCompletedToggle");

        // トグルのイベントリスナーを設定
        toggleCheckbox.addEventListener("change", function () {
            const completedRows = tableReq.querySelectorAll(".completed");
            completedRows.forEach(row => {
                row.style.display = this.checked ? "" : "none";
            });
        });

        return toggleContent;
    }

    /**
     * セクションヘッダーを作成
     * @param {string} title - タイトル
     * @param {DocumentFragment} toggleContent - トグルコンテンツ（オプション）
     * @returns {HTMLElement} ヘッダー要素
     */
    createSectionHeader(title, toggleContent = null) {
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.marginBottom = "-20px";
        header.style.marginTop = "20px";

        const titleElement = document.createElement("h3");
        titleElement.textContent = title;
        titleElement.style.marginRight = "20px";
        header.appendChild(titleElement);

        if (toggleContent) {
            header.appendChild(toggleContent);
        }

        return header;
    }

    /**
     * レビュー済みPRを初期状態で非表示にする
     * @param {HTMLElement} tableReq - テーブル要素
     */
    hideCompletedPRs(tableReq) {
        const completedRows = tableReq.querySelectorAll(".completed");
        completedRows.forEach(row => {
            row.style.display = "none";
        });
    }
}
