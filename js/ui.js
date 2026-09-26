var last = 0, autoSave = 0;
var fpsOn = false, fpsFrames = 0, fpsAcc = 0, fpsWorst = 0;
function fpsTick(rawMs){
  if (!fpsOn) return;
  fpsFrames++; fpsAcc += rawMs;
  if (rawMs > fpsWorst) fpsWorst = rawMs;
  if (fpsAcc >= 1000){
    const el = document.getElementById("fps");
    const n = enemies.filter(e => e.alive).length;
    el.textContent = `${Math.round(fpsFrames * 1000 / fpsAcc)} FPS\nхудший ${fpsWorst.toFixed(0)} мс\nврагов ${n}`;
    fpsFrames = 0; fpsAcc = 0; fpsWorst = 0;
  }
}

var layoutEdit = false;
var CTRL_IDS = ["stick", "fire", "swap", "pausebtn", "minimap", "invbar"];
var CTRL_ORIGIN = { stick:"left bottom", fire:"right bottom", swap:"right bottom", pausebtn:"right top", minimap:"left top", invbar:"right bottom" };

function applyLayoutPrefs(){
  document.getElementById("invbar").classList.toggle("horiz", !!SET.invHoriz);
  document.body.classList.toggle("phoneview", DESKTOP && !SET.pcWide);
  document.getElementById("invdir").textContent = SET.invHoriz ? "УСИЛИТЕЛИ: В РЯД" : "УСИЛИТЕЛИ: СТОЛБИКОМ";
  document.getElementById("pcview").textContent = SET.pcWide ? "ВИД НА ПК: ШИРОКИЙ" : "ВИД НА ПК: КАК НА ТЕЛЕФОНЕ";
  document.getElementById("pcview").classList.toggle("gone", !DESKTOP);
  resize();
  xhKey = "";
}

function layoutBossBar(){
  const bb = document.getElementById("bossbar");
  const wr = document.getElementById("wrap").getBoundingClientRect();
  const mm = document.getElementById("minimap").getBoundingClientRect();
  const pz = document.getElementById("pausebtn").getBoundingClientRect();
  let left = 8, right = wr.width - 8, top = 12;
  if (mm.width && mm.top - wr.top < 80 && mm.left - wr.left < wr.width / 2) left = Math.max(left, mm.right - wr.left + 8);
  if (pz.width && pz.top - wr.top < 80 && pz.left - wr.left > wr.width / 2) right = Math.min(right, pz.left - wr.left - 8);
  if (right - left < 150){
    left = 8; right = wr.width - 8;
    top = Math.max(mm.width ? mm.bottom : 0, pz.width ? pz.bottom : 0) - wr.top + 8;
  }
  let w = right - left;
  if (w > 340){ left += (w - 340) / 2; w = 340; }
  bb.style.left = left + "px"; bb.style.width = w + "px"; bb.style.top = top + "px"; bb.style.transform = "none";
}

function applyControls(){
  for (const id of CTRL_IDS){
    const el = document.getElementById(id);
    const p = SET.pos[id];
    const scale = SET.ctrl[id].size;
    el.style.opacity = SET.ctrl[id].alpha;
    if (p){
      el.style.left = (p.x*100) + "%"; el.style.top = (p.y*100) + "%";
      el.style.right = "auto"; el.style.bottom = "auto";
      el.style.transformOrigin = "center";
      el.style.transform = `translate(-50%,-50%) scale(${scale})`;
    } else {
      el.style.left = el.style.top = el.style.right = el.style.bottom = "";
      el.style.transformOrigin = CTRL_ORIGIN[id];
      el.style.transform = scale === 1 ? "" : `scale(${scale})`;
    }
  }
  layoutBossBar();
}

var SLIDERS = {
  sensMouse: [100, v => v + "%"], sensTouch: [100, v => v + "%"],
  gamma: [100, v => v + "%"], volume: [100, v => v + "%"],
  quality: [100, v => v + "%"]
};
var ctrlSel = "stick";

