-- Create workflow_stages table for dynamic columns
CREATE TABLE public.workflow_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-blue-500',
  position INTEGER NOT NULL DEFAULT 0,
  wip_limit INTEGER DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

-- Public access policies (like other tables in the project)
CREATE POLICY "Allow public read stages" ON public.workflow_stages
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert stages" ON public.workflow_stages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update stages" ON public.workflow_stages
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete stages" ON public.workflow_stages
  FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_workflow_stages_updated_at
  BEFORE UPDATE ON public.workflow_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default stages matching current enum values
INSERT INTO public.workflow_stages (name, color, position) VALUES
  ('Novo', 'bg-blue-500', 0),
  ('Em Produção', 'bg-yellow-500', 1),
  ('Pronto', 'bg-green-500', 2),
  ('Enviado', 'bg-purple-500', 3),
  ('Entregue', 'bg-gray-500', 4);

-- Add stage_id column to order_workflow (nullable for migration)
ALTER TABLE public.order_workflow 
  ADD COLUMN stage_id UUID REFERENCES public.workflow_stages(id);

-- Enable realtime for stages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_stages;