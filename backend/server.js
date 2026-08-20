require('dotenv').config();
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server: SocketServer } = require('socket.io');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { configureRealtime } = require('./services/realtime');

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
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Versioned routes are canonical; the legacy mount remains for existing clients.
for (const prefix of ['/api/v1', '/api']) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/complaints`, complaintRoutes);
  app.use(`${prefix}/notices`, noticeRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
}

app.use(notFound);
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: true, credentials: true } });
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required.'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return next(new Error('Invalid or expired token.'));
  }
});
io.on('connection', (socket) => {
  socket.join(socket.user.role === 'admin' ? 'admin_room' : `resident_${socket.user.id}`);
});
configureRealtime(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Society Hub API listening on http://localhost:${PORT}`);
});

module.exports = app;
