// Persistent player data. Uses localStorage, which is persistent inside the
// Capacitor WebView. Every access is wrapped because some browsers (private
// mode, sandboxed iframes) throw on storage access.

const KEY = 'bloopdrop.save.v1';

export const DEFAULT_SAVE = {
  coins: 0,
  gems: 0,
  best: 0,
  xp: 0,
  level: 1,
  skin: 'bloop',
  ownedSkins: ['bloop'],
  upgrades: { magnet: 0, doubler: 0, frenzy: 0, value: 0, shield: 0 },
  entitlements: { removeAds: false, coinDoubler: false, starterPack: false },
  daily: { lastClaim: null, streak: 0 },
  missions: [],
  stats: { runs: 0, coins: 0, gates: 0, close: 0, frenzies: 0, powerups: 0, bestCoins: 0 },
  settings: { sound: true, haptics: true },
  ads: { freeGemsDate: null, freeGemsCount: 0, lastInterstitial: 0, runsSinceInterstitial: 0 },
  tutorialDone: false,
  processedTx: [],
};

function merge(base, data) {
  if (Array.isArray(base)) return Array.isArray(data) ? data : base.slice();
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], data ? data[k] : undefined);
    return out;
  }
  return data === undefined || data === null ? base : data;
}

export function loadSave() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  const s = merge(DEFAULT_SAVE, raw || {});
  // daily.lastClaim defaults to null, keep nulls there
  if (raw && raw.daily) s.daily.lastClaim = raw.daily.lastClaim ?? null;
  return s;
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return loadSave();
}
