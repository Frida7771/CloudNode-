const sgMail = require('@sendgrid/mail');
const EmailLog = require('../models/emailLog');
const logger = require('./logger');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  async sendEmail(to, subject, content, userId = null) {
    try {
      const msg = {
        to,
        from: process.env.FROM_EMAIL,
        subject,
        html: content,
      };

      // Log email attempt
      const emailLog = await EmailLog.create({
        to,
        from: process.env.FROM_EMAIL,
        subject,
        content,
        status: 'pending',
        userId
      });

      // Send email
      await sgMail.send(msg);

      // Update log status
      await emailLog.update({
        status: 'sent',
        sentAt: new Date()
      });

      logger.info(`Email sent successfully to ${to}`);
      return { success: true, messageId: emailLog.id };

    } catch (error) {
      logger.error('Email sending failed:', error);

      // Update log with error
      if (emailLog) {
        await emailLog.update({
          status: 'failed',
          errorMessage: error.message
        });
      }

      throw error;
    }
  }

  async sendWelcomeEmail(email, firstName) {
    const subject = 'Welcome to HealthWeb Clone!';
    const content = `
      <h2>Welcome ${firstName}!</h2>
      <p>Thank you for registering with HealthWeb. We're excited to have you on board!</p>
      <p>You can now:</p>
      <ul>
        <li>Upload and manage your images</li>
        <li>Track your health metrics</li>
        <li>Receive important notifications</li>
      </ul>
      <p>If you have any questions, feel free to contact our support team.</p>
      <p>Best regards,<br>The HealthWeb Team</p>
    `;

    return await this.sendEmail(email, subject, content);
  }

  async sendPasswordResetEmail(email, resetToken, firstName) {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const content = `
      <h2>Password Reset Request</h2>
      <p>Hello ${firstName},</p>
      <p>You requested a password reset for your account. Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this reset, please ignore this email.</p>
      <p>Best regards,<br>The HealthWeb Team</p>
    `;

    return await this.sendEmail(email, subject, content);
  }

  async sendNotificationEmail(email, title, message, firstName) {
    const subject = `Notification: ${title}`;
    const content = `
      <h2>${title}</h2>
      <p>Hello ${firstName},</p>
      <p>${message}</p>
      <p>Best regards,<br>The HealthWeb Team</p>
    `;

    return await this.sendEmail(email, subject, content);
  }

  async getEmailLogs(userId = null, limit = 50, offset = 0) {
    try {
      const whereClause = userId ? { userId } : {};
      
      const logs = await EmailLog.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return logs;
    } catch (error) {
      logger.error('Failed to get email logs:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
