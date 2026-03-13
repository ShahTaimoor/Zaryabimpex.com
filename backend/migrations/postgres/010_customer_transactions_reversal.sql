-- Migration 010: Add reversal tracking to customer_transactions
ALTER TABLE customer_transactions
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES customer_transactions(id),
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP;
