const userRepository = require('../repositories/postgres/UserRepository');

class UserService {
  /**
   * Get all users
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async getUsers(options = {}) {
    const users = await userRepository.findAll({}, {
      select: '-password -loginAttempts -lockUntil',
      populate: [{ path: 'permissionHistory.changedBy', select: 'firstName lastName email' }],
      sort: { createdAt: -1 }
    });
    return users;
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise<object>}
   */
  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user.toSafeObject ? user.toSafeObject() : user;
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} updateData - Update data
   * @param {object} changedBy - User making the change
   * @returns {Promise<object>}
   */
  async updateUser(id, updateData, changedBy) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updateData.email && updateData.email !== user.email) {
      const emailTaken = await userRepository.emailExists(updateData.email, id);
      if (emailTaken) {
        throw new Error('Email already exists');
      }
    }

    // Store old data for tracking
    const oldData = {
      role: user.role,
      permissions: user.permissions
    };

    // Update user
    const updatedUser = await userRepository.updateById(id, updateData);

    // Track permission changes if role or permissions changed
    if (updateData.role && updateData.role !== oldData.role) {
      await userRepository.trackPermissionChange(
        id,
        changedBy?.id || changedBy?._id || changedBy,
        'role_changed',
        oldData,
        { role: updatedUser.role, permissions: updatedUser.permissions },
        `Role changed from ${oldData.role} to ${updateData.role}`
      );
    } else if (updateData.permissions && JSON.stringify(updateData.permissions) !== JSON.stringify(oldData.permissions)) {
      await userRepository.trackPermissionChange(
        id,
        changedBy?.id || changedBy?._id || changedBy,
        'permissions_modified',
        oldData,
        { role: updatedUser.role, permissions: updatedUser.permissions },
        'User permissions modified'
      );
    }

    return updatedUser.toSafeObject ? updatedUser.toSafeObject() : updatedUser;
  }

  /**
   * Reset user password
   * @param {string} id - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<object>}
   */
  async resetPassword(id, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update password (the pre-save middleware will hash it automatically)
    await userRepository.updatePassword(id, newPassword);
    return { message: 'Password reset successfully' };
  }

  /**
   * Get user activity data
   * @param {string} id - User ID
   * @returns {Promise<object>}
   */
  async getUserActivity(id) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new Error('User not found');
    }

    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    const isOnline = lastLogin && (Date.now() - lastLogin.getTime()) < 30 * 60 * 1000;

    return {
      userId: user.id || user._id,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount ?? 0,
      isOnline,
      isActive: user.isActive,
      loginHistory: [],
      permissionHistory: []
    };
  }

  /**
   * Update permissions for all users with a specific role
   * @param {string} role - Role to update
   * @param {Array} permissions - New permissions
   * @returns {Promise<object>}
   */
  async updateRolePermissions(role, permissions) {
    if (!role || !permissions) {
      throw new Error('Role and permissions are required');
    }

    // Use BaseRepository's updateMany method
    const result = await userRepository.updateMany(
      { role: role },
      { $set: { permissions: permissions } }
    );

    return {
      message: `Updated ${result.modifiedCount} users with ${role} role`,
      modifiedCount: result.modifiedCount
    };
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @param {string} currentUserId - Current user ID (to prevent self-deletion)
   * @returns {Promise<object>}
   */
  async deleteUser(id, currentUserId) {
    // Prevent deleting own account
    if (id === currentUserId) {
      throw new Error('Cannot delete your own account');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    await userRepository.softDelete(id);
    return { message: 'User deleted successfully' };
  }

  /**
   * Toggle user status
   * @param {string} id - User ID
   * @param {string} currentUserId - Current user ID (to prevent self-modification)
   * @returns {Promise<object>}
   */
  async toggleUserStatus(id, currentUserId) {
    // Prevent toggling own account status
    if (id === currentUserId) {
      throw new Error('Cannot modify your own account status');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Toggle status
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await userRepository.updateById(id, { status: newStatus });

    const updatedUser = await userRepository.findById(id);
    return {
      message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser.toSafeObject ? updatedUser.toSafeObject() : updatedUser
    };
  }
}

module.exports = new UserService();

