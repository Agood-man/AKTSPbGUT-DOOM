var SHIRTS = ["#2f5aa8", "#b02a24", "#2f8a3a", "#c9a227", "#7a3fb0"];
var SHIRT_NAMES = ["синяя", "красная", "зелёная", "жёлтая", "фиолетовая"];
var COOP_MAX = 5, COOP_VER = "coop-1";
var COOP_TRACKERS = [
  "wss://tracker.webtorrent.dev",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://open.ftorrent.com",
  "wss://tracker.files.fm:7073/announce"
];
var COOP_MQTT = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://public.mqtthq.com:8084/mqtt"
];
var COOP_ICE = [
  {urls:["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]},
  {urls:"stun:stun.nextcloud.com:443"},
  {urls:"stun:stun.sipgate.net:3478"}
];
(() => {
  const q = new URLSearchParams(location.search), t = q.get("tracker"), m = q.get("mqtt");
  if (t) COOP_TRACKERS = t === "none" ? [] : [t];
  if (m) COOP_MQTT = m === "none" ? [] : [m];
  else if (t) COOP_MQTT = [];
})();

function mqttConn(url, onOpen, onMsg, onFail){
  let ws;
  try { ws = new WebSocket(url, ["mqtt"]); } catch(e){ setTimeout(onFail, 0); return null; }
  ws.binaryType = "arraybuffer";
  const enc = new TextEncoder(), dec = new TextDecoder();
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const pkt = (type, body) => {
    const len = []; let n = body.length;
    do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
    const out = new Uint8Array(1 + len.length + body.length);
    out[0] = type; out.set(len, 1); out.set(body, 1 + len.length);
    return out;
  };
  let pid = 1, ping = null, buf = new Uint8Array(0), failed = false;
  const fail = () => { if (failed) return; failed = true; clearInterval(ping); onFail(); };
  const api = {
    ws,
    sub(topic){ try { ws.send(pkt(0x82, [pid >> 8, pid & 255, ...str(topic), 0])); pid = (pid % 65000) + 1; } catch(e){} },
    pub(topic, text){
      const t = str(topic), b = enc.encode(text), body = new Uint8Array(t.length + b.length);
      body.set(t); body.set(b, t.length);
      try { ws.send(pkt(0x30, body)); } catch(e){}
    },
    close(){ clearInterval(ping); failed = true; try { ws.close(); } catch(e){} }
  };
  ws.onopen = () => { try { ws.send(pkt(0x10, [...str("MQTT"), 4, 2, 0, 60, ...str("ptu3d" + rid(14))])); } catch(e){ fail(); } };
  ws.onmessage = ev => {
    const d = new Uint8Array(ev.data);
    const all = new Uint8Array(buf.length + d.length); all.set(buf); all.set(d, buf.length);
    let i = 0;
    while (i < all.length){
      const type = all[i];
      let mul = 1, len = 0, j = i + 1, byte;
      do {
        if (j >= all.length){ buf = all.slice(i); return; }
        byte = all[j++]; len += (byte & 127) * mul; mul *= 128;
      } while (byte & 128);
      if (j + len > all.length){ buf = all.slice(i); return; }
      const body = all.subarray(j, j + len), kind = type >> 4;
      if (kind === 2){
        if (body[1] !== 0){ fail(); return; }
        onOpen(api);
        ping = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch(e){} }, 30000);
      } else if (kind === 3){
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        let p = 2 + tl;
        if (((type >> 1) & 3) > 0) p += 2;
        try { onMsg(topic, dec.decode(body.subarray(p))); } catch(e){}
      }
      i = j + len;
    }
    buf = new Uint8Array(0);
  };
  ws.onerror = fail;
  ws.onclose = fail;
  return api;
}
function mqttTopic(code, who){ return "ptu3d-coop/" + code + "/" + who; }

var coop = null;

