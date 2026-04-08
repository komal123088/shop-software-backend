const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { sequelize } = require('../models'); // Import Sequelize instance
const cron = require('node-cron');
const execPromise = util.promisify(exec);

class MEGABackup {
  constructor() {
    this.email = 'Agmuhammad949@gmail.com';
    this.password = "AsIm@@03214600483.";
    this.remotePath = '/Backups';
    this.maxBackups = 10;
    this.schedule = '0 2 * * *';
    this.isRunning = false;
    this.lastBackup = null;
    this.lastBackupFile = null;
    this.backupHistory = [];
    
    // Set the correct path to MEGAcmd
    this.megaCmdPath = 'C:\\Users\\mahar\\AppData\\Local\\MEGAcmd';
    this.cmdExtension = this.detectCommandExtension();
    
    console.log(`🔧 MEGAcmd path set to: ${this.megaCmdPath}`);
    console.log(`🔧 Command extension: ${this.cmdExtension}`);
  }

  // Detect which command extension to use (.bat, .cmd, or no extension)
  detectCommandExtension() {
    const possibleExtensions = ['.cmd', '.bat', ''];
    
    for (const ext of possibleExtensions) {
      const testFile = path.join(this.megaCmdPath, `mega-whoami${ext}`);
      if (fs.existsSync(testFile)) {
        console.log(`✅ Found MEGAcmd commands with extension: ${ext || 'no extension'}`);
        return ext;
      }
    }
    
    console.warn('⚠️ Could not find MEGAcmd commands, will try without extension');
    return '';
  }

  // Helper to run mega commands
  async runMegaCommand(command, args) {
    const possibleCommands = [
      path.join(this.megaCmdPath, `mega-${command}${this.cmdExtension}`),
      path.join(this.megaCmdPath, `mega-${command}.cmd`),
      path.join(this.megaCmdPath, `mega-${command}.bat`),
      `mega-${command}`
    ];
    
    let lastError = null;
    
    for (const cmdPath of possibleCommands) {
      try {
        const cmd = cmdPath.includes('\\') ? `"${cmdPath}" ${args}` : `${cmdPath} ${args}`;
        console.log(`   Trying: ${cmd}`);
        
        const { stdout, stderr } = await execPromise(cmd, {
          shell: 'cmd.exe',
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });
        
        return { success: true, stdout, stderr, command: cmd };
      } catch (error) {
        lastError = error;
      }
    }
    
    console.error(`❌ All attempts failed for mega-${command}`);
    return { success: false, error: lastError };
  }

  // Login to MEGA
  async login() {
    try {
      const whoami = await this.runMegaCommand('whoami', '');
      if (whoami.success && whoami.stdout.includes(this.email)) {
        console.log('✅ Already logged in to MEGA');
        return true;
      }
      
      console.log('🔑 Logging in to MEGA...');
      const loginArgs = `"${this.email}" "${this.password}"`;
      const result = await this.runMegaCommand('login', loginArgs);
      
      if (result.success) {
        console.log('✅ MEGA login successful');
        return true;
      } else {
        throw new Error(result.error?.message || 'Login failed');
      }
    } catch (error) {
      console.error('❌ MEGA login failed:', error.message);
      return false;
    }
  }

