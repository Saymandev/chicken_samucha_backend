const os = require('os');
const mongoose = require('mongoose');

class ServerMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastHealthCheck = Date.now();
  }

  logServerStats() {
    const uptime = (Date.now() - this.startTime) / 1000;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    console.log('📊 === SERVER HEALTH CHECK ===');
    console.log(`⏱️  Uptime: ${Math.floor(uptime / 60)} minutes`);
    console.log(`🔢 Total Requests: ${this.requestCount}`);
    console.log(`❌ Total Errors: ${this.errorCount}`);
    console.log(`💾 Memory Usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`🖥️  CPU Usage: ${Math.round(cpuUsage.user / 1000)}ms user, ${Math.round(cpuUsage.system / 1000)}ms system`);
    console.log(`🗄️  MongoDB Connection: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`🌐 Active Handles: ${process._getActiveHandles()?.length || 0}`);
    console.log(`⚡ Active Requests: ${process._getActiveRequests()?.length || 0}`);
    console.log('===============================\n');
    
    this.lastHealthCheck = Date.now();
  }

  incrementRequestCount() {
    this.requestCount++;
  }

  incrementErrorCount() {
    this.errorCount++;
  }

  startMonitoring() {
    // Log stats every 5 minutes
    setInterval(() => {
      this.logServerStats();
    }, 5 * 60 * 1000);

    // Check for memory leaks every 10 minutes
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB > 500) {
        console.warn(`⚠️  HIGH MEMORY USAGE: ${heapUsedMB}MB`);
        
        if (global.gc) {
          
          global.gc();
        }
      }
    }, 10 * 60 * 1000);

   
  }

  middleware() {
    return (req, res, next) => {
      this.incrementRequestCount();
      
      // Log slow requests
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (duration > 5000) { // Log requests taking more than 5 seconds
          console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms`);
        }
      });

      next();
    };
  }

  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      memoryUsage: process.memoryUsage(),
      mongoConnection: mongoose.connection.readyState === 1,
      lastHealthCheck: this.lastHealthCheck
    };
  }
}

module.exports = new ServerMonitor(); 