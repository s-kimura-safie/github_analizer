const express = require('express');
const path = require('path');
const cors = require('cors');
const util = require('util');
const fs = require('fs').promises;

const { exec } = require('child_process');
const app = express();
const port = 3000;
const execPromise = util.promisify(exec);


// 静的ファイルの提供
app.use(express.static('public'));
app.use(cors());

// Pythonスクリプトの実行
async function excutePython() {
    try {
            console.log('Fetching data from Github...');
            const { stdout, stderr } = await execPromise('python3 get_git_data.py');
            console.log(`Python script output: ${stdout}`);
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        // return res.status(500).json({ error: 'Python script error' });
        }
        // const data = JSON.parse(stdout);
        // res.json(data);
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).json({ error: 'Failed to fetch or parse data' });
    }
}

const data = excutePython();

// APIエンドポイント
app.get('/api/review-data', cors(), async (req, res) => {
    const data = await fs.readFile('github_data.json', 'utf8');
    const result = JSON.parse(data);
    res.json(result);
});



// サーバーの起動
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});




// const dummyData = {
//     labels: ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
//     datasets: [
//       {
//         label: 'Author',
//         data: [10, 15, 8, 12, 6],
//         backgroundColor: 'rgba(255, 99, 132, 0.6)',
//       },
//       {
//         label: 'Review Requested',
//         data: [8, 12, 15, 7, 10],
//         backgroundColor: 'rgba(54, 162, 235, 0.6)',
//       },
//       {
//         label: 'Review Completed',
//         data: [5, 10, 12, 9, 8],
//         backgroundColor: 'rgba(75, 192, 192, 0.6)',
//       }
//     ]
//   };

// res.json(data);

