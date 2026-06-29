// Feedback widget: thumbs up/down + optional comment, posted to feedback.php
// On localhost, logs to console instead of posting (PHP not available locally).

(function () {
    const widget      = document.getElementById('feedback-widget');
    const expand      = document.getElementById('feedback-expand');
    const thumbBtns   = document.querySelectorAll('.feedback-thumb-btn');
    const textarea    = document.getElementById('feedback-comment');
    const submitBtn   = document.getElementById('feedback-submit');
    const thanks      = document.getElementById('feedback-thanks');
    const reportLink  = document.getElementById('feedback-report-missing');
    const footerLink  = document.getElementById('openFeedbackFooter');

    let selectedRating = null;

    function resetWidget() {
        selectedRating = null;
        thumbBtns.forEach(b => b.classList.remove('active'));
        expand.classList.add('hidden');
        textarea.value = '';
        thanks.classList.add('hidden');
        reportLink.classList.add('hidden');
        submitBtn.classList.remove('hidden');
        textarea.classList.remove('hidden');
        widget.classList.remove('feedback-widget--highlight');
    }

    function selectRating(rating) {
        selectedRating = rating;
        thumbBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.rating === rating);
        });
        expand.classList.remove('hidden');
        reportLink.classList.toggle('hidden', rating !== 'down');
        textarea.focus();
    }

    function showThanks() {
        textarea.classList.add('hidden');
        submitBtn.classList.add('hidden');
        thanks.classList.remove('hidden');
        setTimeout(resetWidget, 3000);
    }

    function getContext() {
        const step = typeof currentStep !== 'undefined' ? currentStep : null;
        const ctx  = { step, shortlistCount: typeof clickedMetrics !== 'undefined' ? clickedMetrics.length : null };

        if (step === 'compare') {
            // Log which two groups are being compared and the current group-by dimension
            if (typeof compareState !== 'undefined') ctx.comparison = compareState;
            if (typeof compareSort  !== 'undefined') ctx.groupBy    = compareSort;
        } else {
            // Log only the filters that differ from the default ('all')
            const filters = {};
            if (typeof activeFilters !== 'undefined') {
                Object.entries(activeFilters).forEach(([key, val]) => {
                    if (val !== 'all') filters[key] = val;
                });
            }
            ctx.activeFilters = filters;
        }

        return ctx;
    }

    function submitFeedback() {
        if (!selectedRating) return;

        const payload = {
            rating:  selectedRating,
            comment: textarea.value.trim(),
            context: getContext(),
        };

        const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

        const telemetryPayload = {
            rating:         payload.rating,
            hasComment:     payload.comment.length > 0,
            step:           typeof currentStep !== 'undefined' ? currentStep : null,
            shortlistCount: typeof clickedMetrics !== 'undefined' ? clickedMetrics.length : null,
        };

        if (isLocal) {
            console.log('[feedback]', payload);
            logEvent(TELEMETRY.FEEDBACK_SUBMITTED, telemetryPayload);
            showThanks();
            return;
        }

        fetch('api/feedback.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        })
            .then(r => r.json())
            .then(data => {
                // Show thanks on success or rate limit — user already submitted before
                if (data.success || data.error === 'Too many requests') {
                    logEvent(TELEMETRY.FEEDBACK_SUBMITTED, telemetryPayload);
                    showThanks();
                }
            })
            .catch(() => {
                showThanks();
            });
    }

    thumbBtns.forEach(btn => {
        btn.addEventListener('click', () => selectRating(btn.dataset.rating));
    });

    submitBtn.addEventListener('click', submitFeedback);

    reportLink.addEventListener('click', function (e) {
        e.preventDefault();
        resetWidget();
        if (typeof window.openReportMetricOverlay === 'function') {
            window.openReportMetricOverlay('missing', null);
        }
    });

    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitFeedback();
    });

    if (footerLink) {
        footerLink.addEventListener('click', e => {
            e.preventDefault();
            expand.classList.remove('hidden');
            reportLink.classList.add('hidden');
            widget.classList.add('feedback-widget--highlight');
            textarea.focus();
        });
    }
}());
