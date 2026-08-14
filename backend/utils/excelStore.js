/* ===================================================================
   excelStore.js — All ContactQueries.xlsx read/write logic lives here.
   - Creates the workbook + header row the first time it's needed.
   - Every write reopens the file, appends, and saves (never overwrites
     existing rows).
   - A tiny in-process write queue serialises concurrent requests so
     two near-simultaneous submissions can't corrupt the file.
=================================================================== */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXCEL_PATH = path.join(DATA_DIR, 'ContactQueries.xlsx');
const SHEET_NAME = 'ContactQueries';

const COLUMNS = [
  { header: 'Query ID', key: 'queryId', width: 18 },
  { header: 'Full Name', key: 'fullName', width: 22 },
  { header: 'Email', key: 'email', width: 26 },
  { header: 'Mobile Number', key: 'mobile', width: 16 },
  { header: 'Subject', key: 'subject', width: 28 },
  { header: 'Query Type', key: 'queryType', width: 18 },
  { header: 'Message', key: 'message', width: 46 },
  { header: 'Attachment', key: 'attachment', width: 22 },
  { header: 'Submission Date', key: 'submissionDate', width: 16 },
  { header: 'Submission Time', key: 'submissionTime', width: 14 },
  { header: 'Status', key: 'status', width: 14 }
];

// Simple promise-chain write queue to serialise file access.
let queue = Promise.resolve();
function enqueue(task){
  const next = queue.then(task, task);
  queue = next.catch(() => {}); // don't let one failure jam the queue
  return next;
}

async function ensureFile(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(EXCEL_PATH)) return;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 1 }] // freeze header row
  });
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' }
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  await workbook.xlsx.writeFile(EXCEL_PATH);
}

async function loadWorkbook(){
  await ensureFile();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  let sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet){
    sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.columns = COLUMNS;
  }
  // Re-apply column keys in case the sheet was loaded from disk (ExcelJS
  // keeps values but column `key` mapping needs to be set again).
  sheet.columns = COLUMNS;
  return { workbook, sheet };
}

/** Appends a new record as a new row. Never overwrites existing rows. */
async function appendRecord(record){
  return enqueue(async () => {
    const { workbook, sheet } = await loadWorkbook();
    sheet.addRow(record);
    await workbook.xlsx.writeFile(EXCEL_PATH);
    return record;
  });
}

async function getAllRecords(){
  const { sheet } = await loadWorkbook();
  const records = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values; // 1-indexed array
    const record = {};
    COLUMNS.forEach((col, i) => { record[col.key] = values[i + 1] ?? ''; });
    if (record.queryId) records.push(record);
  });
  return records;
}

async function getRecordById(queryId){
  const records = await getAllRecords();
  return records.find(r => String(r.queryId) === String(queryId)) || null;
}

async function updateRecordStatus(queryId, status){
  return enqueue(async () => {
    const { workbook, sheet } = await loadWorkbook();
    let updated = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell('queryId').value) === String(queryId)){
        row.getCell('status').value = status;
        updated = status;
      }
    });
    if (updated) await workbook.xlsx.writeFile(EXCEL_PATH);
    return updated;
  });
}

async function deleteRecord(queryId){
  return enqueue(async () => {
    const { workbook, sheet } = await loadWorkbook();
    let rowToDelete = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell('queryId').value) === String(queryId)){
        rowToDelete = rowNumber;
      }
    });
    if (rowToDelete){
      sheet.spliceRows(rowToDelete, 1);
      await workbook.xlsx.writeFile(EXCEL_PATH);
      return true;
    }
    return false;
  });
}

/** Builds a fresh formatted export workbook buffer for a filtered set of records. */
async function buildExportBuffer(records){
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ContactQueries Export', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } };
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  records.forEach(r => sheet.addRow(r));
  sheet.columns.forEach(col => { col.width = Math.max(col.width || 12, 12); });
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  EXCEL_PATH,
  appendRecord,
  getAllRecords,
  getRecordById,
  updateRecordStatus,
  deleteRecord,
  buildExportBuffer
};
