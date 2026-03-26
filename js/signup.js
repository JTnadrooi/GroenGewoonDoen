import { apiFetch } from "./api.js";

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("signupForm");
  var errorEl = document.getElementById("error");
  var submitButton = document.getElementById("signupButton");

  if (!form) return;

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    errorEl.textContent = "";

    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    var confirm = document.getElementById("confirm").value;

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
      var result = await apiFetch("/newuser", {
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

      var res = result.res;
      var origin = result.origin;

      var data = await res.json().catch(function () {
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