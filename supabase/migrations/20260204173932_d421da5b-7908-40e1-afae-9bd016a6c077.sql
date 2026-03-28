-- Create wallet table (single row for balance)
CREATE TABLE public.wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;

-- Public read access for wallet balance
CREATE POLICY "Allow public read wallet" ON public.wallet
FOR SELECT USING (true);

-- Only allow updates (no direct insert/delete from client)
CREATE POLICY "Allow public update wallet" ON public.wallet
FOR UPDATE USING (true);

-- Create wallet transactions table
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.wallet(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'debit')),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  order_id uuid REFERENCES public.order_workflow(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read transactions" ON public.wallet_transactions
FOR SELECT USING (true);

-- Public insert access
CREATE POLICY "Allow public insert transactions" ON public.wallet_transactions
FOR INSERT WITH CHECK (true);

-- Create order items table (products within each order)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.order_workflow(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Public CRUD access
CREATE POLICY "Allow public read items" ON public.order_items
FOR SELECT USING (true);

CREATE POLICY "Allow public insert items" ON public.order_items
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update items" ON public.order_items
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete items" ON public.order_items
FOR DELETE USING (true);

-- Add total_cost to order_workflow
ALTER TABLE public.order_workflow 
ADD COLUMN total_cost DECIMAL(12, 2) DEFAULT NULL;

-- Insert initial wallet with 0 balance
INSERT INTO public.wallet (balance, currency) VALUES (0.00, 'USD');

-- Create trigger to update wallet updated_at
CREATE TRIGGER update_wallet_updated_at
BEFORE UPDATE ON public.wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();