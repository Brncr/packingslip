-- ============================================================
-- PackingSlip: COMPLETE DATABASE SETUP
-- Run this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- PART 0: BASE SCHEMA (pre-migration tables)
-- These tables were originally created by Lovable and
-- are referenced by all subsequent migrations.
-- ============================================================

-- Create the order_stage enum
CREATE TYPE public.order_stage AS ENUM ('novo', 'em_producao', 'pronto', 'enviado', 'entregue');

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- order_workflow (base table, referenced by most others)
CREATE TABLE public.order_workflow (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  current_stage public.order_stage NOT NULL DEFAULT 'novo',
  notes TEXT,
  notify_customer BOOLEAN NOT NULL DEFAULT false,
  spreadsheet_id TEXT,
  spreadsheet_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read order_workflow" ON public.order_workflow FOR SELECT USING (true);
CREATE POLICY "Allow public insert order_workflow" ON public.order_workflow FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update order_workflow" ON public.order_workflow FOR UPDATE USING (true);
CREATE POLICY "Allow public delete order_workflow" ON public.order_workflow FOR DELETE USING (true);

CREATE TRIGGER update_order_workflow_updated_at
  BEFORE UPDATE ON public.order_workflow
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- order_stage_history
CREATE TABLE public.order_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  from_stage public.order_stage,
  to_stage public.order_stage NOT NULL,
  notified_customer BOOLEAN NOT NULL DEFAULT false,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read order_stage_history" ON public.order_stage_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert order_stage_history" ON public.order_stage_history FOR INSERT WITH CHECK (true);

-- activity_notifications
CREATE TABLE public.activity_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read notifications" ON public.activity_notifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert notifications" ON public.activity_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete notifications" ON public.activity_notifications FOR DELETE USING (true);

-- notification_read_status
CREATE TABLE public.notification_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.activity_notifications(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read notification_read_status" ON public.notification_read_status FOR SELECT USING (true);
CREATE POLICY "Allow public insert notification_read_status" ON public.notification_read_status FOR INSERT WITH CHECK (true);

-- app_settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update app_settings" ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete app_settings" ON public.app_settings FOR DELETE USING (true);

-- ============================================================
-- PART 1: Migration 20260112 - generated_spreadsheets
-- ============================================================
CREATE TABLE public.generated_spreadsheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_url TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_spreadsheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.generated_spreadsheets FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.generated_spreadsheets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.generated_spreadsheets FOR DELETE USING (true);

-- ============================================================
-- PART 2: Migration 20260131 - order_comments + order_attachments
-- ============================================================
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anônimo',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read comments" ON public.order_comments FOR SELECT USING (true);
CREATE POLICY "Allow public insert comments" ON public.order_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete comments" ON public.order_comments FOR DELETE USING (true);

CREATE TABLE public.order_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT NOT NULL DEFAULT 'Anônimo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read attachments" ON public.order_attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert attachments" ON public.order_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete attachments" ON public.order_attachments FOR DELETE USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-attachments', 'order-attachments', true, 10485760);

CREATE POLICY "Public read order attachments" ON storage.objects FOR SELECT USING (bucket_id = 'order-attachments');
CREATE POLICY "Public upload order attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-attachments');
CREATE POLICY "Public delete order attachments" ON storage.objects FOR DELETE USING (bucket_id = 'order-attachments');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_attachments;

-- ============================================================
-- PART 3: Migration 20260201 - realtime for order_workflow + history
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_workflow;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_stage_history;

-- ============================================================
-- PART 4: Migration 20260203 - workflow_stages (dynamic columns)
-- ============================================================
CREATE TABLE public.workflow_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500',
  position INTEGER NOT NULL DEFAULT 0,
  wip_limit INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read stages" ON public.workflow_stages FOR SELECT USING (true);
CREATE POLICY "Allow public insert stages" ON public.workflow_stages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stages" ON public.workflow_stages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stages" ON public.workflow_stages FOR DELETE USING (true);

CREATE TRIGGER update_workflow_stages_updated_at
  BEFORE UPDATE ON public.workflow_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.workflow_stages (name, color, position) VALUES
  ('Novo', 'bg-blue-500', 0),
  ('Em Produção', 'bg-yellow-500', 1),
  ('Pronto', 'bg-green-500', 2),
  ('Enviado', 'bg-purple-500', 3),
  ('Entregue', 'bg-gray-500', 4);

ALTER TABLE public.order_workflow 
  ADD COLUMN stage_id UUID REFERENCES public.workflow_stages(id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_stages;

-- ============================================================
-- PART 5: Migration 20260204a - archived column
-- ============================================================
ALTER TABLE public.order_workflow 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

CREATE INDEX idx_order_workflow_archived ON public.order_workflow(archived);

-- ============================================================
-- PART 6: Migration 20260204b - wallet, transactions, order_items
-- ============================================================
CREATE TABLE public.wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read wallet" ON public.wallet FOR SELECT USING (true);
CREATE POLICY "Allow public update wallet" ON public.wallet FOR UPDATE USING (true);

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

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read transactions" ON public.wallet_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (true);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.order_workflow(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update items" ON public.order_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete items" ON public.order_items FOR DELETE USING (true);

ALTER TABLE public.order_workflow 
ADD COLUMN total_cost DECIMAL(12, 2) DEFAULT NULL;

-- Insert initial wallet with 0 balance
INSERT INTO public.wallet (balance, currency) VALUES (0.00, 'USD');

CREATE TRIGGER update_wallet_updated_at
BEFORE UPDATE ON public.wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 7: Migration 20260204c - refund type
-- ============================================================
ALTER TABLE wallet_transactions DROP CONSTRAINT wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type = ANY (ARRAY['deposit', 'debit', 'refund']));

-- ============================================================
-- PART 8: Migration 20260205 - pg_cron + pg_net
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================
-- PART 9: Migration 20260206 - delete on wallet_transactions
-- ============================================================
CREATE POLICY "Allow public delete transactions" ON public.wallet_transactions FOR DELETE USING (true);

-- ============================================================
-- PART 10: Migration 20260224 - payment_status on order_workflow
-- ============================================================
ALTER TABLE public.order_workflow ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';

-- ============================================================
-- PART 11: SKIPPED - Data migration (wallet deposit from old data)
-- Not needed for a fresh database.
-- ============================================================

-- ============================================================
-- PART 12: Migration 20260227a - receipt_url on wallet_transactions
-- ============================================================
ALTER TABLE public.wallet_transactions ADD COLUMN receipt_url text DEFAULT NULL;

-- ============================================================
-- PART 13: Migration 20260227b - pending_debits table 
-- ============================================================
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_debits;

-- ============================================================
-- PART 14: Migration 20260302 - audit_logs table
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  order_number text,
  customer_name text,
  description text NOT NULL,
  performed_by text NOT NULL DEFAULT 'System',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- ============================================================
-- PART 15: Migration 20260305 - update_wallet_balance function
-- ============================================================
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

-- ============================================================
-- PART 16: Migration 20260306 - card_read_status table
-- ============================================================
CREATE TABLE public.card_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, user_name)
);

ALTER TABLE public.card_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read card_read_status" ON public.card_read_status FOR SELECT USING (true);
CREATE POLICY "Allow public insert card_read_status" ON public.card_read_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update card_read_status" ON public.card_read_status FOR UPDATE USING (true);

-- ============================================================
-- PART 17: Migration 20260309 - notification_read_status updates
-- ============================================================
ALTER TABLE public.notification_read_status 
ADD CONSTRAINT notification_read_status_notification_user_unique 
UNIQUE (notification_id, user_name);

CREATE POLICY "Allow public update notification_read_status"
ON public.notification_read_status
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete notification_read_status"
ON public.notification_read_status
FOR DELETE
USING (true);

-- ============================================================
-- DONE! All tables, policies, functions, and triggers created.
-- ============================================================
