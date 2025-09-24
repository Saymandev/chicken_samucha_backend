const NavigationMenu = require('../models/NavigationMenu');

const defaultMenuItems = [
  {
    title: {
      en: 'HOME',
      bn: 'হোম'
    },
    path: '/',
    icon: null,
    order: 1,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'HOT OFFERS!',
      bn: 'হট অফার!'
    },
    path: '/products?filter=offers',
    icon: null,
    badge: {
      text: 'Sale',
      color: 'red'
    },
    order: 2,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'BEST SELLERS',
      bn: 'সর্বাধিক বিক্রিত'
    },
    path: '/products?filter=best-seller',
    icon: null,
    order: 3,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'ALL PRODUCTS',
      bn: 'সব পণ্য'
    },
    path: '/products',
    icon: null,
    order: 4,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'COMBO',
      bn: 'কম্বো'
    },
    path: '/products?filter=combo',
    icon: null,
    badge: {
      text: 'Hot',
      color: 'orange'
    },
    order: 5,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'CLEARANCE',
      bn: 'ক্লিয়ারেন্স'
    },
    path: '/products?filter=clearance',
    icon: null,
    order: 6,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'ABOUT US',
      bn: 'আমাদের সম্পর্কে'
    },
    path: '/about',
    icon: null,
    order: 7,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  },
  {
    title: {
      en: 'CONTACT',
      bn: 'যোগাযোগ'
    },
    path: '/contact',
    icon: null,
    order: 8,
    isActive: true,
    isExternal: false,
    target: '_self',
    permissions: ['public']
  }
];

const seedNavigationMenu = async () => {
  try {
    console.log('🌱 Seeding navigation menu...');
    
    // Clear existing navigation menu items
    await NavigationMenu.deleteMany({});
    console.log('✅ Cleared existing navigation menu items');
    
    // Insert default menu items
    const menuItems = await NavigationMenu.insertMany(defaultMenuItems);
    console.log(`✅ Created ${menuItems.length} navigation menu items`);
    
    // Log the created items
    menuItems.forEach(item => {
      console.log(`  - ${item.title.en} (${item.path})`);
    });
    
    console.log('🎉 Navigation menu seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding navigation menu:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();
  
  const connectDB = require('../config/database');
  
  connectDB().then(async () => {
    try {
      await seedNavigationMenu();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  });
}

module.exports = { seedNavigationMenu, defaultMenuItems };

