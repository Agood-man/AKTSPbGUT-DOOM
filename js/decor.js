var D_WINDOW = 1, D_BOARD = 2, D_DOOR = 3, D_SHELF = 4, D_BARS = 5, D_PIPES = 6, D_POSTER1 = 7, D_POSTER2 = 8,
    D_RADIATOR = 9, D_EXTING = 10, D_BOOTH = 11, D_CABINET = 12, D_POSTER3 = 13;

function decorRand(seed){
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function drawDecor(g, id, base){
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const rnd = decorRand(id * 7919 + base * 104729);
  const txt = (s, x, y, size, col) => { g.fillStyle = col; g.font = `bold ${size}px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, x, y); };
  if (id === D_WINDOW){
    R(10, 8, 44, 40, "#1b1612"); R(12, 10, 40, 36, "#27313a");
    const lg = g.createLinearGradient(12, 10, 52, 46); lg.addColorStop(0, "#5a6c7a"); lg.addColorStop(1, "#1d252c");
    g.fillStyle = lg; g.fillRect(12, 10, 40, 36);
    R(31, 10, 2, 36, "#1b1612"); R(12, 27, 40, 2, "#1b1612");
    for (const [y, tilt] of [[14, 2], [24, -1], [35, 1]]){
      for (let x = 7; x < 57; x++){
        const yy = y + Math.round((x - 32) * tilt / 25);
        R(x, yy, 1, 6, x % 9 === 0 ? "#4e3420" : "#6d4a2a"); R(x, yy, 1, 1, "#8a6238");
      }
      R(9, y + 2, 2, 2, "#b0b0a8"); R(53, y + 2, 2, 2, "#b0b0a8");
    }
    R(12, 21, 40, 1, "#c9dbe6"); R(12, 32, 40, 1, "#aac2d2"); R(12, 43, 40, 1, "#8fa8b8");
    R(8, 48, 48, 4, "#3a2b1e");
  } else if (id === D_BOARD){
    R(4, 10, 56, 36, "#5a3a1e"); R(6, 12, 52, 32, "#1f3a2a");
    const col = "rgba(230,235,225,.85)";
    txt("2+2=5", 22, 20, 8, col); txt("∫dx", 46, 20, 8, col);
    R(10, 30, 18, 1, col); R(12, 34, 12, 1, col); R(34, 30, 18, 1, col); R(38, 36, 8, 1, col);
    R(6, 46, 52, 3, "#4a2e16"); R(14, 45, 4, 2, "#f2f2ea"); R(22, 45, 3, 2, "#e8c0c0");
  } else if (id === D_DOOR){
    R(12, 2, 40, 62, "#3a2414"); R(14, 4, 36, 60, "#6a4428");
    R(18, 8, 28, 22, "#5a3a22"); R(18, 36, 28, 24, "#5a3a22");
    R(19, 9, 26, 1, "#7a5232"); R(19, 37, 26, 1, "#7a5232");
    R(42, 33, 5, 3, "#c8b060"); R(26, 15, 12, 7, "#e8e0c8");
    txt(String(10 + (rnd() * 89 | 0)), 32, 19, 7, "#222");
  } else if (id === D_SHELF){
    R(0, 0, 64, 64, "#2a1a0e");
    const cols = ["#7a1f1a", "#1f3a6a", "#2f5a2a", "#8a6a1a", "#4a2a5a", "#6a4a2a", "#1a4a4a", "#8a3a2a"];
    for (let row = 0; row < 4; row++){
      const y0 = 3 + row * 15;
      R(0, y0 + 12, 64, 3, "#4a2e16");
      let x = 2;
      while (x < 62){
        const w = 2 + (rnd() * 3 | 0), h = 7 + (rnd() * 5 | 0);
        R(x, y0 + 12 - h, w, h, cols[rnd() * cols.length | 0]);
        if (rnd() < .5) R(x, y0 + 12 - h + 2, w, 1, "rgba(255,230,160,.35)");
        x += w + (rnd() < .15 ? 2 : 0);
      }
    }
    R(0, 0, 2, 64, "#4a2e16"); R(62, 0, 2, 64, "#4a2e16");
  } else if (id === D_BARS){
    for (const x of [8, 22, 36, 50]) R(x, 0, 5, 64, "#8a6a42");
    for (let y = 4; y < 64; y += 7){ R(8, y, 47, 2, "#a8845a"); R(8, y + 2, 47, 1, "#5a4228"); }
  } else if (id === D_PIPES){
    for (const [y, h] of [[10, 8], [30, 6], [46, 10]]){
      R(0, y, 64, h, "#555a60"); R(0, y, 64, 2, "#7d848c"); R(0, y + h - 2, 64, 2, "#33373c");
      for (let x = 6; x < 64; x += 20){ R(x, y - 2, 4, h + 4, "#3a3e44"); }
      for (let k = 0; k < 4; k++) R(rnd() * 60 | 0, y + 2 + (rnd() * (h - 3) | 0), 3 + (rnd() * 5 | 0), 2, "#7a3a1a");
    }
    for (let k = 0; k < 10; k++) R(rnd() * 62 | 0, rnd() * 62 | 0, 2, 3, "rgba(120,60,20,.5)");
  } else if (id === D_POSTER1 || id === D_POSTER2 || id === D_POSTER3){
    R(15, 8, 34, 42, "#1a1410"); R(16, 9, 32, 40, "#e8e0c8");
    if (id === D_POSTER1){
      g.strokeStyle = "#b0201c"; g.lineWidth = 3; g.beginPath(); g.arc(32, 24, 10, 0, Math.PI*2); g.stroke();
      R(24, 23, 14, 3, "#f2f2ea"); R(38, 23, 3, 3, "#d2601c");
      g.beginPath(); g.moveTo(25, 17); g.lineTo(39, 31); g.stroke();
      txt("НЕ", 32, 39, 7, "#b0201c"); txt("КУРИТЬ", 32, 45, 7, "#b0201c");
    } else if (id === D_POSTER2){
      txt("СЕССИЯ", 32, 14, 7, "#1a1a3a");
      for (let r = 0; r < 5; r++){ R(19, 19 + r*5, 26, 1, "#6a6a7a"); R(19, 21 + r*5, 8 + (rnd()*14|0), 2, "#3a3a5a"); }
      R(31, 19, 1, 25, "#6a6a7a");
    } else {
      txt("ПРОПУСК", 32, 18, 6, "#1a3a1a"); txt("ПРЕДЪЯВЛЯТЬ", 32, 26, 5, "#1a3a1a");
      R(22, 32, 20, 12, "#c8d8c0"); R(24, 34, 7, 8, "#8a9a88"); R(33, 35, 7, 1, "#4a5a48"); R(33, 38, 6, 1, "#4a5a48");
    }
    R(17, 10, 2, 2, "#8a8a80"); R(45, 10, 2, 2, "#8a8a80");
  } else if (id === D_RADIATOR){
    R(8, 38, 48, 20, "#8c867a");
    for (let x = 10; x < 55; x += 5){ R(x, 38, 3, 20, "#bcb4a2"); R(x + 3, 38, 1, 20, "#6a6456"); }
    R(8, 36, 48, 3, "#a8a090"); R(4, 50, 5, 3, "#6a6456"); R(55, 50, 5, 3, "#6a6456");
  } else if (id === D_EXTING){
    R(20, 12, 24, 44, "#5a1612"); R(22, 14, 20, 40, "#2a1a14");
    R(26, 20, 12, 30, "#b0201c"); R(26, 20, 3, 30, "#d0402c"); R(29, 15, 6, 5, "#2a2a2a"); R(35, 16, 5, 2, "#2a2a2a");
    R(28, 30, 8, 7, "#f2ece0"); txt("ОУ", 32, 34, 5, "#b0201c");
  } else if (id === D_BOOTH){
    R(6, 12, 52, 30, "#1a1612"); R(8, 14, 48, 26, "#3a4c56");
    const lg = g.createLinearGradient(8, 14, 56, 40); lg.addColorStop(0, "rgba(200,225,235,.5)"); lg.addColorStop(.5, "rgba(80,110,125,.2)"); lg.addColorStop(1, "rgba(200,225,235,.35)");
    g.fillStyle = lg; g.fillRect(8, 14, 48, 26);
    R(30, 22, 8, 10, "#2a2a2a"); R(28, 32, 12, 8, "#3a2a44");
    R(6, 42, 52, 4, "#5a4a3a"); txt("ВАХТА", 32, 52, 7, "#e8e0c8");
  } else if (id === D_CABINET){
    R(4, 4, 56, 56, "#3a2a1a"); R(7, 7, 23, 50, "#54646c"); R(34, 7, 23, 50, "#54646c");
    R(7, 28, 50, 2, "#3a2a1a"); R(7, 45, 50, 2, "#3a2a1a");
    const fl = ["#3aa84a", "#c8a020", "#a83a8a", "#3a8ac8", "#c83a2a"];
    for (const y of [20, 38, 54]) for (let x = 10; x < 56; x += 6){
      if (rnd() < .25) continue;
      const c = fl[rnd() * fl.length | 0], h = 4 + (rnd() * 5 | 0);
      R(x, y - h, 4, h, c); R(x + 1, y - h - 2, 2, 2, "#cfd8dc");
    }
    R(7, 7, 50, 2, "rgba(255,255,255,.2)");
  }
}

function decorEnc(base, id){ return 100 + (base - 1) * 20 + id; }
function decorBase(v){ return v >= 100 ? (((v - 100) / 20) | 0) + 1 : v; }
function decorId(v){ return v >= 100 ? (v - 100) % 20 : 0; }
function makeDecorTex(hit){
  if (hit < 100) return null;
  const base = decorBase(hit), id = decorId(hit);
  const src = (TEX[base] || TEX[1])[0];
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  drawDecor(g, id, base);
  TEX[hit] = [c, darken(c, .34)];
  return TEX[hit];
}

var DECOR_PLAN = {
  small:{p:.05}, rooms:{p:.035}, maze:{p:.014}, caves:{p:0}, arena:{p:.03}, blocks:{p:.026}, rings:{p:.019},
  dorm:{p:.04}, gym:{p:.035}, canteen:{p:.035}, library:{p:.03}, heat:{p:.012}, boss:{p:.03}, final:{p:0}
};

var decorWindows = [], decorVents = [];
var STEAM_IMG = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  rg.addColorStop(0, "rgba(232,236,240,.85)"); rg.addColorStop(.5, "rgba(214,220,226,.45)"); rg.addColorStop(1, "rgba(200,206,214,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return c;
})();

function faceDir(x, y){
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs){
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
    if (!GRID[ny*MW + nx]) return [dx, dy];
  }
  return null;
}
function isExternal(x, y, dx, dy){
  let cx = x - dx, cy = y - dy;
  while (cx >= 0 && cy >= 0 && cx < MW && cy < MH){
    if (!GRID[cy*MW + cx]) return false;
    cx -= dx; cy -= dy;
  }
  return true;
}

function placeDecor(){
  decorWindows = []; decorVents = []; arenaMarks = [];
  const plan = DECOR_PLAN[biome.id] || DECOR_PLAN.rooms;
  const taken = [];
  const near = (x, y, r) => taken.some(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y) < r);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++){
    const i = y*MW + x, v = GRID[i];
    if (!v || v >= 100) continue;
    const f = faceDir(x, y);
    if (!f) continue;
    if (biome.id === "heat" && decorVents.length < 5 && RNG() < .025)
      decorVents.push({x:x + .5 + f[0]*.52, y:y + .5 + f[1]*.52, dx:f[0], dy:f[1], t:2 + RNG()*6, on:0});
    if (plan.p && RNG() < plan.p && !near(x, y, 6)){
      GRID[i] = decorEnc(v, D_POSTER1); taken.push([x, y]);
    }
  }
}

function decorLights(){
  let n = 0;
  for (const w of decorWindows){
    if (n >= 8) break;
    const L = addLamp(w.x, w.y, 2.6, .3, "on", 0);
    if (L){ L.noSprite = true; n++; }
  }
  if (n) composeLight();
}

function bossArenaKind(depth){
  const T = bossTypeFor(depth);
  return T ? T.id : "tank";
}
var arenaMarks = [], arenaDecor = [], genDepth = 1;
function genBossArenaThemed(){
  const kind = bossArenaKind(genDepth);
  arenaMarks = []; arenaDecor = [];
  carveRect(6, 6, MW - 7, MH - 7);
  const block = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setCell(x, y, 1);
  };
  const mark = () => {};
  if (kind === "tank"){
    for (const y of [14, 21]) for (let x = 7; x <= 27; x += 3) if (x < 15 || x > 19) block(x, y, x, y);
    block(16, 16, 18, 18, D_BOOTH);
    arenaDecor = [[D_POSTER3, 3], [D_POSTER1, 1]];
  } else if (kind === "summoner"){
    for (const y of [12, 17, 22]) for (const x of [9, 14, 19, 24]) block(x, y, x + 1, y);
    for (const x of [8, 9, 10, 24, 25, 26]) block(x, 6, x, 6, D_CABINET);
    for (const y of [16, 17, 18]){ setCell(5, y, 0); setCell(29, y, 0); mark(4, y, D_DOOR); mark(30, y, D_DOOR); }
    for (const x of [16, 17, 18]) mark(x, 5, D_BOARD);
    arenaDecor = [[D_POSTER2, 2], [D_RADIATOR, 1]];
  } else if (kind === "caster"){
    for (const x of [10, 14, 20, 24]){ block(x, 10, x, 14, D_CABINET); block(x, 20, x, 24, D_CABINET); }
    for (const x of [15, 16, 17, 18, 19]) mark(x, 5, D_CABINET);
    arenaDecor = [[D_EXTING, 2], [D_POSTER1, 1]];
  } else {
    block(9, 12, 10, 13); block(24, 12, 25, 13); block(9, 21, 10, 22); block(24, 21, 25, 22);
    block(17, 7, 17, 7); block(17, 27, 17, 27);
    for (let y = 8; y <= 26; y++) if (y % 2){ mark(5, y, D_BARS); mark(29, y, D_BARS); }
    arenaDecor = [[D_POSTER2, 1], [D_RADIATOR, 1]];
  }
  return {x: 17.5, y: 26.5};
}

function applyArenaMarks(){
  for (const [x, y, id] of arenaMarks){
    const i = y*MW + x, v = GRID[i];
    if (v && v < 100) GRID[i] = decorEnc(v, id);
  }
}

var fxDripT = 0, fxAmbT = 8, fxDustT = 0, fxWalk = 0, fxLastX = 0, fxLastY = 0;
function fxReset(){ fxDripT = 1; fxAmbT = 6 + Math.random()*8; fxDustT = 0; fxWalk = 0; fxLastX = P.x; fxLastY = P.y; }

function fxSparks(x, y){
  const dx = x - P.x, dy = y - P.y;
  if (dx*dx + dy*dy > 144) return;
  for (let i = 0; i < 9; i++){
    const a = Math.random()*6.283, s = .3 + Math.random()*.9;
    parts.push({x, y, h:-.38, vx:Math.cos(a)*s, vy:Math.sin(a)*s, vh:-.3 + Math.random()*.4, g:3.2, t:0, life:.3 + Math.random()*.35, sz:.035, a:1, col:4});
  }
}

function fxTick(dt){
  if (!playing) return;
  const id = biome ? biome.id : "";
  const moved = Math.hypot(P.x - fxLastX, P.y - fxLastY);
  fxLastX = P.x; fxLastY = P.y;
  for (const v of decorVents){
    const dx = v.x - P.x, dy = v.y - P.y;
    if (dx*dx + dy*dy > 196) continue;
    if (v.on > 0){
      v.on -= dt;
      const rate = dt*26, n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      for (let i = 0; i < n; i++){
        const s = 1.2 + Math.random()*1, j = (Math.random() - .5)*.5;
        parts.push({x:v.x - v.dy*j*.3, y:v.y + v.dx*j*.3, h:-.05 + (Math.random() - .5)*.15,
          vx:v.dx*s - v.dy*j, vy:v.dy*s + v.dx*j, vh:-.22 - Math.random()*.15, drag:1.3, t:0,
          life:1.1 + Math.random()*.6, sz:.2, grow:2.4, a:.42, steam:true});
      }
      if (v.on <= 0) v.t = 4 + Math.random()*6;
    } else {
      v.t -= dt;
      if (v.t <= 0){
        v.on = 1.4 + Math.random()*.6;
        const a = atPos(v.x, v.y);
        noiseBurst(v.on, .14*a.vol, 7000, .6, a.sp);
      }
    }
  }
  if (id === "heat" || id === "caves"){
    fxDripT -= dt;
    if (fxDripT <= 0){
      fxDripT = .5 + Math.random()*.9;
      for (let t = 0; t < 8; t++){
        const x = P.x + (Math.random()*2 - 1)*5, y = P.y + (Math.random()*2 - 1)*5;
        if (solid(x, y, .1)) continue;
        parts.push({x, y, h:-.5, vx:0, vy:0, vh:.2, g:3.6, t:0, life:.72, sz:.03, a:.9, col:9, drip:true});
        break;
      }
    }
  }
  if (id === "library" || id === "dorm" || id === "small" || id === "gym"){
    fxDustT -= dt;
    if (fxDustT <= 0){
      fxDustT = .12;
      let best = null, bd = 49;
      for (const L of LAMPS){
        if (L.noSprite || L.val < .5) continue;
        const d = (L.x + .5 - P.x)**2 + (L.y + .5 - P.y)**2;
        if (d < bd && Math.random() < .5){ bd = d; best = L; }
      }
      if (best){
        const a = Math.random()*6.283, r = Math.random()*1.2;
        parts.push({x:best.x + .5 + Math.cos(a)*r, y:best.y + .5 + Math.sin(a)*r, h:-.4 + Math.random()*.7,
          vx:(Math.random() - .5)*.08, vy:(Math.random() - .5)*.08, vh:(Math.random() - .5)*.05, t:0,
          life:3 + Math.random()*2, sz:.022, a:.55, col:5});
      }
    }
  }
  if (id === "library" && moved > 0 && moved < 1){
    fxWalk += moved;
    if (fxWalk > 2.2){ fxWalk = 0; if (Math.random() < .4){ beep("sawtooth", 170 + Math.random()*60, .2, .025, 130); noiseBurst(.14, .02, 900, 1); } }
  }
  fxAmbT -= dt;
  if (fxAmbT <= 0){
    fxAmbT = 10 + Math.random()*14;
    const far = () => { for (let t = 0; t < 20; t++){ const a = Math.random()*6.283, r = 6 + Math.random()*5; const x = P.x + Math.cos(a)*r, y = P.y + Math.sin(a)*r; if (x > 1 && y > 1 && x < MW - 1 && y < MH - 1 && !solid(x, y, .1)) return atPos(x, y); } return null; };
    const a = far();
    if (a){
      if (id === "dorm"){ noiseBurst(.25, .3*a.vol, 420, 1, a.sp); beep("sine", 70, .22, .16*a.vol, 40, a.sp); }
      else if (id === "heat"){ beep("square", 160, .12, .07*a.vol, 120, a.sp); setTimeout(() => beep("square", 240, .1, .05*a.vol, 180, a.sp), 90); }
      else if (id === "gym"){ beep("sine", 95, .12, .14*a.vol, 60, a.sp); setTimeout(() => beep("sine", 95, .1, .1*a.vol, 60, a.sp), 380); }
      else if (id === "library"){ noiseBurst(.18, .05*a.vol, 1400, 1, a.sp); }
    }
  }
}

function fxDripSplash(p){
  for (let i = 0; i < 3; i++){
    const a = Math.random()*6.283;
    parts.push({x:p.x, y:p.y, h:.48, vx:Math.cos(a)*.5, vy:Math.sin(a)*.5, vh:-.5, g:3, t:0, life:.22, sz:.02, a:.8, col:9});
  }
  const dx = p.x - P.x, dy = p.y - P.y;
  if (dx*dx + dy*dy < 36 && Math.random() < .7){
    const a = atPos(p.x, p.y);
    beep("sine", 1300 + Math.random()*500, .07, .05*a.vol, 700, a.sp);
  }
}
GENERATORS.boss = genBossArenaThemed;
