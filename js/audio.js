
function texCanvas(){
  const c = document.createElement("canvas"); c.width = c.height = 64;
  return [c, c.getContext("2d")];
}
function darken(src, k){
  const [c, g] = texCanvas();
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = `rgba(0,0,0,${k})`;
  g.fillRect(0, 0, 64, 64);
  return c;
}
function noiseOver(g, amount, alpha){
  for (let i=0;i<amount;i++){
    const x = Math.random()*64, y = Math.random()*64;
    g.fillStyle = `rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},255,${alpha*Math.random()})`;
    g.fillRect(x|0, y|0, 1 + (Math.random()*2|0), 1);
  }
}
function texBrick(base, mortar){
  const [c, g] = texCanvas();
  g.fillStyle = mortar; g.fillRect(0, 0, 64, 64);
  const bh = 8;
  for (let row=0; row<8; row++){
    const off = (row % 2) * 16;
    for (let bx=-32; bx<64; bx+=32){
      const x = bx + off, y = row*bh;
      g.fillStyle = base;
      g.fillRect(x + 1, y + 1, 30, bh - 2);
      g.fillStyle = "rgba(255,255,255,.07)";
      g.fillRect(x + 1, y + 1, 30, 1);
      g.fillStyle = "rgba(0,0,0,.22)";
      g.fillRect(x + 1, y + bh - 2, 30, 1);
    }
  }
  noiseOver(g, 260, .10);
  return c;
}
function texMetal(base, dark){
  const [c, g] = texCanvas();
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let y=0; y<64; y+=32){
    g.fillStyle = dark; g.fillRect(0, y, 64, 3);
    g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, y + 3, 64, 1);
  }
  g.fillStyle = dark; g.fillRect(30, 0, 3, 64);
  for (let y=8; y<64; y+=16){
    for (const x of [6, 24, 40, 58]){
      g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(x, y, 3, 3);
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x + 1, y + 2, 2, 1);
    }
  }
  noiseOver(g, 200, .09);
  return c;
}
function texConcrete(base, dark){
  const [c, g] = texCanvas();
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i=0;i<14;i++){
    const x = Math.random()*64, w = 2 + Math.random()*7, h = 8 + Math.random()*40;
    g.fillStyle = `rgba(0,0,0,${.08 + Math.random()*.14})`;
    g.fillRect(x|0, (Math.random()*20)|0, w|0, h|0);
  }
  g.strokeStyle = dark; g.lineWidth = 1;
  for (let i=0;i<3;i++){
    g.beginPath();
    let x = Math.random()*64, y = 0;
    g.moveTo(x, y);
    while (y < 64){ x += (Math.random()*8 - 4); y += 6 + Math.random()*8; g.lineTo(x, y); }
    g.stroke();
  }
  noiseOver(g, 320, .12);
  return c;
}

var TEX = {
  1:[texBrick("#63300f", "#2a1408")],
  2:[texMetal("#4d5240", "#2b2f22")],
  3:[texConcrete("#6d2a24", "#3a1210")]
};
for (const k in TEX) TEX[k][1] = darken(TEX[k][0], .34);

var cv = document.getElementById("c"), ctx = cv.getContext("2d", {alpha:false});
var W = 0, H = 0, zbuf = null;
function resize(){
  const rw = cv.clientWidth, rh = cv.clientHeight;
  W = Math.max(80, Math.min(440, Math.round(rw / 2 * SET.quality)));
  H = Math.round(W * rh / rw);
  cv.width = W; cv.height = H;
  zbuf = new Float32Array(W);
  ctx.imageSmoothingEnabled = false;
  buildVignette();
}
addEventListener("resize", resize);

function blank(){
  const s = document.createElement("canvas"); s.width = s.height = 64;
  return [s, s.getContext("2d")];
}

