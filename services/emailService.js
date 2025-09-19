const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials if available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }
  }

  async getAccessToken() {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token;
    } catch (error) {
      console.error('⚠️  Error getting access token:', error.message);
      return null; // Return null instead of throwing
    }
  }

  async createTransporter() {
    try {
      // Method 1: Try App Password first (easier and more reliable)
      if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER) {
        console.log('📧 Using App Password for email authentication');
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          }
        });
      }
      
      // Method 2: Fallback to OAuth2
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        console.warn('⚠️  No email credentials found. Email sending disabled.');
        return null;
      }

      const accessToken = await this.getAccessToken();
      
      // If access token failed, return null
      if (!accessToken) {
        console.warn('⚠️  Failed to get access token. Email sending disabled.');
        return null;
      }

      console.log('📧 Using OAuth2 for email authentication');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER, // Your Gmail address
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken,
        },
      });

      return transporter;
    } catch (error) {
      console.error('⚠️  Error creating transporter:', error.message);
      return null; // Return null instead of throwing
    }
  }

  async sendPasswordResetEmail(to, resetToken) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
       
        
        return { messageId: 'dev-mode-no-email' };
      }
      
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      
      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested a password reset for your account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 10 minutes for security reasons.
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this reset, please ignore this email.
            </p>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
     
      return result;
    } catch (error) {
      console.error('⚠️  Error sending password reset email:', error.message);
      return { error: error.message }; // Return error object instead of throwing
    }
  }

  async sendWelcomeEmail(to, name) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
       
        
        return { messageId: 'dev-mode-no-email' };
      }
      
      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: 'Welcome to Our Platform!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome ${name}!</h2>
            <p>Thank you for joining our platform. We're excited to have you!</p>
            <p>You can now:</p>
            <ul>
              <li>Browse our products</li>
              <li>Place orders</li>
              <li>Track your deliveries</li>
            </ul>
            <p>If you have any questions, feel free to contact us.</p>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
      
      return result;
    } catch (error) {
      console.error('⚠️  Error sending welcome email:', error.message);
      return { error: error.message }; // Return error object instead of throwing
    }
  }

  async sendOrderConfirmation(to, orderDetails) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
       
        
        return { messageId: 'dev-mode-no-email' };
      }

      // Generate items list HTML
      const itemsHtml = orderDetails.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">৳${item.price}</td>
        </tr>
      `).join('');
      
      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Order Confirmation - ${orderDetails.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Order Confirmed! 🎉</h2>
              <p>Thank you for your order! We've received it and it's being processed.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #333; margin-top: 0;">Order Details:</h3>
                <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
                <p><strong>Total Amount:</strong> ৳${orderDetails.totalAmount}</p>
                <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">${orderDetails.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></p>
                ${orderDetails.estimatedDeliveryTime ? `<p><strong>Estimated Delivery:</strong> ${new Date(orderDetails.estimatedDeliveryTime).toLocaleString()}</p>` : ''}
              </div>

              <div style="margin: 20px 0;">
                <h4 style="color: #333;">Order Items:</h4>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                      <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Quantity</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #2d5a2d;">
                  <strong>What's Next?</strong><br>
                  We'll notify you via email and in-app notifications when your order status changes. 
                  You can track your order progress in real-time!
                </p>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Thank you for choosing us! If you have any questions, please don't hesitate to contact us.
              </p>
            </div>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
      
      return result;
    } catch (error) {
      console.error('⚠️  Error sending order confirmation email:', error.message);
      return { error: error.message }; // Return error object instead of throwing
    }
  }

  async sendOrderStatusUpdateEmail(to, customerName, orderDetails) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
       
        
        return { messageId: 'dev-mode-no-email' };
      }

      // Format status for display
      const statusDisplay = orderDetails.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Generate items list HTML
      const itemsHtml = orderDetails.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">৳${item.price}</td>
        </tr>
      `).join('');

      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Order Status Update - ${orderDetails.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-bottom: 20px;">Order Status Update</h2>
              <p>Hello ${customerName},</p>
              <p>Your order status has been updated:</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
                <h3 style="color: #333; margin-top: 0;">Order Details:</h3>
                <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
                <p><strong>New Status:</strong> <span style="color: #007bff; font-weight: bold;">${statusDisplay}</span></p>
                <p><strong>Total Amount:</strong> ৳${orderDetails.totalAmount}</p>
                ${orderDetails.estimatedDeliveryTime ? `<p><strong>Estimated Delivery:</strong> ${new Date(orderDetails.estimatedDeliveryTime).toLocaleString()}</p>` : ''}
              </div>

              <div style="margin: 20px 0;">
                <h4 style="color: #333;">Order Items:</h4>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                      <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Quantity</th>
                      <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #2d5a2d;">
                  <strong>What's Next?</strong><br>
                  ${this.getStatusMessage(orderDetails.status)}
                </p>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Thank you for choosing us! If you have any questions, please don't hesitate to contact us.
              </p>
            </div>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
      
      return result;
    } catch (error) {
      console.error('⚠️  Error sending order status update email:', error.message);
      return { error: error.message };
    }
  }

  getStatusMessage(status) {
    const statusMessages = {
      'pending': 'Your order is being reviewed and will be confirmed shortly.',
      'confirmed': 'Your order has been confirmed and is being prepared.',
      'preparing': 'Your order is being prepared with fresh ingredients.',
      'ready': 'Your order is ready for pickup or delivery.',
      'out_for_delivery': 'Your order is on its way to you!',
      'delivered': 'Your order has been delivered. Enjoy your meal!',
      'cancelled': 'Your order has been cancelled. If you have any questions, please contact us.'
    };
    return statusMessages[status] || 'Your order status has been updated.';
  }
}

module.exports = new EmailService(); 