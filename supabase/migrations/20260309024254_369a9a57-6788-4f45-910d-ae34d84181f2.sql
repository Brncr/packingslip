-- Add unique constraint for notification_read_status to enable upsert
ALTER TABLE public.notification_read_status 
ADD CONSTRAINT notification_read_status_notification_user_unique 
UNIQUE (notification_id, user_name);

-- Add update policy for notification_read_status
CREATE POLICY "Allow public update notification_read_status"
ON public.notification_read_status
FOR UPDATE
USING (true);

-- Add delete policy for notification_read_status  
CREATE POLICY "Allow public delete notification_read_status"
ON public.notification_read_status
FOR DELETE
USING (true);