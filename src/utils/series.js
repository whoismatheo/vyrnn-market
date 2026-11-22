export function nearestIndex(times, target) {
  let low = 0;
  let high = times.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle] < target) low = middle;
    else high = middle;
  }
  return target - times[low] <= times[high] - target ? low : high;
}
