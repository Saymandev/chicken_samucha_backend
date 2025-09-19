# Email Setup Guide

## Option 1: Gmail App Password (Recommended - Easier)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Copy the 16-character password

3. **Add to your .env file**:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

## Option 2: OAuth2 (More Complex)

1. **Create Google Cloud Project**:
   - Go to Google Cloud Console
   - Create new project
   - Enable Gmail API

2. **Create OAuth2 Credentials**:
   - Go to Credentials → Create Credentials → OAuth2 Client ID
   - Set redirect URI: `http://localhost:5000/auth/google/callback`

3. **Get Refresh Token**:
   - Use OAuth2 playground or implement OAuth flow
   - Get refresh token for your Gmail account

4. **Add to your .env file**:
```env
GMAIL_USER=your-email@gmail.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

## Test Email Setup

After setting up credentials, test with:
```bash
cd backend
node test-notifications.js
```

You should see:
- ✅ Order confirmation email test: SUCCESS
- ✅ Order status update email test: SUCCESS
- (Without the "No email credentials found" warning)
