const SSLCommerzPayment = require('sslcommerz-lts');
const config = require('./config/config');

// Test SSLCommerz integration
async function testSSLCommerz() {
  console.log('🧪 Testing SSLCommerz Integration...\n');

  try {
    // Initialize SSLCommerz
    const sslcommerz = new SSLCommerzPayment(
      config.SSLCOMMERZ_STORE_ID,
      config.SSLCOMMERZ_STORE_PASSWORD,
      config.SSLCOMMERZ_IS_SANDBOX
    );

    console.log('✅ SSLCommerz initialized successfully');
    console.log(`Store ID: ${config.SSLCOMMERZ_STORE_ID}`);
    console.log(`Sandbox Mode: ${config.SSLCOMMERZ_IS_SANDBOX}`);
    console.log(`Success URL: ${config.SSLCOMMERZ_SUCCESS_URL}`);
    console.log(`Fail URL: ${config.SSLCOMMERZ_FAIL_URL}`);
    console.log(`Cancel URL: ${config.SSLCOMMERZ_CANCEL_URL}`);
    console.log(`IPN URL: ${config.SSLCOMMERZ_IPN_URL}\n`);

    // Test payment data
    const testPaymentData = {
      total_amount: 100,
      currency: 'BDT',
      tran_id: 'TEST' + Date.now(),
      success_url: config.SSLCOMMERZ_SUCCESS_URL,
      fail_url: config.SSLCOMMERZ_FAIL_URL,
      cancel_url: config.SSLCOMMERZ_CANCEL_URL,
      ipn_url: config.SSLCOMMERZ_IPN_URL,
      shipping_method: 'NO',
      product_name: 'Test Chicken Samosa Order',
      product_category: 'Food',
      product_profile: 'general',
      cus_name: 'Test Customer',
      cus_email: 'test@example.com',
      cus_add1: 'Test Address',
      cus_add2: 'Test Area',
      cus_city: 'Rangpur',
      cus_state: 'Rangpur',
      cus_postcode: '5400',
      cus_country: 'Bangladesh',
      cus_phone: '01700000000',
      cus_fax: '01700000000',
      ship_name: 'Test Customer',
      ship_add1: 'Test Address',
      ship_add2: 'Test Area',
      ship_city: 'Rangpur',
      ship_state: 'Rangpur',
      ship_postcode: '5400',
      ship_country: 'Bangladesh',
      multi_card_name: 'brac_visa,mastercard,dbbl_visa,dbbl_master,amex,internet_banking',
      value_a: 'TEST' + Date.now(),
      value_b: 'pickplace_ecommerce_order',
      value_c: 'online_payment',
      value_d: 'sslcommerz'
    };

    console.log('🔄 Testing payment initiation...');
    
    // Test payment initiation
    const response = await sslcommerz.initiatePayment(testPaymentData);
    
    if (response.status === 'SUCCESS') {
      console.log('✅ Payment initiation successful!');
      console.log(`Gateway URL: ${response.GatewayPageURL}`);
      console.log(`Session Key: ${response.sessionkey}`);
    } else {
      console.log('❌ Payment initiation failed');
      console.log('Response:', response);
    }

  } catch (error) {
    console.error('❌ SSLCommerz test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testSSLCommerz();
