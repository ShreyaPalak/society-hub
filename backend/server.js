require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Fails fast on boot rather than issuing tokens nobody can verify later.
if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Serve uploaded complaint photos.
app.use('/uploads', express.static(path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Society Hub API listening on http://localhost:${PORT}`);
});

module.exports = app;
