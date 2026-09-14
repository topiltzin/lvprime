// Hand-drawn inline SVG trend chart — no charting library (research.md §8).
const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderTrendChart(trend) {
  const wrap = document.createElement('div');
  wrap.className = 'trend-chart';

  if (!trend.points.length) {
    wrap.innerHTML = '<p class="empty-state">Not enough feedback yet to show a trend.</p>';
    return wrap;
  }

  const rateLine = document.createElement('p');
  rateLine.className = 'summary-line';
  rateLine.textContent =
    trend.completionRate == null
      ? 'Completion rate: n/a'
      : `Completion rate: ${Math.round(trend.completionRate * 100)}%`;
  wrap.appendChild(rateLine);

  const width = Math.max(240, trend.points.length * 36);
  const height = 90;
  const maxScore = 4;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Difficulty and completion trend over sessions');

  trend.points.forEach((point, i) => {
    const x = 18 + i * 36;
    const barHeight = point.difficultyScore ? (point.difficultyScore / maxScore) * (height - 30) : 4;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x - 10);
    rect.setAttribute('y', height - 20 - barHeight);
    rect.setAttribute('width', 20);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', point.completed === false ? '#b3401f' : '#2f6f4f');
    rect.setAttribute('opacity', point.difficultyScore ? '1' : '0.3');
    svg.appendChild(rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', height - 6);
    label.setAttribute('font-size', '9');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = point.date ? point.date.slice(5) : '?';
    svg.appendChild(label);
  });

  wrap.appendChild(svg);
  return wrap;
}
