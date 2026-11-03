import { Game } from './game.js';
import { drawBloop } from './bloop.js';
import { sfx, unlockAudio, setSoundEnabled } from './audio.js';
import { loadSave, writeSave, resetSave } from './save.js';
import {
  SKINS, skinById, UPGRADES, UPGRADE_MAX, PRODUCTS, productById, GEM_EXCHANGE, DAILY_REWARDS,
  dailyStatus, claimDaily, xpForLevel, addXp, ensureMissions, missionText, missionDone,
  previewProgress, applyRunToMissions, claimMission, runPayout,
} from './economy.js';
import { createStore } from './monetization/store.js';
import { createAds } from './monetization/ads.js';
import { VERSION, REVIVE_GEM_COST, FREE_GEMS_AD, INTERSTITIAL, PRIVACY_POLICY_URL } from './config.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const coinHtml = (n) => `<i class="coin-ico"></i>${fmt(n)}`;
const gemHtml = (n) => `<i class="gem-ico"></i>${fmt(n)}`;

let save = loadSave();
ensureMissions(save);
writeSave(save);
setSoundEnabled(save.settings.sound);

// ── UI helpers used by the store/ad simulators ─────────────────────
const ui = { confirm, toast, fakeAd };

function toast(html, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function confirm({ title, body = '', ok = 'OK', cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    const m = $('#modal-confirm');
    $('#confirm-title').innerHTML = title;
    $('#confirm-body').innerHTML = body;
    $('#confirm-ok').textContent = ok;
    $('#confirm-cancel').textContent = cancel;
    m.hidden = false;
    const done = (v) => {
      m.hidden = true;
      $('#confirm-ok').onclick = $('#confirm-cancel').onclick = null;
      resolve(v);
    };
    $('#confirm-ok').onclick = () => { sfx.tap(); done(true); };
    $('#confirm-cancel').onclick = () => { sfx.tap(); done(false); };
  });
}

function fakeAd({ rewarded }) {
  return new Promise((resolve) => {
    const m = $('#modal-ad');
    const bar = $('#ad-progress');
    const doneBtn = $('#ad-done');
    const total = rewarded ? 4000 : 2500;
    const start = performance.now();
    doneBtn.disabled = true;
    doneBtn.textContent = rewarded ? 'Claim reward' : 'Close';
    $('#ad-skip').hidden = !rewarded;
    m.hidden = false;
    let raf;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / total);
      bar.style.width = `${p * 100}%`;
      if (p >= 1) doneBtn.disabled = false;
      else raf = requestAnimationFrame(tick);
    };
    tick();
    const finish = (v) => {
      cancelAnimationFrame(raf);
      m.hidden = true;
      doneBtn.onclick = $('#ad-skip').onclick = null;
      resolve(v);
    };
    doneBtn.onclick = () => finish(true);
    $('#ad-skip').onclick = () => finish(false);
  });
}

function haptic(kind) {
  if (!save.settings.haptics) return;
  const H = window.Capacitor?.Plugins?.Haptics;
  if (H) { H.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {}); return; }
  try { navigator.vibrate?.(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 8); } catch { /* ignore */ }
}

// ── Monetization services ──────────────────────────────────────────
let store = null;
let ads = null;

function grantProduct(id, txId) {
  const p = productById(id);
  if (!p) return;
  if (p.type === 'consumable') {
    if (txId && save.processedTx.includes(txId)) return;
    if (txId) { save.processedTx.push(txId); if (save.processedTx.length > 200) save.processedTx.shift(); }
    save.gems += p.grant.gems || 0;
    toast(`${gemHtml(p.grant.gems)} added. Thank you!`, 'good');
  } else {
    const ent = p.grant.entitlement;
    if (save.entitlements[ent]) return; // already granted (restores are idempotent)
    save.entitlements[ent] = true;
    save.gems += p.grant.gems || 0;
    save.coins += p.grant.coins || 0;
    if (p.grant.skin && !save.ownedSkins.includes(p.grant.skin)) save.ownedSkins.push(p.grant.skin);
    toast(`${p.title} unlocked. Thank you!`, 'good');
  }
  writeSave(save);
  sfx.buy();
  haptic('medium');
  refreshAll();
}

