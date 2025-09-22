let cron;
try {
  cron = require('node-cron');
} catch (error) {
  console.error('node-cron not installed. Scheduler service will not be available.');
  cron = null;
}

const emailReportService = require('./emailReportService');
const User = require('../models/User');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  async start() {
    if (!cron) {
     
      return;
    }

    if (this.isRunning) {
     
      return;
    }

    try {
      
      this.isRunning = true;

      // Daily report at 9:00 AM
      this.scheduleDailyReport();
      
      // Weekly report every Monday at 10:00 AM
      this.scheduleWeeklyReport();
      
      // Monthly report on 1st of every month at 11:00 AM
      this.scheduleMonthlyReport();

      // Campaign dispatcher every 5 minutes
      this.scheduleCampaignDispatcher();

     
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      this.isRunning = false;
      throw error;
    }
  }

  stop() {
    try {
      if (!cron) {
        throw new Error('node-cron not available. Cannot stop scheduler.');
      }

      if (!this.isRunning) {
        
        return;
      }

      if (this.jobs.size === 0) {
        
        this.isRunning = false;
        return;
      }

      this.jobs.forEach((job, name) => {
        try {
          if (job && typeof job.destroy === 'function') {
            job.destroy();
          
          } else {
            console.warn(`Job ${name} is not a valid cron job`);
          }
        } catch (jobError) {
          console.error(`Error stopping job ${name}:`, jobError);
        }
      });
      
      this.jobs.clear();
      this.isRunning = false;
     
    } catch (error) {
      console.error('Error stopping scheduler:', error);
      throw error;
    }
  }

  scheduleDailyReport() {
    if (!cron) {
      console.error('node-cron not available. Cannot schedule daily report.');
      return;
    }
    
    try {
      const job = cron.schedule('0 9 * * *', async () => {
        try {
         
          const adminEmails = await this.getAdminEmails();
          
          if (adminEmails.length > 0) {
            await emailReportService.sendDailyReport(adminEmails);
          
          } else {
            
          }
        } catch (error) {
         
        }
      }, {
        scheduled: false,
        timezone: "Asia/Dhaka"
      });

      if (!job) {
        throw new Error('Failed to create daily report cron job');
      }

      this.jobs.set('daily', job);
      job.start();
     
    } catch (error) {
      console.error('Error scheduling daily report:', error);
      throw error;
    }
  }

  scheduleWeeklyReport() {
    if (!cron) return;
    
    const job = cron.schedule('0 10 * * 1', async () => {
      try {
        
        const adminEmails = await this.getAdminEmails();
        
        if (adminEmails.length > 0) {
          await emailReportService.sendWeeklyReport(adminEmails);
         
        } else {
        
        }
      } catch (error) {
        console.error('Failed to send weekly report:', error);
      }
    }, {
      scheduled: false,
      timezone: "Asia/Dhaka"
    });

    this.jobs.set('weekly', job);
    job.start();
   
  }

  scheduleMonthlyReport() {
    if (!cron) return;
    
    const job = cron.schedule('0 11 1 * *', async () => {
      try {
       
        const adminEmails = await this.getAdminEmails();
        
        if (adminEmails.length > 0) {
          await emailReportService.sendMonthlyReport(adminEmails);
         
        } else {
          
        }
      } catch (error) {
        console.error('Failed to send monthly report:', error);
      }
    }, {
      scheduled: false,
      timezone: "Asia/Dhaka"
    });

    this.jobs.set('monthly', job);
    job.start();
   
  }

  scheduleCampaignDispatcher() {
    if (!cron) return;
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        const Campaign = require('../models/Campaign');
        const now = new Date();
        const due = await Campaign.find({ status: 'scheduled', scheduledFor: { $lte: now } }).limit(5);
        const controller = require('../controllers/campaignController');
        for (const c of due) {
          try {
            // mimic req/res minimal to reuse sendNow
            await controller.sendNow({ params: { id: c._id.toString() } }, { status: () => ({ json: () => {} }) });
          } catch (e) {
            c.status = 'failed';
            await c.save();
          }
        }
      } catch (e) {
        
      }
    }, { scheduled: false, timezone: 'Asia/Dhaka' });
    this.jobs.set('campaign-dispatcher', job);
    job.start();
  }

  async getAdminEmails() {
    try {
      const admins = await User.find({ role: 'admin' }).select('email');
      return admins.map(admin => admin.email).filter(email => email);
    } catch (error) {
      console.error('Failed to fetch admin emails:', error);
      return [];
    }
  }

  // Manual report sending methods
  async sendDailyReportNow(recipients) {
    try {
      if (!emailReportService.transporter) {
        throw new Error('Email service not initialized. Please check your email credentials.');
      }
      await emailReportService.sendDailyReport(recipients);
    
    } catch (error) {
      console.error('Failed to send daily report manually:', error);
      throw error;
    }
  }

  async sendWeeklyReportNow(recipients) {
    try {
      if (!emailReportService.transporter) {
        throw new Error('Email service not initialized. Please check your email credentials.');
      }
      await emailReportService.sendWeeklyReport(recipients);
    
    } catch (error) {
      console.error('Failed to send weekly report manually:', error);
      throw error;
    }
  }

  async sendMonthlyReportNow(recipients) {
    try {
      if (!emailReportService.transporter) {
        throw new Error('Email service not initialized. Please check your email credentials.');
      }
      await emailReportService.sendMonthlyReport(recipients);
    
    } catch (error) {
      console.error('Failed to send monthly report manually:', error);
      throw error;
    }
  }

  // Get scheduler status
  getStatus() {
    try {
      const status = {
        isRunning: this.isRunning,
        jobs: {}
      };

      this.jobs.forEach((job, name) => {
        try {
          status.jobs[name] = {
            running: job.running || false,
            // node-cron doesn't have nextDate/lastDate methods
            // We'll just show if the job is running
            status: job.running ? 'active' : 'inactive'
          };
        } catch (jobError) {
          console.error(`Error getting status for job ${name}:`, jobError);
          status.jobs[name] = {
            running: false,
            status: 'error',
            error: jobError.message
          };
        }
      });

      return status;
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return {
        isRunning: false,
        jobs: {},
        error: error.message
      };
    }
  }

  // Update schedule times
  updateSchedule(jobName, cronExpression) {
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName).destroy();
      this.jobs.delete(jobName);
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        const adminEmails = await this.getAdminEmails();
        
        if (adminEmails.length > 0) {
          switch (jobName) {
            case 'daily':
              await emailReportService.sendDailyReport(adminEmails);
              break;
            case 'weekly':
              await emailReportService.sendWeeklyReport(adminEmails);
              break;
            case 'monthly':
              await emailReportService.sendMonthlyReport(adminEmails);
              break;
          }
       
        }
      } catch (error) {
        console.error(`Failed to send ${jobName} report:`, error);
      }
    }, {
      scheduled: false,
      timezone: "Asia/Dhaka"
    });

    this.jobs.set(jobName, job);
    job.start();
    
  }
}

module.exports = new SchedulerService();
