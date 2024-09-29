document.getElementById('runButton').addEventListener('click', () => {
  fetch('/run-python', {
      method: 'POST',
  })
  .then(response => response.json())
  .then(data => {
      if (data.error) {
          throw new Error(data.error);
      }
      document.getElementById('result').textContent = data.message;

      try {
        displayData();
      } catch (error) {
        console.error('Error parsing data:', error);
      }
  })
  .catch(error => {
      console.error('Error:', error);
      document.getElementById('result').textContent = 'An error occurred';
  });
});

function displayData() {
  fetch('/api/review-data', {
      method: 'GET',
  })
  .then(response => response.json())
  .then(data => {
      const ctx = document.getElementById('reviewChart').getContext('2d');
      
      // 既存のチャートがあれば破棄する
      if (window.reviewChart instanceof Chart) {
          window.reviewChart.destroy();
      }
      
      window.reviewChart = new Chart(ctx, {
          type: 'bar',
          data: data,
          options: {
              responsive: true,
              scales: {
                  x: {
                      stacked: true,
                  },
                  y: {
                      stacked: true,
                      beginAtZero: true
                  }
              },
              plugins: {
                  title: {
                      display: true,
                      text: 'Review Activity by Person'
                  },
                  tooltip: {
                      mode: 'index',
                      intersect: false
                  }
              }
          }
      });
  })
  .catch(error => {
      console.error('Error:', error);
      document.getElementById('result').textContent = 'Failed to fetch or display data';
  });
}

// ページ読み込み時にも初期データを表示
document.addEventListener('DOMContentLoaded', displayData);


