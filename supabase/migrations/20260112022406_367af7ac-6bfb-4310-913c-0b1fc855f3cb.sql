-- Create table to store generated spreadsheets
CREATE TABLE public.generated_spreadsheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_url TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public access for now since no auth)
ALTER TABLE public.generated_spreadsheets ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access" 
ON public.generated_spreadsheets 
FOR SELECT 
USING (true);

-- Create policy for public insert access
CREATE POLICY "Allow public insert access" 
ON public.generated_spreadsheets 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public delete access
CREATE POLICY "Allow public delete access" 
ON public.generated_spreadsheets 
FOR DELETE 
USING (true);