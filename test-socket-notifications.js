// Test Socket.IO notifications by connecting to the running server
// Run this while your server is running: node test-socket-notifications.js

const io = require('socket.io-client');

async function testSocketIONotifications() {
  console.log('🔌 Testing Socket.IO Notifications...\n');
  
  // Connect to your server (adjust URL as needed)
  const API_BASE_URL = process.env.API_URL || 'https://chicken-samucha-backend.onrender.com/api';
  const socketURL = API_BASE_URL.replace('/api', '');
  
  console.log(`Connecting to: ${socketURL}`);
  
  const socket = io(socketURL, {
    transports: ['websocket', 'polling']
  });
  
  return new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      
      // Join a test user room
      const testUserId = 'test-user-123';
      socket.emit('join-user-room', testUserId);
      console.log(`✅ Joined user room: user-${testUserId}`);
      
      // Listen for notifications
      socket.on('new-user-notification', (notification) => {
        console.log('🔔 Received notification:', notification);
      });
      
      socket.on('order-status-updated', (data) => {
        console.log('📦 Order status update:', data);
      });
      
      console.log('\n📝 Test setup complete!');
      console.log('Now update an order status in your admin panel to see notifications.');
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
  console.log('🚀 Starting Socket.IO Notification Test...\n');
  testSocketIONotifications().catch(console.error);
}

module.exports = { testSocketIONotifications };
