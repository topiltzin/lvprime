# Data Model: In-Page Exercise Video Player

No persisted data is added or changed. No migration.

## Existing (read-only): Exercise demo video

| Field | Source | Notes |
|-------|--------|-------|
| `exercise.name` | parsed program | Used as dialog title and accessible name. |
| `exercise.videoUrl` | exercise library map (feature 007) | `string \| null`. Today always `https://www.youtube.com/watch?v=<11-char id>`. |

## Derived (pure, in `src/lib/video-embed.js`)

`parseVideoUrl(url) -> { id: string, start: number } | null`

| Rule | Detail |
|------|--------|
| Accepted hosts | `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `youtube-nocookie.com` |
| Accepted shapes | `/watch?v=ID`, `/embed/ID`, `/shorts/ID`, `youtu.be/ID` |
| `id` | must match `^[A-Za-z0-9_-]{11}$`, else `null` |
| `start` | from `t` or `start` (`90`, `90s`, `1m30s`), integer seconds >= 0, default 0 |
| Anything else | `null` (caller keeps the plain new-tab link) |

`buildEmbedUrl({ id, start }) -> string` returns
`https://www.youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1&rel=0&modestbranding=1[&start=N]`.

## Transient dialog state (in memory only)

| Field | Meaning |
|-------|---------|
| `status` | `loading` -> `ready` or `failed` (timeout 10 s) |
| `opener` | element to refocus on close |
| `pushedHistory` | whether our history entry is still on the stack |

State transitions: `closed -> loading` (tap) `-> ready | failed` `-> closed` (close button, backdrop, Esc, Back). Only one instance can exist at a time.
