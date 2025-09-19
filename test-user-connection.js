// Test script to check user Socket.IO connections
// Run this while your server is running

const io = require('socket.io-client');

async function testUserConnection() {
  console.log('🔌 Testing User Socket.IO Connection...\n');
  
  const API_BASE_URL = process.env.API_URL || 'https://chicken-samucha-backend.onrender.com/api';
  const socketURL = API_BASE_URL.replace('/api', '');
  
  console.log(`Connecting to: ${socketURL}`);
  
  const socket = io(socketURL, {
    transports: ['websocket', 'polling']
  });
  
  return new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      
      // Test with a sample user ID
      const testUserId = 'test-user-123';
      console.log(`🔌 Joining room for user: ${testUserId}`);
      socket.emit('join-user-room', testUserId);
      
      // Listen for notifications
      socket.on('new-user-notification', (notification) => {
        console.log('🔔 Received user notification:', notification);
      });
      
      socket.on('order-status-updated', (data) => {
        console.log('📦 Order status update:', data);
      });
      
      console.log('\n📝 Test setup complete!');
      console.log('Now update an order status in your admin panel to see if notifications work.');
      console.log('Press Ctrl+C to exit.\n');
      
      // Keep connection alive
      setTimeout(() => {
        console.log('⏰ Test completed after 30 seconds');
        socket.disconnect();
        resolve();
      }, 30000);
    });
    
    socket.on('connect_error', (error) => {
      console.log('❌ Connection failed:', error.message);
      resolve();
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });
  });
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting User Connection Test...\n');
  testUserConnection().catch(console.error);
}

module.exports = { testUserConnection };
