// Vitest shim for the `server-only` package. The real package throws when
// imported from a client bundle; under tests we want server modules to load
// freely so we can mock Supabase/Stripe and exercise the handlers.
export {}
