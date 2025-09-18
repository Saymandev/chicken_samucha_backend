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
      console.log('node-cron not available. Scheduler cannot start.');
      return;
    }

    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    try {
      console.log('Starting automated report scheduler...');
      this.isRunning = true;

      // Daily report at 9:00 AM
      this.scheduleDailyReport();
      
      // Weekly report every Monday at 10:00 AM
      this.scheduleWeeklyReport();
      
      // Monthly report on 1st of every month at 11:00 AM
      this.scheduleMonthlyReport();

      console.log('Scheduler started successfully');
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
        console.log('Scheduler is not running. Nothing to stop.');
        return;
      }

      if (this.jobs.size === 0) {
        console.log('No jobs to stop.');
        this.isRunning = false;
        return;
      }

      this.jobs.forEach((job, name) => {
        try {
          if (job && typeof job.destroy === 'function') {
            job.destroy();
            console.log(`Stopped job: ${name}`);
          } else {
            console.warn(`Job ${name} is not a valid cron job`);
          }
        } catch (jobError) {
          console.error(`Error stopping job ${name}:`, jobError);
        }
      });
      
      this.jobs.clear();
      this.isRunning = false;
      console.log('Scheduler stopped successfully');
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
          console.log('Generating daily report...');
          const adminEmails = await this.getAdminEmails();
          
          if (adminEmails.length > 0) {
            await emailReportService.sendDailyReport(adminEmails);
            console.log('Daily report sent successfully');
          } else {
            console.log('No admin emails found for daily report');
          }
        } catch (error) {
          console.error('Failed to send daily report:', error);
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
      console.log('Daily report scheduled for 9:00 AM (Asia/Dhaka timezone)');
    } catch (error) {
      console.error('Error scheduling daily report:', error);
      throw error;
    }
  }

  scheduleWeeklyReport() {
    if (!cron) return;
    
    const job = cron.schedule('0 10 * * 1', async () => {
      try {
        console.log('Generating weekly report...');
        const adminEmails = await this.getAdminEmails();
        
        if (adminEmails.length > 0) {
          await emailReportService.sendWeeklyReport(adminEmails);
          console.log('Weekly report sent successfully');
        } else {
          console.log('No admin emails found for weekly report');
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
    console.log('Weekly report scheduled for Monday 10:00 AM (Asia/Dhaka timezone)');
  }

  scheduleMonthlyReport() {
    if (!cron) return;
    
    const job = cron.schedule('0 11 1 * *', async () => {
      try {
        console.log('Generating monthly report...');
        const adminEmails = await this.getAdminEmails();
        
        if (adminEmails.length > 0) {
          await emailReportService.sendMonthlyReport(adminEmails);
          console.log('Monthly report sent successfully');
        } else {
          console.log('No admin emails found for monthly report');
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
    console.log('Monthly report scheduled for 1st of every month 11:00 AM (Asia/Dhaka timezone)');
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
      console.log('Daily report sent manually');
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
      console.log('Weekly report sent manually');
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
      console.log('Monthly report sent manually');
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
          console.log(`${jobName} report sent successfully`);
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
    console.log(`${jobName} report rescheduled`);
  }
}

module.exports = new SchedulerService();
