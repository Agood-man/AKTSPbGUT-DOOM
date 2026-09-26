
function saveGame(){
  if (!playing || cheated) return;
  store.set(SAVE_KEY, JSON.stringify({
    v:1, level, kills, gun, seed:runSeed, seedName, cheated,
    hp:Math.round(P.hp), armor:Math.round(P.armor),
    bullets:ammo.bullets, shells:ammo.shells, grenades:ammo.grenades,
    guns:unlocked.reduce((m, v, i) => m | (v ? 1 << i : 0), 0),
    inv:[inv.rage, inv.haste, inv.shield],
    time:Math.round(runTime)
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
var BT = {rage:0, haste:0, shield:0};
var inv = {rage:0, haste:0, shield:0};
var INV_MAX = 3, BUFF_CAP = 45;
var buffShownKey = "";

function updateInvUI(){
  const bar = document.getElementById("invbar");
  let any = false;
  for (const k in inv){
    const el = document.getElementById("inv_" + k);
    el.querySelector("b").textContent = inv[k];
    el.classList.toggle("empty", inv[k] <= 0);
    el.classList.toggle("active", BT[k] > 0);
    if (inv[k] > 0 || BT[k] > 0) any = true;
  }
  bar.classList.toggle("gone", !any || !playing);
}

function useBuff(k){
  if (!playing || paused || layoutEdit || inv[k] <= 0) return;
  inv[k]--;
  BT[k] = Math.min(BUFF_CAP, BT[k] + BUFFS[k].time);
  buffShownKey = "";
  showBanner(BUFFS[k].name, true);
  beep("sine", 400, .4, .16, 1100);
  updateInvUI();
  saveGame();
}
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

function updateLamps(dt){
  let changed = false;
  for (const L of LAMPS){
    if (L.state !== "flicker") continue;
    L.t -= dt;
    if (L.t > 0) continue;
    changed = true;
    if (L.blink > 0){
      L.blink--;
      L.val = L.val > .5 ? .05 + Math.random()*.2 : 1;
      L.t = .04 + Math.random()*.1;
      if (L.blink === 0){ L.val = 1; L.t = 1 + Math.random()*4; }
    } else {
      L.blink = 3 + (Math.random()*8 | 0);
      L.val = .1; L.t = .05;
      const dx = L.x + .5 - P.x, dy = L.y + .5 - P.y;
      if (dx*dx + dy*dy < 49 && AC){
        const a = atPos(L.x + .5, L.y + .5);
        noiseBurst(.08, .04 * a.vol, 3200, 1, a.pan);
      }
    }
  }
  if (changed) composeLight();
}

function updateLight(dt){
  updateLamps(dt);
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

var bossRef = null, introT = 0, shake = 0, portal = null, portalT = 0;
var runTime = 0, finalOutro = null, diplomaShown = false;
var DIPLOMA_KEY = "terplandia3d.diploma";

function showDiploma(){
  const m = Math.floor(runTime / 60), h = Math.floor(m / 60);
  document.getElementById("dip_kills").textContent = kills;
  document.getElementById("dip_time").textContent = h ? `${h} ч ${m % 60} мин` : `${m} мин`;
  document.getElementById("dip_seed").textContent = seedText();
  document.getElementById("dip_grade").textContent = cheated ? "ЗАЧТЕНО (С ОТЛАДКОЙ)" : "С ОТЛИЧИЕМ";
  const d = document.getElementById("diploma");
  d.classList.toggle("red", !cheated);
  d.classList.remove("gone", "show");
  void d.offsetWidth;
  d.classList.add("show");
  diplomaShown = true;
  fireHeld = false; mouseHeld = false;
  try { document.exitPointerLock?.(); } catch(e){}
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep("square", f, .35, .12, f), i * 160));
  if (!cheated){
    try { localStorage.setItem(DIPLOMA_KEY, JSON.stringify({seed: runSeed, kills, time: Math.round(runTime)})); } catch(e){}
  }
}

function closeDiploma(){
  document.getElementById("diploma").classList.add("gone");
  diplomaShown = false;
  last = performance.now();
  showBanner("АСПИРАНТУРА", true, "дальше этажи бесконечны · удачи");
}

function openPortal(e){
  let best = null;
  for (let t = 0; t < 600 && !best; t++){
    const x = 1.5 + Math.random()*(MW - 3), y = 1.5 + Math.random()*(MH - 3);
    if (solid(x, y, .5)) continue;
    if (Math.hypot(x - P.x, y - P.y) < 3) continue;
    let clear = true;
    for (const it of items) if (!it.dead && Math.hypot(it.x - x, it.y - y) < 1.6){ clear = false; break; }
    if (clear) best = {x, y};
  }
  if (!best) best = {x:e.x, y:e.y};
  portal = {x:best.x, y:best.y, t:0};
  showBanner("ПОРТАЛ ОТКРЫТ", true, "собери награду и войди в портал");
  beep("sine", 180, 1.2, .18, 720);
}

function spawnBoss(){
  const T = bossTypeFor(level);
  const fin = T.id === "final";
  const hp = fin ? T.hp : Math.round(T.hp * (1 + 1.8 * t150()));
  enemies = [];
  items = [];
  bossRef = {
    type:"boss", boss:true, kind:T.id, name:T.name, tint:T.tint, scale:T.scale, rad:.55, art:"boss_" + T.id,
    x:17.5, y:9.5, hp, maxHp:hp, alive:true, t:0, cd:2, atk:3.5, deadT:0,
    speed:T.speed * (1 + .2 * t150()), dmg:T.dmg, strafe:1,
    stuck:0, slideT:0, slideDir:1, seen:true, hurtT:0, voiceT:99, breathT:0, seeT:0, sees:false
  };
  if (fin){
    bossRef.x = 17.5; bossRef.y = 7.5; bossRef.rad = .6; bossRef.phase = 1;
    bossRef.speed = T.speed; bossRef.atk = 2.5; bossRef.atk2 = 6;
  }
  enemies.push(bossRef);
  enemiesLeft = 1;
  const drops = [["bullets", 8.5, 24.5], ["bullets", 26.5, 24.5], ["shells", 8.5, 8.5], ["medkit", 26.5, 8.5]];
  if (unlocked[3]) drops.push(["grenades", 17.5, 17.5]);
  if (fin){
    drops.length = 0;
    drops.push(["bullets", 6.5, 27.5], ["bullets", 28.5, 27.5], ["shells", 6.5, 6.5], ["shells", 28.5, 6.5],
               ["grenades", 17.5, 22.5], ["medkit", 6.5, 17.5], ["medkit", 28.5, 17.5], ["armor", 17.5, 27.5]);
  }
  for (const [kind, x, y] of drops) items.push({kind, x, y, t:Math.random()*6});
  P.x = 17.5; P.y = fin ? 29.5 : 26.5; P.a = -Math.PI / 2;
  stat = {fired:0, hit:0, t:0, n:1};
}

function bossDefeated(e){
  if (e.kind === "final"){
    finalOutro = {t:0, x:e.x, y:e.y, next:0};
    showBanner("ПАЛ ПАЛЫЧ ОТЧИСЛЕН", true, "поздравляем");
  }
  const drop = (kind, n) => {
    for (let i = 0; i < n; i++){
      const a = Math.random() * 6.283, r = .6 + Math.random() * 1.6;
      let x = e.x + Math.cos(a)*r, y = e.y + Math.sin(a)*r;
      if (solid(x, y, .3)){ x = e.x; y = e.y; }
      items.push({kind, x, y, t:Math.random()*6});
    }
  };
  drop("bullets", 6); drop("shells", 4); drop("grenades", 2);
  drop("medkit", 2); drop("armor", 1);
  const bk = Object.keys(BUFFS);
  drop(bk[(Math.random()*bk.length)|0], 1);
  drop(bk[(Math.random()*bk.length)|0], 1);
  for (const m of enemies) if (m.alive && m.minion){ m.alive = false; m.deadT = 0; }
  showBanner(`${e.name} ПОВЕРЖЕН${e.name.endsWith("А") ? "А" : ""}`, true, "забери награду");

  beep("sawtooth", 90, 1.4, .3, 30);
  noiseBurst(1.2, .3, 500, .8);
  shake = Math.max(shake, 1);
}

function playBossIntro(name, fin){
  const el = document.getElementById("bossintro");
  const img = document.getElementById("bossimg");
  const want = fin ? palPortraitURL() : "assets/ui/boss-intro.jpg";
  if (img.getAttribute("src") !== want) img.src = want;
  document.getElementById("bossiname").textContent = name;
  document.getElementById("bosstitle").textContent = fin ? "ФИНАЛЬНЫЙ БОСС" : "БОЙ С БОССОМ";
  el.classList.toggle("final", !!fin);
  el.classList.remove("gone", "play");
  void el.offsetWidth;
  el.classList.add("play");
  introT = fin ? 3.6 : 2.6;
  if (fin){
    setTimeout(() => beep("sawtooth", 36, 2.4, .34, 22), 900);
    setTimeout(() => { beep("square", 660, .3, .12, 330); beep("square", 990, .3, .1, 495); }, 1500);
  }
  fireHeld = false; mouseHeld = false;
  setDrone(0);
  beep("sawtooth", 55, 1.6, .32, 30);
  noiseBurst(1.4, .22, 380, .8);
  setTimeout(() => beep("square", 880, .5, .12, 220), 350);
  clearTimeout(introTimer);
  introTimer = setTimeout(stopBossIntro, fin ? 3600 : 2600);
}

var introTimer = 0;
function stopBossIntro(){
  clearTimeout(introTimer);
  const el = document.getElementById("bossintro");
  if (!el.classList.contains("gone")){
    el.classList.add("gone"); el.classList.remove("play");
    if (playing) setDrone(.05);
  }
  introT = 0;
}

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
    const [open8, open4] = openCells();
    const far = c => Math.hypot((c % MW) + .5 - P.x, ((c / MW) | 0) + .5 - P.y) >= 4;
    const pool = open8.filter(far).length ? open8.filter(far) : open4.filter(far);
    let gx, gy;
    if (pool.length){ const c = pool[(Math.random()*pool.length) | 0]; gx = c % MW; gy = (c / MW) | 0; }
    else { const g = freeCell(4); gx = g.x | 0; gy = g.y | 0; }
    items.push({kind:"gun" + n, x:gx + .5, y:gy + .5, t:0});
    LAMPS = LAMPS.filter(L => Math.hypot(L.x - gx, L.y - gy) >= 5);
    const gl = addLamp(gx, gy, 4.5, .85, "flicker", 0);
    if (gl) gl.gun = "gun" + n;
    composeLight();
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
  stopBossIntro();
  finalOutro = null;
  bossRef = null; portal = null; portalT = isFinalLevel() ? 3.4 : 1.6;
  if (isBossLevel()) spawnBoss();
  beep("sine", 300, .5, .12, 600);
  if (C.surge){
    setDrone(0);
    setTimeout(() => { beep("sine", 44, 1.6, .3, 24); noiseBurst(1.2, .18, 260, .8); setDrone(.05); }, 900);
  }
  if (bossRef && bossRef.kind === "final"){
    showBanner(`ФИНАЛЬНЫЙ БОСС · ${bossRef.name}`, true, `УРОВЕНЬ ${level} · ${biome.name}`);
    playBossIntro(bossRef.name, true);
  } else if (bossRef){
    showBanner(`БОЙ С БОССОМ · ${bossRef.name}`, true, `УРОВЕНЬ ${level}`);
    playBossIntro(bossRef.name);
  } else {
    showBanner((C.surge ? `ПРОРЫВ · УРОВЕНЬ ${level}` : `УРОВЕНЬ ${level}`) + ` · ${biome.name}`,
               C.surge, [grade, gunHint].filter(Boolean).join(" · "));
  }
  darkLevel = !brightMode && levelLight === "dark";
  lightBase = brightMode ? 2.4 : 1;
  lightNow = lightBase;
  playerLight = LMAP[(P.y|0)*MW + (P.x|0)] || .1;
  flickerT = 1e9; flickerLeft = 0;
  stat = {fired:0, hit:0, t:0, n:enemies.length};
  combo = 0; comboT = 0;
  HUD.combo.classList.remove("show");
  grenades.length = 0; booms.length = 0;
  wpnSeq = null; wpnFrame = 0; wpnOffset = 0; wpnSwitch = -1;
  updateHUD();
  updateInvUI();
  saveGame();
}

function reset(seed){
  runSeed = seed != null ? (seed >>> 0) : (Math.random()*0xFFFFFFFF) >>> 0;
  P.hp = 100; P.armor = 0; P.inv = 0; P.hitT = 0;
  ammo = {bullets:45, shells:10, grenades:0};
  unlocked = [true, false, false, false];
  gun = 0; kills = 0; level = 0;
  for (const k in BT){ BT[k] = 0; inv[k] = 0; }
  runTime = 0;
  buffShownKey = "";
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
