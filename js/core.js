"use strict";

var MW = 35, MH = 35;
var SET_KEY = "terplandia3d.settings";
var CTRL_KEYS = ["stick", "fire", "swap", "pausebtn", "minimap", "invbar"];
function defaultCtrl(){
  const c = {};
  for (const k of CTRL_KEYS) c[k] = { size:1, alpha: k === "minimap" ? .62 : 1 };
  return c;
}
var LMAP = new Float32Array(35 * 35);
var LMAPB = new Float32Array(35 * 35);
var LMAPR = new Float32Array(35 * 35);
var LAMPS = [];
var levelLight = "normal";
var levelL = .9;
var playerLight = 1;
var SET_DEFAULT = { sensMouse:1, sensTouch:1, gamma:1, volume:1, quality:1, pos:{} };
var SET = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch(e){}
  const out = Object.assign({}, SET_DEFAULT, s);
  out.pos = Object.assign({}, (s && s.pos) || {});
  out.ctrl = defaultCtrl();
  for (const k of CTRL_KEYS){
    const src = s && s.ctrl && s.ctrl[k];
    if (src) Object.assign(out.ctrl[k], src);
    else if (s && k !== "pausebtn" && k !== "minimap"){
      if (s.ctrlSize) out.ctrl[k].size = s.ctrlSize;
      if (s.ctrlAlpha) out.ctrl[k].alpha = s.ctrlAlpha;
    }
  }
  if (!(out.gamma >= .8 && out.gamma <= 1.5)) out.gamma = 1;
  delete out.bright; delete out.ctrlSize; delete out.ctrlAlpha;
  return out;
})();
function saveSettings(){ try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch(e){} }
var gridVersion = 0;
var GRID = new Uint8Array(MW*MH);
var rooms = [];

var cell = (x,y) => (x<0||y<0||x>=MW||y>=MH) ? 1 : GRID[(y|0)*MW + (x|0)];
var setCell = (x,y,v) => { if (x>0&&y>0&&x<MW-1&&y<MH-1) GRID[y*MW+x] = v; };
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var runSeed = (Math.random()*0xFFFFFFFF) >>> 0;
var RNG = Math.random;
var rnd = n => Math.floor(RNG()*n);
var seedText = () => runSeed.toString(16).toUpperCase().padStart(8, "0");
var seedName = "";
var seedShow = () => seedName ? `${seedName} (${seedText()})` : seedText();

