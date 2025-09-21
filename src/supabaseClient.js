import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// --- YEH HAI AHEM TABDEELI ---
// Hum ek custom fetch function banayenge jo offline hone par network request ko rok dega.
const customFetch = (input, init) => {
  // Agar browser offline hai, to foran error bhej do taake Supabase timeout ka intezar na kare.
  if (!navigator.onLine) {
    return Promise.reject(new TypeError('Failed to fetch (app is offline)'));
  }
  // Agar online hain, to normal tareeqe se fetch karo.
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
  // --- YEH HAI AHEM TABDEELI ---
  // Hum Supabase ko batayenge ke woh hamara custom fetch function istemal kare.
  global: {
    fetch: customFetch,
  },
})