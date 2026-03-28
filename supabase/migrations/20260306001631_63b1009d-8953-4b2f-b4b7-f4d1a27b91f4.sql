
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
