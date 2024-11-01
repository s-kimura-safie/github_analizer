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

function showAuthorPRs(person) {
  fetch("/api/review-data", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((data) => {
      const prData = data["pr_details"];
      console.log("PR Data for", person, ":", prData);
      const filteredPrData = prData.filter((item) => item.author.includes(person));
      console.log("Filtered PR Data for", person, ":", filteredPrData);
      showPopup(person, filteredPrData);
    })
    .catch((error) => {
      console.error("Error fetching PR info:", error);
    });
}

function showPopup(person, prData) {
  // オーバーレイの作成
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
  overlay.style.zIndex = "999";
  // モーダルの作成
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.left = "50%";
  modal.style.top = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.backgroundColor = "white";
  modal.style.padding = "20px";
  modal.style.border = "1px solid black";
  modal.style.zIndex = "1000";
  modal.style.maxHeight = "80vh";
  modal.style.overflowY = "auto";

  // モーダルの内容
  let content = `<h2>${person}'s PRs</h2>`;
  content += "<ul>";
  prData.forEach((pr) => {
    const isClosedPR = pr.status.toLowerCase().includes("close");
    // Closeの場合は薄いグレーで表示
    const textColor = isClosedPR ? "#999999" : "inherit";
    content += `<li style="color: ${textColor};">
    <strong>${pr.title}</strong> (${pr.status}) - 
    <a href="${pr.html_url}" target="_blank" style="color: ${textColor};">Link</a>
    </li>`;
  });
  content += "</ul>";

  modal.innerHTML = content;
  // オーバーレイをクリックしたらモーダルを閉じる
  overlay.onclick = function () {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  };

  // モーダル内のクリックはオーバーレイに伝播させない
  modal.onclick = function (event) {
    event.stopPropagation();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

// ページ読み込み時にも初期データを表示
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDates();
  updateChart();
});

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
