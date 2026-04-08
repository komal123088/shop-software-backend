const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');

// Mock backup history (in production, store in database)
let backupHistory = [];
let isRunning = false;
let lastBackup = null;
let lastBackupFile = null;

// Get scheduler status
router.get('/status', (req, res) => {
  res.json({
    isRunning,
    lastBackup,
    lastBackupFile,
    schedule: '0 2 * * *',
    maxBackups: 10,
    remotePath: '/Backups',
    email: 'Agmuhammad949@gmail.com'.replace(/(.{3})(.*)(@.*)/, '$1***$3'),
    history: backupHistory.slice(0, 10),
    platform: process.platform,
    megaCmdPath: 'C:\\Users\\mahar\\AppData\\Local\\MEGAcmd'
  });
});

// Get backup history
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(backupHistory.slice(0, limit));
});

// Manual backup trigger
router.post('/trigger', async (req, res) => {
  if (isRunning) {
    return res.status(429).json({ 
      success: false, 
      error: 'Backup already in progress',
      isRunning: true 
    });
  }

  isRunning = true;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFilename = `backup-${timestamp}.zip`;

  try {
    console.log('='.repeat(50));
    console.log(`📦 Starting manual backup: ${timestamp}`);
    console.log('='.repeat(50));

    // Simulate backup process (in production, this would create actual backup)
    await new Promise(resolve => setTimeout(resolve, 3000));

    lastBackup = timestamp;
    lastBackupFile = backupFilename;
    
    const backupEntry = {
      timestamp,
      filename: backupFilename,
      size: 15 * 1024 * 1024, // Mock 15MB
      date: new Date().toISOString()
    };
    
    backupHistory.unshift(backupEntry);
    
    if (backupHistory.length > 20) {
      backupHistory.pop();
    }

    console.log('='.repeat(50));
    console.log(`✅ Manual backup completed successfully!`);
    console.log(`   File: ${backupFilename}`);
    console.log('='.repeat(50));

    res.json({ 
      success: true, 
      timestamp,
      filename: backupFilename,
      size: backupEntry.size,
      remotePath: `/Backups/${backupFilename}`
    });

  } catch (error) {
    console.error('❌ Backup failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    isRunning = false;
  }
});

// List backups (mock data)
router.get('/list', (req, res) => {
  // Generate mock backup files
  const mockBackups = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const timestamp = date.toISOString().replace(/[:.]/g, "-").split('T')[0];
    mockBackups.push({
      name: `backup-${timestamp}.zip`,
      size: Math.floor(Math.random() * 50) * 1024 * 1024, // Random size between 0-50MB
      date: date.toISOString(),
      formattedSize: `${(Math.random() * 20 + 5).toFixed(2)} MB`,
      formattedDate: date.toLocaleString()
    });
  }
  res.json(mockBackups);
});

// Download backup (mock)
router.get('/download/:filename', async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  
  try {
    console.log(`📥 Mock downloading: ${filename}`);
    
    // Create a simple text file as mock backup
    const mockContent = `Mock backup file: ${filename}\nCreated: ${new Date().toISOString()}\nThis is a simulated backup for testing.`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', mockContent.length);
    
    res.send(mockContent);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete backup (mock)
router.delete('/delete/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  console.log(`🗑️ Mock deleting: ${filename}`);
  
  res.json({ 
    success: true, 
    message: `Deleted ${filename}` 
  });
});

// Get backup info
router.get('/info/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  
  res.json({
    name: filename,
    size: 15 * 1024 * 1024, // Mock 15MB
    date: new Date().toLocaleString(),
    permissions: '-rw-r--r--'
  });
});

// Get storage info (mock)
router.get('/storage', (req, res) => {
  const used = 5.5 * 1024 * 1024 * 1024; // 5.5 GB
  const total = 20 * 1024 * 1024 * 1024; // 20 GB
  
  res.json({
    used: used,
    total: total,
    usedFormatted: '5.50 GB',
    totalFormatted: '20.00 GB',
    percentUsed: '27.5%'
  });
});

// Test connection (mock)
router.get('/test-connection', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Connected to MEGA',
    account: 'Agmuh***@gmail.com',
    storage: {
      used: 5.5 * 1024 * 1024 * 1024,
      total: 20 * 1024 * 1024 * 1024,
      usedFormatted: '5.50 GB',
      totalFormatted: '20.00 GB',
      percentUsed: '27.5%'
    }
  });
});

// Clear backup history
router.post('/clear-history', (req, res) => {
  backupHistory = [];
  console.log('🧹 Backup history cleared');
  res.json({ success: true, message: 'History cleared' });
});

module.exports = router;