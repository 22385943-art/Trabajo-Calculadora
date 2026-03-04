const Papa = require("papaparse");

function parseCsvBuffer(buffer) {
  const text = buffer.toString("utf-8");

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || "CSV parsing error");
  }

  const columns = parsed.meta.fields || [];
  const rows = parsed.data.map(obj => columns.map(c => obj[c]));

  return { columns, rows };
}

module.exports = { parseCsvBuffer };