var MP = null;
var mpTarget = null, mpSaved = null;
var mpFlows = new Map();
var mpEnt = new Map();
var mpRemote = [];
var mpItemT = new Map();

function mpActive(){ return !!(MP && MP.active); }
function mpIsHost(){ return !!(MP && MP.active && MP.role === "host"); }
function mpIsClient(){ return !!(MP && MP.active && MP.role === "client"); }
function mpPeers(){
  if (!coop || coop.role !== "host") return [];
  const out = [];
  for (const p of coop.peers.values()) if (p.joined && p.gs) out.push(p);
  return out;
}
function coopN(){ return mpIsHost() ? 1 + mpPeers().length : 1; }
var COOP_CURVE = {count:.25, hp:.08, boss:.55, mobDrop:.25, items:.6};
var COOP_ENEMY_CAP = 60;
function coopK(k){ return 1 + COOP_CURVE[k] * (coopN() - 1); }

function mpTargets(){
  const t = [];
  if (!P.dead) t.push({x:P.x, y:P.y, peer:null});
  for (const p of mpPeers()) if (p.gs.alive) t.push({x:p.gs.x, y:p.gs.y, peer:p});
  return t;
}

function mpSwapFor(e){
  let best = null, bd = P.dead ? 1e9 : Math.hypot(P.x - e.x, P.y - e.y);
  for (const p of mpPeers()){
    if (!p.gs.alive) continue;
    const d = Math.hypot(p.gs.x - e.x, p.gs.y - e.y);
    if (d < bd){ bd = d; best = p; }
  }
  if (!best) return;
  mpSaved = {x:P.x, y:P.y, flow:FLOW};
  P.x = best.gs.x; P.y = best.gs.y;
  const f = mpFlows.get(best.id);
  if (f) FLOW = f;
  mpTarget = best;
}
function mpRestore(){
  if (!mpTarget) return;
  P.x = mpSaved.x; P.y = mpSaved.y; FLOW = mpSaved.flow;
  mpTarget = null; mpSaved = null;
}
function mpBuildFlows(){
  const kx = P.x, ky = P.y, kf = FLOW;
  for (const p of mpPeers()){
    let f = mpFlows.get(p.id);
    if (!f){ f = new Int32Array(MW*MH); mpFlows.set(p.id, f); }
    P.x = p.gs.x; P.y = p.gs.y; FLOW = f;
    buildFlow();
  }
  P.x = kx; P.y = ky; FLOW = kf;
}

function mpHurt(peer, amount, sx, sy){
  coopSend(peer.ch, {t:"hurt", a:Math.round(amount*10)/10, x:+sx.toFixed(2), y:+sy.toFixed(2)});
}
function mpEffect(kind, val){
  if (!mpTarget) return false;
  coopSend(mpTarget.ch, {t:"fx", k:kind, v:val});
  return true;
}

function mpRemotePickups(){
  for (const it of items){
    if (it.dead) continue;
    for (const p of mpPeers()){
      if (!p.gs.alive) continue;
      const dx = it.x - p.gs.x, dy = it.y - p.gs.y;
      if (dx*dx + dy*dy > (PR + .38)*(PR + .38)) continue;
      if (it.kind === "medkit" && p.gs.hp >= 100) continue;
      const gn = GUN_OF[it.kind];
      if (gn !== undefined && (((p.gs.u || 0) >> gn) & 1)) continue;
      it.dead = true;
      coopSend(p.ch, {t:"give", k:it.kind});
      if (gn !== undefined){ p.gs.u = (p.gs.u || 0) | (1 << gn); mpGunLampOff(it.kind, it); }
      break;
    }
  }
}
function mpNearPlayer(x, y, r){
  for (const p of mpPeers()) if (p.gs.alive && Math.hypot(p.gs.x - x, p.gs.y - y) < r) return true;
  return false;
}

function mpScaleLevel(C){
  const n = coopN();
  if (n <= 1) return;
  const extra = Math.max(0, Math.min(Math.round(C.count * COOP_CURVE.count * (n - 1)), COOP_ENEMY_CAP - enemies.length));
  for (let i = 0; i < extra; i++){
    const src = enemies[(Math.random() * enemies.length) | 0];
    if (!src) break;
    const p = freeCell(8);
    enemies.push(Object.assign({}, src, {x:p.x, y:p.y, id:0, seen:false, t:Math.random()*10}));
  }
  const hm = coopK("hp");
  for (const e of enemies) e.hp = Math.round(e.hp * hm);
}

function mpOnLevel(){
  if (P.dead){ P.dead = false; P.hp = Math.max(P.hp, 50); updateHUD(); }
  if (mpIsHost()){
    const n = coopN();
    if (bossRef && n > 1){ bossRef.maxHp = Math.round(bossRef.maxHp * coopK("boss")); bossRef.hp = bossRef.maxHp; }
    MP.nid = 0;
    if (MP.started) for (const p of mpPeers()){ p.gs.alive = true; coopSend(p.ch, {t:"lvl", L:level, g:MP.lvlGun || 0}); }
    MP.lvlGun = null;
  } else if (mpIsClient()){
    enemies = []; items = []; shots = []; grenades.length = 0; bossRef = null; portal = null;
    beams.length = 0; mpEnt.clear();
  }
}

