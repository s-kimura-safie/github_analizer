// APIからデータを取得してグラフを描画
fetch('/api/review-data', {
  method: 'GET',
})
  .then(response => response.json())
  .then(data => {
    const ctx = document.getElementById('reviewChart').getContext('2d');
    new Chart(ctx, {
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
  .catch(error => console.error('Error:', error));
