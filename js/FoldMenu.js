// FoldMenu.js
// Add data-fold to any container. Click its first DIRECT child heading (h1-h6) to fold/unfold the rest.

(() => {
  const HEAD = "h1,h2,h3,h4,h5,h6";

  const qsHead = (el) =>
    el.querySelector(`:scope > ${HEAD}`) || el.querySelector(HEAD); // fallback if :scope unsupported

  function setup(el) {
    const head = qsHead(el);
    if (!head) return;

    // Build body wrapper from everything AFTER the heading (no HTML edits needed)
    const body = document.createElement("div");
    body.className = "fold-body";

    let n = head.nextSibling;
    let hasContent = false;
    while (n) {
      hasContent = true;
      const next = n.nextSibling;
      body.appendChild(n);
      n = next;
    }
    if (!hasContent) return;

    el.appendChild(body);

    // a11y
    head.tabIndex = 0;
    head.setAttribute("role", "button");

    let open = String(el.getAttribute("data-fold")).toLowerCase() !== "closed";
    head.setAttribute("aria-expanded", String(open));

    if (!open) {
      el.classList.add("is-collapsed");
      body.style.height = "0px";
      body.style.opacity = "0";
    }

    const collapse = () => {
      body.style.height = body.scrollHeight + "px";
      body.style.opacity = "1";
      body.offsetHeight; // reflow
      requestAnimationFrame(() => {
        body.style.height = "0px";
        body.style.opacity = "0";
      });
      el.classList.add("is-collapsed");
      head.setAttribute("aria-expanded", "false");
      open = false;
    };

    const expand = () => {
      el.classList.remove("is-collapsed");
      body.style.height = "0px";
      body.style.opacity = "0";
      body.offsetHeight; // reflow
      const target = body.scrollHeight;
      requestAnimationFrame(() => {
        body.style.height = target + "px";
        body.style.opacity = "1";
      });
      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        body.style.height = "auto"; // return to natural layout
        body.removeEventListener("transitionend", onEnd);
      };
      body.addEventListener("transitionend", onEnd);

      head.setAttribute("aria-expanded", "true");
      open = true;
    };

    const toggle = () => (open ? collapse() : expand());

    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-fold]").forEach(setup);
  });
})();