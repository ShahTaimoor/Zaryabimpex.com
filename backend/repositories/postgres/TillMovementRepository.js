const { query } = require('../../config/postgres');
const { userDisplayNameSql } = require('../../utils/userDisplaySql');

const CREATED_BY_NAME = userDisplayNameSql('u');
const CASHIER_NAME = userDisplayNameSql('u');
const CREATED_BY_NAME_CU = userDisplayNameSql('cu');

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

class TillMovementRepository {
  async findBySessionId(sessionId, options = {}, client = null) {
    let sql = `
      SELECT tm.*, ${CREATED_BY_NAME} AS created_by_name
      FROM till_movements tm
      LEFT JOIN users u ON u.id = tm.created_by
      WHERE tm.till_session_id = $1
    `;
    const params = [sessionId];
    if (options.direction) {
      sql += ` AND tm.direction = $${params.length + 1}`;
      params.push(options.direction);
    }
    if (options.movementType) {
      sql += ` AND tm.movement_type = $${params.length + 1}`;
      params.push(options.movementType);
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
      'SELECT * FROM till_movements WHERE id = $1',
      [id],
      client
    );
    return rows[0] || null;
  }

  async create(data, client = null) {
    const sql = `
      INSERT INTO till_movements (
        till_session_id, movement_type, direction, amount,
        reference_type, reference_id, reference_number,
        description, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, CURRENT_TIMESTAMP))
      ON CONFLICT (till_session_id, movement_type, reference_type, reference_id)
        WHERE reference_id IS NOT NULL
      DO NOTHING
      RETURNING *
    `;
    const params = [
      data.tillSessionId || data.till_session_id,
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
         WHERE till_session_id = $1
           AND movement_type = $2
           AND reference_type = $3
           AND reference_id = $4
         LIMIT 1`,
        [
          data.tillSessionId || data.till_session_id,
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

  async findForReport(filters = {}) {
    let sql = `
      SELECT tm.*,
             ts.user_id AS cashier_id,
             ts.opened_at AS session_opened_at,
             ts.closed_at AS session_closed_at,
             ts.status AS session_status,
             ${CASHIER_NAME} AS cashier_name,
             ${CREATED_BY_NAME_CU} AS created_by_name
      FROM till_movements tm
      JOIN till_sessions ts ON ts.id = tm.till_session_id
      LEFT JOIN users u ON u.id = ts.user_id
      LEFT JOIN users cu ON cu.id = tm.created_by
      WHERE 1=1
    `;
    const params = [];
    let n = 1;

    if (filters.fromDate) {
      sql += ` AND tm.created_at >= $${n++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ` AND tm.created_at <= $${n++}`;
      params.push(filters.toDate);
    }
    if (filters.userId) {
      sql += ` AND ts.user_id = $${n++}`;
      params.push(filters.userId);
    }
    if (filters.tillSessionId) {
      sql += ` AND tm.till_session_id = $${n++}`;
      params.push(filters.tillSessionId);
    }
    if (filters.movementType) {
      sql += ` AND tm.movement_type = $${n++}`;
      params.push(filters.movementType);
    }
    if (filters.direction) {
      sql += ` AND tm.direction = $${n++}`;
      params.push(filters.direction);
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
}

module.exports = new TillMovementRepository();
