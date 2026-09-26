
function hand(g, x, y, w, h){
  g.fillStyle = GLOVE; g.fillRect(x, y, w, h);
  g.fillStyle = GLOVE_L; g.fillRect(x, y, w, 3);
  g.fillStyle = SKIN; g.fillRect(x + 3, y + h - 5, w - 6, 5);
  g.fillStyle = MET_D;
  for (let i=1;i<4;i++) g.fillRect(x + i*(w/4), y + 4, 1, h - 8);
}

function artPistol(k){
  const [c, g] = wpnCanvas();
  const dy = k ? -7 : 0, slide = k === 2 ? 8 : 0;
  g.fillStyle = MET;  g.fillRect(72, 40 + dy + slide, 15, 40 - slide);
  g.fillStyle = MET_L;g.fillRect(72, 40 + dy + slide, 4, 40 - slide);
  g.fillStyle = MET_D;g.fillRect(84, 40 + dy + slide, 3, 40 - slide);
  g.fillStyle = MET;  g.fillRect(68, 74 + dy, 24, 16);
  g.fillStyle = MET_L;g.fillRect(68, 74 + dy, 24, 3);
  if (k === 2){ g.fillStyle = MET_D; g.fillRect(72, 76 + dy, 14, 6); }
  g.fillStyle = MET_D;g.fillRect(66, 88 + dy, 28, 8);
  g.fillStyle = WOOD; g.fillRect(70, 94 + dy, 20, 22);
  g.fillStyle = WOOD_L;g.fillRect(70, 94 + dy, 5, 22);
  hand(g, 62, 100 + dy, 36, 20);
  return c;
}
function flashPistol(){
  const [c, g] = wpnCanvas();
  g.fillStyle = "#ffe9a8"; g.fillRect(72, 24, 15, 18);
  g.fillStyle = "#ffb43c"; g.fillRect(66, 30, 27, 10);
  g.fillStyle = "#ff7a10"; g.fillRect(76, 16, 7, 10);
  return c;
}

function artShotgun(k){
  const [c, g] = wpnCanvas();
  const dy = k === 1 ? -9 : 0;
  const pump = k === 2 ? 14 : k === 3 ? 6 : 0;
  g.fillStyle = MET;  g.fillRect(64, 18 + dy, 18, 62);
  g.fillStyle = MET_L;g.fillRect(64, 18 + dy, 5, 62);
  g.fillStyle = MET_D;g.fillRect(79, 18 + dy, 3, 62);
  g.fillStyle = MET_D;g.fillRect(62, 16 + dy, 22, 4);
  g.fillStyle = WOOD; g.fillRect(58, 62 + dy + pump, 30, 18);
  g.fillStyle = WOOD_L;g.fillRect(58, 62 + dy + pump, 30, 4);
  g.fillStyle = MET;  g.fillRect(60, 84 + dy, 30, 20);
  g.fillStyle = MET_L;g.fillRect(60, 84 + dy, 30, 3);
  if (k === 2){
    g.fillStyle = MET_D; g.fillRect(86, 88 + dy, 10, 8);
    g.fillStyle = BRASS; g.fillRect(98, 80 + dy, 7, 11);
  }
  g.fillStyle = WOOD; g.fillRect(84, 100 + dy, 26, 20);
  hand(g, 52, 70 + dy + pump, 30, 18);
  hand(g, 88, 96 + dy, 30, 22);
  return c;
}
function flashShotgun(){
  const [c, g] = wpnCanvas();
  g.fillStyle = "#fff0bc"; g.fillRect(58, 0, 30, 20);
  g.fillStyle = "#ffb43c"; g.fillRect(46, 4, 54, 14);
  g.fillStyle = "#ff7a10"; g.fillRect(38, 8, 70, 7);
  return c;
}

