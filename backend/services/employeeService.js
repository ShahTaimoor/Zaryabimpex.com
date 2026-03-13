const employeeRepository = require('../repositories/EmployeeRepository');
const userRepository = require('../repositories/UserRepository');

class EmployeeService {
  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {object} - MongoDB filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Search filter
    if (queryParams.search && typeof queryParams.search === 'string' && queryParams.search.trim() !== '') {
      try {
        const searchRegex = new RegExp(queryParams.search.trim(), 'i');
        filter.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { position: searchRegex },
          { department: searchRegex }
        ];
      } catch (regexError) {
        // Continue without search filter if regex fails
      }
    }

    // Status filter
    if (queryParams.status && typeof queryParams.status === 'string' && queryParams.status.trim() !== '') {
      const statusValue = queryParams.status.trim();
      if (['active', 'inactive', 'terminated', 'on_leave'].includes(statusValue)) {
        filter.status = statusValue;
      }
    }

    // Department filter
    if (queryParams.department && typeof queryParams.department === 'string' && queryParams.department.trim() !== '') {
      filter.department = queryParams.department.trim();
    }

    // Position filter
    if (queryParams.position && typeof queryParams.position === 'string' && queryParams.position.trim() !== '') {
      filter.position = queryParams.position.trim();
    }

    return filter;
  }

  /**
   * Get employees with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getEmployees(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;

    const filter = this.buildFilter(queryParams);

    const result = await employeeRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [{
        path: 'userAccount',
        select: 'firstName lastName email role',
        options: { strictPopulate: false }
      }]
    });

    return result;
  }

  /**
   * Get single employee by ID
   * @param {string} id - Employee ID
   * @returns {Promise<Employee>}
   */
  async getEmployeeById(id) {
    const employee = await employeeRepository.findById(id);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Populate related fields
    await employee.populate({
      path: 'userAccount',
      select: 'firstName lastName email role status',
      options: { strictPopulate: false }
    });

    return employee;
  }

  /**
   * Check if employee ID exists
   * @param {string} employeeId - Employee ID to check
   * @param {string} excludeId - Employee ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkEmployeeIdExists(employeeId, excludeId = null) {
    return await employeeRepository.employeeIdExists(employeeId, excludeId);
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Employee ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkEmailExists(email, excludeId = null) {
    return await employeeRepository.emailExists(email, excludeId);
  }

  /**
   * Create a new employee
   * @param {object} employeeData - Employee data
   * @returns {Promise<Employee>}
   */
  async createEmployee(employeeData) {
    // Check if employee ID already exists
    if (employeeData.employeeId) {
      const idExists = await this.checkEmployeeIdExists(employeeData.employeeId);
      if (idExists) {
        throw new Error('Employee ID already exists');
      }
    }

    // Check if email already exists
    if (employeeData.email) {
      const emailExists = await this.checkEmailExists(employeeData.email);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Generate employee ID if not provided
    if (!employeeData.employeeId) {
      employeeData.employeeId = await this.generateEmployeeId();
    }

    // Create employee
    const employee = await employeeRepository.create(employeeData);

    // Populate related fields
    await employee.populate({
      path: 'userAccount',
      select: 'firstName lastName email role',
      options: { strictPopulate: false }
    });

    return employee;
  }

  /**
   * Update an employee
   * @param {string} id - Employee ID
   * @param {object} updateData - Update data
   * @returns {Promise<Employee>}
   */
  async updateEmployee(id, updateData) {
    const employee = await employeeRepository.findById(id);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Check if employee ID already exists (excluding current employee)
    if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
      const idExists = await this.checkEmployeeIdExists(updateData.employeeId, id);
      if (idExists) {
        throw new Error('Employee ID already exists');
      }
    }

    // Check if email already exists (excluding current employee)
    if (updateData.email && updateData.email !== employee.email) {
      const emailExists = await this.checkEmailExists(updateData.email, id);
      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Update employee
    const updatedEmployee = await employeeRepository.updateById(id, updateData);

    // Populate related fields
    await updatedEmployee.populate({
      path: 'userAccount',
      select: 'firstName lastName email role status',
      options: { strictPopulate: false }
    });

    return updatedEmployee;
  }

  /**
   * Delete an employee
   * @param {string} id - Employee ID
   * @returns {Promise<object>}
   */
  async deleteEmployee(id) {
    const employee = await employeeRepository.findById(id);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Delete employee
    await employeeRepository.delete(id);

    return {
      message: 'Employee deleted successfully',
      employee
    };
  }

  /**
   * Generate unique employee ID
   * @returns {Promise<string>}
   */
  async generateEmployeeId() {
    // Get the latest employee ID
    const latestEmployee = await employeeRepository.findLatest();
    
    if (!latestEmployee || !latestEmployee.employeeId) {
      return 'EMP001';
    }

    // Extract number from employee ID (e.g., EMP001 -> 1)
    const match = latestEmployee.employeeId.match(/\d+$/);
    if (match) {
      const nextNumber = parseInt(match[0]) + 1;
      return `EMP${String(nextNumber).padStart(3, '0')}`;
    }

    // Fallback: use timestamp-based ID
    return `EMP${Date.now().toString().slice(-6)}`;
  }
}

module.exports = new EmployeeService();

