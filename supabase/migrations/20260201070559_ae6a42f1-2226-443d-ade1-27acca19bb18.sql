-- Enable realtime for order_workflow table
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_workflow;

-- Enable realtime for order_stage_history table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_stage_history;