const { validationResult } = require('express-validator');
const { ChatMessage, ChatSession } = require('../models/ChatMessage');

// Start chat session
const startChatSession = async (req, res) => {
  try {
    

    const { customerInfo, category = 'general' } = req.body;

    if (!customerInfo || !customerInfo.name) {
      return res.status(400).json({
        success: false,
        message: 'Customer information is required'
      });
    }

    // First, clean up any existing duplicate sessions
    if (req.user) {
      // For authenticated users, close all but the most recent session
      const existingSessions = await ChatSession.find({
        'customer.user': req.user.id,
        status: { $in: ['active', 'waiting'] }
      }).sort({ createdAt: -1 });

      if (existingSessions.length > 1) {
        
        const sessionsToClose = existingSessions.slice(1); // Keep the first (most recent), close others
        await ChatSession.updateMany(
          { _id: { $in: sessionsToClose.map(s => s._id) } },
          { status: 'closed', endedAt: new Date() }
        );
        
      }
    } else if (customerInfo.email) {
      // For guests, clean up duplicates by email
      const existingSessions = await ChatSession.find({
        'customer.email': customerInfo.email,
        'customer.isGuest': true,
        status: { $in: ['active', 'waiting'] }
      }).sort({ createdAt: -1 });

      if (existingSessions.length > 1) {
        
        const sessionsToClose = existingSessions.slice(1);
        await ChatSession.updateMany(
          { _id: { $in: sessionsToClose.map(s => s._id) } },
          { status: 'closed', endedAt: new Date() }
        );
        
      }
    }

    // Now check for the remaining active session
    let session;
    if (req.user) {
      // For authenticated users, find existing session
      session = await ChatSession.findOne({
        'customer.user': req.user.id,
        status: { $in: ['active', 'waiting'] }
      });
      
    } else if (customerInfo.email) {
      // For guests, try to find by email AND name to be more specific
      session = await ChatSession.findOne({
        'customer.email': customerInfo.email,
        'customer.name': customerInfo.name,
        'customer.isGuest': true,
        status: { $in: ['active', 'waiting'] }
      });
      
    }

    // If no session found by email, try to find by phone (as backup)
    if (!session && customerInfo.phone) {
      session = await ChatSession.findOne({
        'customer.phone': customerInfo.phone,
        'customer.name': customerInfo.name,
        status: { $in: ['active', 'waiting'] }
      });
     
    }

    if (!session) {
      // Create new session if none exists
      const sessionData = {
        customer: {
          user: req.user ? req.user.id : null,
          name: customerInfo.name,
          phone: customerInfo.phone || '',
          email: customerInfo.email || '',
          isGuest: !req.user
        },
        category,
        status: 'waiting'
      };

      
      session = await ChatSession.create(sessionData);
      

      // Notify admin dashboard about new chat session
      if (global.io) {
        global.io.to('admin-dashboard').emit('new-chat-session', {
          chatId: session.chatId,
          customerName: session.customer.name,
          customerEmail: session.customer.email,
          status: session.status,
          timestamp: session.createdAt
        });
        
      }
    } else {
      
      
      // Update session to ensure it's active
      session = await ChatSession.findByIdAndUpdate(
        session._id,
        { 
          status: session.status === 'closed' ? 'waiting' : session.status,
          'lastMessage.timestamp': new Date()
        },
        { new: true }
      );
     
    }
    
   

    // Final check: ensure no other active sessions exist for this user
    const finalCheck = await ChatSession.countDocuments({
      'customer.user': req.user ? req.user.id : null,
      'customer.email': !req.user ? customerInfo.email : undefined,
      status: { $in: ['active', 'waiting'] },
      _id: { $ne: session._id }
    });
    
    if (finalCheck > 0) {
    
    }

    // Return the session with chatId for frontend compatibility
    res.status(201).json({
      success: true,
      message: 'Chat session started',
      data: {
        chatSession: {
          id: session.chatId,
          chatId: session.chatId,
          status: session.status,
          category: session.category,
          customer: session.customer,
          createdAt: session.createdAt,
          isActive: session.status === 'active' || session.status === 'waiting',
          adminAssigned: session.assignedAdmin ? {
            id: session.assignedAdmin,
            name: 'Support Team'
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Start chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get chat session
const getChatSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({ chatId: req.params.chatId })
      .populate('assignedAdmin', 'name');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get chat messages
const getChatMessages = async (req, res) => {
  try {
    

    const { page = 1, limit = 50 } = req.query;

    const messages = await ChatMessage.find({ 
      chatId: req.params.chatId,
      isDeleted: false 
    })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 }) // Changed to ascending order (oldest first)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    
    
    

    // Transform messages to match frontend interface
    const transformedMessages = messages.map(msg => ({
      id: msg._id.toString(),
      senderId: msg.sender ? msg.sender._id.toString() : 'guest',
      senderName: msg.senderInfo?.name || 'Unknown',
      senderType: msg.isFromAdmin ? 'admin' : 'user',
      message: msg.message || '',
      messageType: msg.messageType || 'text',
      attachments: msg.attachments || [],
      timestamp: msg.createdAt,
      isRead: msg.isRead
    }));

   

    res.json({
      success: true,
      data: {
        messages: transformedMessages
      }
    });
  } catch (error) {
    console.error('❌ Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    

    const { chatId, message } = req.body;

    if (!chatId || (!message && !req.file)) {
      return res.status(400).json({
        success: false,
        message: 'ChatId and either message or file attachment are required'
      });
    }

    // Find the chat session to get sender info
    const session = await ChatSession.findOne({ chatId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    const messageData = {
      chatId,
      sender: req.user ? req.user.id : null,
      senderInfo: {
        name: req.user ? req.user.name : session.customer.name,
        email: req.user ? req.user.email : session.customer.email,
        phone: req.user ? req.user.phone : session.customer.phone,
        isGuest: !req.user
      },
      message: message || '', // Allow empty message if there's a file
      isFromAdmin: false,
      messageType: 'text' // Default to text
    };

    // Handle file attachment
    if (req.file && req.file.path) {
      
      messageData.messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
      messageData.attachments = [{
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
        public_id: req.file.filename,
        url: req.file.path,
        filename: req.file.originalname,
        size: req.file.size
      }];
      
      // If no text message, set a default message
      if (!message || message.trim() === '') {
        messageData.message = `Sent ${messageData.messageType === 'image' ? 'an image' : 'a file'}: ${req.file.originalname}`;
      }
    }

    

        const chatMessage = await ChatMessage.create(messageData);
    

    // Update session with last message and activate if waiting
    const updateData = {
      'lastMessage.content': chatMessage.message,
      'lastMessage.timestamp': new Date(),
      'lastMessage.isFromAdmin': false,
      $inc: { 'unreadCount.admin': 1 }
    };

    // If session is waiting, activate it when user sends a message
    if (session.status === 'waiting') {
      updateData.status = 'active';
    }

    const updatedSession = await ChatSession.findOneAndUpdate(
      { chatId },
      updateData,
      { new: true }
    );
    

    // If status changed from waiting to active, emit status change
    if (session.status === 'waiting' && updatedSession.status === 'active') {
      if (global.io) {
        global.io.to('admin-dashboard').emit('chat-status-changed', {
          chatId: updatedSession.chatId,
          status: 'active',
          adminName: null
        });
        
      }
    }

    // Transform message for frontend
    const transformedMessage = {
      id: chatMessage._id.toString(),
      chatId: chatMessage.chatId,
      senderId: chatMessage.sender ? chatMessage.sender.toString() : 'guest',
      senderName: chatMessage.senderInfo.name,
      senderType: 'user',
      message: chatMessage.message,
      messageType: chatMessage.messageType || 'text',
      attachments: chatMessage.attachments || [],
      timestamp: chatMessage.createdAt,
      isRead: chatMessage.isRead
    };

    // Emit to admin dashboard and specific chat room via Socket.IO
    if (global.io) {
      // Notify admin dashboard (for sidebar updates)
      global.io.to('admin-dashboard').emit('new-customer-message', {
        chatId: chatMessage.chatId,
        message: chatMessage.message,
        senderName: chatMessage.senderInfo.name,
        timestamp: chatMessage.createdAt
      });

      // Send to specific chat room (for real-time messages in chat view)
      global.io.to(chatMessage.chatId).emit('receive-message', transformedMessage);
      
    }

    

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        chatMessage: transformedMessage
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all chat sessions (for admin)
const getChatSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status) query.status = status;

    const sessions = await ChatSession.find(query)
      .populate('assignedAdmin', 'name')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ChatSession.countDocuments(query);

    res.json({
      success: true,
      count: sessions.length,
      total,
      sessions
    });
  } catch (error) {
    console.error('Get chat sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Mark message as read
const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    await ChatMessage.findByIdAndUpdate(messageId, {
      isRead: true,
      readAt: new Date()
    });

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// End chat session
const endChatSession = async (req, res) => {
  try {
    const { chatId } = req.params;

    const session = await ChatSession.findOneAndUpdate(
      { chatId },
      { 
        status: 'closed',
        endedAt: new Date()
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat session ended',
      session
    });
  } catch (error) {
    console.error('End chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get admin chat sessions
const getAdminChatSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status) query.status = status;

    const sessions = await ChatSession.find(query)
      .populate('assignedAdmin', 'name')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ChatSession.countDocuments(query);

    res.json({
      success: true,
      count: sessions.length,
      total,
      sessions
    });
  } catch (error) {
    console.error('Get admin chat sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get admin chat session
const getAdminChatSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({ chatId: req.params.chatId })
      .populate('assignedAdmin', 'name avatar')
      .populate('customer.user', 'name email avatar');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get admin chat session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Assign chat to admin
const assignChatToAdmin = async (req, res) => {
  try {
    const session = await ChatSession.findOneAndUpdate(
      { chatId: req.params.chatId },
      {
        assignedAdmin: req.user.id,
        status: 'active'
      },
      { new: true }
    ).populate('assignedAdmin', 'name');

    res.json({
      success: true,
      message: 'Chat assigned successfully',
      session
    });
  } catch (error) {
    console.error('Assign chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update chat status
const updateChatStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const session = await ChatSession.findOneAndUpdate(
      { chatId: req.params.chatId },
      { status },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Chat status updated successfully',
      session
    });
  } catch (error) {
    console.error('Update chat status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Send admin message
const sendAdminMessage = async (req, res) => {
  try {
    

    const { chatId, message } = req.body;

    const messageData = {
      chatId,
      sender: req.user.id,
      senderInfo: {
        name: req.user.name,
        email: req.user.email,
        isGuest: false
      },
      message,
      isFromAdmin: true,
      messageType: 'text'
    };

    const chatMessage = await ChatMessage.create(messageData);
    

    // Update session
    await ChatSession.findOneAndUpdate(
      { chatId },
      {
        'lastMessage.content': message,
        'lastMessage.timestamp': new Date(),
        'lastMessage.isFromAdmin': true,
        $inc: { 'unreadCount.customer': 1 }
      }
    );

    // Transform message for frontend
    const transformedMessage = {
      id: chatMessage._id.toString(),
      chatId: chatMessage.chatId,
      senderId: chatMessage.sender.toString(),
      senderName: chatMessage.senderInfo.name,
      senderType: 'admin',
      message: chatMessage.message,
      messageType: chatMessage.messageType || 'text',
      attachments: chatMessage.attachments || [],
      timestamp: chatMessage.createdAt,
      isRead: chatMessage.isRead
    };

    // Emit to customer via Socket.IO
    if (global.io) {
      global.io.to(chatId).emit('receive-message', transformedMessage);
      
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      chatMessage: transformedMessage
    });
  } catch (error) {
    console.error('Send admin message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Cleanup duplicate sessions (can be called via admin endpoint)
const cleanupDuplicateSessions = async (req, res) => {
  try {
    
    
    // Find all users with multiple active/waiting sessions
    const duplicates = await ChatSession.aggregate([
      {
        $match: {
          status: { $in: ['active', 'waiting'] }
        }
      },
      {
        $group: {
          _id: {
            userId: '$customer.user',
            email: '$customer.email',
            isGuest: '$customer.isGuest'
          },
          sessions: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    let closedCount = 0;

    for (const duplicate of duplicates) {
      const { sessions } = duplicate;
      // Keep the latest session, close the rest
      const sessionsToClose = sessions.slice(0, -1);
      
      await ChatSession.updateMany(
        { _id: { $in: sessionsToClose } },
        { 
          status: 'closed', 
          endedAt: new Date(),
          note: 'Closed during duplicate cleanup'
        }
      );
      
      closedCount += sessionsToClose.length;
    }

    

    res.json({
      success: true,
      message: `Cleaned up ${closedCount} duplicate sessions`,
      duplicatesFound: duplicates.length,
      sessionsClosed: closedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  startChatSession,
  getChatSession,
  getChatMessages,
  sendMessage,
  getChatSessions,
  markMessageAsRead,
  endChatSession,
  getAdminChatSessions,
  getAdminChatSession,
  assignChatToAdmin,
  updateChatStatus,
  sendAdminMessage,
  cleanupDuplicateSessions
}; 