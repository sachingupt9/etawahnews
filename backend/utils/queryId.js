const { getAllRecords } = require('./excelStore');

async function generateQueryId(){
  const year = new Date().getFullYear();
  const prefix = `PV-${year}-`;
  const records = await getAllRecords();
  const seqNumbers = records
    .map(r => String(r.queryId))
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.slice(prefix.length), 10))
    .filter(n => !Number.isNaN(n));
  const next = (seqNumbers.length ? Math.max(...seqNumbers) : 0) + 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}

module.exports = { generateQueryId };
