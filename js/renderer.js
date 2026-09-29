function move(dx, dy){
  if (solid(P.x, P.y, .05)){ P.x += dx; P.y += dy; return; }
  if (dx && !solid(P.x + dx, P.y, PR)) P.x += dx;
  if (dy && !solid(P.x, P.y + dy, PR)) P.y += dy;
}

function segDist(px, py, x0, y0, x1, y1){
  const vx = x1-x0, vy = y1-y0;
  const len = vx*vx + vy*vy;
  let t = len ? ((px-x0)*vx + (py-y0)*vy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + vx*t), py - (y0 + vy*t));
}

var FLOW = new Int32Array(MW*MH);
var FQ = new Int32Array(MW*MH);
var DX8 = [1,-1,0,0,1,1,-1,-1], DY8 = [0,0,1,-1,1,-1,1,-1];
var flowCd = 0, flowCell = -1;

function buildFlow(){
  let cx = Math.min(MW-1, Math.max(0, P.x|0)), cy = Math.min(MH-1, Math.max(0, P.y|0));
  FLOW.fill(-1);
  if (GRID[cy*MW+cx]){
    let found = false;
    for (let r=1; r<=4 && !found; r++)
      for (let y=cy-r; y<=cy+r && !found; y++)
        for (let x=cx-r; x<=cx+r && !found; x++){
          if (x<0||y<0||x>=MW||y>=MH||GRID[y*MW+x]) continue;
          cx = x; cy = y; found = true;
        }
    if (!found) return;
  }
  let head = 0, tail = 0;
  const st = cy*MW + cx;
  FLOW[st] = 0; FQ[tail++] = st;
  while (head < tail){
    const idx = FQ[head++], x = idx % MW, y = (idx/MW)|0, d = FLOW[idx];
    for (let i=0;i<4;i++){
      const nx = x + DX8[i], ny = y + DY8[i];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = ny*MW + nx;
      if (FLOW[ni] !== -1 || GRID[ni]) continue;
      FLOW[ni] = d + 1; FQ[tail++] = ni;
    }
  }
}

function flowDir(e){
  const cx = e.x|0, cy = e.y|0;
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return null;
  const cur = FLOW[cy*MW + cx];
  if (cur < 0) return null;
  let bestD = cur, bx = -1, by = -1;
  for (let i=0;i<8;i++){
    const nx = cx + DX8[i], ny = cy + DY8[i];
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
    if (GRID[ny*MW + nx]) continue;
    if (i >= 4 && (GRID[cy*MW + nx] || GRID[ny*MW + cx])) continue;
    const nd = FLOW[ny*MW + nx];
    if (nd < 0 || nd >= bestD) continue;
    bestD = nd; bx = nx; by = ny;
  }
  if (bx < 0) return null;
  const tx = bx + .5 - e.x, ty = by + .5 - e.y;
  const l = Math.hypot(tx, ty) || 1;
  return {x: tx/l, y: ty/l};
}

var ER = .3;
var cellHead = new Int32Array(MW * MH).fill(-1);
var cellNext = new Int32Array(64);
function solid(x, y, r){
  return cell(x-r, y-r) || cell(x+r, y-r) || cell(x-r, y+r) || cell(x+r, y+r);
}
function unstick(e){
  for (let r=.4; r<=3.2; r+=.4){
    for (let i=0;i<14;i++){
      const a = Math.random()*6.283;
      const x = e.x + Math.cos(a)*r, y = e.y + Math.sin(a)*r;
      if (!solid(x, y, ER)){ e.x = x; e.y = y; return; }
    }
  }
}
var parts = [];
var PART_IMG = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 16;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.45, "rgba(235,245,255,.9)"); gr.addColorStop(1, "rgba(200,220,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  return c;
})();

function updateParts(dt){
  let n = 0;
  for (let i = 0; i < parts.length; i++){
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) continue;
    p.x += p.vx*dt; p.y += p.vy*dt; p.h += p.vh*dt;
    if (p.drag){ p.vx *= 1 - p.drag*dt; p.vy *= 1 - p.drag*dt; p.vh *= 1 - p.drag*dt; }
    parts[n++] = p;
  }
  parts.length = n;
}

function bodyPoint(e){
  const s = e.scale || 1, top = .5 - s;
  const stretch = 2 * CAM_PLANE * H / W;
  const u = (Math.random()*2 - 1) * s * .42 * stretch, dep = (Math.random() - .5) * .3;
  const rx = -Math.sin(P.a), ry = Math.cos(P.a), fx = Math.cos(P.a), fy = Math.sin(P.a);
  return {x:e.x + rx*u + fx*dep, y:e.y + ry*u + fy*dep, h:top + s*.08 + Math.random()*s*.88};
}

function bossBlink(e, tx, ty){
  if (e.blink) return;
  e.blink = {t:0, tx, ty, moved:false};
  e.guard = Math.max(e.guard || 0, .75);
  e.dash = 0;
  for (let i = 0; i < 70; i++){
    const b = bodyPoint(e), a = Math.random()*6.283, sp = 1.2 + Math.random()*2.4;
    parts.push({x:b.x, y:b.y, h:b.h, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, vh:-(Math.random()*1.2), t:0,
                life:.35 + Math.random()*.3, drag:1.5});
  }
  const a = atPos(e.x, e.y);
  noiseBurst(.35, .16*a.vol, 3600, .8, a.pan);
  beep("sine", 1200, .35, .12*a.vol, 240, a.pan);
}

function blinkStep(e, dt){
  const b = e.blink;
  b.t += dt;
  if (!b.moved && b.t >= .3){
    b.moved = true;
    e.x = b.tx; e.y = b.ty;
    for (let i = 0; i < 70; i++){
      const end = bodyPoint(e), a = Math.random()*6.283, r = 1.3 + Math.random()*1.2, T = .32 + Math.random()*.06;
      const sx = end.x + Math.cos(a)*r, sy = end.y + Math.sin(a)*r, sh = end.h - .6 + Math.random()*1.2;
      parts.push({x:sx, y:sy, h:sh, vx:(end.x - sx)/T, vy:(end.y - sy)/T, vh:(end.h - sh)/T, t:0, life:T});
    }
    const a = atPos(e.x, e.y);
    beep("sine", 240, .35, .12*a.vol, 1200, a.pan);
  }
  if (b.t >= .68) e.blink = null;
}
function blinkAlpha(e){
  if (!e.blink) return 1;
  const t = e.blink.t;
  return t < .3 ? 1 - t/.3 : Math.min(1, Math.max(0, (t - .38) / .3));
}

function blinkTarget(e, minD, maxD){
  for (let t = 0; t < 120; t++){
    const a = Math.random()*6.283, r = minD + Math.random()*(maxD - minD);
    const x = P.x + Math.cos(a)*r, y = P.y + Math.sin(a)*r;
    if (x < 1.5 || y < 1.5 || x > MW - 1.5 || y > MH - 1.5) continue;
    if (solid(x, y, (e.rad || .5) + .15)) continue;
    const f = {x, y};
    if (!canSee(f)) continue;
    return f;
  }
  return null;
}

function tankSlam(e, d, a){
  booms.push({x:e.x, y:e.y, t:0});
  boomLight = 1; boomX = e.x; boomY = e.y;
  beep("sawtooth", 48, .6, .3*a.vol, 24, a.pan);
  noiseBurst(.5, .3*a.vol, 260, .8, a.pan);
  shake = Math.max(shake, .8);
  if (d < 3.4) damagePlayer(12 + dmgBonus(), e.x, e.y);
  const n = 12 + Math.floor(6 * bossLvl()), off = Math.random()*6.283;
  for (let i = 0; i < n; i++){
    const ang = off + i / n * 6.283;
    bossFireDir(e, Math.cos(ang), Math.sin(ang), .7);
  }
}

function bossFire(e, ux, uy, ang){
  const c = Math.cos(ang), s = Math.sin(ang);
  const vx = ux*c - uy*s, vy = ux*s + uy*c;
  shots.push({x:e.x + vx*.6, y:e.y + vy*.6, vx:vx*shotSpeed()*1.1, vy:vy*shotSpeed()*1.1, t:0});
}

function bossFireDir(e, vx, vy, mul, dmg){
  shots.push({x:e.x + vx*.8, y:e.y + vy*.8, vx:vx*shotSpeed()*mul, vy:vy*shotSpeed()*mul, t:0, dmg});
}
function finalVolley(e, ux, uy, n, spread, mul){
  for (let i = -n; i <= n; i++){
    const a = i * spread, c = Math.cos(a), s = Math.sin(a);
    bossFireDir(e, ux*c - uy*s, ux*s + uy*c, mul, 13);
  }
}

function summonMinions(e, type, n, cap){
  const alive = enemies.filter(m => m.alive && m.minion).length;
  n = Math.min(cap - alive, n);
  const k = KIND[type];
  for (let i = 0; i < n; i++){
    const ang = Math.random() * 6.283;
    let x = e.x + Math.cos(ang)*1.8, y = e.y + Math.sin(ang)*1.8;
    if (solid(x, y, .34)){ x = e.x; y = e.y; }
    enemies.push({type, minion:true, x, y, hp:k.hp + curve().hpBonus(type), alive:true,
      t:Math.random()*10, cd:1, deadT:0, speed:enemySpeed(k),
      stuck:0, slideT:0, slideDir:1, seen:true, hurtT:0, voiceT:9, breathT:0, seeT:0, sees:false});
    booms.push({x, y, t:.25});
  }
  if (n > 0){ const a = atPos(e.x, e.y); beep("sine", 140, .6, .2*a.vol, 520, a.pan); }
}

function bossSlam(e, radius, dmg){
  const a = atPos(e.x, e.y);
  for (let i = 0; i < 6; i++) booms.push({x:e.x + Math.cos(i*1.047)*1.2, y:e.y + Math.sin(i*1.047)*1.2, t:.05});
  boomLight = 1; boomX = e.x; boomY = e.y;
  beep("sawtooth", 44, .7, .32*a.vol, 22, a.pan);
  noiseBurst(.6, .32*a.vol, 240, .8, a.pan);
  shake = Math.max(shake, 1);
  if (Math.hypot(P.x - e.x, P.y - e.y) < radius) damagePlayer(dmg + dmgBonus(), e.x, e.y);
}

