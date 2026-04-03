const multer = require('multer');

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ok =
    /^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(file.mimetype) ||
    file.mimetype === 'application/octet-stream';
  if (ok) cb(null, true);
  else cb(new Error('Only image files are allowed'));
}

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter,
});

const locksmithRegisterFiles = upload.fields([
  { name: 'idPhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 },
  { name: 'proofOfAddress', maxCount: 1 },
]);

/** Only parse multipart when client sends multipart (keeps JSON registration working). */
function locksmithRegisterMultipart(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return locksmithRegisterFiles(req, res, next);
  }
  next();
}

module.exports = { locksmithRegisterMultipart };
