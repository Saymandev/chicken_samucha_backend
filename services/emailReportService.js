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
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${reportType} Business Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { padding: 30px; }
            .metric-card { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #ff6b35; }
            .metric-value { font-size: 2em; font-weight: bold; color: #ff6b35; margin: 10px 0; }
            .metric-label { color: #666; font-size: 0.9em; }
            .comparison { display: flex; justify-content: space-between; margin: 20px 0; }
            .comparison-item { flex: 1; text-align: center; padding: 15px; margin: 0 10px; background: #f8f9fa; border-radius: 8px; }
            .product-list { margin: 20px 0; }
            .product-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; margin: 5px 0; border-radius: 5px; }
            .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
            .status-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
            .footer { text-align: center; padding: 20px; color: #666; border-top: 1px solid #eee; }
            .trend-up { color: #28a745; }
            .trend-down { color: #dc3545; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🍗 ${reportType} Business Report</h1>
                <p>Chicken Samosa Business Analytics</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
            <div class="content">
    `;

    if (reportType === 'Daily') {
      const { yesterday, today, topProducts, orderStatus } = reportData;
      
      html += `
                <h2>📊 Yesterday's Performance</h2>
                <div class="metric-card">
                    <div class="metric-value">${formatCurrency(yesterday.totalRevenue)}</div>
                    <div class="metric-label">Total Revenue</div>
                </div>
                
                <div class="comparison">
                    <div class="comparison-item">
                        <h3>Yesterday</h3>
                        <div class="metric-value">${yesterday.totalOrders}</div>
                        <div class="metric-label">Orders</div>
                    </div>
                    <div class="comparison-item">
                        <h3>Today (So Far)</h3>
                        <div class="metric-value">${today.totalOrders}</div>
                        <div class="metric-label">Orders</div>
                    </div>
                </div>

                <h3>🏆 Top Products Yesterday</h3>
                <div class="product-list">
      `;
      
      topProducts.forEach((product, index) => {
        html += `
                    <div class="product-item">
                        <span>${index + 1}. ${product.product.name.en}</span>
                        <span><strong>${formatCurrency(product.totalRevenue)}</strong> (${product.totalQuantity} sold)</span>
                    </div>
        `;
      });
      
      html += `
                </div>

                <h3>📈 Order Status Distribution</h3>
                <div class="status-grid">
      `;
      
      orderStatus.forEach(status => {
        html += `
                    <div class="status-item">
                        <div class="metric-value">${status.count}</div>
                        <div class="metric-label">${status._id.replace('_', ' ')}</div>
                    </div>
        `;
      });
      
      html += `</div>`;
    } else if (reportType === 'Weekly' || reportType === 'Monthly') {
      const { totals, dailyData } = reportData;
      
      html += `
                <h2>📊 ${reportType} Summary</h2>
                <div class="metric-card">
                    <div class="metric-value">${formatCurrency(totals.totalRevenue)}</div>
                    <div class="metric-label">Total Revenue</div>
                </div>
                
                <div class="comparison">
                    <div class="comparison-item">
                        <div class="metric-value">${totals.totalOrders}</div>
                        <div class="metric-label">Total Orders</div>
                    </div>
                    <div class="comparison-item">
                        <div class="metric-value">${formatCurrency(totals.averageOrderValue)}</div>
                        <div class="metric-label">Avg Order Value</div>
                    </div>
                </div>

                <h3>📈 Daily Performance</h3>
                <div class="product-list">
      `;
      
      dailyData.forEach(day => {
        const date = new Date(day._id.year, day._id.month - 1, day._id.day);
        html += `
                    <div class="product-item">
                        <span>${date.toLocaleDateString()}</span>
                        <span><strong>${formatCurrency(day.revenue)}</strong> (${day.orders} orders)</span>
                    </div>
        `;
      });
      
      html += `</div>`;
    }

    html += `
            </div>
            <div class="footer">
                <p>This is an automated report generated by your business management system.</p>
                <p>For questions or support, contact your system administrator.</p>
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
        from: `"Chicken Samosa Business" <${process.env.GMAIL_USER}>`,
        to: recipients.join(', '),
        subject: `🍗 ${reportType} Business Report - ${new Date().toLocaleDateString()}`,
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
