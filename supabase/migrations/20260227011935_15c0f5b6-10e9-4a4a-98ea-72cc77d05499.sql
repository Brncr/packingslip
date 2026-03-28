
-- Create pending_debits table for approval workflow
CREATE TABLE public.pending_debits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_by text NOT NULL DEFAULT 'Agent',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  debit_type text NOT NULL DEFAULT 'item' CHECK (debit_type IN ('item', 'total_cost')),
  item_name text,
  item_price numeric,
  item_quantity integer DEFAULT 1,
  previous_total_cost numeric DEFAULT 0,
  new_total_cost numeric DEFAULT 0,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_debits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pending_debits" ON public.pending_debits FOR SELECT USING (true);
CREATE POLICY "Allow public insert pending_debits" ON public.pending_debits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pending_debits" ON public.pending_debits FOR UPDATE USING (true);
CREATE POLICY "Allow public delete pending_debits" ON public.pending_debits FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_debits;
