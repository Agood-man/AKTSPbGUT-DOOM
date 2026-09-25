
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

function buildLightMap(dep){
  const r = RNG();
  const kind = dep <= 2 ? "normal" : r < .24 ? "dark" : r < .8 ? "normal" : "lit";
  let amb, nl, iMin, iMax;
  if (kind === "dark"){ levelL = .46 + RNG()*.12; amb = .92; nl = 1 + rnd(3); iMin = .3; iMax = .5; }
  else if (kind === "lit"){ levelL = 1.0 + RNG()*.15; amb = .95; nl = 5 + rnd(4); iMin = .3; iMax = .5; }
  else { levelL = .82 + RNG()*.26; amb = .92; nl = 3 + rnd(4); iMin = .28; iMax = .5; }
  if (biome.id === "small") nl = Math.max(1, Math.min(nl, 2));

  const N = MW * MH;
  for (let i = 0; i < N; i++) LMAP[i] = GRID[i] ? 0 : amb;
  const dist = new Int16Array(N), q = new Int32Array(N);
  for (let n = 0; n < nl; n++){
    let c = -1;
    for (let t = 0; t < 300 && c < 0; t++){
      const x = 1 + rnd(MW - 2), y = 1 + rnd(MH - 2);
      if (!GRID[y*MW + x]) c = y*MW + x;
    }
    if (c < 0) continue;
    const R = 3.5 + RNG()*3, I = iMin + RNG()*(iMax - iMin);
    dist.fill(-1);
    let h = 0, tl = 0;
    dist[c] = 0; q[tl++] = c;
    while (h < tl){
      const v = q[h++], d = dist[v];
      const f = 1 - d / R;
      if (f > 0) LMAP[v] = Math.min(1.35, LMAP[v] + I * Math.pow(f, 1.6));
      if (d + 1 > R) continue;
      const x = v % MW, y = (v / MW) | 0;
      if (x > 0     && !GRID[v-1]  && dist[v-1]  < 0){ dist[v-1]  = d + 1; q[tl++] = v-1; }
      if (x < MW-1  && !GRID[v+1]  && dist[v+1]  < 0){ dist[v+1]  = d + 1; q[tl++] = v+1; }
      if (y > 0     && !GRID[v-MW] && dist[v-MW] < 0){ dist[v-MW] = d + 1; q[tl++] = v-MW; }
      if (y < MH-1  && !GRID[v+MW] && dist[v+MW] < 0){ dist[v+MW] = d + 1; q[tl++] = v+MW; }
    }
  }
  const src = LMAP.slice();
  for (let y = 1; y < MH - 1; y++){
    for (let x = 1; x < MW - 1; x++){
      const i = y*MW + x;
      if (GRID[i]) continue;
      let s = src[i] * 2, w = 2;
      if (!GRID[i-1])  { s += src[i-1];  w++; }
      if (!GRID[i+1])  { s += src[i+1];  w++; }
      if (!GRID[i-MW]) { s += src[i-MW]; w++; }
      if (!GRID[i+MW]) { s += src[i+MW]; w++; }
      LMAP[i] = s / w;
    }
  }
  levelLight = kind;
}

function generateLevel(depth){
  GRID.fill(1);
  rooms = [];
  RNG = mulberry32((runSeed ^ Math.imul(depth + 1, 0x9E3779B1)) >>> 0);
  biome = depth <= 3 ? {id:"small", name:"АУДИТОРИЯ"} : BIOMES[rnd(BIOMES.length)];

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
