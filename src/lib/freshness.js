(function () {
  var el = typeof document !== "undefined" && document.getElementById ? document.getElementById("pwFreshness") : null;
  if (!el) return;
  var script = typeof document !== "undefined" && document.currentScript;
  var rawSec = (script && script.getAttribute ? script.getAttribute("data-stale-sec") : null) ||
               (el && el.getAttribute ? el.getAttribute("data-stale-sec") : null);
  var parsed = rawSec != null && String(rawSec).trim() !== "" ? Number(rawSec) : NaN;
  var staleThreshold = (!isNaN(parsed) && parsed > 0) ? parsed : 300;
  var updatedAt = Date.now();
  function render() {
    var sec = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
    var stale = sec > staleThreshold;
    el.textContent = stale
      ? "לא עדכני — המידע בן יותר מ-5 דקות. ייתכן שהמקום כבר נתפס; בדקו שוב לפני נסיעה."
      : "עודכן לפני " + sec + " שניות — מקום פנוי נכון לרגע העדכון, ויכול להיתפס אחריו";
    el.style.color = stale ? "var(--pw-danger,#dc2626)" : "";
    el.style.fontWeight = stale ? "700" : "";
  }
  render();
  setInterval(render, 10000);
  if (document.addEventListener) document.addEventListener("input", function () { updatedAt = Date.now(); render(); });
})();
