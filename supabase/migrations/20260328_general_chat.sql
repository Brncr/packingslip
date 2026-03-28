-- ============================================================
-- PART 18: General Chat Messages
-- ============================================================
CREATE TABLE public.general_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL DEFAULT 'Agent',
  content TEXT NOT NULL,
  order_number TEXT,
  order_workflow_id UUID REFERENCES public.order_workflow(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.general_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read general_chat" ON public.general_chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert general_chat" ON public.general_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete general_chat" ON public.general_chat_messages FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.general_chat_messages;
