
function saveGame(){
  if (!playing || cheated) return;
  store.set(SAVE_KEY, JSON.stringify({
    v:1, level, kills, gun, seed:runSeed, seedName, cheated,
    hp:Math.round(P.hp), armor:Math.round(P.armor),
    bullets:ammo.bullets, shells:ammo.shells, grenades:ammo.grenades,
    guns:unlocked.reduce((m, v, i) => m | (v ? 1 << i : 0), 0)
  }));
}
function loadGame(){
  try {
    const raw = store.get(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !(s.level > 0)) return null;
    return s;
  } catch(e){ return null; }
}
function clearSave(){ store.del(SAVE_KEY); }

function getRecord(){
  try {
    const r = JSON.parse(store.get(REC_KEY)) || {level:0, kills:0};
    if (!(r.level >= 0) || r.level > 1e9 || !(r.kills >= 0)) return {level:0, kills:0};
    return r;
  } catch(e){ return {level:0, kills:0}; }
}
function saveRecord(){
  if (cheated) return;
  const r = getRecord();
  if (level > num(r.level,0) || (level === num(r.level,0) && kills > num(r.kills,0)))
    store.set(REC_KEY, JSON.stringify({level, kills}));
}

var P = {x:2.5, y:2.5, a:0, hp:100, armor:0, hurt:0, pick:0, inv:0, hitDir:0, hitT:0};
var BUFFS = {
  rage:  {name:"ЯРОСТЬ",    time:15, color:"#c8321e"},
  haste: {name:"УСКОРЕНИЕ", time:15, color:"#e0c020"},
  shield:{name:"ЩИТ",       time:10, color:"#3f9fd0"}
};
var buff = null, buffT = 0, buffShown = -1;
var stat = {fired:0, hit:0, t:0, n:0};
var clock = 0;
var INV_TIME = .45;
var enemies = [], items = [], shots = [];
var ammo = {bullets:45, shells:10, grenades:0};
var gun = 0, kills = 0, level = 0, enemiesLeft = 0;
var playing = false, flash = 0, recoil = 0, cooldown = 0, bobPhase = 0;
var boomLight = 0, boomX = 0, boomY = 0;
var lightBase = 1;
var lightNow = 1;
var flickerT = 0, flickerLeft = 0, darkLevel = false;
var backT = 0;

function updateLight(dt){
  if (brightMode){ lightNow = lightBase = 2.4; return; }
  if (boomLight > .04){
    const d = Math.hypot(boomX - P.x, boomY - P.y);
    const k = boomLight * Math.max(.2, 1 - d/14);
    lightNow = Math.max(lightNow, lightBase + k*.5);
  }
  flickerT -= dt;
  if (flickerLeft > 0){
    flickerLeft -= dt;
    lightNow = lightBase * (Math.random() < .55 ? .18 + Math.random()*.2 : 1);
    if (flickerLeft <= 0) lightNow = lightBase;
  } else if (flickerT <= 0){
    flickerT = darkLevel ? 2.5 + Math.random()*4.5 : 6 + Math.random()*12;
    flickerLeft = darkLevel ? .45 + Math.random()*1.1 : .3 + Math.random()*.6;
    if (AC) noiseBurst(.12, .05, 3000, 1);
  } else {
    lightNow += (lightBase - lightNow) * Math.min(1, dt*8);
  }
  if (flash > .05) lightNow = Math.max(lightNow, Math.min(1.15, lightBase + flash*.7));
  const pc = (P.y|0)*MW + (P.x|0);
  const target = pc >= 0 && pc < LMAP.length ? LMAP[pc] : .1;
  playerLight += (target - playerLight) * Math.min(1, dt*3);
}
var keys = {};

function freeCell(minDist){
  for (let i=0;i<800;i++){
    const x = 1.5 + Math.random()*(MW-3), y = 1.5 + Math.random()*(MH-3);
    if (solid(x, y, .34)) continue;
    const md = minDist * (i < 300 ? 1 : i < 600 ? .6 : .35);
    if (Math.hypot(x-P.x, y-P.y) < md) continue;
    return {x,y};
  }
  for (let y=1;y<MH-1;y++)
    for (let x=1;x<MW-1;x++)
      if (!GRID[y*MW+x]) return {x:x+.5, y:y+.5};
  return {x:2.5, y:2.5};
}

