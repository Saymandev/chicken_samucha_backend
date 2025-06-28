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
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const connectDB = require('./config/database');
const config = require('./config/config');
const { handleUploadError } = require('./middleware/upload');

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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io globally accessible for controllers
global.io = io;

// Add socket info to requests
app.use((req, res, next) => {
  req.io = io;
  next();
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

// Handle upload errors
app.use(handleUploadError);

// Error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // User joins a chat room
  socket.on('join-chat', (chatId) => {
    console.log(`👤 User ${socket.id} joined chat: ${chatId}`);
    socket.join(chatId);
    
    // Notify admin dashboard about new user in chat
    socket.to('admin-dashboard').emit('user-joined-chat', { chatId, socketId: socket.id });
  });

  // Admin joins the admin dashboard
  socket.on('join-admin-dashboard', () => {
    console.log(`👨‍💼 Admin ${socket.id} joined admin dashboard`);
    socket.join('admin-dashboard');
  });

  // Admin joins a specific chat
  socket.on('join-admin-chat', (chatId) => {
    console.log(`👨‍💼 Admin ${socket.id} joined admin chat: ${chatId}`);
    socket.join(chatId);
  });

  // Handle message sending from any source (user or admin)
  socket.on('send-message', async (messageData) => {
    try {
      console.log('📨 Received message via socket:', messageData);
      
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

      console.log('✅ Message broadcasted successfully');
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

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`Socket.IO server ready for connections`);
}); 