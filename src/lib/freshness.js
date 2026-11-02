(function () {
  var el = document.getElementById("pwFreshness");
  if (!el) return;
  var updatedAt = Date.now();
  function render() {
    var sec = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
    var stale = sec > 300;
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
