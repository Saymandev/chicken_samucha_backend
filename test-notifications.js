// Test script to verify email and Socket.IO notifications
// Run this with: node test-notifications.js

const emailService = require('./services/emailService');

async function testEmailNotifications() {
  console.log('🧪 Testing Email Notifications...\n');
  
  // Test order confirmation email
  console.log('1. Testing Order Confirmation Email...');
  try {
    const result = await emailService.sendOrderConfirmation('test@example.com', {
      orderNumber: 'ORD123456',
      customerName: 'Test User',
      orderDate: new Date(),
      totalAmount: 500,
      status: 'confirmed',
      items: [
        {
          product: { name: 'Test Product' },
          quantity: 2,
          price: 250
        }
      ],
      deliveryInfo: { method: 'delivery', address: 'Test Address' },
      paymentInfo: { method: 'bkash' }
    });
    console.log('✅ Order confirmation email test:', result.messageId ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.log('❌ Order confirmation email test FAILED:', error.message);
  }
  
  // Test order status update email
  console.log('\n2. Testing Order Status Update Email...');
  try {
    const result = await emailService.sendOrderStatusUpdateEmail('test@example.com', 'Test User', {
      orderNumber: 'ORD123456',
      status: 'delivered',
      estimatedDeliveryTime: new Date(),
      items: [
        {
          product: { name: 'Test Product' },
          quantity: 2,
          price: 250
        }
      ],
      totalAmount: 500
    });
    console.log('✅ Order status update email test:', result.messageId ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.log('❌ Order status update email test FAILED:', error.message);
  }
  
  console.log('\n📧 Email notification tests completed!');
}

// Test Socket.IO connection (basic check)
function testSocketIO() {
  console.log('\n🔌 Testing Socket.IO Setup...');
  
  // Check if global.io is available
  if (global.io) {
    console.log('✅ global.io is available');
    
    // Check if we can emit a test event
    try {
      global.io.emit('test-notification', { message: 'Test notification' });
      console.log('✅ Socket.IO emit test: SUCCESS');
    } catch (error) {
      console.log('❌ Socket.IO emit test FAILED:', error.message);
    }
  } else {
    console.log('❌ global.io is not available - Socket.IO not initialized');
  }
  
  console.log('🔌 Socket.IO tests completed!');
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Notification Tests...\n');
  
  await testEmailNotifications();
  testSocketIO();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Update an order status in your admin panel');
  console.log('2. Check server logs for email and Socket.IO debug messages');
  console.log('3. Verify user receives both email and real-time notification');
}

// Only run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEmailNotifications, testSocketIO };
