import { randomUUID } from 'node:crypto';

const buckets = new Map();

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req) {
  const forwarded = req.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown').slice(0, 120);
}

export function securityHeaders(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://files.monday.com https://*.monday.com",
      "connect-src 'self' https://api.monday.com https://*.vercel.app https://vybepainel-v2.vercel.app",
      "worker-src 'self' blob:",
      "form-action 'self'"
    ].join('; ')
  });
  if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('X-Request-Id', randomUUID());
  next();
}

export function createRateLimiter({ windowMs = 60_000, max = 120, name = 'api' } = {}) {
  const safeWindow = positiveInteger(windowMs, 60_000);
  const safeMax = positiveInteger(max, 120);
  return (req, res, next) => {
    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || now - current.startedAt >= safeWindow
      ? { startedAt: now, count: 0 }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > 2_000) {
      for (const [storedKey, stored] of buckets) {
        if (now - stored.startedAt >= safeWindow) buckets.delete(storedKey);
      }
    }

    res.set('X-RateLimit-Limit', String(safeMax));
    res.set('X-RateLimit-Remaining', String(Math.max(0, safeMax - bucket.count)));
    if (bucket.count > safeMax) {
      const retryAfter = Math.max(1, Math.ceil((safeWindow - (now - bucket.startedAt)) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Muitas leituras em sequência. Aguarde antes de tentar novamente.' });
    }
    return next();
  };
}

export function rateLimitConfig() {
  return {
    public: {
      windowMs: positiveInteger(process.env.NEXUS_RATE_LIMIT_WINDOW_MS, 60_000),
      max: positiveInteger(process.env.NEXUS_RATE_LIMIT_MAX, 120)
    },
    admin: {
      windowMs: positiveInteger(process.env.NEXUS_ADMIN_RATE_LIMIT_WINDOW_MS, 60_000),
      max: positiveInteger(process.env.NEXUS_ADMIN_RATE_LIMIT_MAX, 30)
    }
  };
}
