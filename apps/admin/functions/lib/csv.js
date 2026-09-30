// CSV that opens cleanly in Excel and Google Sheets.
//  - UTF-8 byte-order mark so Excel reads accents and curly quotes correctly
//  - fields quoted when they contain a comma, quote or line break
//  - cells that start with = + - @ (or a tab/CR) get a leading apostrophe, so a form
//    answer can't run as a spreadsheet formula when the file is opened ("CSV injection")

export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
