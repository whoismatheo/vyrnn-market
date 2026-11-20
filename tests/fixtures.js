const image = (id, name) => `https://coin-images.coingecko.com/coins/images/${id}/large/${name}.png?1696501400`;

export function sparklinePrices(length = 168, start = 100, step = 0.5) {
  return Array.from({ length }, (_, index) => start + index * step);
}

export const globalPayload = {
  data: {
    active_cryptocurrencies: 14210,
    markets: 1180,
    total_market_cap: { usd: 3_150_000_000_000, eur: 2_900_000_000_000 },
    total_volume: { usd: 121_000_000_000 },
    market_cap_percentage: { btc: 57.31, eth: 11.84 },
    market_cap_change_percentage_24h_usd: -1.42,
    updated_at: 1_763_500_000,
  },
};

export const marketCoins = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: image(1, 'bitcoin'),
    current_price: 91234.5,
    market_cap: 1_820_000_000_000,
    market_cap_rank: 1,
    total_volume: 41_000_000_000,
    price_change_percentage_24h: -1.2345,
    sparkline_in_7d: { price: sparklinePrices() },
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    image: image(279, 'ethereum'),
    current_price: 3012.17,
    market_cap: 363_000_000_000,
    market_cap_rank: 2,
    total_volume: 19_000_000_000,
    price_change_percentage_24h: 0.84,
    sparkline_in_7d: { price: sparklinePrices(168, 3000, -0.2) },
  },
  {
    id: 'newcoin',
    symbol: 'nwc',
    name: 'New Coin',
    image: 'https://tracker.example/pixel.png',
    current_price: null,
    market_cap: null,
    market_cap_rank: null,
    total_volume: 12,
    price_change_percentage_24h: null,
    sparkline_in_7d: { price: [] },
  },
  { symbol: 'bad', name: 'Missing id' },
  null,
];

export const chartPayload = {
  prices: Array.from({ length: 721 }, (_, index) => [1_760_000_000_000 + index * 3_600_000, 90_000 + index]),
  market_caps: [],
  total_volumes: [],
};

export const trendingPayload = {
  coins: ['solana', 'bitcoin', 'unlisted', 'solana', 'ethereum'].map((id) => ({ item: { id, name: id } })),
};
