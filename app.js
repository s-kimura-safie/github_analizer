const express = require("express");
const path = require("path");
const cors = require("cors");
const util = require("util");
const fs = require("fs").promises;
const { exec } = require("child_process"); // child_processモジュールからexec関数をインポート

const app = express();
const port = 4001;
const execPromise = util.promisify(exec); // exec関数をPromiseベースの関数に変換

// 静的ファイルの提供
app.use(express.static("public"));
app.use(cors());
app.use(express.json());

// Pythonスクリプトの実行
app.post("/run-python", async (req, res) => {
  try {
    console.log("Fetching data from Github...");
    const { fromDate, toDate } = req.body;
    const { stdout, stderr } = await execPromise(
      `python3 fetch_pr_data.py "${fromDate}" "${toDate}"`
    );
    // ログメッセージを処理
    if (stderr) {
      console.log("Python logs:", stderr);
    }
    console.log("Python script executed successfully");
    return res.json({ message: "Successfully data updated", data: stdout });
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).json({ error: "Failed to fetch or parse data" });
  }
});

// APIエンドポイント
app.get("/api/review-data", cors(), async (req, res) => {
  try {
    const data = await fs.readFile("github_data.json", "utf8");
    const result = JSON.parse(data);
    res.json(result);
  } catch (err) {
    console.error("Error reading file:", err);
    res.status(500).json({ error: "Error reading data" });
  }
});

// サーバーの起動
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
