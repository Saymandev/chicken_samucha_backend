const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const config = require('../config/config');

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET
});

// Create storage for different types of uploads
const createStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `chicken-samosa/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
      ]
    }
  });
};

// Different storage configurations
const productImageStorage = createStorage('products');
const heroImageStorage = createStorage('hero');
const sliderImageStorage = createStorage('slider');
const reviewImageStorage = createStorage('reviews');
const paymentScreenshotStorage = createStorage('payments');
const chatAttachmentStorage = createStorage('chat', ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']);
const promotionImageStorage = createStorage('promotions');

// Multer configurations
const upload = {
  // General upload for multiple fields (like promotions)
  fields: (fields) => multer({
    storage: promotionImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  }).fields(fields),
  productImages: multer({
    storage: productImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  }),

  heroImage: multer({
    storage: heroImageStorage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit for hero images
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image and video files are allowed'), false);
      }
    }
  }),

  sliderImage: multer({
    storage: sliderImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  }),

  reviewImages: multer({
    storage: reviewImageStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit for review images
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  }),

  paymentScreenshot: multer({
    storage: paymentScreenshotStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  }),

  chatAttachment: multer({
    storage: chatAttachmentStorage,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
        cb(null, true);
      } else {
        cb(new Error('File type not allowed'), false);
      }
    }
  })
};

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files'
      });
    }
  }
  
  if (err.message) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next(err);
};

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  upload,
  handleUploadError,
  deleteImage,
  cloudinary
}; 