function artMg(k){
  const [c, g] = wpnCanvas();
  const dy = k === 1 ? -3 : k === 2 ? -6 : 0;
  const belt = k ? (k === 1 ? 3 : 6) : 0;

  g.fillStyle = MET_D; g.fillRect(62, 8 + dy, 36, 9);
  g.fillStyle = MET_L; g.fillRect(62, 8 + dy, 36, 2);
  g.fillStyle = MET_D; g.fillRect(70, 4 + dy, 4, 5);
  g.fillStyle = MET_D; g.fillRect(86, 4 + dy, 4, 5);

  g.fillStyle = MET;   g.fillRect(66, 17 + dy, 28, 54);
  g.fillStyle = MET_L; g.fillRect(66, 17 + dy, 6, 54);
  g.fillStyle = MET_D; g.fillRect(89, 17 + dy, 5, 54);
  g.fillStyle = MET_D;
  for (let y = 23; y < 68; y += 9){
    g.fillRect(74, y + dy, 6, 5);
    g.fillRect(82, y + dy, 5, 5);
  }
  g.fillStyle = MET_L;
  g.fillRect(78, 13 + dy, 4, 6);

  g.fillStyle = MET;   g.fillRect(56, 71 + dy, 48, 28);
  g.fillStyle = MET_L; g.fillRect(56, 71 + dy, 48, 4);
  g.fillStyle = MET_D; g.fillRect(56, 95 + dy, 48, 4);
  g.fillStyle = MET_D; g.fillRect(60, 79 + dy, 12, 3);
  g.fillStyle = MET_D; g.fillRect(60, 86 + dy, 12, 3);

  g.fillStyle = MET_D; g.fillRect(48, 78 + dy, 10, 10);
  if (k === 2){
    g.fillStyle = BRASS; g.fillRect(38, 70 + dy, 6, 9);
    g.fillStyle = "#8a6a1e"; g.fillRect(38, 76 + dy, 6, 3);
  }

  for (let i = 0; i < 7; i++){
    const y = 84 + dy + i*8 - belt;
    if (y < 74 || y > 120) continue;
    g.fillStyle = BRASS;      g.fillRect(104, y, 16, 6);
    g.fillStyle = "#8a6a1e";  g.fillRect(104, y + 4, 16, 2);
    g.fillStyle = MET_D;      g.fillRect(118, y, 3, 6);
  }

  g.fillStyle = MET_D; g.fillRect(72, 99 + dy, 18, 21);
  g.fillStyle = MET;   g.fillRect(74, 99 + dy, 5, 21);

  hand(g, 52, 54 + dy, 26, 20);
  hand(g, 66, 104 + dy, 30, 16);
  return c;
}
function flashMg(){
  const [c, g] = wpnCanvas();
  g.fillStyle = "#fff0bc"; g.fillRect(64, 4, 30, 18);
  g.fillStyle = "#ffb43c"; g.fillRect(54, 8, 50, 11);
  return c;
}

function artLauncher(k){
  const [c, g] = wpnCanvas();
  const dy = k === 1 ? 12 : k === 2 ? 5 : 0;
  g.fillStyle = MET;   g.fillRect(56, 30 + dy, 48, 54);
  g.fillStyle = MET_L; g.fillRect(56, 30 + dy, 8, 54);
  g.fillStyle = MET_D; g.fillRect(96, 30 + dy, 8, 54);
  g.fillStyle = MET_D; g.fillRect(52, 26 + dy, 56, 6);
  g.fillStyle = "#5b4a8c"; g.fillRect(70, 36 + dy, 20, 10);
  g.fillStyle = MET_L; g.fillRect(74, 20 + dy, 4, 8);
  g.fillStyle = MET;   g.fillRect(60, 82 + dy, 40, 18);
  g.fillStyle = WOOD;  g.fillRect(64, 96 + dy, 16, 24);
  hand(g, 44, 88 + dy, 28, 24);
  hand(g, 84, 92 + dy, 28, 24);
  if (k === 2){
    g.fillStyle = "rgba(150,150,150,.5)";
    for (let i=0;i<7;i++) g.fillRect(50 + Math.random()*60, 4 + Math.random()*26, 10, 8);
  }
  return c;
}
function flashLauncher(){
  const [c, g] = wpnCanvas();
  g.fillStyle = "#fff0bc"; g.fillRect(60, 2, 40, 26);
  g.fillStyle = "#ff9020"; g.fillRect(48, 8, 64, 18);
  g.fillStyle = "#c0350a"; g.fillRect(40, 14, 80, 9);
  return c;
}

