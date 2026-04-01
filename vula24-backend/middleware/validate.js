const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors
      .array()
      .map((e) => e.msg)
      .join('; ');
    return next(new AppError(msg, 400));
  }
  next();
}

module.exports = { handleValidationErrors };
