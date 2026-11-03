// Game economy: skins, upgrades, store catalog, daily rewards, missions, XP.

// ── Skins (cosmetic only, never pay-to-win) ─────────────────────────
// price: { coins } | { gems } | { level } | { iap: productId } | { free: true }
export const SKINS = [
  { id: 'bloop',     name: 'Bloop',     color: '#5fdcff', color2: '#1784d1', trail: '#a8f0ff', price: { free: true } },
  { id: 'mint',      name: 'Minty',     color: '#7dffbe', color2: '#16a866', trail: '#c2ffe0', price: { coins: 500 } },
  { id: 'bubblegum', name: 'Bubblegum', color: '#ff9ad6', color2: '#d3389a', trail: '#ffd0ec', price: { coins: 900 } },
  { id: 'sunny',     name: 'Sunny',     color: '#ffe36e', color2: '#ef9f00', trail: '#fff4b8', price: { coins: 1500 } },
  { id: 'lava',      name: 'Lava',      color: '#ff8048', color2: '#b51f00', trail: '#ffb347', price: { coins: 2500 }, pattern: 'spots' },
  { id: 'frost',     name: 'Frost',     color: '#e4f7ff', color2: '#77b2e6', trail: '#ffffff', price: { coins: 4000 }, pattern: 'sparkle' },
  { id: 'toxic',     name: 'Toxic',     color: '#c1ff4a', color2: '#4a9a00', trail: '#e6ffa8', price: { coins: 6000 }, pattern: 'spots' },
  { id: 'ghost',     name: 'Ghost',     color: '#f4f4ff', color2: '#a6a6d8', trail: '#d0d0ff', price: { level: 8 }, alpha: 0.72 },
  { id: 'ninja',     name: 'Ninja',     color: '#40404f', color2: '#15151d', trail: '#ff4d6d', price: { level: 15 }, accessory: 'band' },
  { id: 'galaxy',    name: 'Galaxy',    color: '#8366ff', color2: '#201057', trail: '#cbbcff', price: { gems: 60 }, pattern: 'stars' },
  { id: 'gold',      name: 'Golden',    color: '#ffd84f', color2: '#a87700', trail: '#fff2a8', price: { gems: 150 }, pattern: 'sparkle' },
  { id: 'prism',     name: 'Prism',     color: '#ff6b6b', color2: '#6b5bff', trail: '#ffffff', price: { gems: 250 }, rainbow: true },
  { id: 'royal',     name: 'Royal',     color: '#a873ff', color2: '#5226b0', trail: '#ffd84f', price: { iap: 'starter_pack' }, accessory: 'crown' },
];
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// ── Upgrades (coins only, 5 levels each) ────────────────────────────
export const UPGRADES = [
  { id: 'magnet',  name: 'Magnet',     label: 'Duration',          val: (l) => `${(6 + l * 1.5).toFixed(1)}s`, cost: [300, 700, 1500, 3000, 6000] },
  { id: 'doubler', name: '2× Coins',   label: 'Duration',          val: (l) => `${8 + l * 2}s`,               cost: [300, 700, 1500, 3000, 6000] },
  { id: 'frenzy',  name: 'Frenzy',     label: 'Duration',          val: (l) => `${(4 + l * 0.8).toFixed(1)}s`, cost: [400, 900, 1800, 3600, 7200] },
  { id: 'value',   name: 'Coin Value', label: 'Bonus coins',       val: (l) => `+${l * 10}%`,                 cost: [500, 1100, 2200, 4400, 8800] },
  { id: 'shield',  name: 'Head Start', label: 'Start with shield', val: (l) => `${l * 20}%`,                  cost: [400, 900, 1800, 3600, 7200] },
];
export const UPGRADE_MAX = 5;

