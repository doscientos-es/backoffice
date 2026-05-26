// Global vitest setup
// Stub required env vars so modules that parse env at import-time don't crash.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key-aaaaaaaaaaaaaaaaaaaa";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key-aaaaaaaaaaaaaaaa";
