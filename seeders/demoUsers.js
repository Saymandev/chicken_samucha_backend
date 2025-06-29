const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const connection = await mongoose.connect(config.MONGODB_URI);
    
  } catch (error) {
   
    process.exit(1);
  }
};

// Demo users data
const demoUsers = [
  {
    name: 'Admin User',
    email: 'admin@chickensamosa.com',
    phone: '01712345678',
    password: 'admin123',
    role: 'admin',
    address: {
      street: 'Admin Office',
      area: 'Gulshan',
      city: 'Dhaka',
      district: 'Dhaka'
    },
    isActive: true,
    preferredLanguage: 'en',
    preferredTheme: 'light'
  },
  {
    name: 'Demo User',
    email: 'user@example.com',
    phone: '01712345679',
    password: 'user123',
    role: 'user',
    address: {
      street: '123 Demo Street',
      area: 'Dhanmondi',
      city: 'Dhaka',
      district: 'Dhaka'
    },
    isActive: true,
    preferredLanguage: 'en',
    preferredTheme: 'light'
  },
  {
    name: 'রহিম আহমেদ',
    email: 'rahim@example.com',
    phone: '01712345680',
    password: 'rahim123',
    role: 'user',
    address: {
      street: '৪৫ নিউ ডিওএইচএস',
      area: 'মোহাম্মদপুর',
      city: 'ঢাকা',
      district: 'ঢাকা'
    },
    isActive: true,
    preferredLanguage: 'bn',
    preferredTheme: 'light'
  }
];

// Seed demo users
const seedDemoUsers = async () => {
  try {
    

    // Check if demo users already exist
    const existingAdmin = await User.findOne({ email: 'admin@chickensamosa.com' });
    const existingUser = await User.findOne({ email: 'user@example.com' });

    if (existingAdmin && existingUser) {
      
      return;
    }

    // Clear existing demo users if any
    await User.deleteMany({ 
      email: { 
        $in: ['admin@chickensamosa.com', 'user@example.com', 'rahim@example.com'] 
      } 
    });

    // Create demo users
    for (const userData of demoUsers) {
      const user = await User.create(userData);
     
    }


  } catch (error) {
    console.error('❌ Error seeding demo users:', error.message);
  }
};

// Run the seeder
const runSeeder = async () => {
  try {
    await connectDB();
    await seedDemoUsers();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder failed:', error);
    process.exit(1);
  }
};

// Export for use in other scripts
module.exports = { seedDemoUsers, demoUsers };

// Run if called directly
if (require.main === module) {
  runSeeder();
} 