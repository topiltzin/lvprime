// Firework-style particle bursts on a full-viewport canvas for the welcome popup
// (specs/018-welcome-motivation-popup research.md #4/#5). Decorative only: it never
// blocks the page, stops itself, and callers skip it under reduced motion.

const GRAVITY = 0.06;
const DRAG = 0.985;
const SLOW_FRAME_MS = 50;

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Brand colors from the design tokens, with fallbacks so a missing token never breaks the effect. */
export function burstColors() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return [read('--brand-volt', '#C2EB57'), read('--brand-chalk', '#F4F5F2'), '#FFB547', '#7CE0B5'];
}

/**
 * Plays `bursts` staggered firework bursts, then clears the canvas.
 * Resolves when finished (or when stopped early); `cancel()` on the returned promise's
 * `.cancel` ends it immediately.
 */
export function playBurst(canvas, { bursts = 3, particlesPerBurst = 28, durationMs = 1200, colors = burstColors() } = {}) {
  const ctx = canvas.getContext('2d');
  let stop;
  const done = new Promise((resolve) => {
    if (!ctx) return resolve();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Weak devices get half the particles.
    const count = (navigator.hardwareConcurrency || 4) <= 2 ? Math.ceil(particlesPerBurst / 2) : particlesPerBurst;
    const stagger = bursts > 1 ? (durationMs * 0.45) / (bursts - 1) : 0;
    const particles = [];
    let launched = 0;
    const start = performance.now();
    let last = start;
    let slow = 0;
    let raf = 0;

    const launch = () => {
      const x = window.innerWidth * (0.2 + Math.random() * 0.6);
      const y = window.innerHeight * (0.15 + Math.random() * 0.4);
      const color = colors[launched % colors.length];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2.2 + Math.random() * 3.2;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, decay: 0.012 + Math.random() * 0.012, size: 2 + Math.random() * 2, color });
      }
      launched += 1;
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      resolve();
    };
    stop = finish;

    const frame = (now) => {
      const elapsed = now - start;
      slow = now - last > SLOW_FRAME_MS ? slow + 1 : 0;
      last = now;
      // Two slow frames in a row: the device can't keep up, so drop the effect.
      if (elapsed >= durationMs || slow >= 2) return finish();

      while (launched < bursts && elapsed >= launched * stagger) launch();

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  done.cancel = () => stop?.();
  return done;
}
