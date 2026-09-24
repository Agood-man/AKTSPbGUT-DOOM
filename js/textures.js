
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

  RNG = Math.random;
  gridVersion++;
  return {x: spawn.x, y: spawn.y};
}

var WALL = {
  1:["#5c2a10","#3d1b0a"],
  2:["#4a4f3a","#2f3325"],
  3:["#6b2320","#471614"]
};
