const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

// Helper route to get OAuth URL for setup
router.get('/google/auth-url', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({
    success: true,
    message: 'Visit this URL to authorize the application',
    authUrl: url,
    instructions: [
      '1. Visit the URL above',
      '2. Sign in with your Gmail account',
      '3. Grant permissions',
      '4. Copy the authorization code from the redirect URL',
      '5. Use the code with /oauth/google/token endpoint'
    ]
  });
});

// Helper route to exchange code for refresh token
router.post('/google/token', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    res.json({
      success: true,
      message: 'Tokens retrieved successfully',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date
      },
      instructions: [
        'Add this refresh_token to your .env file as GOOGLE_REFRESH_TOKEN',
        'Keep these tokens secure and never commit them to version control'
      ]
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to exchange code for tokens',
      error: error.message
    });
  }
});

module.exports = router; 