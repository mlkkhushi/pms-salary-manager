import { createClient } from '@supabase/supabase-js'

// Yahan Supabase se copy ki hui URL paste karein
const supabaseUrl = 'https://unxeraehsvhvatznyrwq.supabase.co'

// Yahan Supabase se copy ki hui anon public key paste karein
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueGVyYWVoc3ZodmF0em55cndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MjgwNzAsImV4cCI6MjA3MzMwNDA3MH0.wYVrRusQdQgIKkZqAgSrg9kpfLce28VTiH-viESchyw'

export const supabase = createClient(supabaseUrl, supabaseKey)