function imp(frame){
  const [s,g] = blank();
  const sway = frame ? 2 : -2;
  g.fillStyle = "#3d2418";
  g.fillRect(24 + sway, 48, 6, 16); g.fillRect(34 - sway, 48, 6, 16);
  g.fillStyle = "#7a4526";
  g.beginPath(); g.ellipse(32, 42, 13, 13, 0, 0, 7); g.fill();
  g.fillStyle = "#6b3c20";
  g.beginPath(); g.ellipse(14, 40 + sway, 5, 9, .4, 0, 7); g.ellipse(50, 40 - sway, 5, 9, -.4, 0, 7); g.fill();
  g.fillStyle = "#8a5730";
  g.beginPath(); g.ellipse(32, 22, 15, 15, 0, 0, 7); g.fill();
  g.fillStyle = "#d8cdaa";
  g.beginPath(); g.moveTo(19,11); g.lineTo(12,-2); g.lineTo(28,8); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(45,11); g.lineTo(52,-2); g.lineTo(36,8); g.closePath(); g.fill();
  g.fillStyle = "#f5edd6";
  g.beginPath(); g.ellipse(25,20,5,4,0,0,7); g.ellipse(39,20,5,4,0,0,7); g.fill();
  g.fillStyle = "#c1160d";
  g.beginPath(); g.arc(25 + sway*.4, 20, 2.2, 0, 7); g.arc(39 + sway*.4, 20, 2.2, 0, 7); g.fill();
  g.fillStyle = "#2a0806";
  g.beginPath(); g.ellipse(32, 31, 8, 5, 0, 0, 7); g.fill();
  g.fillStyle = "#f5edd6";
  for (let i=0;i<3;i++) g.fillRect(26+i*5, 27, 3, 4);
  return s;
}

