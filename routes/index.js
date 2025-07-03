const express = require("express");
const githubRoutes = require("./github");

const router = express.Router();

// GitHub関連のルートを登録
router.use(githubRoutes);

module.exports = router;
