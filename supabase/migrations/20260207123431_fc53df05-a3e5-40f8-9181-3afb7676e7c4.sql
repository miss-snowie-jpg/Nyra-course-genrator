-- Allow anyone (including unauthenticated users) to view courses that have sharing enabled
CREATE POLICY "Anyone can view shared courses"
ON public.courses
FOR SELECT
USING (share_enabled = true);