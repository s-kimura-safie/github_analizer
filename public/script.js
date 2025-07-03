// GitHub API専用の関数
const GitHubApi = {
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
  },

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
};

// ページ読み込み時にも初期データを表示
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();
  updateChart();
});

// 手動日付選択のボタンクリック処理
document.getElementById("runButton").addEventListener("click", () => {
  const fromDate = document.getElementById("fromDateInput").value;
  const toDate = document.getElementById("toDateInput").value;

  if (!fromDate || !toDate) {
    alert("両方の日付を選択してください");
    return;
  }

  fetchGithubData(fromDate, toDate);
});

// 週間ボタンクリック処理
document.getElementById("weekly-btn").addEventListener("click", () => {
  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  fetchGithubData(fromDate, toDate);
});

// 月間ボタンクリック処理
document.getElementById("monthly-btn").addEventListener("click", () => {
  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  fetchGithubData(fromDate, toDate);
});

async function fetchGithubData(fromDate, toDate) {
  const resultDiv = document.getElementById("result");
  const loading = document.getElementById('loading');

  resultDiv.textContent = "Fetching data from Github...";
  resultDiv.style.visibility = "visible";
  loading.style.display = 'block';

  try {
    const data = await GitHubApi.fetchData(fromDate, toDate);

    if (data.error) {
      throw new Error(data.error);
    }

    showResult();
    updateChart();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    loading.style.display = 'none';
  }
}

// データ処理：メンバーフィルタリング
function filterNonMembers(data) {
  const nonMemberLabels = ["s-doi"];
  const labelsToRemove = data.labels.filter((label) => nonMemberLabels.includes(label));
  const labelsToRemoveIndex = labelsToRemove.map((label) => data.labels.indexOf(label));

  // ラベルとデータセットから対象者を削除
  data.labels = data.labels.filter((_, index) => !labelsToRemoveIndex.includes(index));
  data.datasets.forEach((dataset) => {
    dataset.data = dataset.data.filter((_, index) => !labelsToRemoveIndex.includes(index));
  });

  return data;
}

// データ処理：データセットの順番と色の設定
function configureDatasets(data) {
  data.datasets = [data.datasets[2], data.datasets[1], data.datasets[0]];
  data.datasets[0].backgroundColor = "#439D64";
  data.datasets[1].backgroundColor = "#FF6565";
  data.datasets[2].backgroundColor = "#40A2C0";
  return data;
}

// チャート設定の作成
function createChartOptions(data) {
  const fromDate = data["period"][0];
  const toDate = data["period"][1];
  const maxPrNum = calcMaxPrNum(data);

  return {
    responsive: true,
    scales: {
      x: { stacked: true },
      y: {
        stacked: true,
        beginAtZero: true,
        max: maxPrNum + 2,
      },
    },
    plugins: {
      title: {
        display: true,
        text: `Review Activity in AI Vision from ${fromDate} to ${toDate}`,
        font: { size: 20 }
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const person = data.labels[index];
        console.log("Clicked on:", person);
        showAuthorPRs(person);
      }
    },
  };
}

// チャートの作成
function createChart(ctx, data, options) {
  // 既存のチャートがあれば破棄
  if (window.reviewChart instanceof Chart) {
    window.reviewChart.destroy();
  }

  window.reviewChart = new Chart(ctx, {
    type: "bar",
    data: data,
    options: options,
  });
}

// メイン関数：updateChart()
async function updateChart() {
  try {
    const data = await GitHubApi.getReviewData();
    const ctx = document.getElementById("reviewChart").getContext("2d");
    console.log("Fetched data:", data);

    // データ処理
    const filteredData = filterNonMembers(data);
    const configuredData = configureDatasets(filteredData);

    // チャート設定の作成
    const chartOptions = createChartOptions(configuredData);

    // チャートの作成
    createChart(ctx, configuredData, chartOptions);
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("result").textContent = "Failed to fetch or display data";
  }
}