async function buyProduct(id) {
  if (!store) { toast('Store is still loading. Try again in a moment.'); return; }
  sfx.tap();
  await store.purchase(id);
}

(async () => {
  store = await createStore({ onGrant: grantProduct, ui });
  ads = await createAds({ ui });
  refreshAll();
})();

// ── Game ───────────────────────────────────────────────────────────
let missionNotified = new Set();
let lastMissionCheck = 0;
let lastRun = null;
let rewardedThisRun = false;

const game = new Game($('#game'), {
  sfx: (name) => sfx[name]?.(),
  haptic,
  onSteer() {
    if (!$('#hint').hidden) {
      $('#hint').hidden = true;
      save.tutorialDone = true;
      writeSave(save);
    }
  },
  onTick(run) {
    const now = performance.now();
    if (now - lastMissionCheck < 300) return;
    lastMissionCheck = now;
    for (const m of save.missions) {
      if (m.claimed || missionDone(m) || missionNotified.has(m.id)) continue;
      if (previewProgress(m, run) >= m.target) {
        missionNotified.add(m.id);
        toast(`Mission done: ${missionText(m)}`, 'good');
        sfx.power();
      }
    }
  },
  onDeath(run, canRevive) {
    $('#btn-pause').hidden = true;
    if (canRevive && (save.gems >= REVIVE_GEM_COST || ads?.rewardedAvailable())) openRevive(run);
    else finishRun();
  },
});

function applyLoadout() {
  game.setLoadout(skinById(save.skin), { ...save.upgrades });
}
applyLoadout();

function startRun() {
  unlockAudio();
  sfx.tap();
  closeAllModals();
  $('#screen-home').hidden = true;
  $('#topbar').hidden = true;
  $('#btn-pause').hidden = false;
  $('#hint').hidden = save.tutorialDone;
  missionNotified = new Set();
  rewardedThisRun = false;
  applyLoadout();
  game.start();
}

function goHome() {
  closeAllModals();
  game.toIdle();
  applyLoadout();
  $('#screen-home').hidden = false;
  $('#topbar').hidden = false;
  $('#btn-pause').hidden = true;
  $('#hint').hidden = true;
  refreshAll();
}

// revive
let reviveTimer = null;
function openRevive(run) {
  const m = $('#modal-revive');
  $('#revive-score').textContent = fmt(run.score);
  $('#revive-cost').textContent = REVIVE_GEM_COST;
  $('#btn-revive-ad').hidden = !ads?.rewardedAvailable();
  $('#btn-revive-gems').disabled = save.gems < REVIVE_GEM_COST;
  m.hidden = false;
  let left = 5;
  const ring = $('#revive-ring');
  const started = performance.now();
  const tick = () => {
    const el = (performance.now() - started) / 1000;
    left = Math.max(0, 5 - el);
    ring.style.setProperty('--p', String(left / 5));
    $('#revive-count').textContent = Math.ceil(left);
    if (left <= 0) { closeRevive(); finishRun(); return; }
    reviveTimer = requestAnimationFrame(tick);
  };
  reviveTimer = requestAnimationFrame(tick);
}
function closeRevive() {
  cancelAnimationFrame(reviveTimer);
  reviveTimer = null;
  $('#modal-revive').hidden = true;
}
function continueRun() {
  $('#btn-pause').hidden = false;
  game.revive();
}
$('#btn-revive-ad').onclick = async () => {
  closeRevive();
  const ok = await ads.showRewarded();
  if (ok) { rewardedThisRun = true; continueRun(); } else finishRun();
};
$('#btn-revive-gems').onclick = () => {
  if (save.gems < REVIVE_GEM_COST) return;
  closeRevive();
  save.gems -= REVIVE_GEM_COST;
  writeSave(save);
  continueRun();
};
$('#btn-revive-skip').onclick = () => { sfx.tap(); closeRevive(); finishRun(); };

