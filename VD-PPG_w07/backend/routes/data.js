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

// 2) Load from OpenData API URL
// Allowed formats:
// A) Array of objects: [ {...}, {...} ]
// B) CKAN datastore_search: { result: { records: [ {...}, ... ] } }
// C) Opendatasoft Explore API v2.1: { results: [ {...}, ... ], total_count: ... }
router.post("/load-api", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const r = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(400).json({
        error: "Fetch failed",
        status: r.status,
        details: text?.slice(0, 3000) || ""
      });
    }

    const payload = await r.json();

    // --- Normalize OpenData formats ---
    let records = null;

    // A) Array of objects
    if (Array.isArray(payload)) records = payload;

    // B) CKAN datastore_search
    if (!records && payload?.result?.records && Array.isArray(payload.result.records)) {
      records = payload.result.records;
    }

    // C) Opendatasoft Explore API v2.1 (your Valencia URL)
    if (!records && payload?.results && Array.isArray(payload.results)) {
      records = payload.results;
    }

    if (!records) {
      return res.status(400).json({
        error:
          "Unsupported API format. Use OpenData returning an array, CKAN {result:{records}}, or Opendatasoft {results}."
      });
    }

    if (records.length === 0) {
      return res.json({ columns: [], rows: [] });
    }

    // Columns: keys from first record, then any extra keys found later
    const firstKeys = Object.keys(records[0] || {});
    const allKeys = new Set(firstKeys);
    for (const rec of records) {
      for (const k of Object.keys(rec || {})) allKeys.add(k);
    }
    const columns = [...firstKeys, ...[...allKeys].filter(k => !firstKeys.includes(k))];

    // Make values table-friendly (objects/arrays -> JSON string)
    const normalizeCell = (v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch { return String(v); }
      }
      return v;
    };

    const rows = records.map(obj => columns.map(c => normalizeCell(obj?.[c])));

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