function rid(n){
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < n; i++) s += a[(Math.random() * 36) | 0];
  return s;
}
function newRoomCode(){
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += a[(Math.random() * a.length) | 0];
  return s;
}
function roomHash(code){ return ("ptu3d-" + code.toUpperCase() + "--------------------").slice(0, 20); }
function cleanName(n){ return String(n || "").replace(/[<>&"'`]/g, "").trim().slice(0, 12) || "Студент"; }

function waitIce(pc, ms){
  return new Promise(res => {
    if (pc.iceGatheringState === "complete") return res();
    const t = setTimeout(res, ms);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete"){ clearTimeout(t); res(); }
    });
  });
}

async function connType(pc){
  try {
    const st = await pc.getStats();
    let pair = null;
    st.forEach(r => { if (r.type === "transport" && r.selectedCandidatePairId) pair = st.get(r.selectedCandidatePairId); });
    if (!pair) st.forEach(r => { if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") pair = r; });
    if (!pair) return "";
    const a = st.get(pair.localCandidateId), b = st.get(pair.remoteCandidateId);
    const types = [a && a.candidateType, b && b.candidateType];
    if (types.includes("relay")) return "через ретранслятор";
    if (types.every(t => t === "host")) return "одна сеть";
    return "напрямую";
  } catch(e){ return ""; }
}

function coopSend(ch, obj){
  if (ch && ch.readyState === "open"){ try { ch.send(JSON.stringify(obj)); } catch(e){} }
}

function coopStatus(text, bad){
  if (!coop) return;
  coop.status = text; coop.bad = !!bad;
  coopRender();
}

function coopStart(role, code){
  coopLeave(true);
  coop = {
    role, code, hash: roomHash(code), me: (role === "host" ? "H" : "C") + rid(19),
    trackers: [], pending: new Map(), peers: new Map(), host: null,
    slot: role === "host" ? 0 : -1, players: [], name: cleanName(SET.nick),
    timers: [], closed: false, answered: false, t0: performance.now(), status: "", bad: false
  };
  const s = coop;
  if (role === "host") setShirt(0);
  openTrackers(s);
  if (role === "host"){
    coopStatus("Комната создана. Жду игроков…");
    s.timers.push(setInterval(() => hostTick(s), 1000));
    s.timers.push(setInterval(() => { for (const t of s.trackers) announce(s, t); }, 20000));
  } else {
    coopStatus("Ищу комнату " + code + "…");
    s.timers.push(setTimeout(() => clientLoop(s), 1200));
    s.timers.push(setTimeout(() => {
      if (!s.closed && !s.host) coopStatus("Комната не найдена. Проверь код — или хост вышел, или трекеры не пропустили запрос.", true);
    }, 25000));
  }
  s.timers.push(setTimeout(() => {
    if (!s.closed && !s.trackers.some(t => t.state === "ok"))
      coopStatus("Ни один сервер поиска игроков не ответил. Похоже, их блокирует провайдер — попробуй другую сеть.", true);
  }, 8000));
  coopRender();
}

function coopLeave(silent){
  const s = coop;
  if (!s) return;
  if (typeof mpActive === "function" && mpActive()) mpQuit();
  s.closed = true;
  for (const t of s.timers){ clearTimeout(t); clearInterval(t); }
  if (s.role === "host") for (const p of s.peers.values()){ coopSend(p.ch, {t:"bye"}); try { p.pc.close(); } catch(e){} }
  if (s.host){ coopSend(s.host.ch, {t:"bye"}); try { s.host.pc.close(); } catch(e){} }
  for (const p of s.pending.values()){ try { p.pc.close(); } catch(e){} }
  for (const t of s.trackers){ try { if (t.mq) t.mq.close(); else if (t.ws) t.ws.close(); } catch(e){} }
  coop = null;
  setShirt(-1);
  if (!silent) coopRender();
}

function openTrackers(s){
  for (const url of COOP_MQTT){
    const t = {url, kind:"mqtt", mq:null, state:"connecting"};
    s.trackers.push(t);
    t.mq = mqttConn(url, api => {
      if (s.closed){ api.close(); return; }
      t.state = "ok";
      api.sub(mqttTopic(s.code, "all"));
      api.sub(mqttTopic(s.code, s.me));
      coopRender();
    }, (topic, text) => {
      if (s.closed) return;
      let m; try { m = JSON.parse(text); } catch(e){ return; }
      if (!m || typeof m.from !== "string" || m.from === s.me) return;
      if (Array.isArray(m.offers)){
        for (const o of m.offers.slice(0, 6)) if (o && o.offer && typeof o.offer_id === "string")
          onTracker(s, t, {info_hash:s.hash, offer:o.offer, offer_id:o.offer_id, peer_id:m.from});
      } else if (m.answer && typeof m.offer_id === "string"){
        onTracker(s, t, {info_hash:s.hash, answer:m.answer, offer_id:m.offer_id, peer_id:m.from});
      }
    }, () => { t.state = t.state === "ok" ? "closed" : "fail"; coopRender(); });
  }
  for (const url of COOP_TRACKERS){
    const t = {url, ws:null, state:"connecting"};
    s.trackers.push(t);
    try {
      t.ws = new WebSocket(url);
      t.ws.onopen = () => { t.state = "ok"; coopRender(); announce(s, t); };
      t.ws.onerror = () => { if (t.state !== "ok") t.state = "fail"; coopRender(); };
      t.ws.onclose = () => { if (t.state === "ok") t.state = "closed"; else t.state = "fail"; coopRender(); };
      t.ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch(e){ return; }
        if (!s.closed) onTracker(s, t, m);
      };
    } catch(e){ t.state = "fail"; }
  }
}

function trackerSend(t, obj){
  if (t.kind === "mqtt"){
    if (!t.mq || t.state !== "ok" || !coop) return;
    if (obj.answer && obj.to_peer_id)
      t.mq.pub(mqttTopic(coop.code, obj.to_peer_id), JSON.stringify({from:obj.peer_id, answer:obj.answer, offer_id:obj.offer_id}));
    else if (obj.offers)
      t.mq.pub(mqttTopic(coop.code, "all"), JSON.stringify({from:obj.peer_id, offers:obj.offers}));
    return;
  }
  if (t.ws && t.ws.readyState === 1){ try { t.ws.send(JSON.stringify(obj)); } catch(e){} }
}

function announce(s, t, offers){
  if (s.closed) return;
  const msg = {action:"announce", info_hash:s.hash, peer_id:s.me, numwant:offers ? offers.length : 10,
               uploaded:0, downloaded:0, left:s.role === "host" ? 0 : 1, event:"started"};
  if (offers) msg.offers = offers;
  trackerSend(t, msg);
}

function onTracker(s, t, m){
  if (m.info_hash !== s.hash) return;
  if (m.offer && s.role === "host" && typeof m.peer_id === "string" && m.peer_id[0] === "C") hostOnOffer(s, t, m);
  if (m.answer && s.role === "client") clientOnAnswer(s, m);
}

async function makeOffers(s, n){
  const offers = [];
  for (let i = 0; i < n; i++){
    const pc = new RTCPeerConnection({iceServers:COOP_ICE});
    const ch = pc.createDataChannel("g", {ordered:true});
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc, 2500);
    const id = rid(20);
    s.pending.set(id, {pc, ch, t:performance.now()});
    offers.push({offer:{type:"offer", sdp:pc.localDescription.sdp}, offer_id:id});
  }
  return offers;
}

async function clientLoop(s){
  if (s.closed || s.answered) return;
  for (const [id, p] of s.pending){
    if (performance.now() - p.t > 25000){ try { p.pc.close(); } catch(e){} s.pending.delete(id); }
  }
  if (s.trackers.some(t => t.state === "ok")){
    const offers = await makeOffers(s, 3);
    if (s.closed || s.answered) return;
    for (const t of s.trackers) if (t.state === "ok") announce(s, t, offers);
  }
  s.timers.push(setTimeout(() => clientLoop(s), 4000));
}

async function hostOnOffer(s, t, m){
  if (s.peers.has(m.peer_id)) return;
  if (s.peers.size >= COOP_MAX - 1) return;
  const pc = new RTCPeerConnection({iceServers:COOP_ICE});
  const peer = {id:m.peer_id, pc, ch:null, name:"…", slot:-1, ping:null, type:"", joined:false};
  s.peers.set(m.peer_id, peer);
  pc.ondatachannel = ev => { peer.ch = ev.channel; bindChannel(s, peer); };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(pc.connectionState)) dropPeer(s, peer);
  };
  try {
    await pc.setRemoteDescription(m.offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc, 2500);
    trackerSend(t, {action:"announce", info_hash:s.hash, peer_id:s.me, to_peer_id:m.peer_id,
                    answer:{type:"answer", sdp:pc.localDescription.sdp}, offer_id:m.offer_id});
  } catch(e){ s.peers.delete(m.peer_id); try { pc.close(); } catch(err){} return; }
  s.timers.push(setTimeout(() => { if (!peer.joined) dropPeer(s, peer); }, 20000));
}

