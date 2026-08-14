import 'server-only'

// Response caps for admin list endpoints. Bounds worst-case wire size
// regardless of how large the underlying tables grow. If Meea needs to
// see beyond these numbers we add pagination — not a raise.
export const ADMIN_ENROLLMENTS_LIMIT = 200
export const ADMIN_INQUIRIES_LIMIT = 200
export const ADMIN_SESSIONS_LIMIT = 300

// Bulk voucher operations. Beyond this, admin uses multiple submits.
export const ADMIN_VOUCHER_BULK_INSERT_LIMIT = 200
export const ADMIN_VOUCHER_BULK_DELETE_LIMIT = 200

// Very loose UUID v1-v5 check. Enough to defend against SQL identifier
// mischief before we hand ids to supabaseAdmin; the DB is authoritative.
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
