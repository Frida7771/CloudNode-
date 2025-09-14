const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/user");
const EmailLog = require("../models/emailLog");
const logger = require("../utils/logger");
const emailService = require("../utils/emailService");

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Username, email, and password are required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        $or: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
        message: "A user with this email or username already exists"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName
    });

    logger.info(`New user registered: ${user.email}`);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.firstName || user.username);
    } catch (emailError) {
      logger.error("Failed to send welcome email:", emailError);
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error("User registration error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create user"
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        message: "Email and password are required"
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect"
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect"
      });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    logger.error("User login error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to login"
    });
  }
});

// Get user profile
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User with this ID does not exist"
      });
    }

    res.json({ user });

  } catch (error) {
    logger.error("Get user profile error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get user profile"
    });
  }
});

// Get all users (admin only)
router.get("/", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({ users });

  } catch (error) {
    logger.error("Get users error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get users"
    });
  }
});

module.exports = router;
