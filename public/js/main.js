console.log("main.js loaded");

// ===== 계정 메뉴 드롭다운 =====
(function () {
  const btn = document.getElementById("accountBtn");
  const dd = document.getElementById("accountDropdown");
  if (!btn || !dd) return;

  const close = () => {
    dd.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dd.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", close);
  window.addEventListener("scroll", close, true);
})();