function syncCtrlUI(){
  const c = SET.ctrl[ctrlSel];
  const vs = Math.round(c.size * 100), va = Math.round(c.alpha * 100);
  document.getElementById("s_csize").value = vs;
  document.getElementById("v_csize").textContent = vs + "%";
  document.getElementById("s_calpha").value = va;
  document.getElementById("v_calpha").textContent = va + "%";
  for (const b of document.querySelectorAll(".ctabs button"))
    b.classList.toggle("on", b.dataset.c === ctrlSel);
}
var settingsFrom = null;

function syncSettingsUI(){
  for (const k in SLIDERS){
    const v = Math.round(SET[k] * SLIDERS[k][0]);
    document.getElementById("s_" + k).value = v;
    document.getElementById("v_" + k).textContent = SLIDERS[k][1](v);
  }
  syncCtrlUI();
  document.getElementById("setnote").textContent =
    HAS_TOUCH ? "" : "На компьютере двигаются карта и кнопка паузы";
}

function openSettings(from){
  settingsFrom = from;
  syncSettingsUI();
  document.getElementById("settings").classList.remove("gone");
}
function closeSettings(){
  document.getElementById("settings").classList.add("gone");
  saveSettings();
}

function startLayoutEdit(){
  layoutEdit = true;
  fireHeld = false; stickId = null; lookId = null; touch.fw = touch.st = 0; knob.style.transform = "";
  document.getElementById("settings").classList.add("gone");
  for (const id of ["pause", "screen"]) document.getElementById(id).classList.add("hidden-edit");
  document.body.classList.add("editing");
  document.getElementById("layoutbar").classList.remove("gone");
}
function stopLayoutEdit(){
  layoutEdit = false;
  document.body.classList.remove("editing");
  document.getElementById("layoutbar").classList.add("gone");
  for (const id of ["pause", "screen"]) document.getElementById(id).classList.remove("hidden-edit");
  saveSettings();
  openSettings(settingsFrom);
}

