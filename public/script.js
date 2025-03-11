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

function fetchGithubData(fromDate, toDate) {
  const resultDiv = document.getElementById("result");
  const loading = document.getElementById('loading');

  resultDiv.textContent = "Fetching data from Github...";
  resultDiv.style.visibility = "visible";
  loading.style.display = 'block';

  fetch("/run-python", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fromDate, toDate }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(data.error);
      }
      try {
        showResult();
        updateChart();
      } catch (error) {
        console.error("Error:", error);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    })
    .finally(() => {
      loading.style.display = 'none';
    });
}

function updateChart() {
  fetch("/api/review-data", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      const ctx = document.getElementById("reviewChart").getContext("2d");
      data.datasets = [data.datasets[2], data.datasets[1], data.datasets[0]];
      data.datasets[0].backgroundColor = "#439D64";;
      data.datasets[1].backgroundColor = "#FF6565";
      data.datasets[2].backgroundColor = "#40A2C0";
      const fromDate = data["period"][0];
      const toDate = data["period"][1];

      // 既存のチャートがあれば破棄する
      if (window.reviewChart instanceof Chart) {
        window.reviewChart.destroy();
      }

      // データセットの最大値を計算
      let maxPrNum = calcMaxPrNum(data);

      window.reviewChart = new Chart(ctx, {
        type: "bar",
        data: data,
        options: {
          responsive: true,
          scales: {
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
              beginAtZero: true,
              max: maxPrNum + 2, 
            },
          },
          plugins: {
            title: {
              display: true,
              text: "Review Activity in AI Vision from " + fromDate + " to " + toDate,
              font: {
                size: 20,
              }
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

              // クリックされた人のPR情報を取得
              showAuthorPRs(person);
            }
          },
        },
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      document.getElementById("result").textContent = "Failed to fetch or display data";
    });
}

// クリックした人物がAuthorのPR情報を表示する関数
function showAuthorPRs(person) {
  fetch("/api/review-data", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      const prData = data["pr_details"];
      const authorPrs = prData.filter((item) => item.author.includes(person));
      // const requestedPrs = prData.filter((item) => item.requested.includes(person));
      const requestedPrs = prData.filter((item) => item.requested.some((req) => req.includes(person)));
      displayOnModal(person, authorPrs, requestedPrs);
    })
    .catch((error) => {
      console.error("Error fetching PR info:", error);
    });
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
function insertPRData(prs, tbody) {
  prs.forEach((pr) => {
    const row = document.createElement("tr");
    const isClosedPR = pr.status.toLowerCase().includes("close");
    if (isClosedPR) {
      row.classList.add("closed");
    }

    const created_day = new Date(pr.created_day);
    const str_created_day = formatDate(created_day);

    let str_closed_day, daysDiff;
    if (pr.closed_day === null) {
      str_closed_day = "-";
      const closed_day = new Date(); // PRがクローズされていない場合は、今日の日付を使用
      daysDiff = dateDiffInDays(created_day, closed_day) + 1;
    } else {
      const closed_day = new Date(pr.closed_day);
      str_closed_day = formatDate(closed_day);
      daysDiff = dateDiffInDays(created_day, closed_day) + 1;
    }

    row.innerHTML = `
        <td>${str_created_day}</td>
        <td>${str_closed_day}</td>
        <td>${daysDiff}</td>
        <td>${pr.title}</td>
        <td>${pr.status}</td>
        <td><a href="${pr.html_url}" target="_blank">Link</a></td>
      `;

    tbody.appendChild(row);
  });
}

// モーダルにPR情報を表示する関数
function displayOnModal(person, authorPrs, requestedPrs) {
  // テンプレートのbodyを取得
  const template = document.getElementById("pr-table-template");

    // Author PRsのテーブルを作成
    const authorTableContent = template.content.cloneNode(true);
    const tableAuth = authorTableContent.querySelector("table");
    tableAuth.classList.add("pr-table-author");
    const tbodyAuthor = authorTableContent.querySelector("tbody");
    insertPRData(authorPrs, tbodyAuthor);
  
    // Requested PRsのテーブルを作成
    const requestedTableContent = template.content.cloneNode(true);
    tableReq = requestedTableContent.querySelector("table");
    tableReq.classList.add("pr-table-requested");
    const tbodyReqested = requestedTableContent.querySelector("tbody");
    insertPRData(requestedPrs, tbodyReqested);
  
    // モーダルコンテンツにPR情報を追加
    modalContent.innerHTML = "";
    modalContent.appendChild(document.createElement("h2")).textContent = `${person}'s PRs`;
    modalContent.appendChild(document.createElement("h3")).textContent = "Author";
    modalContent.appendChild(authorTableContent);
    modalContent.appendChild(document.createElement("h3")).textContent = "Requested";
    modalContent.appendChild(requestedTableContent);
  
    // モーダルを表示
    modal.style.display = "block";
}

// データ更新の結果を表示する関数
function showResult() {
  const resultDiv = document.getElementById("result");
  resultDiv.textContent = "Successfully data updated";
  resultDiv.style.visibility = "visible"; // 表示
  setTimeout(() => {
    resultDiv.style.visibility = "hidden"; // 3秒後に非表示
  }, 5000);
}

// デフォルトの日付を設定する関数
function setDefaultDates() {
  fetch("/api/review-data", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
    const fromDate = data["period"][0];
    const toDate = data["period"][1];
    const toDateInput = document.getElementById("toDateInput");
    const fromDateInput = document.getElementById("fromDateInput");
    fromDateInput.value = fromDate;
    toDateInput.value = toDate;
  })
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