// クリックした人物がAuthorのPR情報を表示する関数
async function showAuthorPRs(person) {
  try {
    const data = await GitHubApi.getReviewData();
    const prData = data["pr_details"];
    const authorPrs = prData.filter((item) => item.author.includes(person));
    const requestedPrs = prData.filter((item) => item.requested.some((req) => req.includes(person)));
    const completedPrs = prData.filter((item) => item.completed.some((req) => req.includes(person)));
    displayOnModal(person, authorPrs, requestedPrs, completedPrs);
  } catch (error) {
    console.error("Error fetching PR info:", error);
  }
}

// モーダル関連の要素を取得
const modal = document.getElementById("prModal");
const modalContent = document.getElementById("prModalContent");
const closeBtn = document.querySelector(".close");

// モーダルを閉じる関数（グローバルスコープで定義）
function closeModal() {
  modal.style.display = "none";
}

// モーダルを閉じるボタンにイベントリスナーを追加
closeBtn.onclick = closeModal;

// モーダル外をクリックしたときにモーダルを閉じる
window.onclick = function (event) {
  if (event.target == modal) {
    closeModal();
  }
};

// PRデータを表に挿入する関数
function insertPRData(prs, tbody, isCompleted = false) {
  prs.forEach((pr) => {
    const row = document.createElement("tr");
    const isClosedPR = pr.status.toLowerCase().includes("close");
    if (isClosedPR) {
      row.classList.add("closed");
    }
    if (isCompleted) {
      row.classList.add("completed");
    }

    const created_day = new Date(pr.created_day);
    const str_created_day = formatDate(created_day);

    let str_closed_day;
    if (pr.closed_day === null) {
      str_closed_day = "-";
      const closed_day = new Date(); // PRがクローズされていない場合は、今日の日付を使用
    } else {
      const closed_day = new Date(pr.closed_day);
      str_closed_day = formatDate(closed_day);
    }

    let num_comments;
    if (pr.num_comments === null) {
      num_comments = 0;
    }
    else {
      num_comments = pr.num_comments;
    }

    let lifetime
    if (pr.lifetime_day === null) {
      lifetime = "-";
    }
    else {
      lifetime = pr.lifetime_day * 24 + pr.lifetime_hour + "h";
    }

    let first_review
    if (pr.first_review_min === null) {
      first_review = "-";
    }
    else {
      first_review = pr.first_review_hour + "h" + pr.first_review_min + "m";
    }

    row.innerHTML = `
        <td>${str_created_day}</td>
        <td>${str_closed_day}</td>
        <td>${lifetime}</td>
        <td>${first_review}</td>
        <td>${pr.title}</td>
        <td>${pr.status}</td>
        <td>${num_comments}</td>
        <td><a href="${pr.html_url}" target="_blank">Link</a></td>
      `;

    tbody.appendChild(row);
  });
}

// テーブル作成：Author PRsのテーブル
function createAuthorTable(authorPrs) {
  const template = document.getElementById("pr-table-template");
  const authorTableContent = template.content.cloneNode(true);
  const tableAuth = authorTableContent.querySelector("table");
  tableAuth.classList.add("pr-table-author");
  const tbodyAuthor = authorTableContent.querySelector("tbody");
  insertPRData(authorPrs, tbodyAuthor);
  return authorTableContent;
}

// テーブル作成：Requested PRsのテーブル
function createRequestedTable(requestedPrs, completedPrs) {
  const template = document.getElementById("pr-table-template");
  const requestedTableContent = template.content.cloneNode(true);
  const tableReq = requestedTableContent.querySelector("table");
  tableReq.classList.add("pr-table-requested");
  const tbodyRequested = requestedTableContent.querySelector("tbody");

  // リクエストされたPRとレビュー済みPRを追加
  insertPRData(requestedPrs, tbodyRequested);
  insertPRData(completedPrs, tbodyRequested, true);

  return { tableContent: requestedTableContent, table: tableReq };
}

