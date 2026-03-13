/**
 * Session Guard – Joomla Session Expiry Warning Plugin
 *
 * @package     Custom.Plugin
 * @subpackage  System.Sessionguard
 * @copyright   Copyright (C) 2026. All rights reserved.
 * @license     GNU General Public License version 2 or later
 */

(function () {
    'use strict';

    /** Configuration injected by PHP: window.SessionGuard */
    const cfg = window.SessionGuard;

    if (!cfg) {
        return;
    }

    // ─── Storage / channel keys (namespaced by context to prevent cross-context leakage) ─
    const CONTEXT      = cfg.isAdmin ? 'admin' : 'site';
    const SK_EXPIRY    = 'sg_expiry_'    + CONTEXT;
    const SK_MSG       = 'sg_broadcast_' + CONTEXT;
    const CHANNEL_NAME = 'sessionguard_' + CONTEXT;

    // ─── State ────────────────────────────────────────────────────────────────
    let expiryTime      = cfg.expiryTime;   // Unix timestamp (seconds)
    let warningShown    = false;
    let renewalPending  = false;
    let tickInterval    = null;
    let uiRoot          = null;
    let countdownEl     = null;
    let broadcastChan   = null;

    // ─── Cross-tab: BroadcastChannel ─────────────────────────────────────────
    if (cfg.crossTab && typeof BroadcastChannel !== 'undefined') {
        broadcastChan = new BroadcastChannel(CHANNEL_NAME);
        broadcastChan.onmessage = function (e) {
            handleIncoming(e.data);
        };
    }

    // Cross-tab: localStorage fallback when BroadcastChannel is unavailable
    if (cfg.crossTab && !broadcastChan) {
        window.addEventListener('storage', function (e) {
            if (e.key === SK_MSG && e.newValue) {
                try { handleIncoming(JSON.parse(e.newValue)); } catch (_) {}
            }
        });
    }

    /**
     * Processes incoming cross-tab messages.
     *
     * @param {object} msg
     */
    function handleIncoming(msg) {
        switch (msg.type) {
            case 'renewed':
                // Session renewed or page reloaded in another tab — fully reset
                // this tab so the expired/warning UI is torn down completely and
                // the countdown restarts from the new expiry.
                setExpiry(msg.expiry);
                warningShown = false;
                destroyUI();                  // tear down mutated DOM entirely
                clearTick();                  // stop any stale interval
                tickInterval = setInterval(tick, 1000);  // restart fresh
                break;

            case 'warned':
                // Another tab already showed the warning; mark locally so we
                // do not show a second popup, but still run our own countdown.
                warningShown = true;
                break;

            case 'expired':
                clearTick();
                showExpired();
                break;
        }
    }

    /**
     * Broadcasts a message to all other tabs.
     *
     * @param {object} msg
     */
    function broadcast(msg) {
        if (broadcastChan) {
            broadcastChan.postMessage(msg);
            return;
        }
        if (cfg.crossTab) {
            try {
                localStorage.setItem(SK_MSG, JSON.stringify(Object.assign({}, msg, { ts: Date.now() })));
            } catch (_) {}
        }
    }

    // ─── Expiry helpers ───────────────────────────────────────────────────────

    function setExpiry(ts) {
        expiryTime = ts;
        if (cfg.crossTab) {
            try { localStorage.setItem(SK_EXPIRY, String(ts)); } catch (_) {}
        }
    }

    function getSyncedExpiry() {
        if (!cfg.crossTab) {
            return expiryTime;
        }
        try {
            const stored = parseInt(localStorage.getItem(SK_EXPIRY), 10);
            if (!isNaN(stored) && stored > expiryTime) {
                return stored;
            }
        } catch (_) {}
        return expiryTime;
    }

    // ─── UI builders ─────────────────────────────────────────────────────────

    /**
     * Safely escapes a string for insertion as DOM text (XSS-safe).
     *
     * @param {string} str
     * @returns {string}
     */
    function esc(str) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(str || ''));
        return d.innerHTML;
    }

    function buildModal() {
        const wrap = document.createElement('div');
        wrap.id        = 'sg-overlay';
        wrap.className = 'sg-overlay';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'sg-dialog-title');
        wrap.innerHTML = `
<div class="sg-modal">
  <div class="sg-modal-header">
    <svg class="sg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/>
    </svg>
    <h2 class="sg-dialog-title" id="sg-dialog-title">${esc(cfg.messages.title)}</h2>
  </div>
  <div class="sg-modal-body">
    <p class="sg-warning-text">${esc(cfg.messages.warning)}</p>
    <div class="sg-countdown-wrap">
      <span class="sg-countdown-label">${esc(cfg.messages.countdown)}</span>
      <span class="sg-countdown" id="sg-countdown" aria-live="polite" aria-atomic="true">--:--</span>
    </div>
  </div>
  <div class="sg-modal-footer">
    <button class="sg-btn sg-btn-primary" id="sg-extend-btn">${esc(cfg.messages.extendBtn)}</button>
    <button class="sg-btn sg-btn-secondary" id="sg-dismiss-btn">${esc(cfg.messages.dismissBtn)}</button>
  </div>
</div>`;
        return wrap;
    }

    function buildToast() {
        const wrap = document.createElement('div');
        wrap.id        = 'sg-toast';
        wrap.className = 'sg-toast';
        wrap.setAttribute('role', 'alert');
        wrap.setAttribute('aria-live', 'assertive');
        wrap.innerHTML = `
<div class="sg-toast-inner">
  <svg class="sg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/>
  </svg>
  <div class="sg-toast-body">
    <strong class="sg-toast-title">${esc(cfg.messages.title)}</strong>
    <p class="sg-toast-msg">${esc(cfg.messages.warning)}</p>
    <span class="sg-countdown-label">${esc(cfg.messages.countdown)} <span class="sg-countdown" id="sg-countdown" aria-live="polite">--:--</span></span>
  </div>
  <div class="sg-toast-actions">
    <button class="sg-btn sg-btn-primary sg-btn-sm" id="sg-extend-btn">${esc(cfg.messages.extendBtn)}</button>
    <button class="sg-btn-icon" id="sg-dismiss-btn" aria-label="${esc(cfg.messages.dismissBtn)}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/>
      </svg>
    </button>
  </div>
</div>`;
        return wrap;
    }

    function buildBanner() {
        const wrap = document.createElement('div');
        wrap.id        = 'sg-banner';
        wrap.className = 'sg-banner';
        wrap.setAttribute('role', 'alert');
        wrap.setAttribute('aria-live', 'assertive');
        wrap.innerHTML = `
<div class="sg-banner-inner">
  <svg class="sg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/>
  </svg>
  <span class="sg-banner-text">
    <strong>${esc(cfg.messages.title)}:</strong> ${esc(cfg.messages.warning)}
    &nbsp;${esc(cfg.messages.countdown)} <span class="sg-countdown" id="sg-countdown" aria-live="polite">--:--</span>
  </span>
  <div class="sg-banner-actions">
    <button class="sg-btn sg-btn-primary sg-btn-sm" id="sg-extend-btn">${esc(cfg.messages.extendBtn)}</button>
    <button class="sg-btn sg-btn-secondary sg-btn-sm" id="sg-dismiss-btn">${esc(cfg.messages.dismissBtn)}</button>
  </div>
</div>`;
        return wrap;
    }

    function buildUI() {
        if (uiRoot) {
            return;
        }

        switch (cfg.uiType) {
            case 'toast':  uiRoot = buildToast();  break;
            case 'banner': uiRoot = buildBanner(); break;
            default:       uiRoot = buildModal();  break;
        }

        document.body.appendChild(uiRoot);
    }

    function bindButtons() {
        const extBtn  = document.getElementById('sg-extend-btn');
        const dismBtn = document.getElementById('sg-dismiss-btn');

        if (extBtn)  { extBtn.addEventListener('click', onExtendClick); }
        if (dismBtn) { dismBtn.addEventListener('click', hideUI); }
    }

    // ─── UI state transitions ─────────────────────────────────────────────────

    function showWarning() {
        if (warningShown) {
            return;
        }
        warningShown = true;

        buildUI();
        bindButtons();

        countdownEl = document.getElementById('sg-countdown');
        uiRoot.classList.add('sg-visible');

        if (cfg.isAdmin) {
            uiRoot.classList.add('sg-admin');
        }

        // Focus trap: move focus to extend button for accessibility
        const extBtn = document.getElementById('sg-extend-btn');
        if (extBtn) {
            extBtn.focus();
        }

        broadcast({ type: 'warned' });
    }

    function hideUI() {
        if (uiRoot) {
            uiRoot.classList.remove('sg-visible');
        }
    }

    /**
     * Completely removes the UI element from the DOM and resets all state.
     * Needed after the session is renewed while the UI was in an expired state,
     * so the next warning cycle gets a clean, unmodified DOM node.
     */
    function destroyUI() {
        if (uiRoot) {
            uiRoot.remove();
            uiRoot       = null;
            countdownEl  = null;
        }
    }

    function showExpired() {
        buildUI();

        // ── Update title ──────────────────────────────────────────────────────
        const titleEl = uiRoot.querySelector('.sg-dialog-title, .sg-toast-title');
        if (titleEl) {
            titleEl.textContent = cfg.messages.expiredTitle;
        }

        // ── Update warning text ───────────────────────────────────────────────
        const msgEl = uiRoot.querySelector('.sg-warning-text, .sg-toast-msg');
        if (msgEl) {
            msgEl.textContent = cfg.messages.expired;
        }

        // ── Hide every countdown element (modal / toast) ──────────────────────
        uiRoot.querySelectorAll(
            '.sg-countdown-wrap, .sg-countdown-label, #sg-countdown'
        ).forEach(function (el) {
            el.style.display = 'none';
        });

        // ── Banner: countdown is inline text — replace the entire text block ──
        const bannerText = uiRoot.querySelector('.sg-banner-text');
        if (bannerText) {
            bannerText.innerHTML =
                '<strong>' + esc(cfg.messages.expiredTitle) + ':</strong> ' +
                esc(cfg.messages.expired);
        }

        // ── Replace all action buttons with a single Reload button ────────────
        const footerEl = uiRoot.querySelector(
            '.sg-modal-footer, .sg-toast-actions, .sg-banner-actions'
        );
        if (footerEl) {
            footerEl.innerHTML =
                '<button class="sg-btn sg-btn-warning" id="sg-reload-btn">' +
                esc(cfg.messages.reloadBtn) + '</button>';
            document.getElementById('sg-reload-btn')
                .addEventListener('click', function () { window.location.reload(); });
        }

        // ── Nullify countdown reference so tick() stops updating it ──────────
        countdownEl = null;

        // ── Mark UI as expired and ensure it is visible ───────────────────────
        uiRoot.classList.add('sg-visible', 'sg-expired');

        const modal = uiRoot.querySelector('.sg-modal');
        if (modal) {
            modal.classList.add('sg-expired');
        }
    }

    // ─── Session renewal ──────────────────────────────────────────────────────

    function onExtendClick() {
        if (renewalPending) {
            return;
        }
        renewSession(false);
    }

    /**
     * Sends an AJAX request to the PHP handler to renew the session.
     *
     * @param {boolean} silent  When true the UI is not shown/hidden (auto-renew).
     */
    function renewSession(silent) {
        if (renewalPending) {
            return;
        }
        renewalPending = true;

        const extBtn = document.getElementById('sg-extend-btn');
        if (extBtn && !silent) {
            extBtn.disabled    = true;
            extBtn.textContent = cfg.messages.extending;
        }

        fetch(cfg.ajaxUrl, {
            method:  'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        })
        .then(function (res) {
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            return res.json();
        })
        .then(function (data) {
            renewalPending = false;

            if (data.status === 'renewed') {
                setExpiry(data.expiry);
                warningShown = false;

                broadcast({ type: 'renewed', expiry: data.expiry });

                if (!silent) {
                    // Manual extend: show brief \"Extended!\" feedback, then reset UI
                    if (extBtn) {
                        extBtn.textContent = cfg.messages.extended;
                        extBtn.disabled    = false;
                        setTimeout(function () {
                            destroyUI();
                        }, 1500);
                    } else {
                        destroyUI();
                    }
                } else {
                    // Auto-renew: silently remove any visible warning/expired UI
                    destroyUI();
                }
            } else {
                // Session already expired on server
                clearTick();
                broadcast({ type: 'expired' });
                showExpired();
            }
        })
        .catch(function () {
            renewalPending = false;
            if (extBtn && !silent) {
                extBtn.textContent = cfg.messages.extendBtn;
                extBtn.disabled    = false;
            }
        });
    }

    // ─── Countdown tick ───────────────────────────────────────────────────────

    function formatTime(totalSeconds) {
        if (totalSeconds <= 0) { return '0:00'; }
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return m + ':' + String(s).padStart(2, '0');
    }

    function tick() {
        const now       = Math.floor(Date.now() / 1000);
        const expiry    = getSyncedExpiry();
        const remaining = expiry - now;

        if (remaining <= 0) {
            clearTick();
            broadcast({ type: 'expired' });
            showExpired();
            return;
        }

        // Auto-renew: trigger silently before expiry
        if (cfg.autoRenew && remaining <= cfg.autoRenewBefore && !renewalPending) {
            renewSession(true);
            return;
        }

        // Show warning UI when within warning threshold
        if (remaining <= cfg.warningTime && !warningShown) {
            showWarning();
        }

        // Update countdown display if visible
        if (countdownEl) {
            countdownEl.textContent = formatTime(remaining);
        }
    }

    function clearTick() {
        if (tickInterval !== null) {
            clearInterval(tickInterval);
            tickInterval = null;
        }
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    function init() {
        const now    = Math.floor(Date.now() / 1000);
        const synced = getSyncedExpiry();

        // Always write the freshest expiry we know about
        if (cfg.crossTab) {
            try {
                const stored = parseInt(localStorage.getItem(SK_EXPIRY), 10);
                if (isNaN(stored) || expiryTime > stored) {
                    localStorage.setItem(SK_EXPIRY, String(expiryTime));
                }
            } catch (_) {}
        }

        // If already expired on load, go straight to expired state
        if (expiryTime <= now) {
            showExpired();
            return;
        }

        // This tab has a valid session (page load, reload, or re-login).
        // Broadcast to any other open tabs that may be stuck on an expired or
        // warning UI — they will tear down their UI and restart their countdown.
        broadcast({ type: 'renewed', expiry: expiryTime });

        tickInterval = setInterval(tick, 1000);
    }

    // Boot after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