var FINAL_PHASES = ["", "ПАРА", "СЕССИЯ", "ОТЧИСЛЕНИЕ"];
function finalAI(e, dt, d, ux, uy, mx, my, sees, frac){
  if (e.blink){ blinkStep(e, dt); return; }
  if (e.laser){ e.atk -= dt; return; }
  const phase = frac > .66 ? 1 : frac > .33 ? 2 : 3;
  if (phase !== e.phase){
    e.phase = phase; e.guard = 1.4; e.dash = 0;
    showBanner(`ПАЛ ПАЛЫЧ · ${FINAL_PHASES[phase]}`, true, phase === 2 ? "он начинает злиться" : "последний звонок");
    for (let i = 0; i < 10; i++) booms.push({x:e.x + Math.cos(i*.628)*1.8, y:e.y + Math.sin(i*.628)*1.8, t:.08});
    beep("sawtooth", 38, 1.5, .36, 22); noiseBurst(1.1, .32, 300, .8);
    shake = Math.max(shake, 1.4);
    for (const L of LAMPS){
      if (phase === 2 && L.state === "on" && Math.random() < .6) L.state = "flicker";
      if (phase === 3 && L.state !== "off" && Math.random() < .45){ L.state = "off"; L.val = 0; }
    }
    composeLight();
  }
  e.pulse = (e.pulse || 0) - dt;
  if (e.pulse <= 0){
    e.pulse = phase === 3 ? .4 : phase === 2 ? .52 : .68;
    beep("square", 46, .1, .13, 36);
  }
  const sp = e.speed * dt * (phase === 3 ? 1.45 : 1);
  if (e.dash > 0){
    e.dash -= dt;
    moveEnemy(e, e.ddx*sp*4.2, e.ddy*sp*4.2);
    if (e.dash <= 0 || d < 1.8){ e.dash = 0; bossSlam(e, 3.6, 10); }
  } else {
    const want = phase === 1 ? 6.5 : 4.5;
    if (!sees || d > want + 1) moveEnemy(e, mx*sp, my*sp);
    else if (d < want - 1.5) moveEnemy(e, -ux*sp, -uy*sp);
    else moveEnemy(e, -uy*sp*.6*e.strafe, ux*sp*.6*e.strafe);
    if (Math.random() < dt*.25) e.strafe *= -1;
  }
  if (d < 2.1 && e.cd <= 0){
    if (phase === 3){ e.cd = 1.1 * rateMul(); damagePlayer(e.dmg + dmgBonus(), e.x, e.y); }
    else { e.cd = 1.3 * rateMul(); damagePlayer(18 + dmgBonus()*.5, e.x, e.y); }
  }
  e.atk -= dt; e.atk2 -= dt; e.atk3 = (e.atk3 || 6) - dt;
  const busy = shots.length > 22;
  if (phase === 1){
    if (e.atk <= 0 && sees && !busy){ e.atk = 3.1; finalVolley(e, ux, uy, 2, .24, .8); beep("sine", 260, .3, .16, 90); }
    if (e.atk2 <= 0 && sees && !e.laser){ e.atk2 = 7; startBeam(e, "eyes"); }
  } else if (phase === 2){
    if (e.atk <= 0 && sees && !busy){ e.atk = 3.0; finalVolley(e, ux, uy, 2, .22, .85); }
    if (e.atk2 <= 0 && !e.dash && sees){
      e.atk2 = 4.8; e.dash = .6; e.ddx = ux; e.ddy = uy;
      beep("sawtooth", 70, .6, .3, 180);
    }
    if (e.atk3 <= 0 && sees && !e.laser && !e.dash){ e.atk3 = 11; startBeam(e, "sweep"); }
    e.atk4 = (e.atk4 === undefined ? 5 : e.atk4) - dt;
    if (e.atk4 <= 0 && sees){
      e.atk4 = 9;
      if (enemies.filter(m => m.alive && m.paper).length < 2) throwOrder(e);
    }
  } else {
    e.spin = (e.spin || 0) + dt * 2.3;
    e.spinT = (e.spinT || 0) - dt;
    if (e.spinT <= 0){
      e.spinT = .16;
      for (let k = 0; k < 3; k++){ const ang = e.spin + k * 2.094; bossFireDir(e, Math.cos(ang), Math.sin(ang), .7); }
    }
    if (e.atk2 <= 0){ e.atk2 = 16; summonMinions(e, "bull", 1, 2); }
    e.tp = (e.tp === undefined ? 5 : e.tp) - dt;
    if ((d < 3 && e.tp <= 2.5) || e.tp <= 0){
      e.tp = 6 + Math.random()*2;
      const f = blinkTarget(e, 5.5, 9);
      if (f) bossBlink(e, f.x, f.y);
    }
  }
}

var beams = [];
var PAPER_ORDER_TEXT = "ПРИКАЗ ОБ ОТЧИСЛЕНИИ";
var PAPER_IMG = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  g.translate(32, 32); g.rotate(-.12);
  g.fillStyle = "#f4efe2"; g.fillRect(-17, -22, 34, 44);
  g.fillStyle = "#d8d0bc"; g.fillRect(-17, 19, 34, 3);
  g.fillStyle = "#2a2622";
  for (let i = 0; i < 7; i++) g.fillRect(-12, -16 + i*5, i === 0 ? 24 : 18 + (i*7 % 6), 2);
  g.strokeStyle = "#b0141c"; g.lineWidth = 3;
  g.beginPath(); g.arc(6, 11, 7, 0, Math.PI*2); g.stroke();
  g.fillStyle = "#b0141c"; g.fillRect(1, 10, 10, 2);
  return c;
})();

function rayLen(x0, y0, ang, max){
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let s = .2; s < max; s += .1){ if (cell(x0 + dx*s, y0 + dy*s)) return s; }
  return max;
}

function startBeam(e, kind){
  const aim = Math.atan2(P.y - e.y, P.x - e.x);
  const dir = Math.random() < .5 ? -1 : 1;
  const b = {owner:e, kind, t:0, aimT:kind === "eyes" ? 1.6 : 1.4, lockT:kind === "eyes" ? 1.0 : 0, fireT:kind === "eyes" ? .55 : 2.4,
             ang:kind === "eyes" ? aim : aim - .9*dir, a0:aim - .9*dir, a1:aim + .9*dir, dP:Math.max(1.5, Math.hypot(P.x - e.x, P.y - e.y)),
             tick:0, fired:false, locked:kind !== "eyes", tgt:(typeof mpTarget !== "undefined" && mpTarget) || null};
  beams.push(b);
  e.laser = b;
  const a = atPos(e.x, e.y);
  beep("sine", 200, kind === "eyes" ? 1.5 : 1.3, .14*a.vol, 900, a.pan);
}

function beamPoints(b){
  const e = b.owner, s = e.scale || 2.5;
  const px = -Math.sin(b.ang), py = Math.cos(b.ang);
  const eyeH = .5 - s + s * (23/64);
  return [-.22, .22].map(o => ({x:e.x + px*o, y:e.y + py*o, h:eyeH}));
}

function updateBeams(dt){
  let n = 0;
  for (const b of beams){
    const e = b.owner;
    b.t += dt;
    if (!e.alive || e.blink){ if (e.laser === b) e.laser = null; continue; }
    const firing = b.t >= b.aimT;
    if (!firing && b.kind === "eyes" && !b.locked){
      const T = b.tgt && b.tgt.gs && b.tgt.gs.alive ? b.tgt.gs : P;
      const want = Math.atan2(T.y - e.y, T.x - e.x);
      let d = want - b.ang; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
      b.ang += Math.max(-1.3*dt, Math.min(1.3*dt, d));
      b.dP = Math.max(1.5, Math.hypot(T.x - e.x, T.y - e.y));
      if (b.t >= b.lockT){
        b.locked = true;
        const a = atPos(e.x, e.y);
        beep("square", 1700, .07, .16*a.vol, 1700, a.pan);
        setTimeout(() => beep("square", 1700, .07, .14*a.vol, 1700, a.pan), 110);
      }
    }
    if (firing){
      if (!b.fired){
        b.fired = true;
        const a = atPos(e.x, e.y);
        beep("sawtooth", 95, b.fireT, .22*a.vol, 80, a.pan);
        noiseBurst(Math.min(.6, b.fireT), .14*a.vol, 2600, .8, a.pan);
      }
      if (b.kind === "sweep") b.ang = b.a0 + (b.a1 - b.a0) * Math.min(1, (b.t - b.aimT) / b.fireT);
      b.tick -= dt;
      if (b.tick <= 0){
        b.tick = .15;
        for (const T of mpTargets()){
          for (const p of beamPoints(b)){
            const len = rayLen(p.x, p.y, b.ang, 30);
            const dx = Math.cos(b.ang), dy = Math.sin(b.ang);
            const qx = T.x - p.x, qy = T.y - p.y, s = qx*dx + qy*dy;
            if (s > 0 && s < len && Math.abs(qx*dy - qy*dx) < .3){
              if (T.peer) mpHurt(T.peer, 6 + dmgBonus()*.3, p.x, p.y); else damagePlayer(6 + dmgBonus()*.3, p.x, p.y);
              break;
            }
          }
        }
      }
    }
    if (b.t >= b.aimT + b.fireT){ if (e.laser === b) e.laser = null; continue; }
    beams[n++] = b;
  }
  beams.length = n;
}

function throwOrder(e){
  const hp = 40 + Math.round(50 * bossLvl());
  const ang = Math.atan2(P.y - e.y, P.x - e.x);
  enemies.push({type:"imp", paper:true, minion:true, x:e.x + Math.cos(ang)*1.2, y:e.y + Math.sin(ang)*1.2,
    hp, alive:true, t:0, life:7, cd:99, scale:.55, deadT:0, speed:2.1, stuck:0, slideT:0, slideDir:1,
    seen:true, hurtT:0, voiceT:99, breathT:0, seeT:0, sees:false});
  showBanner(PAPER_ORDER_TEXT, true, "сбей его, пока не догнал");
  const a = atPos(e.x, e.y);
  noiseBurst(.3, .12*a.vol, 5000, .8, a.pan);
}

function paperAI(e, dt){
  e.life -= dt;
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.life <= 0){ e.alive = false; e.deadT = 99; booms.push({x:e.x, y:e.y, t:.3}); return; }
  let mx = dx/d, my = dy/d;
  const f = flowDir(e);
  if (f && !clearPath(e, d, mx, my)){ mx = f.x; my = f.y; }
  moveEnemy(e, mx*e.speed*dt, my*e.speed*dt);
  if (d < .55){
    e.alive = false; e.deadT = 99;
    if (!mpEffect("stun", 1.5)){ P.stunT = 1.5; P.slowT = Math.max(P.slowT || 0, 1.5); showBanner("ПОДПИСАНО", true, "полторы секунды без стрельбы"); }
    damagePlayer(16 + dmgBonus()*.5, e.x, e.y);
    beep("square", 180, .4, .2, 60);
  }
}

function fireFan(e, ux, uy, n, spread, mul){
  for (let i = -n; i <= n; i++){
    const c = Math.cos(i*spread), sn = Math.sin(i*spread);
    bossFireDir(e, ux*c - uy*sn, ux*sn + uy*c, mul);
  }
}

