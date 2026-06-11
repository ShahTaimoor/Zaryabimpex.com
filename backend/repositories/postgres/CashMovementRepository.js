const { query } = require('../../config/postgres');
const { userDisplayNameSql } = require('../../utils/userDisplaySql');

const CREATED_BY_NAME = userDisplayNameSql('u');

function getClient(client) {
  return client && typeof client.query === 'function' ? client : null;
}

async function runQuery(sql, params, client) {
  const c = getClient(client);
  if (c) {
    const result = await c.query(sql, params);
    return result.rows;
  }
  const result = await query(sql, params);
  return result.rows;
}

class CashMovementRepository {
  async findByBusinessDate(businessDate, options = {}, client = null) {
    let sql = `
      SELECT tm.*, ${CREATED_BY_NAME} AS created_by_name
      FROM till_movements tm
      LEFT JOIN users u ON u.id = tm.created_by
      WHERE tm.business_date = $1
    `;
    const params = [businessDate];

    if (options.status) {
      sql += ` AND tm.status = $${params.length + 1}`;
      params.push(options.status);
    } else if (!options.includeCancelled) {
      sql += ` AND tm.status = 'active'`;
    }

    if (options.direction) {
      sql += ` AND tm.direction = $${params.length + 1}`;
      params.push(options.direction);
    }
    if (options.movementType) {
      sql += ` AND tm.movement_type = $${params.length + 1}`;
      params.push(options.movementType);
    }
    if (options.userId) {
      sql += ` AND tm.created_by = $${params.length + 1}`;
      params.push(options.userId);
    }

    sql += ' ORDER BY tm.created_at ASC, tm.id ASC';
    if (options.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    return runQuery(sql, params, client);
  }

  async findById(id, client = null) {
    const rows = await runQuery(
      `SELECT tm.*, ${CREATED_BY_NAME} AS created_by_name
       FROM till_movements tm
       LEFT JOIN users u ON u.id = tm.created_by
       WHERE tm.id = $1`,
      [id],
      client
    );
    return rows[0] || null;
  }

  async create(data, client = null) {
    const sql = `
      INSERT INTO till_movements (
        till_session_id, business_date, movement_type, direction, amount,
        reference_type, reference_id, reference_number,
        description, created_by, created_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_TIMESTAMP), 'active')
      ON CONFLICT (business_date, movement_type, reference_type, reference_id)
        WHERE reference_id IS NOT NULL AND status = 'active'
      DO NOTHING
      RETURNING *
    `;
    const params = [
      data.tillSessionId || data.till_session_id || null,
      data.businessDate || data.business_date,
      data.movementType || data.movement_type,
      data.direction,
      data.amount,
      data.referenceType || data.reference_type || null,
      data.referenceId || data.reference_id || null,
      data.referenceNumber || data.reference_number || null,
      data.description || '',
      data.createdBy || data.created_by || null,
      data.createdAt || data.created_at || null,
    ];
    const rows = await runQuery(sql, params, client);
    if (rows[0]) return rows[0];

    if (data.referenceId || data.reference_id) {
      const existing = await runQuery(
        `SELECT * FROM till_movements
         WHERE business_date = $1
           AND movement_type = $2
           AND reference_type = $3
           AND reference_id = $4
           AND status = 'active'
         LIMIT 1`,
        [
          data.businessDate || data.business_date,
          data.movementType || data.movement_type,
          data.referenceType || data.reference_type || null,
          data.referenceId || data.reference_id,
        ],
        client
      );
      return existing[0] || null;
    }
    return null;
  }

  async cancelById(id, { cancelledBy, reason }, client = null) {
    const sql = `
      UPDATE till_movements SET
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_by = $2,
        cancellation_reason = $3
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `;
    const rows = await runQuery(sql, [id, cancelledBy, reason || ''], client);
    return rows[0] || null;
  }

  async findForReport(filters = {}) {
    let sql = `
      SELECT tm.*, ${CREATED_BY_NAME} AS created_by_name
      FROM till_movements tm
      LEFT JOIN users u ON u.id = tm.created_by
      WHERE 1=1
    `;
    const params = [];
    let n = 1;

    if (filters.businessDate) {
      sql += ` AND tm.business_date = $${n++}`;
      params.push(filters.businessDate);
    }
    if (filters.fromDate) {
      sql += ` AND tm.business_date >= $${n++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ` AND tm.business_date <= $${n++}`;
      params.push(filters.toDate);
    }
    if (filters.userId) {
      sql += ` AND tm.created_by = $${n++}`;
      params.push(filters.userId);
    }
    if (filters.movementType) {
      sql += ` AND tm.movement_type = $${n++}`;
      params.push(filters.movementType);
    }
    if (filters.direction) {
      sql += ` AND tm.direction = $${n++}`;
      params.push(filters.direction);
    }
    if (filters.status) {
      sql += ` AND tm.status = $${n++}`;
      params.push(filters.status);
    } else if (!filters.includeCancelled) {
      sql += ` AND tm.status = 'active'`;
    }

    sql += ' ORDER BY tm.created_at DESC, tm.id DESC';
    if (filters.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${n++}`;
      params.push(filters.offset);
    }

    return runQuery(sql, params);
  }

  async getUserActivitySummary(fromDate, toDate) {
    const sql = `
      SELECT
        tm.created_by AS user_id,
        MAX(${CREATED_BY_NAME}) AS user_name,
        COUNT(*)::int AS movement_count,
        COALESCE(SUM(tm.amount) FILTER (WHERE tm.direction = 'in'), 0) AS cash_in,
        COALESCE(SUM(tm.amount) FILTER (WHERE tm.direction = 'out'), 0) AS cash_out
      FROM till_movements tm
      LEFT JOIN users u ON u.id = tm.created_by
      WHERE tm.status = 'active'
        AND tm.movement_type NOT IN ('opening')
        AND tm.business_date >= $1
        AND tm.business_date <= $2
      GROUP BY tm.created_by
      ORDER BY COALESCE(SUM(tm.amount) FILTER (WHERE tm.direction = 'in'), 0)
             + COALESCE(SUM(tm.amount) FILTER (WHERE tm.direction = 'out'), 0) DESC
    `;
    return runQuery(sql, [fromDate, toDate]);
  }
}

module.exports = new CashMovementRepository();