// game over
function finishRun() {
  const run = { ...game.run };
  const pay = runPayout(save, run.coins);
  const prevBest = save.best;
  const newBest = run.score > save.best;
  if (newBest) save.best = run.score;

  save.coins += pay.total;
  save.gems += run.gems;
  const st = save.stats;
  st.runs++;
  st.coins += run.coins;
  st.gates += run.gates;
  st.close += run.close;
  st.frenzies += run.frenzies;
  st.powerups += run.powerups;
  st.bestCoins = Math.max(st.bestCoins, run.coins);
  save.ads.runsSinceInterstitial++;

  const missionsDone = applyRunToMissions(save, run);
  const levelBefore = save.level;
  const levels = addXp(save, run.score);
  writeSave(save);
  lastRun = { run, pay, doubled: false };

  // fill the card
  $('#over-title').textContent = newBest && prevBest > 0 ? 'New best!' : 'Run over';
  $('#over-title').classList.toggle('best-run', newBest && prevBest > 0);
  $('#over-score').textContent = fmt(run.score);
  $('#over-best').textContent = `Best ${fmt(save.best)}`;
  $('#st-depth').textContent = fmt(run.depth);
  $('#st-gates').textContent = fmt(run.gates);
  $('#st-close').textContent = fmt(run.close);
  $('#earn-coins').textContent = `+${fmt(pay.total)}`;
  const parts = [];
  if (pay.valueMult > 1) parts.push(`+${Math.round((pay.valueMult - 1) * 100)}% value`);
  if (pay.doublerMult > 1) parts.push('2× doubler');
  $('#earn-detail').textContent = parts.length ? `${fmt(pay.base)} collected, ${parts.join(', ')}` : 'collected';
  $('#earn-gems-row').hidden = run.gems === 0;
  $('#earn-gems').textContent = `+${run.gems}`;

  const list = $('#over-missions');
  list.innerHTML = '';
  for (const m of missionsDone) {
    const d = document.createElement('div');
    d.textContent = `Mission done: ${missionText(m)}`;
    list.appendChild(d);
  }
  for (const l of levels) {
    const d = document.createElement('div');
    d.className = 'level';
    d.innerHTML = `Level ${l.level}! +${coinHtml(l.coins)}${l.gems ? ` +${gemHtml(l.gems)}` : ''}`;
    list.appendChild(d);
  }
  if (levels.length) setTimeout(() => sfx.levelUp(), 300);
  const unlocked = SKINS.filter((s) => s.price.level && s.price.level > levelBefore && s.price.level <= save.level);
  for (const s of unlocked) {
    const d = document.createElement('div');
    d.className = 'level';
    d.textContent = `New skin unlocked: ${s.name}`;
    list.appendChild(d);
  }

  renderGoal();
  const canDouble = pay.total > 0 && ads?.rewardedAvailable();
  $('#btn-double').hidden = !canDouble;
  $('#btn-double').disabled = false;
  $('#modal-over').hidden = false;
  if (newBest && prevBest > 0) sfx.levelUp();
}

// "Next goal" nudge: the cheapest coin skin you don't own yet.
function renderGoal() {
  const el = $('#over-goal');
  const next = SKINS.filter((s) => s.price.coins && !ownsSkin(s)).sort((a, b) => a.price.coins - b.price.coins)[0];
  if (!next) { el.hidden = true; return; }
  const pct = Math.min(100, (save.coins / next.price.coins) * 100);
  el.innerHTML = save.coins >= next.price.coins
    ? `You can afford <b>${next.name}</b> now. Find it in the shop.`
    : `Next skin <b>${next.name}</b>: ${fmt(save.coins)} / ${fmt(next.price.coins)} coins<span class="xpbar big"><i style="width:${pct}%"></i></span>`;
  el.hidden = false;
}

