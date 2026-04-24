const userRepository = require('../repositories/postgres/UserRepository');
const jwt = require('jsonwebtoken');
const ipaddr = require('ipaddr.js');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register a new user
   * @param {object} userData - User data
   * @param {User} createdBy - User creating the account
   * @returns {Promise<{user: User, message: string}>}
   */
  async register(userData, createdBy) {
    const { firstName, lastName, email, password, role, phone, department, permissions, status, allowedNetwork } = userData;

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
      status: status || 'active',
      allowedNetwork
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

    // --- IP Restriction Logic ---
    // Admin users are exempt from IP restrictions
    if (user.role !== 'admin' && user.allowedNetwork) {
      try {
        const clientIp = ipAddress;
        const allowedRanges = user.allowedNetwork.split(',').map(s => s.trim()).filter(Boolean);

        if (allowedRanges.length > 0) {
          let isAllowed = false;
          let parsedClientIp;

          try {
            parsedClientIp = ipaddr.parse(clientIp);
          } catch (e) {
            logger.warn(`Failed to parse client IP: ${clientIp}`);
            throw new Error('Invalid client IP detected');
          }

          for (const rangeStr of allowedRanges) {
            try {
              if (rangeStr.includes('/')) {
                // CIDR notation
                const range = ipaddr.parseCIDR(rangeStr);
                if (parsedClientIp.match(range)) {
                  isAllowed = true;
                  break;
                }
              } else {
                // Single IP
                const allowedIp = ipaddr.parse(rangeStr);
                if (parsedClientIp.toString() === allowedIp.toString()) {
                  isAllowed = true;
                  break;
                }
              }
            } catch (e) {
              logger.warn(`Failed to parse allowed network range: ${rangeStr}`);
              // Continue to next range
            }
          }

          if (!isAllowed) {
            logger.warn(`Login blocked for user ${email} from unauthorized IP: ${clientIp}`);
            throw new Error('Access restricted: You are not connected to the authorized shop network.');
          }
        }
      } catch (error) {
        if (error.message.startsWith('Access restricted')) {
          throw error;
        }
        logger.error(`Error during IP validation for user ${email}:`, error);
        // Fallback: if validation fails due to technical error, we might want to block or allow.
        // Given this is a security feature, blocking is safer.
        throw new Error('Login failed due to network validation error. Please contact administrator.');
      }
    }
    // ----------------------------

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await userRepository.resetLoginAttempts(user.id);
    }

    // Track login activity
    await userRepository.trackLogin(user.id, ipAddress, userAgent);

    // Create JWT token
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
      throw new Error('Server configuration error: JWT_SECRET is missing');
    }

    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });

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

