const axios = require('axios');
const config = require('./config/config');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:3000';

console.log('🧪 SSLCommerz Integration Test');
console.log('==============================\n');

// Test 1: Check if SSLCommerz service is properly configured
console.log('1️⃣ Testing SSLCommerz Configuration...');
console.log(`Store ID: ${config.SSLCOMMERZ_STORE_ID}`);
console.log(`Store Password: ${config.SSLCOMMERZ_STORE_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`Sandbox Mode: ${config.SSLCOMMERZ_IS_SANDBOX ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`Success URL: ${config.SSLCOMMERZ_SUCCESS_URL}`);
console.log(`Fail URL: ${config.SSLCOMMERZ_FAIL_URL}`);
console.log(`Cancel URL: ${config.SSLCOMMERZ_CANCEL_URL}`);
console.log(`IPN URL: ${config.SSLCOMMERZ_IPN_URL}\n`);

// Test 2: Test payment methods endpoint
async function testPaymentMethods() {
  try {
    console.log('2️⃣ Testing Payment Methods Endpoint...');
    const response = await axios.get(`${BASE_URL}/payments/methods`);
    
    if (response.data.success) {
      console.log('✅ Payment methods endpoint working');
      console.log('Available payment methods:');
      Object.keys(response.data.data).forEach(method => {
        const methodData = response.data.data[method];
        console.log(`  - ${methodData.name}: ${methodData.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      });
    } else {
      console.log('❌ Payment methods endpoint failed');
    }
  } catch (error) {
    console.log('❌ Payment methods endpoint error:', error.message);
  }
  console.log('');
}

// Test 3: Test SSLCommerz payment initiation
async function testSSLCommerzInitiation() {
  try {
    console.log('3️⃣ Testing SSLCommerz Payment Initiation...');
    
    const testOrderData = {
      orderNumber: `TEST_${Date.now()}`,
      totalAmount: 100.00,
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '01712345678',
        address: {
          street: 'Test Street',
          area: 'Test Area',
          city: 'Rangpur',
          district: 'Rangpur'
        }
      },
      items: [
        {
          name: 'Test Samosa',
          price: 50.00,
          quantity: 2
        }
      ]
    };

    const response = await axios.post(`${BASE_URL}/payments/sslcommerz/initiate`, testOrderData);
    
    if (response.data.success) {
      console.log('✅ SSLCommerz payment initiation successful');
      console.log(`Gateway URL: ${response.data.data.gatewayPageURL}`);
      console.log(`Session ID: ${response.data.data.sessionId}`);
      console.log(`\n🔗 Test Payment URL: ${response.data.data.gatewayPageURL}`);
      console.log('📝 Note: Use this URL to test the payment flow in your browser');
    } else {
      console.log('❌ SSLCommerz payment initiation failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ SSLCommerz payment initiation error:', error.response?.data?.message || error.message);
  }
  console.log('');
}

// Test 4: Test order creation with SSLCommerz
async function testOrderCreation() {
  try {
    console.log('4️⃣ Testing Order Creation with SSLCommerz...');
    
    const testOrderData = {
      customer: {
        name: 'Test Customer',
        phone: '01712345678',
        email: 'test@example.com',
        address: {
          street: 'Test Street',
          area: 'Test Area',
          city: 'Rangpur',
          district: 'Rangpur'
        }
      },
      items: [
        {
          product: '507f1f77bcf86cd799439011', // Replace with actual product ID
          quantity: 2
        }
      ],
      paymentInfo: {
        method: 'sslcommerz'
      },
      deliveryInfo: {
        method: 'delivery',
        address: 'Test Street, Test Area, Rangpur',
        phone: '01712345678',
        deliveryCharge: 60
      },
      totalAmount: 100,
      finalAmount: 160
    };

    const response = await axios.post(`${BASE_URL}/orders`, testOrderData);
    
    if (response.data.success) {
      console.log('✅ Order creation successful');
      console.log(`Order Number: ${response.data.order.orderNumber}`);
      console.log(`Order ID: ${response.data.order._id}`);
    } else {
      console.log('❌ Order creation failed:', response.data.message);
    }
  } catch (error) {
    console.log('❌ Order creation error:', error.response?.data?.message || error.message);
  }
  console.log('');
}

// Test 5: Check if backend server is running
async function testServerConnection() {
  try {
    console.log('0️⃣ Testing Backend Server Connection...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Backend server is running');
  } catch (error) {
    console.log('❌ Backend server is not running or not accessible');
    console.log('Please start the backend server with: npm start');
    process.exit(1);
  }
  console.log('');
}

// Run all tests
async function runTests() {
  await testServerConnection();
  await testPaymentMethods();
  await testSSLCommerzInitiation();
  await testOrderCreation();
  
  console.log('🎯 Testing Complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Make sure you have valid SSLCommerz credentials in your .env file');
  console.log('2. Update the IPN_URL to point to your actual backend domain');
  console.log('3. Test the complete payment flow using the generated payment URL');
  console.log('4. Check the payment success/fail/cancel pages are working');
  console.log('\n🔧 Environment Variables Required:');
  console.log('SSLCOMMERZ_STORE_ID=your_actual_store_id');
  console.log('SSLCOMMERZ_STORE_PASSWORD=your_actual_store_password');
  console.log('SSLCOMMERZ_IS_SANDBOX=true');
  console.log('SSLCOMMERZ_IPN_URL=https://your-backend-domain.com/api/payments/sslcommerz/ipn');
}

runTests().catch(console.error);
