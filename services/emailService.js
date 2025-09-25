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

  async sendSubscriptionWelcome(to, unsubscribeUrl, brand = { name: 'Pickplace', emoji: '🛒' }) {
    try {
      const transporter = await this.createTransporter();
      if (!transporter) {
        return { messageId: 'dev-mode-no-email' };
      }

      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to,
        subject: 'Thanks for subscribing! 🎉',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Subscription Confirmed</title>
          </head>
          <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 100%);padding:24px 28px;text-align:center;">
                <div style="font-size:32px;line-height:1.2;color:#fff;">${brand.emoji} ${brand.name}</div>
                <div style="color:#fff;opacity:.9;margin-top:6px">You’re on the list! 🎉</div>
              </div>
              <div style="padding:28px;">
                <h2 style="margin:0 0 8px 0;color:#111827;font-size:22px;">Welcome to our newsletter</h2>
                <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.6;">Thanks for subscribing. We’ll send you special offers, new products and updates.</p>
                <ul style="margin:0 0 20px 20px;color:#374151;font-size:15px;line-height:1.8;">
                  <li>Exclusive discounts and seasonal deals</li>
                  <li>New menu and product announcements</li>
                  <li>Occasional tips and news</li>
                </ul>
                <a href="${process.env.FRONTEND_URL || '#'}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Browse now</a>
                <p style="margin:18px 0 0 0;color:#6b7280;font-size:12px;">If this wasn’t you, you can <a href="${unsubscribeUrl}" style="color:#ef4444;text-decoration:underline;">unsubscribe</a> anytime.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        headers: unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>` } : {}
      };

      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('⚠️  Error sending subscription welcome email:', error.message);
      return { error: error.message };
    }
  }

  async sendOrderConfirmation(to, orderDetails) {
    try {
      const transporter = await this.createTransporter();
      
      // If no transporter (OAuth not configured), log instead of sending
      if (!transporter) {
       
        
        return { messageId: 'dev-mode-no-email' };
      }

      // Generate items list HTML (support both populated and plain items)
      const itemsHtml = (orderDetails.items || []).map(item => {
        const itemName = (item?.product?.name?.en)
          || (item?.product?.name)
          || (item?.name?.en)
          || (item?.name?.bn)
          || (typeof item?.name === 'string' ? item.name : null)
          || 'Unknown Item';
        const quantity = item?.quantity ?? 1;
        const price = item?.price ?? (item?.subtotal && quantity ? (item.subtotal / quantity) : 0);
        return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 15px 20px; font-size: 14px; color: #374151; font-weight: 500;">${itemName}</td>
          <td style="padding: 15px 20px; text-align: center; font-size: 14px; color: #6b7280; font-weight: 500;">${quantity}</td>
          <td style="padding: 15px 20px; text-align: right; font-size: 14px; color: #059669; font-weight: 600;">৳${price}</td>
        </tr>`;
      }).join('');
      
      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Order Confirmation - ${orderDetails.orderNumber}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  🛒 Pickplace
                </h1>
                <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                  Authentic Bangladeshi Cuisine
                </p>
              </div>

              <!-- Main Content -->
              <div style="padding: 40px;">
                
                <!-- Success Icon -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);">
                    <span style="color: #ffffff; font-size: 36px;">✓</span>
                  </div>
                </div>

                <!-- Title -->
                <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 15px 0;">
                  Order Confirmed!
                </h2>
                
                <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 35px 0; line-height: 1.6;">
                  Thank you for choosing us! Your order has been received and is being prepared with care.
                </p>

                <!-- Order Details Card -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                  <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">📋</span>
                    Order Details
                  </h3>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Order Number</p>
                      <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0;">${orderDetails.orderNumber}</p>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Total Amount</p>
                      <p style="color: #059669; font-size: 18px; font-weight: 700; margin: 0;">৳${orderDetails.totalAmount}</p>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Status</p>
                      <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                        ${orderDetails.status ? orderDetails.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Pending'}
                      </span>
                    </div>
                    ${orderDetails.estimatedDeliveryTime ? `
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Estimated Delivery</p>
                      <p style="color: #1f2937; font-size: 14px; font-weight: 500; margin: 0;">${new Date(orderDetails.estimatedDeliveryTime).toLocaleString()}</p>
                    </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Order Items -->
                <div style="margin-bottom: 30px;">
                  <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">🍽️</span>
                    Order Items
                  </h3>
                  
                  <div style="background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
                          <th style="padding: 15px 20px; text-align: left; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Item</th>
                          <th style="padding: 15px 20px; text-align: center; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Qty</th>
                          <th style="padding: 15px 20px; text-align: right; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- What's Next -->
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 25px; border-left: 4px solid #10b981;">
                  <h3 style="color: #065f46; font-size: 16px; font-weight: 600; margin: 0 0 10px 0; display: flex; align-items: center;">
                    <span style="margin-right: 8px;">📱</span>
                    What's Next?
                  </h3>
                  <p style="color: #047857; font-size: 14px; margin: 0; line-height: 1.6;">
                    We'll notify you via email and real-time notifications when your order status changes. 
                    You can track your order progress instantly!
                  </p>
                </div>

              </div>

              <!-- Footer -->
              <div style="background: #f8fafc; padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                  Thank you for choosing Pickplace!
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  If you have any questions, please don't hesitate to contact us.
                </p>
              </div>

            </div>
          </body>
          </html>
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
      const statusDisplay = orderDetails.status ? orderDetails.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Pending';
      
      // Generate items list HTML (support both populated and plain items)
      const itemsHtml = (orderDetails.items || []).map(item => {
        const itemName = (item?.product?.name?.en)
          || (item?.product?.name)
          || (item?.name?.en)
          || (item?.name?.bn)
          || (typeof item?.name === 'string' ? item.name : null)
          || 'Unknown Item';
        const quantity = item?.quantity ?? 1;
        const price = item?.price ?? (item?.subtotal && quantity ? (item.subtotal / quantity) : 0);
        return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 15px 20px; font-size: 14px; color: #374151; font-weight: 500;">${itemName}</td>
          <td style="padding: 15px 20px; text-align: center; font-size: 14px; color: #6b7280; font-weight: 500;">${quantity}</td>
          <td style="padding: 15px 20px; text-align: right; font-size: 14px; color: #059669; font-weight: 600;">৳${price}</td>
        </tr>`;
      }).join('');

      const mailOptions = {
        from: `"Your Business" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: `Order Status Update - ${orderDetails.orderNumber}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Delivered</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  🛒 Pickplace
                </h1>
                <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                  Authentic Bangladeshi Cuisine
                </p>
              </div>

              <!-- Main Content -->
              <div style="padding: 40px;">
                
                <!-- Delivery Icon -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);">
                    <span style="color: #ffffff; font-size: 36px;">🚚</span>
                  </div>
                </div>

                <!-- Title -->
                <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; text-align: center; margin: 0 0 15px 0;">
                  Order Delivered! 🎉
                </h2>
                
                <p style="color: #6b7280; font-size: 16px; text-align: center; margin: 0 0 35px 0; line-height: 1.6;">
                  Hello ${customerName}, your order has been successfully delivered. We hope you enjoy your meal!
                </p>

                <!-- Order Details Card -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                  <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">📋</span>
                    Order Details
                  </h3>
                  
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Order Number</p>
                      <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 0;">${orderDetails.orderNumber}</p>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Total Amount</p>
                      <p style="color: #059669; font-size: 18px; font-weight: 700; margin: 0;">৳${orderDetails.totalAmount}</p>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Status</p>
                      <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                        ${statusDisplay}
                      </span>
                    </div>
                    <div>
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">Delivery Time</p>
                      <p style="color: #1f2937; font-size: 14px; font-weight: 500; margin: 0;">${new Date().toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <!-- Order Items -->
                <div style="margin-bottom: 30px;">
                  <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px;">🍽️</span>
                    Order Items
                  </h3>
                  
                  <div style="background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
                          <th style="padding: 15px 20px; text-align: left; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Item</th>
                          <th style="padding: 15px 20px; text-align: center; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Qty</th>
                          <th style="padding: 15px 20px; text-align: right; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Thank You Message -->
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 25px; border-left: 4px solid #10b981;">
                  <h3 style="color: #065f46; font-size: 16px; font-weight: 600; margin: 0 0 10px 0; display: flex; align-items: center;">
                    <span style="margin-right: 8px;">🙏</span>
                    Thank You!
                  </h3>
                  <p style="color: #047857; font-size: 14px; margin: 0; line-height: 1.6;">
                    We hope you enjoyed your meal! Your feedback is valuable to us. 
                    Thank you for choosing Pickplace for your shopping experience.
                  </p>
                </div>

              </div>

              <!-- Footer -->
              <div style="background: #f8fafc; padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                  Thank you for choosing Pickplace!
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  If you have any questions, please don't hesitate to contact us.
                </p>
              </div>

            </div>
          </body>
          </html>
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