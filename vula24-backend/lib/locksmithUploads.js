const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'locksmith');

function isCloudinaryConfigured() {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url) return true;
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function configureCloudinary() {
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url?.startsWith('cloudinary://')) {
    const u = new URL(url.replace('cloudinary://', 'https://'));
    cloudinary.config({
      cloud_name: u.hostname,
      api_key: decodeURIComponent(u.username),
      api_secret: decodeURIComponent(u.password),
      secure: true,
    });
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function publicLocalUrl(req, filename) {
  let base;
  if (process.env.APP_URL) {
    base = process.env.APP_URL.replace(/\/$/, '');
  } else {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    base = `${proto}://${host}`;
  }
  return `${base}/uploads/locksmith/${filename}`;
}

/**
 * @param {Express.Request} req
 * @param {import('multer').File} file - memoryStorage file with buffer
 * @returns {Promise<string>} HTTPS URL
 */
async function uploadLocksmithImage(req, file) {
  if (!file?.buffer?.length) {
    throw new Error('Invalid upload file');
  }

  if (isCloudinaryConfigured()) {
    configureCloudinary();
    const folder = process.env.CLOUDINARY_LOCKSMITH_FOLDER || 'vula24/locksmith';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', use_filename: false },
        (err, result) => {
          if (err) return reject(err);
          resolve(result.secure_url);
        }
      );
      stream.end(file.buffer);
    });
  }

  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, filename), file.buffer);
  return publicLocalUrl(req, filename);
}

module.exports = {
  isCloudinaryConfigured,
  uploadLocksmithImage,
};
