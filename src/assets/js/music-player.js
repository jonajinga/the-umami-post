/**
 * Freethought Music — persistent background YouTube player.
 * Uses YouTube IFrame API. Player persists across page navigation
 * by saving state to localStorage and resuming on each page load.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var K = {
    playlist: _p + '-music-playlist',
    name: _p + '-music-name',
    playing: _p + '-music-playing',
    volume: _p + '-music-volume',
    index: _p + '-music-index',
    time: _p + '-music-time'
  };

  var player = null;
  var ready = false;

  function loadYouTubeAPI() {
    if (document.getElementById('yt-iframe-api') || (window.YT && window.YT.Player)) return;
    var s = document.createElement('script');
    s.id = 'yt-iframe-api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }
  var currentName = '';
  var targetVolume = 80;

  // DOM elements (created dynamically)
  var bar, nameEl, titleEl, playIcon, pauseIcon, volSlider;

  function createPlayerBar() {
    if (document.getElementById('tft-music-bar')) return;

    bar = document.createElement('div');
    bar.id = 'tft-music-bar';
    bar.className = 'music-bar';
    bar.hidden = true;
    bar.innerHTML =
      '<div class="music-bar__info">' +
        '<span class="music-bar__name" id="mb-name"></span>' +
        '<span class="music-bar__title" id="mb-title">Loading...</span>' +
      '</div>' +
      '<div class="music-bar__controls">' +
        '<button type="button" id="mb-prev" class="music-bar__btn" aria-label="Previous">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>' +
        '</button>' +
        '<button type="button" id="mb-play" class="music-bar__btn music-bar__btn--play" aria-label="Play/Pause">' +
          '<svg id="mb-play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>' +
          '<svg id="mb-pause-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
        '</button>' +
        '<button type="button" id="mb-next" class="music-bar__btn" aria-label="Next">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>' +
        '</button>' +
        '<input type="range" id="mb-vol" min="0" max="100" value="80" class="music-bar__vol" aria-label="Volume">' +
        '<button type="button" id="mb-close" class="music-bar__btn" aria-label="Stop" onclick="window.musicPlayer.stop();">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';

    // Music bar is its own fixed-position strip at the viewport
    // bottom, sibling to the audio-bar and the annotation-toolbar.
    // CSS stacks them: reader toolbar at the very bottom on article
    // pages, music bar above it, TTS audio bar above the music bar.
    document.body.appendChild(bar);

    nameEl = document.getElementById('mb-name');
    titleEl = document.getElementById('mb-title');
    playIcon = document.getElementById('mb-play-icon');
    pauseIcon = document.getElementById('mb-pause-icon');
    volSlider = document.getElementById('mb-vol');

    document.getElementById('mb-play').addEventListener('click', function () {
      if (!player) return;
      var s = player.getPlayerState();
      if (s === YT.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
    });

    // Mutual exclusion: pause the music whenever the article TTS bar
    // starts playing. Fired by audio-bar.js. We don't unmute or
    // resume — once interrupted by narration, the reader can hit
    // play on the music bar to bring it back.
    document.addEventListener('tft:tts-playing', function () {
      if (!player) return;
      try {
        if (player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) {
          player.pauseVideo();
        }
      } catch (e) {}
    });

    document.getElementById('mb-prev').addEventListener('click', function () {
      if (player) { player.previousVideo(); setTimeout(updateNowPlaying, 500); }
    });

    document.getElementById('mb-next').addEventListener('click', function () {
      if (player) { player.nextVideo(); setTimeout(updateNowPlaying, 500); }
    });

    volSlider.addEventListener('input', function () {
      targetVolume = parseInt(this.value, 10);
      if (player) player.setVolume(targetVolume);
      try { localStorage.setItem(K.volume, String(targetVolume)); } catch (e) {}
    });

    // Restore volume
    var savedVol = localStorage.getItem(K.volume);
    if (savedVol) { targetVolume = parseInt(savedVol, 10); volSlider.value = targetVolume; }

    // Create player container
    var wrap = document.createElement('div');
    wrap.id = 'tft-yt-wrap';
    wrap.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;overflow:hidden;';
    wrap.innerHTML = '<div id="tft-yt-player"></div>';
    document.body.appendChild(wrap);
  }

  // Initialise the background player for a single video ID. Parallel to
  // initPlayer() but uses `videoId` instead of `list`.
  function initPlayerForVideo(videoId, cb, resumeTime) {
    createPlayerBar();
    if (player) { try { player.destroy(); } catch (e) {} player = null; }
    var wrap = document.getElementById('tft-yt-wrap');
    wrap.innerHTML = '<div id="tft-yt-player"></div>';
    var unmutedOnce = false;
    player = new YT.Player('tft-yt-player', {
      height: '1',
      width: '1',
      playerVars: {
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1
      },
      events: {
        onReady: function () {
          ready = true;
          try { player.mute(); } catch (e) {}
          // loadVideoById is more reliable than passing videoId in the
          // constructor — Chrome desktop otherwise sometimes hangs with the
          // iframe stuck on 'Loading...' because autoplay-with-videoId is
          // delayed by media policies.
          try {
            player.loadVideoById({ videoId: videoId, startSeconds: resumeTime || 0 });
          } catch (e) {}
          if (cb) cb();
          // Pull title once metadata resolves.
          setTimeout(updateNowPlaying, 800);
          setTimeout(updateNowPlaying, 2000);
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.PLAYING) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
            // Unmute + fade in the first time playback actually starts,
            // not in onReady (too early — no audio pipeline yet).
            if (!unmutedOnce) {
              unmutedOnce = true;
              try { player.unMute(); } catch (e) {}
              fadeIn();
            }
            saveState();
            // Mutual exclusion with the article TTS bar: tell anyone
            // listening that we just started, so audio-bar.js can pause
            // its narration. One soundtrack at a time.
            document.dispatchEvent(new CustomEvent('tft:music-playing'));
          } else {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
          }
          updateNowPlaying();
        },
        onError: function () {
          titleEl.textContent = 'Could not load song';
        }
      }
    });
  }

  function initPlayer(playlistId, cb, resumeIndex, resumeTime) {
    createPlayerBar();

    if (player) {
      try { player.destroy(); } catch (e) {}
      player = null;
    }

    // Recreate container
    var wrap = document.getElementById('tft-yt-wrap');
    wrap.innerHTML = '<div id="tft-yt-player"></div>';

    player = new YT.Player('tft-yt-player', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        mute: 1,
        list: playlistId,
        listType: 'playlist'
      },
      events: {
        onReady: function () {
          ready = true;
          player.setVolume(0);
          player.unMute();

          // Start fading in immediately so there is no silent gap on page load
          fadeIn();

          // Seek to saved track/time while fade is already in progress
          if (resumeIndex > 0 || resumeTime > 0) {
            setTimeout(function () {
              if (player && resumeIndex > 0) player.playVideoAt(resumeIndex);
              setTimeout(function () {
                if (player && resumeTime > 0) player.seekTo(resumeTime, true);
              }, 200);
            }, 300);
          }

          if (cb) cb();
          setTimeout(updateNowPlaying, 2000);
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.PLAYING) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
            saveState();
          } else {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
          }
          updateNowPlaying();
        },
        onError: function () {
          titleEl.textContent = 'Could not load playlist';
        }
      }
    });
  }

  function updateNowPlaying() {
    if (!player || !player.getVideoData) return;
    var d = player.getVideoData();
    if (titleEl) titleEl.textContent = d.title || 'Loading...';
    if (nameEl) nameEl.textContent = currentName;
    saveState();
  }

  function saveState() {
    try {
      if (currentName) localStorage.setItem(K.name, currentName);
      if (player && player.getPlaylist) {
        var pl = player.getPlaylist();
        if (pl) localStorage.setItem(K.playlist, localStorage.getItem(K.playlist) || '');
        localStorage.setItem(K.index, String(player.getPlaylistIndex()));
        localStorage.setItem(K.time, String(Math.floor(player.getCurrentTime())));
        localStorage.setItem(K.playing, '1');
      }
    } catch (e) {}
  }

  function fadeIn() {
    if (!player || !player.setVolume) return;
    // On mobile, skip fade — setVolume in intervals can fail
    var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      player.unMute();
      player.setVolume(targetVolume);
      return;
    }
    var vol = 0;
    var step = targetVolume / 20;
    var iv = setInterval(function () {
      vol += step;
      if (vol >= targetVolume) { vol = targetVolume; clearInterval(iv); }
      if (player && player.setVolume) player.setVolume(Math.round(vol));
    }, 50);
  }

  // Save state frequently so page navigation can resume
  setInterval(function () { if (player && ready) { updateNowPlaying(); saveState(); } }, 2000);

  // Save on page unload
  window.addEventListener('beforeunload', saveState);

  // SPA-nav integration. When the app swaps #main-content, any music bar
  // mounted into #annotation-toolbar-music (an article-layout slot) gets
  // wiped even though the YT iframe (parked on document.body) keeps
  // playing. Before the swap we re-parent the bar to body so it survives;
  // after the swap we re-seat it into the new page's slot if present.
  document.addEventListener('spa:beforeswap', function () {
    if (bar && bar.parentNode && bar.parentNode.id === 'annotation-toolbar-music') {
      document.body.appendChild(bar);
    }
  });
  document.addEventListener('spa:contentswap', function () {
    if (!bar) return;
    var slot = document.getElementById('annotation-toolbar-music');
    if (slot && bar.parentNode !== slot) slot.appendChild(bar);
  });

  // Public API
  window.musicPlayer = {
    loadPlaylist: function (id, name) {
      currentName = name || 'Playlist';
      createPlayerBar();
      bar.hidden = false;
      if (nameEl) nameEl.textContent = currentName;
      if (titleEl) titleEl.textContent = 'Loading...';

      try {
        localStorage.setItem(K.playlist, id);
        localStorage.setItem(K.name, currentName);
        localStorage.setItem(K.playing, '1');
      } catch (e) {}

      loadYouTubeAPI();
      if (ready || (window.YT && window.YT.Player)) {
        ready = true;
        initPlayer(id);
      } else {
        // Wait for API
        var wait = setInterval(function () {
          if (window.YT && window.YT.Player) {
            clearInterval(wait);
            ready = true;
            initPlayer(id);
          }
        }, 200);
        // Timeout after 10s
        setTimeout(function () { clearInterval(wait); }, 10000);
      }
    },

    // Play a single song by YouTube video ID. Works just like loadPlaylist
    // but uses videoId rather than a list; persists across navigation.
    loadSong: function (videoId, name) {
      if (!videoId) return;
      currentName = name || 'Song';
      createPlayerBar();
      bar.hidden = false;
      if (nameEl) nameEl.textContent = currentName;
      if (titleEl) titleEl.textContent = 'Loading\u2026';

      try {
        localStorage.setItem(K.playlist, 'VIDEO:' + videoId); // prefix to mark single video
        localStorage.setItem(K.name, currentName);
        localStorage.setItem(K.playing, '1');
        localStorage.removeItem(K.index);
        localStorage.removeItem(K.time);
      } catch (e) {}

      function start() { ready = true; initPlayerForVideo(videoId); }
      loadYouTubeAPI();
      if (ready || (window.YT && window.YT.Player)) start();
      else {
        var wait = setInterval(function () {
          if (window.YT && window.YT.Player) { clearInterval(wait); start(); }
        }, 200);
        setTimeout(function () { clearInterval(wait); }, 10000);
      }
    },

    stop: function () {
      if (player) {
        try { player.stopVideo(); player.destroy(); } catch (e) {}
        player = null;
      }
      if (bar) bar.hidden = true;
      try {
        localStorage.removeItem(K.playing);
        localStorage.removeItem(K.playlist);
      } catch (e) {}
    }
  };

  // Auto-resume on page load if was playing
  var wasPlaying = localStorage.getItem(K.playing) === '1';
  var savedPlaylist = localStorage.getItem(K.playlist);
  var savedName = localStorage.getItem(K.name);
  var savedIndex = parseInt(localStorage.getItem(K.index), 10) || 0;
  var savedTime = parseInt(localStorage.getItem(K.time), 10) || 0;

  if (wasPlaying && savedPlaylist) {
    // Preconnect to YouTube hosts so DNS/TLS is already warm by the time
    // the iframe actually needs them — shaves ~100–200 ms off the first
    // playback request after a full page reload (most common on article
    // navigation, which can't use SPA-swap and so loses the prior iframe).
    ['https://www.youtube.com', 'https://www.google.com', 'https://i.ytimg.com', 'https://fonts.gstatic.com'].forEach(function (origin) {
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    loadYouTubeAPI();
    var resumeCheck = setInterval(function () {
      if (window.YT && window.YT.Player) {
        clearInterval(resumeCheck);
        ready = true;
        currentName = savedName || 'Playlist';
        createPlayerBar();
        bar.hidden = false;
        if (nameEl) nameEl.textContent = currentName;
        // Show the actual saved track name (if any) instead of a generic
        // "Resuming..." placeholder — avoids an extra title flicker.
        if (titleEl) titleEl.textContent = savedName || 'Resuming\u2026';
        // 'VIDEO:<id>' prefix marks a single-song playback; anything else
        // is a playlist id.
        if (savedPlaylist.indexOf('VIDEO:') === 0) {
          initPlayerForVideo(savedPlaylist.slice(6), null, savedTime);
        } else {
          initPlayer(savedPlaylist, null, savedIndex, savedTime);
        }
      }
    }, 100);
    setTimeout(function () { clearInterval(resumeCheck); }, 10000);
  }
})();
