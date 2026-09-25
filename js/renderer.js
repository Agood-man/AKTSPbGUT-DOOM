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
function moveEnemy(e, dx, dy){
  if (dx && !solid(e.x + dx, e.y, ER)) e.x += dx;
  if (dy && !solid(e.x, e.y + dy, ER)) e.y += dy;
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

var combo = 0, comboT = 0;
var RANKS = [[20,"ОТЧИСЛЕН ВЕСЬ ПОТОК"],[15,"КРАСНЫЙ ДИПЛОМ"],[10,"АВТОМАТ"],
               [7,"СЕССИЯ"],[5,"КУРСОВАЯ"],[3,"КОЛЛОКВИУМ"],[2,"ЗАЧЁТ"]];

function registerKill(){
  kills++;
  combo++; comboT = 3;
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
  e.hp -= dmg;
  e.hurtT = .14;
  if (e.hp > 0){ beep("triangle", 320, .07, .1); return; }
  e.alive = false; e.deadT = 0; e.bloodT = 2.6;
  registerKill();
  const dry = ammo.bullets < 12 && ammo.shells < 3;
  if (dry || Math.random() < curve().dropChance){
    const r = Math.random();
    items.push({kind: r < .38 ? "bullets" : r < .62 ? "shells" : "medkit", x:e.x, y:e.y, t:0});
  }
}

function hitscan(offset, dmg){
  const a = P.a + offset;
  const rx = Math.cos(a), ry = Math.sin(a);
  const wallD = castRay(a);
  let best = null, bestT = 1e9;
  for (const e of enemies){
    if (!e.alive) continue;
    const dx = e.x - P.x, dy = e.y - P.y;
    const t = dx*rx + dy*ry;
    if (t <= .05 || t > wallD) continue;
    const perp = Math.abs(dx*ry - dy*rx);
    if (perp > HITR(e)) continue;
    if (t < bestT){ bestT = t; best = e; }
  }
  if (!best) return;
  stat.hit++;
  damageEnemy(best, dmg);
}

var grenades = [], booms = [];
function explode(x, y){
  booms.push({x, y, t:0});
  beep("sawtooth", 70, .4, .3, 40);
  noiseBurst(.55, .4, 1400, .7);
  boomLight = 1; boomX = x; boomY = y;
  const R = 3.1, D = 62 * (buff === "rage" ? 2 : 1);
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
  const g = GUNS[gun];
  if (g.ammo && ammo[g.ammo] <= 0){ beep("square", 90, .08, .07); cooldown = .3; return; }
  if (g.ammo) ammo[g.ammo]--;
  cooldown = g.cd; recoil = 1;
  flash = g.launcher ? 0 : 1;
  beep("square", g.snd[0], g.snd[1], g.snd[2]);
  if (gun === 1) noiseBurst(.3, .35, 2600, 1);
  else if (g.launcher) noiseBurst(.2, .3, 900, 1);
  playFireAnim();
  const mult = buff === "rage" ? 2 : 1;
  if (g.launcher){
    stat.fired++;
    grenades.push({x:P.x + Math.cos(P.a)*.4, y:P.y + Math.sin(P.a)*.4,
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
  if (P.inv > 0 || buff === "shield" || god) return;
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
  if (P.hp <= 0) gameOver();
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

  const sprint = gun === 0 && wpnSwitch === -1 ? 1.08 : 1;
  const sp = 2.7 * (buff === "haste" ? 1.42 : 1) * sprint * dt;
  if (fw || st){
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

  if (keys[" "] || mouseHeld || fireHeld) shoot();

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

  const buffEl = HUD.buff;
  if (buff){
    buffT -= dt;
    if (buffT <= 0){ buff = null; buffShown = -1; buffEl.classList.add("gone"); beep("sine", 200, .2, .1); }
    else {
      const sec = Math.ceil(buffT);
      if (sec !== buffShown){
        buffShown = sec;
        buffEl.textContent = `${BUFFS[buff].name} · ${sec}`;
        buffEl.classList.remove("gone");
      }
    }
  }

  for (const b of grenades){
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
  P.pick = Math.max(0, P.pick - dt*2);
  HUD.hurt.style.opacity = P.hurt;
  HUD.pick.style.opacity = P.pick;

  flowCd -= dt;
  const pCell = (P.y|0)*MW + (P.x|0);
  if (flowCd <= 0 || pCell !== flowCell){ buildFlow(); flowCell = pCell; flowCd = .25; }

  let aliveLeft = 0;
  for (const e of enemies){
    if (e.hurtT > 0) e.hurtT -= dt;
    if (!e.alive){ e.deadT += dt; continue; }
    aliveLeft++;
    if (dbgFreeze) continue;
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
    if (!sees || d > 3){
      const f = flowDir(e);
      if (f){ mx = f.x; my = f.y; }
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
      else if (d < want - .5){ wx = -ux; wy = -uy; wantMove = true; }
      if (e.cd <= 0 && d < k.reach && sees){
        e.cd = k.rate * rateMul();
        shots.push({x:e.x, y:e.y, vx:ux*FIREBALL_SPEED, vy:uy*FIREBALL_SPEED, t:0});
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
    if (segDist(P.x, P.y, ox, oy, b.x, b.y) < PR + .18){
      b.dead = true; damagePlayer(FIREBALL_DMG + dmgBonus(), b.x, b.y);
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
    const ix = it.x - P.x, iy = it.y - P.y;
    if (ix*ix + iy*iy > (PR + .38)*(PR + .38)) continue;
    let taken = true;
    if (it.kind === "medkit"){
      if (P.hp >= 100) taken = false; else P.hp = Math.min(100, P.hp + 22);
    } else if (it.kind === "armor"){
      if (P.armor >= 100) taken = false; else P.armor = Math.min(100, P.armor + 30);
    } else if (it.kind === "bullets") ammo.bullets += curve().bulletAmt;
    else if (it.kind === "shells") ammo.shells += curve().shellAmt;
    else if (it.kind === "grenades") ammo.grenades += 5;
    else if (GUN_OF[it.kind] !== undefined){
      const n = GUN_OF[it.kind];
      unlocked[n] = true;
      if (wpnSwitch === -1){ wpnSwitch = n; wpnSeq = null; }
      if (n === 1) ammo.shells += 8;
      if (n === 2) ammo.bullets += 30;
      if (n === 3) ammo.grenades += 8;
      showBanner(`${GUNS[n].name} НАЙДЕН`, true);
      beep("square", 300, .5, .18, 900);
    } else if (BUFFS[it.kind]){
      buff = it.kind; buffT = BUFFS[it.kind].time; buffShown = -1;
      showBanner(BUFFS[it.kind].name, true);
      beep("sine", 400, .4, .16, 1100);
    }
    if (taken){
      it.dead = true; P.pick = .8;
      beep("sine", 880, .12, .12, 1400);
      updateHUD();
    }
  }
  {
    let j = 0;
    for (let i = 0; i < items.length; i++) if (!items[i].dead) items[j++] = items[i];
    items.length = j;
  }

  if (aliveLeft !== enemiesLeft){ enemiesLeft = aliveLeft; updateHUD(); }

  if (aliveLeft === 0 && playing && !sandbox) nextLevel();
}

var SPR = [], sprN = 0, drawn = [];
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

var LIGHT_COLORS = [[255,120,40], [210,55,30], [230,196,40], [70,165,215], [255,150,60]];
var BUFF_LIGHT = { rage:1, haste:2, shield:3 };
var TINT = LIGHT_COLORS.map(([r,g,b]) => {
  const a = [];
  for (let i = 0; i < 32; i++) a.push(`rgba(${r},${g},${b},${(i/31*.55).toFixed(3)})`);
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
  for (const b of shots) addLight(b.x, b.y, 3.2, 1, 0, .05);
  for (const it of items){
    const c = BUFF_LIGHT[it.kind];
    if (c !== undefined) addLight(it.x, it.y, 2.8, .85 * (.8 + .2*Math.sin(clock*5 + it.x)), c, .32);
  }
  for (const e of booms) addLight(e.x, e.y, 5.5, 1.6 * Math.max(0, 1 - e.t/.45), 4, .05);
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
  const planeX = -dirY*.66, planeY = dirX*.66;
  const shakeAmp = (P.hp < 45 ? (1 - P.hp/45)*2.2 : 0) + (P.hitT > 0 ? P.hitT*9 : 0);
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
    const fc = side === 0 ? (my*MW + mx - sx) : ((my - sy)*MW + mx);
    const Lc = levelL * (LMAP[fc] || .8) * flick;
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
          fi = (fi * (1 - Math.min(1, lit) * .85)) | 0;
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
    o.emit = false; o.glow = -1; o.glowA = 0;
    drawn.push(o);
    return o;
  };

  for (const e of enemies){
    const k = KIND[e.type];
    const dead = !e.alive;
    const o = addSprite(e.x, e.y,
      dead ? ART.corpse[e.type] : ART[k.art][(e.t*4|0) % 2],
      dead ? k.scale * .92 : k.scale,
      dead ? (.24 + Math.min(.18, e.deadT*.55)) : 0);
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
      const g = addSprite(it.x, it.y, GLOW[c], 1.5, .32);
      if (g){ g.glow = c; g.glowA = .75 + .25*Math.sin(clock*5 + it.x); }
    }
  }
  for (const b of shots){
    const o = addSprite(b.x, b.y, ART.fireball, .45, .05);
    if (o){
      o.emit = true;
      const g = addSprite(b.x, b.y, GLOW[0], 1.35, .05);
      if (g){ g.glow = 0; g.glowA = .9; }
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
        let fullyVisible = true;
        for (let x=from; x<to; x++){ if (o.ty >= zbuf[x]) { fullyVisible = false; break; } }
        if (fullyVisible) ctx.drawImage(o.img, 0, 0, 64, 64, x0, y0, sw, sh);
        else for (let x=from; x<to; x++){
          if (o.ty >= zbuf[x]) continue;
          const tX = Math.min(63, Math.max(0, ((x - x0) * 64 / sw) | 0));
          ctx.drawImage(o.img, tX, 0, 1, 64, x, y0, 1, sh);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      continue;
    }

    let bright;
    if (brightMode) bright = Math.max(.75, 1 - o.ty/40);
    else {
      const scx = o.x | 0, scy = o.y | 0;
      const m = (scx >= 0 && scy >= 0 && scx < MW && scy < MH) ? (LMAP[scy*MW + scx] || .8) : .8;
      const Ls = levelL * m * flick;
      bright = Math.max(.05, (1 - o.ty/(8.2*Ls)) * Ls);
      if (nL && !o.emit) bright = Math.min(1.1, bright + lightAt(o.x, o.y) * .55);
      if (bright < 1 && invG !== 1) bright = Math.pow(bright, invG);
    }
    if (o.emit) bright = Math.max(bright, 1);
    sctx.clearRect(0,0,64,64);
    sctx.save();
    sctx.globalAlpha = o.boom ? Math.max(0, 1 - o.boomT/.45)
                     : o.deadBlood ? Math.max(0, 1 - o.bloodT/1.15) : 1;
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
    if (o.hurt){
      sctx.globalCompositeOperation = "source-atop";
      sctx.fillStyle = "rgba(255,238,225,.68)";
      sctx.fillRect(0, 0, 64, 64);
      sctx.globalCompositeOperation = "source-over";
    }
    sctx.globalAlpha = 1;

    const from = Math.max(0, Math.floor(x0)), to = Math.min(W, Math.ceil(x0+sw));
    if (from < to){
      // Fast path: if the whole sprite is in front of the wall depth buffer,
      // draw it once instead of issuing one drawImage call per screen column.
      let fullyVisible = true;
      for (let x=from; x<to; x++){
        if (o.ty >= zbuf[x]) { fullyVisible = false; break; }
      }
      if (fullyVisible){
        ctx.drawImage(shade, 0, 0, 64, 64, x0, y0, sw, sh);
      } else {
        for (let x=from; x<to; x++){
          if (o.ty >= zbuf[x]) continue;
          const texX = Math.min(63, Math.max(0, ((x - x0) * 64 / sw) | 0));
          ctx.drawImage(shade, texX, 0, 1, 64, x, y0, 1, sh);
        }
      }
    }

    if (o.eyes && bright < .4 && o.ty < 17){
      const ew = Math.max(1, sh*.055), eh = Math.max(1, sh*.04);
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
