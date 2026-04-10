import { apiFetch } from "./api.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("error");
  const submitButton = document.getElementById("loginButton");

  if (!form) return;

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    errorEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      errorEl.textContent = "Please enter email and password.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await apiFetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const res = result.res;
      const origin = result.origin;

      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      window.location.href = origin + (data.redirect || "/user");
    } catch (e) {
      errorEl.textContent = e.message || "Login failed";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});