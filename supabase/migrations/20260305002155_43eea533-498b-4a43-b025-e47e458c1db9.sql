
CREATE OR REPLACE FUNCTION public.update_wallet_balance(p_wallet_id uuid, p_amount numeric, p_operation text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  IF p_operation = 'add' THEN
    UPDATE wallet SET balance = balance + p_amount WHERE id = p_wallet_id RETURNING balance INTO new_balance;
  ELSIF p_operation = 'subtract' THEN
    UPDATE wallet SET balance = balance - p_amount WHERE id = p_wallet_id RETURNING balance INTO new_balance;
  ELSE
    RAISE EXCEPTION 'Invalid operation: %', p_operation;
  END IF;
  
  RETURN new_balance;
END;
$$;
