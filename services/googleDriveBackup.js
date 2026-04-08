const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');

// Configuration
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "mern";
const BACKUP_FOLDER_ID = '1zBdlGShvdh0iQ3_yAkOodmUWBpRxekRD'; // Create a folder in Google Drive and get its ID

class GoogleDriveBackup {
  constructor() {
    this.drive = null;
    this.initialized = false;
  }

  // Initialize Google Drive API
  async initialize() {
    try {
      // You need to create a service account or OAuth2 credentials
      // Go to https://console.cloud.google.com/ to create credentials
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../config/google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.initialized = true;
      console.log('✅ Google Drive initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
    }
  }

  // Create backup and upload to Google Drive
  async createAndUploadBackup() {
    if (!this.initialized) {
      await this.initialize();
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempDir = path.join(__dirname, '../temp-backups');
    const backupPath = path.join(tempDir, `backup-${timestamp}.zip`);

    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create backup
      console.log(`📦 Creating backup for ${timestamp}`);
      await this.createBackupFile(backupPath, timestamp);

      // Upload to Google Drive
      console.log('☁️ Uploading to Google Drive...');
      const fileId = await this.uploadToDrive(backupPath, `backup-${timestamp}.zip`);

      // Clean up local file
      fs.unlinkSync(backupPath);
      
      console.log(`✅ Backup uploaded successfully! File ID: ${fileId}`);
      
      // Keep only last 10 backups in Drive
      await this.cleanupOldBackups();

      return { success: true, fileId, timestamp };
    } catch (error) {
      console.error('❌ Backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Create backup file
  async createBackupFile(outputPath, timestamp) {
    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => {
        console.log(`📦 Backup created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      });

      archive.on('error', reject);

      archive.pipe(output);

      // Add database backup
      const dbData = await this.getDatabaseBackup();
      archive.append(JSON.stringify(dbData, null, 2), { name: `database/backup-${timestamp}.json` });

      // Add uploads folder
      const uploadsDir = path.join(__dirname, '../uploads');
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }

      // Add metadata
      archive.append(JSON.stringify({
        timestamp,
        database: DB_NAME,
        version: '1.0'
      }, null, 2), { name: 'metadata.json' });

      await archive.finalize();
    });
  }

  // Get database backup
  async getDatabaseBackup() {
    const client = new MongoClient(MONGO_URI);
    try {
      await client.connect();
      const db = client.db(DB_NAME);
      const collections = await db.listCollections().toArray();
      
      const backupData = {};
      for (const collection of collections) {
        backupData[collection.name] = await db.collection(collection.name).find({}).toArray();
      }
      
      backupData._metadata = {
        timestamp: new Date().toISOString(),
        collections: collections.map(c => c.name)
      };
      
      return backupData;
    } finally {
      await client.close();
    }
  }

  // Upload to Google Drive
  async uploadToDrive(filePath, fileName) {
    const fileMetadata = {
      name: fileName,
      parents: [BACKUP_FOLDER_ID]
    };

    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath)
    };

    const response = await this.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    return response.data.id;
  }

  // Keep only last 10 backups
  async cleanupOldBackups() {
    try {
      const response = await this.drive.files.list({
        q: `'${BACKUP_FOLDER_ID}' in parents and trashed=false`,
        orderBy: 'createdTime desc',
        pageSize: 100,
        fields: 'files(id, name, createdTime)'
      });

      const files = response.data.files;
      
      // Keep last 10, delete others
      if (files.length > 10) {
        const toDelete = files.slice(10);
        for (const file of toDelete) {
          await this.drive.files.delete({ fileId: file.id });
          console.log(`🗑️ Deleted old backup: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new GoogleDriveBackup();