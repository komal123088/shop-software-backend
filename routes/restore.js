const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { MongoClient } = require("mongodb");
const { MONGO_URI, DB_NAME } = require("../env");

const upload = multer({ dest: "temp-uploads/" });

// @desc    Restore from backup
// @route   POST /api/backup/restore
router.post("/restore", upload.single("backup"), async (req, res) => {
  const backupFile = req.file;
  
  if (!backupFile) {
    return res.status(400).json({ message: "No backup file uploaded" });
  }

  const extractPath = path.join(__dirname, "../temp-restore");

  try {
    // Create temp directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Extract ZIP
    await fs
      .createReadStream(backupFile.path)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    // Restore database
    const dbBackupFile = fs.readdirSync(path.join(extractPath, "database"))[0];
    if (dbBackupFile) {
      const dbData = JSON.parse(
        fs.readFileSync(path.join(extractPath, "database", dbBackupFile), "utf8")
      );
      await restoreDatabase(dbData);
    }

    // Restore uploads folder
    const uploadsBackupPath = path.join(extractPath, "uploads");
    if (fs.existsSync(uploadsBackupPath)) {
      const uploadsDir = path.join(__dirname, "../uploads");
      
      // Clear existing uploads
      if (fs.existsSync(uploadsDir)) {
        fs.rmSync(uploadsDir, { recursive: true, force: true });
      }
      
      // Copy backup uploads
      fs.cpSync(uploadsBackupPath, uploadsDir, { recursive: true });
    }

    res.json({ message: "✅ Restore completed successfully" });
  } catch (error) {
    console.error("Restore failed:", error);
    res.status(500).json({ message: "Restore failed: " + error.message });
  } finally {
    // Cleanup temp files
    fs.rmSync(backupFile.path, { force: true });
    fs.rmSync(extractPath, { recursive: true, force: true });
  }
});

async function restoreDatabase(backupData) {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    // Get list of collections to restore
    const collections = Object.keys(backupData).filter(key => !key.startsWith("_"));
    
    for (const collectionName of collections) {
      // Clear existing data
      await db.collection(collectionName).deleteMany({});
      
      // Insert backup data
      if (backupData[collectionName].length > 0) {
        await db.collection(collectionName).insertMany(backupData[collectionName]);
      }
      console.log(`✅ Restored collection: ${collectionName}`);
    }
    
    console.log("✅ Database restore completed");
  } catch (error) {
    console.error("Database restore error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

module.exports = router;