// トグル作成とイベント設定
function createCompletedToggle(tableReq) {
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

// ヘッダーの作成（見出しとトグルの横並び配置）
function createSectionHeader(title, toggleContent) {
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";

  const titleElement = document.createElement("h3");
  titleElement.textContent = title;
  titleElement.style.marginRight = "20px";

  header.style.marginBottom = "-20px";
  header.style.marginTop = "20px";
  header.appendChild(titleElement);

  if (toggleContent) {
    header.appendChild(toggleContent);
  }

  return header;
}

// レビュー済みPRを初期状態で非表示にする
function hideCompletedPRs(tableReq) {
  const completedRows = tableReq.querySelectorAll(".completed");
  completedRows.forEach(row => {
    row.style.display = "none";
  });
}

// モーダルコンテンツの構築
function buildModalContent(person, authorTableContent, requestedTableContent, toggleContent) {
  const modalContent = document.getElementById("prModalContent");

  // モーダルコンテンツをクリア
  modalContent.innerHTML = "";

  // タイトルの追加
  const title = document.createElement("h2");
  title.textContent = `${person}'s PRs`;
  modalContent.appendChild(title);

  // Authorセクション
  const authorHeader = createSectionHeader("Author");
  authorHeader.style.marginTop = "40px";
  modalContent.appendChild(authorHeader);
  modalContent.appendChild(authorTableContent);

  // Requestedセクション
  const requestedHeader = createSectionHeader("Requested", toggleContent);
  modalContent.appendChild(requestedHeader);
  modalContent.appendChild(requestedTableContent);
}

// メイン関数：displayOnModal()
function displayOnModal(person, authorPrs, requestedPrs, completedPrs) {
  // テーブルの作成
  const authorTableContent = createAuthorTable(authorPrs);
  const { tableContent: requestedTableContent, table: tableReq } = createRequestedTable(requestedPrs, completedPrs);

  // トグルの作成
  const toggleContent = createCompletedToggle(tableReq);

  // レビュー済みPRを初期状態で非表示
  hideCompletedPRs(tableReq);

  // モーダルコンテンツの構築
  buildModalContent(person, authorTableContent, requestedTableContent, toggleContent);

  // モーダルを表示
  const modal = document.getElementById("prModal");
  modal.style.display = "block";
}

// データ更新の結果を表示する関数
function showResult() { // TODO:関数名のResultがあいまい
  const resultDiv = document.getElementById("result");
  resultDiv.textContent = "Successfully data updated";
  resultDiv.style.visibility = "visible"; // 表示
  setTimeout(() => {
    resultDiv.style.visibility = "hidden"; // 3秒後に非表示
  }, 5000);
}

// デフォルトの日付を設定する関数
async function setDefaultDates() {
  try {
    const data = await GitHubApi.getReviewData();
    const fromDate = data["period"][0];
    const toDate = data["period"][1];
    const toDateInput = document.getElementById("toDateInput");
    const fromDateInput = document.getElementById("fromDateInput");
    fromDateInput.value = fromDate;
    toDateInput.value = toDate;
  } catch (error) {
    console.error("Error setting default dates:", error);
  }
}

// 日付をYYYY-MM-DD形式にフォーマットする関数
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateDiffInDays(date1, date2) {
  const dt1 = new Date(date1);
  const dt2 = new Date(date2);

  // UTC日付に変換（時差の影響を排除）
  const utc1 = Date.UTC(dt1.getFullYear(), dt1.getMonth(), dt1.getDate());
  const utc2 = Date.UTC(dt2.getFullYear(), dt2.getMonth(), dt2.getDate());

  // 日数の差を計算（ミリ秒を日に変換）
  const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));

  return diffDays;
}

function calcMaxPrNum(prData) {
  let maxPrNum = 0;
  for (let memberIdx = 0; memberIdx < prData.labels.length; memberIdx++) {
    let sum = 0;
    for (let datasetIdx = 0; datasetIdx < prData.datasets.length; datasetIdx++) {
      prNum = prData.datasets[datasetIdx].data[memberIdx];
      sum += prNum;
    }
    if (sum > maxPrNum) {
      maxPrNum = sum;
    }
  }
  return maxPrNum;
}