function initSettings(){
  for (const k in SLIDERS){
    const input = document.getElementById("s_" + k);
    input.addEventListener("input", () => {
      const v = +input.value;
      SET[k] = v / SLIDERS[k][0];
      document.getElementById("v_" + k).textContent = SLIDERS[k][1](v);
      if (k === "volume") applyVolume();
      if (k === "quality") resize();
    });
    input.addEventListener("change", saveSettings);
  }
  for (const b of document.querySelectorAll(".ctabs button"))
    onTap(b, () => { ctrlSel = b.dataset.c; syncCtrlUI(); });
  for (const [id, key] of [["s_csize", "size"], ["s_calpha", "alpha"]]){
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      SET.ctrl[ctrlSel][key] = +input.value / 100;
      document.getElementById(id === "s_csize" ? "v_csize" : "v_calpha").textContent = input.value + "%";
      applyControls();
    });
    input.addEventListener("change", saveSettings);
  }
  for (const b of document.querySelectorAll("#invbar .inv")) onTap(b, () => useBuff(b.dataset.b));
  onTap(document.getElementById("settingsbtn"), () => openSettings("menu"));
  onTap(document.getElementById("settingsbtn2"), () => openSettings("pause"));
  onTap(document.getElementById("setclose"), closeSettings);
  onTap(document.getElementById("setreset"), () => {
    const keep = SET;
    Object.assign(keep, SET_DEFAULT, { pos:{}, ctrl: defaultCtrl() });
    applyVolume(); applyLayoutPrefs(); applyControls(); syncSettingsUI(); saveSettings();
  });
  onTap(document.getElementById("layoutbtn"), startLayoutEdit);
  onTap(document.getElementById("dipclose"), closeDiploma);
  onTap(document.getElementById("invdir"), () => { SET.invHoriz = !SET.invHoriz; applyLayoutPrefs(); saveSettings(); });
  onTap(document.getElementById("pcview"), () => { SET.pcWide = !SET.pcWide; applyLayoutPrefs(); saveSettings(); });
  document.addEventListener("mousedown", e => {
    if (!DESKTOP || !playing || paused || document.pointerLockElement === cv) return;
    if (e.target === document.body || e.target === document.documentElement){
      try { cv.requestPointerLock?.(); } catch(err){}
    }
  });
  onTap(document.getElementById("layoutdone"), stopLayoutEdit);
  onTap(document.getElementById("layoutreset"), () => { SET.pos = {}; applyControls(); });

  const wrap = document.getElementById("wrap");
  for (const id of CTRL_IDS){
    const el = document.getElementById(id);
    let dragging = false;
    el.addEventListener("pointerdown", e => {
      if (!layoutEdit) return;
      dragging = true;
      el.setPointerCapture?.(e.pointerId);
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener("pointermove", e => {
      if (!layoutEdit || !dragging) return;
      const r = wrap.getBoundingClientRect();
      const x = Math.min(.97, Math.max(.03, (e.clientX - r.left) / r.width));
      const y = Math.min(.97, Math.max(.03, (e.clientY - r.top) / r.height));
      SET.pos[id] = { x, y };
      applyControls();
      e.preventDefault();
    });
    const end = () => { dragging = false; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  applyControls();
}

function loop(t){
  requestAnimationFrame(loop);
  const rawMs = (t - last) || 0;
  fpsTick(rawMs);
  const dt = Math.min(.05, rawMs/1000); last = t;
  if (introT > 0){ introT -= dt; }
  else if (playing && !paused && !dbgShown && !diplomaShown){
    update(dt);
    autoSave += dt;
    if (autoSave > 15){ autoSave = 0; saveGame(); }
  }
  render();
  if (meltCols) meltStep(dt);
}
addEventListener("visibilitychange", () => {
  if (document.hidden){ saveGame(); if (playing) setPause(true); AC?.suspend?.(); }
  else { AC?.resume?.(); last = performance.now(); }
});
addEventListener("pagehide", saveGame);

var screen = document.getElementById("screen");
var title = document.getElementById("title");
var msg = document.getElementById("msg");
var seedIn = document.getElementById("seedin");
var pauseBox = document.getElementById("pause");
var pauseBtn = document.getElementById("pausebtn");
var seedCopy = document.getElementById("seedcopy");
var seedPaste = document.getElementById("seedpaste");
var pauseSeedBtn = document.getElementById("pauseseedcopy");
var TITLE0 = title.innerHTML, MSG0 = msg.textContent;
var startBtn = document.getElementById("start");
var deathbg = document.getElementById("deathbg");

var contBtn = document.getElementById("cont");
var recLine = document.getElementById("rec");

function copyText(text, btn){
  const done = () => {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = old; }, 1200);
  };
  try {
    if (navigator.clipboard?.writeText){ navigator.clipboard.writeText(text).then(done, () => fallback()); return; }
  } catch(e){}
  fallback();
  function fallback(){
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99);
      document.execCommand("copy"); ta.remove(); done();
    } catch(e){}
  }
}

function pasteSeed(btn){
  const put = t => {
    if (!t) return false;
    seedIn.value = String(t).trim().replace(/^#/, "").toUpperCase().slice(0, 24);
    if (btn){
      const old = btn.textContent;
      btn.textContent = "ГОТОВО";
      setTimeout(() => { btn.textContent = old; }, 1200);
    }
    return true;
  };
  try {
    if (navigator.clipboard?.readText){
      navigator.clipboard.readText().then(put, () => seedIn.focus());
      return;
    }
  } catch(e){}
  seedIn.focus();
}

function refreshScreen(){
  const sv = loadGame(), r = getRecord();
  contBtn.classList.toggle("gone", !sv);
  if (sv) contBtn.textContent = `ПРОДОЛЖИТЬ · УР. ${sv.level}`;
  recLine.textContent = num(r.level,0) ? `Рекорд: уровень ${r.level}, фрагов ${r.kills}` : "";
}

function initAudio(){
  try {
    if (!AC){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) AC = new Ctx();
    }
    AC?.resume?.();
  } catch(e){ AC = null; }
}