async function clientOnAnswer(s, m){
  if (s.host || s.answered) return;
  const p = s.pending.get(m.offer_id);
  if (!p || typeof m.peer_id !== "string" || m.peer_id[0] !== "H") return;
  s.answered = true;
  s.pending.delete(m.offer_id);
  for (const q of s.pending.values()){ try { q.pc.close(); } catch(e){} }
  s.pending.clear();
  const host = {id:m.peer_id, pc:p.pc, ch:p.ch, ping:null, type:""};
  s.host = host;
  p.pc.onconnectionstatechange = () => {
    const st = p.pc.connectionState;
    if (st === "failed") coopStatus("Прямое соединение не удалось: ваши сети не пропускают связь напрямую.", true);
    if (st === "closed" || st === "failed"){ if (!s.closed) hostLost(s); }
  };
  coopStatus("Хост найден, соединяюсь…");
  try { await p.pc.setRemoteDescription(m.answer); }
  catch(e){ coopStatus("Ошибка соединения: " + e.message, true); return; }
  bindChannel(s, host);
  s.timers.push(setTimeout(() => {
    if (!s.closed && (!host.ch || host.ch.readyState !== "open"))
      coopStatus("Прямое соединение не удалось: ваши сети не пропускают связь напрямую.", true);
  }, 15000));
}

