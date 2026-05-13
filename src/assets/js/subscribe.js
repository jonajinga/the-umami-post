/**
 * The Freethinking Times — Email Subscribe
 *
 * Handles Buttondown newsletter subscription forms.
 * Works with any number of .subscribe-form elements on the page.
 *
 * Setup:
 *   1. Create a free account at buttondown.email
 *   2. Go to Settings → API Keys, copy your key
 *   3. Replace YOUR_BUTTONDOWN_USERNAME below with your username
 *      (found in your Buttondown URL: buttondown.email/YOUR_USERNAME)
 *   4. No backend required — Buttondown accepts direct form posts
 */

(function () {
  'use strict';

  // ── Wire up all subscribe forms on the page ────────────────────
  document.querySelectorAll('.subscribe-form').forEach(form => {
    const BUTTONDOWN_URL = form.dataset.action || 'https://buttondown.com/api/emails/embed-subscribe/thefreethinkingtimes';
    const input  = form.querySelector('.subscribe-form__input');
    const btn    = form.querySelector('.subscribe-form__btn');
    const status = form.nextElementSibling?.classList.contains('subscribe-status')
      ? form.nextElementSibling
      : null;

    if (!input || !btn) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const email = input.value.trim();
      if (!email || !isValidEmail(email)) {
        showStatus(status, 'error', 'Please enter a valid email address.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Subscribing…';

      try {
        const res = await fetch(BUTTONDOWN_URL, {
          method: 'POST',
          body: new URLSearchParams({ email }),
        });

        if (res.ok || res.status === 201) {
          window.location.href = '/newsletter/welcome/';
        } else if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.detail || 'This email may already be subscribed.';
          showStatus(status, 'error', msg);
          resetBtn(btn);
        } else {
          throw new Error('Unexpected response');
        }
      } catch (err) {
        showStatus(status, 'error', 'Something went wrong. Try again or email us directly.');
        resetBtn(btn);
      }
    });
  });

  // ── Helpers ────────────────────────────────────────────────────
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showStatus(el, type, message) {
    if (!el) return;
    el.className = `subscribe-status is-${type}`;
    el.textContent = message;
  }

  function resetBtn(btn) {
    btn.disabled = false;
    btn.textContent = 'Subscribe';
  }

})();