function beginRun(sv){
  initAudio();
  startDrone(); setDrone(.05);
  screen.classList.add("hide");
  screen.classList.remove("death");
  title.classList.remove("long");
  paused = false;
  god = false; brightMode = false; sandbox = false; dbgFreeze = false;
  cheated = false;
  dbgUnlocked = false;
  debugOpen(false);
  stopMelt();
  pauseBox.classList.add("gone");
  pauseBtn.classList.remove("gone");
  faceCv.classList.remove("gone");
  faceKey = "";
  if (sv){
    P.hp = num(sv.hp,100); P.armor = num(sv.armor,0);
    ammo = {bullets:num(sv.bullets,45), shells:num(sv.shells,10), grenades:num(sv.grenades,0)};
    const mask = num(sv.guns, 1) | 1;
    unlocked = GUNS.map((g, i) => !!(mask & (1 << i)));
    gun = Math.min(GUNS.length-1, Math.max(0, num(sv.gun,0)|0));
    if (!unlocked[gun]) gun = 0;
    kills = num(sv.kills,0); level = num(sv.level,1) - 1;
    runSeed = (num(sv.seed, runSeed) >>> 0) || runSeed;
    seedName = typeof sv.seedName === "string" ? sv.seedName : "";
    cheated = !!sv.cheated;
    runTime = num(sv.time, 0);
    if (Array.isArray(sv.inv)){
      inv.rage = Math.min(INV_MAX, num(sv.inv[0], 0) | 0);
      inv.haste = Math.min(INV_MAX, num(sv.inv[1], 0) | 0);
      inv.shield = Math.min(INV_MAX, num(sv.inv[2], 0) | 0);
    }
    playing = true;
    nextLevel();
  } else {
    clearSave();
    const typed = (seedIn.value || "").trim().replace(/^#/, "").toUpperCase();
    seedName = /^[0-9A-F]{1,8}$/.test(typed) ? "" : typed;
    reset(parseSeed(typed));
    playing = true;
    saveGame();
  }
  try { if (DESKTOP) cv.requestPointerLock?.(); } catch(e){}
}

var paused = false;
function setPause(v){
  if (!playing) return;
  paused = v;
  pauseBox.classList.toggle("gone", !v);
  pauseBtn.classList.toggle("gone", v);
  if (v){
    fireHeld = false; mouseHeld = false;
    for (const k in keys) keys[k] = false;
    stickId = null; lookId = null;
    touch.fw = touch.st = 0; knob.style.transform = "";
    document.getElementById("pauseinfo").textContent =
      `Уровень ${level} · ${biome.name} · фрагов ${kills}`;
    document.getElementById("pauseseed").textContent = `Семя: ${seedShow()}`;
    saveGame();
    setDrone(0);
    try { document.exitPointerLock?.(); } catch(e){}
    AC?.suspend?.();
  } else {
    last = performance.now();
    AC?.resume?.(); setDrone(.05);
    try { if (DESKTOP) cv.requestPointerLock?.(); } catch(e){}
  }
}

function quitToMenu(){
  saveGame();
  setDrone(0);
  cheated = false; god = false; brightMode = false; sandbox = false; dbgFreeze = false;
  for (const k in BT) BT[k] = 0;
  dbgUnlocked = false;
  debugOpen(false);
  paused = false;
  pauseBox.classList.add("gone");
  pauseBtn.classList.add("gone");
  playing = false;
  updateInvUI();
  bossRef = null; portal = null; stopBossIntro();
  document.getElementById("bossbar").classList.add("gone");
  faceCv.classList.add("gone");
  screen.classList.remove("hide", "death");
  title.innerHTML = TITLE0;
  title.classList.remove("long");
  msg.textContent = MSG0;
  startBtn.textContent = "НАЧАТЬ";
  try { document.exitPointerLock?.(); } catch(e){}
  refreshScreen();
}

var god = false, cheated = false, brightMode = false;
var sandbox = false, dbgFreeze = false;
var dbgTaps = 0, dbgTapT = 0;

var DBG_SALT = "eecc2216315973673276b659ac5eb3a7";
var DBG_HASH = "82ff275159b6d48b5c235cb7e1272cdece82524b2e5c2447a8ac5e206065d757";
var DBG_ITER = 300000;
var dbgUnlocked = false, dbgShown = false;

var hexToBytes = h => Uint8Array.from(h.match(/../g).map(b => parseInt(b, 16)));
var bytesToHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");

async function dbgCheck(pass){
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2", salt: hexToBytes(DBG_SALT), iterations: DBG_ITER, hash: "SHA-256"},
    base, 256);
  return bytesToHex(bits) === DBG_HASH;
}

