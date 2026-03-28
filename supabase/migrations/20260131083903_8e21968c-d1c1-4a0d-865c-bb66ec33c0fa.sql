-- Create comments table for orders
CREATE TABLE public.order_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.order_workflow(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anônimo',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read comments" ON public.order_comments FOR SELECT USING (true);
CREATE POLICY "Allow public insert comments" ON public.order_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete comments" ON public.order_comments FOR DELETE USING (true);

-- Create attachments table
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

-- Enable RLS
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

-- Public access policies
CREATE POLICY "Allow public read attachments" ON public.order_attachments FOR SELECT USING (true);
CREATE POLICY "Allow public insert attachments" ON public.order_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete attachments" ON public.order_attachments FOR DELETE USING (true);

-- Create storage bucket for order attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-attachments', 'order-attachments', true, 10485760);

-- Storage policies
CREATE POLICY "Public read order attachments" ON storage.objects FOR SELECT USING (bucket_id = 'order-attachments');
CREATE POLICY "Public upload order attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-attachments');
CREATE POLICY "Public delete order attachments" ON storage.objects FOR DELETE USING (bucket_id = 'order-attachments');

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_attachments;