var WPN = [
  {frames:[artPistol(0), artPistol(1), artPistol(2)], flash:flashPistol(),
   tip:[80, 30], scale:.36, seq:[{f:1,t:.05},{f:2,t:.07},{f:1,t:.05}]},
  {frames:[artShotgun(0), artShotgun(1), artShotgun(2), artShotgun(3)], flash:flashShotgun(),
   tip:[73, 12], scale:.44, seq:[{f:1,t:.12},{f:2,t:.2,snd:"pump"},{f:3,t:.18},{f:0,t:.1}]},
  {frames:[artMg(0), artMg(1), artMg(2)], flash:flashMg(),
   tip:[80, 16], scale:.42, seq:[{f:1,t:.057},{f:2,t:.057}]},
  {frames:[artLauncher(0), artLauncher(1), artLauncher(2)], flash:flashLauncher(),
   tip:[80, 20], scale:.46, seq:[{f:1,t:.16},{f:2,t:.3},{f:0,t:.12}]}
];

var wpnFrame = 0, wpnSeq = null, wpnIdx = 0, wpnT = 0;
var wpnOffset = 0, wpnSwitch = -1;

function equip(n){
  if (n === gun || !unlocked[n] || wpnSwitch !== -1) return;
  wpnSwitch = n;
  wpnSeq = null; wpnFrame = 0;
}

function updateWeapon(dt){
  if (wpnSwitch !== -1){
    wpnOffset += dt*5;
    if (wpnOffset >= 1){
      wpnOffset = 1;
      gun = wpnSwitch; wpnSwitch = -1; wpnFrame = 0;
      updateHUD();
      beep("sine", 700, .05, .07);
    }
  } else if (wpnOffset > 0){
    wpnOffset = Math.max(0, wpnOffset - dt*5);
  }
  if (wpnSeq){
    wpnT -= dt;
    if (wpnT <= 0){
      wpnIdx++;
      if (wpnIdx >= wpnSeq.length){ wpnSeq = null; wpnFrame = 0; }
      else {
        const fr = wpnSeq[wpnIdx];
        wpnFrame = fr.f; wpnT = fr.t;
        if (fr.snd === "pump"){ noiseBurst(.09, .16, 1800, 2); beep("square", 180, .07, .08, 90); }
      }
    }
  }
}

function playFireAnim(){
  const w = WPN[gun];
  wpnSeq = w.seq; wpnIdx = 0;
  wpnFrame = w.seq[0].f; wpnT = w.seq[0].t;
}

var gunCv = document.createElement("canvas");
gunCv.width = SW; gunCv.height = SH;
var gunCtx = gunCv.getContext("2d");

function drawGun(){
  const w = WPN[gun];
  const sh = H*w.scale, sw = sh*SW/SH;
  const amp = sh*.035;
  const bx = Math.cos(bobPhase)*amp*1.4;
  const by = Math.abs(Math.sin(bobPhase))*amp;
  const x = W/2 - sw/2 + bx;
  const y = H - sh*.94 + by + wpnOffset*sh*1.25 + recoil*sh*.05;

  const fr = w.frames[wpnFrame] || w.frames[0];
  const gl = brightMode ? 1 : Math.min(1, .3 + .7 * levelL * playerLight * (lightNow / lightBase) + flash * .6);
  if (gl < .99){
    gunCtx.clearRect(0, 0, SW, SH);
    gunCtx.drawImage(fr, 0, 0);
    gunCtx.globalCompositeOperation = "source-atop";
    gunCtx.fillStyle = FOG_BLACK[((1 - gl) * 255 + .5) | 0];
    gunCtx.fillRect(0, 0, SW, SH);
    gunCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(gunCv, x, y, sw, sh);
  } else {
    ctx.drawImage(fr, x, y, sw, sh);
  }

  if (flash > .05){
    ctx.drawImage(w.flash, x, y, sw, sh);
    const tx = x + w.tip[0]/SW*sw, ty = y + w.tip[1]/SH*sh;
    const r = sh*.28*flash;
    const gr = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
    gr.addColorStop(0, `rgba(255,240,190,${(flash*.55).toFixed(2)})`);
    gr.addColorStop(.5, `rgba(255,150,40,${(flash*.3).toFixed(2)})`);
    gr.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.fill();
  }
  drawCrosshair();
}

