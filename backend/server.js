const express = require('express');
const cors = require('cors');
const path = require('path');

const contactRoutes = require('./routes/contact');
const { EXCEL_PATH } = require('./utils/excelStore');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', excelFile: EXCEL_PATH });
});

app.use('/api/contact', contactRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Generic error handler — never leak stack traces / server paths to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Public Voice backend running on http://localhost:${PORT}`);
  console.log(`Excel data file: ${path.join(__dirname, 'data', 'ContactQueries.xlsx')}`);
});
