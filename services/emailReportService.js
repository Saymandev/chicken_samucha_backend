const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const Order = require('../models/Order');
const User = require('../models/User');

class EmailReportService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Method 1: Using App Password (Easier and more reliable)
      if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER) {
        await this.setupAppPassword();
       
      }
      // Method 2: Using OAuth2 (More complex but more secure)
      else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        await this.setupOAuth2();
       
      }
      // Method 3: Using Service Account
      else if (fs.existsSync(path.join(__dirname, '../google-credentials.json'))) {
        await this.setupServiceAccount();
        
      }
      else {
        
        
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  async setupOAuth2() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      const accessToken = await oauth2Client.getAccessToken();

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token
        }
      });
      
     
    } catch (error) {
      console.error('OAuth2 setup failed:', error.message);
      throw error;
    }
  }

  async setupAppPassword() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }

  async setupServiceAccount() {
    const credentials = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../google-credentials.json'), 'utf8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/gmail.send']
    });

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        refreshToken: credentials.refresh_token,
        accessToken: accessToken.token
      }
    });
  }

  async generateDailyReport() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Get yesterday's data
      const yesterdayData = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: yesterday, $lt: today }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$finalAmount' }
          }
        }
      ]);

      // Get today's data for comparison
      const todayData = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: today }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 }
          }
        }
      ]);

      // Get top products
      const topProducts = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: yesterday, $lt: today }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]);

      // Get order status distribution
      const orderStatus = await Order.aggregate([
        { $match: { createdAt: { $gte: yesterday, $lt: today } } },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      const reportData = {
        date: yesterday.toISOString().split('T')[0],
        yesterday: yesterdayData[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        today: todayData[0] || { totalRevenue: 0, totalOrders: 0 },
        topProducts,
        orderStatus
      };

      return reportData;
    } catch (error) {
      console.error('Error generating daily report:', error);
      throw error;
    }
  }

  async generateWeeklyReport() {
    try {
      const now = new Date();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get weekly data
      const weeklyData = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: weekStart }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            revenue: { $sum: '$finalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // Get total weekly metrics
      const totalWeekly = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: weekStart }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$finalAmount' }
          }
        }
      ]);

      return {
        period: 'Weekly',
        startDate: weekStart.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        dailyData: weeklyData,
        totals: totalWeekly[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 }
      };
    } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
    }
  }

  async generateMonthlyReport() {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get monthly data
      const monthlyData = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: monthStart }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            revenue: { $sum: '$finalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // Get total monthly metrics
      const totalMonthly = await Order.aggregate([
        { 
          $match: { 
            createdAt: { $gte: monthStart }, 
            orderStatus: { $ne: 'cancelled' } 
          } 
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$finalAmount' }
          }
        }
      ]);

      return {
        period: 'Monthly',
        startDate: monthStart.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        dailyData: monthlyData,
        totals: totalMonthly[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 }
      };
    } catch (error) {
      console.error('Error generating monthly report:', error);
      throw error;
    }
  }

  generateHTMLReport(reportData, reportType) {
    const formatCurrency = (amount) => `৳${amount.toLocaleString()}`;
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reportType} Business Report</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 40px; text-align: center; position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"50\" cy=\"50\" r=\"1\" fill=\"rgba(255,255,255,0.1)\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>'); opacity: 0.1;"></div>
                
                <div style="position: relative; z-index: 1;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; backdrop-filter: blur(10px);">
                        <span style="color: #ffffff; font-size: 36px;">📊</span>
                    </div>
                    
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        ${reportType} Business Report
                    </h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">
                        🍗 Chicken Samucha Analytics
                    </p>
                    <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 14px; opacity: 0.8;">
                        Generated on ${new Date().toLocaleString()}
                    </p>
                </div>
            </div>

            <!-- Main Content -->
            <div style="padding: 40px;">
    `;

    if (reportType === 'Daily') {
      const { yesterday, today, topProducts, orderStatus } = reportData;
      
      html += `
                <!-- Key Metrics -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; padding: 30px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 25px 0; display: flex; align-items: center;">
                        <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px;">💰</span>
                        Yesterday's Performance
                    </h2>
                    
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.15);">
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 8px;">${formatCurrency(yesterday.totalRevenue)}</div>
                        <div style="color: #ffffff; font-size: 16px; font-weight: 500; opacity: 0.9;">Total Revenue</div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="background: #ffffff; border-radius: 12px; padding: 25px; text-align: center; border: 1px solid #e5e7eb;">
                            <h3 style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Yesterday</h3>
                            <div style="color: #1f2937; font-size: 28px; font-weight: 700; margin-bottom: 5px;">${yesterday.totalOrders}</div>
                            <div style="color: #6b7280; font-size: 14px; font-weight: 500;">Orders</div>
                        </div>
                        <div style="background: #ffffff; border-radius: 12px; padding: 25px; text-align: center; border: 1px solid #e5e7eb;">
                            <h3 style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Today (So Far)</h3>
                            <div style="color: #1f2937; font-size: 28px; font-weight: 700; margin-bottom: 5px;">${today.totalOrders}</div>
                            <div style="color: #6b7280; font-size: 14px; font-weight: 500;">Orders</div>
                        </div>
                    </div>
                </div>

                <!-- Top Products -->
                <div style="background: #ffffff; border-radius: 16px; padding: 30px; margin-bottom: 30px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="color: #1f2937; font-size: 20px; font-weight: 700; margin: 0 0 25px 0; display: flex; align-items: center;">
                        <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px;">🏆</span>
                        Top Products Yesterday
                    </h3>
                    
                    <div style="space-y: 12px;">
      `;
      
      topProducts.forEach((product, index) => {
        html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                            <div style="display: flex; align-items: center;">
                                <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-right: 12px;">${index + 1}</span>
                                <span style="color: #1f2937; font-size: 16px; font-weight: 600;">${product.product.name.en}</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #059669; font-size: 16px; font-weight: 700;">${formatCurrency(product.totalRevenue)}</div>
                                <div style="color: #6b7280; font-size: 14px; font-weight: 500;">${product.totalQuantity} sold</div>
                            </div>
                        </div>
        `;
      });
      
      html += `
                    </div>
                </div>

                <!-- Order Status -->
                <div style="background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="color: #1f2937; font-size: 20px; font-weight: 700; margin: 0 0 25px 0; display: flex; align-items: center;">
                        <span style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px;">📈</span>
                        Order Status Distribution
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px;">
      `;
      
      orderStatus.forEach(status => {
        html += `
                        <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e5e7eb;">
                            <div style="color: #1f2937; font-size: 24px; font-weight: 700; margin-bottom: 8px;">${status.count}</div>
                            <div style="color: #6b7280; font-size: 14px; font-weight: 500; text-transform: capitalize;">${status._id.replace('_', ' ')}</div>
                        </div>
        `;
      });
      
      html += `
                    </div>
                </div>
      `;
    } else if (reportType === 'Weekly' || reportType === 'Monthly') {
      const { totals, dailyData } = reportData;
      
      html += `
                <!-- Summary Metrics -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 16px; padding: 30px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 25px 0; display: flex; align-items: center;">
                        <span style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 12px;">📊</span>
                        ${reportType} Summary
                    </h2>
                    
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.15);">
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 8px;">${formatCurrency(totals.totalRevenue)}</div>
                        <div style="color: #ffffff; font-size: 16px; font-weight: 500; opacity: 0.9;">Total Revenue</div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="background: #ffffff; border-radius: 12px; padding: 25px; text-align: center; border: 1px solid #e5e7eb;">
                            <h3 style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Orders</h3>
                            <div style="color: #1f2937; font-size: 28px; font-weight: 700; margin-bottom: 5px;">${totals.totalOrders}</div>
                        </div>
                        <div style="background: #ffffff; border-radius: 12px; padding: 25px; text-align: center; border: 1px solid #e5e7eb;">
                            <h3 style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Avg Order Value</h3>
                            <div style="color: #1f2937; font-size: 28px; font-weight: 700; margin-bottom: 5px;">${formatCurrency(totals.averageOrderValue)}</div>
                        </div>
                    </div>
                </div>

                <!-- Daily Performance -->
                <div style="background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="color: #1f2937; font-size: 20px; font-weight: 700; margin: 0 0 25px 0; display: flex; align-items: center;">
                        <span style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 12px;">📈</span>
                        Daily Performance
                    </h3>
                    
                    <div style="space-y: 12px;">
      `;
      
      dailyData.forEach(day => {
        const date = new Date(day._id.year, day._id.month - 1, day._id.day);
        html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                            <div style="color: #1f2937; font-size: 16px; font-weight: 600;">${date.toLocaleDateString()}</div>
                            <div style="text-align: right;">
                                <div style="color: #059669; font-size: 16px; font-weight: 700;">${formatCurrency(day.revenue)}</div>
                                <div style="color: #6b7280; font-size: 14px; font-weight: 500;">${day.orders} orders</div>
                            </div>
                        </div>
        `;
      });
      
      html += `
                    </div>
                </div>
      `;
    }

    html += `
            </div>

            <!-- Footer -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #6b7280; font-size: 16px; margin: 0 0 10px 0; font-weight: 500;">
                    📊 Automated Business Intelligence Report
                </p>
                <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                    Generated by Chicken Samucha Management System
                </p>
            </div>

        </div>
    </body>
    </html>
    `;

    return html;
  }

  async sendReport(recipients, reportType, reportData) {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      const html = this.generateHTMLReport(reportData, reportType);
      
      const mailOptions = {
        from: `"Chicken Samucha Analytics" <${process.env.GMAIL_USER}>`,
        to: recipients.join(', '),
        subject: `📊 ${reportType} Business Intelligence Report - ${new Date().toLocaleDateString()}`,
        html: html,
        attachments: [
          {
            filename: `${reportType.toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.html`,
            content: html,
            contentType: 'text/html'
          }
        ]
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return result;
    } catch (error) {
      console.error(`Failed to send ${reportType} report:`, error);
      throw error;
    }
  }

  async sendDailyReport(recipients) {
    const reportData = await this.generateDailyReport();
    return await this.sendReport(recipients, 'Daily', reportData);
  }

  async sendWeeklyReport(recipients) {
    const reportData = await this.generateWeeklyReport();
    return await this.sendReport(recipients, 'Weekly', reportData);
  }

  async sendMonthlyReport(recipients) {
    const reportData = await this.generateMonthlyReport();
    return await this.sendReport(recipients, 'Monthly', reportData);
  }
}

module.exports = new EmailReportService();
