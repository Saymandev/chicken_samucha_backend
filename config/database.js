const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    // Mongoose v8 compatible options
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Minimum connections in pool
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      heartbeatFrequencyMS: 10000, // Send heartbeat every 10s
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔗 Connection state: ${conn.connection.readyState === 1 ? 'Connected' : 'Connecting'}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
      // Don't exit process, just log the error
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Will attempt to reconnect automatically...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔄 MongoDB connecting...');
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('📝 Closing MongoDB connection...');
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed gracefully.');
      } catch (closeError) {
        console.error('❌ Error closing MongoDB connection:', closeError.message);
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('📝 SIGTERM received, closing MongoDB connection...');
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed on SIGTERM.');
      } catch (closeError) {
        console.error('❌ Error closing MongoDB connection on SIGTERM:', closeError.message);
      }
    });
    
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    
    // Log more details about the error
    if (error.name === 'MongooseServerSelectionError') {
      console.error('🔍 This is likely because:');
      console.error('   - MongoDB is not running');
      console.error('   - Wrong connection string');
      console.error('   - Network connectivity issues');
      console.error('   - Firewall blocking the connection');
    }
    
    console.log('⚠️  Server will continue running without database connection');
    console.log('🔄 Will attempt to reconnect in 5 seconds...');
    
    // Retry connection after 5 seconds instead of crashing
    setTimeout(() => {
      console.log('🔄 Retrying database connection...');
      connectDB();
    }, 5000);
  }
};

module.exports = connectDB; 