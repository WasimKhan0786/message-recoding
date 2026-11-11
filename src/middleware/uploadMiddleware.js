const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure temporary upload directory exists
const tempUploadDir = path.join(__dirname, '..', '..', 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Multer disk storage for incoming raw audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and create unique timestamped name
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    cb(null, `upload_${Date.now()}_${baseName}${ext}`);
  }
});

// File filter: accept MP3, WAV, and M4A files
const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.mp4'];
const allowedMimeTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'video/mp4' // Some browsers tag m4a audio as video/mp4
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtValid = allowedExtensions.includes(ext);
  const isMimeValid = allowedMimeTypes.includes(file.mimetype.toLowerCase());

  if (isExtValid || isMimeValid) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format (${ext || file.mimetype}). Please upload an MP3, WAV, or M4A file.`));
  }
};

// 500 MB limit to easily accommodate 12, 15, and 30-minute uncompressed WAV/M4A recordings
const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB
  },
  fileFilter
});

// Image file filter for welcome/profile image uploads
const allowedImageExtensions = [
  '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp',
  '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.heic', '.ico'
];
const allowedImageMimes = [
  'image/jpeg', 'image/pjpeg', 'image/jfif',
  'image/png', 'image/x-png',
  'image/webp', 'image/gif',
  'image/svg+xml', 'image/bmp', 'image/x-ms-bmp',
  'image/avif', 'image/heic', 'image/heif'
];

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtValid = allowedImageExtensions.includes(ext);
  const isMimeValid = file.mimetype && (
    file.mimetype.toLowerCase().startsWith('image/') ||
    allowedImageMimes.includes(file.mimetype.toLowerCase())
  );

  if (isExtValid || isMimeValid) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image format (${ext || file.mimetype || 'unknown'}). Please upload a valid JPG, PNG, WEBP, or GIF image.`));
  }
};

const uploadImage = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB limit for profile/welcome image
  },
  fileFilter: imageFilter
});

module.exports = {
  uploadAudio,
  uploadImage,
  tempUploadDir
};