function hitscanAt(ox, oy, pa, offset, dmg, gi, Wc, Hc, plane, wallD){
  const a = pa + offset;
  const rx = Math.cos(a), ry = Math.sin(a);
  const dirX = Math.cos(pa), dirY = Math.sin(pa);
  const planeX = -dirY*plane, planeY = dirX*plane;
  const invDet = 1 / (planeX*dirY - dirX*planeY);
  const aimX = (Wc/2) * (1 + Math.tan(offset) / plane);
  let best = null, bestT = 1e9;
  for (const e of enemies){
    if (!e.alive) continue;
    const dx = e.x - ox, dy = e.y - oy;
    const t = dx*rx + dy*ry;
    if (t <= .05 || t > wallD) continue;
    const ty = invDet*(-planeY*dx + planeX*dy);
    if (ty <= .15) continue;
    const tx = invDet*(dirY*dx - dirX*dy);
    const screenX = (Wc/2) * (1 + tx/ty);
    const half = Math.abs(Hc/ty) * (e.scale || KIND[e.type].scale) * .48;
    if (Math.abs(screenX - aimX) > half) continue;
    if (t < bestT){ bestT = t; best = e; }
  }
  if (!best) return false;
  const m = falloff(GUNS[gi], bestT);
  if (m <= 0) return false;
  damageEnemy(best, dmg * m);
  return true;
}

function mpSnap(){
  const E = [];
  for (const e of enemies){
    if (!e.id) e.id = ++MP.nid;
    if (!e.alive && (e.paper || e.deadT > 25)) continue;
    const fl = (e.alive ? 1 : 0) | (e.hurtT > 0 ? 2 : 0) | (e.paper ? 4 : 0);
    const bx = e.boss ? {k:e.kind, n:e.name, h:Math.ceil(e.hp), m:e.maxHp, s:e.scale, a:e.art, ti:e.tint, ph:e.phase || 0,
      bl:e.blink ? +blinkAlpha(e).toFixed(2) : 1, ch:e.charge > 0 ? 1 : 0,
      la:e.laser && e.laser.t < e.laser.aimT ? +(e.laser.t / e.laser.aimT).toFixed(2) : 0} : 0;
    E.push([e.id, e.type, +e.x.toFixed(2), +e.y.toFixed(2), fl, +e.deadT.toFixed(2), bx]);
  }
  const I = [];
  for (const it of items){ if (it.dead) continue; if (!it.id) it.id = ++MP.nid; I.push([it.id, it.kind, +it.x.toFixed(2), +it.y.toFixed(2)]); }
  const now = performance.now();
  const PL = [[0, +P.x.toFixed(2), +P.y.toFixed(2), +P.a.toFixed(2), P.dead ? 0 : 1, gun, Math.min(999, Math.round(now - (MP.hostFireT || 0))), Math.round(P.hp)]];
  for (const p of mpPeers()) PL.push([p.slot, +p.gs.x.toFixed(2), +p.gs.y.toFixed(2), +p.gs.a.toFixed(2), p.gs.alive ? 1 : 0,
                                      p.gs.gun | 0, Math.min(999, Math.round(now - (p.gs.fireT || 0))), Math.round(p.gs.hp || 0)]);
  return {t:"snap", q:++MP.seq, L:level, left:enemiesLeft, E, I, PL,
    S:shots.map(b => [+b.x.toFixed(2), +b.y.toFixed(2), +b.vx.toFixed(2), +b.vy.toFixed(2), b.big ? 1 : 0]),
    G:grenades.map(g => [+g.x.toFixed(2), +g.y.toFixed(2), +g.vx.toFixed(2), +g.vy.toFixed(2)]),
    B:booms.map(b => [+b.x.toFixed(2), +b.y.toFixed(2), +b.t.toFixed(2)]),
    BM:beams.map(b => [b.owner.id || 0, +b.ang.toFixed(3), +b.t.toFixed(2), b.aimT, b.fireT, b.kind === "eyes" ? 0 : 1, +b.dP.toFixed(2)]),
    po:portal ? [+portal.x.toFixed(2), +portal.y.toFixed(2), +portal.t.toFixed(2)] : 0};
}

function mpApplySnap(m){
  if (m.L !== level) return;
  if (typeof m.q === "number"){ if (m.q <= (MP.lastQ || 0)) return; MP.lastQ = m.q; }
  const arr = [], seen = new Set();
  for (const r of m.E){
    let e = mpEnt.get(r[0]);
    if (!e){ e = {id:r[0], type:r[1], x:r[2], y:r[3], t:Math.random()*10, hurtT:0, deadT:0, seen:true}; mpEnt.set(r[0], e); }
    e._tx = r[2]; e._ty = r[3];
    e.alive = !!(r[4] & 1); e.hurtT = (r[4] & 2) ? .1 : 0; e.paper = !!(r[4] & 4); e.deadT = r[5];
    if (e.paper && !e.scale) e.scale = .55;
    if (r[6]){
      const b = r[6];
      Object.assign(e, {boss:true, kind:b.k, name:b.n, hp:b.h, maxHp:b.m, scale:b.s, art:b.a, tint:b.ti, phase:b.ph,
                        blinkA:b.bl, charge:b.ch ? .5 : 0, laserA:b.la});
    }
    seen.add(r[0]); arr.push(e);
  }
  for (const id of [...mpEnt.keys()]) if (!seen.has(id)) mpEnt.delete(id);
  enemies = arr;
  bossRef = arr.find(e => e.boss && e.alive) || null;
  shots = m.S.map(r => ({x:r[0], y:r[1], vx:r[2], vy:r[3], big:!!r[4], t:0}));
  grenades.length = 0; for (const r of m.G) grenades.push({x:r[0], y:r[1], vx:r[2], vy:r[3], t:0});
  items = m.I.map(r => { const t = mpItemT.get(r[0]) || Math.random()*6; mpItemT.set(r[0], t); return {id:r[0], kind:r[1], x:r[2], y:r[3], t}; });
  booms = m.B.map(r => ({x:r[0], y:r[1], t:r[2]}));
  beams.length = 0;
  for (const r of m.BM){
    const own = mpEnt.get(r[0]);
    if (own) beams.push({owner:own, ang:r[1], t:r[2], aimT:r[3], fireT:r[4], kind:r[5] ? "sweep" : "eyes", dP:r[6]});
  }
  mpRemote = m.PL.filter(p => p[0] !== coop.slot);
  const nowFx = performance.now();
  for (const p of mpRemote){
    if (p[4] && typeof p[6] === "number" && p[6] < 60 && nowFx - (mpLastFx[p[0]] || 0) > 70){
      mpLastFx[p[0]] = nowFx; mpShotFx(p[0], p[1], p[2], p[3], p[5] | 0);
    }
  }
  portal = m.po ? {x:m.po[0], y:m.po[1], t:m.po[2]} : null;
  if (enemiesLeft !== m.left){ enemiesLeft = m.left; updateHUD(); }
}

