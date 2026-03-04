const express = require("express");
const multer = require("multer");
const Papa = require("papaparse");
const { parseCsvBuffer } = require("../utils/csv");
const { linearRegression } = require("../utils/regression");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1) Upload CSV -> returns { columns, rows }
router.post("/upload-csv", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { columns, rows } = parseCsvBuffer(req.file.buffer);
    return res.json({ columns, rows });
  } catch (e) {
    return res.status(500).json({ error: "CSV parse failed", details: String(e) });
  }
});

// 2) Load from API URL -> expects JSON array of objects
router.post("/load-api", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const r = await fetch(url);
    if (!r.ok) return res.status(400).json({ error: "Fetch failed", status: r.status });

    const data = await r.json();
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "API must return an array of objects" });
    }

    const columns = Object.keys(data[0] || {});
    const rows = data.map(obj => columns.map(c => obj[c]));

    return res.json({ columns, rows });
  } catch (e) {
    return res.status(500).json({ error: "API load failed", details: String(e) });
  }
});

// 3) Regression -> send xColName, yColName + data
router.post("/regression", (req, res) => {
  try {
    const { columns, rows, xCol, yCol } = req.body;
    if (!columns || !rows || !xCol || !yCol) {
      return res.status(400).json({ error: "Missing columns/rows/xCol/yCol" });
    }

    const xi = columns.indexOf(xCol);
    const yi = columns.indexOf(yCol);
    if (xi < 0 || yi < 0) return res.status(400).json({ error: "Invalid column names" });

    // Convert to numeric pairs, drop invalid rows
    const x = [];
    const y = [];
    for (const row of rows) {
      const xv = Number(row[xi]);
      const yv = Number(row[yi]);
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        x.push(xv);
        y.push(yv);
      }
    }
    if (x.length < 2) return res.status(400).json({ error: "Not enough numeric data points" });

    const result = linearRegression(x, y);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: "Regression failed", details: String(e) });
  }
});

module.exports = router;