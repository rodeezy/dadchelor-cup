// Core game: an endless faller. Drag to steer Bloop through gaps.
import { drawBloop, skinColors } from './bloop.js';

export const W = 400;          // logical width; height follows the screen
const WALL = 14;               // side wall thickness
const PR = 15;                 // player radius
const UPM = 40;                // world units per meter
const BAR = 18;                // gate thickness
const HIT_GRACE = 3;           // forgiving hitbox (units)
const CLOSE_CALL = 8;          // clearance that counts as a close call
const GATE_REACH = BAR / 2 + PR + 10; // vertical band around a gate where it can hit you

const ZONES = [
  { at: 0,    name: 'Cloud Layer',  top: '#6ec8ff', bot: '#cdeeff', bar: '#ff5d73', bar2: '#c9304a', wall: '#ffffff', dot: '#ffffff' },
  { at: 250,  name: 'Sunset Drift', top: '#ff8a65', bot: '#ffd59e', bar: '#5b2bd6', bar2: '#3a1597', wall: '#fff1e0', dot: '#fff4d6' },
  { at: 600,  name: 'Neon Caverns', top: '#170936', bot: '#3d0f63', bar: '#19f0ff', bar2: '#0a9fb0', wall: '#2a1450', dot: '#b06bff' },
  { at: 1000, name: 'Deep Abyss',   top: '#02112a', bot: '#063561', bar: '#ff3cac', bar2: '#b01570', wall: '#0b2445', dot: '#57c7ff' },
  { at: 1600, name: 'The Void',     top: '#000000', bot: '#1a0026', bar: '#ffe14d', bar2: '#c9a400', wall: '#16001f', dot: '#ffffff' },
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

function circleRectClear(px, py, x0, y0, x1, y1) {
  const cx = clamp(px, x0, x1), cy = clamp(py, y0, y1);
  return Math.hypot(px - cx, py - cy);
}
function circleSegClear(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class Game {
  constructor(canvas, hooks) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.state = 'idle'; // idle | playing | dying | dead | paused
    this.t = 0;
    this.skin = null;
    this.mods = { magnet: 0, doubler: 0, frenzy: 0, shield: 0, coinDoubler: false };
    this.safeTop = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.resetWorld();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ── setup ────────────────────────────────────────────────────────
  resize() {
    const rect = this.c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.c.width = Math.max(1, Math.round(rect.width * dpr));
    this.c.height = Math.max(1, Math.round(rect.height * dpr));
    this.scale = this.c.width / W;
    this.H = this.c.height / this.scale;
    const probe = document.getElementById('safe-probe');
    this.safeTop = probe ? parseFloat(getComputedStyle(probe).paddingTop) * dpr / this.scale || 0 : 0;
    if (!this.bg) this.makeBackground();
  }

  makeBackground() {
    this.bg = [];
    for (let i = 0; i < 40; i++) {
      this.bg.push({ x: rand(0, W), y: rand(0, 1400), z: rand(0.15, 0.6), s: rand(2, 9) });
    }
  }

  bindInput() {
    const el = this.c;
    this.drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      el.setPointerCapture?.(e.pointerId);
      this.drag = { id: e.pointerId, sx: e.clientX, px: this.player.tx };
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const unitsPerPx = W / el.getBoundingClientRect().width;
      const dx = (e.clientX - this.drag.sx) * unitsPerPx * 1.25;
      this.player.tx = clamp(this.drag.px + dx, WALL + PR, W - WALL - PR);
      if (Math.abs(dx) > 18) this.hooks.onSteer?.();
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    this.keys = {};
    window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
  }

  resetWorld() {
    this.camY = 0;
    this.speed = 300;
    this.player = { x: W / 2, tx: W / 2, vx: 0, sx: 1, sy: 1, blinkT: 2 };
    this.rows = [];
    this.coins = [];
    this.items = [];
    this.parts = [];
    this.popups = [];
    this.nextRowY = this.H * 0.95;
    this.lastGapX = W / 2;
    this.lastRowY = this.H * 0.3;
    this.lastReach = 0;
    this.meter = 0;
    this.frenzyT = 0;
    this.shield = false;
    this.invuln = 0;
    this.magnetT = 0;
    this.doublerT = 0;
    this.shake = 0;
    this.flash = 0;
    this.slowmo = 1;
    this.revived = false;
    this.zoneIdx = 0;
    this.zoneBanner = 0;
    this.deathT = 0;
    this.run = { score: 0, depth: 0, coins: 0, gems: 0, gates: 0, close: 0, frenzies: 0, powerups: 0, bonus: 0 };
  }

  setLoadout(skin, mods) {
    this.skin = skin;
    Object.assign(this.mods, mods);
  }

  start() {
    this.resetWorld();
    this.state = 'playing';
    if (this.mods.shield > 0 && Math.random() < this.mods.shield * 0.2) {
      this.shield = true;
      this.popup(this.player.x, this.playerY() - 40, 'SHIELD!', '#7fe3ff');
    }
  }

  pause() { if (this.state === 'playing') { this.state = 'paused'; this.drag = null; } }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.last = performance.now(); } }
  toIdle() { this.resetWorld(); this.state = 'idle'; }

  revive() {
    this.revived = true;
    this.state = 'playing';
    this.invuln = 2.5;
    this.slowmo = 1;
    const py = this.playerY();
    this.rows = this.rows.filter((r) => r.y < py - r.reach - 10 || r.y > py + this.H * 0.9);
    this.player.x = this.player.tx = this.lastGapX;
    this.burst(this.player.x, py, 30, '#ffffff', 260);
    this.popup(this.player.x, py - 40, 'REVIVED!', '#ffffff');
  }

  playerY() { return this.camY + this.H * 0.3; }
  depth() { return this.camY / UPM; }

  // ── generation ───────────────────────────────────────────────────
  spawnRow(y) {
    const d = y / UPM;
    const diff = clamp(d / 1500, 0, 1);
    const gw = lerp(175, 80, diff) + rand(-12, 12);
    const minX = WALL + gw / 2 + 4, maxX = W - WALL - gw / 2 - 4;
    const shift = lerp(150, 230, diff);
    const gx = clamp(this.lastGapX + rand(-shift, shift), minX, maxX);
    const prevGap = this.lastGapX;
    const prevEnd = this.lastRowY + this.lastReach; // where the previous obstacle stops being dangerous
    const r = Math.random();
    let row;

    if (d > 180 && r < 0.12 + diff * 0.18) {
      // spinner: a rotating bar; the open side is the "gap"
      const len = rand(110, 150 + diff * 40);
      const side = Math.random() < 0.5 ? -1 : 1;
      const cx = W / 2 + side * rand(30, 60);
      // The arm sweeps len/2 above and below its pivot, so it gets extra room.
      row = { kind: 'spinner', y: y + len / 2, cx, len, ang: rand(0, Math.PI), av: rand(1.6, 2.4 + diff * 1.4) * (Math.random() < 0.5 ? -1 : 1), reach: len / 2 + 6 + PR + 10 };
      this.lastGapX = cx - side * (len / 2 + 50);
      this.lastGapX = clamp(this.lastGapX, WALL + PR + 10, W - WALL - PR - 10);
    } else if (d > 350 && r < 0.3 + diff * 0.2) {
      // two gaps, pick either
      const gw2 = gw * 0.85;
      const a = rand(WALL + gw2 / 2 + 4, W / 2 - gw2 / 2 - 10);
      const b = rand(W / 2 + gw2 / 2 + 10, W - WALL - gw2 / 2 - 4);
      row = { kind: 'gate', y, gaps: [{ x: a, w: gw2 }, { x: b, w: gw2 }], amp: 0 };
      this.lastGapX = Math.abs(a - prevGap) < Math.abs(b - prevGap) ? a : b;
    } else {
      // single gap, sometimes sliding
      const moving = d > 70 && Math.random() < 0.15 + diff * 0.35;
      const amp = moving ? Math.min(rand(40, 90), (maxX - minX) / 2) : 0;
      const base = moving ? clamp(gx, minX + amp, maxX - amp) : gx;
      row = { kind: 'gate', y, gaps: [{ x: base, w: gw, base }], amp, freq: rand(1.2, 2.2 + diff), phase: rand(0, 6.28) };
      this.lastGapX = base;
    }
    row.reach = row.reach || GATE_REACH;
    row.minClear = Infinity;
    row.passed = false;
    row.broken = false;
    this.rows.push(row);

    // collectibles along the safe path from the previous gap to this one
    const fromY = prevEnd + 10, toY = row.y - row.reach - 10;
    const roll = Math.random();
    if (roll < 0.7 && toY - fromY > 60) {
      const n = Math.floor((toY - fromY) / 34);
      const wig = Math.random() < 0.35 ? rand(15, 35) : 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = lerp(prevGap, this.lastGapX, t * t * (3 - 2 * t)) + Math.sin(t * Math.PI * 2) * wig;
        this.coins.push({ x: clamp(x, WALL + 12, W - WALL - 12), y: lerp(fromY, toY, t), taken: false, mag: false });
      }
    }
    const midX = (prevGap + this.lastGapX) / 2, midY = (fromY + toY) / 2;
    if (d > 30 && Math.random() < 0.075) {
      const pick = Math.random();
      const kind = pick < 0.38 ? 'magnet' : pick < 0.7 ? 'shield' : 'doubler';
      this.items.push({ kind, x: midX, y: midY, taken: false });
    } else if (d > 80 && Math.random() < 0.03) {
      this.items.push({ kind: 'gem', x: midX, y: midY, taken: false });
    }
    this.lastRowY = row.y;
    this.lastReach = row.reach;
    return row.y + row.reach - GATE_REACH;
  }

  rowSpacing(d) { return Math.max(205, 300 - d * 0.07); }

  gapX(row, gap) {
    return row.amp ? gap.base + Math.sin(this.t * row.freq + row.phase) * row.amp : gap.x;
  }

  // Distance from the player's edge to the row's geometry (negative = overlap).
  rowClearance(row, px, py) {
    if (row.kind === 'spinner') {
      const hx = Math.cos(row.ang) * row.len / 2, hy = Math.sin(row.ang) * row.len / 2;
      return circleSegClear(px, py, row.cx - hx, row.y - hy, row.cx + hx, row.y + hy) - 6 - PR;
    }
    const y0 = row.y - BAR / 2, y1 = row.y + BAR / 2;
    const gaps = row.gaps.map((g) => ({ x: this.gapX(row, g), w: g.w })).sort((a, b) => a.x - b.x);
    let best = Infinity;
    let left = -50;
    for (const g of gaps) {
      best = Math.min(best, circleRectClear(px, py, left, y0, g.x - g.w / 2, y1));
      left = g.x + g.w / 2;
    }
    best = Math.min(best, circleRectClear(px, py, left, y0, W + 50, y1));
    return best - PR;
  }

  // ── update ───────────────────────────────────────────────────────
  frame(now) {
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state !== 'paused') {
      this.t += dt;
      this.update(dt);
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(rawDt) {
    const p = this.player;
    // blink timer
    p.blinkT -= rawDt;
    if (p.blinkT < -0.12) p.blinkT = rand(2, 4.5);

    if (this.state === 'idle') {
      this.camY += 60 * rawDt;
      p.x = W / 2 + Math.sin(this.t * 1.3) * 30;
      p.vx = Math.cos(this.t * 1.3) * 39;
      this.updateParticles(rawDt);
      return;
    }
    if (this.state === 'dying' || this.state === 'dead') {
      this.slowmo = lerp(this.slowmo, 0.15, rawDt * 4);
      this.deathT += rawDt;
      this.updateParticles(rawDt * Math.max(this.slowmo, 0.4));
      this.shake *= Math.pow(0.02, rawDt);
      if (this.state === 'dying' && this.deathT > 0.85) {
        this.state = 'dead';
        this.hooks.onDeath?.(this.run, !this.revived);
      }
      return;
    }

    const dt = rawDt * this.slowmo;
    const d = this.depth();

    // speed ramps up and plateaus
    const target = 320 + 320 * (1 - Math.exp(-this.camY / 32000));
    this.speed = this.frenzyT > 0 ? target * 1.55 : target;
    this.camY += this.speed * dt;

    // keyboard steering for desktop testing
    if (this.keys.ArrowLeft || this.keys.a) p.tx = clamp(p.tx - 420 * dt, WALL + PR, W - WALL - PR);
    if (this.keys.ArrowRight || this.keys.d) p.tx = clamp(p.tx + 420 * dt, WALL + PR, W - WALL - PR);

    const prevX = p.x;
    p.x = lerp(p.x, p.tx, 1 - Math.exp(-22 * dt));
    p.vx = (p.x - prevX) / Math.max(dt, 0.0001);
    const stretch = clamp(Math.abs(p.vx) / 1600, 0, 0.25);
    p.sx = 1 + stretch; p.sy = 1 - stretch * 0.6 + (this.frenzyT > 0 ? 0.08 : 0);

    // timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.doublerT = Math.max(0, this.doublerT - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.shake *= Math.pow(0.02, dt);
    if (this.zoneBanner > 0) this.zoneBanner -= dt;
    if (this.frenzyT > 0) {
      this.frenzyT -= dt;
      if (this.frenzyT <= 0) { this.frenzyT = 0; this.invuln = Math.max(this.invuln, 1); }
    }

    // zones
    const zi = ZONES.reduce((acc, z, i) => (d >= z.at ? i : acc), 0);
    if (zi !== this.zoneIdx) { this.zoneIdx = zi; this.zoneBanner = 2.4; this.hooks.sfx?.('zone'); }

    // spawn
    while (this.nextRowY < this.camY + this.H + 200) {
      const end = this.spawnRow(this.nextRowY);
      this.nextRowY = end + this.rowSpacing(end / UPM) + rand(-20, 20);
    }

    const py = this.playerY();

    // rows
    for (const row of this.rows) {
      if (row.kind === 'spinner') row.ang += row.av * dt;
      if (row.broken) continue;
      if (Math.abs(row.y - py) < row.reach + 30) {
        const clear = this.rowClearance(row, p.x, py);
        if (clear < -HIT_GRACE) {
          if (this.frenzyT > 0 || this.invuln > 0) {
            if (this.frenzyT > 0) this.smashRow(row);
          } else if (this.shield) {
            this.shield = false;
            this.invuln = 1.2;
            this.shake = 10;
            this.hooks.sfx?.('shieldPop');
            this.hooks.haptic?.('medium');
            this.burst(p.x, py, 22, '#7fe3ff', 240);
            this.popup(p.x, py - 40, 'SAVED!', '#7fe3ff');
          } else {
            this.die();
            return;
          }
        } else {
          row.minClear = Math.min(row.minClear, clear);
        }
      }
      if (!row.passed && row.y < py - row.reach) {
        row.passed = true;
        if (!row.broken) this.onGatePassed(row, p.x, py);
      }
    }
    this.rows = this.rows.filter((r) => r.y > this.camY - 100);

    // coins
    const magnetR = this.magnetT > 0 ? 165 : this.frenzyT > 0 ? 90 : 0;
    for (const c of this.coins) {
      if (c.taken) continue;
      const dx = p.x - c.x, dy = py - c.y;
      const dist = Math.hypot(dx, dy);
      if (magnetR && dist < magnetR) c.mag = true;
      if (c.mag) {
        const k = Math.min(1, dt * 14);
        c.x += dx * k; c.y += dy * k;
      }
      if (dist < PR + 14) this.collectCoin(c);
    }
    this.coins = this.coins.filter((c) => !c.taken && c.y > this.camY - 60);

    // items
    for (const it of this.items) {
      if (it.taken) continue;
      if (Math.hypot(p.x - it.x, py - it.y) < PR + 18) this.collectItem(it);
    }
    this.items = this.items.filter((i) => !i.taken && i.y > this.camY - 60);

    // trail
    const { trail } = skinColors(this.skin, this.t);
    if (Math.random() < 0.9) {
      this.parts.push({
        x: p.x + rand(-6, 6), y: py - PR * 0.6, vx: rand(-20, 20), vy: -this.speed * 0.15,
        life: 0.45, max: 0.45, s: rand(3, 7), c: this.frenzyT > 0 ? `hsl(${(this.t * 600) % 360},100%,65%)` : trail, world: true,
      });
    }

    this.updateParticles(dt);

    const newScore = Math.floor(d) + this.run.bonus;
    this.run.depth = Math.floor(d);
    this.run.score = newScore;
    this.hooks.onTick?.(this.run);
  }

  onGatePassed(row, px, py) {
    this.run.gates++;
    this.addMeter(6);
    this.hooks.sfx?.('gate');
    if (row.minClear < CLOSE_CALL && this.invuln <= 0 && this.frenzyT <= 0) {
      this.run.close++;
      this.run.bonus += 5;
      this.addMeter(16);
      this.popup(px, py - 34, 'CLOSE! +5', '#ffffff');
      this.hooks.sfx?.('close');
      this.hooks.haptic?.('light');
      this.flash = 0.35;
    }
  }

  addMeter(v) {
    if (this.frenzyT > 0) return;
    this.meter += v;
    if (this.meter >= 100) {
      this.meter = 0;
      this.frenzyT = 4 + this.mods.frenzy * 0.8;
      this.run.frenzies++;
      this.shake = 8;
      this.hooks.sfx?.('frenzy');
      this.hooks.haptic?.('heavy');
      this.popup(W / 2, this.playerY() + 60, 'FRENZY!', '#ffe14d', 1.6);
    }
  }

  coinMult() { return (this.doublerT > 0 ? 2 : 1) * (this.frenzyT > 0 ? 2 : 1); }

  collectCoin(c) {
    c.taken = true;
    const v = this.coinMult();
    this.run.coins += v;
    this.addMeter(0.8);
    this.hooks.sfx?.('coin');
    for (let i = 0; i < 5; i++) {
      this.parts.push({ x: c.x, y: c.y, vx: rand(-90, 90), vy: rand(-90, 90), life: 0.35, max: 0.35, s: rand(2, 4), c: '#ffe14d', world: true });
    }
    if (v > 1) this.popup(c.x, c.y - 10, `+${v}`, '#ffe14d', 0.7);
  }

  collectItem(it) {
    it.taken = true;
    const py = this.playerY();
    if (it.kind === 'gem') {
      this.run.gems++;
      this.hooks.sfx?.('gem');
      this.popup(it.x, it.y - 20, '+1 GEM', '#9ef3ff');
      this.burst(it.x, it.y, 18, '#9ef3ff', 200);
      return;
    }
    this.run.powerups++;
    this.hooks.sfx?.('power');
    this.hooks.haptic?.('light');
    if (it.kind === 'magnet') { this.magnetT = 6 + this.mods.magnet * 1.5; this.popup(it.x, py - 40, 'MAGNET!', '#ff6b8a'); }
    if (it.kind === 'shield') { this.shield = true; this.popup(it.x, py - 40, 'SHIELD!', '#7fe3ff'); }
    if (it.kind === 'doubler') { this.doublerT = 8 + this.mods.doubler * 2; this.popup(it.x, py - 40, '2× COINS!', '#ffe14d'); }
    this.burst(it.x, it.y, 16, '#ffffff', 180);
  }

  smashRow(row) {
    row.broken = true;
    this.run.bonus += 2;
    this.shake = Math.max(this.shake, 6);
    this.hooks.sfx?.('smash');
    this.hooks.haptic?.('light');
    const z = this.zoneColors();
    for (let i = 0; i < 26; i++) {
      this.parts.push({
        x: rand(WALL, W - WALL), y: row.y + rand(-8, 8), vx: rand(-200, 200), vy: rand(-260, 60),
        life: 0.8, max: 0.8, s: rand(4, 9), c: z.bar, world: true, grav: 600, sq: true,
      });
    }
  }

  die() {
    this.state = 'dying';
    this.deathT = 0;
    this.shake = 18;
    this.flash = 1;
    this.drag = null;
    this.hooks.sfx?.('crash');
    this.hooks.haptic?.('heavy');
    const { c1, c2 } = skinColors(this.skin, this.t);
    const py = this.playerY();
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 420);
      this.parts.push({ x: this.player.x, y: py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.2, max: 1.2, s: rand(3, 9), c: i % 2 ? c1 : c2, world: true, grav: 500 });
    }
  }

  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, s: rand(2, 5), c: color, world: true });
    }
  }

  popup(x, y, text, color, life = 1) {
    this.popups.push({ x, y, text, color, life, max: life });
  }

  updateParticles(dt) {
    for (const q of this.parts) {
      q.life -= dt;
      q.vy += (q.grav || 0) * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const u of this.popups) { u.life -= dt; u.y -= 40 * dt; }
    this.popups = this.popups.filter((u) => u.life > 0);
  }

  // ── render ───────────────────────────────────────────────────────
  zoneColors() {
    const d = this.state === 'idle' ? 0 : this.depth();
    let i = 0;
    while (i < ZONES.length - 1 && d >= ZONES[i + 1].at) i++;
    const z = ZONES[i], n = ZONES[i + 1];
    if (!n) return z;
    const t = clamp((d - (n.at - 40)) / 40, 0, 1);
    if (t <= 0) return z;
    const mix = {};
    for (const k of ['top', 'bot', 'bar', 'bar2', 'wall', 'dot']) mix[k] = mixHex(z[k], n[k], t);
    return mix;
  }

  render() {
    const ctx = this.ctx, H = this.H;
    const z = this.zoneColors();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, z.top);
    g.addColorStop(1, z.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(sx, sy);

    // parallax dots / clouds
    ctx.fillStyle = z.dot;
    for (const b of this.bg) {
      const y = ((b.y - this.camY * b.z) % 1400 + 1400) % 1400 - 100;
      if (y > H + 20) continue;
      ctx.globalAlpha = 0.12 + b.z * 0.35;
      if (this.frenzyT > 0) {
        ctx.fillRect(b.x, y, 2, b.s * 8);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, y, b.s * (this.zoneIdx === 0 ? 3 : 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // world space
    ctx.save();
    ctx.translate(0, -this.camY);

    // walls with scrolling stripes
    ctx.fillStyle = z.wall;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, this.camY, WALL, H);
    ctx.fillRect(W - WALL, this.camY, WALL, H);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = z.bar;
    for (let y = Math.floor(this.camY / 60) * 60; y < this.camY + H; y += 60) {
      ctx.fillRect(0, y, WALL, 24);
      ctx.fillRect(W - WALL, y + 30, WALL, 24);
    }
    ctx.globalAlpha = 1;

    // rows
    for (const row of this.rows) {
      if (row.broken) continue;
      this.drawRow(ctx, row, z);
    }

    // coins
    for (const c of this.coins) this.drawCoin(ctx, c.x, c.y);

    // items
    for (const it of this.items) this.drawItem(ctx, it);

    // particles
    for (const q of this.parts) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.c;
      if (q.sq) ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (0.4 + 0.6 * q.life / q.max), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    // player
    const py = this.playerY();
    const p = this.player;
    if (this.state === 'idle' && this.skin) {
      drawBloop(ctx, { x: p.x, y: this.camY + H * 0.4, r: PR * 1.8, skin: this.skin, t: this.t, lookX: clamp(p.vx / 60, -1, 1), lookY: 0.2, blink: p.blinkT < 0 });
    } else if (this.state !== 'dying' && this.state !== 'dead' && this.skin) {
      const blinkOn = this.invuln > 0 && this.frenzyT <= 0 && Math.floor(this.t * 14) % 2 === 0;
      if (!blinkOn) {
        if (this.frenzyT > 0) {
          ctx.fillStyle = `hsla(${(this.t * 600) % 360},100%,60%,0.35)`;
          ctx.beginPath(); ctx.arc(p.x, py, PR * 1.9, 0, Math.PI * 2); ctx.fill();
        }
        drawBloop(ctx, {
          x: p.x, y: py, r: PR, skin: this.skin, t: this.t, sx: p.sx, sy: p.sy,
          rot: clamp(p.vx / 3000, -0.35, 0.35), lookX: clamp(p.vx / 400, -1, 1), lookY: 1,
          mood: this.frenzyT > 0 || this.flash > 0.1 ? 'wow' : 'happy', blink: p.blinkT < 0,
        });
      }
      if (this.shield) {
        ctx.strokeStyle = 'rgba(127,227,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, py, PR + 9 + Math.sin(this.t * 8) * 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(127,227,255,0.15)';
        ctx.fill();
      }
      if (this.magnetT > 0) {
        ctx.strokeStyle = `rgba(255,107,138,${0.25 + 0.15 * Math.sin(this.t * 10)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.arc(p.x, py, 50 + (this.t * 80) % 40, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // popups
    ctx.textAlign = 'center';
    for (const u of this.popups) {
      ctx.globalAlpha = clamp(u.life / u.max * 1.5, 0, 1);
      const s = u.text === 'FRENZY!' ? 34 : 18;
      ctx.font = `900 ${s}px Nunito, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,10,40,0.7)';
      ctx.strokeText(u.text, u.x, u.y);
      ctx.fillStyle = u.color;
      ctx.fillText(u.text, u.x, u.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // frenzy tint + flash
    if (this.frenzyT > 0) {
      ctx.fillStyle = `hsla(${(this.t * 200) % 360},100%,60%,0.10)`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'dying') this.drawHud(ctx, z);
  }

  drawRow(ctx, row, z) {
    if (row.kind === 'spinner') {
      const hx = Math.cos(row.ang) * row.len / 2, hy = Math.sin(row.ang) * row.len / 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = z.bar2;
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(row.cx - hx, row.y - hy + 3); ctx.lineTo(row.cx + hx, row.y + hy + 3); ctx.stroke();
      ctx.strokeStyle = z.bar;
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(row.cx - hx, row.y - hy); ctx.lineTo(row.cx + hx, row.y + hy); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(row.cx, row.y, 5, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const gaps = row.gaps.map((g) => ({ x: this.gapX(row, g), w: g.w })).sort((a, b) => a.x - b.x);
    let left = 0;
    const segs = [];
    for (const g of gaps) { segs.push([left, g.x - g.w / 2]); left = g.x + g.w / 2; }
    segs.push([left, W]);
    for (const [a, b] of segs) {
      if (b - a < 1) continue;
      ctx.fillStyle = z.bar2;
      roundRect(ctx, a, row.y - BAR / 2 + 3, b - a, BAR, 7);
      ctx.fill();
      ctx.fillStyle = z.bar;
      roundRect(ctx, a, row.y - BAR / 2, b - a, BAR, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(ctx, a + 4, row.y - BAR / 2 + 3, Math.max(0, b - a - 8), 4, 2);
      ctx.fill();
    }
    if (row.amp) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (const g of gaps) {
        ctx.beginPath(); ctx.arc(g.x - g.w / 2 - 8, row.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + g.w / 2 + 8, row.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawCoin(ctx, x, y, spin = true) {
    const w = spin ? Math.abs(Math.cos(this.t * 4 + y * 0.02)) : 1;
    ctx.fillStyle = '#c98a00';
    ctx.beginPath(); ctx.ellipse(x, y + 1.5, 9 * Math.max(0.25, w), 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd84f';
    ctx.beginPath(); ctx.ellipse(x, y, 9 * Math.max(0.25, w), 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath(); ctx.ellipse(x - 2 * w, y - 2, 3 * Math.max(0.25, w), 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawItem(ctx, it) {
    const bob = Math.sin(this.t * 5 + it.y) * 3;
    const x = it.x, y = it.y + bob;
    if (it.kind === 'gem') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(this.t * 3) * 0.2);
      ctx.fillStyle = 'rgba(158,243,255,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, 20 + Math.sin(this.t * 6) * 2, 0, Math.PI * 2); ctx.fill();
      drawGem(ctx, 0, 0, 12);
      ctx.restore();
      return;
    }
    const colors = { magnet: '#ff6b8a', shield: '#4cc9ff', doubler: '#ffb400' };
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(x, y, 21 + Math.sin(this.t * 6) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colors[it.kind];
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (it.kind === 'magnet') {
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(x, y - 1, 7, Math.PI, 0); ctx.stroke();
      ctx.fillRect(x - 9.25, y - 1, 4.5, 6);
      ctx.fillRect(x + 4.75, y - 1, 4.5, 6);
    } else if (it.kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x + 8, y - 5); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 6, y + 4); ctx.lineTo(x - 8, y - 5); ctx.closePath(); ctx.fill();
    } else {
      ctx.font = '900 14px Nunito, ui-rounded, system-ui, sans-serif';
      ctx.fillText('2×', x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawHud(ctx) {
    const top = this.safeTop + 14;
    ctx.textAlign = 'center';
    ctx.font = '900 46px Nunito, ui-rounded, system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(20,10,40,0.45)';
    ctx.strokeText(String(this.run.score), W / 2, top + 42);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(this.run.score), W / 2, top + 42);

    // coins (left)
    this.drawCoin(ctx, 34, top + 22, false);
    ctx.textAlign = 'left';
    ctx.font = '800 20px Nunito, ui-rounded, system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText(String(this.run.coins), 50, top + 29);
    ctx.fillText(String(this.run.coins), 50, top + 29);

    // frenzy meter
    const mw = 150, mx = W / 2 - mw / 2, my = top + 56;
    ctx.fillStyle = 'rgba(20,10,40,0.35)';
    roundRect(ctx, mx, my, mw, 10, 5); ctx.fill();
    const fill = this.frenzyT > 0 ? this.frenzyT / (4 + this.mods.frenzy * 0.8) : this.meter / 100;
    ctx.fillStyle = this.frenzyT > 0 ? `hsl(${(this.t * 600) % 360},100%,60%)` : '#ffe14d';
    if (fill > 0.02) { roundRect(ctx, mx, my, mw * clamp(fill, 0, 1), 10, 5); ctx.fill(); }

    // active powerups
    const chips = [];
    if (this.frenzyT > 0) chips.push(['FRENZY', this.frenzyT, '#ff5d2a']);
    if (this.magnetT > 0) chips.push(['MAGNET', this.magnetT, '#ff6b8a']);
    if (this.doublerT > 0) chips.push(['2×', this.doublerT, '#ffb400']);
    if (this.shield) chips.push(['SHIELD', null, '#4cc9ff']);
    ctx.font = '800 12px Nunito, ui-rounded, system-ui, sans-serif';
    let cx = W / 2 - (chips.length * 76) / 2;
    for (const [label, tm, col] of chips) {
      ctx.fillStyle = col;
      roundRect(ctx, cx + 4, my + 18, 68, 20, 10); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(tm != null ? `${label} ${Math.ceil(tm)}` : label, cx + 38, my + 32);
      cx += 76;
    }

    // zone banner
    if (this.zoneBanner > 0) {
      const a = clamp(Math.min(this.zoneBanner, 2.4 - this.zoneBanner) * 3, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = '800 13px Nunito, ui-rounded, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`${ZONES[this.zoneIdx].at}m`, W / 2, this.H * 0.55 - 26);
      ctx.font = '900 30px Nunito, ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(20,10,40,0.5)';
      ctx.strokeText(ZONES[this.zoneIdx].name.toUpperCase(), W / 2, this.H * 0.55 + 6);
      ctx.fillStyle = '#fff';
      ctx.fillText(ZONES[this.zoneIdx].name.toUpperCase(), W / 2, this.H * 0.55 + 6);
      ctx.globalAlpha = 1;
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawGem(ctx, x, y, s) {
  ctx.fillStyle = '#3fd0ff';
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.85, y - s * 0.25); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.85, y - s * 0.25);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b8f6ff';
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.4, y - s * 0.25); ctx.lineTo(x, y + s * 0.2); ctx.lineTo(x - s * 0.4, y - s * 0.25);
  ctx.closePath(); ctx.fill();
}