function dbgUnlock(){
  document.getElementById("dbggate").classList.add("gone");
  document.getElementById("dbgbody").classList.remove("gone");
  dbgUnlocked = true;
  dbgInfo();
}

async function dbgSubmit(){
  const input = document.getElementById("dbgpass");
  const err = document.getElementById("dbgerr");
  const btn = document.getElementById("dbgenter");
  if (!crypto?.subtle){ err.textContent = "Нужен https"; return; }
  btn.textContent = "ПРОВЕРКА…";
  try {
    if (await dbgCheck(input.value)){
      input.value = "";
      err.textContent = "";
      dbgUnlock();
    } else {
      err.textContent = "Неверный пароль";
      input.value = "";
    }
  } catch(e){ err.textContent = "Не удалось проверить"; }
  btn.textContent = "ВОЙТИ";
}

function debugOpen(v){
  dbgShown = v;
  document.getElementById("debug").classList.toggle("gone", !v);
  if (v){
    fireHeld = false; mouseHeld = false;
    for (const k in keys) keys[k] = false;
    stickId = null; lookId = null;
    touch.fw = touch.st = 0; knob.style.transform = "";
    setDrone(0);
    document.getElementById("dbggate").classList.toggle("gone", dbgUnlocked);
    document.getElementById("dbgbody").classList.toggle("gone", !dbgUnlocked);
    document.getElementById("dbgerr").textContent = "";
    document.getElementById("dbglvl").value = Math.max(1, level);
    if (dbgUnlocked) dbgInfo();
  } else {
    last = performance.now();
    if (playing && !paused) setDrone(.05);
  }
}
function markCheat(){
  cheated = true;
}

function dbgInfo(){
  document.getElementById("dbginfo").textContent =
    `этаж ${level} · ${biome.name} · врагов ${enemiesLeft} · семя ${seedText()}` +
    (cheated ? " · рекорд не пишется" : "");
}
function dbgRoom(){
  markCheat(); sandbox = true;
  playing = true;
  GRID.fill(1);
  rooms = [];
  RNG = Math.random;
  biome = {id:"rooms", name:"ПОЛИГОН"};
  carveRect(3, 3, MW-4, MH-4);
  themeWalls(1);
  gridVersion++;
  P.x = MW/2; P.y = MH/2; P.hp = 100; P.armor = 100;
  enemies.length = 0; items.length = 0;
  grenades.length = 0; booms.length = 0;
  enemiesLeft = 0;
  LAMPS = [];
  for (let i = 0; i < MW*MH; i++) LMAP[i] = LMAPB[i] = GRID[i] ? 0 : 1;
  levelLight = "lit"; levelL = 1.2; playerLight = 1;
  lightBase = 1; lightNow = 1;
  flickerT = 999; flickerLeft = 0; darkLevel = false;
  updateHUD(); dbgInfo();
}

function dbgSpawn(type){
  markCheat();
  const k = KIND[type], C = curve();
  let x = P.x + Math.cos(P.a)*4, y = P.y + Math.sin(P.a)*4;
  if (solid(x, y, .34)){ const f = freeCell(2); x = f.x; y = f.y; }
  enemies.push({
    type, x, y, hp:k.hp + C.hpBonus(type), alive:true,
    t:Math.random()*10, cd:1, deadT:0,
    speed:Math.min(k.speed + level*.03, k.speed*1.28),
    stuck:0, slideT:0, slideDir:1, seen:false, hurtT:0,
    voiceT:2 + Math.random()*5, breathT:0
  });
  enemiesLeft = enemies.filter(e => e.alive).length;
  updateHUD(); dbgInfo();
}

