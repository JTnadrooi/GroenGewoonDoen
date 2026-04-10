import { apiFetch } from "./api.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const errorEl = document.getElementById("error");
  const submitButton = document.getElementById("signupButton");

  if (!form) return;

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    errorEl.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if (!name || !email || !password || !confirm) {
      errorEl.textContent = "All fields are required.";
      return;
    }

    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const result = await apiFetch("/newuser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: name,
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
        throw new Error(data.message || "Signup failed");
      }

      window.location.href = origin + (data.redirect || "/login");
    } catch (e) {
      errorEl.textContent = e.message || "Signup failed";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
});