function bindChannel(s, peer){
  const ch = peer.ch;
  ch.onopen = () => {
    if (s.role === "client") coopSend(ch, {t:"hello", name:s.name, ver:COOP_VER});
  };
  ch.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch(e){ return; }
    if (!m || typeof m.t !== "string" || s.closed) return;
    if (s.role === "host") hostMsg(s, peer, m); else clientMsg(s, m);
  };
  ch.onclose = () => {
    if (s.closed) return;
    if (s.role === "host") dropPeer(s, peer); else hostLost(s);
  };
  if (ch.readyState === "open") ch.onopen();
}

function hostMsg(s, peer, m){
  if (m.t === "hello"){
    if (m.ver !== COOP_VER){
      coopSend(peer.ch, {t:"reject", reason:"У вас разные версии игры. Обновите страницу у всех."});
      setTimeout(() => dropPeer(s, peer), 500);
      return;
    }
    const used = new Set([0, ...[...s.peers.values()].filter(p => p.joined).map(p => p.slot)]);
    let slot = -1;
    for (let i = 1; i < COOP_MAX; i++) if (!used.has(i)){ slot = i; break; }
    if (slot < 0){ coopSend(peer.ch, {t:"reject", reason:"Комната заполнена."}); setTimeout(() => dropPeer(s, peer), 500); return; }
    peer.joined = true; peer.slot = slot; peer.name = cleanName(m.name);
    coopSend(peer.ch, {t:"welcome", slot});
    hostLobby(s);
    beep("sine", 520, .25, .12, 780);
  } else if (m.t === "pong" && typeof m.ts === "number"){
    peer.ping = Math.max(0, Math.round(performance.now() - m.ts));
  } else if (m.t === "bye"){
    dropPeer(s, peer);
  } else mpHostMsg(s, peer, m);
}

function clientMsg(s, m){
  if (m.t === "welcome" && Number.isInteger(m.slot) && m.slot > 0 && m.slot < COOP_MAX){
    s.slot = m.slot; setShirt(m.slot);
    coopStatus("Ты в комнате. Ждём остальных.");
  } else if (m.t === "lobby" && Array.isArray(m.players)){
    s.players = m.players.slice(0, COOP_MAX).map(p => ({
      name:cleanName(p.name), slot:Math.max(0, Math.min(COOP_MAX-1, p.slot|0)),
      ping:typeof p.ping === "number" ? Math.max(0, Math.min(9999, p.ping|0)) : null,
      type:String(p.type || "").slice(0, 20), host:!!p.host
    }));
    coopRender();
  } else if (m.t === "ping" && typeof m.ts === "number"){
    coopSend(s.host.ch, {t:"pong", ts:m.ts});
  } else if (m.t === "reject"){
    coopStatus(String(m.reason || "Хост отказал в подключении.").slice(0, 80), true);
    const h = s.host; s.host = null;
    try { h && h.pc.close(); } catch(e){}
  } else if (m.t === "bye"){
    hostLost(s);
  } else mpClientMsg(s, m);
}

function hostLost(s){
  if (s.closed || !s.host) return;
  if (mpIsClient()) mpEnd("Хост вышел или связь пропала.");
  s.host = null;
  s.players = [];
  coopStatus("Хост вышел или связь пропала.", true);
}

function dropPeer(s, peer){
  if (!s.peers.has(peer.id)) return;
  s.peers.delete(peer.id);
  try { peer.pc.close(); } catch(e){}
  if (peer.joined) hostLobby(s);
}

function hostTick(s){
  if (s.closed) return;
  for (const p of s.peers.values()){
    if (!p.joined) continue;
    coopSend(p.ch, {t:"ping", ts:performance.now()});
    connType(p.pc).then(tp => { if (tp) p.type = tp; });
  }
  hostLobby(s);
}

function hostLobby(s){
  const players = [{name:s.name, slot:0, ping:0, type:"", host:true}];
  for (const p of s.peers.values()) if (p.joined) players.push({name:p.name, slot:p.slot, ping:p.ping, type:p.type, host:false});
  players.sort((a, b) => a.slot - b.slot);
  s.players = players;
  for (const p of s.peers.values()) if (p.joined) coopSend(p.ch, {t:"lobby", players});
  coopRender();
}

