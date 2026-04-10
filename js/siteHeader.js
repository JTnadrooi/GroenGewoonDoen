// Inserts the same welcome header into every page once.
// The inserted header uses data-fold so FoldMenu.js can make it collapsible.

(() => {
  // Shared header HTML.
  const HEADER_HTML = `
    <header data-fold data-site-header>
      <h2>Green & Just Do It</h2><br>
      <p>Welcome!</p>
      <p>Order your garden services easily online!</p>
    </header>
  `.trim();

  document.addEventListener("DOMContentLoaded", () => {
    // Do not insert the header if it already exists on the page.
    if (document.querySelector("[data-site-header]")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = HEADER_HTML;
    const header = wrap.firstElementChild;

    const body = document.body;
    const h1 = body.querySelector("h1");

    // If there is an h1 directly inside body, place the shared header after it.
    // Otherwise place it at the top of the page.
    if (h1 && h1.parentElement === body) {
      h1.insertAdjacentElement("afterend", header);
    } else {
      body.insertAdjacentElement("afterbegin", header);
    }
  });
})();