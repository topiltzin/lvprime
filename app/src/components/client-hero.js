// Client detail hero (FR-005): name, one-line goal/level/duration summary, and a quiet
// back-to-overview link — rendered above the tab navigation on every client detail page.

const CHEVRON_LEFT_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function renderClientHero(customerData) {
  const wrap = document.createElement('div');
  wrap.className = 'client-hero';

  const back = document.createElement('a');
  back.className = 'back-link';
  back.href = '#/';
  back.innerHTML = `${CHEVRON_LEFT_SVG}<span>All clients</span>`;
  wrap.appendChild(back);

  const row = document.createElement('div');
  row.className = 'client-hero-row';

  const heading = document.createElement('div');
  const name = document.createElement('h1');
  name.className = 'client-hero-name';
  name.textContent = customerData.displayName;
  heading.appendChild(name);

  const program = customerData.program;
  const metaParts = [];
  if (program && program.present) {
    if (program.goal) metaParts.push(program.goal);
    if (program.fitnessLevel) metaParts.push(program.fitnessLevel);
    if (program.sessionDuration) metaParts.push(program.sessionDuration);
  }
  if (metaParts.length) {
    const meta = document.createElement('p');
    meta.className = 'client-hero-meta';
    meta.textContent = metaParts.join(' · ');
    heading.appendChild(meta);
  }

  row.appendChild(heading);
  wrap.appendChild(row);

  return wrap;
}
