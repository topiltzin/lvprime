// Hand-drawn inline SVG trend chart — no charting library (research.md §8).
const SVG_NS = 'http://www.w3.org/2000/svg';

function readChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };
  return {
    completed: read('--chart-completed', read('--accent', '#7a4e9e')),
    missed: read('--chart-missed', read('--danger', '#b4234a')),
    label: read('--chart-label', read('--muted', '#6b6272')),
    hatch: read('--chart-hatch', '#ffffff'),
  };
}

export function renderTrendChart(trend) {
  const wrap = document.createElement('div');
  wrap.className = 'trend-chart';

  if (!trend.points.length) {
    wrap.innerHTML = '<p class="empty-state">Not enough feedback yet to show a trend.</p>';
    return wrap;
  }

  // Completion % is already shown in the stat strip above (renderFeedbackStatStrip) —
  // this chart focuses on the per-session trend, not a repeated summary number.

  const colors = readChartColors();
  const BAR_WIDTH = 28;
  const BAR_GAP = 20;
  const width = Math.max(240, trend.points.length * (BAR_WIDTH + BAR_GAP));
  const height = 110;
  const maxScore = 4;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Difficulty and completion trend over sessions');
  svg.setAttribute('aria-describedby', 'trend-chart-details');

  // Colorblind users and screen readers can't rely on the violet/red bar fill
  // alone, so missed sessions also get a diagonal hatch pattern (visual) and
  // every session is repeated as a hidden text list (assistive tech).
  const defs = document.createElementNS(SVG_NS, 'defs');
  const pattern = document.createElementNS(SVG_NS, 'pattern');
  pattern.setAttribute('id', 'missed-hatch');
  pattern.setAttribute('width', '6');
  pattern.setAttribute('height', '6');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const hatchLine = document.createElementNS(SVG_NS, 'line');
  hatchLine.setAttribute('x1', '0');
  hatchLine.setAttribute('y1', '0');
  hatchLine.setAttribute('x2', '0');
  hatchLine.setAttribute('y2', '6');
  hatchLine.setAttribute('stroke', colors.hatch);
  hatchLine.setAttribute('stroke-width', '2');
  pattern.appendChild(hatchLine);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const summaryItems = [];

  trend.points.forEach((point, i) => {
    const x = BAR_GAP / 2 + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
    const barHeight = point.difficultyScore ? (point.difficultyScore / maxScore) * (height - 40) : 6;
    const missed = point.completed === false;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x - BAR_WIDTH / 2);
    rect.setAttribute('y', height - 24 - barHeight);
    rect.setAttribute('width', BAR_WIDTH);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', missed ? colors.missed : colors.completed);
    rect.setAttribute('opacity', point.difficultyScore ? '1' : '0.35');
    svg.appendChild(rect);

    if (missed) {
      const hatchOverlay = document.createElementNS(SVG_NS, 'rect');
      hatchOverlay.setAttribute('x', x - BAR_WIDTH / 2);
      hatchOverlay.setAttribute('y', height - 24 - barHeight);
      hatchOverlay.setAttribute('width', BAR_WIDTH);
      hatchOverlay.setAttribute('height', barHeight);
      hatchOverlay.setAttribute('rx', 4);
      hatchOverlay.setAttribute('fill', 'url(#missed-hatch)');
      svg.appendChild(hatchOverlay);
    }

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', height - 8);
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', colors.label);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = point.date ? point.date.slice(5) : '?';
    svg.appendChild(label);

    const dateText = point.date || 'Unknown date';
    const difficultyText = point.difficultyScore ? `difficulty ${point.difficultyScore}/${maxScore}` : 'no difficulty recorded';
    summaryItems.push(`${dateText}: ${missed ? 'missed' : 'completed'}, ${difficultyText}`);
  });

  wrap.appendChild(svg);

  const details = document.createElement('ul');
  details.id = 'trend-chart-details';
  details.className = 'sr-only';
  for (const item of summaryItems) {
    const li = document.createElement('li');
    li.textContent = item;
    details.appendChild(li);
  }
  wrap.appendChild(details);

  const legend = document.createElement('div');
  legend.className = 'trend-legend';
  legend.innerHTML = `
    <span class="trend-legend-item"><span class="trend-swatch" style="background:${colors.completed}"></span>Completed</span>
    <span class="trend-legend-item"><span class="trend-swatch trend-swatch-missed" style="background:${colors.missed}"></span>Missed</span>
  `;
  wrap.appendChild(legend);

  return wrap;
}