$('#btn-double').onclick = async () => {
  if (!lastRun || lastRun.doubled) return;
  $('#btn-double').disabled = true;
  const ok = await ads.showRewarded();
  if (!ok) { $('#btn-double').disabled = false; return; }
  rewardedThisRun = true;
  lastRun.doubled = true;
  save.coins += lastRun.pay.total;
  writeSave(save);
  $('#earn-coins').textContent = `+${fmt(lastRun.pay.total * 2)}`;
  $('#earn-detail').textContent = 'doubled!';
  $('#btn-double').hidden = true;
  sfx.buy();
  renderGoal();
  refreshTopbar();
};

async function maybeInterstitial() {
  if (!ads || save.entitlements.removeAds || rewardedThisRun) return;
  if (save.stats.runs <= INTERSTITIAL.graceRuns) return;
  if (save.ads.runsSinceInterstitial < INTERSTITIAL.everyNRuns) return;
  if (Date.now() - save.ads.lastInterstitial < INTERSTITIAL.minSecondsBetween * 1000) return;
  save.ads.runsSinceInterstitial = 0;
  save.ads.lastInterstitial = Date.now();
  writeSave(save);
  await ads.showInterstitial();
}

$('#btn-again').onclick = async () => { $('#modal-over').hidden = true; await maybeInterstitial(); startRun(); };
$('#btn-home').onclick = async () => { sfx.tap(); $('#modal-over').hidden = true; await maybeInterstitial(); goHome(); };
$('#btn-play').onclick = startRun;

// pause
function pauseGame() {
  if (game.state !== 'playing') return;
  game.pause();
  $('#modal-pause').hidden = false;
}
$('#btn-pause').onclick = () => { sfx.tap(); pauseGame(); };
$('#btn-resume').onclick = () => { sfx.tap(); $('#modal-pause').hidden = true; game.resume(); };
$('#btn-quit').onclick = () => {
  sfx.tap();
  $('#modal-pause').hidden = true;
  $('#btn-pause').hidden = true;
  game.state = 'dead';
  finishRun();
};
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ── Modals & navigation ────────────────────────────────────────────
const MODALS = ['shop', 'missions', 'daily', 'settings'];
function openModal(name, opts = {}) {
  sfx.tap();
  closeAllModals();
  if (name === 'shop') { renderShop(); setShopTab(opts.tab || 'skins'); }
  if (name === 'missions') renderMissions();
  if (name === 'daily') renderDaily();
  if (name === 'settings') renderSettings();
  $(`#modal-${name}`).hidden = false;
}
function closeAllModals() {
  for (const n of MODALS) $(`#modal-${n}`).hidden = true;
}
function topModalOpen() {
  return MODALS.find((n) => !$(`#modal-${n}`).hidden);
}
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open]');
  if (opener) {
    if (game.state === 'playing' || game.state === 'paused') return;
    openModal(opener.dataset.open, { tab: opener.dataset.tab });
    return;
  }
  if (e.target.closest('[data-close]')) { sfx.tap(); closeAllModals(); refreshAll(); return; }
  // tap on the dimmed backdrop closes menu modals
  const modal = e.target.classList?.contains('modal') ? e.target : null;
  if (modal && MODALS.some((n) => modal.id === `modal-${n}`)) { closeAllModals(); refreshAll(); }
});

// Android back button
window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => {
  if (topModalOpen()) { closeAllModals(); refreshAll(); return; }
  if (game.state === 'playing') { pauseGame(); return; }
  if (!$('#modal-pause').hidden) { $('#modal-pause').hidden = true; game.resume(); return; }
  if (!$('#screen-home').hidden) window.Capacitor.Plugins.App.minimizeApp?.();
});

// ── Top bar & badges ───────────────────────────────────────────────
let shownCoins = save.coins, shownGems = save.gems;
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function refreshTopbar() {
  if (shownCoins !== save.coins) bump($('#coins-amt').parentElement);
  if (shownGems !== save.gems) bump($('#gems-amt').parentElement);
  shownCoins = save.coins; shownGems = save.gems;
  $('#coins-amt').textContent = fmt(save.coins);
  $('#gems-amt').textContent = fmt(save.gems);
  $('#lvl-num').textContent = save.level;
  $('#xp-fill').style.width = `${(save.xp / xpForLevel(save.level)) * 100}%`;
  $('#home-best').textContent = fmt(save.best);
  const claimable = save.missions.filter(missionDone).length;
  $('#badge-missions').hidden = claimable === 0;
  $('#badge-missions').textContent = claimable;
  $('#badge-daily').hidden = !dailyStatus(save).canClaim;
}

