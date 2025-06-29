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
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async createTransporter() {
    try {
      // Check if OAuth is properly configured
      if (!process.env.GOOGLE_REFRESH_TOKEN) {
        console.warn('⚠️  GOOGLE_REFRESH_TOKEN not set. Email sending disabled.');
        return null;
      }

      const accessToken = await this.getAccessToken();

      const transporter = nodemailer.createTransporter({
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
      console.error('Error creating transporter:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to, resetToken) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        console.log('=== EMAIL WOULD BE SENT ===');
        console.log('To:', to);
        console.log('Subject: Password Reset Request');
        console.log('Reset URL:', resetUrl);
        console.log('=========================');
        
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
      console.log('Password reset email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(to, name) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
        console.log('=== WELCOME EMAIL WOULD BE SENT ===');
        console.log('To:', to);
        console.log('Subject: Welcome to Our Platform!');
        console.log('Name:', name);
        console.log('================================');
        
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
      console.log('Welcome email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendOrderConfirmation(to, orderDetails) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
        console.log('=== ORDER CONFIRMATION EMAIL WOULD BE SENT ===');
        console.log('To:', to);
        console.log('Order:', orderDetails.orderNumber);
        console.log('Amount:', orderDetails.totalAmount);
        console.log('=============================================');
        
        return { messageId: 'dev-mode-no-email' };
      }
      
      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Order Confirmation - ${orderDetails.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Order Confirmed!</h2>
            <p>Your order has been received and is being processed.</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Order Details:</h3>
              <p><strong>Order Number:</strong> ${orderDetails.orderNumber}</p>
              <p><strong>Total Amount:</strong> ৳${orderDetails.totalAmount}</p>
              <p><strong>Status:</strong> ${orderDetails.status}</p>
            </div>
            <p>We'll notify you when your order is ready for delivery.</p>
          </div>
        `,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Order confirmation email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService(); 