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
};

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

    const SESSION_ID      = generateSessionId();
    const BROWSER         = detectBrowser();
    const REFERRER_DOMAIN = getReferrerDomain();
    const IS_LOCAL        = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

    window.logEvent = function (type, payload) {
        if (IS_LOCAL) {
            console.log('[telemetry]', type, payload || {});
            return;
        }
        fetch('api/telemetry.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ event: type, session_id: SESSION_ID, browser: BROWSER, referrer_domain: REFERRER_DOMAIN, payload: payload || {} }),
        }).catch(function () {});
    };
}());