function bossAI(e, dt, d, ux, uy, mx, my, sees){
  if (e.blink){ blinkStep(e, dt); return; }
  const sp = e.speed * dt;
  e.atk -= dt;
  const frac = e.hp / e.maxHp;
  if (e.kind === "final"){ e.atk += dt; finalAI(e, dt, d, ux, uy, mx, my, sees, frac); return; }
  const a = atPos(e.x, e.y), L = bossLvl();
  if (e.kind === "tank"){
    e.atk2 = (e.atk2 === undefined ? 6 : e.atk2) - dt;
    if (e.dash > 0){
      e.dash -= dt;
      moveEnemy(e, e.ddx*sp*4.2, e.ddy*sp*4.2);
      if (e.dash <= 0 || d < 1.9){ e.dash = 0; e.atk = Math.max(e.atk, 2.5); tankSlam(e, d, a); }
    } else {
      if (d > 1.8) moveEnemy(e, mx*sp, my*sp);
      else if (e.cd <= 0){ e.cd = 1.4 * bossRate(); damagePlayer(e.dmg + dmgBonus(), e.x, e.y); }
      if (e.atk <= 0 && d < 8){ e.atk = 5 * bossRate(); tankSlam(e, d, a); }
      if (e.atk2 <= 0 && sees && d > 3.5 && d < 10){
        e.atk2 = 8 * bossRate(); e.dash = .7; e.ddx = ux; e.ddy = uy;
        beep("sawtooth", 60, .7, .3*a.vol, 150, a.pan);
      }
    }
  } else if (e.kind === "summoner"){
    const want = 6;
    if (!sees || d > want + 1) moveEnemy(e, mx*sp, my*sp);
    else if (d < want - 1 && !solid(e.x - ux*.9, e.y - uy*.9, (e.rad || .5))) moveEnemy(e, -ux*sp, -uy*sp);
    if (e.atk <= 0){
      e.atk = 8 * bossRate();
      const alive = enemies.filter(m => m.alive && m.minion).length;
      const n = Math.min(3 + Math.floor(2 * L) - alive, 2);
      if (n > 0) summonMinions(e, "imp", n, 3 + Math.floor(2 * L));
    }
    if (e.cd <= 0 && sees){ e.cd = 2 * bossRate(); bossFire(e, ux, uy, 0); beep("sine", 240, .2, .12, 110); }
  } else if (e.kind === "caster"){
    const want = 6;
    let wx = -uy * e.strafe * .8, wy = ux * e.strafe * .8;
    if (!sees || d > want + 1){ wx += mx*1.5; wy += my*1.5; }
    else if (d < want - 1.5 && !solid(e.x - ux*.9, e.y - uy*.9, (e.rad || .5))){ wx -= ux; wy -= uy; }
    const l = Math.hypot(wx, wy) || 1;
    if (!(e.charge > 0)) moveEnemy(e, wx/l*sp, wy/l*sp);
    if (Math.random() < dt*.25) e.strafe *= -1;
    if (e.charge > 0){
      e.charge -= dt;
      if (e.charge <= 0){
        fireFan(e, ux, uy, L >= .5 ? 2 : 1, .26, .8);
        beep("sine", 300, .3, .16, 90);
      }
    } else if (e.cd <= 0 && sees){
      e.cd = 3.2 * bossRate(); e.charge = .7;
      beep("sine", 420, .6, .12*a.vol, 1500, a.pan);
    }
    if (d < 2.2 && e.atk <= 0){
      e.atk = 6;
      const f = blinkTarget(e, 5, 9);
      if (f) bossBlink(e, f.x, f.y);
    }
  } else {
    const rage = 1 + (1 - frac) * .8;
    e.atk2 = (e.atk2 === undefined ? 4 : e.atk2) - dt;
    e.atk3 = (e.atk3 === undefined ? 8 : e.atk3) - dt;
    e.atk4 = (e.atk4 === undefined ? 3 : e.atk4) - dt;
    if (e.atk3 <= 0 && sees && d < 9){
      e.atk3 = 12 * bossRate();
      if (!mpEffect("slow", 1.2)){ P.slowT = 1.2; showBanner("СВИСТОК!", true, "ноги ватные"); }
      beep("sine", 2600, .5, .22*a.vol, 3100, a.pan);
      setTimeout(() => beep("sine", 2600, .35, .18*a.vol, 3000, a.pan), 550);
    }
    if (e.enraged && e.atk4 <= 0 && sees && d > 3){
      e.atk4 = 4.5 * bossRate();
      for (const i of [-1, 1]){
        const c = Math.cos(i*.16), sn = Math.sin(i*.16);
        shots.push({x:e.x + ux*.8, y:e.y + uy*.8, vx:(ux*c - uy*sn)*shotSpeed()*.6, vy:(ux*sn + uy*c)*shotSpeed()*.6,
                    t:0, big:true, dmg:14 + dmgBonus()*.5});
      }
      beep("square", 110, .25, .2*a.vol, 70, a.pan);
    }
    if (e.dash > 0){
      e.dash -= dt;
      moveEnemy(e, e.ddx*sp*3.4, e.ddy*sp*3.4);
      if (d < 1.7){ e.dash = 0; e.chain = 0; if (e.cd <= 0){ e.cd = .7; damagePlayer(e.dmg + dmgBonus(), e.x, e.y); } }
      else if (e.dash <= 0 && e.chain > 0){
        e.chain--; e.dash = .5; e.ddx = ux; e.ddy = uy;
        beep("sawtooth", 110, .35, .22*a.vol, 240, a.pan);
      }
    } else {
      if (d > 1.6) moveEnemy(e, mx*sp*rage, my*sp*rage);
      else if (e.cd <= 0){ e.cd = 1.05 * bossRate() / rage; damagePlayer(e.dmg + dmgBonus(), e.x, e.y); }
      if (e.atk2 <= 0 && sees && d > 4 && d < 12){
        e.atk2 = 5.5 * bossRate() / rage; e.dash = .65; e.ddx = ux; e.ddy = uy; e.chain = e.enraged ? 1 : 0;
        beep("sawtooth", 90, .5, .25*a.vol, 200, a.pan);
      }
    }
    if (frac < .5 && !e.enraged){
      e.enraged = true;
      showBanner(`${e.name} В ЯРОСТИ`, true);
      beep("sawtooth", 70, 1, .3, 140);
    }
  }
}

function clearPath(e, d, ux, uy){
  const r = (e.rad || ER) * .9, lim = Math.min(d - .3, 3);
  for (let s = .3; s < lim; s += .3) if (solid(e.x + ux*s, e.y + uy*s, r)) return false;
  return true;
}

function moveEnemy(e, dx, dy){
  const r = e.rad || ER;
  if (dx && !solid(e.x + dx, e.y, r)) e.x += dx;
  if (dy && !solid(e.x, e.y + dy, r)) e.y += dy;
  if (solid(e.x, e.y, .06)) unstick(e);
}

function castRay(a){
  const rdx = Math.cos(a), rdy = Math.sin(a);
  let mx = P.x|0, my = P.y|0;
  const ddx = Math.abs(1/rdx), ddy = Math.abs(1/rdy);
  let sx, sy, sdx, sdy;
  if (rdx < 0){ sx = -1; sdx = (P.x-mx)*ddx; } else { sx = 1; sdx = (mx+1-P.x)*ddx; }
  if (rdy < 0){ sy = -1; sdy = (P.y-my)*ddy; } else { sy = 1; sdy = (my+1-P.y)*ddy; }
  let side = 0, hit = 0, guard = 0;
  while (!hit && guard++ < 128){
    if (sdx < sdy){ sdx += ddx; mx += sx; side = 0; }
    else { sdy += ddy; my += sy; side = 1; }
    hit = (mx < 0 || my < 0 || mx >= MW || my >= MH) ? 1 : GRID[my*MW + mx];
  }
  return side === 0 ? (sdx - ddx) : (sdy - ddy);
}

function angleDiff(a, b){
  let d = a - b;
  while (d > Math.PI) d -= Math.PI*2;
  while (d < -Math.PI) d += Math.PI*2;
  return d;
}

var combo = 0, comboT = 0, bestStreak = 0;
var RANKS = [[60,"ПТУ ЗАКРЫТО НА КАРАНТИН"],[50,"ОТЧИСЛЕНА ВСЯ ШАРАГА"],[40,"ДИРЕКТОР В ШОКЕ"],
             [35,"ПОЧЁТНЫЙ ВЫПУСКНИК"],[30,"ЛЕГЕНДА ОБЩАГИ"],[25,"АСПИРАНТУРА"],[20,"ОТЧИСЛЕН ВЕСЬ ПОТОК"],
             [17,"ДИПЛОМНАЯ"],[15,"КРАСНЫЙ ДИПЛОМ"],[12,"ПОВЫШЕННАЯ СТИПЕНДИЯ"],[10,"АВТОМАТ"],
             [8,"ПРАКТИКА"],[7,"СЕССИЯ"],[6,"ЭКЗАМЕН"],[5,"КУРСОВАЯ"],[4,"ЛАБОРАТОРНАЯ"],
             [3,"КОЛЛОКВИУМ"],[2,"ЗАЧЁТ"]];

function registerKill(){
  kills++;
  combo++; comboT = 3;
  if (combo > bestStreak) bestStreak = combo;
  beep("sawtooth", 110 + Math.min(10, combo)*20, .35, .2);
  if (combo >= 2){
    const r = RANKS.find(([n]) => combo >= n);
    const el = HUD.combo;
    el.textContent = `×${combo} · ${r[1]}`;
    el.classList.add("show");
  }
}

function damageEnemy(e, dmg){
  if (!e.alive) return;
  if (e.guard > 0){ e.hurtT = .06; return; }
  e.hp -= dmg;
  e.hurtT = .14;
  if (e.hp > 0){ beep("triangle", e.boss ? 150 : 320, .07, .1); return; }
  if (e.paper){ e.alive = false; e.deadT = 99; booms.push({x:e.x, y:e.y, t:.3}); noiseBurst(.2, .12, 4000, .8); return; }
  e.alive = false; e.deadT = 0; e.bloodT = 2.6;
  registerKill();
  if (e.boss){ bossDefeated(e); return; }
  const dry = ammo.bullets < 12 && ammo.shells < 3;
  if (dry || Math.random() < Math.min(.8, curve().dropChance * (isBossLevel() ? 2 : 1) * coopK("mobDrop"))){
    const wb = .34 * stockFactor("bullets"), ws = .22 * stockFactor("shells"), wm = .44;
    const r = Math.random() * (wb + ws + wm);
    items.push({kind: r < wb ? "bullets" : r < wb + ws ? "shells" : "medkit", x:e.x, y:e.y, t:0});
  }
}

