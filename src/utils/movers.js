export function topMovers(coins, limit) {
  const measured = coins.filter((coin) => typeof coin.change24h === 'number');
  const descending = [...measured].sort((a, b) => b.change24h - a.change24h);

  return {
    gainers: descending.filter((coin) => coin.change24h > 0).slice(0, limit),
    losers: descending
      .filter((coin) => coin.change24h < 0)
      .reverse()
      .slice(0, limit),
  };
}