function mpClientTick(dt){
  const k = Math.min(1, dt * 12);
  for (const e of enemies){
    if (e._tx === undefined) continue;
    e.x += (e._tx - e.x) * k; e.y += (e._ty - e.y) * k;
    e.t += dt;
    if (!e.alive) e.deadT += dt;
  }
  for (const b of shots){ b.x += b.vx*dt; b.y += b.vy*dt; b.t += dt; if (cell(b.x, b.y) || solid(b.x, b.y, .1)){ b.dead = true; shotPop(b); } }
  if (shots.some(b => b.dead)) shots = shots.filter(b => !b.dead);
  for (const g of grenades){ g.x += g.vx*dt; g.y += g.vy*dt; }
  for (const b of beams) b.t += dt;
  for (const it of items) it.t += dt;
  if (portal) portal.t += dt;
}

function mpTick(dt){
  if (!coop || coop.closed){ mpEnd("Связь с комнатой потеряна."); return; }
  mpSpecStep();
  for (const f of mpFlashes) f.t += dt;
  while (mpFlashes.length && mpFlashes[0].t > .09) mpFlashes.shift();
  MP.pingT = (MP.pingT || 0) - dt;
  if (MP.pingT <= 0){ MP.pingT = .5; mpPingUpdate(); }
  MP.sendT -= dt;
  if (mpIsHost()){
    mpRecordHist();
    MP.flowT -= dt;
    if (MP.flowT <= 0){ MP.flowT = .3; mpBuildFlows(); }
    if (MP.sendT <= 0){
      MP.sendT = 1/20;
      const snap = JSON.stringify(mpSnap());
      for (const p of mpPeers()){
        if (p.type === "через ретранслятор" && (MP.seq & 1)) continue;
        const c = p.fch && p.fch.readyState === "open" ? p.fch : p.ch;
        if (c && c.readyState === "open" && c.bufferedAmount < 262144) try { c.send(snap); } catch(e){}
      }
    }
  } else if (MP.sendT <= 0 && coop.host){
    MP.sendT = 1/20;
    coopSendFast(coop.host, {t:"st", q:++MP.seq, x:+P.x.toFixed(2), y:+P.y.toFixed(2), a:+P.a.toFixed(3), g:gun, al:P.dead ? 0 : 1,
                            u:unlocked.reduce((m, v, i) => m | (v ? 1 << i : 0), 0),
                            hp:Math.round(P.hp), W, H, pl:+CAM_PLANE.toFixed(3)});
  }
}

function mpFire(offset, dmg){
  if (coop && coop.host) coopSend(coop.host.ch, {t:"fire", x:+P.x.toFixed(2), y:+P.y.toFixed(2), a:+P.a.toFixed(4),
    o:+offset.toFixed(4), d:+dmg.toFixed(2), g:gun, W, H, pl:+CAM_PLANE.toFixed(3)});
}

function mpDie(){
  P.dead = true; P.hp = 0; updateHUD();
  P.hurt = 0; P.hitT = 0; shake = 0;
  fireHeld = false; mouseHeld = false;
  showBanner("ТЫ ПАЛ", true, "вернёшься на следующем этаже, если кто-то дойдёт");
  if (mpIsClient() && coop.host) coopSend(coop.host.ch, {t:"dead"});
  if (mpIsHost()) mpCheckAllDead();
}
function mpCheckAllDead(){
  if (!P.dead) return;
  for (const p of mpPeers()) if (p.gs.alive) return;
  for (const p of mpPeers()) coopSend(p.ch, {t:"over"});
  mpEnd(null); P.hp = 0; gameOver();
}

function applyGive(k){
  if (k === "medkit") P.hp = Math.min(100, P.hp + 22);
  else if (k === "armor") P.armor = Math.min(100, P.armor + 30);
  else if (k === "bullets") giveAmmo("bullets", curve().bulletAmt);
  else if (k === "shells") giveAmmo("shells", curve().shellAmt);
  else if (k === "grenades") giveAmmo("grenades", 4);
  else if (k === "life"){ if (lives < LIVES_MAX){ lives++; updateLivesUI(); showBanner("ВТОРАЯ ЖИЗНЬ", true, `жизней в запасе: ${lives}`); } }
  else if (GUN_OF[k] !== undefined){
    const n = GUN_OF[k]; unlocked[n] = true;
    if (wpnSwitch === -1){ wpnSwitch = n; wpnSeq = null; }
    if (n === 1) ammo.shells += 8; if (n === 2) ammo.bullets += 30; if (n === 3) giveAmmo("grenades", 8);
    showBanner(`${GUNS[n].name} НАЙДЕН`, true);
  } else if (BUFFS[k]){
    if (inv[k] < INV_MAX){ inv[k]++; showBanner(`${BUFFS[k].name} В ЗАПАСЕ`, true); }
    else { BT[k] = Math.min(BUFF_CAP, BT[k] + BUFFS[k].time); buffShownKey = ""; }
    updateInvUI();
  }
  P.pick = .8; beep("sine", 880, .12, .12, 1400);
  updateHUD();
}

