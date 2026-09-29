
function saveGame(){
  if (typeof mpActive === "function" && mpActive()) return;
  if (!playing || cheated) return;
  store.set(SAVE_KEY, JSON.stringify({
    v:1, level, kills, gun, seed:runSeed, seedName, cheated,
    hp:Math.round(P.hp), armor:Math.round(P.armor),
    bullets:ammo.bullets, shells:ammo.shells, grenades:ammo.grenades,
    guns:unlocked.reduce((m, v, i) => m | (v ? 1 << i : 0), 0),
    inv:[inv.rage, inv.haste, inv.shield],
    lives, lifeDrops, streak:bestStreak, seedCustom, skill, bossKills, buffDry,
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
  if (typeof mpActive === "function" && mpActive()) return;
  if (cheated) return;
  const r = getRecord();
  const out = {level:num(r.level,0), kills:num(r.kills,0), streak:num(r.streak,0), custom:!!r.custom};
  if (level > out.level || (level === out.level && kills > out.kills)){
    out.level = level; out.kills = kills; out.custom = seedCustom;
  }
  out.streak = Math.max(out.streak, bestStreak);
  store.set(REC_KEY, JSON.stringify(out));
}

var P = {x:2.5, y:2.5, a:0, hp:100, armor:0, hurt:0, pick:0, inv:0, hitDir:0, hitT:0};
var BUFFS = {
  rage:  {name:"ЯРОСТЬ",    time:10, color:"#c8321e"},
  haste: {name:"УСКОРЕНИЕ", time:10, color:"#e0c020"},
  shield:{name:"ЩИТ",       time:3,  color:"#3f9fd0"}
};
var BT = {rage:0, haste:0, shield:0};
var inv = {rage:0, haste:0, shield:0};
var INV_MAX = 3, BUFF_CAP = 25, RAGE_MULT = 1.7, SHIELD_TAKE = .15;
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
var AMMO_SOFT = {bullets:350, shells:55, grenades:25};
var buffDry = 0;
function giveAmmo(kind, n){ ammo[kind] += n; return true; }
function stockFactor(kind){
  if (isBossLevel()) return 1;
  return Math.max(.25, Math.min(1, 1.25 - ammo[kind] / (2 * AMMO_SOFT[kind])));
}
var skill = 0, bossKills = 0, SKILL_CAP = 2, SKILL_DECAY = .94;
var skillFor = n => SKILL_CAP * (1 - Math.pow(SKILL_DECAY, n));
var skillMul = () => 1 + skill;
var supplyT = 0;
function neededAmmo(){
  const need = [["bullets", ammo.bullets / 150], ["shells", ammo.shells / 20]];
  if (unlocked[3]) need.push(["grenades", ammo.grenades / 8]);
  need.sort((a, b) => a[1] - b[1]);
  return need[0][0];
}
function supplyTick(dt){
  if (!bossRef || !bossRef.alive) return;
  supplyT -= dt;
  if (supplyT > 0) return;
  const fin = bossRef.kind === "final";
  supplyT = (fin ? 10 : 18) / Math.sqrt(coopN());
  const onFloor = items.filter(i => !i.dead && i.supply).length;
  if (onFloor >= (fin ? 4 : 3) + coopN() - 1) return;
  for (let t = 0; t < 80; t++){
    const x = 5.5 + Math.random()*24, y = 5.5 + Math.random()*24;
    if (solid(x, y, .4)) continue;
    if (Math.hypot(x - bossRef.x, y - bossRef.y) < 5 || Math.hypot(x - P.x, y - P.y) < 2) continue;
    const kind = neededAmmo();
    items.push({kind, x, y, t:0, supply:true});
    booms.push({x, y, t:.3});
    beep("sine", 660, .25, .12, 990);
    if (!supplyShown){ supplyShown = true; showBanner("ПОДВОЗ", false, "на арене появляются ящики с патронами"); }
    return;
  }
}
var supplyShown = false;
function ammoCount(kind, base){
  const v = base * stockFactor(kind);
  return Math.floor(v) + (Math.random() < v - Math.floor(v) ? 1 : 0);
}
var BUFF_WEIGHTS = {rage:.38, shield:.37, haste:.25};
function randomBuff(){
  let r = Math.random();
  for (const k in BUFF_WEIGHTS){ r -= BUFF_WEIGHTS[k]; if (r <= 0) return k; }
  return "rage";
}
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
  const target = lightSample(P.x, P.y);
  playerLight += (target - playerLight) * Math.min(1, dt*3);
}
var keys = {};

var bossRef = null, introT = 0, shake = 0, portal = null, portalT = 0;
var runTime = 0, finalOutro = null, diplomaShown = false;
var lives = 0, LIVES_MAX = 9, LIFE_DROP = .15, LIFE_DROP_FINAL = .35;
var lifeDrops = 0, LIFE_PITY_BOSS = 4, LIFE_CAP_BEFORE_FINAL = 4;

function lifeChanceFor(e){
  if (e.kind === "final") return LIFE_DROP_FINAL;
  if (level >= FINAL_LEVEL) return LIFE_DROP;
  if (lifeDrops >= LIFE_CAP_BEFORE_FINAL) return 0;
  if (lifeDrops === 0 && Math.floor(level / BOSS_EVERY) >= LIFE_PITY_BOSS) return 1;
  return LIFE_DROP;
}

function updateLivesUI(){
  if (lives > 0){ rbdSound(); rbdLoad(); }
  const el = document.getElementById("lives");
  el.textContent = `♥ ${lives}`;
  el.classList.toggle("gone", !playing || lives <= 0);
}

var reviveT = 0, RBD_SOUNDS = null;

var RBD_BUF = [null, null], rbdLoading = false, rbdSrc = null;
function rbdLoad(){
  if (rbdLoading || typeof AC === "undefined" || !AC) return;
  rbdLoading = true;
  ["assets/sounds/rbdsound1.mp3", "assets/sounds/rbdsound2.mp3"].forEach((u, i) => {
    fetch(u).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).then(buf => { RBD_BUF[i] = buf; })
      .catch(() => { rbdLoading = false; });
  });
}
function rbdPlay(){
  const i = Math.random() < .8 ? 0 : 1;
  rbdLoad();
  if (AC && RBD_BUF[i]){
    try {
      if (AC.state === "suspended") AC.resume();
      if (rbdSrc){ try { rbdSrc.stop(); } catch(e){} }
      const src = AC.createBufferSource(); src.buffer = RBD_BUF[i];
      src.connect(typeof masterGain !== "undefined" && masterGain ? masterGain : AC.destination);
      src.start(); rbdSrc = src;
      return;
    } catch(e){}
  }
  const snd = rbdSound()[i];
  try { snd.pause(); snd.currentTime = 0; snd.volume = Math.max(0, Math.min(1, SET.volume)); snd.play().catch(() => {}); } catch(e){}
}

function rbdSound(){
  if (!RBD_SOUNDS){
    RBD_SOUNDS = ["assets/sounds/rbdsound1.mp3", "assets/sounds/rbdsound2.mp3"].map(src => {
      const a = new Audio(src); a.preload = "auto"; return a;
    });
  }
  return RBD_SOUNDS;
}

var RBD_LEN = 2.5, rbd = null;

function startRevive(){
  lives--;
  P.hp = 1; P.hitT = 0;
  reviveT = RBD_LEN;
  fireHeld = false; mouseHeld = false;
  updateLivesUI();
  rbdPlay();
  setDrone(0);
  document.body.classList.add("rbd");
  const cv2 = document.getElementById("rbdcv");
  const wr = document.getElementById("wrap").getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv2.width = Math.round(wr.width * dpr); cv2.height = Math.round(wr.height * dpr);
  cv2.classList.remove("gone");
  const badge = document.getElementById("lives").getBoundingClientRect();
  const crack = [[32, 19]];
  for (let i = 1; i < 10; i++) crack.push([32 + (Math.random()*2 - 1) * (i % 2 ? 4.5 : 2.5), 19 + i * 3.3]);
  crack[crack.length - 1] = [32, 51];
  const branches = [];
  for (let i = 2; i < 8; i += 2){
    const [x, y] = crack[i], dir = Math.random() < .5 ? -1 : 1, len = 4 + Math.random()*6;
    branches.push({at:i, pts:[[x, y], [x + dir*len*.5, y + 1.5 + Math.random()*2], [x + dir*len, y + 3 + Math.random()*3]]});
  }
  rbd = {t:0, dpr, w:wr.width, h:wr.height, crack, branches, shards:null, snapped:false, ticks:0,
         fromX:(badge.width ? badge.left + badge.width/2 : wr.left + wr.width/2) - wr.left,
         fromY:(badge.height ? badge.top + badge.height/2 : wr.top + wr.height*.8) - wr.top};
}

function crackLen(pts){ let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); return L; }
function crackPart(pts, frac){
  const total = crackLen(pts) * frac, out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++){
    const seg = Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    if (acc + seg >= total){
      const k = (total - acc) / seg;
      out.push([pts[i-1][0] + (pts[i][0]-pts[i-1][0])*k, pts[i-1][1] + (pts[i][1]-pts[i-1][1])*k]);
      return out;
    }
    acc += seg; out.push(pts[i]);
  }
  return out;
}