// ── Real-money products ─────────────────────────────────────────────
// `id` must match the product ID you create in Google Play Console and
// App Store Connect. `price` is only a fallback label for web testing:
// on device the store supplies the localized price.
export const PRODUCTS = [
  { id: 'starter_pack', type: 'non_consumable', title: 'Starter Pack', desc: '150 gems, 3,000 coins and the Royal skin', price: '$1.99', badge: 'One time',
    grant: { gems: 150, coins: 3000, skin: 'royal', entitlement: 'starterPack' } },
  { id: 'remove_ads', type: 'non_consumable', title: 'Remove Ads', desc: 'No more ads between runs. Rewards stay optional.', price: '$2.99',
    grant: { entitlement: 'removeAds' } },
  { id: 'coin_doubler', type: 'non_consumable', title: 'Coin Doubler', desc: 'Earn 2× coins on every run, forever', price: '$3.99',
    grant: { entitlement: 'coinDoubler' } },
  { id: 'gems_small',  type: 'consumable', title: 'Handful of Gems', desc: '80 gems',    price: '$0.99', grant: { gems: 80 } },
  { id: 'gems_medium', type: 'consumable', title: 'Sack of Gems',    desc: '500 gems',   price: '$4.99', grant: { gems: 500 },  badge: 'Popular' },
  { id: 'gems_large',  type: 'consumable', title: 'Chest of Gems',   desc: '1,200 gems', price: '$9.99', grant: { gems: 1200 }, badge: 'Best value' },
];
export const productById = (id) => PRODUCTS.find((p) => p.id === id);

export const GEM_EXCHANGE = [
  { gems: 10,  coins: 800 },
  { gems: 50,  coins: 4500 },
  { gems: 120, coins: 12000 },
];

// ── Daily login rewards (7-day loop) ────────────────────────────────
export const DAILY_REWARDS = [
  { coins: 100 }, { coins: 150 }, { coins: 200 }, { coins: 300 },
  { coins: 400 }, { coins: 600 }, { gems: 15 },
];

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) {
  const pa = new Date(a + 'T00:00:00'), pb = new Date(b + 'T00:00:00');
  return Math.round((pb - pa) / 86400000);
}
/** Returns { canClaim, index } where index is the 0-6 day in the loop. */
export function dailyStatus(save) {
  const today = dayKey();
  const { lastClaim, streak } = save.daily;
  if (lastClaim === today) return { canClaim: false, index: (streak - 1 + 7) % 7 };
  const continues = lastClaim && daysBetween(lastClaim, today) === 1;
  return { canClaim: true, index: continues ? streak % 7 : 0 };
}
export function claimDaily(save) {
  const st = dailyStatus(save);
  if (!st.canClaim) return null;
  const today = dayKey();
  const continues = save.daily.lastClaim && daysBetween(save.daily.lastClaim, today) === 1;
  save.daily.streak = continues ? save.daily.streak + 1 : 1;
  save.daily.lastClaim = today;
  const reward = DAILY_REWARDS[st.index];
  save.coins += reward.coins || 0;
  save.gems += reward.gems || 0;
  return reward;
}

// ── Levels / XP ─────────────────────────────────────────────────────
export const xpForLevel = (lvl) => Math.round(350 * Math.pow(lvl, 1.35));
export function levelReward(lvl) {
  return { coins: 100 + lvl * 50, gems: lvl % 5 === 0 ? 10 : 0 };
}
/** Adds XP, returns list of levels gained (rewards already applied). */
export function addXp(save, xp) {
  const gained = [];
  save.xp += xp;
  while (save.xp >= xpForLevel(save.level)) {
    save.xp -= xpForLevel(save.level);
    save.level++;
    const r = levelReward(save.level);
    save.coins += r.coins;
    save.gems += r.gems;
    gained.push({ level: save.level, ...r });
  }
  return gained;
}

