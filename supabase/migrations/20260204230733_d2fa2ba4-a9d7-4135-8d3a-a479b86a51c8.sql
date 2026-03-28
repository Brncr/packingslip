-- Drop existing check constraint
ALTER TABLE wallet_transactions DROP CONSTRAINT wallet_transactions_type_check;

-- Add new check constraint that includes 'refund'
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type = ANY (ARRAY['deposit', 'debit', 'refund']));