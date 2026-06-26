'use strict';
// ================= Render =================
const RARITY_TIP_COL = { common: '#c9d1d9', rare: '#58a6ff', legendary: '#e3b341' };
// Last grid cell the placement ghost occupied (render-only UI state, never saved) — drives the
// snap "tick" SFX when the ghost crosses into a new cell while placing (v2.24.0). null = not placing.
let _placeSnapCell = null;
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
    case 'warden': return '◈';
    case 'breacher': return '‼';
    case 'molten': return '🔥';
    case 'bastion': return '⬢';
    case 'jammer': return '⚡';
    case 'herald': return '⚑';
    case 'fast': return colorblindAid ? '»' : '';
    case 'tank': return colorblindAid ? '◆' : '';
    default: return '';
  }
}
// Sphere colour per enemy kind for the bottom-left wave-preview discs.
// KEEP IN SYNC with the kind colours in buildWave() (cd-game.js).
const PREVIEW_COLOR = {
  norm:'#3fb950', fast:'#d2a8ff', tank:'#f0883e', heal:'#56d364',
  shield:'#8b949e', split:'#e3b341', phantom:'#39d0d8', warden:'#58a6ff', breacher:'#d4566b', molten:'#e8482e', bastion:'#7a86c8', jammer:'#f2e34a', herald:'#ff79c6', boss:'#f85149',
};
// Per-glyph font so existing kinds render byte-identically (only fast/tank are new).
const GLYPH_FONT = {
  '❄': '10px sans-serif', '☠': 'bold 16px sans-serif', '+': 'bold 12px sans-serif',
  '🛡': '10px sans-serif', '✂': 'bold 11px sans-serif', '👻': '11px sans-serif',
  '»': 'bold 13px sans-serif', '◆': 'bold 12px sans-serif', '◈': 'bold 13px sans-serif',
  '‼': 'bold 12px sans-serif', '🔥': '10px sans-serif', '⬢': 'bold 13px sans-serif',
  '⚡': '11px sans-serif', '⚑': 'bold 13px sans-serif',
};
// Lobbed-shell arc (v1.79.0): a Mortar shell rises then falls along a parabola for
// real artillery feel, instead of homing flat like the Cannon's bomb. RENDER-ONLY —
// hit detection still uses the ground position p.x/p.y; only the drawn orb/trail/shadow
// are lifted. frac = traveled/(traveled+remaining) is robust as the target moves (0 at
// launch → ~1 at impact); peak height scales with shot distance (capped). Returns the
// upward pixel offset (0 for any non-lob projectile). Pure → unit-testable.
function lobLift(p) {
  if (!p || !p.lob) return 0;
  const traveled = Math.hypot(p.x - p.x0, p.y - p.y0);
  const remaining = Math.hypot(p.target.x - p.x, p.target.y - p.y);
  const total = traveled + remaining;
  if (total < 1) return 0;
  const frac = traveled / total;            // 0..1 flight progress
  const peak = Math.min(46, total * 0.2);   // taller arc for longer shots, capped
  return peak * 4 * frac * (1 - frac);       // parabola, peaks at frac=0.5
}
// Boss-bar mechanic badge (v1.36.0): names the active boss archetype (v1.25.0/v1.34.0)
// so the colour-coded aura ring isn't the only cue — colour matches the aura. Bulwark
// flips to SHIELDED while its damage-soak window is up. Returns null for vanilla
// (pre-wave-20) bosses with no archetype. Render-only, no save/economy impact.
function bossMechanicBadge(e) {
  if (!e || !e.bossType) return null;
  switch (e.bossType) {
    case 'regen':    return { label: 'REGENERATING', c: '86,211,100' };
    case 'summoner': return { label: 'SUMMONER', c: '255,148,146' };
    case 'bulwark':  return { label: e.shieldOn ? 'SHIELDED' : 'BULWARK', c: '121,192,255' };
    case 'enrager':  return { label: 'ENRAGED', c: '255,180,84' };
    case 'teleporter': return { label: 'TELEPORTER', c: '188,140,255' };
    case 'berserker': return { label: 'BERSERK', c: '255,106,106' };
    case 'disruptor': return { label: 'DISRUPTOR', c: '125,249,255' };
    case 'juggernaut': return { label: 'UNSTOPPABLE', c: '192,200,214' };
    case 'siphon':   return { label: 'SIPHON', c: '227,179,65' };
    case 'hydra':    return { label: 'HYDRA', c: '154,230,92' };
    case 'revenant': return { label: e.revived ? 'REVIVED' : 'REVENANT', c: '227,79,208' };
    case 'conduit':  return { label: e.conduitGuard > 0 ? 'SHIELDED' : 'CONDUIT', c: '94,242,200' };
    case 'warper':   return { label: 'WARPER', c: '124,108,255' };
    case 'fortifier': return { label: 'FORTIFYING', c: '205,127,50' };
    case 'warlord':  return { label: 'RALLYING', c: '240,200,60' };
    case 'suppressor': return { label: 'SUPPRESSING', c: '111,143,175' };
    case 'absorber': return { label: 'ABSORBING', c: '45,212,191' };
    case 'distorter': return { label: 'DISTORTING', c: '232,121,249' };
    case 'custodian': return { label: 'WARDING', c: '142,199,255' };
    case 'veil':     return { label: 'VEILING', c: '220,210,255' };
    default:         return null;
  }
}
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

  // 🛡️ Barrier charges (v1.93.0): a pulsing cyan shield ring over the exit while banked.
  if (barrierCharges > 0 && started) {
    ctx.save();
    const bx = Math.min(W-30, exitPt[0]-3), by = exitPt[1]+2;
    // Fade out + quicken the pulse over the last 5s as the charges near expiry (v1.100.1),
    // so the player can see the barrier is about to fade rather than vanish without warning.
    const expiring = barrierTimer < 5;
    const fade = expiring ? Math.max(0.25, barrierTimer / 5) : 1;
    const pulse = (reduceMotion() ? 0.75 : 0.55 + 0.25 * Math.sin(performance.now() / (expiring ? 90 : 200))) * fade;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#58e0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#58e0ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️' + barrierCharges, bx, by - 28);
    ctx.restore();
  }

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

  // placement preview — hidden while the cursor is over an existing tower: a click there
  // SELECTS the tower (it can never place there anyway), so drawing the red "can't place"
  // ghost just flickered over the tower you were reaching to click (owner bug report).
  if (selectedShop && mouseX > 0 && !gameOver && started && !paused && armedAbility !== 'meteor' && !towerAt(mouseX, mouseY)) {
    const def = TOWER_TYPES[selectedShop];
    // Snap the ghost to the grid so the preview lands exactly where the tower will (v1.24.0).
    const p = placeCoord(mouseX, mouseY);
    const ok = canPlace(p.x, p.y);
    // Visible placement grid while placing, so you can line towers up cleanly (owner FEEDBACK +
    // ROADMAP: lines, not just dots). Faint full grid lines + a highlighted target cell (v2.24.0).
    if (gridSnap) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(139,148,158,0.10)';
      ctx.beginPath();
      for (let gx = 0; gx <= W; gx += PLACE_GRID) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
      for (let gy = 0; gy <= H; gy += PLACE_GRID) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke();
      // Highlight the exact cell the tower will occupy, tinted by placeability.
      const cx0 = p.x - PLACE_GRID/2, cy0 = p.y - PLACE_GRID/2;
      ctx.fillStyle = ok ? 'rgba(88,166,255,0.12)' : 'rgba(248,81,73,0.14)';
      ctx.fillRect(cx0, cy0, PLACE_GRID, PLACE_GRID);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ok ? 'rgba(88,166,255,0.55)' : 'rgba(248,81,73,0.6)';
      ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, PLACE_GRID - 1, PLACE_GRID - 1);
      ctx.restore();
      // Snap "tick" SFX when the ghost crosses into a new cell — tactile grid feedback (v2.24.0).
      const cellKey = Math.floor(p.x / PLACE_GRID) + ',' + Math.floor(p.y / PLACE_GRID);
      if (_placeSnapCell !== null && _placeSnapCell !== cellKey) SFX.tick();
      _placeSnapCell = cellKey;
    } else {
      _placeSnapCell = null;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, def.range, 0, Math.PI*2);
    ctx.fillStyle = ok ? (selectedShop==='buff' ? 'rgba(240,136,62,0.1)' : 'rgba(88,166,255,0.08)') : 'rgba(248,81,73,0.08)';
    ctx.fill();
    ctx.strokeStyle = ok ? 'rgba(88,166,255,0.4)' : 'rgba(248,81,73,0.5)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI*2);
    ctx.fillStyle = ok ? def.color : '#f85149';
    ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
  } else {
    _placeSnapCell = null; // not placing → no stale cell, so re-selecting won't fire a spurious tick
  }

  // Gamepad cursor reticle (v1.43.0): a controller drives mouseX/mouseY but has no OS
  // pointer, so draw a crosshair so the player can see where A will act (select/place/aim).
  if (gamepadActive && started && !gameOver && !paused && mouseX > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(88,166,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mouseX, mouseY, 9, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - 14, mouseY); ctx.lineTo(mouseX - 4, mouseY);
    ctx.moveTo(mouseX + 4, mouseY); ctx.lineTo(mouseX + 14, mouseY);
    ctx.moveTo(mouseX, mouseY - 14); ctx.lineTo(mouseX, mouseY - 4);
    ctx.moveTo(mouseX, mouseY + 4); ctx.lineTo(mouseX, mouseY + 14);
    ctx.stroke();
    ctx.restore();
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
      // veterancy barrel tint (v2.21.0): a veteran+ tower gets a rank-coloured wash over the
      // barrel + a bright muzzle band, so an Elite/Ace/Legend tower reads as battle-hardened
      // at a glance (cosmetic — pairs with the rank pips; NO stat effect). Rotates with the gun.
      const bTint = towerBarrelTint(t);
      if (bTint) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = bTint;
        ctx.fillRect(3, -3.5, 17, 7);
        ctx.globalAlpha = 1;
        if (t.rankFlash > 0) { ctx.shadowColor = bTint; ctx.shadowBlur = 6 * t.rankFlash; }
        ctx.fillRect(16.5, -3.5, 3.5, 7);
        ctx.restore();
      }
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
    // veterancy rank pips (cosmetic, v1.100.0): a row of small stars over the tower for
    // its lifetime-kill rank, above the spec star. Pulses brighter+bigger right after a
    // promotion (rankFlash). Buff towers deal no damage, so they never rank up.
    const rTier = towerRankTier(t.kills);
    if (rTier > 0) {
      const rk = TOWER_RANKS[rTier];
      const pulse = t.rankFlash > 0 ? 1 + t.rankFlash * 0.6 : 1;
      ctx.save();
      ctx.fillStyle = rk.color;
      ctx.textAlign = 'center';
      ctx.font = `bold ${(8.5 * pulse).toFixed(1)}px sans-serif`;
      if (t.rankFlash > 0) { ctx.shadowColor = rk.color; ctx.shadowBlur = 8 * t.rankFlash; }
      ctx.fillText('★'.repeat(rTier), t.x, (t.spec ? t.y - 32 : t.y - 22));
      ctx.restore();
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#ffd866';
    for (let i = 0; i < t.level - 1; i++) {
      ctx.fillRect(t.x - 13 + i*4.5, t.y + 15, 3.2, 3.2);
    }
    // Static Storm: tower knocked offline — dim it + a flickering electric crackle ring
    if (t.empT > 0) {
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 16, 14, 0, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(13,17,23,0.5)';
      ctx.fill();
      const flick = 0.45 + 0.4 * Math.abs(Math.sin(performance.now()/60));
      ctx.strokeStyle = `rgba(125,249,255,${flick.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 13, 0, Math.PI*2);
      ctx.stroke();
      ctx.fillStyle = `rgba(125,249,255,${flick.toFixed(3)})`;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', t.x, t.y - 18);
      ctx.textAlign = 'left';
    } else if (t.suppressed > 0) {
      // Suppressor boss aura (v2.16.0): a faint slate ring marks a throttled tower (fires slower).
      // Distinct from the empT shutdown cue above (no dim, no ⚡) — this is a soft slow, not offline.
      const pulse = 0.3 + 0.18 * Math.abs(Math.sin(performance.now()/220));
      ctx.strokeStyle = `rgba(111,143,175,${pulse.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 14, 0, Math.PI*2);
      ctx.stroke();
    } else if (t.distorted > 0) {
      // Distorter boss aura (v2.30.0): a faint fuchsia ring marks a range-dampened tower (shorter reach).
      // Distinct hue from the suppressor's slate slow-ring, so the two debuff auras read apart.
      const pulse = 0.3 + 0.18 * Math.abs(Math.sin(performance.now()/220));
      ctx.strokeStyle = `rgba(232,121,249,${pulse.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 14, 0, Math.PI*2);
      ctx.stroke();
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
    // Warden support enemy (v1.35.0): a soft blue aura disc shows its protection radius
    // (mirrors the heal aura above); colour matches the warden sphere so the source reads
    // clearly. Pop the warden and the disc — and the protection — vanish.
    if (e.kind === 'warden') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 75, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(88,166,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Herald support enemy (v2.4.0): a soft magenta aura disc shows its haste radius (mirrors the
    // warden disc). Pop the herald and the disc — and the speed boost — vanish. The hasted-enemy
    // orange cue ring below already marks the sped-up allies, so no extra cue is needed here.
    if (e.kind === 'herald') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 90, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,121,198,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Warded cue (v1.35.0): a faint blue ring marks an enemy currently shielded by a warden.
    if (e.warded > 0 && e.kind !== 'warden') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(88,166,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Warlord rally cue (v2.14.0): a faint gold ring marks an enemy currently hardened by a
    // living Warlord boss's global armor rally (matches the boss's gold aura below), so the
    // player can read why the whole wave is suddenly tankier — and that killing the Warlord ends it.
    if (e.rallied > 0 && e.kind !== 'boss') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(240,200,60,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Regeneration wave-mod cue (v1.33.0): a tight green halo marks self-healing enemies.
    if (e.regen) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(86,211,100,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Adrenaline wave-mod cue (v1.58.0): a faint red ring marks a wounded enemy that's
    // currently sped up by the mod — the ring fades in with missing HP so it reads as
    // "this one is now racing the exit". Only shows once it's actually accelerating.
    if (e.adrenaline && e.hp < e.maxHp) {
      const f = Math.min(1, 1 - e.hp / e.maxHp);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(248,81,73,${0.25 + 0.4*f})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // CC-immune cue (Heatwave wave-mod v1.66.0; Molten enemy v1.77.0): a warm orange ring marks
    // any enemy immune to slow/freeze (the whole wave under Heatwave, or an individual 🔥 Molten
    // enemy in any mode) so the player can see why their Frost towers aren't biting.
    if (e.ccImmune && !e.dead) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,138,52,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Cloaking Field wave-mod cue (v1.72.0): a violet ring marks an enemy that periodically
    // phases out (untargetable), flaring brighter while it's actually cloaked — so the player
    // can see why shots are missing. The sphere also fades while cloaked (phantomA below).
    if (e.cloak && !e.dead) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(185,140,255,${e.blinkInvuln > 0 ? 0.85 : 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Fission wave-mod cue (v1.76.0): a dashed spring-green ring marks an enemy that will
    // burst into weak spawnlings on death (matching the children's colour), so the player can
    // read which targets multiply and plan AoE/clear order. Dashed to read distinctly from the
    // solid green regen halo (only one wave-mod is ever active, so they never overlap).
    if (e.fission && !e.dead) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(126,231,135,0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }
    // Bastion cue (v1.90.0): a slate hex ring marks the blast-shell enemy that takes half
    // damage from Cannon/Mortar splash — so the player can read why their explosions barely
    // dent it and switch to single-target fire.
    if (e.aoeResist && !e.dead) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(122,134,200,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Jammer cue (v1.91.0): an electric-yellow ring marks the tower-disabling enemy, so the
    // player can read which target is knocking their towers offline and prioritise/space around it.
    if (e.kind === 'jammer' && !e.dead) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(242,227,74,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // breacher cue (v1.63.0): a dark-red outer ring flags the heavy unit that costs 2 lives
    // if it leaks, so it reads as a priority threat in a crowd (the colour/glyph also code it).
    if (e.lifeCost > 1 && !e.dead) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(212,86,107,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // enrager haste cue (v1.34.0): a faint orange ring marks an enemy currently sped up
    // by a nearby enrager boss (matches the boss's own orange aura below).
    if (e.hasted > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,180,84,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // boss archetype aura (v1.25.0; enrager v1.34.0; teleporter v1.40.0; berserker v1.50.0;
    // disruptor v1.52.0; siphon v1.71.0): colour-codes the mechanic — green regen, red summoner,
    // blue bulwark, orange enrager, violet teleporter, crimson berserker, cyan disruptor,
    // steel juggernaut, gold siphon, bronze fortifier, gold-amber warlord, slate suppressor, teal absorber,
    // fuchsia distorter. The bulwark ring
    // flares bright+thick during its active shield phase, and the berserker ring grows
    // brighter+thicker as it rages (scaling with missing HP), so the damage-soak window / rage
    // level is readable at a glance.
    if (e.kind === 'boss' && e.bossType) {
      const ac = e.bossType === 'regen' ? '86,211,100' : e.bossType === 'summoner' ? '255,148,146' : e.bossType === 'enrager' ? '255,180,84' : e.bossType === 'teleporter' ? '188,140,255' : e.bossType === 'berserker' ? '255,106,106' : e.bossType === 'disruptor' ? '125,249,255' : e.bossType === 'juggernaut' ? '192,200,214' : e.bossType === 'siphon' ? '227,179,65' : e.bossType === 'hydra' ? '154,230,92' : e.bossType === 'revenant' ? '227,79,208' : e.bossType === 'conduit' ? '94,242,200' : e.bossType === 'warper' ? '124,108,255' : e.bossType === 'fortifier' ? '205,127,50' : e.bossType === 'warlord' ? '240,200,60' : e.bossType === 'suppressor' ? '111,143,175' : e.bossType === 'absorber' ? '45,212,191' : e.bossType === 'distorter' ? '232,121,249' : e.bossType === 'custodian' ? '142,199,255' : e.bossType === 'veil' ? '220,210,255' : '121,192,255';
      // Conduit boss (v2.2.0): draw a glowing tether to each nearby escort that's shielding it,
      // so the "clear the adds to break the link" read is visible at a glance (brighter with more
      // links). Recomputes neighbours in render — bounded (one boss), and uses last-frame x/y like
      // the enrager aura. Drawn under the aura ring; freeze drops the guard so the tethers vanish.
      if (e.bossType === 'conduit' && e.conduitGuard > 0) {
        ctx.strokeStyle = `rgba(94,242,200,${0.22 + 0.09 * Math.min(4, e.conduitGuard)})`;
        ctx.lineWidth = 1.5;
        for (const o of enemies) {
          if (o === e || o.dead || o.kind === 'boss') continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) < 130) {
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(o.x, o.y); ctx.stroke();
          }
        }
      }
      const rage = e.bossType === 'berserker' ? Math.max(0, 1 - e.hp / e.maxHp) : 0;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + (e.shieldOn ? 9 : 6) + rage*4, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${ac},${e.shieldOn ? 0.85 : 0.4 + rage*0.45})`;
      ctx.lineWidth = e.shieldOn ? 3.5 : 2 + rage*1.5;
      ctx.stroke();
    }
    // ground shadow
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + e.r * 0.85, e.r * 0.9, e.r * 0.35, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // shaded sphere
    const ecol = e.flash > 0 ? '#ffffff' : (e.frozen > 0 ? '#9be8ff' : e.color);
    // phantoms render translucent, fading almost out while they're mid-blink; a teleporter
    // boss is solid normally but fades while it's intangible mid-jump (v1.40.0) as the cue.
    const phantomA = e.kind === 'phantom' ? (e.blinkInvuln > 0 ? 0.22 : 0.72)
                   : (e.kind === 'boss' && e.bossType === 'teleporter' && e.blinkInvuln > 0) ? 0.3
                   : (e.cloak && e.blinkInvuln > 0) ? 0.25 : 1;
    if (phantomA < 1) ctx.globalAlpha = phantomA;
    const sphereG = ctx.createRadialGradient(e.x - e.r*0.35, e.y - e.r*0.4, e.r*0.15, e.x, e.y, e.r);
    sphereG.addColorStop(0, shade(ecol, 85));
    sphereG.addColorStop(0.6, ecol);
    sphereG.addColorStop(1, shade(ecol, -85));
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
    ctx.fillStyle = sphereG;
    ctx.fill();
    // High-contrast mode (v2.38.0): a bold dual halo (thick black ring + bright white inner
    // ring) makes every enemy pop off the busy/dark board regardless of its hue. Default OFF →
    // the standard faint outline (byte-identical to pre-v2.38.0).
    if (highContrast) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4; ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
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
    const mech = bossMechanicBadge(bossAlive);   // archetype name (null for vanilla bosses)
    const bw = 320, bx = (W-bw)/2, by = 14, bh = mech ? 36 : 24;
    ctx.fillStyle = 'rgba(13,17,23,0.8)';
    ctx.fillRect(bx-6, by-6, bw+12, bh);
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx-6, by-6, bw+12, bh);
    ctx.fillStyle = 'rgba(248,81,73,0.25)';
    ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#f85149';
    ctx.fillRect(bx, by, bw * Math.max(0, bossAlive.hp/bossAlive.maxHp), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`☠ OVERLORD — WAVE ${wave}`, W/2, by + 10);
    if (mech) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = `rgb(${mech.c})`;
      ctx.fillText(mech.label, W/2, by + 26);
    }
    ctx.textAlign = 'left';
  }

  // beams
  for (const b of beams) {
    // Railgun tracers (b.straight) draw a clean thick line with a bright white core;
    // tesla/chain beams jag through a wobbled midpoint for a lightning look.
    if (b.straight) {
      const baseA = Math.min(1, b.life * 7);
      // A charged Laser beam carries an outer `bloom` halo + a wider `glow` that grow with the
      // charge so the spin-up reads at a glance; railgun tracers set neither (b.bloom undefined,
      // b.glow falls back to 14), so they render byte-identically to before.
      if (b.bloom) {
        ctx.globalAlpha = baseA * 0.22;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = (b.w || 3.5) + b.bloom;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = baseA;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w || 3.5;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.glow || 14;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, (b.w || 3.5) * 0.35);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      continue;
    }
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
    const big = p.kind === 'bomb' || p.kind === 'mortar';   // heavy shells draw a chunkier trail/orb
    const lift = lobLift(p);                 // mortar shells arc up then down (render-only)
    const dy0 = p.y - lift;                  // lifted draw position; p.x/p.y stay the ground truth
    const pdx = p.target.x - p.x, pdy = p.target.y - p.y;
    const pdd = Math.hypot(pdx, pdy) || 1;
    const trailLen = big ? 18 : 13;
    const tx = p.x - pdx/pdd * trailLen, ty = (p.y - pdy/pdd * trailLen) - lift;
    // a faint ground shadow under a lofted shell anchors the arc (sells the height)
    if (lift > 0.5) {
      ctx.globalAlpha = Math.max(0, 0.3 - lift * 0.004);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const tg = ctx.createLinearGradient(tx, ty, p.x, dy0);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(1, p.color);
    ctx.strokeStyle = tg;
    ctx.lineWidth = big ? 5 : 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(p.x, dy0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, dy0, big ? 6 : 3.5, 0, Math.PI*2);
    const pg = ctx.createRadialGradient(p.x - 1.5, dy0 - 1.5, 0.5, p.x, dy0, big ? 6 : 3.5);
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

  // expanding shock rings — radius eases out (sqrt) for a fast initial burst, alpha & width
  // fade over the ring's life. Cosmetic; emission is gated by particle-density/reduced-motion.
  for (const rg of rings) {
    const frac = 1 - rg.life / rg.maxLife;          // 0 → 1 over lifetime
    const r = rg.maxR * Math.sqrt(Math.max(0, frac));
    ctx.globalAlpha = Math.max(0, rg.life / rg.maxLife) * 0.7;
    ctx.strokeStyle = rg.color;
    ctx.lineWidth = Math.max(0.5, rg.w * (1 - frac));
    ctx.shadowColor = rg.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.shadowBlur = 0;
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
  if (!waveActive && !gameOver && started && wave >= 0 && wave < victoryWave()
      && !(selectedTower && upPanel.style.display === 'block')) {   // hide while upgrade panel shares the corner (v2.29.0)
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
    // threat gauge — total raw HP of the next wave's base roster, so a boss/tank spike is
    // visible at a glance (plan purchases before it lands). Reddens on every 5th (boss) wave.
    const threat = waveThreat(wave + 1);
    const bossWave = (wave + 1) % 5 === 0;
    ctx.fillStyle = bossWave ? 'rgba(248,81,73,0.95)' : 'rgba(210,168,255,0.9)';
    ctx.font = 'bold 12px sans-serif';
    const threatLabel = '⚔ ' + fmtNum(threat) + ' HP';
    ctx.fillText(threatLabel, px + 4, py);
    px += 4 + ctx.measureText(threatLabel).width;
    // board DPS — your towers' total single-target output, glanceable against the ⚔ threat
    // so you can judge if your defense can handle the next wave (conservative lower bound;
    // AoE/chain/DoT/crits uncounted). v2.29.0.
    if (towers.length) {
      ctx.fillStyle = 'rgba(86,211,100,0.92)';
      ctx.fillText('🗡 ' + fmtNum(boardDps()) + ' DPS', px + 12, py);
    }
    ctx.textBaseline = 'alphabetic';
    if (isMayhem() && !daily && wave > 0 && wave % 5 === 0) {
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
    // escalating tier word above the number (v2.36.0) — empty below the first milestone, then a
    // rising shout (HEATING UP → RAMPAGE → UNSTOPPABLE → GODLIKE) in the streak colour
    const tierWord = comboTierLabel(comboCount);
    if (tierWord) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = cc;
      ctx.shadowColor = cc; ctx.shadowBlur = 8;
      ctx.fillText(tierWord, 0, -22);
      ctx.shadowBlur = 0;
    }
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

  // combo board glow (v1.60.0): at a hot streak the board edges breathe with the
  // combo-tier colour, escalating green→gold→orange→red→purple as the chain grows
  // — pure reward spectacle for aggressive play, layered over the dark vignette.
  // Gated by the ✨ Particle setting + OS reduce-motion (it pulses), so either one
  // silences it, like every other juice effect. Render-only, run-only state.
  const glowTier = comboGlowTier(comboCount);
  if (glowTier && comboTimer > 0 && started && !gameOver && particleDensity > 0 && !reduceMotion()) {
    const cc = comboColor(comboCount);                                   // #RRGGBB
    const breathe = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 260));
    const peak = (0.07 + glowTier * 0.07) * particleDensity * breathe;   // ~0.08→0.31 alpha
    const a2 = Math.round(Math.max(0, Math.min(1, peak)) * 255).toString(16).padStart(2, '0');
    const cg = ctx.createRadialGradient(W/2, H/2, H*0.36, W/2, H/2, W*0.72);
    cg.addColorStop(0, cc + '00');     // transparent centre (#RRGGBB00)
    cg.addColorStop(1, cc + a2);       // tier-bright edge (#RRGGBBAA)
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
  }

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
  pollGamepad(dt);                       // controller input (no-op unless a pad is connected, v1.43.0)
  for (let i = 0; i < speed; i++) update(dt);
  draw();
  requestAnimationFrame(loop);
}
started = false;
document.getElementById('speedBtn').textContent = `⏩ ${speed}x`;  // reflect restored cd_speed pref
{ const ab = document.getElementById('autoBtn');   // reflect restored cd_autowave pref (v2.38.0)
  ab.textContent = `🔁 Auto-wave: ${autoWave ? 'ON' : 'OFF'}`; ab.classList.toggle('off', !autoWave); }
loadMeta();
buildPath();
renderStartScreen();
resetState();
setActiveUI();
initWhatsNew();
requestAnimationFrame(loop);

// PWA service-worker registration (v1.30.0). Only when HOSTED over http/https — guarded
// to skip file:// (service workers can't register there, so double-click play + the
// headless harness are completely unaffected) and any browser without SW support.
// Failures are swallowed: a missing/blocked SW must never break the game.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.protocol === 'http:')) {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
}
