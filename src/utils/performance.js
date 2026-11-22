export function normalizePerformance(points) {
  if (points.length < 2) return [];
  const base = points[0][1];
  if (!(base > 0)) return [];
  return points.map(([time, price]) => [time, (price / base - 1) * 100, price]);
}

export function periodChange(performance) {
  return performance.length > 0 ? performance[performance.length - 1][1] : null;
}

export function startsLate(performance, rangeStart, rangeEnd, tolerance = 0.05) {
  if (performance.length === 0) return false;
  return performance[0][0] - rangeStart > (rangeEnd - rangeStart) * tolerance;
}
