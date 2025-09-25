const dotenv = require('dotenv');
dotenv.config();
module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/pickplace-db',
  JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  
  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloudinary_cloud_name',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || 'your_cloudinary_api_key',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'your_cloudinary_api_secret',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: 'https://www.pickplace.com.bd',
  
  // Admin credentials
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@pickplace.com.bd',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123456',
  
  // Email Configuration
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  
  // SSLCommerz Configuration
  SSLCOMMERZ_STORE_ID: process.env.SSLCOMMERZ_STORE_ID || 'your_store_id',
  SSLCOMMERZ_STORE_PASSWORD: process.env.SSLCOMMERZ_STORE_PASSWORD || 'your_store_password',
  SSLCOMMERZ_IS_SANDBOX: process.env.SSLCOMMERZ_IS_SANDBOX === 'true' || true,
  SSLCOMMERZ_SUCCESS_URL: process.env.SSLCOMMERZ_SUCCESS_URL || 'https://chicken-samucha-frontend.vercel.app/success',
  SSLCOMMERZ_FAIL_URL: process.env.SSLCOMMERZ_FAIL_URL || 'https://chicken-samucha-frontend.vercel.app/fail',
  SSLCOMMERZ_CANCEL_URL: process.env.SSLCOMMERZ_CANCEL_URL || 'https://chicken-samucha-frontend.vercel.app/cancel',
  SSLCOMMERZ_IPN_URL: process.env.SSLCOMMERZ_IPN_URL || 'https://your-backend-domain.com/api/payments/sslcommerz/ipn'
}; 