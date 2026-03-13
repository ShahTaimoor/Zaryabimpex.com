const { query } = require('../../config/postgres');

const DEFAULT_ID = 'company_settings';

class SettingsRepository {
  async getSettings() {
    const result = await query(
      'SELECT * FROM settings WHERE id = $1 LIMIT 1',
      [DEFAULT_ID]
    );
    let row = result.rows[0];
    if (!row) {
      const insert = await query(
        `INSERT INTO settings (id, company_name, contact_number, address, created_at, updated_at)
         VALUES ($1, 'Zaryab Traders New 2024', '+1 (555) 123-4567', '123 Business Street, City, State, ZIP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [DEFAULT_ID]
      );
      row = insert.rows[0];
      if (!row) {
        const retry = await query('SELECT * FROM settings WHERE id = $1 LIMIT 1', [DEFAULT_ID]);
        row = retry.rows[0];
      }
    }

    if (!row) return null;

    // Transform snake_case to camelCase for frontend compatibility
    return {
      id: row.id,
      companyName: row.company_name,
      contactNumber: row.contact_number,
      address: row.address,
      logo: row.logo,
      email: row.email,
      website: row.website,
      taxId: row.tax_id,
      registrationNumber: row.registration_number,
      currency: row.currency,
      dateFormat: row.date_format,
      timeFormat: row.time_format,
      fiscalYearStart: row.fiscal_year_start,
      defaultTaxRate: row.default_tax_rate,
      printSettings: typeof row.print_settings === 'string' ? JSON.parse(row.print_settings) : (row.print_settings || {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateSettings(updates) {
    const settings = await this.getSettings();
    if (!settings) throw new Error('Settings not found');

    const map = {
      companyName: 'company_name',
      contactNumber: 'contact_number',
      address: 'address',
      logo: 'logo',
      email: 'email',
      website: 'website',
      taxId: 'tax_id',
      registrationNumber: 'registration_number',
      currency: 'currency',
      dateFormat: 'date_format',
      timeFormat: 'time_format',
      fiscalYearStart: 'fiscal_year_start',
      defaultTaxRate: 'default_tax_rate',
      printSettings: 'print_settings'
    };
    const setClauses = [];
    const params = [];
    let paramCount = 1;
    for (const [k, col] of Object.entries(map)) {
      if (updates[k] !== undefined) {
        setClauses.push(`${col} = $${paramCount++}`);
        params.push(typeof updates[k] === 'object' ? JSON.stringify(updates[k]) : updates[k]);
      }
    }
    if (setClauses.length === 0) return settings;
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(DEFAULT_ID);
    const result = await query(
      `UPDATE settings SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    
    // Return transformed settings
    return await this.getSettings();
  }
}

module.exports = new SettingsRepository();
