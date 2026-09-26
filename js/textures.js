
function themeWalls(depth){
  for (let y=0;y<MH;y++){
    for (let x=0;x<MW;x++){
      if (!GRID[y*MW+x]) continue;
      let t;
      switch (biome.id){
        case "maze":   t = (x + y + depth) % 3; break;
        case "caves":  t = ((x*7 + y*13 + depth) % 5) < 3 ? 0 : 1 + ((x+y) % 2); break;
        case "arena":  t = (Math.abs(x - MW/2) + Math.abs(y - MH/2)) / 5 % 3 | 0; break;
        case "blocks": t = ((x/6|0) * 2 + (y/6|0) + depth) % 3; break;
        case "rings":  t = (Math.max(Math.abs(x - MW/2), Math.abs(y - MH/2)) / 3 | 0) % 3; break;
        default:       t = ((x/8|0) + (y/8|0) + depth) % 3;
      }
      GRID[y*MW+x] = 1 + t;
    }
  }
  for (let x=0;x<MW;x++){ GRID[x] = 1; GRID[(MH-1)*MW + x] = 1; }
  for (let y=0;y<MH;y++){ GRID[y*MW] = 1; GRID[y*MW + MW-1] = 1; }
}

function composeLight(){
  LMAPR.set(LMAPB);
  for (const L of LAMPS){
    if (L.val <= 0) continue;
    const k = L.I * L.val;
    const cells = L.cells, w = L.w;
    for (let j = 0; j < cells.length; j++){
      const c = cells[j];
      const v = LMAPR[c] + w[j] * k;
      LMAPR[c] = v > 1.4 ? 1.4 : v;
    }
  }
  for (let y = 1; y < MH - 1; y++){
    for (let x = 1; x < MW - 1; x++){
      const i = y*MW + x;
      if (GRID[i]){ LMAP[i] = 0; continue; }
      let sum = LMAPR[i] * 2, n = 2;
      if (!GRID[i-1])  { sum += LMAPR[i-1];  n++; }
      if (!GRID[i+1])  { sum += LMAPR[i+1];  n++; }
      if (!GRID[i-MW]) { sum += LMAPR[i-MW]; n++; }
      if (!GRID[i+MW]) { sum += LMAPR[i+MW]; n++; }
      LMAP[i] = sum / n;
    }
  }
}

function openCells(){
  const open8 = [], open4 = [];
  for (let y = 1; y < MH - 1; y++){
    for (let x = 1; x < MW - 1; x++){
      const i = y*MW + x;
      if (GRID[i]) continue;
      const ortho = GRID[i-1] || GRID[i+1] || GRID[i-MW] || GRID[i+MW];
      if (ortho) continue;
      const diag = GRID[i-MW-1] || GRID[i-MW+1] || GRID[i+MW-1] || GRID[i+MW+1];
      if (diag) open4.push(i); else open8.push(i);
    }
  }
  return [open8, open4];
}

var lampDist = new Int16Array(35 * 35), lampQ = new Int32Array(35 * 35);
function addLamp(x, y, R, I, state, t0){
  const c = y * MW + x;
  if (GRID[c]) return null;
  lampDist.fill(-1);
  let h = 0, tl = 0;
  lampDist[c] = 0; lampQ[tl++] = c;
  const cells = [], w = [];
  while (h < tl){
    const v = lampQ[h++], d = lampDist[v];
    const f = 1 - d / R;
    if (f > 0){ cells.push(v); w.push(Math.pow(f, 1.6)); }
    if (d + 1 > R) continue;
    const vx = v % MW, vy = (v / MW) | 0;
    if (vx > 0    && !GRID[v-1]  && lampDist[v-1]  < 0){ lampDist[v-1]  = d + 1; lampQ[tl++] = v-1; }
    if (vx < MW-1 && !GRID[v+1]  && lampDist[v+1]  < 0){ lampDist[v+1]  = d + 1; lampQ[tl++] = v+1; }
    if (vy > 0    && !GRID[v-MW] && lampDist[v-MW] < 0){ lampDist[v-MW] = d + 1; lampQ[tl++] = v-MW; }
    if (vy < MH-1 && !GRID[v+MW] && lampDist[v+MW] < 0){ lampDist[v+MW] = d + 1; lampQ[tl++] = v+MW; }
  }
  const L = { x, y, c, R, I, state,
    cells: Int32Array.from(cells), w: Float32Array.from(w),
    val: state === "off" ? 0 : 1, t: t0 || 0, blink: 0 };
  LAMPS.push(L);
  return L;
}