function falloff(g, d){
  const f = g.falloff;
  if (!f || d <= f[0][0]) return 1;
  for (let i = 1; i < f.length; i++){
    if (d <= f[i][0]){
      const [d0, m0] = f[i-1], [d1, m1] = f[i];
      return m0 + (m1 - m0) * (d - d0) / (d1 - d0);
    }
  }
  return f[f.length - 1][1];
}

function hitscan(offset, dmg){
  if (mpIsClient()){ mpFire(offset, dmg); return; }
  if (hitscanAt(P.x, P.y, P.a, offset, dmg, gun, W, H, CAM_PLANE, castRay(P.a + offset))) stat.hit++;
}

var grenades = [], booms = [];
function explode(x, y){
  booms.push({x, y, t:0});
  beep("sawtooth", 70, .4, .3, 40);
  noiseBurst(.55, .4, 1400, .7);
  boomLight = 1; boomX = x; boomY = y;
  const R = 3.1, D = 62 * (BT.rage > 0 ? RAGE_MULT : 1) * skillMul();
  for (const e of enemies){
    if (!e.alive) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > R) continue;
    damageEnemy(e, Math.max(18, Math.round(D * (1 - d/R*.62))));
  }
  const pd = Math.hypot(P.x - x, P.y - y);
  if (pd < 1.9) damagePlayer(Math.round(11 * (1 - pd/1.9)), x, y);
}

function shoot(){
  if (cooldown > 0 || !playing || wpnSwitch !== -1) return;
  if (P.stunT > 0){ cooldown = .2; beep("square", 70, .05, .05); return; }
  const g = GUNS[gun];
  if (g.ammo && ammo[g.ammo] <= 0){ beep("square", 90, .08, .07); cooldown = .3; return; }
  if (g.ammo) ammo[g.ammo]--;
  cooldown = g.cd; recoil = 1;
  flash = g.launcher ? 0 : 1;
  if (mpActive()) mpFireMark();
  beep("square", g.snd[0], g.snd[1], g.snd[2]);
  if (gun === 1) noiseBurst(.3, .35, 2600, 1);
  else if (g.launcher) noiseBurst(.2, .3, 900, 1);
  playFireAnim();
  const mult = (BT.rage > 0 ? RAGE_MULT : 1) * skillMul();
  if (g.launcher){
    stat.fired++;
    if (mpIsClient()){ if (coop && coop.host) coopSend(coop.host.ch, {t:"gren", a:+P.a.toFixed(4)}); }
    else grenades.push({x:P.x + Math.cos(P.a)*.4, y:P.y + Math.sin(P.a)*.4,
                   vx:Math.cos(P.a)*7, vy:Math.sin(P.a)*7, t:0,
                   sx:P.x, sy:P.y});
  } else {
    for (let i=0;i<g.pellets;i++){
      stat.fired++;
      hitscan((Math.random()*2-1)*g.spread, g.dmg * mult);
    }
  }
  updateHUD();
}

function switchGun(n){
  const N = GUNS.length;
  const dir = n < gun ? -1 : 1;
  let i = ((n % N) + N) % N;
  for (let k=0; k<N && !unlocked[i]; k++) i = ((i + dir) % N + N) % N;
  equip(i);
}

function canSee(e){
  const dx = e.x - P.x, dy = e.y - P.y;
  const d2 = dx*dx + dy*dy;
  if (d2 < .01) return true;
  const d = Math.sqrt(d2);
  const steps = Math.ceil(d * 8);
  const ix = dx / steps, iy = dy / steps;
  let x = P.x + ix, y = P.y + iy;
  for (let i=1;i<steps;i++,x+=ix,y+=iy){
    if (cell(x, y)) return false;
  }
  return true;
}

function damagePlayer(amount, sx, sy){
  if (mpTarget){ mpHurt(mpTarget, amount, sx, sy); return; }
  if (P.dead) return;
  if (P.inv > 0 || god) return;
  if (BT.shield > 0) amount *= SHIELD_TAKE;
  if (sx !== undefined){
    const rel = angleDiff(Math.atan2(sy - P.y, sx - P.x), P.a);
    P.hitDir = Math.abs(rel) < .6 ? 0 : (rel < 0 ? -1 : 1);
  } else P.hitDir = 0;
  P.hitT = .45;
  P.inv = INV_TIME;
  if (P.armor > 0){
    const absorbed = Math.min(P.armor, amount * .45);
    P.armor -= absorbed;
    amount -= absorbed;
  }
  P.hp -= amount;
  P.hurt = .9;
  beep("square", 80, .22, .28);
  updateHUD();
  if (P.hp <= 0 && god) P.hp = 100;
  if (P.hp <= 0 && lives > 0){ startRevive(); return; }
  if (P.hp <= 0){ if (mpActive()) mpDie(); else gameOver(); }
}

var voiceTokens = 4;
var VOICE_RATE = 3, VOICE_CAP = 4;
var breathCD = 0;

function voiceOK(){
  if (voiceTokens < 1) return false;
  voiceTokens -= 1;
  return true;
}

