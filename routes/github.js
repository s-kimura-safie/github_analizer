const express = require("express");
const cors = require("cors");
const util = require("util");
const fs = require("fs").promises;
const { exec } = require("child_process");

const router = express.Router();
const execPromise = util.promisify(exec);

// PythonでGithubのデータを更新するエンドポイント
router.post("/run-python", async (req, res) => {
    try {
        console.log("Fetching data from Github...");
        const { fromDate, toDate } = req.body;
        const { stdout, stderr } = await execPromise(`python3 fetch_pr_data.py "${fromDate}" "${toDate}"`);

        // Pythonコードのログメッセージを出力
        if (stderr) {
            console.log("Python logs:", stderr);
        }

        console.log("Success Fetching data from Github");
        return res.json({ message: "Successfully data updated", data: stdout });
    } catch (error) {
        console.error(`Error: ${error}`);
        return res.status(500).json({ error: "Failed to fetch or parse data" });
    }
});

// Githubのデータを返すエンドポイント
router.get("/api/review-data", cors(), async (req, res) => {
    try {
        const data = await fs.readFile("github_data.json", "utf8");
        const result = JSON.parse(data);
        res.json(result);
    } catch (err) {
        console.error("Error reading file:", err);
        res.status(500).json({ error: "Error reading data" });
    }
});

module.exports = router;
