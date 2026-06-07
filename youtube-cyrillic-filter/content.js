(() => {
  const CYRILLIC_RE = /[\u0401\u0451\u0410-\u044F]/;
  const CARD_SELECTOR = [
    "yt-lockup-view-model",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer"
  ].join(", ");
  const LOADING_CLASS = "yt-cyrillic-filter-loading";
  const OVERLAY_ID = "yt-cyrillic-filter-overlay";
  const STYLE_ID = "yt-cyrillic-filter-style";
  const SETTLE_DELAY_MS = 300;

  let scanQueued = false;
  let settleTimer = 0;

  const injectStyle = () => {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${LOADING_CLASS},
      html.${LOADING_CLASS} body {
        background: #000 !important;
      }

      html.${LOADING_CLASS} body > :not(#${OVERLAY_ID}) {
        visibility: hidden !important;
      }

      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        color: #fff;
        font-size: min(52vw, 52vh);
        line-height: 1;
        pointer-events: none;
        user-select: none;
      }

      #${OVERLAY_ID}[hidden] {
        display: none !important;
      }
    `;

    document.documentElement.append(style);
  };

  const ensureOverlay = () => {
    if (!document.body) {
      return null;
    }

    let overlay = document.getElementById(OVERLAY_ID);

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.textContent = "🦅";
      document.body.append(overlay);
    }

    return overlay;
  };

  const showLoading = () => {
    document.documentElement.classList.add(LOADING_CLASS);
    ensureOverlay()?.removeAttribute("hidden");
  };

  const hideLoading = () => {
    document.documentElement.classList.remove(LOADING_CLASS);
    ensureOverlay()?.setAttribute("hidden", "");
  };

  const removeIfCyrillic = (card) => {
    const text = (card.innerText || card.textContent || "").trim();

    if (CYRILLIC_RE.test(text)) {
      card.remove();
    }
  };

  const scan = () => {
    document.querySelectorAll(CARD_SELECTOR).forEach(removeIfCyrillic);
  };

  const finishWhenSettled = () => {
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      scan();
      hideLoading();
    }, SETTLE_DELAY_MS);
  };

  const queueScan = () => {
    showLoading();

    if (scanQueued) {
      finishWhenSettled();
      return;
    }

    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
      finishWhenSettled();
    });
  };

  const hasCards = (node) => {
    if (!(node instanceof Element)) {
      return false;
    }

    return node.matches(CARD_SELECTOR) || Boolean(node.querySelector(CARD_SELECTOR));
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (hasCards(node)) {
          queueScan();
          return;
        }
      }
    }
  });

  const start = () => {
    injectStyle();
    showLoading();
    queueScan();
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    document.addEventListener("yt-navigate-start", showLoading);
    document.addEventListener("yt-navigate-finish", queueScan);
  };

  injectStyle();
  showLoading();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