function update(dt){
  voiceTokens = Math.min(VOICE_CAP, voiceTokens + dt*VOICE_RATE);
  if (breathCD > 0) breathCD -= dt;
  let fw = 0, st = 0;
  if (keys.w || keys.arrowup) fw += 1;
  if (keys.s || keys.arrowdown) fw -= 1;
  if (keys.a) st -= 1;
  if (keys.d) st += 1;
  if (keys.arrowleft) P.a -= 2.2*dt;
  if (keys.arrowright) P.a += 2.2*dt;
  fw += touch.fw; st += touch.st;

  const sprint = gun === 0 && wpnSwitch === -1 ? 1.04 : 1;
  const sp = 2.7 * (BT.haste > 0 ? 1.28 : 1) * (P.slowT > 0 ? .7 : 1) * sprint * dt;
  if ((fw || st) && !P.dead){
    const len = Math.hypot(fw, st) || 1;
    const f = fw/len, s = st/len;
    const bx = P.x, by = P.y;
    move((Math.cos(P.a)*f - Math.sin(P.a)*s)*sp, (Math.sin(P.a)*f + Math.cos(P.a)*s)*sp);
    const walked = Math.hypot(P.x - bx, P.y - by);
    bobPhase += walked * 5.2;
    stepAcc += walked;
    if (stepAcc > 1.35){
      stepAcc = 0;
      noiseBurst(.07, .05, 260, .8, (Math.random()*2 - 1)*.3);
    }
  }

  if ((keys[" "] || mouseHeld || fireHeld) && !P.dead) shoot();

  cooldown = Math.max(0, cooldown - dt);
  recoil = Math.max(0, recoil - dt*3.5);
  flash = Math.max(0, flash - dt*9);
  boomLight = Math.max(0, boomLight - dt*2.6);
  P.hurt = Math.max(0, P.hurt - dt*2);
  P.inv = Math.max(0, P.inv - dt);
  clock += dt; stat.t += dt;
  updateLight(dt);
  updateWeapon(dt);
  if (backT > 0) backT -= dt;
  ambience(dt);
  updateFace(dt);
  const low = P.hp < 40 ? (1 - P.hp/40) : 0;
  HUD.lowhp.style.opacity =
    low ? (low * (.45 + .3*Math.sin(clock*6))).toFixed(2) : 0;

  if (comboT > 0){
    comboT -= dt;
    if (comboT <= 0){ combo = 0; HUD.combo.classList.remove("show"); }
  }

  if (shake > 0) shake = Math.max(0, shake - dt*1.6);
  if (parts.length) updateParts(dt);
  if (beams.length && !mpIsClient()) updateBeams(dt);
  if (P.stunT > 0) P.stunT -= dt;
  if (bossRef && !mpIsClient()) supplyTick(dt);
  if (P.slowT > 0) P.slowT -= dt;
  runTime += dt;
  if (finalOutro){
    finalOutro.t += dt;
    finalOutro.next -= dt;
    if (finalOutro.next <= 0 && finalOutro.t < 2.2){
      finalOutro.next = .13;
      const a = Math.random() * 6.283, r = Math.random() * 2.6;
      booms.push({x:finalOutro.x + Math.cos(a)*r, y:finalOutro.y + Math.sin(a)*r, t:0});
      boomLight = 1; boomX = finalOutro.x; boomY = finalOutro.y;
      shake = Math.max(shake, .9);
      noiseBurst(.35, .2, 700, .8);
    }
    if (finalOutro.t > 2.6){ finalOutro = null; showDiploma(); }
  }
  const bb = document.getElementById("bossbar");
  if (bossRef && bossRef.alive){
    const pct = Math.max(0, bossRef.hp / bossRef.maxHp);
    const key = Math.ceil(bossRef.hp) + "|" + (bossRef.phase || 0);
    if (bb.dataset.k !== String(key)){
      bb.dataset.k = key;
      document.getElementById("bossfill").style.width = (pct * 100).toFixed(1) + "%";
      document.getElementById("bossnum").textContent = (bossRef.kind === "final" ? FINAL_PHASES[bossRef.phase || 1] + " · " : "")
        + `${shortNum(Math.max(0, Math.ceil(bossRef.hp)))} / ${shortNum(bossRef.maxHp)}`;
      document.getElementById("bossname").textContent = bossRef.name;
      document.getElementById("bosshp").classList.toggle("final", bossRef.kind === "final");
    }
    if (bb.classList.contains("gone")){ bb.classList.remove("gone"); layoutBossBar(); }
  } else bb.classList.add("gone");

  const buffEl = HUD.buff;
  let bKey = "", expired = false;
  for (const k in BT){
    if (BT[k] <= 0) continue;
    BT[k] -= dt;
    if (BT[k] <= 0){ BT[k] = 0; expired = true; continue; }
    bKey += (bKey ? "   " : "") + `${BUFFS[k].name} · ${Math.ceil(BT[k])}`;
  }
  if (expired){ beep("sine", 200, .2, .1); updateInvUI(); }
  if (bKey !== buffShownKey){
    buffShownKey = bKey;
    if (bKey){ buffEl.textContent = bKey; buffEl.classList.remove("gone"); }
    else buffEl.classList.add("gone");
  }

  if (!mpIsClient()) for (const b of grenades){
    b.t += dt;
    const ox = b.x, oy = b.y;
    b.x += b.vx*dt; b.y += b.vy*dt;
    let hitE = null;
    for (const e of enemies){
      if (!e.alive) continue;
      if (segDist(e.x, e.y, ox, oy, b.x, b.y) < HITR(e)){ hitE = e; break; }
    }
    const flown = Math.hypot(b.x - b.sx, b.y - b.sy);
    if (hitE || solid(b.x, b.y, .1) || flown > 12 || b.t > 2){
      b.dead = true;
      explode(hitE ? hitE.x : ox, hitE ? hitE.y : oy);
    }
  }
  for (let i=grenades.length-1; i>=0; i--) if (grenades[i].dead) grenades.splice(i, 1);
  for (const e of booms) e.t += dt;
  for (let i=booms.length-1; i>=0; i--) if (booms[i].t > .45) booms.splice(i, 1);
  if (mpIsClient()){ mpClientTick(dt); return; }
  P.pick = Math.max(0, P.pick - dt*2);
  HUD.hurt.style.opacity = P.hurt;
  HUD.pick.style.opacity = P.pick;

  flowCd -= dt;
  const pCell = (P.y|0)*MW + (P.x|0);
  if (flowCd <= 0 || pCell !== flowCell){ buildFlow(); flowCell = pCell; flowCd = .25; }

  let aliveLeft = 0;
  for (const e of enemies){
    if (mpTarget) mpRestore();
    if (e.hurtT > 0) e.hurtT -= dt;
    if (!e.alive){ e.deadT += dt; continue; }
    aliveLeft++;
    if (dbgFreeze) continue;
    if (MP && MP.role === "host") mpSwapFor(e);
    if (e.paper){ paperAI(e, dt); continue; }
    e.t += dt; e.cd -= dt;
    const k = KIND[e.type];
    const dx = P.x - e.x, dy = P.y - e.y;
    const d2 = dx*dx + dy*dy;
    const d = Math.sqrt(d2) || 1;

    const ux = dx/d, uy = dy/d;
    let mx = ux, my = uy;
    e.seeT -= dt;
    if (e.seeT <= 0){
      e.seeT = .075;
      e.sees = canSee(e);
    }
    const sees = e.sees;
    if (sees && !e.seen && d < 13){
      e.seen = true;
      if (d < 8 || voiceOK()){
      const a = atPos(e.x, e.y);
      const f = k.melee ? (e.type === "bull" ? 90 : 150) : 220;
      beep("sawtooth", f, .35, .14*a.vol, f*.4, a.pan);
      noiseBurst(.3, .11*a.vol, 700, .8, a.pan);
      }
    }
    e.voiceT = (e.voiceT || 2 + Math.random()*4) - dt;
    if (e.voiceT <= 0 && d < 13){
      e.voiceT = 3 + Math.random()*5;
      if (voiceOK()){
      const a = atPos(e.x, e.y);
      const f = e.type === "bull" ? 62 : e.type === "caster" ? 190 : 120;
      beep("sawtooth", f, .5, .07*a.vol, f*.55, a.pan);
      if (e.type === "bull") noiseBurst(.4, .05*a.vol, 320, .7, a.pan);
      }
    }
    if (d < 2.8 && Math.abs(angleDiff(Math.atan2(-dy, -dx), P.a)) > 1.1){
      e.breathT = (e.breathT || 0) - dt;
      if (e.breathT <= 0 && breathCD <= 0){
        e.breathT = .8 + Math.random()*.5;
        breathCD = .8;
        const a = atPos(e.x, e.y);
        noiseBurst(.35, .12, 420, .5, a.pan);
        backT = .5;
      }
    }
    if (!sees || d > 3 || (e.boss && e.pathT > 0) || !clearPath(e, d, ux, uy)){
      const f = flowDir(e);
      if (f){ mx = f.x; my = f.y; }
    }
    if (e.boss){
      const bx = e.x, by = e.y;
      if (e.guard > 0) e.guard = Math.max(0, e.guard - dt);
      bossAI(e, dt, d, ux, uy, mx, my, sees);
      if (e.alive && !e.blink){
        const moved = Math.hypot(e.x - bx, e.y - by);
        const wants = d > 2.3 && (e.dash > 0 || e.kind === "tank" || e.kind === "berserk" || !sees);
        if (wants && moved < e.speed*dt*.25){
          const s2 = e.speed*dt*1.2, ox = e.x, oy = e.y;
          moveEnemy(e, -my*s2*e.slideDir, mx*s2*e.slideDir);
          if (Math.hypot(e.x - ox, e.y - oy) < s2*.2) e.slideDir *= -1;
        }
        if (e.ax === undefined){ e.ax = e.x; e.ay = e.y; e.anchT = 0; }
        e.anchT += dt;
        if (e.pathT > 0) e.pathT -= dt;
        if (e.anchT >= 1.2){
          const net = Math.hypot(e.x - e.ax, e.y - e.ay);
          e.stuckN = wants && net < .45 ? (e.stuckN || 0) + 1 : 0;
          e.ax = e.x; e.ay = e.y; e.anchT = 0;
          if (e.stuckN >= 1) e.pathT = 1.5;
          if (e.stuckN >= 2){
            e.stuckN = 0; e.dash = 0;
            const f = blinkTarget(e, 3, 5.5);
            if (f) bossBlink(e, f.x, f.y);
          }
        }
      }
      continue;
    }
    let wx = 0, wy = 0, wantMove = false;

    if (k.melee){
      if (d > k.reach){ wx = mx; wy = my; wantMove = true; }
      else if (e.cd <= 0 && sees){
        e.cd = k.rate * rateMul();
        damagePlayer(k.dmg + dmgBonus(), e.x, e.y);
      }
    } else {
      const want = 4.5;
      if (!sees){ wx = mx; wy = my; wantMove = true; }
      else if (d > want + .5){ wx = mx; wy = my; wantMove = true; }
      else if (d < want - .5){
        if (!solid(e.x - ux*.7, e.y - uy*.7, ER)){ wx = -ux; wy = -uy; wantMove = true; }
        else if (!solid(e.x - uy*e.slideDir*.7, e.y + ux*e.slideDir*.7, ER)){ wx = -uy*e.slideDir; wy = ux*e.slideDir; wantMove = true; }
        else e.slideDir *= -1;
      }
      if (e.cd <= 0 && d < k.reach && sees){
        e.cd = k.rate * rateMul();
        shots.push({x:e.x, y:e.y, vx:ux*shotSpeed(), vy:uy*shotSpeed(), t:0});
        beep("sine", 260, .2, .12, 120);
      }
    }

    if (wantMove){
      if (e.slideT > 0){
        e.slideT -= dt;
        const sx = wx*.4 - wy*e.slideDir, sy = wy*.4 + wx*e.slideDir;
        const l = Math.hypot(sx, sy) || 1;
        wx = sx/l; wy = sy/l;
      }
      const step = e.speed*dt;
      const px = e.x, py = e.y;
      moveEnemy(e, wx*step, wy*step);
      if ((e.x - px)*(e.x - px) + (e.y - py)*(e.y - py) < step*step*.25){
        e.stuck += dt;
        if (e.stuck > .16){
          e.stuck = 0;
          e.slideDir = Math.random() < .5 ? 1 : -1;
          e.slideT = .4 + Math.random()*.5;
        }
      } else if (e.slideT <= 0) e.stuck = 0;
    } else { e.stuck = 0; e.slideT = 0; }
  }
  if (mpTarget) mpRestore();

  for (const e of enemies){
    if (!e.alive) continue;
    const dx = P.x - e.x, dy = P.y - e.y;
    const rr = PR + HITR(e)*.7;
    const d2 = dx*dx + dy*dy;
    if (d2 > rr*rr || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), push = (rr - d);
    move(dx/d*push, dy/d*push);
  }

  // Broad-phase collision: only test enemies in the same/adjacent 1x1 cells.
  cellHead.fill(-1);
  if (cellNext.length < enemies.length) cellNext = new Int32Array(enemies.length * 2);
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if (!e.alive) continue;
    const gx = Math.floor(e.x), gy = Math.floor(e.y);
    if (gx < 0 || gy < 0 || gx >= MW || gy >= MH) continue;
    const c = gy * MW + gx;
    cellNext[i] = cellHead[c];
    cellHead[c] = i;
  }

  const minD = .62, minD2 = minD * minD;
  for (let i=0; i<enemies.length; i++){
    const a = enemies[i];
    if (!a.alive) continue;
    const gx = Math.floor(a.x), gy = Math.floor(a.y);
    for (let oy=-1; oy<=1; oy++){
      const cy = gy + oy;
      if (cy < 0 || cy >= MH) continue;
      for (let ox=-1; ox<=1; ox++){
        const cx = gx + ox;
        if (cx < 0 || cx >= MW) continue;
        for (let j = cellHead[cy * MW + cx]; j !== -1; j = cellNext[j]){
          if (j <= i) continue;
          const b = enemies[j];
          if (!b.alive) continue;
          const sx = b.x - a.x, sy = b.y - a.y;
          const q = sx*sx + sy*sy;
          if (q > minD2) continue;
          const sd = Math.sqrt(q) || .001;
          const push = (minD - sd)*.5;
          const nx = sx/sd*push, ny = sy/sd*push;
          moveEnemy(a, -nx, -ny);
          moveEnemy(b, nx, ny);
        }
      }
    }
  }
  {
    let j = 0;
    for (let i = 0; i < enemies.length; i++){
      const e = enemies[i];
      if (e.alive || e.deadT < 2.6) enemies[j++] = e;
    }
    enemies.length = j;
  }
  for (const e of enemies){
    if (!e.alive) e.bloodT = Math.max(0, (e.bloodT || 2.6) - dt);
  }

  for (const b of shots){
    b.t += dt;
    const ox = b.x, oy = b.y;
    b.x += b.vx*dt; b.y += b.vy*dt;
    if (!P.dead && segDist(P.x, P.y, ox, oy, b.x, b.y) < PR + (b.big ? .38 : .18)){
      b.dead = true; damagePlayer(b.dmg || (FIREBALL_DMG + dmgBonus()), b.x, b.y);
    } else if (mpIsHost()){
      for (const p of mpPeers()){
        if (p.gs.alive && segDist(p.gs.x, p.gs.y, ox, oy, b.x, b.y) < PR + (b.big ? .38 : .18)){
          b.dead = true; mpHurt(p, b.dmg || (FIREBALL_DMG + dmgBonus()), b.x, b.y); break;
        }
      }
    } else if (solid(b.x, b.y, .1) || cell(b.x, b.y)) b.dead = true;
    if (b.t > 6) b.dead = true;
  }
  {
    let j = 0;
    for (let i = 0; i < shots.length; i++) if (!shots[i].dead) shots[j++] = shots[i];
    shots.length = j;
  }

  for (const it of items){
    it.t += dt;
    if (P.dead) continue;
    const ix = it.x - P.x, iy = it.y - P.y;
    if (ix*ix + iy*iy > (PR + .38)*(PR + .38)) continue;
    let taken = true;
    if (it.kind === "life"){
      if (lives >= LIVES_MAX) taken = false;
      else {
        lives++;
        rbdSound();
        showBanner("ВТОРАЯ ЖИЗНЬ", true, `жизней в запасе: ${lives}`);
        beep("sine", 520, .5, .18, 1040);
        setTimeout(() => beep("sine", 780, .5, .14, 1560), 150);
        updateLivesUI();
      }
    } else if (it.kind === "medkit"){
      if (P.hp >= 100) taken = false; else P.hp = Math.min(100, P.hp + 22);
    } else if (it.kind === "armor"){
      if (P.armor >= 100) taken = false; else P.armor = Math.min(100, P.armor + 30);
    } else if (it.kind === "bullets") taken = giveAmmo("bullets", curve().bulletAmt);
    else if (it.kind === "shells") taken = giveAmmo("shells", curve().shellAmt);
    else if (it.kind === "grenades") taken = giveAmmo("grenades", 4);
    else if (GUN_OF[it.kind] !== undefined && mpIsHost() && unlocked[GUN_OF[it.kind]]) taken = false;
    else if (GUN_OF[it.kind] !== undefined){
      const n = GUN_OF[it.kind];
      unlocked[n] = true;
      const gl = LAMPS.find(L => L.gun === it.kind);
      if (gl && mpIsHost()) mpGunLampOff(it.kind, it);
      else if (gl){
        gl.state = "off"; gl.val = 0; gl.gun = null;
        composeLight();
        const a = atPos(gl.x + .5, gl.y + .5);
        beep("square", 90, .12, .08*a.vol, 40, a.pan);
        noiseBurst(.1, .06*a.vol, 2600, 1, a.pan);
      }
      if (wpnSwitch === -1){ wpnSwitch = n; wpnSeq = null; }
      if (n === 1) ammo.shells += 8;
      if (n === 2) ammo.bullets += 30;
      if (n === 3) giveAmmo("grenades", 8);
      showBanner(`${GUNS[n].name} НАЙДЕН`, true);
      beep("square", 300, .5, .18, 900);
    } else if (BUFFS[it.kind]){
      const k = it.kind;
      if (inv[k] < INV_MAX){
        inv[k]++;
        showBanner(`${BUFFS[k].name} В ЗАПАСЕ`, true,
          HAS_TOUCH ? "включай кнопкой справа, когда нужно" : "включай клавишами Z / X / C");
      } else {
        BT[k] = Math.min(BUFF_CAP, BT[k] + BUFFS[k].time);
        buffShownKey = "";
        showBanner(BUFFS[k].name, true, "запас полон — включён сразу");
      }
      beep("sine", 400, .4, .16, 1100);
      updateInvUI();
    }
    if (taken){
      it.dead = true; P.pick = .8;
      beep("sine", 880, .12, .12, 1400);
      updateHUD();
    }
  }
  if (mpIsHost()) mpRemotePickups();
  {
    let j = 0;
    for (let i = 0; i < items.length; i++) if (!items[i].dead) items[j++] = items[i];
    items.length = j;
  }

  if (aliveLeft !== enemiesLeft){ enemiesLeft = aliveLeft; updateHUD(); }

  if (portal){
    portal.t += dt;
    if (portal.t > .9 && ((!P.dead && Math.hypot(P.x - portal.x, P.y - portal.y) < .75) || (mpIsHost() && mpNearPlayer(portal.x, portal.y, .75)))){
      portal = null;
      beep("sine", 900, .5, .2, 120);
      noiseBurst(.6, .2, 1800, .8);
      nextLevel();
      return;
    }
  }
  if (isBossLevel() && aliveLeft === 0 && !portal && playing && !sandbox){
    portalT -= dt;
    if (portalT <= 0) openPortal(bossRef || P);
  }
  if (aliveLeft === 0 && playing && !sandbox && !isBossLevel()) nextLevel();
}

