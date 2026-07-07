import { createClient } from '@supabase/supabase-js';

// Null when env vars are missing so the calculator still works standalone —
// auth/save features check for sb before using it.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const sb = url && key ? createClient(url, key) : null;
