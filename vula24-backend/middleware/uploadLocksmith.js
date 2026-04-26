const multer = require('multer');

/** memoryStorage fills `req.file.buffer`. diskStorage would leave buffer empty. */
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

const profilePhotoUpload = upload.single('profilePhoto');

/** Multipart: field `document` (image) + `documentType` in body */
const locksmithDocumentUpload = upload.single('document');

const customerPhotoUpload = upload.single('photo');

/** Same as locksmith profile; field name `profilePhoto` in multipart. */
const memberPhotoUpload = upload.single('profilePhoto');

module.exports = {
  locksmithRegisterMultipart,
  profilePhotoUpload,
  locksmithDocumentUpload,
  customerPhotoUpload,
  memberPhotoUpload,
};