function mpHostMsg(s, peer, m){
  if (!mpIsHost()) return;
  if (m.t === "st"){
    const g = peer.gs || (peer.gs = {alive:true});
    if (typeof m.q === "number"){ if (m.q <= (g.lastQ || 0)) return; g.lastQ = m.q; }
    if (typeof m.x === "number" && typeof m.y === "number" && !solid(m.x, m.y, .05)){ g.x = m.x; g.y = m.y; }
    if (g.x === undefined){ g.x = P.x; g.y = P.y; }
    g.a = +m.a || 0; g.gun = m.g | 0; g.hp = +m.hp || 0; g.u = m.u | 0;
    g.W = Math.max(80, Math.min(640, m.W | 0)); g.H = Math.max(60, Math.min(1400, m.H | 0)); g.pl = Math.max(.3, Math.min(2, +m.pl || .66));
    if (m.al && !g.alive && g.hp > 0) g.alive = true;
  } else if (m.t === "fire" && peer.gs && peer.gs.alive){
    if (typeof m.x === "number" && typeof m.y === "number" && !solid(m.x, m.y, .05)){ peer.gs.x = m.x; peer.gs.y = m.y; }
    const gi = Math.max(0, Math.min(GUNS.length - 1, m.g | 0));
    const dmg = Math.max(0, Math.min(400, +m.d || 0));
    const off = Math.max(-.3, Math.min(.3, +m.o || 0));
    const a = +m.a || 0;
    const nf = performance.now();
    const saved = mpRewind(nf - Math.min(400, (peer.ping || 80) / 2 + 100));
    if (nf - (mpLastFx[peer.slot] || 0) > 70){ mpLastFx[peer.slot] = nf; peer.gs.fireT = nf; mpShotFx(peer.slot, peer.gs.x, peer.gs.y, a, gi); }
    hitscanAt(peer.gs.x, peer.gs.y, a, off, dmg, gi, peer.gs.W || 206, peer.gs.H || 430, peer.gs.pl || .66,
              rayLen(peer.gs.x, peer.gs.y, a + off, 40));
    for (const [e, x, y] of saved){ e.x = x; e.y = y; }
  } else if (m.t === "gren" && peer.gs && peer.gs.alive){
    const a = +m.a || 0, x = peer.gs.x, y = peer.gs.y;
    peer.gs.fireT = performance.now(); mpShotFx(peer.slot, x, y, a, 3);
    grenades.push({x:x + Math.cos(a)*.4, y:y + Math.sin(a)*.4, vx:Math.cos(a)*7, vy:Math.sin(a)*7, t:0, sx:x, sy:y});
  } else if (m.t === "dead"){
    if (peer.gs) peer.gs.alive = false;
    mpCheckAllDead();
  }
}

function mpClientMsg(s, m){
  if (m.t === "start"){
    if (typeof m.seed !== "number") return;
    mpStartRun("client", m.seed);
  } else if (!mpIsClient()) return;
  if (m.t === "snap") mpApplySnap(m);
  else if (m.t === "lvl" && Number.isFinite(m.L)){
    mpLvlGun = Array.isArray(m.g) && m.g.length === 3 ? m.g.map(v => v | 0) : null;
    level = Math.max(0, (m.L | 0) - 1); nextLevel(); mpLvlGun = null;
  }
  else if (m.t === "lamp" && typeof m.k === "string"){
    const gl = LAMPS.find(L => L.gun === m.k);
    if (gl){ gl.state = "off"; gl.val = 0; gl.gun = null; composeLight(); }
  }
  else if (m.t === "hurt"){ damagePlayer(Math.max(0, Math.min(500, +m.a || 0)), +m.x || P.x, +m.y || P.y); }
  else if (m.t === "give" && typeof m.k === "string") applyGive(m.k);
  else if (m.t === "fx"){
    if (m.k === "slow") P.slowT = Math.max(P.slowT || 0, Math.min(3, +m.v || 0));
    if (m.k === "stun"){ P.stunT = Math.min(3, +m.v || 0); P.slowT = Math.max(P.slowT || 0, P.stunT); showBanner("ПОДПИСАНО", true, "полторы секунды без стрельбы"); }
  }
  else if (m.t === "over"){ mpEnd(null); P.hp = 0; gameOver(); }
  else if (m.t === "end"){ mpEnd("Хост закончил игру."); }
}

