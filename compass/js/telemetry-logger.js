// Telemetry: anonymized event logger.
// On localhost, logs to console instead of posting (PHP not available locally).

window.TELEMETRY = {
    PAGE_LOAD:                   'page_load',
    STEP_CHANGE:                 'step_change',
    FILTER_CHANGED:              'filter_changed',
    FILTERS_CLEARED:             'filters_cleared',
    KEYWORD_SEARCH:              'keyword_search',
    COLORBY_CHANGED:             'colorby_changed',
    METRIC_OPENED:               'metric_opened',
    METRIC_ADDED:                'metric_added',
    METRIC_REMOVED:              'metric_removed',
    METRIC_STATUS_CHANGED:       'metric_status_changed',
    SHORTLIST_CLEARED:           'shortlist_cleared',
    SHORTLIST_LINK_COPIED:       'shortlist_link_copied',
    WIZARD_STARTED:              'wizard_started',
    WIZARD_STEP:                 'wizard_step',
    WIZARD_SKIPPED:              'wizard_skipped',
    WIZARD_COMPLETED:            'wizard_completed',
    WIZARD_ABANDONED:            'wizard_abandoned',
    WIZARD_RESTARTED:            'wizard_restarted',
    PREDEFINED_COMPANY_LOADED:   'predefined_company_loaded',
    PREDEFINED_FRAMEWORK_LOADED: 'predefined_framework_loaded',
    IMPORT_JSON:                 'import_json',
    COMPARE_DIMENSION_CHANGED:   'compare_dimension_changed',
    COMPARE_PRESET_APPLIED:      'compare_preset_applied',
    COMPARE_SORTED:              'compare_sorted',
    COMPARISON_ADDED_TO_PDF:     'comparison_added_to_pdf',
    COMPARISON_REMOVED_FROM_PDF: 'comparison_removed_from_pdf',
    EXPORT_PDF:                  'export_pdf',
    EXPORT_JSON:                 'export_json',
    FEEDBACK_SUBMITTED:          'feedback_submitted',
    METRIC_REPORTED:             'metric_reported',
    SESSION_END:                 'session_end',
    SOURCE_LINK_CLICKED:         'source_link_clicked',
    OVERLAY_OPENED:              'overlay_opened',
};

// Note: the landing pages under /library/ log 'seo_page_view' and 'seo_cta_click'
// via js/seo-telemetry.js, which is standalone and does not load this file.
// All of these names must be present in api/telemetry.php's $ALLOWED_EVENTS.

