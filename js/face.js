
function facePart(x, y, w, h, color){ fctx.fillStyle = color; fctx.fillRect(x, y, w, h); }

var wounds = [], woundLvl = -1;
function makeWounds(lvl){
  wounds = [];
  woundLvl = lvl;
  const n = lvl*3;
  for (let i=0;i<n;i++){
    const side = Math.random() < .5 ? -1 : 1;
    const x = 20 + side*(2 + Math.random()*11) | 0;
    const y = 10 + Math.random()*26 | 0;
    const r = Math.random();
    wounds.push({
      x, y,
      w: 2 + (Math.random()*3 | 0),
      h: 1 + (Math.random()*2 | 0),
      drip: r < .45 ? 3 + (Math.random()*6 | 0) : 0,
      kind: r > .78 ? "bruise" : "blood"
    });
  }
  wounds.eye = Math.random() < .5 ? 0 : 1;
  wounds.brow = Math.random() < .5 ? 0 : 1;
}

function paintFace(st){
  const rage = st.mood === "rage";
  const skin  = rage ? "#d98a5c" : "#d8a06a";
  const shade = rage ? "#b06a3c" : "#b8834f";
  const dark  = "#20140c", white = "#f2ece0", hair = "#3a2a1c";
  const blood = "#8e1f14", bruise = "#5b3350";
  const lvl = st.dmg;
  fctx.clearRect(0, 0, 40, 48);

  facePart(4, 40, 32, 8, "#2f3a55");
  facePart(14, 40, 12, 4, "#c9c0a8");
  facePart(15, 34, 10, 8, shade);

  facePart(7, 6, 26, 32, skin);
  facePart(5, 16, 2, 8, skin); facePart(33, 16, 2, 8, skin);
  facePart(7, 34, 26, 4, shade);

  facePart(6, 3, 28, 8, hair);
  facePart(6, 11, 5, 4, hair); facePart(29, 11, 5, 4, hair);
  for (let i=0;i<5;i++) facePart(9 + i*5, 10, 3, 3, hair);
  facePart(6, 3, 28, 2, "#4a382c");

  const d = st.dir;
  const exL = 11 + d*2, exR = 22 + d*2;

  if (st.mood === "dead"){
    facePart(10, 17, 8, 2, dark); facePart(22, 17, 8, 2, dark);
    facePart(13, 14, 2, 8, dark); facePart(25, 14, 2, 8, dark);
    facePart(13, 29, 14, 7, dark);
    facePart(15, 31, 4, 2, white);
    facePart(7, 6, 26, 7, blood);
    facePart(19, 12, 5, 24, "rgba(142,31,20,.85)");
    facePart(9, 20, 3, 14, "rgba(142,31,20,.7)");
    return;
  }

  let eyeH = 5, eyeY = 18;
  if (st.mood === "haste") eyeH = 8;
  if (st.blink && st.mood !== "haste") eyeH = 1;

  const shut = lvl >= 4 ? wounds.eye : -1;

  const drawEye = (x, i) => {
    const h = i === shut ? 1 : eyeH;
    facePart(x, eyeY + (5 - h), 6, h, i === shut ? bruise : white);
    if (h > 2 && !st.blink){
      const pupil = rage ? "#8e1f14" : dark;
      facePart(x + 2 + d, eyeY + (5 - h) + 1, 2, Math.max(1, h - 2), pupil);
      if (st.mood === "haste") facePart(x + 1, eyeY + 1, 1, 1, white);
    }
    facePart(x, eyeY + 6, 6, 1, shade);
    facePart(x + 1, eyeY + 7, 4, 1, lvl > 2 ? bruise : shade);
  };
  drawEye(exL, 0); drawEye(exR, 1);

  const brow = (x) => {
    if (rage || st.mood === "hurt"){
      facePart(x, 13, 7, 3, hair);
      facePart(x === 11 ? x : x + 4, 15, 3, 2, hair);
    } else if (st.mood === "gloat"){
      facePart(x, 13, 7, 2, hair);
    } else if (st.mood === "haste"){
      facePart(x, 11, 7, 2, hair);
    } else {
      facePart(x, 14, 7, 2, hair);
    }
  };
  brow(11); brow(22);

  facePart(19, 22, 3, 6, shade);
  if (lvl >= 3){
    facePart(18, 26, 5, 2, blood);
    facePart(19, 28, 2, 4 + lvl, "rgba(142,31,20,.85)");
  }

  if (st.mood === "gloat"){
    facePart(13, 30, 14, 3, dark);
    facePart(15, 33, 10, 2, white);
    facePart(11, 28, 2, 3, dark); facePart(27, 28, 2, 3, dark);
  } else if (st.mood === "hurt"){
    facePart(13, 30, 14, 5, dark);
    facePart(15, 31, 10, 2, white);
    if (lvl >= 4) facePart(19, 31, 2, 2, dark);
  } else if (rage){
    facePart(11, 28, 18, 6, dark);
    for (let i=0;i<5;i++) facePart(12 + i*4, 28, 3, 3, white);
    for (let i=0;i<4;i++) facePart(14 + i*4, 31, 3, 3, white);
    if (lvl >= 4) facePart(20, 28, 3, 3, dark);
  } else if (st.mood === "haste"){
    facePart(17, 29, 6, 6, dark);
    facePart(18, 30, 4, 2, "#7a2020");
  } else {
    facePart(14, 31, 12, 2, dark);
    if (lvl >= 4){ facePart(13, 30, 4, 2, blood); }
  }

  for (const w of wounds){
    const c = w.kind === "bruise" ? bruise : blood;
    facePart(w.x, w.y, w.w, w.h, c);
    if (w.drip) facePart(w.x + 1, w.y + w.h, 1, w.drip, "rgba(142,31,20,.75)");
  }

  if (lvl >= 2){
    const bx = wounds.brow ? 24 : 11;
    facePart(bx, 12, 5, 2, blood);
    facePart(bx + 2, 14, 2, 8 + lvl*2, "rgba(142,31,20,.8)");
  }
  if (lvl >= 3){
    const cx = wounds.eye ? 26 : 8;
    facePart(cx, 24, 6, 5, "rgba(91,51,80,.75)");
  }
  if (lvl >= 3){
    facePart(8, 13, 2, 5, "#8fc7e8");
    facePart(31, 17, 2, 4, "#8fc7e8");
  }
  if (lvl >= 5){
    facePart(7, 6, 26, 4, blood);
    facePart(9, 10, 4, 20, "rgba(142,31,20,.55)");
  }

  if (rage){
    facePart(13, 7, 1, 4, "#a04030");
    facePart(26, 8, 1, 3, "#a04030");
  }
  if (st.mood === "shield"){
    fctx.fillStyle = "rgba(63,159,208,.28)";
    fctx.fillRect(4, 2, 32, 42);
    fctx.fillStyle = "rgba(150,220,255,.45)";
    fctx.fillRect(8, 4, 3, 38);
  }
}

