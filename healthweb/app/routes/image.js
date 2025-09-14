const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const router = express.Router();
const Image = require("../models/image");
const logger = require("../utils/logger");

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Upload image
router.post("/upload", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        message: "Please select an image file to upload"
      });
    }

    const { userId, description, tags } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: "Missing user ID",
        message: "User ID is required"
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const filename = `images/${userId}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filename,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    // Save to database
    const image = await Image.create({
      filename: filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      s3Key: filename,
      s3Url: uploadResult.Location,
      userId: parseInt(userId),
      description: description || null,
      tags: tags ? JSON.parse(tags) : []
    });

    logger.info(`Image uploaded: ${image.s3Url}`);

    res.status(201).json({
      message: "Image uploaded successfully",
      image: {
        id: image.id,
        filename: image.filename,
        originalName: image.originalName,
        s3Url: image.s3Url,
        size: image.size,
        description: image.description,
        tags: image.tags,
        createdAt: image.createdAt
      }
    });

  } catch (error) {
    logger.error("Image upload error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to upload image"
    });
  }
});

// Get all images
router.get("/", async (req, res) => {
  try {
    const { userId, limit = 20, offset = 0 } = req.query;
    
    const whereClause = userId ? { userId: parseInt(userId) } : {};
    
    const images = await Image.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ images });

  } catch (error) {
    logger.error("Get images error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get images"
    });
  }
});

// Get image by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findByPk(id);

    if (!image) {
      return res.status(404).json({
        error: "Image not found",
        message: "Image with this ID does not exist"
      });
    }

    res.json({ image });

  } catch (error) {
    logger.error("Get image error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get image"
    });
  }
});

// Delete image
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findByPk(id);

    if (!image) {
      return res.status(404).json({
        error: "Image not found",
        message: "Image with this ID does not exist"
      });
    }

    // Delete from S3
    try {
      await s3.deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: image.s3Key
      }).promise();
    } catch (s3Error) {
      logger.error("Failed to delete from S3:", s3Error);
    }

    // Delete from database
    await image.destroy();

    logger.info(`Image deleted: ${image.s3Url}`);

    res.json({
      message: "Image deleted successfully"
    });

  } catch (error) {
    logger.error("Delete image error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete image"
    });
  }
});

module.exports = router;
