/*!
 * Folkets Meninger embed helper — auto-sizes poll iframes.
 * No dependencies. Load with `defer`/`async` after the iframe.
 *
 * The iframe posts `{ type: 'fm:resize', pollId, height }`. We match the
 * message to the iframe it came from and clamp the height to 150–1200 px.
 */
(function () {
  'use strict';

  var MIN_HEIGHT = 150;
  var MAX_HEIGHT = 1200;
  var FALLBACK_ORIGIN = 'https://www.folkets-meninger.no';

  function clamp(height) {
    var value = Math.round(height);
    if (!isFinite(value)) return MIN_HEIGHT;
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, value));
  }

  function originOf(iframe) {
    try {
      return new URL(iframe.src, window.location.href).origin;
    } catch (error) {
      return FALLBACK_ORIGIN;
    }
  }

  function findFrame(source) {
    var frames = document.querySelectorAll('iframe[data-fm-embed]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  function onMessage(event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'fm:resize' || typeof data.height !== 'number') return;

    var frame = findFrame(event.source);
    if (!frame) return;
    if (event.origin !== originOf(frame)) return;

    frame.style.height = clamp(data.height) + 'px';
  }

  if (window.addEventListener) {
    window.addEventListener('message', onMessage, false);
  }
})();
