// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const http = require('http');
const socketio = require('socket.io');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');

const connectDB = require('./config/database');
const config = require('./config/config');
const { handleUploadError } = require('./middleware/upload');
const serverMonitor = require('./utils/serverMonitor');

// Route files
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const contentRoutes = require('./routes/content');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const contactRoutes = require('./routes/contact');
const paymentRoutes = require('./routes/payments');
const couponRoutes = require('./routes/coupons');
const categoryRoutes = require('./routes/category');
const wishlistRoutes = require('./routes/wishlist');

// OAuth setup routes (for development/setup only)
const oauthSetupRoutes = require('./routes/oauth-setup');

// Models for Socket.IO
const { ChatMessage, ChatSession } = require('./models/ChatMessage');

// Connect to database
connectDB();

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketio(server, {
  cors: {
    origin: "https://chicken-samucha-frontend.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io globally accessible for notifications
global.io = io;

// Middleware to attach io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Server monitoring middleware
app.use(serverMonitor.middleware());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
}

// Sanitize data
app.use(mongoSanitize());

// Set security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Prevent XSS attacks
app.use(xss());

// Rate limiting disabled

// Prevent http param pollution
app.use(hpp());

// Enable CORS
app.use(cors({
  origin: 'https://chicken-samucha-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io globally accessible for controllers
global.io = io;

// Add socket info to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Public test endpoints (temporary - remove in production)
app.get('/api/test-email', async (req, res) => {
  try {
    const emailReportService = require('./services/emailReportService');
    
    res.json({
      success: true,
      message: 'Email service status check',
      status: {
        serviceAvailable: !!emailReportService,
        transporterInitialized: !!(emailReportService && emailReportService.transporter),
        credentials: {
          hasOAuth2: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
          hasAppPassword: !!(process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_USER),
          hasServiceAccount: require('fs').existsSync(require('path').join(__dirname, 'google-credentials.json'))
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasGmailUser: !!process.env.GMAIL_USER
        }
      }
    });
  } catch (error) {
    console.error('Email status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email service status',
      error: error.message
    });
  }
});

app.post('/api/test-email', async (req, res) => {
  try {
    const adminController = require('./controllers/adminController');
    await adminController.testEmailService(req, res);
  } catch (error) {
    console.error('Public email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email service test failed',
      error: error.message
    });
  }
});

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wishlist', wishlistRoutes);

// OAuth setup routes (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/oauth', oauthSetupRoutes);
}

// Handle upload errors
app.use(handleUploadError);

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Global error handler:', err);
  
  // Track error in monitoring
  serverMonitor.incrementErrorCount();
  
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
});

// Health check endpoint with detailed stats
app.get('/api/health', (req, res) => {
  const stats = serverMonitor.getStats();
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    stats: {
      uptime: `${Math.floor(stats.uptime / 1000 / 60)} minutes`,
      requestCount: stats.requestCount,
      errorCount: stats.errorCount,
      memoryUsage: `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`,
      mongoConnection: stats.mongoConnection ? 'Connected' : 'Disconnected'
    }
  });
});

// Socket.IO event handling
io.on('connection', (socket) => {
 

  // User joins a chat room
  socket.on('join-chat', (chatId) => {
   
    socket.join(chatId);
    
    // Notify admin dashboard about new user in chat
    socket.to('admin-dashboard').emit('user-joined-chat', { chatId, socketId: socket.id });
  });

  // User joins their personal notification room
  socket.on('join-user-room', (userId) => {
   
    socket.join(`user-${userId}`);
    
  });

  // Admin joins the admin dashboard
  socket.on('join-admin-dashboard', () => {
   
    socket.join('admin-dashboard');
  });

  // Admin joins a specific chat
  socket.on('join-admin-chat', (chatId) => {
   
    socket.join(chatId);
  });

  // Handle message sending from any source (user or admin)
  socket.on('send-message', async (messageData) => {
    try {
     
      const { chatId, message, senderId, senderName, senderType } = messageData;
      
      // Broadcast to all users in the chat room
      socket.to(chatId).emit('receive-message', {
        id: `socket-${Date.now()}`,
        senderId,
        senderName,
        senderType,
        message,
        timestamp: new Date().toISOString(),
        isRead: false
      });

      // If this is from a customer, also notify admin dashboard
      if (senderType === 'user') {
        socket.to('admin-dashboard').emit('new-customer-message', {
          chatId,
          message,
          senderName,
          timestamp: new Date().toISOString()
        });
      }

      
    } catch (error) {
      console.error('❌ Socket message error:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping, senderName, senderType } = data;
    socket.to(chatId).emit('user-typing', {
      chatId,
      isTyping,
      senderName,
      senderType
    });
  });

  // Handle chat session status updates
  socket.on('chat-status-update', (data) => {
    const { chatId, status, adminName } = data;
    io.to(chatId).emit('chat-status-changed', {
      chatId,
      status,
      adminName
    });
    
    // Notify admin dashboard
    io.to('admin-dashboard').emit('chat-session-updated', data);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    
  });
});

// Global error handlers to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down gracefully...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
  
  // Give the server a chance to finish ongoing requests
  server.close(() => {
    process.exit(1);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⏰ Forcefully shutting down...');
    process.exit(1);
  }, 10000);
});

process.on('unhandledRejection', (err, promise) => {
  console.error('💥 UNHANDLED PROMISE REJECTION! Server continues running...');
  console.error('Error:', err);
  console.error('Promise:', promise);
  // Don't crash the server, just log the error
});

process.on('SIGTERM', () => {
 
  server.close(() => {
    
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  
  
  
  
  // Start server monitoring
  serverMonitor.startMonitoring();
  
  // Start automated report scheduler
  try {
    const schedulerService = require('./services/schedulerService');
    schedulerService.start().catch(err => {
      console.error('Failed to start scheduler:', err);
     
    });
  } catch (error) {
    console.error('Failed to load scheduler service:', error);
   
  }
}); 