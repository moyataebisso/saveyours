import 'server-only'

// Shared spam-defense for every public POST route. One module, called first,
// so we can never accidentally forget a route. The in-process rate-limit Map
// is best-effort only — Vercel runs multiple isolated instances and they do
// not share memory. Real rate-limiting belongs at the WAF; this is a cheap
// first filter that catches back-to-back submissions within one instance.

// SMS-to-email gateways. Real inquiries never come from these; hits go
// straight to silent-accept.
export const SMS_GATEWAY_DOMAINS = new Set([
  'vtext.com',
  'txt.att.net',
  'tmomail.net',
  'msg.fi.google.com',
  'vzwpix.com',
  'mms.att.net',
  'pm.sprint.com',
])

const GMAIL_LIKE_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

const rateLimitStore = new Map<string, number[]>()

const ONE_HOUR_MS = 60 * 60 * 1000

export interface FormGuardOptions {
  formName: string
  honeypot?: boolean
  timing?: { minSeconds: number }
  gibberishFields?: string[]
  selectDefaults?: Array<{ field: string; defaultValue: string }>
  emailField?: string
  rateLimit?: { maxPerHour: number; identifierField: string }
}

export type FormGuardDecision =
  | { decision: 'proceed'; suspicious: false }
  | { decision: 'proceed'; suspicious: true; reason: string }
  | { decision: 'silent-accept'; reason: string }

function getStringField(body: unknown, field: string): string {
  if (!body || typeof body !== 'object') return ''
  const raw = (body as Record<string, unknown>)[field]
  return typeof raw === 'string' ? raw : ''
}

function getNumberField(body: unknown, field: string): number | null {
  if (!body || typeof body !== 'object') return null
  const raw = (body as Record<string, unknown>)[field]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// Gmail treats codyrgabor@gmail.com, c.o.d.y.r.g.a.b.o.r@gmail.com, and
// codyrgabor+spam@gmail.com as the same mailbox. Normalize to the canonical
// form for rate-limit keying so we can't be bypassed with dot/plus tricks.
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at < 0) return trimmed
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (GMAIL_LIKE_DOMAINS.has(domain)) {
    const beforePlus = local.split('+')[0]
    const noDots = beforePlus.replace(/\./g, '')
    return `${noDots}@gmail.com`
  }
  return trimmed
}

export function isSmsGateway(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  return SMS_GATEWAY_DOMAINS.has(email.slice(at + 1).toLowerCase())
}