(function () {
    function generateSessionId() {
        const arr = new Uint8Array(4);
        crypto.getRandomValues(arr);
        return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    // Detected once on page load — sent with every event so each log line is self-contained
    function detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Edg/'))    return 'Edge';
        if (ua.includes('OPR/'))    return 'Opera';
        if (ua.includes('Chrome/')) return 'Chrome';
        if (ua.includes('Firefox/')) return 'Firefox';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
        return 'Unknown';
    }

    function getReferrerDomain() {
        try { return document.referrer ? new URL(document.referrer).hostname : ''; }
        catch (_) { return ''; }
    }

    // A visitor arriving from a /library/ landing page carries that page's session
    // id in ?sid=, so the landing-page view and this visit read as one session.
    // The id is stripped from the URL immediately (below), before anything can
    // copy or share it — a shared link must not pull strangers into one session.
    function adoptSessionIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sid');
        if (!sid || !/^[a-f0-9]{8}$/.test(sid)) return null;
        params.delete('sid');
        const query = params.toString();
        history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
        return sid;
    }

    const SESSION_ID      = adoptSessionIdFromUrl() || generateSessionId();
    const BROWSER         = detectBrowser();
    const REFERRER_DOMAIN = getReferrerDomain();
    const IS_LOCAL        = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

    const STEP_ORDER = ['explore', 'compare', 'nextsteps'];

    // Session-shape bookkeeping, all reported by SESSION_END.
    const LOADED_AT   = Date.now();
    let eventCount    = 0;
    let maxStepIndex  = 0;
    let visibleSince  = document.visibilityState === 'visible' ? Date.now() : null;
    let activeMs      = 0;
    let endSeq        = 0;

    function buildBody(type, payload) {
        return JSON.stringify({
            event:           type,
            session_id:      SESSION_ID,
            browser:         BROWSER,
            referrer_domain: REFERRER_DOMAIN,
            payload:         payload || {},
        });
    }

    window.logEvent = function (type, payload) {
        eventCount++;
        // STEP_CHANGE carries the step being switched to, so the furthest step a
        // visitor reached can be tracked here rather than wired into titlebar.js.
        if (type === 'step_change' && payload && payload.to) {
            maxStepIndex = Math.max(maxStepIndex, STEP_ORDER.indexOf(payload.to));
        }
        if (IS_LOCAL) {
            console.log('[telemetry]', type, payload || {});
            return;
        }
        fetch('api/telemetry.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    buildBody(type, payload),
        }).catch(function () {});
    };

    // Same as logEvent, but survives the page going away. For events discovered
    // at hide time (a wizard left unfinished), where a plain fetch would be
    // cancelled before it left the browser.
    function sendWithBeacon(type, payload) {
        const body = buildBody(type, payload);
        if (navigator.sendBeacon) {
            navigator.sendBeacon('api/telemetry.php', new Blob([body], { type: 'application/json' }));
        } else {
            fetch('api/telemetry.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: body, keepalive: true,
            }).catch(function () {});
        }
    }

    window.logEventBeacon = function (type, payload) {
        eventCount++;
        if (IS_LOCAL) {
            console.log('[telemetry]', type, payload || {});
            return;
        }
        sendWithBeacon(type, payload);
    };

    // ─── Outbound clicks to the underlying sources ───────────────────────────
    // One delegated listener rather than per-link wiring, since the source lists
    // are re-rendered constantly. It picks up any link inside a container marked
    // with data-source-context (the metric detail popup in chart.js, the planned
    // cards in nextsteps.js).

    document.addEventListener('click', function (e) {
        const link = e.target.closest && e.target.closest('a[href]');
        if (!link) return;
        const holder = link.closest('[data-source-context]');
        if (!holder) return;
        window.logEvent(TELEMETRY.SOURCE_LINK_CLICKED, {
            metricId:   holder.dataset.metricId,
            sourceName: link.textContent.trim(),
            sourceType: holder.dataset.sourceType,
            context:    holder.dataset.sourceContext,
        });
    });

    // ─── Session end ─────────────────────────────────────────────────────────
    // There is no reliable "visitor is leaving" event: unload/beforeunload are
    // ignored on mobile and disable the bfcache, so the page becoming hidden is
    // the only dependable signal. That also fires on an ordinary tab switch,
    // so rather than guessing which hide is the last one, every hide is sent
    // with a rising `seq` and analysis keeps the highest seq per session.

    function sendSessionEnd() {
        if (visibleSince !== null) {
            activeMs += Date.now() - visibleSince;
            visibleSince = null;
        }
        endSeq++;
        const payload = {
            seq:            endSeq,
            totalMs:        Date.now() - LOADED_AT,
            activeMs:       activeMs,
            maxStep:        STEP_ORDER[maxStepIndex],
            // clickedMetrics is a top-level `let` in state.js, so it lives in the
            // shared script scope rather than on window — hence the typeof guard.
            shortlistCount: typeof clickedMetrics !== 'undefined' && Array.isArray(clickedMetrics) ? clickedMetrics.length : 0,
            eventCount:     eventCount,
        };

        if (IS_LOCAL) {
            console.log('[telemetry]', 'session_end', payload);
            return;
        }
        // A normal fetch is cancelled when the page goes away; sendBeacon is
        // handed to the browser and delivered afterwards. The Blob's type lets
        // PHP read the body from php://input unchanged.
        sendWithBeacon('session_end', payload);
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            // Reported before session_end so an unfinished wizard is attributed
            // to this visit rather than lost (fires at most once per session).
            if (typeof window.reportWizardAbandonIfUnfinished === 'function') {
                window.reportWizardAbandonIfUnfinished();
            }
            sendSessionEnd();
        } else if (visibleSince === null) {
            visibleSince = Date.now();
        }
    });

    // Safari does not always fire visibilitychange on navigation away.
    window.addEventListener('pagehide', function () {
        if (visibleSince !== null) sendSessionEnd();
    });
}());
