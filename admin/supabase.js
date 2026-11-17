
const SUPABASE_URL = "https://tljpepeuytgsyhbqiswq.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_UU80Kg9wvEJ1_9jx7vesOg_v42-tmsZ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
