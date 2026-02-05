// js/siteHeader.js
// Inserts the same welcome header on any page (once). Works with your FoldMenu.js via data-fold.

(() => {
  const HEADER_HTML = `
    <header data-fold data-site-header>
      <h2>Green & Just Do It</h2><br>
      <p>Welcome!</p>
      <p>Order your garden services easily online!</p>
    </header>
  `.trim();

  document.addEventListener("DOMContentLoaded", () => {
    // Don't insert twice
    if (document.querySelector("[data-site-header]")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = HEADER_HTML;
    const header = wrap.firstElementChild;

    const body = document.body;
    const h1 = body.querySelector("h1");

    // If there’s an H1, place the header under it; otherwise put it at the top.
    if (h1 && h1.parentElement === body) {
      h1.insertAdjacentElement("afterend", header);
    } else {
      body.insertAdjacentElement("afterbegin", header);
    }
  });
})();