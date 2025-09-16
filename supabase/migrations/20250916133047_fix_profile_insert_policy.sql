-- Policy: Individuals can insert their own profile.
CREATE POLICY "Allow individual insert access" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);