var meltCv = document.getElementById("melt");
var mctx = meltCv.getContext("2d");
var meltCols = null, meltFrozen = null;

function startMelt(){
  if (!W || !H) return;
  if (!meltFrozen) meltFrozen = document.createElement("canvas");
  meltFrozen.width = W; meltFrozen.height = H;
  meltFrozen.getContext("2d").drawImage(cv, 0, 0);
  meltCv.width = W; meltCv.height = H;
  const strip = Math.max(2, Math.round(W/70));
  meltCols = [];
  let y = -Math.random()*10;
  for (let x=0; x<W; x+=strip){
    y = Math.min(0, Math.max(-22, y + (Math.random()*8 - 4)));
    meltCols.push({x, w:Math.min(strip, W-x), y, v:0, delay:Math.random()*.3});
  }
  meltCv.classList.remove("gone");
}

function stopMelt(){
  meltCols = null;
  meltCv.classList.add("gone");
}

function meltStep(dt){
  mctx.clearRect(0, 0, W, H);
  let done = true;
  for (const c of meltCols){
    if (c.delay > 0){ c.delay -= dt; done = false; }
    else { c.v += 420*dt; c.y += c.v*dt; }
    if (c.y < H){
      done = false;
      mctx.drawImage(meltFrozen, c.x, 0, c.w, H, c.x, c.y, c.w, H);
    }
  }
  if (done) stopMelt();
}

var stepAcc = 0, gaspT = 0;
var bannerT = null;
function showBanner(text, surge, sub){
  const b = document.getElementById("banner");
  if (!b) return;
  b.innerHTML = sub ? `${text}<span>${sub}</span>` : text;
  b.classList.toggle("surge", !!surge);
  b.classList.add("show");
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove("show"), surge ? 2000 : 1400);
}

function levelGrade(){
  if (!stat.n) return "";
  const acc = stat.fired ? stat.hit/stat.fired : 0;
  const pace = stat.t / stat.n;
  let g = 2;
  if (pace < 3.2 && acc > .45) g = 5;
  else if (pace < 5.2 && acc > .3) g = 4;
  else if (pace < 8.5) g = 3;
  return `ОЦЕНКА ЗА ЭТАЖ: ${g} · ${["ПЛОХО","УДОВЛ.","ХОРОШО","ОТЛИЧНО"][g-2]}`;
}

