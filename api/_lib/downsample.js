export function downsample(items, maxPoints) {
  if (items.length <= maxPoints) return items;
  const step = (items.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => items[Math.round(index * step)]);
}
