(() => {
  const CYRILLIC_RE = /[\u0401\u0451\u0410-\u044F]/;
  const RENDERER_CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer"
  ].join(", ");
  const LOCKUP_CARD_SELECTOR = "yt-lockup-view-model";
  const CARD_SELECTOR = `${RENDERER_CARD_SELECTOR}, ${LOCKUP_CARD_SELECTOR}`;
  const LOADING_CLASS = "yt-cyrillic-filter-loading";
  const MASKED_CLASS = "yt-cyrillic-filter-masked";
  const PLACEHOLDER_CLASS = "yt-cyrillic-filter-placeholder";
  const OVERLAY_ID = "yt-cyrillic-filter-overlay";
  const STYLE_ID = "yt-cyrillic-filter-style";
  const SETTLE_DELAY_MS = 300;
  const PLACEHOLDER_TEXT = "∅";

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

      .${MASKED_CLASS} {
        position: relative !important;
      }

      .${MASKED_CLASS} > :not(.${PLACEHOLDER_CLASS}) {
        pointer-events: none !important;
        visibility: hidden !important;
      }

      .${PLACEHOLDER_CLASS} {
        position: absolute;
        inset: 0;
        z-index: 10;
        box-sizing: border-box;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 12px;
        min-height: 100%;
        pointer-events: none;
        user-select: none;
      }

      .${PLACEHOLDER_CLASS} * {
        box-sizing: border-box;
      }

      .${PLACEHOLDER_CLASS}__thumbnail {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 12px;
        background: #808080;
      }

      .${PLACEHOLDER_CLASS}__body {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) 40px;
        gap: 12px;
        min-width: 0;
      }

      .${PLACEHOLDER_CLASS}__avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #808080;
      }

      .${PLACEHOLDER_CLASS}__meta {
        display: grid;
        align-content: start;
        gap: 2px;
        min-width: 0;
      }

      .${PLACEHOLDER_CLASS}__title,
      .${PLACEHOLDER_CLASS}__channel,
      .${PLACEHOLDER_CLASS}__stats {
        overflow: hidden;
        max-width: 100%;
        color: #fff;
        font-family: Roboto, Arial, sans-serif;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .${PLACEHOLDER_CLASS}__title {
        font-size: 1.6rem;
        font-weight: 500;
        line-height: 2.2rem;
      }

      .${PLACEHOLDER_CLASS}__channel,
      .${PLACEHOLDER_CLASS}__stats {
        color: var(--yt-spec-text-secondary, #aaa);
        font-size: 1.4rem;
        line-height: 1.8rem;
      }

      .${PLACEHOLDER_CLASS}__menu {
        align-self: start;
        justify-self: end;
        width: 40px;
        height: 40px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--yt-spec-text-primary, #fff);
        cursor: pointer;
        font-family: Roboto, Arial, sans-serif;
        font-size: 2.4rem;
        line-height: 1;
        pointer-events: auto;
      }

      .${PLACEHOLDER_CLASS}__menu:hover {
        background: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1));
      }

      .${PLACEHOLDER_CLASS}__actions {
        position: absolute;
        right: 0;
        top: calc(100% - 96px);
        z-index: 11;
        display: grid;
        min-width: 220px;
        padding: 8px 0;
        border-radius: 12px;
        background: var(--yt-spec-menu-background, #282828);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        pointer-events: auto;
      }

      .${PLACEHOLDER_CLASS}__actions[hidden] {
        display: none !important;
      }

      .${PLACEHOLDER_CLASS}__action {
        width: 100%;
        min-height: 40px;
        border: 0;
        background: transparent;
        color: var(--yt-spec-text-primary, #fff);
        cursor: pointer;
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 16px;
        align-items: center;
        font-family: Roboto, Arial, sans-serif;
        font-size: 1.4rem;
        line-height: 2rem;
        padding: 0 16px;
        text-align: left;
      }

      .${PLACEHOLDER_CLASS}__action:hover {
        background: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1));
      }

      .${PLACEHOLDER_CLASS}__action-icon {
        font-size: 2rem;
        line-height: 1;
        text-align: center;
      }

      ytd-video-renderer > .${PLACEHOLDER_CLASS},
      ytd-compact-video-renderer > .${PLACEHOLDER_CLASS},
      ytd-playlist-video-renderer > .${PLACEHOLDER_CLASS} {
        grid-template-columns: minmax(120px, 38%) minmax(0, 1fr);
        grid-template-rows: auto;
      }

      yt-lockup-view-model.${MASKED_CLASS}:has(.ytLockupViewModelHorizontal) > .${PLACEHOLDER_CLASS} {
        grid-template-columns: 176px minmax(0, 1fr);
        grid-template-rows: 1fr;
        gap: 0;
      }

      yt-lockup-view-model.${MASKED_CLASS}:has(.ytLockupViewModelHorizontal) > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__thumbnail {
        height: 100%;
        aspect-ratio: auto;
        border-radius: 8px;
      }

      yt-lockup-view-model.${MASKED_CLASS}:has(.ytLockupViewModelHorizontal) > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__body {
        grid-template-columns: minmax(0, 1fr) 40px;
        gap: 8px;
        padding-left: 8px;
      }

      yt-lockup-view-model.${MASKED_CLASS}:has(.ytLockupViewModelHorizontal) > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__avatar {
        display: none;
      }

      ytd-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__body,
      ytd-compact-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__body,
      ytd-playlist-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__body {
        grid-template-columns: minmax(0, 1fr) 40px;
      }

      ytd-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__avatar,
      ytd-compact-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__avatar,
      ytd-playlist-video-renderer > .${PLACEHOLDER_CLASS} .${PLACEHOLDER_CLASS}__avatar {
        display: none;
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

  const getOriginalText = (card) => {
    return Array.from(card.childNodes)
      .filter((node) => {
        return !(node instanceof Element && node.classList.contains(PLACEHOLDER_CLASS));
      })
      .map((node) => node.textContent || "")
      .join(" ")
      .trim();
  };

  const createText = (className, text = PLACEHOLDER_TEXT) => {
    const element = document.createElement("div");
    element.className = className;
    element.textContent = text;

    return element;
  };

  const closePlaceholderMenus = (except = null) => {
    document.querySelectorAll(`.${PLACEHOLDER_CLASS}__actions`).forEach((menu) => {
      if (menu !== except) {
        menu.hidden = true;
      }
    });
  };

  const findOriginalMenuButton = (card) => {
    if (!card) {
      return null;
    }

    const selectors = [
      'button[aria-label*="More actions"]',
      'button[title*="More actions"]',
      'yt-icon-button[aria-label*="More actions"] button',
      'ytd-menu-renderer button',
      '#menu button',
      '#button button'
    ];

    for (const selector of selectors) {
      const button = card.querySelector(selector);

      if (button && !button.closest(`.${PLACEHOLDER_CLASS}`)) {
        return button;
      }
    }

    return null;
  };

  const getNativeMenuItems = () => {
    return Array.from(
      document.querySelectorAll('ytd-popup-container [role="menu"] [role="menuitem"]')
    );
  };

  const findNativeMenuItem = (label) => {
    return getNativeMenuItems().find((item) => {
      const text = (item.innerText || item.textContent || "").replace(/\s+/g, " ").trim();

      return text === label;
    });
  };

  const clickNativeMenuItem = (label) => {
    const item = findNativeMenuItem(label);

    if (!item) {
      return false;
    }

    item.click();
    return true;
  };

  const createActionButton = (label, icon, placeholder) => {
    const button = document.createElement("button");
    const iconElement = document.createElement("span");
    const labelElement = document.createElement("span");

    button.className = `${PLACEHOLDER_CLASS}__action`;
    button.type = "button";
    iconElement.className = `${PLACEHOLDER_CLASS}__action-icon`;
    iconElement.textContent = icon;
    iconElement.setAttribute("aria-hidden", "true");
    labelElement.textContent = label;
    button.append(iconElement, labelElement);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePlaceholderMenus();
      runOriginalMenuAction(placeholder.parentElement, label);
    });

    return button;
  };

  const handleDocumentClick = (event) => {
    const target = event.target;

    if (target instanceof Element && target.closest(`.${PLACEHOLDER_CLASS}`)) {
      return;
    }

    closePlaceholderMenus();
  };

  const runOriginalMenuAction = (card, label) => {
    const button = findOriginalMenuButton(card);

    if (!button) {
      return;
    }

    button.click();
    if (clickNativeMenuItem(label)) {
      return;
    }

    const nativeMenuObserver = new MutationObserver(() => {
      if (clickNativeMenuItem(label)) {
        nativeMenuObserver.disconnect();
      }
    });

    nativeMenuObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  const createPlaceholder = () => {
    const placeholder = document.createElement("div");
    const thumbnail = document.createElement("div");
    const body = document.createElement("div");
    const avatar = document.createElement("div");
    const meta = document.createElement("div");
    const menu = document.createElement("button");
    const actions = document.createElement("div");

    placeholder.className = PLACEHOLDER_CLASS;
    placeholder.setAttribute("aria-label", PLACEHOLDER_TEXT);
    thumbnail.className = `${PLACEHOLDER_CLASS}__thumbnail`;
    thumbnail.setAttribute("aria-hidden", "true");
    body.className = `${PLACEHOLDER_CLASS}__body`;
    avatar.className = `${PLACEHOLDER_CLASS}__avatar`;
    avatar.setAttribute("aria-hidden", "true");
    meta.className = `${PLACEHOLDER_CLASS}__meta`;
    menu.className = `${PLACEHOLDER_CLASS}__menu`;
    menu.type = "button";
    menu.textContent = "⋮";
    menu.setAttribute("aria-label", "More actions");
    actions.className = `${PLACEHOLDER_CLASS}__actions`;
    actions.hidden = true;

    meta.append(
      createText(`${PLACEHOLDER_CLASS}__title`),
      createText(`${PLACEHOLDER_CLASS}__channel`),
      createText(`${PLACEHOLDER_CLASS}__stats`, `${PLACEHOLDER_TEXT} views • ${PLACEHOLDER_TEXT} ago`)
    );
    menu.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const shouldOpen = actions.hidden;

      closePlaceholderMenus(actions);
      actions.hidden = !shouldOpen;
    });
    actions.append(
      createActionButton("Not interested", "⊘", placeholder),
      createActionButton("Don't recommend channel", "⊖", placeholder)
    );
    body.append(avatar, meta, menu);
    placeholder.append(thumbnail, body, actions);

    return placeholder;
  };

  const unmask = (card) => {
    card.classList.remove(MASKED_CLASS);
    card.querySelector(`:scope > .${PLACEHOLDER_CLASS}`)?.remove();
  };

  const updateMask = (card) => {
    const hasCyrillic = CYRILLIC_RE.test(getOriginalText(card));

    if (!hasCyrillic) {
      if (card.classList.contains(MASKED_CLASS)) {
        unmask(card);
      }

      return;
    }

    if (!card.classList.contains(MASKED_CLASS)) {
      card.classList.add(MASKED_CLASS);
      card.append(createPlaceholder());
    }
  };

  const getCards = () => {
    const rendererCards = Array.from(document.querySelectorAll(RENDERER_CARD_SELECTOR));
    const lockupCards = Array.from(document.querySelectorAll(LOCKUP_CARD_SELECTOR)).filter((card) => {
      const host = card.querySelector(".ytLockupViewModelHost");

      return (
        host &&
        host.classList.contains("ytLockupViewModelCompact") &&
        host.classList.contains("ytLockupViewModelHorizontal") &&
        !card.parentElement?.closest(RENDERER_CARD_SELECTOR)
      );
    });

    return [...rendererCards, ...lockupCards].filter((card) => {
      return !card.parentElement?.closest(RENDERER_CARD_SELECTOR);
    });
  };

  const scan = () => {
    getCards().forEach(updateMask);
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
    document.addEventListener("click", handleDocumentClick, true);
  };

  injectStyle();
  showLoading();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