function bull(frame){
  const [s,g] = blank();
  const sway = frame ? 3 : -3;
  g.fillStyle = "#2b3320";
  g.fillRect(20 + sway, 50, 9, 14); g.fillRect(36 - sway, 50, 9, 14);
  g.fillStyle = "#4d5c33";
  g.beginPath(); g.ellipse(32, 43, 21, 16, 0, 0, 7); g.fill();
  g.fillStyle = "#3f4c2a";
  g.beginPath(); g.ellipse(9, 42 + sway, 7, 11, .3, 0, 7); g.ellipse(55, 42 - sway, 7, 11, -.3, 0, 7); g.fill();
  g.fillStyle = "#5e7040";
  g.beginPath(); g.ellipse(32, 22, 19, 16, 0, 0, 7); g.fill();
  g.fillStyle = "#ded3b4";
  g.beginPath(); g.moveTo(14,16); g.lineTo(2,6); g.lineTo(18,6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(50,16); g.lineTo(62,6); g.lineTo(46,6); g.closePath(); g.fill();
  g.fillStyle = "#f7d34a";
  g.beginPath(); g.ellipse(24,20,6,4,0,0,7); g.ellipse(40,20,6,4,0,0,7); g.fill();
  g.fillStyle = "#1a1206";
  g.beginPath(); g.arc(24 + sway*.3, 20, 2.4, 0, 7); g.arc(40 + sway*.3, 20, 2.4, 0, 7); g.fill();
  g.fillStyle = "#20130a";
  g.beginPath(); g.ellipse(32, 33, 12, 6, 0, 0, 7); g.fill();
  g.fillStyle = "#f5edd6";
  for (let i=0;i<4;i++){ g.fillRect(23+i*5, 28, 3, 5); g.fillRect(25+i*5, 35, 3, 4); }
  return s;
}

function caster(frame){
  const [s,g] = blank();
  const bob = frame ? -2 : 2;
  g.fillStyle = "#3a2246";
  g.beginPath(); g.moveTo(32, 10 + bob); g.lineTo(52, 62); g.lineTo(12, 62); g.closePath(); g.fill();
  g.fillStyle = "#4d2d5e";
  g.beginPath(); g.moveTo(32, 6 + bob); g.lineTo(46, 30 + bob); g.lineTo(18, 30 + bob); g.closePath(); g.fill();
  g.fillStyle = "#120a17";
  g.beginPath(); g.ellipse(32, 24 + bob, 9, 7, 0, 0, 7); g.fill();
  g.fillStyle = "#00e0c8";
  g.beginPath(); g.arc(28, 24 + bob, 2.2, 0, 7); g.arc(36, 24 + bob, 2.2, 0, 7); g.fill();
  g.fillStyle = "#c9bda0"; g.fillRect(8, 30 + bob, 4, 30);
  g.fillStyle = "#ff8a2b";
  g.beginPath(); g.arc(10, 28 + bob, 5, 0, 7); g.fill();
  return s;
}

function corpse(hue){
  const [s,g] = blank();
  g.save();
  g.translate(32, 39);
  g.rotate(Math.PI / 2);
  g.drawImage(enemyImage, -28, -28, 56, 56);
  g.restore();
  return s;
}

function bloodSplash(){
  const [s,g] = blank();
  g.fillStyle = "rgba(150,18,12,.85)";
  g.beginPath(); g.ellipse(32, 47, 17, 5, 0, 0, Math.PI*2); g.fill();
  for (const p of [[16,45,3],[12,39,2],[21,37,2],[43,39,2],[49,46,3],[38,34,1.5]]) {
    g.beginPath(); g.arc(p[0],p[1],p[2],0,Math.PI*2); g.fill();
  }
  return s;
}

function medkit(){
  const [s,g] = blank();
  g.fillStyle = "#e8e2d2"; g.fillRect(14, 22, 36, 26);
  g.fillStyle = "#b8b0a0"; g.fillRect(14, 22, 36, 4);
  g.fillStyle = "#c1160d"; g.fillRect(28, 28, 8, 16); g.fillRect(20, 32, 24, 8);
  return s;
}
function armorItem(){
  const [s,g] = blank();
  g.fillStyle = "#6d7f8c";
  g.beginPath(); g.moveTo(32,18); g.lineTo(50,26); g.lineTo(44,50); g.lineTo(32,56); g.lineTo(20,50); g.lineTo(14,26); g.closePath(); g.fill();
  g.fillStyle = "#9fb2bf";
  g.beginPath(); g.moveTo(32,24); g.lineTo(43,29); g.lineTo(39,46); g.lineTo(32,50); g.closePath(); g.fill();
  return s;
}
function ammoBox(color, label){
  const [s,g] = blank();
  g.fillStyle = color; g.fillRect(16, 26, 32, 22);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(16, 26, 32, 5);
  g.fillStyle = "#efe6cc"; g.font = "bold 14px monospace"; g.textAlign = "center";
  g.fillText(label, 32, 43);
  return s;
}
function fireballSprite(){
  const [s,g] = blank();
  const gr = g.createRadialGradient(32,32,2,32,32,22);
  gr.addColorStop(0,"#fff3c4"); gr.addColorStop(.4,"#ff9a1f"); gr.addColorStop(1,"rgba(190,40,0,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(32,32,22,0,7); g.fill();
  return s;
}

var enemyImage = new Image();
enemyImage.src = EMBED_ENEMY;

var enemySprite = () => {
  const [s,g] = blank();
  g.imageSmoothingEnabled = false;
  g.drawImage(enemyImage, 0, 0, 64, 64);
  return s;
};

var ENEMY_SPRITE = enemySprite();
enemyImage.onload = () => {
  const g = ENEMY_SPRITE.getContext("2d");
  g.clearRect(0, 0, 64, 64);
  g.imageSmoothingEnabled = false;
  g.drawImage(enemyImage, 0, 0, 64, 64);
  for (const type of ["imp","bull","caster"]){
    const cg = ART.corpse[type].getContext("2d");
    cg.clearRect(0,0,64,64);
    cg.imageSmoothingEnabled = false;
    cg.save();
    cg.translate(32,42);
    cg.rotate(Math.PI/2);
    cg.drawImage(enemyImage,-28,-28,56,56);
    cg.restore();
  }
};

function drawFallbackEnemy(g){
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = "#2e211c"; g.fillRect(10, 30, 44, 34);
  g.fillStyle = "#5e4234"; g.fillRect(16, 6, 32, 30);
  g.fillStyle = "#402c23"; g.fillRect(16, 6, 32, 6);
  g.fillStyle = "#c8160e"; g.fillRect(22, 18, 7, 5); g.fillRect(35, 18, 7, 5);
  g.fillStyle = "#ffd0c0"; g.fillRect(24, 19, 2, 2); g.fillRect(37, 19, 2, 2);
  g.fillStyle = "#140a08"; g.fillRect(24, 28, 16, 4);
  g.fillStyle = "#e8dcc0"; g.fillRect(26, 28, 3, 2); g.fillRect(35, 28, 3, 2);
}

var enemyRetry = false;
enemyImage.onerror = () => {
  if (!enemyRetry){
    enemyRetry = true;
    enemyImage.src = EMBED_ENEMY;
    return;
  }
  drawFallbackEnemy(ENEMY_SPRITE.getContext("2d"));
  for (const type of ["imp","bull","caster"]){
    const cg = ART.corpse[type].getContext("2d");
    cg.clearRect(0,0,64,64);
    cg.imageSmoothingEnabled = false;
    cg.save();
    cg.translate(32,42);
    cg.rotate(Math.PI/2);
    cg.drawImage(ENEMY_SPRITE,-28,-28,56,56);
    cg.restore();
  }
};

function gunItem(color, label){
  const [s,g] = blank();
  g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(10, 22, 44, 30);
  g.fillStyle = color; g.fillRect(12, 24, 40, 26);
  g.fillStyle = "#efe6cc"; g.font = "bold 16px monospace"; g.textAlign = "center";
  g.fillText(label, 32, 44);
  return s;
}
function buffItem(color){
  const [s,g] = blank();
  const gr = g.createRadialGradient(32, 34, 2, 32, 34, 20);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(.4, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(32, 34, 20, 0, 7); g.fill();
  return s;
}
function grenadeSprite(){
  const [s,g] = blank();
  g.fillStyle = "#2f3a20"; g.beginPath(); g.arc(32, 36, 9, 0, 7); g.fill();
  g.fillStyle = "#8d9a5e"; g.fillRect(29, 23, 6, 8);
  return s;
}
function boomSprite(){
  const [s,g] = blank();
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, "#fff6d0"); gr.addColorStop(.35, "#ffb020");
  gr.addColorStop(.7, "#c0350a"); gr.addColorStop(1, "rgba(90,20,0,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  return s;
}

var ART = {
  imp:[ENEMY_SPRITE, ENEMY_SPRITE],
  bull:[ENEMY_SPRITE, ENEMY_SPRITE],
  caster:[ENEMY_SPRITE, ENEMY_SPRITE],
  corpse:{imp:corpse(0), bull:corpse(0), caster:corpse(0)},
  bloodSplash:bloodSplash(),
  medkit:medkit(),
  armor:armorItem(),
  bullets:ammoBox("#4a7a2e","П"),
  shells:ammoBox("#8a2320","Д"),
  fireball:fireballSprite(),
  grenades:ammoBox("#5b4a8c","Г"),
  gun1:gunItem("#8a2320","Д"), gun2:gunItem("#4a7a2e","П"), gun3:gunItem("#5b4a8c","Г"),
  rage:buffItem("#c8321e"), haste:buffItem("#e0c020"), shield:buffItem("#3f9fd0"),
  grenade:grenadeSprite(), boom:boomSprite()
};

var HITR = e => .48 * (e.scale || KIND[e.type].scale);

var KIND = {
  imp:    {hp:10, speed:1.70, dmg:9,  rate:.9,  melee:true,  reach:.85, art:"imp",    scale:1.0},
  bull:   {hp:35, speed:1.00, dmg:17, rate:1.2, melee:true,  reach:1.05,art:"bull",   scale:1.35},
  caster: {hp:15, speed:.8,   dmg:0,  rate:1.6, melee:false, reach:7.0, art:"caster", scale:1.1},
  boss:   {hp:0,  speed:1,    dmg:20, rate:1.2, melee:true,  reach:1.6, art:"imp",    scale:1.8}
};
var BOSS_EVERY = 20;
var BOSS_TYPES = [
  {id:"tank",     name:"ВАХТЁРША", hp:1500, speed:.8,  scale:1.95, dmg:24, tint:"rgba(130,85,40,.28)"},
  {id:"summoner", name:"ЗАВУЧ",    hp:950,  speed:.95, scale:1.7,  dmg:14, tint:"rgba(60,170,70,.3)"},
  {id:"caster",   name:"ХИМИЧКА",  hp:1050, speed:1.1, scale:1.7,  dmg:14, tint:"rgba(150,70,210,.32)"},
  {id:"berserk",  name:"ФИЗРУК",   hp:1200, speed:1.2, scale:1.8,  dmg:18, tint:"rgba(210,40,30,.3)"}
];
var isBossLevel = () => level > 0 && level % BOSS_EVERY === 0;
function bossTypeFor(lvl){
  const n = lvl / BOSS_EVERY;
  return BOSS_TYPES[(n - 1 + (runSeed % BOSS_TYPES.length)) % BOSS_TYPES.length];
}
var FIREBALL_DMG = 13, FIREBALL_SPEED = 4.0;

var DEPTH_CAP = 150;
var depth = () => Math.min(level, DEPTH_CAP);

var t150 = () => depth()/DEPTH_CAP;
var ramp = (cap, pow) => cap * Math.pow(t150(), pow);

var dmgBonus = () => level <= 10 ? level*.6 : 6 + 10*Math.pow((depth()-10)/140, .6);
var rateMul = () => 1 - .28*Math.pow(t150(), .6);

var isSurge = () => level > 0 && level % 5 === 0 && level % 20 !== 0;

function countRange(){
  if (level <= 3){ const n = Math.round((4 + Math.round(level*1.5)) * .7); return [n, n]; }
  const center = level <= 10 ? 4 + level*1.5
               : 19 + 17*Math.pow((depth()-10)/140, .7);
  const spread = level < 10 ? 1 : 2;
  return [Math.round(center - spread), Math.round(center + spread)];
}

function enemyCount(){
  const [lo, hi] = countRange();
  if (isSurge()) return hi;
  const r = mulberry32((runSeed ^ Math.imul(level + 11, 0x85EBCA6B)) >>> 0)();
  return lo + Math.floor(r * (hi - lo + 1));
}
var curve = () => ({
  surge: isSurge(),
  count:   enemyCount(),
  hpBonus: type => Math.floor(ramp(type === "bull" ? 60 : type === "caster" ? 30 : 25, .55)),
  bulls:   level >= 2 ? .12 + ramp(.28, .4) : 0,
  casters: level >= 3 ? .08 + ramp(.26, .4) + (isSurge() ? .08 : 0) : 0,
  medkits: depth() < 40 ? Math.min(4, 1 + Math.floor(level/2))
                        : Math.max(2, 4 - Math.floor((depth() - 40)/50)),
  bullets: Math.min(4, 1 + Math.floor(level/3)),
  shells:  Math.min(3, 1 + Math.floor(level/4)),
  bulletAmt: 30 + Math.min(14, Math.floor(depth()/12)),
  shellAmt:  6 + Math.min(4, Math.floor(depth()/30)),
  dropChance: .3 + Math.min(.12, depth()*.0008),
  levelHeal: Math.max(6, 15 - Math.floor(depth()/25))
});

var shade = document.createElement("canvas"); shade.width = shade.height = 64;
var sctx = shade.getContext("2d");
var CANVAS_FILTER = (() => {
  try {
    const t = document.createElement("canvas").getContext("2d");
    t.filter = "brightness(0.5)";
    return t.filter !== "none" && t.filter !== "";
  } catch(e){ return false; }
})();

var AC = null;
var noiseBuf = null;