function drawRevive(dt){
  const R = rbd; if (!R) return;
  R.t += dt;
  const t = R.t, cv2 = document.getElementById("rbdcv"), g = cv2.getContext("2d");
  const W2 = R.w, H2 = R.h;
  g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  g.clearRect(0, 0, W2, H2);
  g.imageSmoothingEnabled = false;
  const vig = g.createRadialGradient(W2/2, H2*.42, Math.min(W2, H2)*.15, W2/2, H2*.42, Math.max(W2, H2)*.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, `rgba(20,0,4,${Math.min(.75, t*1.5)})`);
  g.fillStyle = vig; g.fillRect(0, 0, W2, H2);

  const S = Math.min(W2, H2) * .46, cx = W2/2, cy = H2*.42;
  const T_IN = .5, T_SLOW = 1.35, T_SNAP = 1.5;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.7; return 1 + (c+1)*Math.pow(x-1, 3) + c*Math.pow(x-1, 2); };
  const inK = back(t / T_IN);
  let hx = R.fromX + (cx - R.fromX) * ease(t / T_IN), hy = R.fromY + (cy - R.fromY) * ease(t / T_IN);
  let sc = .1 + .9 * inK;
  if (t > T_IN && t < T_SNAP){
    const q = (t - T_IN) / (T_SNAP - T_IN);
    const amp = 1 + q*q*5;
    hx += (Math.random()*2 - 1) * amp; hy += (Math.random()*2 - 1) * amp;
    sc *= 1 + q * .06;
  }
  const img = ART.life;
  const to = (u, v) => [hx - S*sc/2 + u * S*sc/64, hy - S*sc/2 + v * S*sc/64];

  let frac = 0;
  if (t > T_IN) frac = t < T_SLOW ? .4 * Math.pow((t - T_IN) / (T_SLOW - T_IN), 1.6) : Math.min(1, .4 + .6 * (t - T_SLOW) / (T_SNAP - T_SLOW));
  if (t > T_IN + .1 && t < T_SNAP){
    R.ticks -= dt;
    if (R.ticks <= 0){ R.ticks = t < T_SLOW ? .16 + Math.random()*.12 : .03; noiseBurst(.04, .07, 5200 + Math.random()*2000, 1); }
  }

  if (t < T_SNAP){
    g.save();
    g.shadowColor = "rgba(255,40,70,.8)"; g.shadowBlur = 30 * sc;
    g.drawImage(img, hx - S*sc/2, hy - S*sc/2, S*sc, S*sc);
    g.restore();
    if (frac > 0){
      const part = crackPart(R.crack, frac);
      const line = (pts, wdt, col) => {
        g.beginPath();
        pts.forEach((p, i) => { const [X, Y] = to(p[0], p[1]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
        g.strokeStyle = col; g.lineWidth = wdt; g.lineJoin = "miter"; g.stroke();
      };
      g.save(); g.shadowColor = "#fff"; g.shadowBlur = 14; line(part, Math.max(2, S*sc/64*1.6), "rgba(255,240,240,.95)"); g.restore();
      line(part, Math.max(1, S*sc/64*.6), "#2a0006");
      for (const br of R.branches){
        const need = br.at / (R.crack.length - 1);
        if (frac < need) continue;
        const bf = Math.min(1, (frac - need) / .15);
        line(crackPart(br.pts, bf), Math.max(1, S*sc/64*.7), "rgba(255,230,230,.85)");
      }
    }
  } else {
    if (!R.snapped){
      R.snapped = true;
      R.snapX = hx; R.snapY = hy; R.snapS = S*sc;
      R.shards = [];
      const palette = ["#e02846", "#b0142a", "#ff6a80", "#ffd6dc", "#8e0f22"];
      for (let i = 0; i < 26; i++){
        const p = R.crack[(Math.random() * R.crack.length) | 0];
        const a = -Math.PI/2 + (Math.random()*2 - 1) * 1.6;
        const sp = 180 + Math.random()*420;
        R.shards.push({u:p[0] + (Math.random()*2-1)*3, v:p[1] + (Math.random()*2-1)*2,
          vx:Math.cos(a)*sp*(p[0] < 32 ? -1 : 1)*(Math.random() < .5 ? 1 : -.4), vy:Math.sin(a)*sp,
          rot:Math.random()*6.283, vr:(Math.random()*2-1)*14, size:2 + Math.random()*4.5, col:palette[(Math.random()*palette.length)|0]});
      }
      shake = Math.max(shake, .8);
      beep("sawtooth", 60, .8, .3, 30);
      noiseBurst(.5, .32, 6400, .8);
      noiseBurst(.25, .25, 1800, .8);
      document.getElementById("c").animate([{transform:"scale(1.13)"}, {transform:"scale(1)"}], {duration:420, easing:"cubic-bezier(.2,.8,.3,1)"});
      document.getElementById("wrap").animate([
        {transform:"translate(0,0)"}, {transform:"translate(-9px,6px)"}, {transform:"translate(8px,-7px)"},
        {transform:"translate(-6px,-4px)"}, {transform:"translate(5px,5px)"}, {transform:"translate(-2px,1px)"}, {transform:"translate(0,0)"}
      ], {duration:420, easing:"linear"});
    }
    const k = t - T_SNAP, gr = 1400;
    const ox = R.snapX - R.snapS/2, oy = R.snapY - R.snapS/2, px = R.snapS/64;
    const fade = Math.max(0, 1 - k / (RBD_LEN - T_SNAP));
    const halfPath = (left) => {
      g.beginPath();
      g.moveTo(ox + (left ? 0 : 64) * px, oy);
      R.crack.forEach(p => g.lineTo(ox + p[0]*px, oy + p[1]*px));
      g.lineTo(ox + R.crack[R.crack.length-1][0]*px, oy + 64*px);
      g.lineTo(ox + (left ? 0 : 64) * px, oy + 64*px);
      g.closePath();
    };
    for (const left of [true, false]){
      const dir = left ? -1 : 1;
      g.save();
      g.globalAlpha = fade;
      g.translate(R.snapX + dir * (60*k + 90*k*k), R.snapY + (-120*k + gr*.5*k*k));
      g.rotate(dir * (1.4*k + .8*k*k));
      g.translate(-R.snapX, -R.snapY);
      halfPath(left); g.clip();
      g.drawImage(img, ox, oy, R.snapS, R.snapS);
      g.restore();
    }
    for (const sh of R.shards){
      const X = ox + sh.u*px + sh.vx*k, Y = oy + sh.v*px + sh.vy*k + gr*.5*k*k;
      g.save();
      g.globalAlpha = fade;
      g.translate(X, Y); g.rotate(sh.rot + sh.vr*k);
      g.fillStyle = sh.col;
      const z = sh.size * px * .8;
      g.beginPath(); g.moveTo(-z, -z*.6); g.lineTo(z, -z*.2); g.lineTo(-z*.2, z); g.closePath(); g.fill();
      g.restore();
    }
    if (k < .25){ g.fillStyle = `rgba(255,255,255,${.75 * (1 - k/.25)})`; g.fillRect(0, 0, W2, H2); }
  }
}

function finishRevive(){
  reviveT = 0; rbd = null;
  document.body.classList.remove("rbd");
  const cv2 = document.getElementById("rbdcv");
  cv2.getContext("2d").clearRect(0, 0, cv2.width, cv2.height);
  cv2.classList.add("gone");
  if (playing) setDrone(.05);
  revivePlayer();
}

function revivePlayer(){
  P.hp = 75; P.inv = 2.2; P.hitT = 0;
  for (const s of shots) if (Math.hypot(s.x - P.x, s.y - P.y) < 5) s.dead = true;
  for (const e of enemies){
    if (!e.alive || e.boss) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d < 3.2 && d > .01){
      let k = (3.2 - d) / d;
      for (let t = 0; t < 4; t++, k *= .5){
        if (!solid(e.x + dx*k, e.y + dy*k, .34)){ e.x += dx*k; e.y += dy*k; break; }
      }
      e.cd = Math.max(e.cd, 1.2);
    }
  }
  for (let i = 0; i < 8; i++) booms.push({x:P.x + Math.cos(i*.785)*1.4, y:P.y + Math.sin(i*.785)*1.4, t:.1});
  boomLight = 1; boomX = P.x; boomY = P.y;
  shake = Math.max(shake, 1);
  beep("sine", 330, .8, .2, 990);
  setTimeout(() => beep("sine", 660, .6, .16, 1320), 180);
  showBanner("ВОЗВРАЩЕНИЕ", true, lives > 0 ? `жизней в запасе: ${lives}` : "это была последняя");
  updateLivesUI();
  updateHUD();
}
var DIPLOMA_KEY = "terplandia3d.diploma";

function showDiploma(){
  const m = Math.floor(runTime / 60), h = Math.floor(m / 60);
  document.getElementById("dip_kills").textContent = kills;
  document.getElementById("dip_time").textContent = h ? `${h} ч ${m % 60} мин` : `${m} мин`;
  document.getElementById("dip_seed").textContent = seedText() + (seedCustom ? " · SEEDCHANGE" : "");
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
  const hp = fin ? T.hp : Math.round(T.hp * bossHpMul());
  enemies = [];
  items = [];
  bossRef = {
    type:"boss", boss:true, kind:T.id, name:T.name, tint:T.tint, scale:T.scale, rad:.55, art:"boss_" + T.id,
    x:17.5, y:9.5, hp, maxHp:hp, alive:true, t:0, cd:2, atk:3.5, deadT:0,
    speed:T.speed * (1 + .3 * t150()), dmg:T.dmg, strafe:1,
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
  bossKills++;
  const before = skill;
  skill = skillFor(bossKills);
  const gain = (skill - before) * 100;
  setTimeout(() => {
    if (playing) showBanner("ПОВЫШЕНИЕ КВАЛИФИКАЦИИ", true,
      `урон оружия +${gain >= 1 ? Math.round(gain) : gain.toFixed(1)}% · всего +${Math.round(skill*100)}%`);
  }, 2600);
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
  const nP = coopN();
  drop("bullets", 4 * nP); drop("shells", 3 * nP); drop("grenades", 2 * nP);
  drop("medkit", 2 * nP); drop("armor", nP);
  for (let i = 0; i < nP; i++) drop(randomBuff(), 1);
  if (Math.random() < lifeChanceFor(e)){ drop("life", 1); lifeDrops++; }
  for (let i = 1; i < nP; i++) if (Math.random() < (e.kind === "final" ? .35 : .15)) drop("life", 1);
  for (const m of enemies) if (m.alive && m.minion){ m.alive = false; m.deadT = 0; }
  showBanner(`${e.name} ПОВЕРЖЕН${e.name.endsWith("А") ? "А" : ""}`, true, "забери награду");

  beep("sawtooth", 90, 1.4, .3, 30);
  noiseBurst(1.2, .3, 500, .8);
  shake = Math.max(shake, 1);
}

function playBossIntro(name, fin){
  const el = document.getElementById("bossintro");
  const img = document.getElementById("bossimg");
  const want = fin ? (CHAR.boss_final.loaded ? CHAR_FILES.boss_final : palPortraitURL()) : "assets/ui/boss-intro.jpg";
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
      speed:enemySpeed(k),
      stuck:0, slideT:0, slideDir:1, seen:false, hurtT:0,
      voiceT:2 + Math.random()*5, breathT:0, seeT:0, sees:false
    });
  }
  if (mpIsHost()) mpScaleLevel(C);
  enemiesLeft = enemies.length;

  let gunHint = "";
  if (mpIsClient()) gunHint = mpClientGunLamp();
  else for (let n=1; n<GUNS.length; n++){
    const need = mpIsHost() ? mpGunNeed(n) : (unlocked[n] ? 0 : 1);
    if (level < GUN_AT[n] || need <= 0) continue;
    const [open8, open4] = openCells();
    const far = c => Math.hypot((c % MW) + .5 - P.x, ((c / MW) | 0) + .5 - P.y) >= 4;
    const pool = open8.filter(far).length ? open8.filter(far) : open4.filter(far);
    let gx, gy;
    if (pool.length){ const c = pool[(Math.random()*pool.length) | 0]; gx = c % MW; gy = (c / MW) | 0; }
    else { const g = freeCell(4); gx = g.x | 0; gy = g.y | 0; }
    items.push({kind:"gun" + n, x:gx + .5, y:gy + .5, t:0});
    for (let k = 1; k < need; k++){ const q = mpGunSpot(gx + .5, gy + .5, k, need); items.push({kind:"gun" + n, x:q.x, y:q.y, t:0}); }
    if (mpIsHost()) MP.lvlGun = [gx, gy, n];
    LAMPS = LAMPS.filter(L => Math.hypot(L.x - gx, L.y - gy) >= 5);
    const gl = addLamp(gx, gy, 4.5, .85, "flicker", 0);
    if (gl) gl.gun = "gun" + n;
    composeLight();
    gunHint = `НА ЭТАЖЕ: ${GUNS[n].name}`;
    break;
  }
  if (level >= 5 && !isBossLevel()){
    let spawned = 0;
    for (let r = 0; r < coopN(); r++){
      if (Math.random() < .4 || (r === 0 && buffDry >= 3)){
        const b = freeCell(5);
        items.push({kind:randomBuff(), x:b.x, y:b.y, t:0});
        spawned++;
      }
    }
    buffDry = spawned ? 0 : buffDry + 1;
  }
  for (let r = 0; r < coopN(); r++) if (level >= 8 && unlocked[3] && Math.random() < .5 * stockFactor("grenades")){
    const gr = freeCell(4);
    items.push({kind:"grenades", x:gr.x, y:gr.y, t:0});
  }

  const drops = [
    ["medkit",  C.medkits],
    ["bullets", ammoCount("bullets", C.bullets)],
    ["shells",  ammoCount("shells", C.shells)],
    ["armor",   level % 2 === 0 ? 1 : 0]
  ];
  for (const [kind, count0] of drops){
    const count = Math.round(count0 * coopK("items"));
    for (let i=0;i<count;i++){
      const p = freeCell(3);
      items.push({kind, x:p.x, y:p.y, t:Math.random()*6});
    }
  }
  stopBossIntro();
  finalOutro = null;
  parts.length = 0;
  beams.length = 0; P.stunT = 0;
  P.slowT = 0;
  bossRef = null; portal = null; portalT = isFinalLevel() ? 3.4 : 1.6;
  supplyT = 9; supplyShown = false;
  if (isBossLevel()) spawnBoss();
  beep("sine", 300, .5, .12, 600);
  if (C.surge){
    setDrone(0);
    setTimeout(() => { beep("sine", 44, 1.6, .3, 24); noiseBurst(1.2, .18, 260, .8); setDrone(.05); }, 900);
  }
  if (bossRef && bossRef.kind === "final"){
    showBanner("ФИНАЛЬНЫЙ БОСС", true, `${bossRef.name} · ${biome.name}`);
    playBossIntro(bossRef.name, true);
  } else if (bossRef){
    showBanner("БОЙ С БОССОМ", true, `${bossRef.name} · УРОВЕНЬ ${level}`);
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
  updateLivesUI();
  document.getElementById("seedtag").classList.toggle("gone", !seedCustom);
  if (mpActive()) mpOnLevel();
  saveGame();
}

function reset(seed){
  runSeed = seed != null ? (seed >>> 0) : (Math.random()*0xFFFFFFFF) >>> 0;
  P.hp = 100; P.armor = 0; P.inv = 0; P.hitT = 0;
  ammo = {bullets:45, shells:10, grenades:0};
  unlocked = [true, false, false, false];
  gun = 0; kills = 0; level = 0;
  for (const k in BT){ BT[k] = 0; inv[k] = 0; }
  runTime = 0; lives = 0; lifeDrops = 0; bestStreak = 0; skill = 0; bossKills = 0; buffDry = 0;
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
  HUD.hp.textContent = Math.max(0, Math.ceil(P.hp));
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
