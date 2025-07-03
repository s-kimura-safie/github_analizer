/**
 * データの処理とフィルタリングを担当するクラス
 */
class DataProcessor {
    constructor() {
        this.nonMemberLabels = ["s-doi"];
    }

    /**
     * 非メンバーをフィルタリング
     * @param {Object} data - 元データ
     * @returns {Object} フィルタリング済みデータ
     */
    filterNonMembers(data) {
        const labelsToRemove = data.labels.filter((label) =>
            this.nonMemberLabels.includes(label)
        );
        const labelsToRemoveIndex = labelsToRemove.map((label) =>
            data.labels.indexOf(label)
        );

        // ラベルとデータセットから対象者を削除
        data.labels = data.labels.filter((_, index) =>
            !labelsToRemoveIndex.includes(index)
        );
        data.datasets.forEach((dataset) => {
            dataset.data = dataset.data.filter((_, index) =>
                !labelsToRemoveIndex.includes(index)
            );
        });

        return data;
    }

    /**
     * データセットの順番と色を設定
     * @param {Object} data - データ
     * @returns {Object} 設定済みデータ
     */
    configureDatasets(data) {
        data.datasets = [data.datasets[2], data.datasets[1], data.datasets[0]];
        data.datasets[0].backgroundColor = "#439D64";
        data.datasets[1].backgroundColor = "#FF6565";
        data.datasets[2].backgroundColor = "#40A2C0";
        return data;
    }

    /**
     * 最大PR数を計算
     * @param {Object} prData - PRデータ
     * @returns {number} 最大PR数
     */
    calcMaxPrNum(prData) {
        let maxPrNum = 0;
        for (let memberIdx = 0; memberIdx < prData.labels.length; memberIdx++) {
            let sum = 0;
            for (let datasetIdx = 0; datasetIdx < prData.datasets.length; datasetIdx++) {
                const prNum = prData.datasets[datasetIdx].data[memberIdx];
                sum += prNum;
            }
            if (sum > maxPrNum) {
                maxPrNum = sum;
            }
        }
        return maxPrNum;
    }

    /**
     * PRデータをフィルタリング
     * @param {Array} prData - PRデータ配列
     * @param {string} person - 対象者
     * @returns {Object} フィルタリング済みPRデータ
     */
    filterPRsByPerson(prData, person) {
        return {
            authorPrs: prData.filter((item) => item.author.includes(person)),
            requestedPrs: prData.filter((item) =>
                item.requested.some((req) => req.includes(person))
            ),
            completedPrs: prData.filter((item) =>
                item.completed.some((req) => req.includes(person))
            )
        };
    }
}
