/* ─── FLARM GLOBAL — Supabase Configuration ─── */
'use strict';

const SUPABASE_URL =
  'https://hgfcbqodmofrjtsuawdk.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_ErPzpo7DCu4DANNAAzOEgA_-UlyJq_i';

let sb = null;
let SB_READY = false;

try {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== 'function'
  ) {
    throw new Error(
      'Supabase library failed to load.'
    );
  }

  if (
    !SUPABASE_URL.trim() ||
    !SUPABASE_ANON_KEY.trim() ||
    SUPABASE_ANON_KEY ===
      'PASTE_YOUR_ACTUAL_PUBLIC_KEY_HERE'
  ) {
    throw new Error(
      'Supabase URL or public key is missing.'
    );
  }

  sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  SB_READY = true;

  console.log(
    'FLARM Supabase client initialized successfully.'
  );
} catch (err) {
  console.error(
    'FLARM Supabase initialization failed:',
    err.message
  );
}