var VIGN = null;
function buildVignette(){
  if (!W || !H) return;
  const g = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*.18, W/2, H/2, Math.max(W,H)*.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(.55, "rgba(0,0,0,.42)");
  g.addColorStop(1, "rgba(0,0,0,.92)");
  VIGN = g;
}

var GRAIN = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const img = g.createImageData(128, 128);
  for (let i=0;i<img.data.length;i+=4){
    const v = Math.random()*255|0;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = Math.random()*70|0;
  }
  g.putImageData(img, 0, 0);
  return c;
})();

var xhCv = document.getElementById("xhair");
var xh = xhCv.getContext("2d");
var xhKey = "";
function drawCrosshair(){
  const cssW = cv.clientWidth || 400;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const key = gun + "|" + cssW + "|" + dpr;
  if (key === xhKey) return;
  xhKey = key;
  const S = 160;
  xhCv.width = S * dpr; xhCv.height = S * dpr;
  xh.setTransform(dpr, 0, 0, dpr, 0, 0);
  xh.clearRect(0, 0, S, S);
  const u = 2, arm = 10;
  const spreadPx = Math.tan(GUNS[gun].spread || 0) / .66 * cssW / 2;
  const gap = Math.min(S/2 - arm - 4, Math.max(6, spreadPx));
  const ax = S/2 - u/2, ay = S/2 - u/2;
  const mark = (x, y, w, h) => {
    xh.fillStyle = "rgba(0,0,0,.5)";
    xh.fillRect(x-1, y-1, w+2, h+2);
    xh.fillStyle = "rgba(240,232,208,.9)";
    xh.fillRect(x, y, w, h);
  };
  mark(ax - gap - arm, ay, arm, u);
  mark(ax + u + gap,   ay, arm, u);
  mark(ax, ay - gap - arm, u, arm);
  mark(ax, ay + u + gap,   u, arm);
  xh.fillStyle = "rgba(240,232,208,.55)";
  xh.fillRect(ax, ay, u, u);
}

function drawLastMarkers(horizon){
  if (!playing || enemiesLeft === 0 || enemiesLeft > 3) return;
  const pulse = .45 + .35*Math.sin(clock*7);
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  const planeX = -dirY*.66, planeY = dirX*.66;
  const invDet = 1/(planeX*dirY - dirX*planeY);
  const size = Math.max(6, W/50);
  ctx.fillStyle = `rgba(214,64,44,${pulse.toFixed(2)})`;

  for (const e of enemies){
    if (!e.alive) continue;
    const rx = e.x - P.x, ry = e.y - P.y;
    const tx = invDet*(dirY*rx - dirX*ry), ty = invDet*(-planeY*rx + planeX*ry);
    const screenX = ty > .2 ? (W/2)*(1 + tx/ty) : -1;

    if (ty > .2 && screenX >= 0 && screenX < W){
      const sh = Math.abs(H/ty) * (e.scale || KIND[e.type].scale);
      const top = horizon - sh/2;
      const y = Math.max(4, Math.min(H - size - 2, top - size*1.6));
      ctx.beginPath();
      ctx.moveTo(screenX, y + size); ctx.lineTo(screenX - size, y); ctx.lineTo(screenX + size, y);
      ctx.closePath(); ctx.fill();
    } else {
      const rel = angleDiff(Math.atan2(ry, rx), P.a);
      const left = rel < 0;
      const x = left ? size + 2 : W - size - 2;
      ctx.beginPath();
      ctx.moveTo(left ? x - size : x + size, horizon);
      ctx.lineTo(x, horizon - size); ctx.lineTo(x, horizon + size);
      ctx.closePath(); ctx.fill();
    }
  }
}

var MAP_COLOR = {
  medkit:"#7ba428", armor:"#4f7fa0", bullets:"#c9a227",
  shells:"#c9622a", grenades:"#5b4a8c",
  gun1:"#efe6cc", gun2:"#efe6cc", gun3:"#efe6cc", life:"#ff3a5a"
};

