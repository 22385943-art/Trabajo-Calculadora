// Change this when deployed (or use same-origin if serving frontend from backend)
const API_BASE = "/api";

let state = {
  columns: [],
  rows: []
};

const el = (id) => document.getElementById(id);

function setStatus(msg) {
  el("status").textContent = msg;
}

function renderTable(columns, rows) {
  const wrap = el("tableWrap");
  if (!columns.length) {
    wrap.innerHTML = "<div class='small' style='padding:12px;'>No data loaded.</div>";
    return;
  }

  const thead = `<thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${
    rows.slice(0, 500).map(r => `<tr>${r.map(v => `<td>${escapeHtml(String(v ?? ""))}</td>`).join("")}</tr>`).join("")
  }</tbody>`;

  wrap.innerHTML = `<table>${thead}${tbody}</table>
    <div class="small" style="padding:10px;">Showing ${Math.min(rows.length, 500)} of ${rows.length} rows</div>`;
}

function fillDropdowns(columns) {
  const x = el("xCol");
  const y = el("yCol");
  x.innerHTML = "";
  y.innerHTML = "";

  for (const c of columns) {
    const ox = document.createElement("option");
    ox.value = c; ox.textContent = c;
    x.appendChild(ox);

    const oy = document.createElement("option");
    oy.value = c; oy.textContent = c;
    y.appendChild(oy);
  }

  // Default to first two columns if possible
  if (columns.length >= 2) {
    x.value = columns[0];
    y.value = columns[1];
  }
}

function renderRegressionOutput(result) {
  const wrap = el("regWrap");

  const { n, coefficients, metrics, coefficientTable } = result;

  wrap.innerHTML = `
    <div class="info-box">
      <div><div class="small">n</div><div>${n}</div></div>
      <div><div class="small">Slope (β1)</div><div>${fmt(coefficients.slope)}</div></div>
      <div><div class="small">Intercept (β0)</div><div>${fmt(coefficients.intercept)}</div></div>
      <div><div class="small">R²</div><div>${fmt(metrics.r2)}</div></div>
      <div><div class="small">Std. Error</div><div>${fmt(metrics.standardError)}</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Term</th><th>Estimate</th><th>Std. Error</th><th>t</th>
          </tr>
        </thead>
        <tbody>
          ${coefficientTable.map(r => `
            <tr>
              <td>${escapeHtml(r.term)}</td>
              <td>${fmt(r.estimate)}</td>
              <td>${fmt(r.stdError)}</td>
              <td>${fmt(r.t)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function plotRegression(columns, rows, xCol, yCol, result) {
  const xi = columns.indexOf(xCol);
  const yi = columns.indexOf(yCol);

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

  const { slope, intercept } = result.coefficients;

  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const lineX = [minX, maxX];
  const lineY = lineX.map(v => intercept + slope * v);

  const scatter = {
    x, y,
    mode: "markers",
    type: "scatter",
    name: "Data"
  };

  const line = {
    x: lineX,
    y: lineY,
    mode: "lines",
    type: "scatter",
    name: "Regression line"
  };

  const title = `Linear Regression: ${yCol} vs ${xCol}`;

  // “Info box” inside the chart (annotation)
  const info = `y = ${fmt(intercept)} + ${fmt(slope)}x<br>R² = ${fmt(result.metrics.r2)}<br>SE = ${fmt(result.metrics.standardError)}<br>n = ${result.n}`;

  const layout = {
    title: { text: title },
    xaxis: { title: { text: xCol } },
    yaxis: { title: { text: yCol } },
    margin: { t: 60, l: 60, r: 20, b: 60 },
    annotations: [
      {
        xref: "paper",
        yref: "paper",
        x: 0.02,
        y: 0.98,
        xanchor: "left",
        yanchor: "top",
        text: info,
        showarrow: false,
        bordercolor: "#22304f",
        borderwidth: 1,
        bgcolor: "#0d1528",
        font: { size: 12, color: "#e8eefc" }
      }
    ]
  };

  Plotly.newPlot("plot", [scatter, line], layout, { responsive: true });
}

function fmt(v) {
  if (!Number.isFinite(v)) return String(v);
  return (Math.round(v * 100000) / 100000).toString();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

// ---------- Actions ----------

el("btnUploadCsv").addEventListener("click", async () => {
  try {
    const file = el("csvFile").files[0];
    if (!file) return setStatus("Select a CSV file first.");

    setStatus("Uploading CSV...");
    const fd = new FormData();
    fd.append("file", file);

    const r = await fetch(`${API_BASE}/upload-csv`, { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Upload failed");

    state = data;
    renderTable(state.columns, state.rows);
    fillDropdowns(state.columns);
    setStatus(`Loaded CSV: ${state.rows.length} rows, ${state.columns.length} columns.`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

el("btnLoadApi").addEventListener("click", async () => {
  try {
    const url = el("apiUrl").value.trim();
    if (!url) return setStatus("Paste an API URL first.");

    setStatus("Loading API data...");
    const r = await fetch(`${API_BASE}/load-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "API load failed");

    state = data;
    renderTable(state.columns, state.rows);
    fillDropdowns(state.columns);
    setStatus(`Loaded API: ${state.rows.length} rows, ${state.columns.length} columns.`);
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

el("btnRun").addEventListener("click", async () => {
  try {
    if (!state.columns.length) return setStatus("Load data first.");

    const xCol = el("xCol").value;
    const yCol = el("yCol").value;
    if (xCol === yCol) return setStatus("Choose different X and Y columns.");

    setStatus("Running regression...");
    const r = await fetch(`${API_BASE}/regression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, xCol, yCol })
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Regression failed");

    renderRegressionOutput(result);
    plotRegression(state.columns, state.rows, xCol, yCol, result);
    setStatus("Regression completed.");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
});

// Init empty
renderTable([], []);
setStatus("Ready. Load a CSV or API data.");