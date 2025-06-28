const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create default admin user if not exists
    await createDefaultAdmin();
    
    // Create default content if not exists
    await createDefaultContent();
    
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

const createDefaultAdmin = async () => {
  try {
    const User = require('../models/User');
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (!existingAdmin) {
      const adminUser = await User.create({
        name: 'Admin',
        email: config.ADMIN_EMAIL,
        phone: '+8801700000000',
        password: config.ADMIN_PASSWORD,
        role: 'admin',
        isActive: true
      });
      
      console.log('Default admin user created:');
      console.log(`Email: ${config.ADMIN_EMAIL}`);
      console.log(`Password: ${config.ADMIN_PASSWORD}`);
    }
  } catch (error) {
    console.log('Error creating default admin:', error.message);
  }
};

const createDefaultContent = async () => {
  try {
    const HeroContent = require('../models/HeroContent');
    const Product = require('../models/Product');
    const SliderItem = require('../models/SliderItem');
    
    // Create default hero content
    const existingHero = await HeroContent.findOne();
    if (!existingHero) {
      await HeroContent.create({
        title: {
          en: 'Delicious Chicken Samosa',
          bn: 'সুস্বাদু চিকেন সমুচা'
        },
        subtitle: {
          en: 'Fresh, crispy, and made with love',
          bn: 'তাজা, খাস্তা এবং ভালোবাসায় তৈরি'
        },
        description: {
          en: 'Order now and experience the authentic taste of Bangladesh',
          bn: 'এখনই অর্ডার করুন এবং বাংলাদেশের খাঁটি স্বাদ উপভোগ করুন'
        }
      });
      console.log('Default hero content created');
    }
    
    // Create default slider items
    const existingSlider = await SliderItem.findOne();
    if (!existingSlider) {
      const sliderItems = [
        {
          title: {
            en: 'Authentic Chicken Samosa',
            bn: 'খাঁটি চিকেন সমুচা'
          },
          description: {
            en: 'Crispy, golden samosas filled with spiced chicken. Made fresh daily with traditional recipes.',
            bn: 'মুচমুচে, সোনালি সমুচা মশলাদার চিকেন দিয়ে ভর্তি। ঐতিহ্যবাহী রেসিপি দিয়ে প্রতিদিন তাজা তৈরি।'
          },
          image: {
            public_id: 'slider_chicken_samosa',
            url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&h=500&fit=crop'
          },
          linkUrl: '/products',
          buttonText: {
            en: 'Order Now',
            bn: 'এখনই অর্ডার করুন'
          },
          isActive: true,
          order: 1
        },
        {
          title: {
            en: 'Fresh Daily Made',
            bn: 'প্রতিদিন তাজা তৈরি'
          },
          description: {
            en: 'Experience the difference of freshly made samosas. No preservatives, just pure taste.',
            bn: 'তাজা তৈরি সমুচার পার্থক্য অনুভব করুন। কোন প্রিজারভেটিভ নেই, শুধু খাঁটি স্বাদ।'
          },
          image: {
            public_id: 'slider_fresh_cooking',
            url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=500&fit=crop'
          },
          linkUrl: '/products',
          buttonText: {
            en: 'Explore Menu',
            bn: 'মেনু দেখুন'
          },
          isActive: true,
          order: 2
        },
        {
          title: {
            en: 'Fast Delivery Service',
            bn: 'দ্রুত ডেলিভারি সেবা'
          },
          description: {
            en: 'Quick delivery to your doorstep. Hot, fresh samosas delivered within 30-45 minutes.',
            bn: 'আপনার দোরগোড়ায় দ্রুত ডেলিভারি। গরম, তাজা সমুচা ৩০-৪৫ মিনিটের মধ্যে পৌঁছে দেওয়া হয়।'
          },
          image: {
            public_id: 'slider_delivery',
            url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=500&fit=crop'
          },
          linkUrl: '/contact',
          buttonText: {
            en: 'Contact Us',
            bn: 'যোগাযোগ করুন'
          },
          isActive: true,
          order: 3
        }
      ];

      for (const sliderData of sliderItems) {
        await SliderItem.create(sliderData);
      }
      console.log('Default slider items created');
    }
    
    // Create default product
    const existingProduct = await Product.findOne();
    if (!existingProduct) {
      await Product.create({
        name: {
          en: 'Chicken Samosa',
          bn: 'চিকেন সমুচা'
        },
        description: {
          en: 'Crispy, golden-brown samosa filled with spiced chicken and vegetables. Made fresh daily with authentic Bangladeshi spices.',
          bn: 'মুচমুচে, সোনালি বাদামি সমুচা মশলাদার চিকেন এবং সবজি দিয়ে ভর্তি। খাঁটি বাংলাদেশি মশলা দিয়ে প্রতিদিন তাজা তৈরি।'
        },
        shortDescription: {
          en: 'Crispy chicken-filled samosa with authentic spices',
          bn: 'খাঁটি মশলা দিয়ে চিকেন ভর্তি মুচমুচে সমুচা'
        },
        price: 25,
        images: [{
          public_id: 'sample_chicken_samosa',
          url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop'
        }],
        ingredients: {
          en: ['Chicken', 'Onion', 'Spices', 'Flour', 'Oil'],
          bn: ['চিকেন', 'পেঁয়াজ', 'মশলা', 'ময়দা', 'তেল']
        },
        isAvailable: true,
        isVisible: true,
        isFeatured: true
      });
      console.log('Default product created');
    }
    
  } catch (error) {
    console.log('Error creating default content:', error.message);
  }
};

module.exports = connectDB; 