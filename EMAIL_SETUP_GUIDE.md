# 📧 Email Report Setup Guide

This guide will help you set up automated email reports using Google Console credentials.

## 🔐 Step 1: Get Google Console Credentials

### Method 1: OAuth2 (Recommended for Production)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a New Project**:
   - Click "Select a project" → "New Project"
   - Name: "Your Business Email Service"
   - Click "Create"

3. **Enable Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click on it and "Enable"

4. **Create OAuth2 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Email Service"
   - Authorized redirect URIs: `http://localhost:5000` (for development)
   - Click "Create"

5. **Get Refresh Token**:
   - Download the JSON file
   - Use the OAuth2 playground: https://developers.google.com/oauthplayground/
   - Select "Gmail API v1" → "https://www.googleapis.com/auth/gmail.send"
   - Authorize and get refresh token

### Method 2: App Password (Easier for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password instead of your regular password

### Method 3: Service Account (For Server-to-Server)

1. **Create Service Account**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: "Email Service Account"
   - Click "Create and Continue"

2. **Download Key File**:
   - Click on the service account
   - Go to "Keys" tab
   - Add key → Create new key → JSON
   - Download and rename to `google-credentials.json`
   - Place in `backend/` folder

## 🔧 Step 2: Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
GMAIL_USER=your-email@gmail.com

# Method 1: OAuth2 (Recommended)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token

# Method 2: App Password (Easier)
GMAIL_APP_PASSWORD=your-app-password

# Method 3: Service Account (Server-to-Server)
# Place google-credentials.json in backend/ folder
```

## 📦 Step 3: Install Dependencies

```bash
cd backend
npm install node-cron googleapis nodemailer
```

## 🚀 Step 4: Test Email Service

1. **Start your server**:
   ```bash
   npm run dev
   ```

2. **Test email sending**:
   - Go to Admin Dashboard → Reports
   - Click "Send Test Email"
   - Check your email inbox

## ⏰ Step 5: Schedule Configuration

The system comes with pre-configured schedules:

- **Daily Report**: 9:00 AM (Asia/Dhaka timezone)
- **Weekly Report**: Monday 10:00 AM
- **Monthly Report**: 1st of every month 11:00 AM

### Customize Schedules

You can modify schedules in `backend/services/schedulerService.js`:

```javascript
// Daily at 8:00 AM
'0 8 * * *'

// Weekly on Sunday at 9:00 AM
'0 9 * * 0'

// Monthly on 15th at 10:00 AM
'0 10 15 * *'
```

## 📊 Step 6: Report Recipients

Reports are automatically sent to all admin users. To add more recipients:

1. **Add admin users** through the admin panel
2. **Or modify** `getAdminEmails()` in `schedulerService.js`

## 🔍 Step 7: Monitor Scheduler

Check scheduler status:
- **API**: `GET /api/admin/scheduler/status`
- **Admin Panel**: Reports page shows scheduler status

## 🛠️ Troubleshooting

### Common Issues:

1. **"Email service not initialized"**:
   - Check environment variables
   - Verify Google credentials

2. **"Authentication failed"**:
   - Regenerate OAuth2 refresh token
   - Check app password validity

3. **"No admin emails found"**:
   - Ensure admin users exist in database
   - Check user role is set to 'admin'

4. **"Scheduler not running"**:
   - Check server logs for errors
   - Restart scheduler via API

### Debug Mode:

Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📧 Email Templates

Reports include:
- **Daily**: Yesterday's performance, top products, order status
- **Weekly**: 7-day summary, daily trends
- **Monthly**: 30-day overview, monthly trends

Templates are in `backend/services/emailReportService.js` - customize as needed.

## 🔒 Security Notes

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Monitor email usage** in Google Console

## 📈 Performance

- Reports are generated asynchronously
- No impact on main application performance
- Failed reports are logged but don't crash the system
- Scheduler runs in background

## 🎯 Next Steps

1. Set up Google Console credentials
2. Add environment variables
3. Test email sending
4. Customize report schedules
5. Monitor scheduler status

Your automated email reporting system is now ready! 🚀