// Gibberish heuristic for name / location fields. Deliberately conservative
// — false negatives (letting bot strings through) are safer than false
// positives (rejecting real names). Skipped entirely for any string that
// has a space, hyphen, apostrophe, period, or non-ASCII character.
export function looksLikeGibberish(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  if (/[\s\-'.]/.test(trimmed)) return false
  if (/[^\x00-\x7f]/.test(trimmed)) return false

  // Rule 1: long string with 3+ case transitions (aBcDeFgHi patterns).
  if (trimmed.length > 12 && countCaseTransitions(trimmed) >= 3) return true

  // Rule 2: consonant run of 5 or more. Y counted as a vowel here so
  // Krzysztof, Rhys, Yves all survive.
  if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(trimmed)) return true

  // Rule 3: no ASCII vowels at all, AND length > 4. The length gate is to
  // protect real short surnames like Ng, Ky, Xu.
  if (trimmed.length > 4 && !/[aeiouy]/i.test(trimmed)) return true

  return false
}

function countCaseTransitions(s: string): number {
  let count = 0
  for (let i = 1; i < s.length; i++) {
    const prev = s.charCodeAt(i - 1)
    const curr = s.charCodeAt(i)
    const prevLower = prev >= 97 && prev <= 122
    const prevUpper = prev >= 65 && prev <= 90
    const currLower = curr >= 97 && curr <= 122
    const currUpper = curr >= 65 && curr <= 90
    if (!(prevLower || prevUpper) || !(currLower || currUpper)) continue
    if ((prevLower && currUpper) || (prevUpper && currLower)) count++
  }
  return count
}

function checkRate(key: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now()
  const stamps = (rateLimitStore.get(key) ?? []).filter((t) => now - t < windowMs)
  if (stamps.length >= maxCount) return false
  stamps.push(now)
  rateLimitStore.set(key, stamps)
  return true
}

// Compares Origin header host against the request host. Log-only in this
// phase — never blocks. Review the logs, then flip enforcement on in a
// separate change.
function logOriginMismatch(req: Request, formName: string): void {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host') || ''
  if (!origin) {
    console.warn('[FORM_GUARD] Missing Origin header (LOG-ONLY, not blocking)', {
      formName,
      host,
    })
    return
  }
  try {
    const originHost = new URL(origin).host
    if (originHost !== host) {
      console.warn('[FORM_GUARD] Origin mismatch (LOG-ONLY, not blocking)', {
        formName,
        origin,
        originHost,
        host,
      })
    }
  } catch {
    console.warn('[FORM_GUARD] Invalid Origin header (LOG-ONLY, not blocking)', {
      formName,
      origin,
      host,
    })
  }
}

// Every public POST route should call this before any other processing.
// Returns either 'silent-accept' (route returns a form-shaped 200 without
// doing any work) or 'proceed' (with an optional suspicious flag the route
// should use to annotate persisted data / notification emails).
export function checkFormSubmission(
  req: Request,
  body: unknown,
  opts: FormGuardOptions
): FormGuardDecision {
  logOriginMismatch(req, opts.formName)

  if (opts.honeypot && getStringField(body, 'website').trim() !== '') {
    console.warn('[FORM_GUARD] Honeypot filled', { form: opts.formName })
    return { decision: 'silent-accept', reason: 'honeypot' }
  }

  if (opts.timing) {
    const mountedAt = getNumberField(body, 'mountedAt')
    if (mountedAt === null) {
      console.warn('[FORM_GUARD] Missing mountedAt', { form: opts.formName })
      return { decision: 'silent-accept', reason: 'timing-missing' }
    }
    const elapsedMs = Date.now() - mountedAt
    if (elapsedMs < opts.timing.minSeconds * 1000) {
      console.warn('[FORM_GUARD] Timing check failed', {
        form: opts.formName,
        elapsedMs,
      })
      return { decision: 'silent-accept', reason: 'timing' }
    }
  }

  if (opts.emailField) {
    const email = getStringField(body, opts.emailField).trim().toLowerCase()
    if (email && isSmsGateway(email)) {
      console.warn('[FORM_GUARD] SMS gateway email', {
        form: opts.formName,
        emailDomain: email.slice(email.lastIndexOf('@') + 1),
      })
      return { decision: 'silent-accept', reason: 'sms-gateway' }
    }
  }

  if (opts.rateLimit) {
    const raw = getStringField(body, opts.rateLimit.identifierField)
    const identifier = raw
      ? normalizeEmail(raw)
      : (req.headers.get('x-forwarded-for') ?? 'unknown')
    const key = `${opts.formName}::${identifier}`
    if (!checkRate(key, opts.rateLimit.maxPerHour, ONE_HOUR_MS)) {
      console.warn('[FORM_GUARD] Rate limit exceeded', {
        form: opts.formName,
        identifier,
      })
      return { decision: 'silent-accept', reason: 'rate-limit' }
    }
  }

  if (opts.gibberishFields) {
    for (const field of opts.gibberishFields) {
      const val = getStringField(body, field)
      if (val && looksLikeGibberish(val)) {
        console.warn('[FORM_GUARD] Gibberish detected', {
          form: opts.formName,
          field,
        })
        return { decision: 'silent-accept', reason: `gibberish-${field}` }
      }
    }
  }

  // Dropdown-default only reaches this point when no other silent-accept
  // signal fired. Standing alone, it's suspicious but not disqualifying —
  // deliver, but flag so the recipient can eyeball it.
  if (opts.selectDefaults && opts.selectDefaults.length > 0) {
    const allDefault = opts.selectDefaults.every((sel) => {
      const val = getStringField(body, sel.field)
      return val === sel.defaultValue
    })
    if (allDefault) {
      console.warn('[FORM_GUARD] All selects at default (proceed-suspicious)', {
        form: opts.formName,
      })
      return {
        decision: 'proceed',
        suspicious: true,
        reason: 'all-selects-default',
      }
    }
  }

  return { decision: 'proceed', suspicious: false }
}
