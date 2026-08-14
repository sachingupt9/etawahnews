const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  appendRecord, getAllRecords, getRecordById, updateRecordStatus, deleteRecord, buildExportBuffer
} = require('../utils/excelStore');
const { generateQueryId } = require('../utils/queryId');

const router = express.Router();

/* ---------------- Upload config ---------------- */
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Never trust the original filename outright — sanitise + timestamp it.
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)){
      return cb(new Error('Unsupported file type. Use PDF, JPG, PNG, DOC, or DOCX.'));
    }
    cb(null, true);
  }
});

/* ---------------- Validation ---------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;
const QUERY_TYPES = new Set([
  'General Query', 'News Tip', 'Feedback', 'Complaint',
  'Advertisement', 'Partnership', 'Technical Support', 'Other'
]);

function sanitizeText(value){
  // Strip control chars and basic HTML tag delimiters to reduce XSS/CSV-injection surface.
  return String(value || '').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function validatePayload(body){
  const errors = {};
  const fullName = sanitizeText(body.fullName);
  const email = sanitizeText(body.email);
  const mobile = sanitizeText(body.mobile);
  const subject = sanitizeText(body.subject);
  const queryType = sanitizeText(body.queryType);
  const message = sanitizeText(body.message);

  if (!fullName || fullName.length > 100) errors.fullName = 'Full name is required (max 100 characters).';
  if (!email || !EMAIL_RE.test(email)) errors.email = 'A valid email address is required.';
  if (!mobile || !MOBILE_RE.test(mobile)) errors.mobile = 'A valid 10-digit Indian mobile number is required.';
  if (!subject || subject.length > 150) errors.subject = 'Subject is required (max 150 characters).';
  if (!queryType || !QUERY_TYPES.has(queryType)) errors.queryType = 'A valid query type is required.';
  if (!message || message.length > 1000) errors.message = 'Message is required (max 1000 characters).';

  return { errors, clean: { fullName, email, mobile, subject, queryType, message } };
}

/* ---------------- POST /api/contact/submit ---------------- */
router.post('/submit', (req, res) => {
  upload.single('attachment')(req, res, async (err) => {
    if (err){
      return res.status(400).json({ success: false, message: err.message });
    }
    try{
      const { errors, clean } = validatePayload(req.body);
      if (Object.keys(errors).length){
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, message: 'Validation failed.', errors });
      }

      const queryId = await generateQueryId();
      const now = new Date();

      const record = {
        queryId,
        fullName: clean.fullName,
        email: clean.email,
        mobile: clean.mobile,
        subject: clean.subject,
        queryType: clean.queryType,
        message: clean.message,
        attachment: req.file ? req.file.filename : '',
        submissionDate: now.toISOString().slice(0, 10),
        submissionTime: now.toTimeString().slice(0, 8),
        status: 'New'
      };

      await appendRecord(record);

      return res.status(201).json({
        success: true,
        queryId,
        message: 'Your query has been successfully registered.'
      });
    }catch(e){
      console.error('Submit error:', e);
      return res.status(500).json({ success: false, message: 'Server error while saving your query. Please try again.' });
    }
  });
});

/* ---------------- GET /api/contact  (list — used by admin dashboard) ---------------- */
router.get('/', async (req, res) => {
  try{
    const records = await getAllRecords();
    res.json(records.reverse()); // newest first
  }catch(e){
    console.error(e);
    res.status(500).json({ success: false, message: 'Could not read query records.' });
  }
});

/* ---------------- GET /api/contact/export ---------------- */
router.get('/export', async (req, res) => {
  try{
    let records = await getAllRecords();
    const { status, queryType, dateFrom, dateTo } = req.query;
    if (status) records = records.filter(r => r.status === status);
    if (queryType) records = records.filter(r => r.queryType === queryType);
    if (dateFrom) records = records.filter(r => r.submissionDate >= dateFrom);
    if (dateTo) records = records.filter(r => r.submissionDate <= dateTo);

    const buffer = await buildExportBuffer(records);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ContactQueries_Export_${Date.now()}.xlsx"`);
    res.send(Buffer.from(buffer));
  }catch(e){
    console.error(e);
    res.status(500).json({ success: false, message: 'Could not generate export.' });
  }
});

/* ---------------- GET /api/contact/:queryId ---------------- */
router.get('/:queryId', async (req, res) => {
  try{
    const record = await getRecordById(req.params.queryId);
    if (!record) return res.status(404).json({ success: false, message: 'Query ID not found.' });
    res.json(record);
  }catch(e){
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/* ---------------- PATCH /api/contact/:queryId/status ---------------- */
router.patch('/:queryId/status', async (req, res) => {
  const allowed = new Set(['New', 'In Progress', 'Resolved', 'Closed']);
  const { status } = req.body;
  if (!allowed.has(status)){
    return res.status(400).json({ success: false, message: 'Invalid status value.' });
  }
  try{
    const updated = await updateRecordStatus(req.params.queryId, status);
    if (!updated) return res.status(404).json({ success: false, message: 'Query ID not found.' });
    res.json({ success: true, status: updated });
  }catch(e){
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

/* ---------------- DELETE /api/contact/:queryId ---------------- */
router.delete('/:queryId', async (req, res) => {
  try{
    const deleted = await deleteRecord(req.params.queryId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Query ID not found.' });
    res.json({ success: true });
  }catch(e){
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