function mpStartRun(role, seed){
  MP = {active:true, role, sendT:0, flowT:0, nid:0, started:false, seq:0, lastQ:0};
  document.getElementById("coop").classList.add("gone");
  const si = document.getElementById("seedin");
  si.value = (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
  coopStarting = true;
  try { beginRun(null); } finally { coopStarting = false; }
  si.value = ""; seedCustom = false;
  document.getElementById("seedtag").classList.add("gone");
  P.dead = false;
  if (role === "host"){
    MP.started = true;
    for (const p of mpPeers()){ p.gs.alive = true; coopSend(p.ch, {t:"start", seed:runSeed}); }
  }
}

function mpHostStart(){
  if (!coop || coop.role !== "host") return;
  for (const p of coop.peers.values()) if (p.joined) p.gs = {x:0, y:0, a:0, alive:true, hp:100, W:206, H:430, pl:.66};
  const seed = (Math.random() * 4294967296) >>> 0;
  mpStartRun("host", seed);
}

function mpEnd(msg){
  if (!MP) return;
  const wasClient = MP.role === "client";
  MP = null; mpTarget = null; mpRemote = []; mpEnt.clear(); P.dead = false; mpHideTags(); specGun = -1; specHp = -1;
  document.body.classList.remove("spectating");
  document.getElementById("spectag").classList.add("gone"); document.getElementById("mpping").classList.add("gone");
  if (msg && playing){ quitToMenu(); showBanner(msg, true); }
  else if (msg && wasClient){ showBanner(msg, true); }
}

function mpQuit(){
  if (mpIsHost()) for (const p of mpPeers()) coopSend(p.ch, {t:"end"});
  MP = null; mpTarget = null; mpRemote = []; mpEnt.clear(); P.dead = false; mpHideTags(); specGun = -1; specHp = -1;
  document.body.classList.remove("spectating");
  document.getElementById("spectag").classList.add("gone"); document.getElementById("mpping").classList.add("gone");
}

var STUDENT_FRAMES = {};
function shirtShade(hex, k){
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(((n >> 16) & 255) * k) | 0},${(((n >> 8) & 255) * k) | 0},${((n & 255) * k) | 0})`;
}
var STUDENT_SCALE = .94, STUDENT_Y = .5 - .94/2;
function studentFrames(slot, gi){
  gi = gi | 0;
  const key = slot + ":" + gi;
  if (STUDENT_FRAMES[key]) return STUDENT_FRAMES[key];
  const shirt = SHIRTS[slot] || SHIRT_DEFAULT, sleeve = shirtShade(shirt, .8), sleeveDk = shirtShade(shirt, .62), shirtDk = shirtShade(shirt, .65);
  const skin = "#d8a06a", skinDk = "#b8834f", shade = "#b8834f", hair = "#3a2a1c", hairHi = "#4a382c", dark = "#20140c";
  const collar = "#c9c0a8", pants = "#262a36", pantsDk = "#1a1d26", shoe = "#141210";
  const steel = "#6b717c", steelHi = "#a3aab6", black = "#1b1c20", wood = "#8a5a2c", olive = "#5f7045", oliveHi = "#83975f";
  const HX = 28, HY = 4;
  const mk = (draw, mirror) => {
    const c = document.createElement("canvas"); c.width = c.height = 96;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    if (mirror){ g.translate(96, 0); g.scale(-1, 1); }
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const hp = (x, y, w, h, col) => px(x + HX, y + HY, w, h, col);
    draw(px, hp, g);
    return c;
  };
  const flash = (px, x, y, r) => {
    px(x - r, y - 1, r*2, 3, "#ffd27a"); px(x - 1, y - r, 3, r*2, "#ffd27a");
    px(x - r + 2, y - r + 2, r*2 - 4, r*2 - 4, "#ff9a3c"); px(x - 2, y - 2, 4, 4, "#fff4c8");
  };
  const legsFront = (px, f) => {
    const lL = f === 0 ? 3 : 0, lR = f === 2 ? 3 : 0;
    px(34, 70, 28, 6, pants);
    px(35, 76, 11, 14 - lL, pants); px(50, 76, 11, 14 - lR, pants);
    px(34, 90 - lL, 13, 6, shoe); px(49, 90 - lR, 13, 6, shoe);
  };
  const torsoFront = (px, back) => {
    px(32, 44, 32, 26, shirt); px(32, 66, 32, 4, shirtDk);
    if (!back) px(42, 44, 12, 4, collar);
  };
  const gunFront = (px, b, fire) => {
    const y = 55 + b - (fire ? 2 : 0);
    px(30, 46, 6, 10, sleeve); px(60, 46, 6, 10, sleeve);
    px(34, y - 1, 10, 6, sleeve); px(52, y - 1, 10, 6, sleeve);
    if (gi === 0){ px(43, y - 2, 10, 8, steel); px(45, y, 6, 4, black); }
    else if (gi === 1){ px(40, y - 4, 16, 11, wood); px(41, y - 3, 6, 6, steel); px(49, y - 3, 6, 6, steel); px(42, y - 2, 4, 4, black); px(50, y - 2, 4, 4, black); }
    else if (gi === 2){ px(38, y - 6, 20, 14, steel); px(40, y - 5, 16, 2, steelHi); px(44, y - 2, 8, 7, black); }
    else { px(38, y - 10, 20, 20, olive); px(38, y - 10, 20, 2, oliveHi); px(42, y - 6, 12, 12, black); }
    px(41, y + 4, 5, 4, skin); px(50, y + 4, 5, 4, skin);
    if (fire) flash(px, 48, y, gi === 3 ? 10 : gi === 1 ? 9 : 7);
  };
  const front = (f, fire) => mk(px => {
    legsFront(px, f); torsoFront(px, false);
    const keep = shirtColor; shirtColor = shirt;
    paintFace({mood:"calm", dmg:0, dir:0, blink:false});
    shirtColor = keep;
    const b = (f === 1 || f === 3) ? 1 : 0;
    gunFront(px, b, fire);
    return px;
  });
  const frontFrame = (f, fire) => {
    const c = front(f, fire), g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(faceCv, 0, 0, 40, 40, HX, HY, 40, 40);
    g.fillStyle = collar; g.fillRect(42, 44, 12, 4);
    const b = (f === 1 || f === 3) ? 1 : 0;
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    gunFront(px, b, fire);
    return c;
  };
  const back = (f, fire) => mk((px, hp) => {
    legsFront(px, f); torsoFront(px, true);
    const b = (f === 1 || f === 3) ? 1 : 0, r = fire ? 1 : 0;
    px(29, 46 + b - r, 6, 12, sleeve); px(61, 46 + b - r, 6, 12, sleeve);
    px(31, 56 + b - r, 5, 3, sleeveDk); px(60, 56 + b - r, 5, 3, sleeveDk);
    if (gi > 0) px(64, 49 + b - r, gi === 3 ? 10 : 7, gi === 3 ? 7 : 4, gi === 3 ? olive : steel);
    hp(15, 34, 10, 8, shade);
    hp(7, 6, 26, 32, skin); hp(7, 34, 26, 4, shade);
    hp(5, 16, 2, 8, skin); hp(33, 16, 2, 8, skin);
    hp(7, 5, 26, 24, hair);
    hp(6, 3, 28, 8, hair); hp(6, 3, 28, 2, hairHi);
    hp(6, 11, 2, 14, hair); hp(32, 11, 2, 14, hair);
    for (let i = 0; i < 5; i++) hp(9 + i*5, 28, 3, 3, hair);
    hp(8, 17, 24, 1, "#2e2116"); hp(10, 23, 20, 1, "#2e2116");
  });
  const side = (f, fire, mirror) => mk((px, hp) => {
    const st = [5, 0, -5, 0][f], b = (f === 1 || f === 3) ? 1 : 0, rc = fire ? -3 : 0;
    px(42 - st, 76, 11, 14, pantsDk); px(42 - st, 90, 14, 6, shoe);
    px(47 + rc, 55 + b, 14, 4, sleeveDk); px(60 + rc, 55 + b, 4, 4, skinDk);
    px(38, 44, 22, 26, shirt); px(38, 66, 22, 4, shirtDk);
    px(40, 70, 18, 6, pants);
    px(42 + st, 76, 11, 14, pants); px(42 + st, 90, 14, 6, shoe);
    hp(16, 34, 9, 8, shade);
    hp(9, 6, 24, 32, skin); hp(9, 34, 24, 4, shade);
    hp(31, 21, 3, 6, skin); hp(31, 26, 3, 1, shade);
    hp(8, 3, 25, 8, hair); hp(8, 3, 25, 2, hairHi);
    hp(8, 3, 10, 22, hair); hp(9, 25, 3, 3, hair); hp(13, 25, 3, 3, hair);
    hp(19, 10, 3, 3, hair); hp(24, 10, 3, 3, hair); hp(29, 10, 3, 3, hair);
    hp(17, 16, 3, 8, shade); hp(18, 17, 1, 6, skin);
    hp(24, 14, 6, 2, hair);
    hp(24, 18, 6, 5, "#f2ece0"); hp(27, 19, 2, 3, dark);
    hp(24, 24, 6, 1, shade); hp(26, 30, 6, 2, dark);
    const y = 50 + b, x = 58 + rc;
    let tip;
    if (gi === 0){ px(x + 2, y - 1, 12, 5, steel); px(x + 2, y - 1, 12, 1, steelHi); px(x + 4, y + 4, 4, 6, steel); tip = x + 14; }
    else if (gi === 1){ px(x - 4, y + 1, 9, 6, wood); px(x + 2, y - 1, 26, 4, steel); px(x + 2, y - 1, 26, 1, steelHi); px(x + 10, y + 3, 9, 3, wood); tip = x + 28; }
    else if (gi === 2){ px(x - 4, y - 2, 28, 7, steel); px(x - 2, y - 2, 24, 2, steelHi); px(x + 6, y + 5, 5, 8, black); px(x + 24, y, 6, 3, steel); tip = x + 30; }
    else { px(x - 8, y - 5, 36, 10, olive); px(x - 8, y - 5, 36, 2, oliveHi); px(x + 26, y - 4, 3, 8, black); tip = x + 29; }
    px(42, 47, 7, 9, sleeve); px(46, 51 + b, 14 + rc, 5, sleeve); px(58 + rc, 50 + b, 5, 7, skin);
    if (fire) flash(px, tip + 4, y + 1, gi === 3 ? 8 : gi === 1 ? 7 : 5);
  }, mirror);
  const F = {front:[], back:[], right:[], left:[]};
  for (let f = 0; f < 4; f++){
    F.front.push(frontFrame(f, false)); F.back.push(back(f, false));
    F.right.push(side(f, false, false)); F.left.push(side(f, false, true));
  }
  F.frontFire = frontFrame(1, true); F.backFire = back(1, true);
  F.rightFire = side(1, true, false); F.leftFire = side(1, true, true);
  faceKey = "";
  STUDENT_FRAMES[key] = F;
  return F;
}

var mpVis = {}, mpTagEls = {};
function mpPlayerList(){
  if (mpIsHost()) return mpPeers().filter(p => p.gs.alive && p.gs.x !== undefined)
    .map(p => ({slot:p.slot, x:p.gs.x, y:p.gs.y, a:p.gs.a || 0, name:p.name, gun:p.gs.gun | 0, hp:p.gs.hp || 0}));
  return mpRemote.filter(p => p[4]).map(p => {
    const pl = coop && coop.players.find(q => q.slot === p[0]);
    return {slot:p[0], x:p[1], y:p[2], a:p[3], name:pl ? pl.name : "", gun:p[5] | 0, hp:typeof p[7] === "number" ? p[7] : 100};
  });
}
function mpTagEl(slot){
  let el = mpTagEls[slot];
  if (!el){
    el = document.createElement("span"); el.className = "mptag";
    el.style.color = SHIRTS[slot] || "#fff";
    document.getElementById("wrap").appendChild(el);
    mpTagEls[slot] = el;
  }
  return el;
}
function mpHideTags(){ for (const k in mpTagEls) mpTagEls[k].style.display = "none"; }

function mpAddPlayerSprites(addSprite){
  const now = performance.now(), list = mpPlayerList(), shown = new Set();
  const cr = document.getElementById("c").getBoundingClientRect(), wr = document.getElementById("wrap").getBoundingClientRect();
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a), planeX = -dirY*CAM_PLANE, planeY = dirX*CAM_PLANE;
  const inv = 1 / (planeX*dirY - dirX*planeY);
  for (const r of list){
    let v = mpVis[r.slot];
    if (!v) v = mpVis[r.slot] = {x:r.x, y:r.y, lx:r.x, ly:r.y, t:now, spd:0, anim:0};
    const dt = Math.min(.1, Math.max(0, (now - v.t) / 1000)); v.t = now;
    v.x += (r.x - v.x) * Math.min(1, dt*12); v.y += (r.y - v.y) * Math.min(1, dt*12);
    const moved = Math.hypot(v.x - v.lx, v.y - v.ly); v.lx = v.x; v.ly = v.y;
    if (dt > 0) v.spd += (moved / dt - v.spd) * Math.min(1, dt*6);
    const moving = v.spd > .5;
    v.anim = moving ? v.anim + dt * (2 + v.spd * 1.6) : 0;
    const frame = moving ? Math.floor(v.anim * 1.6) % 4 : 1;
    v.frame = frame;
    const fx = Math.cos(r.a), fy = Math.sin(r.a);
    const tvx = P.x - v.x, tvy = P.y - v.y, tl = Math.hypot(tvx, tvy) || 1;
    const dFront = (fx*tvx + fy*tvy) / tl;
    if (P.dead && r.slot === MP.specSlot) continue;
    const F = studentFrames(r.slot, r.gun);
    let view;
    if (dFront > .55) view = "front";
    else if (dFront < -.55) view = "back";
    else view = (fx*(-dirY) + fy*dirX) > 0 ? "right" : "left";
    v.view = view;
    const fired = now - (mpLastFx[r.slot] || 0) < 110;
    const o = addSprite(v.x, v.y, fired ? F[view + "Fire"] : F[view][frame], STUDENT_SCALE, STUDENT_Y);
    if (o) o.minB = .5;

    const dx = v.x - P.x, dy = v.y - P.y, dist = Math.hypot(dx, dy);
    const ty = inv*(-planeY*dx + planeX*dy), tx = inv*(dirY*dx - dirX*dy);
    const el = mpTagEl(r.slot);
    if (ty > .3 && dist < 14 && rayLen(P.x, P.y, Math.atan2(dy, dx), dist) >= dist - .3){
      const sx = (W/2) * (1 + tx/ty), sy = H/2 + (STUDENT_Y - STUDENT_SCALE/2 + STUDENT_SCALE * 7/96 - .04) * H/ty;
      const cx = cr.left - wr.left + sx * cr.width / W, cy = cr.top - wr.top + sy * cr.height / H;
      if (el.textContent !== r.name) el.textContent = r.name;
      el.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) translate(-50%,-100%)`;
      el.style.opacity = Math.max(.35, Math.min(1, 1.4 - dist/12)).toFixed(2);
      el.style.display = "";
      shown.add(String(r.slot));
    }
  }
  for (const k in mpTagEls) if (!shown.has(k)) mpTagEls[k].style.display = "none";
  for (const f of mpFlashes){
    const fo = addSprite(f.x, f.y, GLOW[0], f.big ? .4 : .28, STUDENT_Y - .1);
    if (fo){ fo.glow = 0; fo.glowA = Math.max(0, 1 - f.t / .09); }
  }
}