// ── Missions ────────────────────────────────────────────────────────
// scope 'run' = best single run counts, 'total' = accumulates across runs.
const MISSION_TYPES = [
  { type: 'coins_run',   scope: 'run',   stat: 'coins',     text: (n) => `Grab ${n} coins in one run`,   base: 40,  per: 12 },
  { type: 'depth_run',   scope: 'run',   stat: 'depth',     text: (n) => `Fall ${n}m in one run`,        base: 150, per: 45 },
  { type: 'close_run',   scope: 'run',   stat: 'close',     text: (n) => `Get ${n} close calls in one run`, base: 3, per: 1 },
  { type: 'gates',       scope: 'total', stat: 'gates',     text: (n) => `Pass ${n} gates`,              base: 40,  per: 12 },
  { type: 'close',       scope: 'total', stat: 'close',     text: (n) => `Get ${n} close calls`,         base: 6,   per: 2 },
  { type: 'frenzy',      scope: 'total', stat: 'frenzies',  text: (n) => `Trigger Frenzy ${n} times`,    base: 2,   per: 0.5 },
  { type: 'powerups',    scope: 'total', stat: 'powerups',  text: (n) => `Grab ${n} power-ups`,          base: 3,   per: 1 },
  { type: 'runs',        scope: 'total', stat: 'runs',      text: (n) => `Play ${n} runs`,               base: 3,   per: 0.4 },
  { type: 'coins_total', scope: 'total', stat: 'coins',     text: (n) => `Collect ${n} coins`,           base: 150, per: 45 },
];
const niceRound = (n) => (n >= 100 ? Math.round(n / 10) * 10 : Math.max(1, Math.round(n)));

export function newMission(save, excludeTypes = []) {
  const pool = MISSION_TYPES.filter((m) => !excludeTypes.includes(m.type));
  const t = pool[Math.floor(Math.random() * pool.length)];
  const lvl = save.level;
  const target = niceRound(t.base + t.per * (lvl - 1) * (0.8 + Math.random() * 0.4));
  const gems = Math.random() < 0.25 ? 3 + Math.floor(lvl / 5) : 0;
  return {
    id: Math.random().toString(36).slice(2, 9),
    type: t.type, target, progress: 0, claimed: false,
    reward: { coins: 120 + lvl * 25 + Math.round(Math.random() * 4) * 25, gems },
  };
}
export const missionDef = (m) => MISSION_TYPES.find((t) => t.type === m.type);
export const missionText = (m) => missionDef(m).text(m.target);
export const missionDone = (m) => m.progress >= m.target;

export function ensureMissions(save) {
  while (save.missions.length < 3) {
    save.missions.push(newMission(save, save.missions.map((m) => m.type)));
  }
}
/** Progress a mission would have with this run's stats, without saving it. */
export function previewProgress(m, run) {
  const def = missionDef(m);
  const v = def.stat === 'runs' ? 1 : run[def.stat] || 0;
  return def.scope === 'run' ? Math.max(m.progress, v) : m.progress + v;
}
/** Commits run stats into missions. Returns missions newly completed. */
export function applyRunToMissions(save, run) {
  const done = [];
  for (const m of save.missions) {
    if (m.claimed) continue;
    const before = missionDone(m);
    m.progress = Math.min(m.target, previewProgress(m, run));
    if (!before && missionDone(m)) done.push(m);
  }
  return done;
}
export function claimMission(save, id) {
  const i = save.missions.findIndex((m) => m.id === id);
  if (i < 0 || !missionDone(save.missions[i])) return null;
  const m = save.missions[i];
  save.coins += m.reward.coins;
  save.gems += m.reward.gems;
  save.missions.splice(i, 1);
  save.missions.splice(i, 0, newMission(save, save.missions.map((x) => x.type)));
  return m.reward;
}

// ── Run payout ──────────────────────────────────────────────────────
export function runPayout(save, runCoins) {
  const valueMult = 1 + save.upgrades.value * 0.1;
  const doublerMult = save.entitlements.coinDoubler ? 2 : 1;
  return { base: runCoins, valueMult, doublerMult, total: Math.round(runCoins * valueMult * doublerMult) };
}