function dbgItem(kind){
  markCheat();
  items.push({kind, x:P.x + Math.cos(P.a)*1.2, y:P.y + Math.sin(P.a)*1.2, t:0});
  dbgInfo();
}

function dbgJump(n){
  markCheat(); sandbox = false;
  const v = Math.floor(Number(n));
  level = Math.min(1e9, Math.max(1, isFinite(v) ? v : 1)) - 1;
  playing = true;
  nextLevel();
  dbgInfo();
}

function initDebug(){
  const lvlEl = document.getElementById("lvl");
  const tap = () => {
    const now = Date.now();
    if (now - dbgTapT > 1200) dbgTaps = 0;
    dbgTapT = now;
    dbgTaps++;
    if (dbgTaps >= 10){
      dbgTaps = 0;
      debugOpen(true);
    }
  };
  lvlEl.addEventListener("click", tap);
  lvlEl.addEventListener("touchend", e => {
    if (e.cancelable) e.preventDefault();
    tap();
  }, {passive:false});

  onTap(document.getElementById("dbggo"), () => dbgJump(+document.getElementById("dbglvl").value || 1));
  onTap(document.getElementById("dbgguns"), () => {
    markCheat();
    unlocked = GUNS.map(() => true);
    ammo = {bullets:999, shells:999, grenades:99};
    updateHUD(); dbgInfo();
  });
  onTap(document.getElementById("dbgammo"), () => {
    markCheat();
    ammo.bullets += 300; ammo.shells += 60; ammo.grenades += 20;
    updateHUD(); dbgInfo();
  });
  onTap(document.getElementById("dbggod"), () => {
    god = !god; markCheat();
    document.getElementById("dbggod").textContent = `БЕССМЕРТИЕ: ${god ? "ВКЛ" : "ВЫКЛ"}`;
  });
  onTap(document.getElementById("dbglight"), () => {
    brightMode = !brightMode; markCheat();
    lightBase = brightMode ? 2.2 : .9;
    lightNow = lightBase;
    document.getElementById("dbglight").textContent = `СВЕТ: ${brightMode ? "ПОЛНЫЙ" : "ОБЫЧНЫЙ"}`;
  });
  onTap(document.getElementById("dbgkill"), () => {
    markCheat();
    for (const e of enemies) if (e.alive) damageEnemy(e, 99999);
    dbgInfo();
  });
  onTap(document.getElementById("dbgheal"), () => {
    markCheat();
    P.hp = 100; P.armor = 100; updateHUD(); dbgInfo();
  });
  onTap(document.getElementById("dbgroom"), dbgRoom);
  onTap(document.getElementById("dbgfreeze"), () => {
    dbgFreeze = !dbgFreeze; markCheat();
    document.getElementById("dbgfreeze").textContent = `ЗАМОРОЗИТЬ: ${dbgFreeze ? "ВКЛ" : "ВЫКЛ"}`;
  });
  for (const b of document.querySelectorAll(".dbgsp")) onTap(b, () => dbgSpawn(b.dataset.t));
  for (const b of document.querySelectorAll(".dbgit")) onTap(b, () => dbgItem(b.dataset.k));
  onTap(document.getElementById("dbgfps"), () => {
    fpsOn = !fpsOn;
    document.getElementById("fps").classList.toggle("gone", !fpsOn);
    document.getElementById("dbgfps").textContent = `FPS: ${fpsOn ? "ВКЛ" : "ВЫКЛ"}`;
    fpsFrames = 0; fpsAcc = 0; fpsWorst = 0;
  });
  onTap(document.getElementById("dbgenter"), dbgSubmit);
  document.getElementById("dbgpass").addEventListener("keydown", e => {
    if (e.key === "Enter") dbgSubmit();
  });
  onTap(document.getElementById("dbgclose"), () => debugOpen(false));
}