function mpGunNeed(n){
  let c = unlocked[n] ? 0 : 1;
  for (const p of mpPeers()) if (!(((p.gs.u || 0) >> n) & 1)) c++;
  return c;
}
function mpGunSpot(x, y, k, need){
  for (let t = 0; t < 12; t++){
    const a = (k / need) * 6.283 + t * .5, r = .75 + (t >> 2) * .25;
    const qx = x + Math.cos(a)*r, qy = y + Math.sin(a)*r;
    if (!solid(qx, qy, .3)) return {x:qx, y:qy};
  }
  return {x, y};
}
var mpLvlGun = null;
function mpClientGunLamp(){
  if (!mpLvlGun) return "";
  const [gx, gy, n] = mpLvlGun;
  LAMPS = LAMPS.filter(L => Math.hypot(L.x - gx, L.y - gy) >= 5);
  const gl = addLamp(gx, gy, 4.5, .85, "flicker", 0);
  if (gl) gl.gun = "gun" + n;
  composeLight();
  return `НА ЭТАЖЕ: ${GUNS[n].name}`;
}
function mpGunLampOff(kind, except){
  if (items.some(o => o !== except && !o.dead && o.kind === kind)) return;
  const gl = LAMPS.find(L => L.gun === kind);
  if (gl){ gl.state = "off"; gl.val = 0; gl.gun = null; composeLight(); }
  if (mpIsHost()) for (const p of mpPeers()) coopSend(p.ch, {t:"lamp", k:kind});
}

