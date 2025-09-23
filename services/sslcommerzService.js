const SSLCommerzPayment = require('sslcommerz-lts');
const config = require('../config/config');

class SSLCommerzService {
  constructor() {
    // sslcommerz-lts expects the 3rd param as isLive (true => LIVE). Our flag is IS_SANDBOX, so invert it.
    const isLive = !config.SSLCOMMERZ_IS_SANDBOX;
    this.sslcommerz = new SSLCommerzPayment(
      config.SSLCOMMERZ_STORE_ID,
      config.SSLCOMMERZ_STORE_PASSWORD,
      isLive
    );
    const mask = (v) => (v ? `${String(v).slice(0,4)}...${String(v).slice(-4)}` : '(empty)');
    console.log('[SSLCommerz CONFIG]', {
      isSandbox: config.SSLCOMMERZ_IS_SANDBOX,
      isLive,
      storeId: mask(config.SSLCOMMERZ_STORE_ID),
      storePassSet: !!config.SSLCOMMERZ_STORE_PASSWORD,
      successUrl: config.SSLCOMMERZ_SUCCESS_URL,
      failUrl: config.SSLCOMMERZ_FAIL_URL,
      cancelUrl: config.SSLCOMMERZ_CANCEL_URL,
      ipnUrl: config.SSLCOMMERZ_IPN_URL
    });
  }

  /**
   * Initiate payment session
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment session response
   */
  async initiatePayment(paymentData) {
    try {
      const {
        orderNumber,
        totalAmount,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        items
      } = paymentData;

      // Prepare SSLCommerz payment data
      const postData = {
        total_amount: totalAmount,
        currency: 'BDT',
        tran_id: orderNumber,
        success_url: config.SSLCOMMERZ_SUCCESS_URL,
        fail_url: config.SSLCOMMERZ_FAIL_URL,
        cancel_url: config.SSLCOMMERZ_CANCEL_URL,
        ipn_url: config.SSLCOMMERZ_IPN_URL,
        shipping_method: 'NO',
        product_name: 'Chicken Samosa Order',
        product_category: 'Food',
        product_profile: 'general',
        cus_name: customerName,
        cus_email: customerEmail,
        cus_add1: customerAddress?.street || 'N/A',
        cus_add2: customerAddress?.area || 'N/A',
        cus_city: customerAddress?.city || 'Rangpur',
        cus_state: customerAddress?.district || 'Rangpur',
        cus_postcode: '5400',
        cus_country: 'Bangladesh',
        cus_phone: customerPhone,
        cus_fax: customerPhone,
        ship_name: customerName,
        ship_add1: customerAddress?.street || 'N/A',
        ship_add2: customerAddress?.area || 'N/A',
        ship_city: customerAddress?.city || 'Rangpur',
        ship_state: customerAddress?.district || 'Rangpur',
        ship_postcode: '5400',
        ship_country: 'Bangladesh',
        multi_card_name: 'brac_visa,mastercard,dbbl_visa,dbbl_master,amex,internet_banking',
        value_a: orderNumber,
        value_b: 'chicken_samosa_order',
        value_c: 'online_payment',
        value_d: 'sslcommerz'
      };

      // Add cart items
      if (items && items.length > 0) {
        items.forEach((item, index) => {
          postData[`cart[${index}][product]`] = item.name?.en || item.name || 'Chicken Samosa';
          postData[`cart[${index}][amount]`] = item.price;
          postData[`cart[${index}][quantity]`] = item.quantity;
        });
      }

      console.log('🚀 Initiating SSLCommerz payment for order:', orderNumber);
      
      // sslcommerz-lts exposes `init` for creating a payment session
      const response = await this.sslcommerz.init(postData);
      
      if (response.status === 'SUCCESS') {
        console.log('✅ SSLCommerz payment initiated successfully');
        return {
          success: true,
          data: {
            gatewayPageURL: response.GatewayPageURL,
            sessionkey: response.sessionkey,
            orderNumber: orderNumber,
            amount: totalAmount,
            currency: 'BDT'
          }
        };
      } else {
        console.error('❌ SSLCommerz payment initiation failed:', response);
        return {
          success: false,
          message: response.failedreason || 'Payment initiation failed',
          error: response
        };
      }
    } catch (error) {
      console.error('❌ SSLCommerz payment initiation error:', error);
      return {
        success: false,
        message: 'Payment initiation failed',
        error: error.message
      };
    }
  }

