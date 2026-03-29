-- Add freight_agent column to order_workflow
ALTER TABLE order_workflow ADD COLUMN IF NOT EXISTS freight_agent text DEFAULT null;
