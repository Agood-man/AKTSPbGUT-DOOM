/*
 * Game bootstrap.
 * All runtime modules are loaded before this file from index.html.
 * Keeping this file tiny makes future bundling or further splitting easy.
 */
window.AKTSPbGUT_DOOM_READY = true;

(function(){
  if (typeof window === "undefined" || typeof navigator === "undefined" || !window.addEventListener) return;
  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && secure)
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  const btn = document.getElementById("installbtn");
  const standalone = () => (window.matchMedia && (matchMedia("(display-mode: fullscreen)").matches || matchMedia("(display-mode: standalone)").matches)) || navigator.standalone === true;
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e;
    if (btn && !standalone()) btn.classList.remove("gone");
  });
  window.addEventListener("appinstalled", () => { deferred = null; if (btn) btn.classList.add("gone"); });
  if (btn) btn.addEventListener("click", async () => {
    if (!deferred) return;
    const ev = deferred; deferred = null;
    btn.classList.add("gone");
    try { await ev.prompt(); await ev.userChoice; } catch(err){}
  });
})();
