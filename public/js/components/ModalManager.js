/**
 * モーダルの表示・管理を担当するクラス
 */
class ModalManager {
    constructor(modalId, modalContentId, closeButtonSelector) {
        this.modal = document.getElementById(modalId);
        this.modalContent = document.getElementById(modalContentId);
        this.closeBtn = document.querySelector(closeButtonSelector);
        this.setupEventListeners();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // モーダルを閉じるボタンのイベント
        if (this.closeBtn) {
            this.closeBtn.onclick = () => this.close();
        }

        // モーダル外クリックで閉じる
        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.close();
                }
            });
        }
    }

    /**
     * モーダルを表示
     */
    show() {
        this.modal.style.display = "block";
    }

    /**
     * モーダルを閉じる
     */
    close() {
        this.modal.style.display = "none";
    }

    /**
     * モーダルコンテンツをクリア
     */
    clearContent() {
        this.modalContent.innerHTML = "";
    }

    /**
     * モーダルにコンテンツを追加
     * @param {HTMLElement} content - 追加するコンテンツ
     */
    appendContent(content) {
        this.modalContent.appendChild(content);
    }

    /**
     * モーダルタイトルを設定
     * @param {string} title - タイトル
     */
    setTitle(title) {
        const titleElement = document.createElement("h2");
        titleElement.textContent = title;
        this.appendContent(titleElement);
    }
}