var SPR = [], sprN = 0, drawn = [];

var SPR_CACHE = new Map(), FALLEN = new Map(), SPR_LEVELS = 48;
function spriteDirty(img){ if (!SPR_CACHE) return; SPR_CACHE.delete(img); const f = FALLEN.get(img); if (f){ SPR_CACHE.delete(f); FALLEN.delete(img); } }

function fallenOf(img){
  let c = FALLEN.get(img);
  if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.translate(32, 39); g.rotate(Math.PI/2); g.scale(1.02, .62);
  g.drawImage(img, -32, -32, 64, 64);
  FALLEN.set(img, c);
  return c;
}

function shadedSprite(img, bright, hurt, tint){
  let m = SPR_CACHE.get(img);
  if (!m){ m = new Map(); SPR_CACHE.set(img, m); }
  const bi = bright > 1 ? SPR_LEVELS + Math.min(8, Math.round((bright - 1) * 20))
                        : Math.max(0, Math.min(SPR_LEVELS, Math.round(bright * SPR_LEVELS)));
  const key = tint ? `${bi}${hurt ? "h" : ""}|${tint}` : (hurt ? -1 - bi : bi);
  let c = m.get(key);
  if (c) return c;
  const w = img.width || 64, h = img.height || 64;
  c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  const b = bi <= SPR_LEVELS ? bi / SPR_LEVELS : 1 + (bi - SPR_LEVELS) / 20;
  if (b > 1){
    g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, b - 1);
    g.drawImage(img, 0, 0); g.globalAlpha = 1;
  } else if (b < 1){
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = FOG_BLACK[((1 - b) * 255 + .5) | 0];
    g.fillRect(0, 0, w, h);
  }
  if (tint){ g.globalCompositeOperation = "source-atop"; g.fillStyle = tint; g.fillRect(0, 0, w, h); }
  if (hurt){ g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(255,235,220,.55)"; g.fillRect(0, 0, w, h); }
  g.globalCompositeOperation = "source-over";
  m.set(key, c);
  return c;
}

function drawSpans(src, from, to, x0, y0, sw, sh, ty){
  const TW = src.width;
  let x = from;
  while (x < to){
    while (x < to && ty >= zbuf[x]) x++;
    if (x >= to) break;
    const s = x;
    while (x < to && ty < zbuf[x]) x++;
    const t0 = Math.max(0, (s - x0) * TW / sw), t1 = Math.min(TW, (x - x0) * TW / sw);
    if (t1 > t0) ctx.drawImage(src, t0, 0, t1 - t0, src.height, x0 + t0*sw/TW, y0, (t1 - t0)*sw/TW, sh);
  }
}
var EYE_STYLE = [];
for (let i = 0; i < 64; i++) EYE_STYLE.push(`rgba(190,30,20,${(i/63).toFixed(3)})`);
function eyeVisible(x, w, ty){
  const a = Math.max(0, Math.floor(x)), b = Math.min(W - 1, Math.ceil(x + w) - 1);
  if (a > b) return false;
  for (let c = a; c <= b; c++) if (ty >= zbuf[c]) return false;
  return true;
}

var TEXD = {};
function texLevel(hit, side, lvl){
  let t = TEXD[hit];
  if (!t) t = TEXD[hit] = [[], []];
  let c = t[side][lvl];
  if (!c){
    const src = (TEX[hit] || TEX[1])[side];
    c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    if (lvl > 0){ g.fillStyle = FOG_STYLE[Math.min(255, lvl*4 + 2)]; g.fillRect(0, 0, 64, 64); }
    t[side][lvl] = c;
  }
  return c;
}

var LIGHT_COLORS = [[255,120,40], [210,55,30], [230,196,40], [70,165,215], [255,150,60], [255,214,150], [170,90,255], [255,70,100]];
var PORTAL_FRAMES = (() => {
  const frames = [];
  for (let f = 0; f < 16; f++){
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    const rot = f / 16 * Math.PI * 2;
    g.save(); g.translate(32, 32); g.scale(.62, 1);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    core.addColorStop(0, "rgba(255,245,255,.95)");
    core.addColorStop(.25, "rgba(200,140,255,.9)");
    core.addColorStop(.6, "rgba(110,40,200,.75)");
    core.addColorStop(1, "rgba(40,0,90,0)");
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI*2); g.fill();
    for (let arm = 0; arm < 4; arm++){
      g.strokeStyle = arm % 2 ? "rgba(120,220,255,.55)" : "rgba(235,200,255,.6)";
      g.lineWidth = 2.2;
      g.beginPath();
      for (let i = 0; i <= 26; i++){
        const t = i / 26, a = rot + arm * Math.PI/2 + t * 4.2, r = 2 + t * 26;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = "rgba(220,180,255,.8)"; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 29, 0, Math.PI*2); g.stroke();
    g.restore();
    frames.push(c);
  }
  return frames;
})();
function lampArt(on){
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#1c1a18"; g.fillRect(29, 0, 6, 20);
  g.fillStyle = "#34302b"; g.fillRect(16, 18, 32, 10);
  g.fillStyle = "#4a443c"; g.fillRect(16, 18, 32, 3);
  g.fillStyle = on ? "#fff4d6" : "#3a3833";
  g.fillRect(22, 28, 20, 9);
  if (on){ g.fillStyle = "#ffd98a"; g.fillRect(24, 30, 16, 5); }
  return c;
}
var LAMP_ON = lampArt(true), LAMP_OFF = lampArt(false);
var LAMP_CONE = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const raw = document.createElement("canvas"); raw.width = raw.height = 64;
  const r = raw.getContext("2d");
  const cone = r.createLinearGradient(0, 12, 0, 60);
  cone.addColorStop(0, "rgba(255,214,150,.42)");
  cone.addColorStop(.6, "rgba(255,200,130,.12)");
  cone.addColorStop(1, "rgba(255,190,120,.03)");
  r.fillStyle = cone;
  r.beginPath(); r.moveTo(28, 12); r.lineTo(36, 12); r.lineTo(58, 60); r.lineTo(6, 60); r.closePath(); r.fill();
  r.save();
  r.translate(32, 59); r.scale(1, .2);
  const pool = r.createRadialGradient(0, 0, 0, 0, 0, 28);
  pool.addColorStop(0, "rgba(255,214,150,.55)");
  pool.addColorStop(.5, "rgba(255,200,130,.2)");
  pool.addColorStop(1, "rgba(255,190,120,0)");
  r.fillStyle = pool;
  r.beginPath(); r.arc(0, 0, 28, 0, Math.PI*2); r.fill();
  r.restore();
  g.filter = "blur(2px)";
  g.drawImage(raw, 0, 0);
  g.filter = "none";
  return c;
})();
var BUFF_LIGHT = { rage:1, haste:2, shield:3, life:7 };
var TINT = LIGHT_COLORS.map(([r,g,b]) => {
  const a = [];
  for (let i = 0; i < 32; i++) a.push(`rgba(${r},${g},${b},${(i/31*.45).toFixed(3)})`);
  return a;
});
var GLOW = LIGHT_COLORS.map(([r,g,b]) => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g2 = c.getContext("2d");
  const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(255,255,255,.55)`);
  gr.addColorStop(.18, `rgba(${r},${g},${b},.5)`);
  gr.addColorStop(.55, `rgba(${r},${g},${b},.14)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  return c;
});
var LX = new Float32Array(64), LY = new Float32Array(64), LR2 = new Float32Array(64),
    LI = new Float32Array(64), LC = new Uint8Array(64), LH = new Float32Array(64);
