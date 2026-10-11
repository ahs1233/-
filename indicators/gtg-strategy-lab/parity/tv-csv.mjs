// TradingView "Export chart data" CSV: header = time, open, high, low, close, then one
// column per plot title. time is UNIX seconds or an ISO date string; na is an empty cell
// (or "NaN").

function splitCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (s) => (s === undefined || s === '' || s === 'NaN' || s === 'nan' ? NaN : Number(s));

export function parseTvCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = new Map();
  header.forEach((h, i) => { if (!idx.has(h)) idx.set(h, i); });
  for (const need of ['time', 'open', 'high', 'low', 'close']) if (!idx.has(need)) throw new Error(`CSV has no "${need}" column`);
  const decimals = new Map();
  const rows = lines.slice(1).map((l) => {
    const cells = splitCsvLine(l);
    const r = {};
    for (const [h, i] of idx) {
      const raw = (cells[i] ?? '').trim();
      if (h === 'time') {
        r.t = /^\d+(\.\d+)?$/.test(raw) ? Math.round(Number(raw) * 1000) : Date.parse(raw);
        continue;
      }
      r[h] = num(raw);
      const d = raw.includes('.') ? raw.length - raw.indexOf('.') - 1 : 0;
      if (raw !== '' && Number.isFinite(r[h])) decimals.set(h, Math.max(decimals.get(h) ?? 0, d));
    }
    return r;
  });
  return { header, rows, decimals };
}

const cell = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : String(v));

export function writeTvCsv(header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => (h === 'time' ? String(Math.round(r.t / 1000)) : cell(r[h]))).join(','));
  return lines.join('\n') + '\n';
}
