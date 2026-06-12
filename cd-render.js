'use strict';
// ================= Render =================
const RARITY_TIP_COL = { common: '#c9d1d9', rare: '#58a6ff', legendary: '#e3b341' };
// Canonical symbol drawn on an enemy sphere. Frozen always shows ❄; heal/shield/
// split/phantom/boss are always shape-coded; fast/tank are hue-only by default and
// only gain a symbol when the colorblind aid is on (v1.18.0). '' = no glyph (norm,
// or fast/tank with the aid off). Single source of truth for draw() + tests.
function enemyGlyph(e) {
  if (e.frozen > 0) return '❄';
  switch (e.kind) {
    case 'boss': return '☠';
    case 'heal': return '+';
    case 'shield': return '🛡';
    case 'split': return '✂';
    case 'phantom': return '👻';
    case 'fast': return colorblindAid ? '»' : '';
    case 'tank': return colorblindAid ? '◆' : '';
    default: return '';
  }
}
// Sphere colour per enemy kind for the bottom-left wave-preview discs.
// KEEP IN SYNC with the kind colours in buildWave() (cd-game.js).
const PREVIEW_COLOR = {
  norm:'#3fb950', fast:'#d2a8ff', tank:'#f0883e', heal:'#56d364',
  shield:'#8b949e', split:'#e3b341', phantom:'#39d0d8', boss:'#f85149',
};
// Per-glyph font so existing kinds render byte-identically (only fast/tank are new).
const GLYPH_FONT = {
  '❄': '10px sans-serif', '☠': 'bold 16px sans-serif', '+': 'bold 12px sans-serif',
  '🛡': '10px sans-serif', '✂': 'bold 11px sans-serif', '👻': '11px sans-serif',
  '»': 'bold 13px sans-serif', '◆': 'bold 12px sans-serif',
};
// Tooltip for a hovered run-perk icon: name (in rarity colour) + what it does.
// Description is looked up from PERKS by id so it works for old saves too.
function drawPerkTooltip(iconX, p) {
  const def = (typeof PERKS !== 'undefined') ? PERKS.find(pp => pp.id === p.id) : null;
  const desc = def ? def.desc : '';
  const rarity = (p.rarity ? p.rarity[0].toUpperCase() + p.rarity.slice(1) : '');
  const title = `${p.icon} ${p.name}`;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px sans-serif';
  const tw = ctx.measureText(title).width;
  ctx.font = '12px sans-serif';
  const dw = ctx.measureText(desc).width;
  const rw = rarity ? ctx.measureText(rarity).width : 0;
  const boxW = Math.min(W - 16, Math.max(tw, dw, rw) + 20);
  const boxH = 52;
  let bx = Math.max(8, Math.min(iconX - 4, W - boxW - 8));
  const by = 30;
  ctx.fillStyle = 'rgba(13,20,32,0.95)';
  ctx.strokeStyle = RARITY_TIP_COL[p.rarity] || '#30363d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 6); else ctx.rect(bx, by, boxW, boxH);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = RARITY_TIP_COL[p.rarity] || '#c9d1d9';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(title, bx + 10, by + 18);
  if (rarity) { ctx.font = '10px sans-serif'; ctx.fillStyle = '#8b949e'; ctx.fillText(rarity.toUpperCase(), bx + 10, by + 31); }
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(desc, bx + 10, by + 45);
  ctx.restore();
}
function draw() {
  ctx.save();
  if (shake > 0 && shakeEnabled && !reduceMotion()) {
    ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  }
  ctx.clearRect(-20, -20, W+40, H+40);

  // background gradient + stars — colours come from the active map theme (cosmetic)
  const pal = mapPalette();
  const grad = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, 600);
  grad.addColorStop(0, pal.bgIn);
  grad.addColorStop(1, pal.bgOut);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const now = performance.now() / 1000;
  for (const s of stars) {
    const tw = 0.3 + 0.7 * Math.abs(Math.sin(now * s.sp + s.ph));
    ctx.globalAlpha = tw * 0.6;
    ctx.fillStyle = pal.star;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // grid
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // path with depth bevel + glow
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.pDark; ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(waypoints[0][0], waypoints[0][1] + 6);
  for (const [x,y] of waypoints) ctx.lineTo(x, y + 6);
  ctx.stroke();
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = pal.pMid; ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.moveTo(waypoints[0][0], waypoints[0][1]);
  for (const [x,y] of waypoints) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = pal.pLite; ctx.lineWidth = 34;
  ctx.stroke();
  ctx.strokeStyle = pal.dash;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 20]);
  ctx.lineDashOffset = -performance.now()/40;
  ctx.stroke();
  ctx.setLineDash([]);

  // exit marker
  const exitPt = waypoints[waypoints.length-1];
  ctx.font = '22px sans-serif';
  ctx.fillText('🏠', Math.min(W-30, exitPt[0]-14), exitPt[1]+8);

  // run perks display (the "milestone bonuses" drafted every 5 waves) — hover an
  // icon to see what it does (canvas-drawn, so we detect the hover + draw a tooltip)
  if (runPerks.length && started) {
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    const slots = [];
    let px = 12;
    for (const p of runPerks) { ctx.fillText(p.icon, px, 22); slots.push(px); px += 22; }
    let hovered = -1;
    if (mouseY >= 2 && mouseY <= 28 && mouseX >= 8) {
      const idx = Math.floor((mouseX - 8) / 22);
      if (idx >= 0 && idx < runPerks.length && mouseX <= slots[idx] + 20) hovered = idx;
    }
    if (hovered >= 0) drawPerkTooltip(slots[hovered], runPerks[hovered]);
  }

  // meteor target reticle
  if (armedAbility === 'meteor' && mouseX > 0) {
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 95, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,123,66,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,123,66,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☄️', mouseX, mouseY + 7);
    ctx.textAlign = 'left';
  }

  // placement preview
  if (selectedShop && mouseX > 0 && !gameOver && started && !paused && armedAbility !== 'meteor') {
    const def = TOWER_TYPES[selectedShop];
    const ok = canPlace(mouseX, mouseY);
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, def.range, 0, Math.PI*2);
    ctx.fillStyle = ok ? (selectedShop==='buff' ? 'rgba(240,136,62,0.1)' : 'rgba(88,166,255,0.08)') : 'rgba(248,81,73,0.08)';
    ctx.fill();
    ctx.strokeStyle = ok ? 'rgba(88,166,255,0.4)' : 'rgba(248,81,73,0.5)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 13, 0, Math.PI*2);
    ctx.fillStyle = ok ? def.color : '#f85149';
    ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
  }

  // shop hover: preview a tower's range at board centre before you select/place it,
  // so you can compare coverage. (The placement preview above follows the cursor once
  // a tower is actually selected.)
  if (hoveredShop && !selectedShop && started && !gameOver && TOWER_TYPES[hoveredShop]) {
    const def = TOWER_TYPES[hoveredShop];
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, def.range, 0, Math.PI * 2);
    ctx.fillStyle = def.proj === 'none' ? 'rgba(240,136,62,0.06)' : 'rgba(88,166,255,0.05)';
    ctx.fill();
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = def.color;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${def.icon} ${def.name} · range ${Math.round(def.range)}`, cx, cy - def.range - 8);
    ctx.restore();
  }

  // towers
  for (const t of towers) {
    const def = TOWER_TYPES[t.type];
    const buffed = t.type !== 'buff' && buffMultFor(t) > 1;
    if (t === selectedTower) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.type === 'buff' ? effBuffRange(t) : effRange(t), 0, Math.PI*2);
      ctx.fillStyle = t.type==='buff' ? 'rgba(240,136,62,0.08)' : 'rgba(88,166,255,0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(88,166,255,0.35)';
      ctx.stroke();
    }
    if (t.type === 'buff') {
      ctx.beginPath();
      ctx.arc(t.x, t.y, effBuffRange(t), 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(240,136,62,0.18)';
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // buffed glow ring
    if (buffed) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 17, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(240,136,62,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // ground shadow
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 10, 15, 6, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    // cylinder body
    const bodyG = ctx.createLinearGradient(t.x - 14, 0, t.x + 14, 0);
    bodyG.addColorStop(0, shade(def.color, -100));
    bodyG.addColorStop(0.45, shade(def.color, -35));
    bodyG.addColorStop(1, shade(def.color, -120));
    ctx.fillStyle = bodyG;
    ctx.fillRect(t.x - 13, t.y - 6, 26, 13);
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 7, 13, 5.5, 0, 0, Math.PI*2);
    ctx.fillStyle = shade(def.color, -110);
    ctx.fill();
    // lit top face
    const topG = ctx.createRadialGradient(t.x - 4, t.y - 9, 2, t.x, t.y - 6, 15);
    topG.addColorStop(0, shade(def.color, 55));
    topG.addColorStop(1, shade(def.color, -45));
    ctx.beginPath();
    ctx.ellipse(t.x, t.y - 6, 13, 5.5, 0, 0, Math.PI*2);
    ctx.fillStyle = topG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (t.type !== 'buff') {
      // turret barrel with metallic gradient
      ctx.save();
      ctx.translate(t.x, t.y - 7);
      ctx.rotate(t.angle);
      const barG = ctx.createLinearGradient(0, -4, 0, 4);
      barG.addColorStop(0, shade(def.color, 45));
      barG.addColorStop(0.5, def.color);
      barG.addColorStop(1, shade(def.color, -70));
      ctx.fillStyle = barG;
      ctx.fillRect(3, -3.5, 17, 7);
      if (t.flash > 0) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(22, 0, 4.5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      // dome
      ctx.beginPath();
      ctx.arc(t.x, t.y - 8, 4.5, 0, Math.PI*2);
      ctx.fillStyle = shade(def.color, 70);
      ctx.fill();
    } else {
      // rotating radar dish on top
      ctx.save();
      ctx.translate(t.x, t.y - 8);
      ctx.rotate(performance.now()/600);
      ctx.strokeStyle = shade(def.color, 40);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 9, -0.65, 0.65);
      ctx.stroke();
      ctx.fillStyle = shade(def.color, 70);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    // spec star
    if (t.spec) {
      ctx.fillStyle = '#d2a8ff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', t.x, t.y - 22);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#ffd866';
    for (let i = 0; i < t.level - 1; i++) {
      ctx.fillRect(t.x - 13 + i*4.5, t.y + 15, 3.2, 3.2);
    }
  }

  // enemies
  let bossAlive = null;
  for (const e of enemies) {
    if (e.x === undefined) continue;
    if (e.kind === 'boss') bossAlive = e;
    // motion streak for fast enemies
    if (e.kind === 'fast' && e.px) {
      ctx.strokeStyle = 'rgba(210,168,255,0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.px - (e.x-e.px)*3, e.py - (e.y-e.py)*3);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    if (e.slow > 0 && e.frozen <= 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(121,192,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (e.poison && e.poison.t > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(63,185,80,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (e.kind === 'heal') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 70, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(86,211,100,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // ground shadow
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + e.r * 0.85, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // shaded sphere
    const ecol = e.flash > 0 ? '#ffffff' : (e.frozen > 0 ? '#9be8ff' : e.color);
    // phantoms render translucent, fading almost out while they're mid-blink
    const phantomA = e.kind === 'phantom' ? (e.blinkInvuln > 0 ? 0.22 : 0.72) : 1;
    if (phantomA < 1) ctx.globalAlpha = phantomA;
    const sphereG = ctx.createRadialGradient(e.x - e.r*0.35, e.y - e.r*0.4, e.r*0.15, e.x, e.y, e.r);
    sphereG.addColorStop(0, shade(ecol, 85));
    sphereG.addColorStop(0.6, ecol);
    sphereG.addColorStop(1, shade(ecol, -85));
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle = sphereG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const gly = enemyGlyph(e);
    if (gly) {
      ctx.font = GLYPH_FONT[gly] || '11px sans-serif';
      ctx.fillText(gly, e.x, e.y + (gly === '☠' ? 6 : 4));
    }
    if (phantomA < 1) ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    const w = e.r * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w/2, e.y - e.r - 9, w, 4);
    ctx.fillStyle = e.hp/e.maxHp > 0.4 ? '#3fb950' : '#f85149';
    ctx.fillRect(e.x - w/2, e.y - e.r - 9, w * Math.max(0, e.hp/e.maxHp), 4);
  }

  // boss bar
  if (bossAlive) {
    const bw = 320, bx = (W-bw)/2, by = 14;
    ctx.fillStyle = 'rgba(13,17,23,0.8)';
    ctx.fillRect(bx-6, by-6, bw+12, 24);
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx-6, by-6, bw+12, 24);
    ctx.fillStyle = 'rgba(248,81,73,0.25)';
    ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#f85149';
    ctx.fillRect(bx, by, bw * Math.max(0, bossAlive.hp/bossAlive.maxHp), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`☠ OVERLORD — WAVE ${wave}`, W/2, by + 10);
    ctx.textAlign = 'left';
  }

  // beams
  for (const b of beams) {
    ctx.globalAlpha = Math.min(1, b.life * 10);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    const mx = (b.x1+b.x2)/2 + (Math.random()-0.5)*16;
    const my = (b.y1+b.y2)/2 + (Math.random()-0.5)*16;
    ctx.lineTo(mx, my);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // projectiles with motion trails
  for (const p of projectiles) {
    const pdx = p.target.x - p.x, pdy = p.target.y - p.y;
    const pdd = Math.hypot(pdx, pdy) || 1;
    const trailLen = p.kind === 'bomb' ? 18 : 13;
    const tx = p.x - pdx/pdd * trailLen, ty = p.y - pdy/pdd * trailLen;
    const tg = ctx.createLinearGradient(tx, ty, p.x, p.y);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(1, p.color);
    ctx.strokeStyle = tg;
    ctx.lineWidth = p.kind === 'bomb' ? 5 : 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === 'bomb' ? 6 : 3.5, 0, Math.PI*2);
    const pg = ctx.createRadialGradient(p.x - 1.5, p.y - 1.5, 0.5, p.x, p.y, p.kind === 'bomb' ? 6 : 3.5);
    pg.addColorStop(0, '#fff');
    pg.addColorStop(1, p.color);
    ctx.fillStyle = pg;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // particles
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // floaters
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // wave preview — glanceable roster of the NEXT wave: a colour disc (+ colorblind
  // glyph) and ×count per enemy kind, so you can plan purchases (how many tanks? boss?).
  if (!waveActive && !gameOver && started && wave >= 0 && wave < victoryWave()) {
    const comp = waveComposition(wave + 1);
    const py = H - 14;
    let px = 12;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(139,148,158,0.9)';
    ctx.fillText('Next:', px, py);
    px += ctx.measureText('Next:').width + 9;
    for (const c of comp) {
      const isBoss = c.kind === 'boss';
      const rad = isBoss ? 8 : 6;
      ctx.beginPath(); ctx.arc(px + rad, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = PREVIEW_COLOR[c.kind] || '#3fb950'; ctx.fill();
      const gl = enemyGlyph({ kind: c.kind, frozen: 0 });   // same single-source glyph as the sphere
      if (gl) {
        ctx.fillStyle = '#0d1117'; ctx.textAlign = 'center';
        ctx.font = (gl === '☠' ? 'bold 10px sans-serif' : 'bold 8px sans-serif');
        ctx.fillText(gl, px + rad, py + 0.5); ctx.textAlign = 'left';
      }
      px += rad * 2 + 3;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = isBoss ? '#f85149' : 'rgba(201,209,217,0.95)';
      const lbl = '×' + c.count;
      ctx.fillText(lbl, px, py);
      px += ctx.measureText(lbl).width + 11;
    }
    ctx.textBaseline = 'alphabetic';
    if (isMayhem() && wave > 0 && wave % 5 === 0) {
      ctx.fillStyle = 'rgba(210,168,255,0.9)'; ctx.font = '13px sans-serif';
      ctx.fillText('🌀 The world will shift when the next wave begins!', 12, H - 32);
    }
  }
  // active mayhem modifier
  if (waveActive && waveMod) {
    ctx.fillStyle = 'rgba(255,216,102,0.95)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${waveMod.icon} ${waveMod.name} — ${waveMod.desc}`, 12, H - 12);
  }

  // kill-streak combo meter (BOTTOM-RIGHT — its own empty corner, clear of the
  // whole top HUD band [boss bar, round-clear bonus, ability bar], the centered
  // milestone pop, and the bottom-LEFT wave preview): grows + glows with streak
  if (comboCount >= 2 && comboTimer > 0 && started && !gameOver) {
    const cc = comboColor(comboCount);
    const frac = Math.max(0, comboTimer / COMBO_WINDOW);
    const pulse = 1 + comboFlash * 0.22;
    const ax = W - 16, baseY = H - 26;   // bottom-right anchor (number baseline)
    ctx.save();
    ctx.translate(ax, baseY);
    ctx.scale(pulse, pulse);
    ctx.textAlign = 'right';
    // big multiplier right-aligned to the corner, "COMBO" label to its LEFT on
    // the same baseline (so the label never sits under — and collides with — the
    // timer bar). Right-anchored so wider counts (100×) grow leftward, not off-edge.
    ctx.fillStyle = cc;
    ctx.shadowColor = cc; ctx.shadowBlur = 12;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${comboCount}×`, 0, 0);
    const numW = ctx.measureText(`${comboCount}×`).width;
    ctx.shadowBlur = 0;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = 'rgba(230,237,243,0.85)';
    ctx.fillText('COMBO', -(numW + 6), -2);
    ctx.restore();
    // draining timer bar in its own lane below the number — clear of the text,
    // right-aligned to the corner, draining toward the corner as time runs out.
    const barW = 84;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(ax - barW, baseY + 10, barW, 4);
    // near-miss cue: in the last third of the window the bar blinks red so keeping
    // the chain alive feels tense (blink derived from comboTimer — no wall clock)
    const danger = frac < 0.33;
    ctx.fillStyle = (danger && Math.floor(comboTimer * 8) % 2 === 0) ? '#ff4d4d' : cc;
    ctx.fillRect(ax - barW * frac, baseY + 10, barW * frac, 4);
    ctx.textAlign = 'left';
  }

  // vignette for depth
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.42, W/2, H/2, W*0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // paused banner
  if (paused && started && !gameOver) {
    ctx.fillStyle = 'rgba(13,17,23,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#58a6ff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', W/2, H/2);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('Press P to resume', W/2, H/2 + 32);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

// ================= Loop =================
let last = performance.now();
function loop(now) {
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (let i = 0; i < speed; i++) update(dt);
  draw();
  requestAnimationFrame(loop);
}
started = false;
document.getElementById('speedBtn').textContent = `⏩ ${speed}x`;  // reflect restored cd_speed pref
loadMeta();
buildPath();
renderStartScreen();
resetState();
setActiveUI();
initWhatsNew();
requestAnimationFrame(loop);