var DEATHS = [
  "ТЕБЕ ПОРВАЛИ&nbsp;ТУЗ",
  "ТЫ&nbsp;200",
  "СТАЛ УДОБРЕНИЕМ МАЛОЙ&nbsp;ТОКМАЧКИ",
  "ОТЧИСЛЕН&nbsp;ПОСМЕРТНО"
];

function gameOver(){
  setDrone(0);
  startMelt();
  faceKey = ""; makeWounds(5); paintFace({mood:"dead", dmg:5, dir:0, blink:false});
  setTimeout(() => faceCv.classList.add("gone"), 1500);
  paused = false;
  pauseBox.classList.add("gone");
  pauseBtn.classList.add("gone");
  saveRecord();
  if (!cheated) clearSave();
  playing = false;
  updateInvUI();
  bossRef = null; portal = null; stopBossIntro();
  document.getElementById("bossbar").classList.add("gone");
  screen.classList.remove("hide");
  screen.classList.add("death");
  const line = DEATHS[Math.floor(Math.random()*DEATHS.length)];
  title.innerHTML = line;
  title.classList.toggle("long", line.replace(/&nbsp;/g, " ").length > 12);
  msg.textContent = `Уровень ${level} · ${biome.name}. Фрагов: ${kills}. Семя подземелья: ${seedShow()}.`;
  startBtn.textContent = "ЕЩЁ РАЗ";
  seedIn.value = "";
  refreshScreen();
  document.exitPointerLock?.();
}

function onTap(el, fn){
  let last = 0;
  const run = e => {
    const now = Date.now();
    if (e.type === "touchend"){
      if (e.cancelable) e.preventDefault();
      last = now;
    } else if (now - last < 700) return;
    try { fn(); } catch(err){ console.error(err); }
  };
  el.addEventListener("click", run);
  el.addEventListener("touchend", run, {passive:false});
}

onTap(startBtn, () => beginRun(null));
onTap(contBtn, () => beginRun(loadGame()));
onTap(pauseBtn, () => { if (!layoutEdit) setPause(true); });
onTap(seedCopy, () => copyText(seedText(), seedCopy));
onTap(seedPaste, () => pasteSeed(seedPaste));
onTap(pauseSeedBtn, () => copyText(seedText(), pauseSeedBtn));
onTap(document.getElementById("resume"), () => setPause(false));
onTap(document.getElementById("quit"), quitToMenu);

var CODE_KEY = {
  KeyW:"w", KeyA:"a", KeyS:"s", KeyD:"d", KeyQ:"q", KeyE:"e", KeyP:"p",
  KeyZ:"z", KeyX:"x", KeyC:"c",
  Digit1:"1", Digit2:"2", Digit3:"3", Digit4:"4",
  Numpad1:"1", Numpad2:"2", Numpad3:"3", Numpad4:"4",
  Space:" ", ArrowUp:"arrowup", ArrowDown:"arrowdown", ArrowLeft:"arrowleft", ArrowRight:"arrowright"
};
function keyOf(e){ return CODE_KEY[e.code] || (e.key || "").toLowerCase(); }

addEventListener("keydown", e => {
  if (e.target && e.target.tagName === "INPUT") return;
  const k = keyOf(e);
  if (playing && (e.key === "Escape" || k === "p")) setPause(!paused);
});
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  mouseHeld = false; fireHeld = false;
});