var nL = 0;
var TC = new Uint8Array(512), TA = new Uint8Array(512), TY0 = new Float32Array(512), TY1 = new Float32Array(512);

function addLight(x, y, r, inten, color, yOff){
  if (nL >= 64 || inten <= .01) return;
  LX[nL] = x; LY[nL] = y; LR2[nL] = r*r; LI[nL] = inten; LC[nL] = color; LH[nL] = yOff;
  nL++;
}

function collectLights(){
  nL = 0;
  for (const b of shots) addLight(b.x, b.y, 3.0, .8, 0, .05);
  for (const it of items){
    const c = BUFF_LIGHT[it.kind];
    if (c !== undefined) addLight(it.x, it.y, 2.6, .7 * (.8 + .2*Math.sin(clock*5 + it.x)), c, .32);
  }
  for (const e of booms) addLight(e.x, e.y, 5.5, 1.5 * Math.max(0, 1 - e.t/.45), 4, .05);
  if (portal) addLight(portal.x, portal.y, 4.5, Math.min(1, portal.t / .9) * (1 + .15*Math.sin(clock*4)), 6, 0);
  if (mpActive()) mpLights();
  for (const b of beams){
    if (b.t < b.aimT){ addLight(b.owner.x, b.owner.y, 3.5, .7 * Math.min(1, b.t / b.aimT), 1, 0); continue; }
    const p = beamPoints(b)[0], len = rayLen(p.x, p.y, b.ang, 30), dx = Math.cos(b.ang), dy = Math.sin(b.ang);
    for (let s = 1; s < len; s += 3) addLight(p.x + dx*s, p.y + dy*s, 2.6, .9, 1, 0);
  }
}

function lightAt(x, y){
  let lit = 0;
  for (let i = 0; i < nL; i++){
    const dx = LX[i] - x, dy = LY[i] - y, d2 = dx*dx + dy*dy;
    if (d2 >= LR2[i]) continue;
    let f = 1 - d2/LR2[i];
    lit += f*f*LI[i];
  }
  return lit;
}
var byDepth = (a, b) => b.ty - a.ty;

var FOG_LUT_K = 2048, FOG_LUT_MAX = 1.1;
var FOG_LUT = new Uint8Array(FOG_LUT_K + 1);
var FOG_IDX_SAT = 0, FOG_U_MIN = 0, fogGamma = -1;
function buildFogLUT(g){
  fogGamma = g;
  for (let i = 0; i <= FOG_LUT_K; i++){
    const u = i / FOG_LUT_K * FOG_LUT_MAX;
    const fog = Math.min(.97, Math.pow(u, 1.35) * .93);
    FOG_LUT[i] = ((1 - Math.pow(1 - fog, 1 / g)) * 255 + .5) | 0;
  }
  FOG_IDX_SAT = ((1 - Math.pow(.03, 1 / g)) * 255 + .5) | 0;
  FOG_U_MIN = Math.pow((1 - Math.pow(.98, g)) / .93, 1 / 1.35);
}
buildFogLUT(SET.gamma);
var FOG_STYLE = [], FOG_BLACK = [];
for (let i = 0; i < 256; i++){
  FOG_STYLE.push(`rgba(6,4,6,${(i/255).toFixed(3)})`);
  FOG_BLACK.push(`rgba(0,0,0,${(i/255).toFixed(3)})`);
}