function parseSeed(str){
  const t = String(str || "").trim().replace(/^#/, "");
  if (!t) return null;
  if (/^[0-9a-fA-F]{1,8}$/.test(t)) return parseInt(t, 16) >>> 0;
  const u = t.toUpperCase();
  let h = 0x811c9dc5;
  for (let i=0;i<u.length;i++){ h ^= u.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
var roomCenter = r => ({x: r.x + r.w/2, y: r.y + r.h/2});

function overlaps(a, b){
  return a.x < b.x + b.w + 2 && a.x + a.w + 2 > b.x &&
         a.y < b.y + b.h + 2 && a.y + a.h + 2 > b.y;
}

function carveRect(x0, y0, x1, y1){
  for (let y=Math.min(y0,y1); y<=Math.max(y0,y1); y++)
    for (let x=Math.min(x0,x1); x<=Math.max(x0,x1); x++)
      setCell(x, y, 0);
}

function carveHall(a, b){
  const ax = a.x|0, ay = a.y|0, bx = b.x|0, by = b.y|0;
  const wide = RNG() < .35 ? 1 : 0;
  if (RNG() < .5){
    carveRect(ax, ay, bx, ay + wide);
    carveRect(bx, ay, bx + wide, by);
  } else {
    carveRect(ax, ay, ax + wide, by);
    carveRect(ax, by, bx, by + wide);
  }
}

var BIOMES = [
  {id:"rooms",  name:"КАЗЕМАТЫ"},
  {id:"maze",   name:"ЛАБИРИНТ"},
  {id:"caves",  name:"ПЕЩЕРЫ"},
  {id:"arena",  name:"АРЕНА"},
  {id:"blocks", name:"БЛОКИ"},
  {id:"rings",  name:"КОЛЬЦА"}
];
var biome = BIOMES[0];

function genRooms(){
  const target = 9 + Math.min(6, level);
  for (let a=0; a<400 && rooms.length < target; a++){
    const w = 4 + rnd(7), h = 4 + rnd(7);
    const r = {x: 1 + rnd(MW - w - 2), y: 1 + rnd(MH - h - 2), w, h};
    if (rooms.some(o => overlaps(r, o))) continue;
    rooms.push(r);
  }
  for (const r of rooms) carveRect(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
  for (let i=1;i<rooms.length;i++) carveHall(roomCenter(rooms[i-1]), roomCenter(rooms[i]));
  for (let i=0;i<3 && rooms.length > 3;i++){
    const a = rooms[rnd(rooms.length)], b = rooms[rnd(rooms.length)];
    if (a !== b) carveHall(roomCenter(a), roomCenter(b));
  }
  for (const r of rooms){
    if (r.w < 6 || r.h < 6 || RNG() < .45) continue;
    const n = 1 + rnd(3);
    for (let i=0;i<n;i++){
      const px = r.x + 1 + rnd(r.w - 2), py = r.y + 1 + rnd(r.h - 2);
      setCell(px, py, 1); if (RNG() < .4) setCell(px+1, py, 1);
    }
  }
  return roomCenter(rooms[0]);
}

function genMaze(){
  const stack = [], sx = 1, sy = 1;
  setCell(sx, sy, 0); stack.push([sx, sy]);
  const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
  while (stack.length){
    const [x, y] = stack[stack.length-1];
    const opts = [];
    for (const [dx, dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if (nx>0 && ny>0 && nx<MW-1 && ny<MH-1 && GRID[ny*MW+nx]) opts.push([nx, ny, x+dx/2, y+dy/2]);
    }
    if (!opts.length){ stack.pop(); continue; }
    const [nx, ny, mx, my] = opts[rnd(opts.length)];
    setCell(mx, my, 0); setCell(nx, ny, 0);
    stack.push([nx, ny]);
  }
  for (let i=0;i<70;i++) setCell(1 + rnd(MW-2), 1 + rnd(MH-2), 0);
  for (let i=0;i<3;i++){
    const w = 5 + rnd(4), h = 5 + rnd(4);
    const x = 1 + rnd(MW-w-2), y = 1 + rnd(MH-h-2);
    carveRect(x, y, x+w-1, y+h-1);
    rooms.push({x, y, w, h});
  }
  return {x: sx + .5, y: sy + .5};
}

function genCaves(){
  for (let y=1;y<MH-1;y++)
    for (let x=1;x<MW-1;x++)
      GRID[y*MW+x] = RNG() < .45 ? 1 : 0;
  for (let pass=0; pass<4; pass++){
    const copy = GRID.slice();
    for (let y=1;y<MH-1;y++){
      for (let x=1;x<MW-1;x++){
        let n = 0;
        for (let j=-1;j<=1;j++)
          for (let i=-1;i<=1;i++)
            if ((i||j) && copy[(y+j)*MW + x+i]) n++;
        GRID[y*MW+x] = n > 4 ? 1 : (n < 4 ? 0 : copy[y*MW+x]);
      }
    }
  }
  for (let i=0;i<2;i++){
    const w = 6 + rnd(4), h = 6 + rnd(4);
    const x = 2 + rnd(MW-w-4), y = 2 + rnd(MH-h-4);
    carveRect(x, y, x+w-1, y+h-1);
    rooms.push({x, y, w, h});
  }
  return roomCenter(rooms[0]);
}

function genArena(){
  const m = 5 + rnd(3);
  carveRect(m, m, MW-1-m, MH-1-m);
  rooms.push({x:m, y:m, w:MW-2*m, h:MH-2*m});
  for (let y=m+2; y<MH-m-2; y+=3){
    for (let x=m+2; x<MW-m-2; x+=3){
      if (RNG() < .28) continue;
      setCell(x, y, 1);
      if (RNG() < .35) setCell(x+1, y, 1);
    }
  }
  carveRect(2, 2, MW-3, 3); carveRect(2, MH-4, MW-3, MH-3);
  carveRect(2, 2, 3, MH-3); carveRect(MW-4, 2, MW-3, MH-3);
  for (let i=0;i<6;i++){
    const x = 4 + rnd(MW-8);
    carveRect(x, 3, x, m);
    carveRect(x, MH-1-m, x, MH-4);
  }
  return {x: MW/2, y: MH/2};
}

function genBlocks(){
  const step = 6;
  for (let y=1; y<MH-1; y+=step)  carveRect(1, y, MW-2, y+1);
  for (let x=1; x<MW-1; x+=step)  carveRect(x, 1, x+1, MH-2);
  for (let cy=2; cy<MH-3; cy+=step){
    for (let cx=2; cx<MW-3; cx+=step){
      if (RNG() < .25) continue;
      const w = Math.min(step-2, MW-2-cx), h = Math.min(step-2, MH-2-cy);
      if (w < 2 || h < 2) continue;
      carveRect(cx, cy, cx+w-1, cy+h-1);
      rooms.push({x:cx, y:cy, w, h});
      if (RNG() < .3) setCell(cx + rnd(w), cy + rnd(h), 1);
    }
  }
  return rooms.length ? roomCenter(rooms[rnd(rooms.length)]) : {x:2.5, y:2.5};
}

function genRings(){
  const c = (MW-1)/2;
  for (let r=3; r<c; r+=3){
    const x0 = Math.round(c-r), y0 = Math.round(c-r), x1 = Math.round(c+r), y1 = Math.round(c+r);
    carveRect(x0, y0, x1, y0); carveRect(x0, y1, x1, y1);
    carveRect(x0, y0, x0, y1); carveRect(x1, y0, x1, y1);
    for (let i=0;i<2+rnd(2);i++){
      const side = rnd(4);
      const px = side === 0 ? x0 + 1 + rnd(x1-x0-1) : (side === 1 ? x0 : (side === 2 ? x1 : x0 + 1 + rnd(x1-x0-1)));
      const py = side === 0 ? y0 : (side === 1 ? y0 + 1 + rnd(y1-y0-1) : (side === 2 ? y0 + 1 + rnd(y1-y0-1) : y1));
      carveRect(px-1, py-1, px+1, py+1);
    }
  }
  carveRect(Math.round(c)-2, Math.round(c)-2, Math.round(c)+2, Math.round(c)+2);
  rooms.push({x:Math.round(c)-2, y:Math.round(c)-2, w:5, h:5});
  return {x: c + .5, y: c + .5};
}

function genSmall(){
  const w = 11 + rnd(5), h = 11 + rnd(5);
  const x0 = 1 + rnd(MW - w - 2), y0 = 1 + rnd(MH - h - 2);
  carveRect(x0, y0, x0 + w - 1, y0 + h - 1);
  rooms.push({x:x0, y:y0, w, h});
  for (let y = y0 + 2; y < y0 + h - 2; y += 3)
    for (let x = x0 + 1; x < x0 + w - 1; x += 2)
      if (RNG() < .55) setCell(x, y, 1);
  for (let i=0;i<2;i++){
    const nw = 3 + rnd(3), nh = 3 + rnd(3);
    const nx = x0 + rnd(Math.max(1, w - nw)), ny = RNG() < .5 ? y0 - nh : y0 + h;
    carveRect(nx, Math.max(1, ny), nx + nw - 1, Math.min(MH-2, ny + nh - 1));
    carveRect(nx, y0, nx, y0 + h - 1);
  }
  return roomCenter(rooms[0]);
}

var GENERATORS = {small:genSmall, rooms:genRooms, maze:genMaze, caves:genCaves,
                    arena:genArena, blocks:genBlocks, rings:genRings};

var REG = new Int32Array(MW*MH);
function connectAll(spawn){
  const label = () => {
    REG.fill(-1);
    const parts = [];
    for (let i=0;i<MW*MH;i++){
      if (GRID[i] || REG[i] !== -1) continue;
      const id = parts.length, q = [i], cells = [];
      REG[i] = id;
      while (q.length){
        const c = q.pop(); cells.push(c);
        const x = c % MW, y = (c/MW)|0;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx = x+dx, ny = y+dy;
          if (nx<0||ny<0||nx>=MW||ny>=MH) continue;
          const ni = ny*MW+nx;
          if (GRID[ni] || REG[ni] !== -1) continue;
          REG[ni] = id; q.push(ni);
        }
      }
      parts.push(cells);
    }
    return parts;
  };

  let parts = label();
  if (!parts.length) return;
  const si = ((spawn.y|0)*MW + (spawn.x|0));
  let main = REG[si] >= 0 ? REG[si] : 0;
  if (REG[si] < 0) parts.forEach((c,i) => { if (c.length > parts[main].length) main = i; });

  const mid = c => ({x: (c[c.length>>1] % MW) + .5, y: ((c[c.length>>1]/MW)|0) + .5});
  for (let i=0;i<parts.length;i++){
    if (i === main || !parts[i].length) continue;
    carveHall(mid(parts[i]), mid(parts[main]));
  }

  parts = label();
  const si2 = ((spawn.y|0)*MW + (spawn.x|0));
  const keep = REG[si2] >= 0 ? REG[si2]
             : parts.reduce((b,c,i,a) => c.length > a[b].length ? i : b, 0);
  for (let i=0;i<parts.length;i++){
    if (i === keep) continue;
    for (const c of parts[i]) GRID[c] = 1;
  }
}
