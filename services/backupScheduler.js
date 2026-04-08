const megaBackup = require('./megaBackup');
const cron = require('node-cron');

class BackupScheduler {
  constructor() {
    this.isRunning = false;
    this.lastBackup = null;
    this.lastBackupStatus = null;
    this.schedule = '0 2 * * *'; // Daily at 2 AM
    this.backupHistory = [];
  }

  // Start the scheduler
  start() {
    console.log('='.repeat(50));
    console.log('⏰ Starting Backup Scheduler');
    console.log('='.repeat(50));
    console.log(`📅 Schedule: ${this.schedule} (Daily at 2:00 AM)`);
    console.log(`☁️  Backup Target: MEGA (${megaBackup.email})`);
    console.log(`📁 Remote Path: ${megaBackup.remotePath}`);
    console.log(`💾 Max Backups: ${megaBackup.maxBackups}`);
    console.log('='.repeat(50));

    // Test MEGA connection on startup
    this.testMEGAConnection();

    // Run initial backup after 2 minutes
    setTimeout(() => {
      console.log('\n🔄 Running initial backup...');
      this.runBackup();
    }, 120000);

    // Schedule regular backups
    cron.schedule(this.schedule, () => {
      console.log('\n⏰ Scheduled backup triggered');
      this.runBackup();
    });

    // Check backup status every hour
    setInterval(() => {
      this.checkBackupStatus();
    }, 3600000);
  }

  // Test MEGA connection
  async testMEGAConnection() {
    console.log('\n🔍 Testing MEGA connection...');
    const result = await megaBackup.testConnection();
    
    if (result.success) {
      console.log('✅ MEGA connection successful');
      console.log(`   Account: ${result.account}`);
      
      const storage = await megaBackup.getStorageInfo();
      if (storage) {
        console.log(`   Storage: ${storage.usedFormatted} / ${storage.totalFormatted} (${storage.percentUsed})`);
      }
    } else {
      console.error('❌ MEGA connection failed:', result.message);
      console.log('⚠️  Please check your MEGA credentials in megaBackup.js');
    }
    console.log('='.repeat(50));
  }

  // Run backup
  async runBackup() {
    if (this.isRunning) {
      console.log('⚠️ Backup already in progress, skipping...');
      return {
        success: false,
        message: 'Backup already in progress',
        isRunning: true
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('\n' + '🔄'.repeat(20));
      console.log('🚀 Starting scheduled backup...');
      console.log('🔄'.repeat(20));

      const result = await megaBackup.createAndUploadBackup();
      
      const duration = (Date.now() - startTime) / 1000;
      
      if (result.success) {
        this.lastBackup = result.timestamp;
        this.lastBackupStatus = 'success';
        
        this.backupHistory.unshift({
          timestamp: result.timestamp,
          filename: result.filename,
          size: result.size,
          duration: duration,
          status: 'success',
          date: new Date().toISOString()
        });

        console.log('\n✅'.repeat(10));
        console.log(`✅ Backup completed successfully!`);
        console.log(`   File: ${result.filename}`);
        console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Duration: ${duration.toFixed(1)} seconds`);
        console.log(`   Location: ${result.remotePath}`);
        console.log('✅'.repeat(10));

        if (this.backupHistory.length > 20) {
          this.backupHistory.pop();
        }

        return {
          success: true,
          ...result,
          duration
        };
      } else {
        this.lastBackupStatus = 'failed';
        
        this.backupHistory.unshift({
          timestamp: result.timestamp,
          error: result.error,
          status: 'failed',
          date: new Date().toISOString()
        });

        console.error('\n❌ Backup failed:', result.error);
        
        return {
          success: false,
          error: result.error,
          timestamp: result.timestamp
        };
      }
    } catch (error) {
      console.error('❌ Unexpected backup error:', error);
      this.lastBackupStatus = 'failed';
      
      this.backupHistory.unshift({
        error: error.message,
        status: 'failed',
        date: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  // Check backup status
  async checkBackupStatus() {
    const lastBackupTime = this.lastBackup ? new Date(this.lastBackup) : null;
    const now = new Date();
    
    if (lastBackupTime) {
      const hoursSinceLastBackup = (now - lastBackupTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastBackup > 30) {
        console.log(`⚠️ Warning: Last backup was ${hoursSinceLastBackup.toFixed(1)} hours ago`);
      } else {
        console.log(`ℹ️ Last backup: ${lastBackupTime.toLocaleString()} (${hoursSinceLastBackup.toFixed(1)} hours ago)`);
      }
    } else {
      console.log('ℹ️ No backups have been run yet');
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastBackup: this.lastBackup,
      lastBackupStatus: this.lastBackupStatus,
      schedule: this.schedule,
      history: this.backupHistory.slice(0, 10),
      megaStatus: {
        email: megaBackup.email.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
        remotePath: megaBackup.remotePath,
        maxBackups: megaBackup.maxBackups
      }
    };
  }

  // Get backup history
  getHistory(limit = 10) {
    return this.backupHistory.slice(0, limit);
  }

  // Clear history
  clearHistory() {
    this.backupHistory = [];
    console.log('🧹 Backup history cleared');
  }

  // Force run backup
  async forceBackup() {
    console.log('👤 Manual backup triggered');
    return await this.runBackup();
  }
}

module.exports = new BackupScheduler();