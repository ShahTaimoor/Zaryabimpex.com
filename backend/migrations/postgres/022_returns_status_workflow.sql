-- Allow status values for return workflow: pending → inspected → approved → processed (and existing completed/rejected/processing/received)
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (
  status IN (
    'pending',
    'inspected',
    'approved',
    'rejected',
    'processing',
    'received',
    'completed',
    'processed',
    'cancelled'
  )
);
