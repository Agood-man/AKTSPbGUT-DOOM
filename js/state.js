function noiseBurst(dur, vol, freq, q, pan){
  if (!AC) return;
  if (!noiseBuf){
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
  }
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const flt = AC.createBiquadFilter();
  flt.type = "lowpass";
  flt.frequency.setValueAtTime(freq, AC.currentTime);
  flt.frequency.exponentialRampToValueAtTime(Math.max(60, freq*.15), AC.currentTime + dur);
  flt.Q.value = q || 1;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + dur);
  src.connect(flt); flt.connect(g); g.connect(outNode(pan));
  src.start(); src.stop(AC.currentTime + dur);
}

var drone = null, droneGain = null;
function setDrone(v){ if (droneGain) droneGain.gain.value = v; }
function startDrone(){
  if (!AC || drone) return;
  drone = AC.createOscillator();
  const sub = AC.createOscillator();
  droneGain = AC.createGain();
  const flt = AC.createBiquadFilter();
  drone.type = "sawtooth"; drone.frequency.value = 41;
  sub.type = "sine"; sub.frequency.value = 27;
  flt.type = "lowpass"; flt.frequency.value = 160;
  droneGain.gain.value = .05;
  drone.connect(flt); sub.connect(flt); flt.connect(droneGain); droneGain.connect(masterOut());
  drone.start(); sub.start();
}

var ambT = 4, heartT = 0;
function ambience(dt){
  if (!AC) return;
  ambT -= dt;
  if (ambT <= 0){
    ambT = 5 + Math.random()*11;
    const r = Math.random();
    if (r < .35) beep("sine", 900 + Math.random()*500, .12, .05, 200);
    else if (r < .7) beep("sawtooth", 60 + Math.random()*40, 1.1, .05, 32);
    else noiseBurst(.9, .05, 500, .6);
  }
  if (P.hp < 28 && playing){
    gaspT -= dt;
    if (gaspT <= 0){
      gaspT = 1.1 + Math.random()*.6;
      noiseBurst(.3, .09, 700, .6);
      setTimeout(() => noiseBurst(.22, .06, 480, .6), 330);
    }
  }
  if (P.hp < 40 && playing){
    heartT -= dt;
    if (heartT <= 0){
      heartT = .45 + (P.hp/40)*.55;
      beep("sine", 62, .14, .16, 40);
      setTimeout(() => beep("sine", 55, .12, .11, 38), 150);
    }
  }
}

var masterGain = null;
function masterOut(){
  if (!AC) return null;
  if (!masterGain){
    masterGain = AC.createGain();
    masterGain.gain.value = SET.volume;
    masterGain.connect(AC.destination);
  }
  return masterGain;
}
function applyVolume(){ if (masterGain) masterGain.gain.value = SET.volume; }

function outNode(pan){
  if (!AC) return null;
  if (!pan || !AC.createStereoPanner) return masterOut();
  const p = AC.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(masterOut());
  return p;
}

function atPos(x, y){
  const dx = x - P.x, dy = y - P.y;
  const d = Math.hypot(dx, dy);
  const rel = angleDiff(Math.atan2(dy, dx), P.a);
  return {vol: Math.max(0, 1 - d/14), pan: Math.sin(rel), d};
}

function beep(type, f0, dur, vol, f1, pan){
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, AC.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(25, f1 ?? f0*.25), AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + dur);
  o.connect(g); g.connect(outNode(pan)); o.start(); o.stop(AC.currentTime + dur);
}

var GUNS = [
  {name:"ПИСТОЛЕТ", cd:.32, dmg:5, pellets:1, spread:.01,  ammo:null,     snd:[420,.1,.18],
   falloff:[[8,1],[18,.75]]},
  {name:"ДРОБОВИК", cd:.85, dmg:10,pellets:5, spread:.085, ammo:"shells", snd:[150,.22,.3],
   falloff:[[3.5,1],[6.5,.6],[10,.3],[13,0]]},
  {name:"ПУЛЕМЁТ",  cd:.115,dmg:3, pellets:1, spread:.055, ammo:"bullets",snd:[520,.06,.12],
   falloff:[[6,1],[12,.8],[18,.6]]},
  {name:"ГРАНАТОМЁТ", cd:1.0, dmg:0, pellets:0, spread:0, ammo:"grenades", snd:[95,.28,.34], launcher:true}
];
var unlocked = [true, false, false, false];
var GUN_AT = [0, 2, 4, 8];
var GUN_OF = {gun1:1, gun2:2, gun3:3};

var SAVE_KEY = "terplandia3d.save", REC_KEY = "terplandia3d.record";
var memStore = {};
var store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return k in memStore ? memStore[k] : null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){ memStore[k] = v; } },
  del(k){ try { localStorage.removeItem(k); } catch(e){ delete memStore[k]; } }
};
var num = (v, def) => (typeof v === "number" && isFinite(v)) ? v : def;
