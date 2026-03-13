-- Add amount_paid to sales for storing received amount on invoice (edit / print)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(15, 2) DEFAULT 0;