var mapCache = null, mapCacheKey = "", mapSigT = 0, mapSig = 0;

function gridSignature(){
  let h = 0;
  for (let i = 0; i < GRID.length; i++) h = (h * 31 + GRID[i]) | 0;
  return h;
}

function rebuildMapCache(s){
  const w = MW*s + 4, h = MH*s + 4;
  if (!mapCache) mapCache = document.createElement("canvas");
  mapCache.width = w; mapCache.height = h;
  const m = mapCache.getContext("2d");
  m.clearRect(0, 0, w, h);
  m.globalAlpha = 1;
  m.fillStyle = "#0c0709";
  m.fillRect(0, 0, w, h);
  for (let y = 0; y < MH; y++){
    for (let x = 0; x < MW; x++){
      const c = GRID[y*MW + x];
      if (!c) continue;
      m.fillStyle = (WALL[c] || WALL[1])[0];
      m.fillRect(2 + x*s, 2 + y*s, s, s);
    }
  }
  m.globalAlpha = 1;
}

var mmCv = document.getElementById("minimap");
var mm = mmCv.getContext("2d");
var MM_S = 3;
mmCv.width = MW*MM_S + 4; mmCv.height = MH*MM_S + 4;

function drawMinimap(){
  const s = MM_S, ox = 2, oy = 2;
  if (--mapSigT <= 0){ mapSig = gridSignature(); mapSigT = 30; }
  const key = gridVersion + "|" + mapSig + "|" + s;
  if (key !== mapCacheKey){ rebuildMapCache(s); mapCacheKey = key; }
  mm.clearRect(0, 0, mmCv.width, mmCv.height);
  mm.drawImage(mapCache, 0, 0);

  mm.fillStyle = "#c8160e";
  for (const e of enemies){
    if (!e.alive) continue;
    const r = e.boss ? s*2.2 : s;
    mm.fillRect(ox + e.x*s - r/2, oy + e.y*s - r/2, r, r);
  }
  for (const b of shots){
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tx = ox + (b.x - b.vx/sp*.5)*s, ty = oy + (b.y - b.vy/sp*.5)*s;
    mm.fillStyle = "rgba(255,120,40,.45)";
    mm.fillRect(tx - 1, ty - 1, 2, 2);
    mm.fillStyle = "#ffb040";
    mm.fillRect(ox + b.x*s - 1.5, oy + b.y*s - 1.5, 3, 3);
  }
  for (const it of items){
    const ix = ox + it.x*s, iy = oy + it.y*s;
    const special = BUFFS[it.kind] || GUN_OF[it.kind] !== undefined || it.kind === "life";
    mm.fillStyle = BUFFS[it.kind] ? BUFFS[it.kind].color : (MAP_COLOR[it.kind] || "#7ba428");
    if (special){
      const r = s * (1.5 + .5*Math.sin(clock*6));
      mm.save();
      mm.translate(ix, iy); mm.rotate(Math.PI/4);
      mm.fillRect(-r/2, -r/2, r, r);
      mm.restore();
    } else {
      mm.fillRect(ix - s/2, iy - s/2, s*.8, s*.8);
    }
  }
  if (portal){
    const r = s * (1.6 + .6*Math.sin(clock*5));
    mm.fillStyle = "#b070ff";
    mm.beginPath(); mm.arc(ox + portal.x*s, oy + portal.y*s, r, 0, Math.PI*2); mm.fill();
  }
  const px = ox + P.x*s, py = oy + P.y*s, a = P.a;
  mm.fillStyle = "#e8dcc0";
  mm.beginPath();
  mm.moveTo(px + Math.cos(a)*s*2.6, py + Math.sin(a)*s*2.6);
  mm.lineTo(px + Math.cos(a + 2.55)*s*1.5, py + Math.sin(a + 2.55)*s*1.5);
  mm.lineTo(px + Math.cos(a + Math.PI)*s*.6, py + Math.sin(a + Math.PI)*s*.6);
  mm.lineTo(px + Math.cos(a - 2.55)*s*1.5, py + Math.sin(a - 2.55)*s*1.5);
  mm.closePath();
  mm.fill();
}

