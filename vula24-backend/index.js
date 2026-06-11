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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const prisma = require('./lib/prisma');
const { expireAcceptedJobs, expirePendingJobs } = require('./controllers/jobController');
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
const customerRoutes = require('./routes/customer');

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Store io instance for use in controllers
app.set('io', io);

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const { verifyUserToken } = require('./utils/jwt');
    const decoded = verifyUserToken(token);
    socket.userId = decoded.sub;
    socket.userType = decoded.type;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});

// Socket connection handler
io.on('connection', (socket) => {
  // Join job room for tracking
  socket.on('join:job', async (jobId) => {
    if (!jobId) return;
    try {
      const prisma = require('./lib/prisma');
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          customerId: true,
          locksithId: true,
          teamMemberId: true,
        },
      });
      if (!job) return;
      const allowed =
        job.customerId === socket.userId ||
        job.locksithId === socket.userId ||
        job.teamMemberId === socket.userId;
      if (!allowed) return;
      socket.join(`job:${jobId}`);
    } catch {
      // ignore
    }
  });

  // Locksmith emits location
  socket.on('location:update', (data) => {
    const { jobId, lat, lng } = data;
    if (
      !jobId ||
      lat === null ||
      lat === undefined ||
      lng === null ||
      lng === undefined ||
      isNaN(lat) ||
      isNaN(lng)
    ) {
      return;
    }
    socket.to(`job:${jobId}`).emit('location:update', { lat, lng, jobId });
  });

  socket.on('leave:job', (jobId) => {
    socket.leave(`job:${jobId}`);
  });

  socket.on('disconnect', () => {
    // cleanup handled by socket.io
  });
});

// Trust Railway's proxy
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());

// CORS - restrict to known origins
app.use(
  cors({
    origin: [
      'https://vula24.co.za',
      'https://www.vula24.co.za',
      'https://admin.vula24.co.za',
      'http://localhost:3000',
      'http://localhost:8081',
    ],
    credentials: true,
  })
);

// Global rate limit - 500 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
});
app.use('/api/auth', authLimiter);

// Strict limit for admin auth
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many admin login attempts',
  },
});
app.use('/api/admin/auth', adminAuthLimiter);

// OTP rate limit
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    error: 'Too many OTP requests, please wait before trying again',
  },
});
app.use('/api/auth/send-otp', otpLimiter);
app.use('/api/auth/verify-otp', otpLimiter);

// Relaxed limit for payment gateway webhook callbacks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: 'Too many webhook requests' },
});

// Apply webhook limiter BEFORE the strict payment limiter
app.use('/api/payments/payfast/notify', webhookLimiter);
app.use('/api/payments/webhook', webhookLimiter);
app.use('/api/payments/paystack/webhook', webhookLimiter);

// Strict limit for everything else (/api/wallet uses global limiter only)
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many payment requests' },
  skip: (req) => {
    const pathOnly = String(
      req.originalUrl || ''
    ).split('?')[0];
    return (
      pathOnly === '/api/payments/webhook' ||
      pathOnly === '/api/payments/payfast/notify' ||
      pathOnly === '/api/payments/paystack/webhook'
    );
  },
});

app.use('/api/payments', paymentLimiter);

app.use(morgan('combined'));

// Capture the raw request body on the webhook route so we can log the exact
// bytes PayFast sent before any URL-decoding or field filtering takes place.
// express.urlencoded's `verify` callback fires before the parsed body is set,
// giving us the original Buffer as `buf`.
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Vula24 API',
    version:
      process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    deployedAt: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
  });
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
app.use('/api/customer', customerRoutes);
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
  expirePendingJobs().catch((err) =>
    console.error('expirePendingJobs', err)
  );
  expireAcceptedJobs().catch((err) =>
    console.error('expireAcceptedJobs', err)
  );
  releasePendingPayouts().catch((err) =>
    console.error('releasePendingPayouts', err)
  );
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Vula24 API listening on 0.0.0.0:${PORT}`);
});
