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
      it.dead = true;
      coopSend(p.ch, {t:"give", k:it.kind});
      if (GUN_OF[it.kind] !== undefined){
        const gl = LAMPS.find(L => L.gun === it.kind);
        if (gl){ gl.state = "off"; gl.val = 0; gl.gun = null; composeLight(); }
      }
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
  const extra = Math.round(C.count * .4 * (n - 1));
  for (let i = 0; i < extra; i++){
    const src = enemies[(Math.random() * enemies.length) | 0];
    if (!src) break;
    const p = freeCell(8);
    enemies.push(Object.assign({}, src, {x:p.x, y:p.y, id:0, seen:false, t:Math.random()*10}));
  }
  const hm = 1 + .12 * (n - 1);
  for (const e of enemies) e.hp = Math.round(e.hp * hm);
}

function mpOnLevel(){
  if (P.dead){ P.dead = false; P.hp = Math.max(P.hp, 50); updateHUD(); }
  if (mpIsHost()){
    const n = coopN();
    if (bossRef && n > 1){ bossRef.maxHp = Math.round(bossRef.maxHp * (1 + .65 * (n - 1))); bossRef.hp = bossRef.maxHp; }
    MP.nid = 0;
    if (MP.started) for (const p of mpPeers()){ p.gs.alive = true; coopSend(p.ch, {t:"lvl", L:level}); }
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
  const PL = [[0, +P.x.toFixed(2), +P.y.toFixed(2), +P.a.toFixed(2), P.dead ? 0 : 1]];
  for (const p of mpPeers()) PL.push([p.slot, +p.gs.x.toFixed(2), +p.gs.y.toFixed(2), +p.gs.a.toFixed(2), p.gs.alive ? 1 : 0]);
  return {t:"snap", L:level, left:enemiesLeft, E, I, PL,
    S:shots.map(b => [+b.x.toFixed(2), +b.y.toFixed(2), +b.vx.toFixed(2), +b.vy.toFixed(2), b.big ? 1 : 0]),
    G:grenades.map(g => [+g.x.toFixed(2), +g.y.toFixed(2), +g.vx.toFixed(2), +g.vy.toFixed(2)]),
    B:booms.map(b => [+b.x.toFixed(2), +b.y.toFixed(2), +b.t.toFixed(2)]),
    BM:beams.map(b => [b.owner.id || 0, +b.ang.toFixed(3), +b.t.toFixed(2), b.aimT, b.fireT, b.kind === "eyes" ? 0 : 1, +b.dP.toFixed(2)]),
    po:portal ? [+portal.x.toFixed(2), +portal.y.toFixed(2), +portal.t.toFixed(2)] : 0};
}

function mpApplySnap(m){
  if (m.L !== level) return;
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
  for (const b of shots){ b.x += b.vx*dt; b.y += b.vy*dt; b.t += dt; }
  for (const g of grenades){ g.x += g.vx*dt; g.y += g.vy*dt; }
  for (const b of beams) b.t += dt;
  for (const it of items) it.t += dt;
  if (portal) portal.t += dt;
}

function mpTick(dt){
  if (!coop || coop.closed){ mpEnd("Связь с комнатой потеряна."); return; }
  MP.sendT -= dt;
  if (mpIsHost()){
    MP.flowT -= dt;
    if (MP.flowT <= 0){ MP.flowT = .3; mpBuildFlows(); }
    if (MP.sendT <= 0){
      MP.sendT = 1/15;
      const snap = JSON.stringify(mpSnap());
      for (const p of mpPeers()) if (p.ch && p.ch.readyState === "open") try { p.ch.send(snap); } catch(e){}
    }
  } else if (MP.sendT <= 0 && coop.host){
    MP.sendT = 1/15;
    coopSend(coop.host.ch, {t:"st", x:+P.x.toFixed(2), y:+P.y.toFixed(2), a:+P.a.toFixed(3), g:gun, al:P.dead ? 0 : 1,
                            hp:Math.round(P.hp), W, H, pl:+CAM_PLANE.toFixed(3)});
  }
}

function mpFire(offset, dmg){
  if (coop && coop.host) coopSend(coop.host.ch, {t:"fire", x:+P.x.toFixed(2), y:+P.y.toFixed(2), a:+P.a.toFixed(4),
    o:+offset.toFixed(4), d:+dmg.toFixed(2), g:gun, W, H, pl:+CAM_PLANE.toFixed(3)});
}

function mpDie(){
  P.dead = true; P.hp = 0; updateHUD();
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
    if (typeof m.x === "number" && typeof m.y === "number" && !solid(m.x, m.y, .05)){ g.x = m.x; g.y = m.y; }
    if (g.x === undefined){ g.x = P.x; g.y = P.y; }
    g.a = +m.a || 0; g.gun = m.g | 0; g.hp = +m.hp || 0;
    g.W = Math.max(80, Math.min(640, m.W | 0)); g.H = Math.max(60, Math.min(1400, m.H | 0)); g.pl = Math.max(.3, Math.min(2, +m.pl || .66));
    if (m.al && !g.alive && g.hp > 0) g.alive = true;
  } else if (m.t === "fire" && peer.gs && peer.gs.alive){
    if (typeof m.x === "number" && typeof m.y === "number" && !solid(m.x, m.y, .05)){ peer.gs.x = m.x; peer.gs.y = m.y; }
    const gi = Math.max(0, Math.min(GUNS.length - 1, m.g | 0));
    const dmg = Math.max(0, Math.min(400, +m.d || 0));
    const off = Math.max(-.3, Math.min(.3, +m.o || 0));
    const a = +m.a || 0;
    hitscanAt(peer.gs.x, peer.gs.y, a, off, dmg, gi, peer.gs.W || 206, peer.gs.H || 430, peer.gs.pl || .66,
              rayLen(peer.gs.x, peer.gs.y, a + off, 40));
  } else if (m.t === "gren" && peer.gs && peer.gs.alive){
    const a = +m.a || 0, x = peer.gs.x, y = peer.gs.y;
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
  else if (m.t === "lvl" && Number.isFinite(m.L)){ level = Math.max(0, (m.L | 0) - 1); nextLevel(); }
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
  MP = {active:true, role, sendT:0, flowT:0, nid:0, started:false};
  document.getElementById("coop").classList.add("gone");
  const si = document.getElementById("seedin");
  si.value = (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
  beginRun(null);
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
  MP = null; mpTarget = null; mpRemote = []; mpEnt.clear(); P.dead = false;
  if (msg && playing){ quitToMenu(); showBanner(msg, true); }
  else if (msg && wasClient){ showBanner(msg, true); }
}

function mpQuit(){
  if (mpIsHost()) for (const p of mpPeers()) coopSend(p.ch, {t:"end"});
  MP = null; mpTarget = null; mpRemote = []; mpEnt.clear(); P.dead = false;
}

var playerSprites = {};
function playerSprite(slot){
  if (playerSprites[slot]) return playerSprites[slot];
  const keep = shirtColor;
  shirtColor = SHIRTS[slot] || SHIRT_DEFAULT;
  paintFace({mood:"calm", dmg:0, dir:0, blink:false});
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.drawImage(faceCv, 12, 4, 40, 48);
  g.fillStyle = shirtColor; g.fillRect(12, 52, 40, 12);
  shirtColor = keep; faceKey = "";
  playerSprites[slot] = c;
  return c;
}

function mpAddPlayerSprites(addSprite){
  const list = mpIsHost() ? mpPeers().filter(p => p.gs.alive).map(p => [p.slot, p.gs.x, p.gs.y])
                          : mpRemote.filter(p => p[4]).map(p => [p[0], p[1], p[2]]);
  for (const [slot, x, y] of list){
    const o = addSprite(x, y, playerSprite(slot), .95, .02);
    if (o) o.minB = .55;
  }
}

function mpMinimap(mm, ox, oy, s){
  const list = mpIsHost() ? mpPeers().filter(p => p.gs.alive).map(p => [p.slot, p.gs.x, p.gs.y])
                          : mpRemote.filter(p => p[4]).map(p => [p[0], p[1], p[2]]);
  for (const [slot, x, y] of list){
    mm.fillStyle = SHIRTS[slot] || "#fff";
    mm.fillRect(ox + x*s - s*.8, oy + y*s - s*.8, s*1.6, s*1.6);
  }
}
