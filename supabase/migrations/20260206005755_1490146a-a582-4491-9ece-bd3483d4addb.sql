-- Allow public delete on wallet_transactions for clearing
CREATE POLICY "Allow public delete transactions" 
ON public.wallet_transactions 
FOR DELETE 
USING (true);