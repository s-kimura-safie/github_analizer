// ページ読み込み時にも初期データを表示
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();
  updateChart();
});

// ボタンクリック時の処理
document.getElementById("runButton").addEventListener("click", () => {
  const resultDiv = document.getElementById("result");
  const fromDate = document.getElementById("fromDateInput").value;
  const toDate = document.getElementById("toDateInput").value;

  if (!fromDate || !toDate) {
    alert("両方の日付を選択してください");
    return;
  }

  resultDiv.textContent = "Fetching data from Github...";
  resultDiv.style.visibility = "visible";

  fetch("/run-python", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // 送信するデータの形式: JSON
    },
    body: JSON.stringify({ fromDate, toDate }), // 送信するデータ
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
    });
});

function updateChart() {
  fetch("/api/review-data", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      const ctx = document.getElementById("reviewChart").getContext("2d");
      const fromDate = data["period"][0];
      const toDate = data["period"][1];

      // 既存のチャートがあれば破棄する
      if (window.reviewChart instanceof Chart) {
        window.reviewChart.destroy();
      }

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
            },
          },
          plugins: {
            title: {
              display: true,
              text: "Review Activity in AI Vision from " + fromDate + " to " + toDate,
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
      const filteredPrData = prData.filter((item) => item.author.includes(person));
      displayOnModal(person, filteredPrData);
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

// モーダルにPR情報を表示する関数
function displayOnModal(person, prData) {
  // テンプレートのbodyを取得
  const template = document.getElementById("pr-table-template");
  const tableContent = template.content.cloneNode(true);
  const tbody = tableContent.querySelector("tbody");

  // データを挿入
  prData.forEach((pr) => {
    const row = document.createElement("tr");
    const isClosedPR = pr.status.toLowerCase().includes("close");
    if (isClosedPR) {
      row.classList.add("closed");
    }

    created_day = new Date(pr.created_day);
    str_created_day = formatDate(created_day);

    if (pr.closed_day === null) {
      str_closed_day = "-";
      daysDiff = "-";
    }
    else {
      closed_day = new Date(pr.closed_day);
      daysDiff = dateDiffInDays(created_day, closed_day) + 1;
      str_closed_day = formatDate(closed_day);
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

  // モーダルコンテンツにPR情報を追加
  modalContent.innerHTML = "";
  modalContent.appendChild(document.createElement("h2")).textContent = `${person}'s PRs`;
  modalContent.appendChild(tableContent);

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
  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  const toDateInput = document.getElementById("toDateInput");
  const fromDateInput = document.getElementById("fromDateInput");

  toDateInput.value = formatDate(today);
  fromDateInput.value = formatDate(oneWeekAgo);
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
