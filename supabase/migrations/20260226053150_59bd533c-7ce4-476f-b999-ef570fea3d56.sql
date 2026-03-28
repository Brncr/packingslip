
-- Insert deposit transactions for all currently paid orders
INSERT INTO wallet_transactions (wallet_id, type, amount, description, created_by, order_id)
SELECT 
  '22c05ddd-7fa8-4d0c-9d9e-769999c7973d',
  'deposit',
  total_cost,
  '#' || order_number || ': Payment received (migration)',
  'System',
  id
FROM order_workflow
WHERE payment_status = 'paid' AND total_cost > 0;

-- Update wallet balance: add sum of all paid order costs
UPDATE wallet 
SET balance = balance + (
  SELECT COALESCE(SUM(total_cost), 0) 
  FROM order_workflow 
  WHERE payment_status = 'paid' AND total_cost > 0
)
WHERE id = '22c05ddd-7fa8-4d0c-9d9e-769999c7973d';