  // Logout from MEGA
  async logout() {
    try {
      await this.runMegaCommand('logout', '');
      console.log('✅ MEGA logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Ensure remote directory exists
  async ensureRemoteDirectory() {
    try {
      await this.runMegaCommand('mkdir', `-p "${this.remotePath}"`);
      console.log(`✅ Ensured remote directory: ${this.remotePath}`);
    } catch (error) {
      console.error('Failed to create remote directory:', error);
    }
  }

  // Get MySQL database backup as JSON
  async getMySQLBackup() {
    try {
      console.log('   🔍 Fetching MySQL data...');
      
      // Get all tables
      const tables = await sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
        {
          replacements: [process.env.DB_NAME || 'shop_management'],
          type: sequelize.QueryTypes.SELECT
        }
      );

      console.log(`   Found ${tables.length} tables`);
      
      const backupData = {};
      let totalRows = 0;

      for (const table of tables) {
        const tableName = table.table_name || table.TABLE_NAME;
        console.log(`   📊 Backing up: ${tableName}`);
        
        const rows = await sequelize.query(
          `SELECT * FROM \`${tableName}\``,
          { type: sequelize.QueryTypes.SELECT }
        );
        
        backupData[tableName] = rows;
        totalRows += rows.length;
        console.log(`     ${rows.length} rows`);
      }

      backupData._metadata = {
        timestamp: new Date().toISOString(),
        tables: tables.map(t => t.table_name || t.TABLE_NAME),
        totalRows: totalRows,
        database: process.env.DB_NAME || 'shop_management'
      };

      console.log(`   ✅ Total: ${totalRows} rows from ${tables.length} tables`);
      return backupData;

    } catch (error) {
      console.error('   ❌ MySQL backup error:', error);
      throw error;
    }
  }

  // Create backup file
  async createBackupFile(outputPath, timestamp) {
    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { 
        zlib: { level: 6 },
        store: false
      });

      output.on('close', () => {
        console.log(`   Archive closed: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      });

      archive.on('error', (err) => {
        console.error('   Archive error:', err);
        reject(err);
      });

      archive.pipe(output);

      // DATABASE BACKUP - MySQL
      console.log('   💾 Backing up MySQL database...');
      try {
        const dbData = await this.getMySQLBackup();
        const dbJson = JSON.stringify(dbData, null, 2);
        archive.append(dbJson, { name: `database/backup-${timestamp}.json` });
        console.log(`   ✅ MySQL backup: ${(dbJson.length / 1024 / 1024).toFixed(2)} MB`);
      } catch (dbError) {
        console.error('   ❌ MySQL backup failed:', dbError);
        archive.append(JSON.stringify({ error: dbError.message }, null, 2), { name: 'database/error.json' });
      }

      // Add uploads folder
      const uploadsDir = path.join(__dirname, '../uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.log(`   📁 Adding ${files.length} files from uploads`);
        
        let uploadsSize = 0;
        files.forEach(file => {
          const filePath = path.join(uploadsDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            archive.file(filePath, { name: `uploads/${file}` });
            uploadsSize += stat.size;
          }
        });
        console.log(`   ✅ Uploads folder: ${files.length} files, ${(uploadsSize / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.log('   ⚠️ Uploads folder not found');
      }

      // Add metadata
      const metadata = {
        timestamp,
        database: 'mysql',
        databaseName: process.env.DB_NAME || 'shop_management',
        fileCount: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0,
        version: '2.0',
        createdAt: new Date().toISOString(),
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform
        }
      };
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      console.log('   📦 Finalizing archive...');
      await archive.finalize();
    });
  }

  // Create and upload backup
  async createAndUploadBackup() {
    if (this.isRunning) {
      console.log('⚠️ Backup already in progress');
      return { 
        success: false, 
        message: 'Backup already running',
        isRunning: true 
      };
    }

    this.isRunning = true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempDir = path.join(__dirname, '../temp-backups');
    const backupFilename = `backup-${timestamp}.zip`;
    const backupPath = path.join(tempDir, backupFilename);

    try {
      console.log('='.repeat(50));
      console.log(`📦 Starting MEGA backup: ${timestamp}`);
      console.log('='.repeat(50));

      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`✅ Created temp directory: ${tempDir}`);
      }

      // Create backup file
      console.log('\n📁 Creating backup archive...');
      const startTime = Date.now();
      await this.createBackupFile(backupPath, timestamp);
      const backupTime = (Date.now() - startTime) / 1000;
      
      const stats = fs.statSync(backupPath);
      console.log(`✅ Backup created in ${backupTime.toFixed(1)}s`);
      console.log(`📦 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Login to MEGA
      console.log('\n🔑 Connecting to MEGA...');
      const loggedIn = await this.login();
      if (!loggedIn) {
        throw new Error('Failed to login to MEGA');
      }

      // Ensure remote directory exists
      await this.ensureRemoteDirectory();

      // Upload to MEGA
      console.log('\n☁️ Uploading to MEGA...');
      const uploadStart = Date.now();
      const remoteFile = `${this.remotePath}/${backupFilename}`;
      
      const uploadResult = await this.runMegaCommand('put', `"${backupPath}" "${remoteFile}"`);
      
      if (!uploadResult.success) {
        throw new Error('Upload failed');
      }

      const uploadTime = (Date.now() - uploadStart) / 1000;
      const uploadSpeed = (stats.size / 1024 / 1024) / uploadTime;
      console.log(`✅ Upload completed in ${uploadTime.toFixed(1)}s (${uploadSpeed.toFixed(2)} MB/s)`);

      // Clean up local file
      fs.unlinkSync(backupPath);
      console.log(`🧹 Cleaned up local temp file`);

      // Manage retention
      await this.cleanupOldBackups();

      await this.logout();

      this.lastBackup = timestamp;
      this.lastBackupFile = backupFilename;
      
      this.backupHistory.unshift({
        timestamp,
        filename: backupFilename,
        size: stats.size,
        date: new Date().toISOString()
      });
      
      if (this.backupHistory.length > 20) {
        this.backupHistory.pop();
      }

      console.log('='.repeat(50));
      console.log(`✅ MEGA backup completed successfully!`);
      console.log(`   File: ${backupFilename}`);
      console.log(`   Location: ${remoteFile}`);
      console.log('='.repeat(50));

      return { 
        success: true, 
        timestamp,
        filename: backupFilename,
        size: stats.size,
        remotePath: remoteFile
      };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      
      return { 
        success: false, 
        error: error.message,
        timestamp 
      };
    } finally {
      this.isRunning = false;
    }
  }

  // Keep only last N backups
  async cleanupOldBackups() {
    try {
      console.log('\n🧹 Cleaning up old backups...');
      
      const result = await this.runMegaCommand('ls', `-l "${this.remotePath}"`);
      
      if (!result.success) {
        console.log('   Could not list backups');
        return;
      }
      
      const files = result.stdout.split('\n')
        .filter(line => line.includes('backup-'))
        .map(line => {
          const parts = line.split(/\s+/);
          return {
            name: parts[parts.length - 1],
            size: parseInt(parts[4]) || 0,
            date: new Date(parts[5] + ' ' + parts[6] + ' ' + parts[7])
          };
        })
        .sort((a, b) => b.date - a.date);

      console.log(`   Found ${files.length} backups in MEGA`);

      if (files.length > this.maxBackups) {
        const toDelete = files.slice(this.maxBackups);
        console.log(`   Keeping newest ${this.maxBackups}, deleting ${toDelete.length} old backups`);
        
        for (const file of toDelete) {
          console.log(`   Deleting: ${file.name}`);
          await this.runMegaCommand('rm', `"${this.remotePath}/${file.name}"`);
        }
        
        console.log(`✅ Cleanup complete`);
      } else {
        console.log(`   No cleanup needed (${files.length}/${this.maxBackups} backups)`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // List backups from MEGA
  async listBackups() {
    await this.login();
    try {
      const result = await this.runMegaCommand('ls', `-l "${this.remotePath}"`);
      
      if (!result.success) {
        return [];
      }
      
      const files = result.stdout.split('\n')
        .filter(line => line.includes('backup-'))
        .map(line => {
          const parts = line.split(/\s+/);
          const name = parts[parts.length - 1];
          const size = parseInt(parts[4]) || 0;
          const dateStr = parts[5] + ' ' + parts[6] + ' ' + parts[7];
          
          return {
            name,
            size,
            date: new Date(dateStr).toISOString(),
            formattedSize: (size / 1024 / 1024).toFixed(2) + ' MB',
            formattedDate: new Date(dateStr).toLocaleString()
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      await this.logout();
      return files;
    } catch (error) {
      console.error('List error:', error);
      await this.logout().catch(() => {});
      return [];
    }
  }

  // Download backup from MEGA
  async downloadBackup(filename, localPath) {
    await this.login();
    try {
      console.log(`📥 Downloading ${filename}...`);
      
      const remoteFile = `${this.remotePath}/${filename}`;
      await this.runMegaCommand('get', `"${remoteFile}" "${localPath}"`);
      
      console.log(`✅ Downloaded to: ${localPath}`);
      await this.logout();
      return true;
    } catch (error) {
      console.error('Download error:', error);
      await this.logout().catch(() => {});
      return false;
    }
  }

  // Delete backup from MEGA
  async deleteBackup(filename) {
    await this.login();
    try {
      console.log(`🗑️ Deleting ${filename}...`);
      
      const remoteFile = `${this.remotePath}/${filename}`;
      await this.runMegaCommand('rm', `"${remoteFile}"`);
      
      console.log(`✅ Deleted: ${filename}`);
      await this.logout();
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      await this.logout().catch(() => {});
      return false;
    }
  }

  // Get backup info
  async getBackupInfo(filename) {
    await this.login();
    try {
      const remoteFile = `${this.remotePath}/${filename}`;
      const result = await this.runMegaCommand('ls', `-l "${remoteFile}"`);
      
      if (!result.success) {
        return null;
      }
      
      const parts = result.stdout.split(/\s+/);
      const info = {
        name: filename,
        size: parseInt(parts[4]) || 0,
        date: parts[5] + ' ' + parts[6] + ' ' + parts[7],
        permissions: parts[0],
        formattedSize: (parseInt(parts[4]) / 1024 / 1024).toFixed(2) + ' MB'
      };
      
      await this.logout();
      return info;
    } catch (error) {
      console.error('Info error:', error);
      await this.logout().catch(() => {});
      return null;
    }
  }

  // Get storage info
  async getStorageInfo() {
    try {
      const whoami = await this.runMegaCommand('whoami', '');
      if (!whoami.success || !whoami.stdout.includes(this.email)) {
        await this.login();
      }

      const result = await this.runMegaCommand('quota', '');
      
      if (!result.success || !result.stdout) {
        return {
          used: 0,
          total: 20 * 1024 * 1024 * 1024,
          usedFormatted: 'Unknown',
          totalFormatted: '20.00 GB',
          percentUsed: 'Unknown'
        };
      }
      
      const lines = result.stdout.split('\n');
      const usedLine = lines.find(l => l.includes('Used:'));
      const totalLine = lines.find(l => l.includes('Total:'));
      
      const used = usedLine ? this.parseQuotaValue(usedLine) : 0;
      const total = totalLine ? this.parseQuotaValue(totalLine) : 20 * 1024 * 1024 * 1024;
      
      return {
        used,
        total,
        usedFormatted: this.formatBytes(used),
        totalFormatted: this.formatBytes(total),
        percentUsed: total > 0 ? ((used / total) * 100).toFixed(1) + '%' : 'Unknown'
      };
    } catch (error) {
      console.error('Storage info error:', error);
      return {
        used: 0,
        total: 20 * 1024 * 1024 * 1024,
        usedFormatted: 'Unknown',
        totalFormatted: '20.00 GB',
        percentUsed: 'Unknown'
      };
    }
  }

  // Helper to parse quota values
  parseQuotaValue(line) {
    try {
      const bytesMatch = line.match(/\((\d+)\s*bytes\)/);
      if (bytesMatch) {
        return parseInt(bytesMatch[1]);
      }
      
      const gbMatch = line.match(/(\d+\.?\d*)\s*GB/);
      if (gbMatch) {
        return parseFloat(gbMatch[1]) * 1024 * 1024 * 1024;
      }
      
      const mbMatch = line.match(/(\d+\.?\d*)\s*MB/);
      if (mbMatch) {
        return parseFloat(mbMatch[1]) * 1024 * 1024;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  // Helper to format bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  // Test connection to MEGA
  async testConnection() {
    try {
      const result = await this.runMegaCommand('whoami', '');
      
      if (result.success && result.stdout.includes(this.email)) {
        let storage = null;
        try {
          storage = await this.getStorageInfo();
        } catch {
          // Ignore storage errors
        }
        
        return { 
          success: true, 
          message: 'Connected to MEGA',
          account: result.stdout.trim(),
          storage
        };
      } else {
        const loginResult = await this.login();
        if (loginResult) {
          const whoami = await this.runMegaCommand('whoami', '');
          return { 
            success: true, 
            message: 'Connected to MEGA',
            account: whoami.stdout?.trim() || this.email
          };
        }
        return { success: false, message: 'Failed to login' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Get status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastBackup: this.lastBackup,
      lastBackupFile: this.lastBackupFile,
      schedule: this.schedule,
      maxBackups: this.maxBackups,
      remotePath: this.remotePath,
      email: this.email.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
      history: this.backupHistory,
      platform: process.platform,
      megaCmdPath: this.megaCmdPath
    };
  }

  // Start scheduler
  startScheduler() {
    console.log(`⏰ Starting MEGA backup scheduler (${this.schedule})`);
    console.log(`   Remote path: ${this.remotePath}`);
    console.log(`   Max backups: ${this.maxBackups}`);
    console.log(`   Email: ${this.email}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   MEGAcmd path: ${this.megaCmdPath}`);
    
    setTimeout(() => {
      console.log('\n🔄 Running initial backup...');
      this.createAndUploadBackup();
    }, 60000);

    cron.schedule(this.schedule, () => {
      console.log('\n⏰ Scheduled backup triggered');
      this.createAndUploadBackup();
    });
  }
}

module.exports = new MEGABackup();