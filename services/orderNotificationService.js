// Shared service for order notifications
// Handles both Socket.IO and email notifications for order status updates

const emailService = require('./emailService');

class OrderNotificationService {
  
  // Send notifications for order status updates
  static async sendOrderStatusNotifications(updatedOrder, status, req) {
    try {
      
      
      // Define status-specific messages
      const statusMessages = {
        'confirmed': 'Your order has been confirmed and is being prepared.',
        'preparing': 'Your order is being prepared by our kitchen.',
        'ready': 'Your order is ready for pickup/delivery.',
        'out_for_delivery': 'Your order is out for delivery and will arrive soon.',
        'delivered': 'Your order has been delivered successfully!',
        'cancelled': 'Your order has been cancelled.'
      };

      const statusTitles = {
        'confirmed': 'Order Confirmed',
        'preparing': 'Order Being Prepared',
        'ready': 'Order Ready',
        'out_for_delivery': 'Out for Delivery',
        'delivered': 'Order Delivered',
        'cancelled': 'Order Cancelled'
      };

      const title = statusTitles[status] || 'Order Status Updated';
      const orderNumber = updatedOrder.orderNumber || updatedOrder._id.toString().slice(-6);
      const message = statusMessages[status] || `Your order ${orderNumber} is now ${status.replace('_', ' ')}`;
      const priority = status === 'delivered' || status === 'cancelled' ? 'high' : 'medium';

      // 1. Create database notification
      await this.createDatabaseNotification(updatedOrder, title, message, priority, status, orderNumber);

      // 2. Send Socket.IO notification
      await this.sendSocketNotification(updatedOrder, title, message, priority, status, orderNumber, req);

      // 3. Send email notification ONLY for delivered status
      if (status === 'delivered') {
        await this.sendEmailNotification(updatedOrder, status, orderNumber);
      }

      
      
    } catch (error) {
      console.error('❌ Error in order notification service:', error);
    }
  }

  // Create database notification
  static async createDatabaseNotification(updatedOrder, title, message, priority, status, orderNumber) {
    try {
      const Notification = require('../models/Notification');
      if (updatedOrder.user) {
        await Notification.createNotification({
          type: 'order',
          title: title,
          message: message,
          priority: priority,
          userId: updatedOrder.user,
          orderId: updatedOrder._id,
          metadata: {
            orderNumber: orderNumber,
            newStatus: status
          }
        });
        
      }
    } catch (error) {
      console.error('❌ Error creating database notification:', error);
    }
  }

  // Send Socket.IO notification
  static async sendSocketNotification(updatedOrder, title, message, priority, status, orderNumber, req) {
    try {
      if (updatedOrder.user && req.io) {
        
        
        // Check if the room exists
        const room = req.io.sockets.adapter.rooms.get(`user-${updatedOrder.user}`);
        
        
        req.io.to(`user-${updatedOrder.user}`).emit('new-user-notification', {
          id: `order-${Date.now()}`,
          type: 'order',
          title: title,
          message: message,
          read: false,
          timestamp: new Date(),
          priority: priority,
          orderId: updatedOrder._id,
          metadata: {
            orderNumber: orderNumber,
            newStatus: status
          }
        });
        
      } else {
        
      }
    } catch (error) {
      console.error('❌ Error sending Socket.IO notification:', error);
    }
  }

  // Send email notification (only for delivered status)
  static async sendEmailNotification(updatedOrder, status, orderNumber) {
    try {
      const User = require('../models/User');
      
      // Get user email if user is logged in
      if (updatedOrder.user) {
        const user = await User.findById(updatedOrder.user).select('email name');
        
        if (user && user.email) {
          
          
          await emailService.sendOrderStatusUpdateEmail(
            user.email, 
            user.name, 
            {
              orderNumber: orderNumber,
              status: status,
              estimatedDeliveryTime: updatedOrder.estimatedDeliveryTime,
              items: updatedOrder.items,
              totalAmount: updatedOrder.finalAmount
            }
          );
         
        }
      } else if (updatedOrder.customer && updatedOrder.customer.email) {
        
        
        await emailService.sendOrderStatusUpdateEmail(
          updatedOrder.customer.email,
          updatedOrder.customer.name,
          {
            orderNumber: updatedOrder.orderNumber,
            status: status,
            estimatedDeliveryTime: updatedOrder.estimatedDeliveryTime,
            items: updatedOrder.items,
            totalAmount: updatedOrder.finalAmount
          }
        );
        
      } else {
        
      }
    } catch (error) {
      console.error('❌ Error sending delivery email:', error);
    }
  }
}

module.exports = OrderNotificationService;
