const userRepository = require('../repositories/postgres/UserRepository');
const jwt = require('jsonwebtoken');
const ipaddr = require('ipaddr.js');
const logger = require('../utils/logger');
const { sendTwoFactorCodeEmail } = require('../utils/emailService');
const { sendTwoFactorCodeSms } = require('../utils/smsService');

class AuthService {
  createAuthToken(user) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      throw new Error('Server configuration error: JWT_SECRET is missing');
    }
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  }

  createTwoFactorChallengeToken(userId) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      throw new Error('Server configuration error: JWT_SECRET is missing');
    }
    return jwt.sign({ userId, type: '2fa_challenge' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  }

  createTwoFactorCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /**
   * Generate OTP, deliver it by channel, return temp JWT for /verify-2fa.
   */
  async createAndDeliverTwoFactorChallenge(user, ipAddress, userAgent, deliveryChannel = 'email') {
    const otpCode = this.createTwoFactorCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await userRepository.setTwoFactorCode(user.id, otpCode, expiresAt);
    let delivered = false;

    try {
      if (deliveryChannel === 'sms') {
        await sendTwoFactorCodeSms({
          toPhone: user.phone,
          code: otpCode
        });
      } else {
        await sendTwoFactorCodeEmail({
          toEmail: user.email,
          code: otpCode
        });
      }
      delivered = true;
    } catch (deliveryError) {
      logger.error(`2FA ${deliveryChannel} delivery failed for user ${user.id}: ${deliveryError.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Unable to deliver two-factor code. Please contact administrator.');
      }
      logger.warn(`2FA dev fallback code for user ${user.id}: ${otpCode}`);
    }

    const challengeToken = this.createTwoFactorChallengeToken(user.id);

    logger.info('2FA challenge created', {
      userId: user.id,
      channel: deliveryChannel,
      destination: deliveryChannel === 'sms' ? user.phone : user.email,
      ipAddress,
      userAgent
    });

    return {
      twoFactorRequired: true,
      tempToken: challengeToken,
      message: delivered
        ? `Two-factor authentication code sent to your ${deliveryChannel === 'sms' ? 'mobile number' : 'email'}`
        : 'Two-factor authentication code required (development fallback active)'
    };
  }

  /**
   * Send a 2FA code to a registered email/mobile (no password). User must have 2FA enabled.
   */
  async requestTwoFactorCode(payload, ipAddress, userAgent) {
    const channel = payload?.channel === 'sms' ? 'sms' : 'email';
    const email = String(payload?.email || '').trim();
    const phone = String(payload?.phone || '').trim();

    if (channel === 'sms' && !phone) throw new Error('Mobile number is required');
    if (channel === 'email' && !email) throw new Error('Email is required');

    const user = channel === 'sms'
      ? await userRepository.findByPhone(phone)
      : await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(
        channel === 'sms'
          ? 'No account found with this mobile number'
          : 'No account found with this email address'
      );
    }

    if (channel === 'sms' && !user.phone) {
      throw new Error('No mobile number is saved for this account');
    }

    if (!user.isActive) {
      throw new Error('This account is inactive');
    }

    if (user.isLocked) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    if (!user?.preferences?.twoFactorEnabled) {
      throw new Error(
        'Two-factor is not enabled for this account. Enable it in Settings after signing in with email and password, or use the Email & password tab.'
      );
    }

    return this.createAndDeliverTwoFactorChallenge(user, ipAddress, userAgent, channel);
  }

  /**
   * Register a new user
   * @param {object} userData - User data
   * @param {User} createdBy - User creating the account
   * @returns {Promise<{user: User, message: string}>}
   */
  async register(userData, createdBy) {
    const { firstName, lastName, email, password, role, phone, department, permissions, status } = userData;

    // Check if email already exists
    const emailExists = await userRepository.emailExists(email);
    if (emailExists) {
      throw new Error('User already exists');
    }

    // Create user
    const user = await userRepository.create({
      firstName,
      lastName,
      email,
      password,
      role,
      phone,
      department,
      permissions: permissions || [],
      status: status || 'active'
    });

    // Track permission change
    if (createdBy) {
      await userRepository.trackPermissionChange(
        user.id,
        createdBy,
        'created',
        {},
        { role: user.role, permissions: user.permissions },
        'User account created'
      );
    }

    return {
      user: user.toSafeObject(),
      message: 'User created successfully'
    };
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @returns {Promise<{user: User, token: string, message: string}>}
   */
  async login(email, password, ipAddress, userAgent) {
    // Find user with password
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await userRepository.incrementLoginAttempts(user.id);
      throw new Error('Invalid credentials');
    }


    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await userRepository.resetLoginAttempts(user.id);
    }

    // Email & password: complete session here. OTP verification is only for the Two-factor tab (request-2fa-code + verify-2fa).

    // Track login activity
    await userRepository.trackLogin(user.id, ipAddress, userAgent);

    const token = this.createAuthToken(user);

    return {
      user: user.toSafeObject(),
      token,
      message: 'Login successful'
    };
  }

  async verifyTwoFactor(tempToken, code, ipAddress, userAgent) {
    if (!tempToken || !code) {
      throw new Error('Two-factor token and code are required');
    }

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired two-factor token');
    }

    if (payload?.type !== '2fa_challenge' || !payload?.userId) {
      throw new Error('Invalid two-factor challenge');
    }

    const user = await userRepository.findByIdWithPassword(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValidCode = userRepository.verifyTwoFactorCode(user, code);
    if (!isValidCode) {
      throw new Error('Invalid or expired two-factor code');
    }

    await userRepository.clearTwoFactorCode(user.id);
    await userRepository.trackLogin(user.id, ipAddress, userAgent);
    const token = this.createAuthToken(user);

    return {
      user: user.toSafeObject(),
      token,
      message: 'Login successful'
    };
  }

  /**
   * Get current user
   * @param {string} userId - User ID
   * @returns {Promise<User>}
   */
  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.toSafeObject();
  }

  /**
   * Update user profile (firstName, lastName, email, phone). Password must be changed via changePassword().
   * @param {string} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {Promise<{user: User, message: string}>}
   */
  async updateProfile(userId, updateData) {
    const { firstName, lastName, email, phone } = updateData;

    const emailVal = email !== undefined && email !== null ? String(email).trim() : '';
    if (emailVal) {
      const taken = await userRepository.emailExists(emailVal, userId);
      if (taken) {
        throw new Error('Email already exists');
      }
    }

    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (emailVal) updateFields.email = emailVal.toLowerCase();
    if (phone !== undefined) updateFields.phone = phone;

    const user = await userRepository.updateProfile(userId, updateFields);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      user: user.toSafeObject(),
      message: 'Profile updated successfully'
    };
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<{message: string}>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Get user with password
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    await userRepository.updatePassword(userId, newPassword);

    return {
      message: 'Password changed successfully'
    };
  }
}

module.exports = new AuthService();

