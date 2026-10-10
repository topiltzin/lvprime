// Parses a stored exercise-video link into a YouTube video id (+ start offset) and builds
// the privacy-enhanced embed URL (specs/017-in-page-video-player/data-model.md). Pure — no DOM.
// Returns null for anything that is not a recognisable YouTube link so callers fall back to
// opening the original link in a new tab.

const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function parseStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !(match[1] || match[2] || match[3])) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export function parseVideoUrl(url) {
  if (typeof url !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/')[1] ?? null;
  } else if (WATCH_HOSTS.has(host)) {
    const [, first, second] = parsed.pathname.split('/');
    if (first === 'watch') id = parsed.searchParams.get('v');
    else if (first === 'embed' || first === 'shorts') id = second ?? null;
  } else {
    return null;
  }
  if (!id || !ID_PATTERN.test(id)) return null;

  const start = parseStart(parsed.searchParams.get('t') ?? parsed.searchParams.get('start'));
  return { id, start };
}

export function buildEmbedUrl({ id, start = 0 }) {
  const base = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  return start > 0 ? `${base}&start=${start}` : base;
}
