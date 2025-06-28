const dotenv = require('dotenv');
dotenv.config();
module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/chicken-samosa-db',
  JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  
  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloudinary_cloud_name',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || 'your_cloudinary_api_key',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'your_cloudinary_api_secret',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Admin credentials
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@samosa.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123456'
}; 