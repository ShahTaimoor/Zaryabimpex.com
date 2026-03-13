const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    transaction: row.transaction_id,
    transactionId: row.transaction_id,
    customer: row.customer_id,
    customerId: row.customer_id,
    disputeNumber: row.dispute_number,
    disputeType: row.dispute_type,
    status: row.status,
    disputedAmount: parseFloat(row.disputed_amount) || 0,
    reason: row.reason,
    customerDescription: row.customer_description,
    internalNotes: row.internal_notes,
    resolution: row.resolution,
    resolutionAmount: row.resolution_amount != null ? parseFloat(row.resolution_amount) : null,
    resolutionNotes: row.resolution_notes,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    communications: row.communications || [],
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getNextDisputeNumber() {
  const result = await query(
    `UPDATE counters SET seq = seq + 1 WHERE name = 'dispute' RETURNING seq`
  );
  const seq = result.rows[0]?.seq ?? 1;
  const year = new Date().getFullYear();
  return `DSP-${year}-${String(seq).padStart(6, '0')}`;
}

class DisputeRepository {
  async create(data) {
    const disputeNumber = data.disputeNumber || await getNextDisputeNumber();
    const result = await query(
      `INSERT INTO disputes (
        transaction_id, customer_id, dispute_number, dispute_type, status,
        disputed_amount, reason, customer_description, communications,
        priority, due_date, created_by, assigned_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.transactionId ?? data.transaction,
        data.customerId ?? data.customer,
        disputeNumber,
        data.disputeType ?? data.dispute_type,
        data.status ?? 'open',
        data.disputedAmount ?? data.disputed_amount ?? 0,
        data.reason ?? '',
        data.customerDescription ?? data.customer_description ?? null,
        data.communications ? JSON.stringify(data.communications) : '[]',
        data.priority ?? 'medium',
        data.dueDate ?? data.due_date ?? null,
        data.createdBy ?? data.created_by,
        data.assignedTo ?? data.assigned_to ?? null
      ]
    );
    return toCamel(result.rows[0]);
  }

  async findById(id) {
    const result = await query('SELECT * FROM disputes WHERE id = $1', [id]);
    return toCamel(result.rows[0] || null);
  }

  async findOne(filters) {
    let sql = 'SELECT * FROM disputes WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.transactionId != null || filters.transaction != null) {
      sql += ` AND transaction_id = $${n++}`;
      params.push(filters.transactionId ?? filters.transaction);
    }
    if (filters.status) {
      sql += ` AND status = $${n++}`;
      params.push(filters.status);
    }
    if (Array.isArray(filters.statusIn) && filters.statusIn.length) {
      sql += ` AND status = ANY($${n++}::text[])`;
      params.push(filters.statusIn);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return toCamel(result.rows[0] || null);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM disputes WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.customerId != null || filters.customer != null) {
      sql += ` AND customer_id = $${n++}`;
      params.push(filters.customerId ?? filters.customer);
    }
    if (filters.status) {
      sql += ` AND status = $${n++}`;
      params.push(filters.status);
    }
    if (filters.disputeType != null) {
      sql += ` AND dispute_type = $${n++}`;
      params.push(filters.disputeType);
    }
    if (filters.statusIn && Array.isArray(filters.statusIn) && filters.statusIn.length) {
      sql += ` AND status = ANY($${n++}::text[])`;
      params.push(filters.statusIn);
    }
    if (filters.priority) {
      sql += ` AND priority = $${n++}`;
      params.push(filters.priority);
    }
    if (filters.assignedTo != null) {
      sql += ` AND assigned_to = $${n++}`;
      params.push(filters.assignedTo);
    }
    if (filters.overdue === true) {
      sql += ` AND due_date < CURRENT_TIMESTAMP`;
    }
    sql += ' ORDER BY CASE priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, due_date ASC NULLS LAST, created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(options.limit);
    }
    if (options.offset != null) {
      sql += ` OFFSET $${n++}`;
      params.push(options.offset);
    }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) FROM disputes WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.customerId != null || filters.customer != null) {
      sql += ` AND customer_id = $${n++}`;
      params.push(filters.customerId ?? filters.customer);
    }
    if (filters.status) {
      sql += ` AND status = $${n++}`;
      params.push(filters.status);
    }
    if (filters.disputeType != null) {
      sql += ` AND dispute_type = $${n++}`;
      params.push(filters.disputeType);
    }
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let n = 1;
    const map = {
      status: 'status',
      resolution: 'resolution',
      resolutionAmount: 'resolution_amount',
      resolutionNotes: 'resolution_notes',
      resolvedBy: 'resolved_by',
      resolvedAt: 'resolved_at',
      communications: 'communications',
      internalNotes: 'internal_notes',
      assignedTo: 'assigned_to'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${n++}`);
        const v = data[k];
        if (col === 'communications' && (Array.isArray(v) || (v && typeof v === 'object'))) {
          params.push(JSON.stringify(v));
        } else {
          params.push(v);
        }
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE disputes SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
      params
    );
    return toCamel(result.rows[0] || null);
  }
}

module.exports = new DisputeRepository();
