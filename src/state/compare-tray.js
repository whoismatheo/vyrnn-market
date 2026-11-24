import { createWatchlist } from './watchlist.js';
import { MAX_ASSETS } from '../utils/compare-state.js';
import { readStorage, writeStorage } from '../utils/storage.js';

export const compareTray = createWatchlist({
  storage: { read: readStorage, write: writeStorage },
  events: typeof window === 'undefined' ? null : window,
  max: MAX_ASSETS,
  key: 'vyrnn.compare-tray',
});
