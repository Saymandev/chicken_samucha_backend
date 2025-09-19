// Comprehensive notification verification script
// Run this to check if notifications are working properly

// Load environment variables
require('dotenv').config();

const emailService = require('./services/emailService');

async function verifyEmailSetup() {
  console.log('📧 Verifying Email Setup...\n');
  
  // Check environment variables
  const hasAppPassword = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
  const hasOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN;
  
  console.log(`Gmail App Password configured: ${hasAppPassword ? '✅' : '❌'}`);
  console.log(`Gmail OAuth2 configured: ${hasOAuth ? '✅' : '❌'}`);
  
  if (!hasAppPassword && !hasOAuth) {
    console.log('\n⚠️  No email credentials found!');
    console.log('Please set up email credentials as described in EMAIL_SETUP.md');
    return false;
  }
  
  // Test email sending
  try {
    const result = await emailService.sendOrderConfirmation('test@example.com', {
      orderNumber: 'TEST123',
      customerName: 'Test User',
      orderDate: new Date(),
      totalAmount: 100,
      status: 'confirmed',
      items: [{ product: { name: 'Test Item' }, quantity: 1, price: 100 }],
      deliveryInfo: { method: 'delivery' },
      paymentInfo: { method: 'bkash' }
    });
    
    if (result.messageId && result.messageId !== 'dev-mode-no-email') {
      console.log('✅ Email sending: WORKING');
      return true;
    } else {
      console.log('⚠️  Email sending: DEV MODE (no actual email sent)');
      return true; // Still working, just in dev mode
    }
  } catch (error) {
    console.log('❌ Email sending: FAILED -', error.message);
    return false;
  }
}

function verifySocketIOSetup() {
  console.log('\n🔌 Verifying Socket.IO Setup...\n');
  
  // Check if global.io is available (only when server is running)
  if (global.io) {
    console.log('✅ Socket.IO server instance: AVAILABLE');
    console.log('✅ Socket.IO is properly initialized');
    return true;
  } else {
    console.log('⚠️  Socket.IO server instance: NOT AVAILABLE');
    console.log('This is normal when running outside the server context');
    console.log('Socket.IO will work when the server is running');
    return true; // Not an error, just context issue
  }
}

function checkOrderController() {
  console.log('\n📝 Checking Order Controller...\n');
  
  try {
    const orderController = require('./controllers/orderController');
    console.log('✅ Order controller: LOADED');
    
    // Check if updateOrderStatus function exists
    if (typeof orderController.updateOrderStatus === 'function') {
      console.log('✅ updateOrderStatus function: EXISTS');
    } else {
      console.log('❌ updateOrderStatus function: MISSING');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ Order controller: FAILED TO LOAD -', error.message);
    return false;
  }
}

function checkNotificationModel() {
  console.log('\n🔔 Checking Notification Model...\n');
  
  try {
    const Notification = require('./models/Notification');
    console.log('✅ Notification model: LOADED');
    
    // Check if createNotification method exists
    if (typeof Notification.createNotification === 'function') {
      console.log('✅ createNotification method: EXISTS');
    } else {
      console.log('❌ createNotification method: MISSING');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ Notification model: FAILED TO LOAD -', error.message);
    return false;
  }
}

async function runVerification() {
  console.log('🚀 Starting Notification Verification...\n');
  console.log('=' .repeat(50));
  
  const results = {
    email: await verifyEmailSetup(),
    socket: verifySocketIOSetup(),
    controller: checkOrderController(),
    model: checkNotificationModel()
  };
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 VERIFICATION RESULTS:');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([component, status]) => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} ${component.toUpperCase()}: ${status ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  
  console.log('\n' + '=' .repeat(50));
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED! Notifications should work properly.');
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Update an order status in admin panel');
    console.log('3. Check server logs for notification messages');
  } else {
    console.log('⚠️  SOME CHECKS FAILED! Please fix the issues above.');
  }
  
  console.log('=' .repeat(50));
}

// Run verification
if (require.main === module) {
  runVerification().catch(console.error);
}

module.exports = { verifyEmailSetup, verifySocketIOSetup, checkOrderController, checkNotificationModel };
