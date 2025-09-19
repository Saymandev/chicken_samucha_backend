// Setup script to create .env file
// Run this with: node setup-env.js

const fs = require('fs');
const path = require('path');

const envContent = `# Database
MONGODB_URI=mongodb://localhost:27017/chicken-samosa-db

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=30d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email Configuration
# Option 1: Gmail App Password (Recommended - Easy Setup)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password

# Option 2: OAuth2 (Alternative - More Complex)
# GOOGLE_CLIENT_ID=your-client-id
# GOOGLE_CLIENT_SECRET=your-client-secret
# GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
# GOOGLE_REFRESH_TOKEN=your-refresh-token

# Frontend URL
FRONTEND_URL=https://chicken-samucha-frontend.vercel.app

# Admin
ADMIN_EMAIL=admin@samosa.com
ADMIN_PASSWORD=admin123456

# Server
NODE_ENV=development
PORT=5000
`;

function createEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists!');
    console.log('If you want to recreate it, please delete the existing .env file first.');
    return;
  }
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Edit the .env file with your actual values');
    console.log('2. Set up Gmail credentials (see EMAIL_SETUP.md)');
    console.log('3. Run: node verify-notifications.js');
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

// Run the setup
if (require.main === module) {
  console.log('🚀 Setting up .env file...\n');
  createEnvFile();
}

module.exports = { createEnvFile };
