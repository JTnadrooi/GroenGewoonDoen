// Add data-fold to a container to make it collapsible.
// The first heading inside that container becomes the toggle button.

(() => {
  // These heading tags can act as the clickable fold header.
  const HEAD = "h1,h2,h3,h4,h5,h6";

  // Tries to find the first direct child heading.
  // If :scope is not supported, it falls back to the first heading inside.
  const qsHead = (el) =>
    el.querySelector(`:scope > ${HEAD}`) || el.querySelector(HEAD);

  // Turns one element with data-fold into a foldable section.
  function setup(el) {
    const head = qsHead(el);

    // Stop if there is no heading to use as the clickable title.
    if (!head) return;

    // Create a wrapper for everything that comes after the heading.
    const body = document.createElement("div");
    body.className = "fold-body";

    let n = head.nextSibling;
    let hasContent = false;

    // Move everything after the heading into the wrapper.
    while (n) {
      hasContent = true;
      const next = n.nextSibling;
      body.appendChild(n);
      n = next;
    }

    // If there is no content after the heading, there is nothing to fold.
    if (!hasContent) return;

    el.appendChild(body);

    // Make the heading keyboard accessible like a button.
    head.tabIndex = 0;
    head.setAttribute("role", "button");

    // Read the starting state from data-fold.
    // Anything other than "closed" is treated as open.
    let open = String(el.getAttribute("data-fold")).toLowerCase() !== "closed";
    head.setAttribute("aria-expanded", String(open));

    // If the section starts closed, apply the closed styles immediately.
    if (!open) {
      el.classList.add("is-collapsed");
      body.style.height = "0px";
      body.style.opacity = "0";
    }

    // Animates the section closed.
    const collapse = () => {
      body.style.height = body.scrollHeight + "px";
      body.style.opacity = "1";

      // Force a layout update so the browser picks up the starting height.
      body.offsetHeight;

      requestAnimationFrame(() => {
        body.style.height = "0px";
        body.style.opacity = "0";
      });

      el.classList.add("is-collapsed");
      head.setAttribute("aria-expanded", "false");
      open = false;
    };

    // Animates the section open.
    const expand = () => {
      el.classList.remove("is-collapsed");
      body.style.height = "0px";
      body.style.opacity = "0";

      // Force a layout update before animating.
      body.offsetHeight;

      const target = body.scrollHeight;

      requestAnimationFrame(() => {
        body.style.height = target + "px";
        body.style.opacity = "1";
      });

      // After the animation finishes, return the height to auto.
      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        body.style.height = "auto";
        body.removeEventListener("transitionend", onEnd);
      };

      body.addEventListener("transitionend", onEnd);

      head.setAttribute("aria-expanded", "true");
      open = true;
    };

    // Switch between open and closed.
    const toggle = () => (open ? collapse() : expand());

    // Mouse support.
    head.addEventListener("click", toggle);

    // Keyboard support for Enter and Space.
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }

  // Set up every element with data-fold after the page loads.
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-fold]").forEach(setup);
  });
})();