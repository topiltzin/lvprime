// Hand-drawn inline SVG trend chart — no charting library (research.md §8).
const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderTrendChart(trend) {
  const wrap = document.createElement('div');
  wrap.className = 'trend-chart';

  if (!trend.points.length) {
    wrap.innerHTML = '<p class="empty-state">Not enough feedback yet to show a trend.</p>';
    return wrap;
  }

  // Completion % is already shown in the stat strip above (renderFeedbackStatStrip) —
  // this chart focuses on the per-session trend, not a repeated summary number.

  const COMPLETED_COLOR = '#1f7a4d';
  const MISSED_COLOR = '#c23b22';
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

  trend.points.forEach((point, i) => {
    const x = BAR_GAP / 2 + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
    const barHeight = point.difficultyScore ? (point.difficultyScore / maxScore) * (height - 40) : 6;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x - BAR_WIDTH / 2);
    rect.setAttribute('y', height - 24 - barHeight);
    rect.setAttribute('width', BAR_WIDTH);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', point.completed === false ? MISSED_COLOR : COMPLETED_COLOR);
    rect.setAttribute('opacity', point.difficultyScore ? '1' : '0.35');
    svg.appendChild(rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', height - 8);
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', '#6b6b64');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = point.date ? point.date.slice(5) : '?';
    svg.appendChild(label);
  });

  wrap.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'trend-legend';
  legend.innerHTML = `
    <span class="trend-legend-item"><span class="trend-swatch" style="background:${COMPLETED_COLOR}"></span>Completed</span>
    <span class="trend-legend-item"><span class="trend-swatch" style="background:${MISSED_COLOR}"></span>Missed</span>
  `;
  wrap.appendChild(legend);

  return wrap;
}
