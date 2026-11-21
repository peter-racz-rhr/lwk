/* Runs before the page paints: apply the saved theme and start the opening animation. */
(function () {
  try {
    var t = localStorage.getItem("blindspritz2:theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked */ }
  document.documentElement.classList.add("intro");
})();
