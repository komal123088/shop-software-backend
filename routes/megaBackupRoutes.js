const express = require('express');
const router = express.Router();
const megaBackup = require('../services/megaBackup');
const backupScheduler = require('../services/backupScheduler');
const fs = require('fs');
const path = require('path');

// Manual backup trigger
router.post('/trigger', async (req, res) => {
  try {
    const result = await megaBackup.createAndUploadBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get backup status
router.get('/status', (req, res) => {
  const status = backupScheduler.getStatus();
  res.json(status);
});

// List backups from MEGA
router.get('/list', async (req, res) => {
  try {
    await megaBackup.login();
    
    // List files in MEGA remote path
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const { stdout } = await execPromise(`mega-ls -l "${process.env.MEGA_REMOTE_PATH || '/Backups'}"`);
    await megaBackup.logout();
    
    // Parse MEGA output
    const files = stdout.split('\n')
      .filter(line => line.includes('backup-'))
      .map(line => {
        const parts = line.split(/\s+/);
        const name = parts[parts.length - 1];
        const size = parseInt(parts[4]) || 0;
        const dateStr = parts[5] + ' ' + parts[6] + ' ' + parts[7];
        
        return {
          id: name, // Using filename as ID since MEGA doesn't expose file IDs easily
          name: name,
          size: size,
          createdTime: new Date(dateStr).toISOString(),
          downloadUrl: `/api/mega-backup/download/${encodeURIComponent(name)}`
        };
      })
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    
    res.json(files);
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download backup from MEGA
router.get('/download/:filename', async (req, res) => {
  let tempPath = null;
  
  try {
    const filename = decodeURIComponent(req.params.filename);
    console.log(`📥 Downloading backup: ${filename}`);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp-downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    tempPath = path.join(tempDir, filename);
    
    // Login to MEGA
    await megaBackup.login();
    
    // Download file from MEGA
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const remotePath = `${process.env.MEGA_REMOTE_PATH || '/Backups'}/${filename}`;
    await execPromise(`mega-get "${remotePath}" "${tempPath}"`);
    
    await megaBackup.logout();
    
    // Check if file exists and has content
    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(tempPath).size);
    
    // Stream file to client
    const fileStream = fs.createReadStream(tempPath);
    fileStream.pipe(res);
    
    // Clean up temp file after download completes
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log(`🧹 Cleaned up: ${tempPath}`);
        }
      }, 5000);
    });
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    
    // Clean up temp file on error
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    await megaBackup.logout().catch(() => {});
    
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete backup from MEGA
router.delete('/delete/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    
    await megaBackup.login();
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const remotePath = `${process.env.MEGA_REMOTE_PATH || '/Backups'}/${filename}`;
    await execPromise(`mega-rm "${remotePath}"`);
    
    await megaBackup.logout();
    
    res.json({ 
      success: true, 
      message: `Deleted ${filename}` 
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    await megaBackup.logout().catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Restore from backup (download and extract)
router.post('/restore/:filename', async (req, res) => {
  let tempZipPath = null;
  let tempExtractPath = null;
  
  try {
    const filename = decodeURIComponent(req.params.filename);
    console.log(`🔄 Restoring from backup: ${filename}`);
    
    // Create temp directories
    const tempDir = path.join(__dirname, '../temp-restore');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    tempZipPath = path.join(tempDir, filename);
    tempExtractPath = path.join(tempDir, 'extracted');
    
    // Login to MEGA
    await megaBackup.login();
    
    // Download backup from MEGA
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const unzipper = require('unzipper');
    
    const remotePath = `${process.env.MEGA_REMOTE_PATH || '/Backups'}/${filename}`;
    await execPromise(`mega-get "${remotePath}" "${tempZipPath}"`);
    
    await megaBackup.logout();
    
    // Extract the backup
    console.log('📦 Extracting backup...');
    await fs.createReadStream(tempZipPath)
      .pipe(unzipper.Extract({ path: tempExtractPath }))
      .promise();
    
    // Read metadata
    const metadataPath = path.join(tempExtractPath, 'metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    // Read database backup
    const dbBackupPath = path.join(tempExtractPath, 'database');
    if (fs.existsSync(dbBackupPath)) {
      const dbFiles = fs.readdirSync(dbBackupPath);
      for (const dbFile of dbFiles) {
        if (dbFile.endsWith('.json')) {
          const dbData = JSON.parse(fs.readFileSync(path.join(dbBackupPath, dbFile), 'utf8'));
          
          // Restore database (you'll need to implement this based on your schema)
          console.log('💾 Database restore ready. Files extracted.');
          // await restoreDatabase(dbData);
        }
      }
    }
    
    // Restore uploads
    const uploadsBackupPath = path.join(tempExtractPath, 'uploads');
    const uploadsDestPath = path.join(__dirname, '../uploads');
    
    if (fs.existsSync(uploadsBackupPath)) {
      console.log('📁 Restoring uploads folder...');
      
      // Create backup of current uploads
      const currentUploadsBackup = path.join(tempDir, 'current-uploads-backup');
      if (fs.existsSync(uploadsDestPath)) {
        fs.cpSync(uploadsDestPath, currentUploadsBackup, { recursive: true });
      }
      
      // Clear current uploads
      if (fs.existsSync(uploadsDestPath)) {
        fs.rmSync(uploadsDestPath, { recursive: true, force: true });
      }
      
      // Restore from backup
      fs.cpSync(uploadsBackupPath, uploadsDestPath, { recursive: true });
      
      console.log('✅ Uploads folder restored');
    }
    
    // Clean up temp files
    if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    if (fs.existsSync(tempExtractPath)) fs.rmSync(tempExtractPath, { recursive: true, force: true });
    
    res.json({ 
      success: true, 
      message: 'Restore completed successfully',
      metadata 
    });
    
  } catch (error) {
    console.error('Restore error:', error);
    
    // Clean up temp files
    if (tempZipPath && fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    if (tempExtractPath && fs.existsSync(tempExtractPath)) fs.rmSync(tempExtractPath, { recursive: true, force: true });
    
    res.status(500).json({ error: error.message });
  }
});

// Get backup info
router.get('/info/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    
    await megaBackup.login();
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    const remotePath = `${process.env.MEGA_REMOTE_PATH || '/Backups'}/${filename}`;
    const { stdout } = await execPromise(`mega-ls -l "${remotePath}"`);
    
    await megaBackup.logout();
    
    const parts = stdout.split(/\s+/);
    
    res.json({
      name: filename,
      size: parseInt(parts[4]) || 0,
      date: parts[5] + ' ' + parts[6] + ' ' + parts[7],
      permissions: parts[0]
    });
    
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;