function buildLightMap(dep){
  const r = RNG();
  const kind = dep <= 2 ? "normal" : r < .24 ? "dark" : r < .8 ? "normal" : "lit";
  let pOn, pFl;
  if (kind === "dark"){ levelL = .62 + RNG()*.08; pOn = .2; pFl = .28; }
  else if (kind === "lit"){ levelL = .82 + RNG()*.08; pOn = .7; pFl = .17; }
  else { levelL = .74 + RNG()*.1; pOn = .48; pFl = .24; }
  if (biome.id === "boss"){ levelL = .8; pOn = .7; pFl = .3; }
  if (biome.id === "final"){ levelL = .82; pOn = .85; pFl = .15; }
  const amb = .55;
  const N = MW * MH;
  for (let i = 0; i < N; i++) LMAPB[i] = GRID[i] ? 0 : amb;

  let freeCount = 0;
  for (let i = 0; i < N; i++) if (!GRID[i]) freeCount++;
  const want = Math.max(3, Math.round(freeCount / 26));
  const [open8, open4] = openCells();
  LAMPS = [];
  const place = (pool, limit) => {
    for (let t = 0; t < limit * 40 && LAMPS.length < limit && pool.length; t++){
      const c = pool[rnd(pool.length)];
      const x = c % MW, y = (c / MW) | 0;
      let near = false, litNear = 0;
      for (const L of LAMPS){
        const dx = Math.abs(L.x - x), dy = Math.abs(L.y - y), d = Math.hypot(dx, dy);
        if (d < 4.5 || ((dx === 0 || dy === 0) && d < 8)){ near = true; break; }
        if (d < 9 && L.state === "on") litNear++;
      }
      if (near) continue;
      const R = 4.2 + RNG()*2, I = .52 + RNG()*.3;
      const on = pOn * (litNear ? .4 : 1);
      const roll = RNG();
      const state = roll < on ? "on" : roll < on + pFl + (pOn - on) * .6 ? "flicker" : "off";
      addLamp(x, y, R, I, state, RNG()*4);
    }
  };
  place(open8, want);
  if (LAMPS.length < want * .5) place(open4, Math.ceil(want * .6));
  composeLight();
  levelLight = kind;
}

function genBossArena(){
  carveRect(6, 6, MW - 7, MH - 7);
  for (const [x, y] of [[11,11],[22,11],[11,22],[22,22]]){
    setCell(x, y, 1); setCell(x+1, y, 1); setCell(x, y+1, 1); setCell(x+1, y+1, 1);
  }
  return {x: 17.5, y: 26.5};
}
GENERATORS.boss = genBossArena;

function genFinalArena(){
  carveRect(4, 4, MW - 5, MH - 5);
  for (let i = 0; i < 8; i++){
    const a = (i + .5) / 8 * Math.PI * 2;
    const x = Math.round(17 + Math.cos(a) * 8) - 1, y = Math.round(17 + Math.sin(a) * 8) - 1;
    setCell(x, y, 1); setCell(x+1, y, 1); setCell(x, y+1, 1); setCell(x+1, y+1, 1);
  }
  return {x: 17.5, y: 29.5};
}
GENERATORS.final = genFinalArena;

function generateLevel(depth){
  GRID.fill(1);
  rooms = [];
  RNG = mulberry32((runSeed ^ Math.imul(depth + 1, 0x9E3779B1)) >>> 0);
  biome = depth <= 3 ? {id:"small", name:"АУДИТОРИЯ"} : BIOMES[rnd(BIOMES.length)];
  if (depth % 20 === 0) biome = {id:"boss", name:"ЛОГОВО"};
  if (depth === 150) biome = {id:"final", name:"КАБИНЕТ ДИРЕКТОРА"};

  let spawn = GENERATORS[biome.id]();
  connectAll(spawn);
  themeWalls(depth);

  if (cell(spawn.x, spawn.y)){
    search: for (let r=1; r<MW; r++){
      for (let y=(spawn.y|0)-r; y<=(spawn.y|0)+r; y++)
        for (let x=(spawn.x|0)-r; x<=(spawn.x|0)+r; x++)
          if (x>0 && y>0 && x<MW-1 && y<MH-1 && !GRID[y*MW+x]){ spawn = {x:x+.5, y:y+.5}; break search; }
    }
  }
  for (let y=(spawn.y|0)-1; y<=(spawn.y|0)+1; y++)
    for (let x=(spawn.x|0)-1; x<=(spawn.x|0)+1; x++) setCell(x, y, 0);

  buildLightMap(depth);
  RNG = Math.random;
  gridVersion++;
  return {x: spawn.x, y: spawn.y};
}

var WALL = {
  1:["#5c2a10","#3d1b0a"],
  2:["#4a4f3a","#2f3325"],
  3:["#6b2320","#471614"]
};
