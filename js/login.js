import { apiFetch } from "./api.js";

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("loginForm");
  var errorEl = document.getElementById("error");
  var submitButton = document.getElementById("loginButton");

  if (!form) return;

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    errorEl.textContent = "";

    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    if (!email || !password) {
      errorEl.textContent = "Please enter email and password.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      var result = await apiFetch("/login", {
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

      var res = result.res;
      var origin = result.origin;

      var data = await res.json().catch(function () {
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