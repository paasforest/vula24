class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 8MB per image)' });
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Email or phone already registered',
    });
  }
  const msg = err.message || '';
  if (
    msg.includes('secretOrPrivateKey') ||
    msg.includes('JWT_SECRET') ||
    (msg.includes('secret') && msg.includes('must have'))
  ) {
    return res.status(503).json({
      error:
        'Server misconfiguration: set JWT_SECRET in environment (Railway Variables).',
    });
  }

  const status = err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Something went wrong';

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && status === 500 && { stack: err.stack }),
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, notFoundHandler, errorHandler, asyncHandler };