function render(){
  const dirX = Math.cos(P.a), dirY = Math.sin(P.a);
  const planeX = -dirY*CAM_PLANE, planeY = dirX*CAM_PLANE;
  const shakeAmp = (P.hp < 45 ? (1 - P.hp/45)*2.2 : 0) + (P.hitT > 0 ? P.hitT*9 : 0) + shake*6;
  const horizon = H*.5 + (shakeAmp ? Math.sin(clock*17)*shakeAmp + (Math.random()-.5)*shakeAmp*.6 : 0);

  if (fogGamma !== SET.gamma) buildFogLUT(SET.gamma);
  const flick = lightNow / lightBase;
  const invG = 1 / SET.gamma;
  const fogK = FOG_LUT_K / FOG_LUT_MAX;
  const L = Math.pow(Math.max(0, levelL * playerLight * flick), invG);
  const mix = (a, b, t) => Math.round(a + (b - a)*t);
  const dim = (r, gg, b, k) => `rgb(${mix(0,r,k)},${mix(0,gg,k)},${mix(0,b,k)})`;
  let g = ctx.createLinearGradient(0,0,0,horizon);
  g.addColorStop(0, dim(16,10,20, L*.5)); g.addColorStop(1, dim(43,29,34, L));
  ctx.fillStyle = g; ctx.fillRect(0,0,W,horizon);
  g = ctx.createLinearGradient(0,horizon,0,H);
  g.addColorStop(0, dim(36,26,21, L*.55)); g.addColorStop(1, dim(74,56,44, L));
  ctx.fillStyle = g; ctx.fillRect(0,horizon,W,H-horizon);

  collectLights();
  for (let x=0; x<W; x++){
    const cam = 2*x/W - 1;
    const rdx = dirX + planeX*cam, rdy = dirY + planeY*cam;
    let mx = P.x|0, my = P.y|0;
    const ddx = Math.abs(1/rdx), ddy = Math.abs(1/rdy);
    let sx, sy, sdx, sdy;
    if (rdx < 0){ sx = -1; sdx = (P.x-mx)*ddx; } else { sx = 1; sdx = (mx+1-P.x)*ddx; }
    if (rdy < 0){ sy = -1; sdy = (P.y-my)*ddy; } else { sy = 1; sdy = (my+1-P.y)*ddy; }
    let side = 0, hit = 0, guard = 0;
    while (!hit && guard++ < 128){
      if (sdx < sdy){ sdx += ddx; mx += sx; side = 0; }
      else { sdy += ddy; my += sy; side = 1; }
      hit = (mx < 0 || my < 0 || mx >= MW || my >= MH) ? 1 : GRID[my*MW + mx];
    }
    const dist = side === 0 ? (sdx - ddx) : (sdy - ddy);
    zbuf[x] = Math.max(.05, dist);
    const lh = H / zbuf[x];
    const y0 = Math.max(0, horizon - lh/2);
    const y1 = Math.min(H, horizon + lh/2);

    let wallX = side === 0 ? P.y + dist*rdy : P.x + dist*rdx;
    wallX -= Math.floor(wallX);
    let texX = (wallX*64) | 0;
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 63 - texX;
    const hx = P.x + dist*rdx, hy = P.y + dist*rdy;
    const Lc = levelL * lightSample(side === 0 ? hx - sx*.5 : hx, side === 1 ? hy - sy*.5 : hy) * flick;
    let fi = -1;
    if (brightMode){
      if (dist > 1.2) fi = (Math.min(.35, dist/60) * 255 + .5) | 0;
    } else {
      const u = dist / (7.2 * Lc);
      if (u > FOG_U_MIN) fi = u >= FOG_LUT_MAX ? FOG_IDX_SAT : FOG_LUT[(u * fogK) | 0];
    }

    TA[x] = 0;
    if (nL){
      const hx = P.x + rdx*dist, hy = P.y + rdy*dist;
      let lit = 0, best = 0, bestC = 0;
      for (let i = 0; i < nL; i++){
        if (side === 0 ? (LX[i] - hx) * sx > 0 : (LY[i] - hy) * sy > 0) continue;
        const ddx2 = LX[i] - hx, ddy2 = LY[i] - hy, d2 = ddx2*ddx2 + ddy2*ddy2;
        if (d2 >= LR2[i]) continue;
        let f = 1 - d2/LR2[i]; f = f*f*LI[i];
        lit += f;
        if (f > best){ best = f; bestC = LC[i]; }
      }
      if (lit > .02){
        if (fi >= 0){
          fi = (fi * (1 - Math.min(1, lit) * .75)) | 0;
          if (fi < 5) fi = -1;
        }
        const a = Math.min(31, (lit * 22) | 0);
        if (a > 0){ TA[x] = a; TC[x] = bestC; TY0[x] = y0; TY1[x] = y1; }
      }
    }

    const lvl = fi < 0 ? 0 : Math.max(1, fi >> 2);
    ctx.drawImage(texLevel(hit || 1, side, lvl), texX, 0, 1, 64, x, horizon - lh/2, 1, lh);
  }

  if (nL){
    ctx.globalCompositeOperation = "lighter";
    for (let x = 0; x < W; x++){
      if (!TA[x]) continue;
      ctx.fillStyle = TINT[TC[x]][TA[x]];
      ctx.fillRect(x, TY0[x], 1, TY1[x] - TY0[x]);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  if (flash > .04){
    const gr = ctx.createLinearGradient(0, horizon - H*.5, 0, H);
    gr.addColorStop(0, `rgba(255,190,90,0)`);
    gr.addColorStop(1, `rgba(255,190,90,${(flash*.18).toFixed(3)})`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }
  if (boomLight > .04){
    const bd = Math.hypot(boomX - P.x, boomY - P.y);
    const k = boomLight * Math.max(.12, 1 - bd/14);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,150,60,${(k*.34).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  const invDet = 1/(planeX*dirY - dirX*planeY);
  sprN = 0;
  drawn.length = 0;
  const addSprite = (x, y, img, scale, yOff) => {
    const sx = x - P.x, sy = y - P.y;
    const ty = invDet*(-planeY*sx + planeX*sy);
    if (ty <= .15) return null;
    let o = SPR[sprN];
    if (!o){ o = {}; SPR[sprN] = o; }
    sprN++;
    o.x = x; o.y = y; o.img = img; o.scale = scale; o.yOff = yOff;
    o.tx = invDet*(dirY*sx - dirX*sy); o.ty = ty;
    o.hurt = false; o.eyes = false; o.dead = false; o.deadT = 0;
    o.deadBlood = false; o.bloodT = 0; o.boom = false; o.boomT = 0;
    o.emit = false; o.glow = -1; o.glowA = 0; o.tint = null; o.minB = 0; o.alpha = 1;
    drawn.push(o);
    return o;
  };

  if (mpActive()) mpAddPlayerSprites(addSprite);
  for (const e of enemies){
    if (e.paper){
      if (!e.alive) continue;
      const po = addSprite(e.x, e.y, PAPER_IMG, .5, .02 + Math.sin(clock*6 + e.t)*.05);
      if (po){ po.emit = true; po.hurt = e.hurtT > 0; }
      continue;
    }
    const k = KIND[e.type];
    const dead = !e.alive;
    const sc = e.scale || k.scale;
    const o = addSprite(e.x, e.y,
      dead ? ART.corpse[e.art || e.type] : ART[e.art || k.art][(e.t*4|0) % 2],
      dead ? sc * .92 : sc,
      dead ? (.24 + Math.min(.18, e.deadT*.55)) : (e.boss ? .5 - sc/2 : 0));
    if (o){
      o.tint = e.tint || null;
      if (e.kind === "final" && !dead) o.minB = .6;
      if (e.blink) o.alpha = blinkAlpha(e);
      else if (e.blinkA !== undefined && e.blinkA < 1) o.alpha = e.blinkA;
      if (e.laserA > 0) o.tint = `rgba(255,40,30,${(.2 + .3 * e.laserA).toFixed(2)})`;
      if (e.charge > 0) o.tint = "rgba(215,150,255,.55)";
      if (e.laser && e.laser.t < e.laser.aimT) o.tint = `rgba(255,40,30,${(.2 + .3 * e.laser.t / e.laser.aimT).toFixed(2)})`;
    }
    if (o){
      o.hurt = !dead && e.hurtT > 0;
      o.eyes = !dead && e.seen;
      o.dead = dead; o.deadT = e.deadT;
    }
    if (dead && e.deadT < 1.15){
      const b = addSprite(e.x, e.y, ART.bloodSplash,
        k.scale * (.45 + Math.min(.35, e.deadT*.65)), .47);
      if (b){ b.deadBlood = true; b.bloodT = e.deadT; }
    }
  }
  for (const it of items){
    const o = addSprite(it.x, it.y, ART[it.kind], .55, .32 + Math.sin(it.t*2)*.02);
    const c = BUFF_LIGHT[it.kind];
    if (o && c !== undefined){
      o.emit = true;
      const g = addSprite(it.x, it.y, GLOW[c], 1.3, .32);
      if (g){ g.glow = c; g.glowA = .6 + .18*Math.sin(clock*5 + it.x); }
    }
  }
  for (const L of LAMPS){
    const lit = L.val > .5;
    const o = addSprite(L.x + .5, L.y + .5, lit ? LAMP_ON : LAMP_OFF, .26, -.4);
    if (o && lit){
      o.emit = true;
      const cn = addSprite(L.x + .5, L.y + .5, LAMP_CONE, 1, 0);
      if (cn){ cn.glow = 5; cn.glowA = .7 * L.val; }
      const g = addSprite(L.x + .5, L.y + .5, GLOW[5], .7, -.37);
      if (g){ g.glow = 5; g.glowA = .45 * L.val; }
    }
  }
  for (const b of beams){
    const firing = b.t >= b.aimT;
    const locked = b.locked || b.t >= (b.lockT || (b.kind === "eyes" ? 1 : 0));
    const prog = Math.min(1, b.t / b.aimT);
    const dx = Math.cos(b.ang), dy = Math.sin(b.ang);
    for (const p of beamPoints(b)){
      if (!firing){
        const co = addSprite(p.x - dx*.3, p.y - dy*.3, GLOW[1], .12 + .5*prog, p.h);
        if (co){ co.glow = 1; co.glowA = Math.min(1, .35 + .65*prog) * (locked ? .75 + .25*Math.sin(clock*40) : 1); }
      }
      const len = rayLen(p.x, p.y, b.ang, 30);
      const step = firing ? .22 : locked ? .3 : .6;
      for (let s = .5; s < len; s += step){
        const h = p.h + (0 - p.h) * Math.min(1, s / b.dP);
        const o = addSprite(p.x + dx*s, p.y + dy*s, GLOW[1], firing ? .3 : locked ? .15 : .1, h);
        if (o){ o.glow = 1; o.glowA = firing ? .95 : locked ? .7 + .3*Math.sin(clock*30) : .25 + .2*Math.sin(clock*12); }
      }
    }
  }
  for (const p of parts){
    const o = addSprite(p.x, p.y, PART_IMG, .09, p.h);
    if (o){ o.glow = 5; o.glowA = Math.max(0, 1 - Math.pow(p.t / p.life, 2)); }
  }
  if (portal){
    const grow = Math.min(1, portal.t / .9);
    const ease = 1 - Math.pow(1 - grow, 3);
    const fr = PORTAL_FRAMES[((clock * 14) | 0) % PORTAL_FRAMES.length];
    const sc = .95 * ease * (1 + .04*Math.sin(clock*3));
    if (sc > .02){
      const po = addSprite(portal.x, portal.y, fr, sc, .02);
      if (po) po.emit = true;
      const pg = addSprite(portal.x, portal.y, GLOW[6], 2.1 * ease, .02);
      if (pg){ pg.glow = 6; pg.glowA = .65 * ease; }
    }
  }
  for (const b of shots){
    const o = addSprite(b.x, b.y, ART.fireball, b.big ? .8 : .45, b.big ? .15 : .05);
    if (o){
      o.emit = true;
      const g = addSprite(b.x, b.y, GLOW[0], 1.2, .05);
      if (g){ g.glow = 0; g.glowA = .7; }
    }
  }
  for (const b of grenades) addSprite(b.x, b.y, ART.grenade, .3, .18);
  for (const e of booms){
    const o = addSprite(e.x, e.y, ART.boom, 1.1 + e.t*4.5, .05);
    if (o){ o.boom = true; o.boomT = e.t; }
  }
  drawn.sort(byDepth);

  for (const o of drawn){
    const screenX = (W/2) * (1 + o.tx/o.ty);
    const sh = Math.abs(H/o.ty) * o.scale;
    const sw = sh;
    const y0 = horizon - sh/2 + o.yOff*Math.abs(H/o.ty);
    const x0 = screenX - sw/2;

    if (o.glow >= 0){
      const from = Math.max(0, Math.floor(x0)), to = Math.min(W, Math.ceil(x0+sw));
      if (from < to){
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = o.glowA;
        drawSpans(o.img, from, to, x0, y0, sw, sh, o.ty);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      continue;
    }

    let bright;
    if (brightMode) bright = Math.max(.75, 1 - o.ty/40);
    else {
      const m = lightSample(o.x, o.y);
      const Ls = levelL * m * flick;
      bright = Math.max(.05, (1 - o.ty/(8.2*Ls)) * Ls);
      if (nL && !o.emit) bright = Math.min(1.1, bright + lightAt(o.x, o.y) * .55);
      if (bright < 1 && invG !== 1) bright = Math.pow(bright, invG);
    }
    if (o.emit) bright = Math.max(bright, 1);
    if (o.minB) bright = Math.max(bright, o.minB);
    const alpha = o.boom ? Math.max(0, 1 - o.boomT/.45)
                : o.deadBlood ? Math.max(0, 1 - o.bloodT/1.15) : o.alpha;
    const falling = o.dead && !o.deadBlood && o.deadT < .42;
    let src;
    if (!falling){
      const base = (o.dead && !o.deadBlood) ? fallenOf(o.img) : o.img;
      src = shadedSprite(base, bright, o.hurt, o.tint);
    } else {
    sctx.clearRect(0,0,64,64);
    sctx.save();
    if (o.dead && !o.deadBlood){
      const p = Math.min(1, o.deadT / .42);
      const ease = 1 - Math.pow(1-p, 3);
      const ang = ease * Math.PI/2;
      const sy = 1 - .38*ease;
      const drop = 7*ease;
      sctx.translate(32, 32 + drop);
      sctx.rotate(ang);
      sctx.scale(1.02, sy);
      sctx.drawImage(o.img, -32, -32, 64, 64);
    } else {
      sctx.drawImage(o.img, 0, 0);
    }
    sctx.restore();
    if (bright > 1){
      sctx.globalCompositeOperation = "lighter";
      sctx.globalAlpha = Math.min(1, bright - 1);
      sctx.drawImage(shade, 0, 0);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = "source-over";
    } else if (bright < 1){
      sctx.globalCompositeOperation = "source-atop";
      sctx.fillStyle = FOG_BLACK[((1 - bright) * 255 + .5) | 0];
      sctx.fillRect(0, 0, 64, 64);
      sctx.globalCompositeOperation = "source-over";
    }
    if (o.tint){
      sctx.globalCompositeOperation = "source-atop";
      sctx.fillStyle = o.tint;
      sctx.fillRect(0, 0, 64, 64);
      sctx.globalCompositeOperation = "source-over";
    }
    if (o.hurt){
      sctx.globalCompositeOperation = "source-atop";
      sctx.fillStyle = "rgba(255,235,220,.55)";
      sctx.fillRect(0, 0, 64, 64);
      sctx.globalCompositeOperation = "source-over";
    }
    sctx.globalAlpha = 1;
    src = shade;
    }

    const from = Math.max(0, Math.floor(x0)), to = Math.min(W, Math.ceil(x0+sw));
    if (from < to && alpha > 0){
      if (alpha < 1) ctx.globalAlpha = alpha;
      drawSpans(src, from, to, x0, y0, sw, sh, o.ty);
      if (alpha < 1) ctx.globalAlpha = 1;
    }

    if (o.eyes && bright < .4 && o.ty > 2.4 && o.ty < 17){
      const ew = Math.max(1, Math.min(4, sh*.055)), eh = Math.max(1, Math.min(3, sh*.04));
      const ey = y0 + sh*.46;
      const exL = screenX - sh*.17, exR = screenX + sh*.17 - ew;
      const visL = eyeVisible(exL, ew, o.ty), visR = eyeVisible(exR, ew, o.ty);
      if (visL || visR){
        const glow = Math.min(.95, (.34 - bright)*3.2) * (.75 + .25*Math.sin(clock*9 + o.x));
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = EYE_STYLE[(glow * 63 + .5) | 0];
        if (visL) ctx.fillRect(exL, ey, ew, eh);
        if (visR) ctx.fillRect(exR, ey, ew, eh);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  if (VIGN){ ctx.fillStyle = VIGN; ctx.fillRect(0, 0, W, H); }

  if (backT > 0){
    const k = Math.min(1, backT*2);
    const gr = ctx.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, `rgba(0,0,0,${(k*.75).toFixed(2)})`);
    gr.addColorStop(.42, "rgba(0,0,0,0)");
    gr.addColorStop(.58, "rgba(0,0,0,0)");
    gr.addColorStop(1, `rgba(0,0,0,${(k*.75).toFixed(2)})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }

  if (GRAIN){
    ctx.globalAlpha = .05 + (1 - lightNow)*.05;
    ctx.drawImage(GRAIN, -(Math.random()*64|0), -(Math.random()*64|0), W + 64, H + 64);
    ctx.globalAlpha = 1;
  }

  drawLastMarkers(horizon);
  drawGun();
  drawMinimap();
}

var faceCv = document.getElementById("face");
var fctx = faceCv.getContext("2d");
var faceKey = "", blinkT = 0, blinking = false;