function setShirt(slot){
  shirtColor = slot >= 0 ? SHIRTS[slot] : SHIRT_DEFAULT;
  faceKey = "";
}

var portraitCache = {};
function studentPortrait(color){
  if (portraitCache[color]) return portraitCache[color];
  const keep = shirtColor;
  shirtColor = color;
  paintFace({mood:"calm", dmg:0, dir:0, blink:false});
  const c = document.createElement("canvas"); c.width = 40; c.height = 48;
  c.getContext("2d").drawImage(faceCv, 0, 0);
  shirtColor = keep; faceKey = "";
  portraitCache[color] = c.toDataURL();
  return portraitCache[color];
}

function coopRender(){
  const box = document.getElementById("coop");
  if (!box) return;
  const s = coop;
  document.getElementById("cp_start").classList.toggle("gone", !!s);
  document.getElementById("cp_room").classList.toggle("gone", !s);
  const st = document.getElementById("cp_status");
  st.textContent = s ? s.status : "";
  st.classList.toggle("bad", !!(s && s.bad));
  const diag = document.getElementById("cp_diag");
  if (s){
    const ok = s.trackers.filter(t => t.state === "ok").length;
    diag.textContent = `Серверы поиска: ${ok} из ${s.trackers.length} на связи · ` +
      s.trackers.map(t => (t.state === "ok" ? "✓ " : t.state === "connecting" ? "… " : "✗ ") +
        t.url.replace(/^wss?:\/\//, "").replace(/[:/].*$/, "")).join(" · ");
  } else diag.textContent = "";
  if (!s) return;
  document.getElementById("cp_codeshow").textContent = s.code;
  const list = document.getElementById("cp_players");
  list.innerHTML = "";
  const shown = s.players.length ? s.players : (s.role === "client" ? [] : [{name:s.name, slot:0, ping:0, host:true}]);
  for (const p of shown){
    const row = document.createElement("div"); row.className = "cp-player";
    const img = document.createElement("img"); img.src = studentPortrait(SHIRTS[p.slot]); img.alt = "";
    const nm = document.createElement("span"); nm.className = "cp-name";
    nm.textContent = p.name + ((s.role === "host" && p.host) || (s.role === "client" && p.slot === s.slot) ? " (ты)" : "");
    const info = document.createElement("span"); info.className = "cp-info";
    info.textContent = p.host ? "хост" : (p.ping == null ? "соединение…" : `${p.ping} мс${p.type ? " · " + p.type : ""}`);
    const sw = document.createElement("i"); sw.style.background = SHIRTS[p.slot]; sw.title = SHIRT_NAMES[p.slot] + " рубашка";
    row.append(img, sw, nm, info);
    list.append(row);
  }
  const canGo = s.role === "host" && shown.length > 1;
  document.getElementById("cp_go").classList.toggle("gone", !canGo);
  document.getElementById("cp_hint").textContent = s.role === "host"
    ? `Игроков: ${shown.length} из ${COOP_MAX}. ${canGo ? "Можно начинать." : "Отправь код друзьям и жди."}`
    : `Игроков: ${shown.length} из ${COOP_MAX}. Игру начинает хост.`;
}

function openCoop(){
  document.getElementById("coop").classList.remove("gone");
  document.getElementById("cp_name").value = SET.nick || "";
  coopRender();
}
function closeCoop(){
  coopLeave();
  document.getElementById("coop").classList.add("gone");
}

function initCoop(){
  onTap(document.getElementById("coopbtn"), openCoop);
  onTap(document.getElementById("cp_leave"), closeCoop);
  const nameIn = document.getElementById("cp_name");
  nameIn.addEventListener("change", () => { SET.nick = cleanName(nameIn.value); nameIn.value = SET.nick; saveSettings(); });
  onTap(document.getElementById("cp_host"), () => {
    SET.nick = cleanName(nameIn.value); saveSettings();
    coopStart("host", newRoomCode());
  });
  const codeIn = document.getElementById("cp_code");
  codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); });
  onTap(document.getElementById("cp_join"), () => {
    const code = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5){ codeIn.focus(); return; }
    SET.nick = cleanName(nameIn.value); saveSettings();
    coopStart("client", code);
  });
  onTap(document.getElementById("cp_copy"), () => {
    if (coop) navigator.clipboard?.writeText(coop.code).catch(() => {});
  });
  onTap(document.getElementById("cp_back"), () => { coopLeave(); });
  onTap(document.getElementById("cp_go"), () => mpHostStart());
  addEventListener("pagehide", () => coopLeave(true));
}
initCoop();
