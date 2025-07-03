const express = require("express");
const path = require("path");
const cors = require("cors");
const routes = require("./routes");
const util = require("util");
const fs = require("fs").promises;
const { exec } = require("child_process");

const app = express();
const port = 4000;

// 静的ファイルの提供
app.use(express.static("public"));
app.use(cors());
app.use(express.json());

// ルートの設定
app.use(routes);

// サーバーの起動
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
