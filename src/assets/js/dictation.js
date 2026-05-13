/* ============================================================
   THE FREETHINKING TIMES — Form Dictation
   Adds voice-to-text buttons on textareas with data-dictation
   Uses Web Speech API (SpeechRecognition)
   ============================================================ */
(function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  var textareas = document.querySelectorAll('[data-dictation]');
  if (!textareas.length) return;

  textareas.forEach(function (ta) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w3f__dictate';
    btn.setAttribute('aria-label', 'Dictate with voice');
    btn.title = 'Dictate with voice';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Dictate';

    // Insert button after the textarea
    ta.parentNode.insertBefore(btn, ta.nextSibling);

    var recognition = null;
    var listening = false;

    btn.addEventListener('click', function () {
      if (listening) {
        recognition.stop();
        return;
      }

      recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = function () {
        listening = true;
        btn.classList.add('is-listening');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16"/></svg> Stop';
        btn.setAttribute('aria-label', 'Stop dictation');
      };

      recognition.onresult = function (event) {
        var text = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        // Append to existing text with a space
        if (ta.value && !ta.value.endsWith(' ') && !ta.value.endsWith('\n')) {
          ta.value += ' ';
        }
        ta.value += text;
      };

      recognition.onend = function () {
        listening = false;
        btn.classList.remove('is-listening');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Dictate';
        btn.setAttribute('aria-label', 'Dictate with voice');
      };

      recognition.onerror = function (e) {
        listening = false;
        btn.classList.remove('is-listening');
        if (e.error === 'not-allowed') {
          btn.hidden = true;
        }
      };

      recognition.start();
    });
  });
})();
