-- Add archived column to order_workflow table
ALTER TABLE public.order_workflow 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for better performance when filtering archived orders
CREATE INDEX idx_order_workflow_archived ON public.order_workflow(archived);