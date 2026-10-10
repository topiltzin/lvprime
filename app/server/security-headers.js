// Response headers for every page and API response. vercel.json repeats them for
// the static files Vercel serves directly (it can't import this module);
// tests/unit/security-headers.test.js keeps the two in sync.
//
// CSP notes: scripts are bundled by Vite (no inline <script>); styles need
// 'unsafe-inline' for style="" attributes (trend-chart legend swatches, sanitized
// Markdown). PDFs are generated in the browser and downloaded through blob: URLs.
// Not applied by the Vite dev server, whose HMR client needs inline scripts and a
// websocket.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'frame-src https://www.youtube-nocookie.com',
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!res.hasHeader(name)) res.setHeader(name, value);
  }
}