function updateFace(dt){
  blinkT -= dt;
  if (blinkT <= 0){ blinking = !blinking; blinkT = blinking ? .12 : 2 + Math.random()*3; }
  if (P.hitT > 0) P.hitT -= dt;

  const hp = P.hp;
  let mood = "calm";
  if (!playing && hp <= 0) mood = "dead";
  else if (P.hitT > 0) mood = "hurt";
  else if (buff === "rage") mood = "rage";
  else if (buff === "haste") mood = "haste";
  else if (buff === "shield") mood = "shield";
  else if (comboT > 0 && combo >= 3) mood = "gloat";

  const dmg = hp > 88 ? 0 : hp > 72 ? 1 : hp > 55 ? 2 : hp > 36 ? 3 : hp > 18 ? 4 : 5;
  if (dmg !== woundLvl) makeWounds(dmg);
  const dir = P.hitT > 0 ? P.hitDir : 0;
  const key = `${mood}|${dmg}|${dir}|${blinking}`;
  if (key === faceKey) return;
  faceKey = key;
  paintFace({mood, dmg, dir, blink: blinking});
}

var SW = 160, SH = 120;
function wpnCanvas(){
  const c = document.createElement("canvas"); c.width = SW; c.height = SH;
  return [c, c.getContext("2d")];
}
var MET = "#2a2c33", MET_L = "#4b4e58", MET_D = "#16181d";
var WOOD = "#5a3517", WOOD_L = "#7a4a22", BRASS = "#b8912e";
var GLOVE = "#39312a", GLOVE_L = "#4d4238", SKIN = "#c2884f";