function refreshAll() {
  refreshTopbar();
  if (!$('#modal-shop').hidden) renderShop();
  if (!$('#modal-missions').hidden) renderMissions();
  if (!$('#modal-daily').hidden) renderDaily();
}

// ── Shop ───────────────────────────────────────────────────────────
function ownsSkin(s) {
  return s.price.free || save.ownedSkins.includes(s.id) || (s.price.level && save.level >= s.price.level);
}

let shopTab = 'skins';
function setShopTab(tab) {
  shopTab = tab;
  for (const b of $$('#modal-shop .tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const p of $$('#modal-shop .pane')) p.hidden = p.id !== `pane-${tab}`;
  $('#modal-shop .sheet-body').scrollTop = 0;
}
for (const b of $$('#modal-shop .tabs button')) b.onclick = () => { sfx.tap(); setShopTab(b.dataset.tab); };

function skinPreview(skin, size = 66) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  drawBloop(ctx, { x: size / 2, y: size / 2 + (skin.accessory === 'crown' ? 5 : 0), r: size * 0.32, skin, t: 1.2, lookY: 0.3 });
  return c;
}

function renderShop() {
  // skins
  const grid = $('#skins-grid');
  grid.innerHTML = '';
  for (const s of SKINS) {
    const owned = ownsSkin(s);
    const b = document.createElement('button');
    b.className = `skin${save.skin === s.id ? ' equipped' : ''}${owned ? '' : ' locked'}`;
    b.appendChild(skinPreview(s));
    const name = document.createElement('span');
    name.textContent = s.name;
    b.appendChild(name);
    const tag = document.createElement('span');
    tag.className = 'tag';
    if (save.skin === s.id) tag.textContent = 'Equipped';
    else if (owned) tag.textContent = 'Equip';
    else if (s.price.coins) tag.innerHTML = coinHtml(s.price.coins);
    else if (s.price.gems) tag.innerHTML = gemHtml(s.price.gems);
    else if (s.price.level) tag.textContent = `Level ${s.price.level}`;
    else if (s.price.iap) tag.textContent = 'Starter Pack';
    b.appendChild(tag);
    b.onclick = () => onSkinTap(s);
    grid.appendChild(b);
  }

  // upgrades
  const list = $('#upgrades-list');
  list.innerHTML = '';
  const icons = {
    magnet: ['#ff6b8a', '<svg viewBox="0 0 24 24"><path d="M6 4v8a6 6 0 0 0 12 0V4" fill="none" stroke="#fff" stroke-width="4.5"/><path d="M3.8 4h4.4v3H3.8zM15.8 4h4.4v3h-4.4z" fill="#ffe0e6"/></svg>'],
    doubler: ['#ffb400', '2×'],
    frenzy: ['#ff5d2a', '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#fff"/></svg>'],
    value: ['#e29a00', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#fff"/><path d="M12 8v8M9 11l3-3 3 3" stroke="#e29a00" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>'],
    shield: ['#3fc4ff', '<svg viewBox="0 0 24 24"><path d="M12 2l8 3.5-1.5 9L12 22l-6.5-7.5L4 5.5z" fill="#fff"/></svg>'],
  };
  for (const u of UPGRADES) {
    const lvl = save.upgrades[u.id];
    const maxed = lvl >= UPGRADE_MAX;
    const cost = maxed ? 0 : u.cost[lvl];
    const row = document.createElement('div');
    row.className = 'upg';
    const [col, glyph] = icons[u.id];
    row.innerHTML = `
      <div class="upg-ico" style="background:${col}">${glyph}</div>
      <div><h3>${u.name}</h3><p>${u.label} ${u.val(lvl)}${maxed ? '' : ` → ${u.val(lvl + 1)}`}</p>
      <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-play';
    if (maxed) { btn.textContent = 'Max'; btn.disabled = true; } else { btn.innerHTML = coinHtml(cost); btn.disabled = save.coins < cost; }
    btn.onclick = () => {
      if (save.coins < cost || maxed) return;
      save.coins -= cost;
      save.upgrades[u.id]++;
      writeSave(save);
      sfx.buy();
      haptic('light');
      toast(`${u.name} upgraded to level ${save.upgrades[u.id]}`, 'gold');
      refreshAll();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }

  renderGemsPane();
}

async function onSkinTap(s) {
  if (ownsSkin(s)) {
    if (save.skin !== s.id) { save.skin = s.id; writeSave(save); applyLoadout(); sfx.tap(); refreshAll(); }
    return;
  }
  if (s.price.level) { sfx.error(); toast(`Reach level ${s.price.level} to unlock ${s.name}`); return; }
  if (s.price.iap) { buyProduct(s.price.iap); return; }
  const cur = s.price.coins ? 'coins' : 'gems';
  const cost = s.price[cur];
  if (save[cur] < cost) {
    sfx.error();
    if (cur === 'gems') {
      const go = await confirm({ title: 'Not enough gems', body: `${s.name} costs ${cost} gems. You have ${save.gems}.`, ok: 'Get gems' });
      if (go) setShopTab('gems');
    } else {
      toast(`You need ${fmt(cost - save.coins)} more coins`);
    }
    return;
  }
  const ok = await confirm({ title: `Unlock ${s.name}?`, body: `Spend ${cur === 'coins' ? coinHtml(cost) : gemHtml(cost)}`, ok: 'Unlock' });
  if (!ok) return;
  save[cur] -= cost;
  save.ownedSkins.push(s.id);
  save.skin = s.id;
  writeSave(save);
  applyLoadout();
  sfx.buy();
  haptic('medium');
  toast(`${s.name} unlocked and equipped!`, 'good');
  refreshAll();
}

function renderGemsPane() {
  const pane = $('#pane-gems');
  const price = (id) => store?.price(id) || productById(id).price;
  const ent = save.entitlements;
  pane.innerHTML = '';

  if (!ent.starterPack) {
    const sp = productById('starter_pack');
    const b = document.createElement('button');
    b.className = 'feature';
    b.appendChild(skinPreview(skinById('royal'), 62));
    const txt = document.createElement('div');
    txt.innerHTML = `<h3>${sp.title}</h3><p>${sp.desc}. ${sp.badge}.</p><span class="price-chip">${price(sp.id)}</span>`;
    b.appendChild(txt);
    b.onclick = () => buyProduct(sp.id);
    pane.appendChild(b);
  }

  const h1 = document.createElement('p');
  h1.className = 'section-title';
  h1.textContent = 'Gems';
  pane.appendChild(h1);
  const grid = document.createElement('div');
  grid.className = 'products';
  PRODUCTS.filter((p) => p.type === 'consumable').forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'prod';
    b.innerHTML = `${p.badge ? `<span class="ribbon">${p.badge}</span>` : ''}
      <span class="gems-pile">${'<i class="gem-ico"></i>'.repeat(i + 1)}</span>
      <span class="amt">${fmt(p.grant.gems)}</span><span class="name">${p.title}</span>
      <span class="price">${price(p.id)}</span>`;
    b.onclick = () => buyProduct(p.id);
    grid.appendChild(b);
  });
  pane.appendChild(grid);

  const h2 = document.createElement('p');
  h2.className = 'section-title';
  h2.textContent = 'Perks';
  pane.appendChild(h2);
  const perks = [
    ['remove_ads', 'removeAds', '#ff5d73', '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3" fill="#fff"/><path d="M4 20L20 4" stroke="#1b1530" stroke-width="2.5"/></svg>'],
    ['coin_doubler', 'coinDoubler', '#e29a00', '2×'],
  ];
  for (const [id, key, col, glyph] of perks) {
    const p = productById(id);
    const row = document.createElement('div');
    row.className = 'perk';
    row.innerHTML = `<div class="upg-ico" style="background:${col}">${glyph}</div><div><h3>${p.title}</h3><p>${p.desc}</p></div>`;
    if (ent[key]) {
      const o = document.createElement('span');
      o.className = 'owned';
      o.textContent = 'Owned';
      row.appendChild(o);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ad';
      btn.textContent = price(id);
      btn.onclick = () => buyProduct(id);
      row.appendChild(btn);
    }
    pane.appendChild(row);
  }

  // free gems via rewarded ad
  const today = new Date().toDateString();
  if (save.ads.freeGemsDate !== today) { save.ads.freeGemsDate = today; save.ads.freeGemsCount = 0; }
  const left = FREE_GEMS_AD.perDay - save.ads.freeGemsCount;
  if (ads?.rewardedAvailable() || left <= 0) {
    const row = document.createElement('div');
    row.className = 'perk';
    row.innerHTML = `<div class="upg-ico" style="background:var(--mint)"><span class="play-tri"></span></div>
      <div><h3>Free gems</h3><p>Watch a short ad for ${FREE_GEMS_AD.gems} gems. ${Math.max(0, left)} left today.</p></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-ad';
    btn.innerHTML = `+${FREE_GEMS_AD.gems}`;
    btn.disabled = left <= 0;
    btn.onclick = async () => {
      btn.disabled = true;
      const ok = await ads.showRewarded();
      if (ok) {
        save.gems += FREE_GEMS_AD.gems;
        save.ads.freeGemsCount++;
        writeSave(save);
        sfx.gem();
        toast(`${gemHtml(FREE_GEMS_AD.gems)} added`, 'good');
      }
      refreshAll();
    };
    row.appendChild(btn);
    pane.appendChild(row);
  }

  const h3 = document.createElement('p');
  h3.className = 'section-title';
  h3.textContent = 'Trade gems for coins';
  pane.appendChild(h3);
  const ex = document.createElement('div');
  ex.className = 'exchange';
  for (const x of GEM_EXCHANGE) {
    const b = document.createElement('button');
    b.className = 'prod';
    b.innerHTML = `<i class="coin-ico" style="width:30px;height:30px"></i><span class="amt">${fmt(x.coins)}</span><span class="price">${gemHtml(x.gems)}</span>`;
    b.onclick = async () => {
      if (save.gems < x.gems) { sfx.error(); toast(`You need ${x.gems - save.gems} more gems`); return; }
      const ok = await confirm({ title: `Trade ${x.gems} gems?`, body: `You get ${coinHtml(x.coins)}`, ok: 'Trade' });
      if (!ok) return;
      save.gems -= x.gems;
      save.coins += x.coins;
      writeSave(save);
      sfx.buy();
      refreshAll();
    };
    ex.appendChild(b);
  }
  pane.appendChild(ex);

  if (store?.simulated) {
    const note = document.createElement('p');
    note.className = 'test-note';
    note.textContent = 'Web test mode: purchases and ads are simulated and nothing is charged. The app store build uses real Google Play and App Store checkout.';
    pane.appendChild(note);
  }
  const rl = document.createElement('div');
  rl.className = 'restore-line';
  const rb = document.createElement('button');
  rb.className = 'btn-link';
  rb.textContent = 'Restore purchases';
  rb.onclick = restorePurchases;
  rl.appendChild(rb);
  pane.appendChild(rl);
}

async function restorePurchases() {
  sfx.tap();
  if (!store) return;
  const ok = await store.restore();
  toast(ok ? 'Purchases restored' : 'Could not reach the store. Try again later.');
  refreshAll();
}

// ── Missions ───────────────────────────────────────────────────────
function renderMissions() {
  $('#m-level').textContent = save.level;
  $('#m-xp-fill').style.width = `${(save.xp / xpForLevel(save.level)) * 100}%`;
  $('#m-xp-text').textContent = `${fmt(save.xp)} / ${fmt(xpForLevel(save.level))} XP`;
  const list = $('#missions-list');
  list.innerHTML = '';
  for (const m of save.missions) {
    const done = missionDone(m);
    const el = document.createElement('div');
    el.className = `mission${done ? ' done' : ''}`;
    el.innerHTML = `<h3>${missionText(m)}</h3>
      <div class="bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
      <div class="meta"><span>${fmt(m.progress)} / ${fmt(m.target)}</span>
      <span class="reward">${coinHtml(m.reward.coins)}${m.reward.gems ? ` ${gemHtml(m.reward.gems)}` : ''}</span></div>`;
    const side = document.createElement('div');
    side.className = 'side';
    if (done) {
      const b = document.createElement('button');
      b.className = 'btn btn-ad btn-small';
      b.textContent = 'Claim';
      b.onclick = () => {
        const r = claimMission(save, m.id);
        if (!r) return;
        writeSave(save);
        sfx.buy();
        haptic('medium');
        toast(`+${coinHtml(r.coins)}${r.gems ? ` +${gemHtml(r.gems)}` : ''}`, 'gold');
        refreshAll();
      };
      side.appendChild(b);
    }
    el.appendChild(side);
    list.appendChild(el);
  }
}

// ── Daily ──────────────────────────────────────────────────────────
function renderDaily() {
  const st = dailyStatus(save);
  const wrap = $('#days');
  wrap.innerHTML = '';
  DAILY_REWARDS.forEach((r, i) => {
    const d = document.createElement('div');
    const isToday = st.canClaim && i === st.index;
    const past = st.canClaim ? i < st.index : i <= st.index;
    d.className = `day${isToday ? ' today' : ''}${past ? ' past' : ''}${i === 6 ? ' big' : ''}`;
    d.innerHTML = `Day ${i + 1}<b>${r.gems ? gemHtml(r.gems) : coinHtml(r.coins)}</b>`;
    wrap.appendChild(d);
  });
  const btn = $('#btn-claim-daily');
  btn.disabled = !st.canClaim;
  btn.textContent = st.canClaim ? 'Claim' : 'Come back tomorrow';
}
$('#btn-claim-daily').onclick = () => {
  const r = claimDaily(save);
  if (!r) return;
  writeSave(save);
  sfx.buy();
  haptic('medium');
  toast(`+${r.gems ? gemHtml(r.gems) : coinHtml(r.coins)}`, 'gold');
  refreshAll();
};

// ── Settings ───────────────────────────────────────────────────────
function renderSettings() {
  $('#set-sound').checked = save.settings.sound;
  $('#set-haptics').checked = save.settings.haptics;
  $('#version').textContent = `Version ${VERSION}${store?.simulated ? ' · web test mode' : ''}`;
  $('#link-privacy').href = PRIVACY_POLICY_URL;
}
$('#set-sound').onchange = (e) => { save.settings.sound = e.target.checked; setSoundEnabled(save.settings.sound); writeSave(save); unlockAudio(); sfx.tap(); };
$('#set-haptics').onchange = (e) => { save.settings.haptics = e.target.checked; writeSave(save); haptic('medium'); };
$('#btn-restore').onclick = restorePurchases;
$('#btn-reset').onclick = async () => {
  const ok = await confirm({ title: 'Reset all progress?', body: 'Coins, gems, skins, upgrades and stats will be erased. Purchases can be restored from the store.', ok: 'Reset' });
  if (!ok) return;
  save = resetSave();
  ensureMissions(save);
  writeSave(save);
  setSoundEnabled(save.settings.sound);
  closeAllModals();
  goHome();
  toast('Progress reset');
};

// ── Boot ───────────────────────────────────────────────────────────
document.addEventListener('pointerdown', unlockAudio, { once: true });
refreshAll();
if (save.stats.runs > 0 && dailyStatus(save).canClaim) setTimeout(() => openModal('daily'), 600);

// Let the canvas pick up the bundled font once it has loaded.
document.fonts?.load?.('900 20px Nunito').catch(() => {});

// Open the game with ?debug to poke at it from the browser console.
if (new URLSearchParams(location.search).has('debug')) {
  window.bloop = { game, get save() { return save; }, refresh: refreshAll, finishRun };
}