function nextLevel(){
  const grade = level > 0 ? levelGrade() : "";
  if (level > 0){
    P.hp = Math.min(100, P.hp + curve().levelHeal);
    ammo.bullets += 10;
    P.inv = 0;
  }
  level++;
  const spawn = generateLevel(level);
  P.x = spawn.x; P.y = spawn.y; P.a = Math.random()*6.28;
  enemies = []; items = []; shots = [];

  const C = curve();
  for (let i=0;i<C.count;i++){
    const r = Math.random();
    let type = "imp";
    if (r < C.bulls) type = "bull";
    else if (r < C.bulls + C.casters) type = "caster";
    const k = KIND[type], p = freeCell(8);
    enemies.push({
      type, x:p.x, y:p.y, hp:k.hp + C.hpBonus(type), alive:true,
      t:Math.random()*10, cd:Math.random()*1.5 + .5, deadT:0,
      speed:Math.min(k.speed + level*.03, k.speed*1.28),
      stuck:0, slideT:0, slideDir:1, seen:false, hurtT:0,
      voiceT:2 + Math.random()*5, breathT:0, seeT:0, sees:false
    });
  }
  enemiesLeft = enemies.length;

  let gunHint = "";
  for (let n=1; n<GUNS.length; n++){
    if (level < GUN_AT[n] || unlocked[n]) continue;
    const g = freeCell(4);
    items.push({kind:"gun" + n, x:g.x, y:g.y, t:0});
    gunHint = `НА ЭТАЖЕ: ${GUNS[n].name}`;
    break;
  }
  if (level >= 4 && Math.random() < .7){
    const keys = Object.keys(BUFFS), k = keys[Math.floor(Math.random()*keys.length)];
    const b = freeCell(5);
    items.push({kind:k, x:b.x, y:b.y, t:0});
  }
  if (level >= 8 && unlocked[3]){
    const gr = freeCell(4);
    items.push({kind:"grenades", x:gr.x, y:gr.y, t:0});
  }

  const drops = [
    ["medkit",  C.medkits],
    ["bullets", C.bullets],
    ["shells",  C.shells],
    ["armor",   level % 2 === 0 ? 1 : 0]
  ];
  for (const [kind, count] of drops){
    for (let i=0;i<count;i++){
      const p = freeCell(3);
      items.push({kind, x:p.x, y:p.y, t:Math.random()*6});
    }
  }
  beep("sine", 300, .5, .12, 600);
  if (C.surge){
    setDrone(0);
    setTimeout(() => { beep("sine", 44, 1.6, .3, 24); noiseBurst(1.2, .18, 260, .8); setDrone(.05); }, 900);
  }
  showBanner((C.surge ? `ПРОРЫВ · УРОВЕНЬ ${level}` : `УРОВЕНЬ ${level}`) + ` · ${biome.name}`,
             C.surge, [grade, gunHint].filter(Boolean).join(" · "));
  darkLevel = !brightMode && levelLight === "dark";
  lightBase = brightMode ? 2.4 : 1;
  lightNow = lightBase;
  playerLight = LMAP[(P.y|0)*MW + (P.x|0)] || .1;
  flickerT = 2; flickerLeft = 0;
  stat = {fired:0, hit:0, t:0, n:enemies.length};
  combo = 0; comboT = 0;
  HUD.combo.classList.remove("show");
  grenades.length = 0; booms.length = 0;
  wpnSeq = null; wpnFrame = 0; wpnOffset = 0; wpnSwitch = -1;
  updateHUD();
  saveGame();
}

function reset(seed){
  runSeed = seed != null ? (seed >>> 0) : (Math.random()*0xFFFFFFFF) >>> 0;
  P.hp = 100; P.armor = 0; P.inv = 0; P.hitT = 0;
  ammo = {bullets:45, shells:10, grenades:0};
  unlocked = [true, false, false, false];
  gun = 0; kills = 0; level = 0;
  buff = null; buffT = 0; buffShown = -1;
  combo = 0; comboT = 0;
  grenades.length = 0; booms.length = 0;
  nextLevel();
}

var shortNum = n => n < 100000 ? String(n)
  : n < 1e6 ? (n/1000).toFixed(0) + "K"
  : n < 1e9 ? (n/1e6).toFixed(1) + "M"
  : (n/1e9).toFixed(2) + "B";

var HUD = {
  hp: document.querySelector("#hp b"),
  armor: document.querySelector("#armor b"),
  kills: document.querySelector("#kills b"),
  left: document.getElementById("left"),
  leftValue: document.querySelector("#left b"),
  lvl: document.querySelector("#lvl b"),
  ammo: document.querySelector("#ammo b"),
  gunname: document.getElementById("gunname"),
  lowhp: document.getElementById("lowhp"),
  hurt: document.getElementById("hurt"),
  pick: document.getElementById("pick"),
  combo: document.getElementById("combo"),
  buff: document.getElementById("buff")
};

function updateHUD(){
  HUD.hp.textContent = Math.max(0, Math.round(P.hp));
  HUD.armor.textContent = Math.round(P.armor);
  HUD.kills.textContent = shortNum(kills);
  HUD.leftValue.textContent = enemiesLeft;
  HUD.left.classList.toggle("clear", enemiesLeft === 0);
  HUD.lvl.textContent = shortNum(level);
  const g = GUNS[gun];
  HUD.ammo.textContent = g.ammo ? ammo[g.ammo] : "∞";
  HUD.gunname.textContent = g.name;
}

var PR = .26;