  /**
   * Verify payment response
   * @param {Object} responseData - Payment response data
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(responseData) {
    try {
      const {
        val_id,
        amount,
        currency,
        tran_id,
        status,
        store_amount,
        card_type,
        card_no,
        bank_tran_id,
        card_issuer,
        card_brand,
        card_issuer_country,
        card_issuer_country_code,
        store_id,
        verify_sign,
        verify_key,
        cus_fax,
        currency_type,
        currency_amount,
        currency_rate,
        base_fair,
        value_a,
        value_b,
        value_c,
        value_d,
        risk_level,
        risk_title
      } = responseData;

      // Verify the payment using SSLCommerz verification
      const verificationData = {
        val_id: val_id,
        store_id: store_id,
        store_passwd: config.SSLCOMMERZ_STORE_PASSWORD
      };

      // sslcommerz-lts exposes `validate` for verifying a transaction
      const verificationResponse = await this.sslcommerz.validate(verificationData);

      if (verificationResponse.status === 'VALID' || verificationResponse.status === 'VALIDATED') {
        console.log('✅ SSLCommerz payment verified successfully');
        return {
          success: true,
          verified: true,
          data: {
            orderNumber: tran_id,
            transactionId: bank_tran_id || val_id,
            amount: parseFloat(amount),
            currency: currency,
            status: status,
            cardType: card_type,
            cardNumber: card_no,
            cardIssuer: card_issuer,
            cardBrand: card_brand,
            bankTransactionId: bank_tran_id,
            storeAmount: parseFloat(store_amount),
            paymentMethod: 'sslcommerz',
            verifiedAt: new Date(),
            gatewayResponse: verificationResponse
          }
        };
      } else {
        console.error('❌ SSLCommerz payment verification failed:', verificationResponse);
        return {
          success: false,
          verified: false,
          message: verificationResponse.reason || 'Payment verification failed',
          error: verificationResponse
        };
      }
    } catch (error) {
      console.error('❌ SSLCommerz payment verification error:', error);
      return {
        success: false,
        verified: false,
        message: 'Payment verification failed',
        error: error.message
      };
    }
  }

  /**
   * Process IPN (Instant Payment Notification)
   * @param {Object} ipnData - IPN data from SSLCommerz
   * @returns {Promise<Object>} IPN processing result
   */
  async processIPN(ipnData) {
    try {
      console.log('📨 Processing SSLCommerz IPN:', ipnData);
      
      // Verify IPN data
      const verificationResult = await this.verifyPayment(ipnData);
      
      if (verificationResult.success && verificationResult.verified) {
        console.log('✅ IPN processed successfully for order:', ipnData.tran_id);
        return {
          success: true,
          processed: true,
          orderNumber: ipnData.tran_id,
          transactionId: ipnData.bank_tran_id || ipnData.val_id,
          amount: parseFloat(ipnData.amount),
          status: ipnData.status,
          message: 'IPN processed successfully'
        };
      } else {
        console.error('❌ IPN verification failed:', verificationResult);
        return {
          success: false,
          processed: false,
          message: 'IPN verification failed',
          error: verificationResult.error
        };
      }
    } catch (error) {
      console.error('❌ IPN processing error:', error);
      return {
        success: false,
        processed: false,
        message: 'IPN processing failed',
        error: error.message
      };
    }
  }

  /**
   * Get payment status
   * @param {string} orderNumber - Order number
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(orderNumber) {
    try {
      const statusData = {
        tran_id: orderNumber,
        store_id: config.SSLCOMMERZ_STORE_ID,
        store_passwd: config.SSLCOMMERZ_STORE_PASSWORD
      };

      const response = await this.sslcommerz.queryTransactionStatus(statusData);
      
      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('❌ Get payment status error:', error);
      return {
        success: false,
        message: 'Failed to get payment status',
        error: error.message
      };
    }
  }

  /**
   * Refund payment
   * @param {Object} refundData - Refund data
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(refundData) {
    try {
      const {
        bank_tran_id,
        refund_amount,
        refund_remarks
      } = refundData;

      const refundRequest = {
        bank_tran_id: bank_tran_id,
        refund_amount: refund_amount,
        refund_remarks: refund_remarks || 'Refund request',
        store_id: config.SSLCOMMERZ_STORE_ID,
        store_passwd: config.SSLCOMMERZ_STORE_PASSWORD
      };

      const response = await this.sslcommerz.initiateRefund(refundRequest);
      
      if (response.status === 'SUCCESS') {
        return {
          success: true,
          data: response
        };
      } else {
        return {
          success: false,
          message: response.failedreason || 'Refund failed',
          error: response
        };
      }
    } catch (error) {
      console.error('❌ Refund payment error:', error);
      return {
        success: false,
        message: 'Refund failed',
        error: error.message
      };
    }
  }
}

module.exports = new SSLCommerzService();