function mpMinimap(mm, ox, oy, s){
  const list = mpIsHost() ? mpPeers().filter(p => p.gs.alive).map(p => [p.slot, p.gs.x, p.gs.y])
                          : mpRemote.filter(p => p[4]).map(p => [p[0], p[1], p[2]]);
  for (const [slot, x, y] of list){
    mm.fillStyle = SHIRTS[slot] || "#fff";
    mm.fillRect(ox + x*s - s*.8, oy + y*s - s*.8, s*1.6, s*1.6);
  }
}

var WEAPON_OVL = {}, mpFlashes = [], mpLastFx = {};
function weaponOverlay(slot, gi, view){
  const key = slot + ":" + gi + ":" + view;
  if (WEAPON_OVL[key]) return WEAPON_OVL[key];
  const shirt = SHIRTS[slot] || SHIRT_DEFAULT, sleeve = shirtShade(shirt, .8);
  const skin = "#d8a06a", steel = "#3a3d44", steelHi = "#5a5f6a", black = "#0c0c0e", wood = "#5a3a1e", olive = "#4d5a3a";
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const g = c.getContext("2d");
  if (view === "left"){ g.translate(96, 0); g.scale(-1, 1); }
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (view === "front"){
    px(33, 50, 10, 7, sleeve); px(53, 50, 10, 7, sleeve);
    if (gi === 0){ px(43, 52, 10, 8, steel); px(45, 54, 6, 4, black); }
    else if (gi === 1){ px(40, 50, 16, 10, wood); px(41, 51, 6, 6, steel); px(49, 51, 6, 6, steel); px(42, 52, 4, 4, black); px(50, 52, 4, 4, black); }
    else if (gi === 2){ px(38, 48, 20, 14, steel); px(40, 49, 16, 2, steelHi); px(44, 52, 8, 7, black); }
    else { px(38, 44, 20, 20, olive); px(42, 48, 12, 12, black); px(38, 44, 20, 2, "#66744c"); }
    px(41, 58, 5, 4, skin); px(50, 58, 5, 4, skin);
  } else if (view === "back"){
    px(63, 50, 7, 8, sleeve);
    const len = gi === 0 ? 4 : gi === 3 ? 10 : 8;
    px(66, 50, len, 5, gi === 3 ? olive : steel);
  } else {
    px(48, 50, 16, 7, sleeve); px(63, 50, 5, 7, skin);
    if (gi === 0){ px(62, 49, 12, 5, steel); px(64, 54, 4, 6, steel); }
    else if (gi === 1){ px(56, 51, 8, 6, wood); px(62, 49, 26, 4, steel); px(70, 53, 9, 3, wood); }
    else if (gi === 2){ px(56, 48, 26, 7, steel); px(58, 48, 22, 2, steelHi); px(66, 55, 5, 8, black); px(80, 50, 6, 3, steel); }
    else { px(52, 45, 34, 10, olive); px(52, 45, 34, 2, "#66744c"); px(84, 46, 3, 8, black); }
  }
  WEAPON_OVL[key] = c;
  return c;
}

