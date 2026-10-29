import multer from 'multer';

const storage = multer.memoryStorage();

// Standard upload for products/shops (5 MB limit, images only)
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Dedicated upload middleware for Poster Media (Static images, Animated GIFs, and MP4/WebM videos)
export const posterMediaUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
    ];

    if (allowedTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported file format. Only JPG, JPEG, PNG, WEBP, GIF images and MP4, WebM videos are allowed.'
        ),
        false
      );
    }
  },
});

export default upload;