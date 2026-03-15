const cityRepository = require('../repositories/CityRepository');
const customerRepository = require('../repositories/CustomerRepository');
const supplierRepository = require('../repositories/SupplierRepository');

class CityService {
  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {object} - Filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Search filter
    if (queryParams.search) {
      filter.search = queryParams.search;
    }

    // Active status filter
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }

    // State filter
    if (queryParams.state) {
      filter.state = queryParams.state;
    }

    return filter;
  }

  /**
   * Get cities with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getCities(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 50;

    const filter = this.buildFilter(queryParams);

    const result = await cityRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { name: 1 }
    });

    return result;
  }

  /**
   * Get active cities (for dropdowns)
   * @returns {Promise<Array>}
   */
  async getActiveCities() {
    return await cityRepository.findActive();
  }

  /**
   * Get single city by ID
   * @param {string} id - City ID
   * @returns {Promise<City>}
   */
  async getCityById(id) {
    const city = await cityRepository.findById(id);
    
    if (!city) {
      throw new Error('City not found');
    }

    return city;
  }

  /**
   * Create new city
   * @param {object} cityData - City data
   * @param {string} userId - User ID creating the city
   * @returns {Promise<{city: City, message: string}>}
   */
  async createCity(cityData, userId) {
    // Check if city name already exists
    const nameExists = await cityRepository.nameExists(cityData.name);
    if (nameExists) {
      throw new Error('City with this name already exists');
    }

    const dataWithUser = {
      name: cityData.name.trim(),
      state: cityData.state ? cityData.state.trim() : undefined,
      country: cityData.country ? cityData.country.trim() : 'US',
      description: cityData.description ? cityData.description.trim() : undefined,
      isActive: cityData.isActive !== undefined ? cityData.isActive : true,
      createdBy: userId
    };

    const city = await cityRepository.create(dataWithUser);
    
    return {
      city,
      message: 'City created successfully'
    };
  }

  /**
   * Update city
   * @param {string} id - City ID
   * @param {object} updateData - Data to update
   * @param {string} userId - User ID updating the city
   * @returns {Promise<{city: City, message: string}>}
   */
  async updateCity(id, updateData, userId) {
    const city = await cityRepository.findById(id);
    if (!city) {
      throw new Error('City not found');
    }

    // Check if name is being changed and if new name already exists
    if (updateData.name && updateData.name.trim() !== city.name) {
      const nameExists = await cityRepository.nameExists(updateData.name, id);
      if (nameExists) {
        throw new Error('City with this name already exists');
      }
    }

    const dataToUpdate = {
      ...updateData,
      updatedBy: userId
    };

    // Clean up the data
    if (dataToUpdate.name) dataToUpdate.name = dataToUpdate.name.trim();
    if (dataToUpdate.state !== undefined) dataToUpdate.state = dataToUpdate.state ? dataToUpdate.state.trim() : undefined;
    if (dataToUpdate.country !== undefined) dataToUpdate.country = dataToUpdate.country.trim();
    if (dataToUpdate.description !== undefined) dataToUpdate.description = dataToUpdate.description ? dataToUpdate.description.trim() : undefined;

    const updatedCity = await cityRepository.updateById(id, dataToUpdate);

    return {
      city: updatedCity,
      message: 'City updated successfully'
    };
  }

  /**
   * Delete city
   * @param {string} id - City ID
   * @returns {Promise<{message: string}>}
   */
  async deleteCity(id) {
    const city = await cityRepository.findById(id);
    if (!city) {
      throw new Error('City not found');
    }

    // Check if city is being used by customers or suppliers
    // Using PostgreSQL JSONB search for city name in address field
    const { query } = require('../config/postgres');
    
    const customersUsingCity = await query(
      "SELECT 1 FROM customers WHERE address::text ILIKE $1 AND is_deleted = FALSE LIMIT 1",
      [`%${city.name}%`]
    );

    const suppliersUsingCity = await query(
      "SELECT 1 FROM suppliers WHERE address::text ILIKE $1 AND is_deleted = FALSE LIMIT 1",
      [`%${city.name}%`]
    );

    if (customersUsingCity.rows.length > 0 || suppliersUsingCity.rows.length > 0) {
      throw new Error('Cannot delete city. It is being used by customers or suppliers. Deactivate it instead.');
    }

    await cityRepository.updateById(id, { isActive: false });

    return {
      message: 'City deleted successfully'
    };
  }

  async checkNameExists(name, excludeId = null) {
    return await cityRepository.nameExists(name, excludeId);
  }
}

module.exports = new CityService();