function mpShotFx(slot, x, y, a, gi){
  if (P.dead && slot === MP.specSlot){
    flash = gi === 3 ? 0 : 1; recoil = 1; playFireAnim();
    const g = GUNS[gi] || GUNS[0];
    beep("square", g.snd[0], g.snd[1], g.snd[2]);
    return;
  }
  mpFlashes.push({x:x + Math.cos(a)*.5, y:y + Math.sin(a)*.5, t:0, big:gi === 1 || gi === 3});
  const au = atPos(x, y), g = GUNS[gi] || GUNS[0];
  beep("square", g.snd[0], g.snd[1], g.snd[2] * .55 * au.vol, undefined, au.sp);
  if (gi === 1) noiseBurst(.25, .2 * au.vol, 2600, 1, au.sp);
}
function mpLights(){
  for (const f of mpFlashes) addLight(f.x, f.y, f.big ? 3.4 : 2.6, 1 - f.t / .09, 0, 0);
}
function mpFireMark(){ if (mpIsHost()) MP.hostFireT = performance.now(); }

function mpSpecTargets(){ return mpPlayerList(); }
function mpSpecNext(){
  if (!mpActive() || !P.dead) return;
  const now = performance.now();
  if (now - (MP.specSwitchT || 0) < 250) return;
  MP.specSwitchT = now;
  const list = mpSpecTargets();
  if (!list.length) return;
  const i = list.findIndex(r => r.slot === MP.specSlot);
  MP.specSlot = list[(i + 1) % list.length].slot;
}
function mpSpecStep(){
  const tag = document.getElementById("spectag");
  document.body.classList.toggle("spectating", !!P.dead);
  if (!P.dead){
    if (MP.specSlot !== undefined && MP.specSlot !== null){ MP.specSlot = null; specGun = -1; specHp = -1; }
    tag.classList.add("gone");
    return;
  }
  P.hurt = 0; P.hitT = 0;
  const list = mpSpecTargets();
  if (!list.length){ tag.textContent = "ВСЕ ПАЛИ…"; tag.classList.remove("gone"); specGun = -1; return; }
  let t = list.find(r => r.slot === MP.specSlot);
  if (!t){ t = list[0]; MP.specSlot = t.slot; }
  const v = mpVis[t.slot];
  const nx = v ? v.x : t.x, ny = v ? v.y : t.y;
  const mv = Math.hypot(nx - P.x, ny - P.y);
  if (mv < 1) bobPhase += mv * 5.2;
  P.x = nx; P.y = ny;
  specHp = t.hp;
  let d = t.a - P.a; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
  P.a += d * .35;
  specGun = t.gun | 0;
  const txt = `НАБЛЮДАЕШЬ: ${t.name}` + (list.length > 1 ? " · коснись — следующий" : "");
  if (tag.textContent !== txt) tag.textContent = txt;
  tag.style.color = SHIRTS[t.slot] || "#fff";
  tag.classList.remove("gone");
}
function mpPingUpdate(){
  const el = document.getElementById("mpping");
  if (!mpActive()){ el.classList.add("gone"); return; }
  let txt = "";
  if (mpIsClient() && coop){ const me = coop.players.find(p => p.slot === coop.slot); if (me && me.ping != null) txt = `пинг ${me.ping} мс`; }
  else if (mpIsHost()){ const ps = mpPeers().map(p => p.ping).filter(v => v != null); if (ps.length) txt = `пинг до ${Math.max(...ps)} мс`; }
  el.textContent = txt; el.classList.toggle("gone", !txt);
}
(() => {
  const next = () => { if (typeof mpActive === "function" && mpActive() && P.dead) mpSpecNext(); };
  addEventListener("keydown", e => { if (["KeyE", "KeyQ", "Space", "ArrowRight", "ArrowLeft"].includes(e.code)) next(); });
  const w = document.getElementById("wrap");
  if (w) w.addEventListener("pointerdown", next, true);
})();

function mpRecordHist(){
  const t = performance.now();
  for (const e of enemies){
    if (!e.alive) continue;
    const h = e.hist || (e.hist = []);
    h.push(t, e.x, e.y);
    while (h.length > 6 && t - h[0] > 700) h.splice(0, 3);
  }
}
function mpRewind(t){
  const saved = [];
  for (const e of enemies){
    if (!e.alive || !e.hist || e.hist.length < 6) continue;
    const h = e.hist;
    let i = 0;
    while (i + 3 < h.length && h[i + 3] <= t) i += 3;
    let x = h[i + 1], y = h[i + 2];
    if (i + 3 < h.length && h[i] < t){
      const k = Math.max(0, Math.min(1, (t - h[i]) / Math.max(1, h[i + 3] - h[i])));
      x += (h[i + 4] - x) * k; y += (h[i + 5] - y) * k;
    }
    saved.push([e, e.x, e.y]);
    e.x = x; e.y = y;
  }
  return saved;
}
