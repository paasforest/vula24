require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !String(dbUrl).trim()) {
  console.error('FATAL: DATABASE_URL is required');
  process.exit(1);
}

if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
  console.error(
    'WARN: JWT_SECRET is not set — /api/auth/* will fail until you add it in Railway Variables.'
  );
}

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const prisma = require('./lib/prisma');
const { expireAcceptedJobs } = require('./controllers/jobController');
const { releasePendingPayouts } = require('./controllers/paymentController');

const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const jobMemberRoutes = jobRoutes.memberRouter;
const paymentRoutes = require('./routes/payments');
const locksmithRoutes = require('./routes/locksmith');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Vula24 API' });
});

/** Confirms Prisma can reach Postgres (Railway: DATABASE_URL usually needs ?sslmode=require). */
app.get('/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('health/db', err);
    res.status(503).json({
      status: 'error',
      database: 'unreachable',
      hint:
        'Set DATABASE_URL with ?sslmode=require for Railway Postgres (see .env.example).',
    });
  }
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/member', jobMemberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/locksmith', locksmithRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

setInterval(() => {
  expireAcceptedJobs().catch((err) =>
    console.error('expireAcceptedJobs', err)
  );
  releasePendingPayouts().catch((err) =>
    console.error('releasePendingPayouts', err)
  );
}, 60000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vula24 API listening on 0.0.0.0:${PORT}`);
});