var mouseHeld = false, fireHeld = false;
addEventListener("keydown", e => {
  if (e.target && e.target.tagName === "INPUT") return;
  const k = keyOf(e);
  keys[k] = true;
  if (k === "1") switchGun(0);
  if (k === "2") switchGun(1);
  if (k === "3") switchGun(2);
  if (k === "4") switchGun(3);
  if (k === "q") switchGun(gun - 1);
  if (k === "e") switchGun(gun + 1);
  if (k === "z") useBuff("rage");
  if (k === "x") useBuff("haste");
  if (k === "c") useBuff("shield");
  if (e.code === "Space") e.preventDefault();
});
addEventListener("keyup", e => { keys[keyOf(e)] = false; });
cv.addEventListener("mousedown", e => {
  if (!playing) return;
  if (cv.requestPointerLock && document.pointerLockElement !== cv){
    cv.requestPointerLock();
  } else {
    mouseHeld = true;
    lastMouseX = e.clientX;
  }
});
addEventListener("mouseup", () => mouseHeld = false);
addEventListener("wheel", e => { if (playing) switchGun(gun + (e.deltaY > 0 ? 1 : -1)); }, {passive:true});
var lastMouseX = 0;
var mouseSkip = 0, mouseAvg = 0;
document.addEventListener("pointerlockchange", () => { mouseSkip = 2; mouseAvg = 0; });
addEventListener("mousemove", e => {
  if (document.pointerLockElement === cv){
    const mx = e.movementX || 0;
    if (mouseSkip > 0){ mouseSkip--; return; }
    const a = Math.abs(mx);
    if (a > 300 || (a > 120 && a > mouseAvg*10 + 60)) return;
    mouseAvg = mouseAvg*.8 + a*.2;
    P.a += mx * .0026 * SET.sensMouse;
    return;
  }
  if (mouseHeld){ P.a += (e.clientX - lastMouseX) * .004 * SET.sensMouse; lastMouseX = e.clientX; }
});

var touch = {fw:0, st:0};
var stick = document.getElementById("stick"), knob = document.getElementById("knob");
var fireBtn = document.getElementById("fire"), swapBtn = document.getElementById("swap");
var stickId = null, lookId = null, lookX = 0;

stick.addEventListener("touchstart", e => { if (layoutEdit) return; stickId = e.changedTouches[0].identifier; e.preventDefault(); }, {passive:false});
addEventListener("touchmove", e => {
  for (const t of e.changedTouches){
    if (t.identifier === stickId){
      const r = stick.getBoundingClientRect();
      let dx = t.clientX - (r.left + r.width/2), dy = t.clientY - (r.top + r.height/2);
      const m = Math.min(1, Math.hypot(dx,dy)/(46 * SET.ctrl.stick.size)), ang = Math.atan2(dy,dx);
      dx = Math.cos(ang)*m; dy = Math.sin(ang)*m;
      knob.style.transform = `translate(${dx*36}px,${dy*36}px)`;
      touch.st = dx; touch.fw = -dy;
    } else if (t.identifier === lookId){
      P.a += (t.clientX - lookX) * .006 * SET.sensTouch;
      lookX = t.clientX;
    }
  }
  if ((stickId !== null || lookId !== null) && e.cancelable) e.preventDefault();
}, {passive:false});
function releaseTouches(e){
  for (const t of e.changedTouches){
    if (t.identifier === stickId){ stickId = null; touch.fw = touch.st = 0; knob.style.transform = ""; }
    if (t.identifier === lookId) lookId = null;
  }
}
addEventListener("touchend", releaseTouches);
addEventListener("touchcancel", releaseTouches);
cv.addEventListener("touchstart", e => {
  const t = e.changedTouches[0];
  if (lookId === null){ lookId = t.identifier; lookX = t.clientX; }
  e.preventDefault();
}, {passive:false});
fireBtn.addEventListener("touchstart", e => { if (layoutEdit) return; fireHeld = true; e.preventDefault(); }, {passive:false});
fireBtn.addEventListener("touchend", e => { fireHeld = false; e.preventDefault(); }, {passive:false});
fireBtn.addEventListener("touchcancel", () => { fireHeld = false; });
swapBtn.addEventListener("touchstart", e => { if (layoutEdit) return; switchGun(gun + 1); e.preventDefault(); }, {passive:false});

var HAS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
var DESKTOP = matchMedia("(pointer:fine)").matches && !HAS_TOUCH;
if (DESKTOP) document.body.classList.add("desktop");

try {
  const fromUrl = parseSeed(location.hash);
  if (fromUrl !== null) seedIn.value = location.hash.replace(/^#/, "").toUpperCase();
} catch(e){}

initDebug();
initSettings();
applyLayoutPrefs();

generateLevel(0);
resize();
updateHUD();
refreshScreen();
requestAnimationFrame(loop);
