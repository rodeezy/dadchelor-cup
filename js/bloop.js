// Draws the Bloop character. Shared by the game and the shop previews.

export function skinColors(skin, t) {
  if (skin.rainbow) {
    const h = (t * 90) % 360;
    return { c1: `hsl(${h},100%,72%)`, c2: `hsl(${(h + 60) % 360},85%,45%)`, trail: `hsl(${h},100%,80%)` };
  }
  return { c1: skin.color, c2: skin.color2, trail: skin.trail };
}

// Deterministic pseudo-random so patterns don't flicker.
const prand = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o { x, y, r, skin, t, sx, sy, rot, lookX, lookY, mood, blink }
 */
export function drawBloop(ctx, o) {
  const { x, y, r, skin, t = 0 } = o;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const { c1, c2 } = skinColors(skin, t);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot || 0);
  ctx.scale(sx, sy);
  ctx.globalAlpha *= skin.alpha ?? 1;

  // body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // patterns
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  if (skin.pattern === 'spots') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 6; i++) {
      const a = prand(i) * Math.PI * 2, d = prand(i + 9) * r * 0.75;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d + r * 0.2, r * (0.1 + prand(i + 3) * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (skin.pattern === 'stars' || skin.pattern === 'sparkle') {
    for (let i = 0; i < 9; i++) {
      const a = prand(i) * Math.PI * 2, d = prand(i + 5) * r * 0.9;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i));
      ctx.fillStyle = skin.pattern === 'stars' ? `rgba(255,255,255,${tw})` : `rgba(255,255,255,${tw * 0.9})`;
      const s = r * (skin.pattern === 'stars' ? 0.05 : 0.08);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // ninja band (behind eyes)
  if (skin.accessory === 'band') {
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(-r, -r * 0.42, r * 2, r * 0.42);
    ctx.beginPath();
    ctx.moveTo(r * 0.9, -r * 0.3);
    ctx.lineTo(r * 1.5, -r * 0.55 + Math.sin(t * 12) * r * 0.12);
    ctx.lineTo(r * 1.45, -r * 0.1 + Math.sin(t * 12 + 1) * r * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  // eyes
  const mood = o.mood || 'happy';
  const lx = (o.lookX || 0) * r * 0.12, ly = (o.lookY ?? 0.4) * r * 0.12;
  const blink = o.blink ? 0.12 : 1;
  for (const side of [-1, 1]) {
    const ex = side * r * 0.34, ey = -r * 0.18;
    if (mood === 'dead') {
      ctx.strokeStyle = '#1b1530';
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = 'round';
      const s = r * 0.13;
      ctx.beginPath();
      ctx.moveTo(ex - s, ey - s); ctx.lineTo(ex + s, ey + s);
      ctx.moveTo(ex + s, ey - s); ctx.lineTo(ex - s, ey + s);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.22, r * 0.26 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = '#1b1530';
      ctx.beginPath();
      ctx.arc(ex + lx, ey + ly, r * (mood === 'wow' ? 0.09 : 0.12), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + lx - r * 0.04, ey + ly - r * 0.05, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // mouth
  ctx.fillStyle = '#1b1530';
  ctx.strokeStyle = '#1b1530';
  ctx.lineWidth = r * 0.08;
  ctx.lineCap = 'round';
  if (mood === 'wow' || mood === 'dead') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.32, r * 0.11, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,90,140,0.35)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.58, r * 0.14, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // crown
  if (skin.accessory === 'crown') {
    ctx.fillStyle = '#ffd84f';
    ctx.strokeStyle = '#a87700';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    const cy = -r * 0.82, w = r * 0.6, h = r * 0.5;
    ctx.moveTo(-w, cy);
    ctx.lineTo(-w, cy - h * 0.6);
    ctx.lineTo(-w * 0.5, cy - h * 0.25);
    ctx.lineTo(0, cy - h);
    ctx.lineTo(w * 0.5, cy - h * 0.25);
    ctx.lineTo(w, cy - h * 0.6);
    ctx.lineTo(w, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(0, cy - h * 0.35, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
