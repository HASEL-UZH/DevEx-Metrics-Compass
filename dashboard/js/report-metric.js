// Report overlay: four modes — 'wrong_metric' (issue with an existing metric, from the
// metric popup) and three "missing" modes ('missing_metric', 'missing_research',
// 'missing_company') that share one form with a subject picker to switch between them.
// POSTs to report-metric.php. On localhost, logs to console instead of posting.

(function () {
    const overlay     = document.getElementById('reportMetricOverlay');
    const titleEl     = document.getElementById('reportMetricOverlayTitle');
    const introEl     = document.getElementById('reportMetricIntro');
    const closeBtn    = document.getElementById('closeReportMetricOverlayBtn');
    const subjectRow  = document.getElementById('reportMetricSubjectRow');
    const subjectPicker = document.getElementById('reportMetricSubjectPicker');
    const nameLabel   = document.getElementById('reportMetricNameLabel');
    const nameInput   = document.getElementById('reportMetricName');
    const sourceRow   = document.getElementById('reportMetricSourceRow');
    const sourceLabel = document.querySelector('label[for="reportMetricSource"]');
    const sourceInput = document.getElementById('reportMetricSource');
    const descLabel   = document.getElementById('reportMetricDescLabel');
    const descInput   = document.getElementById('reportMetricDesc');
    const emailInput  = document.getElementById('reportMetricEmail');
    const submitBtn   = document.getElementById('reportMetricSubmitBtn');
    const anotherBtn  = document.getElementById('reportMetricSaveAnotherBtn');
    const thanksEl    = document.getElementById('reportMetricThanks');
    const errorEl     = document.getElementById('reportMetricError');
    const footerLink  = document.getElementById('openReportMissingMetricBtn');

    const allFields   = [nameInput, sourceInput, descInput, emailInput];

    // Per-mode copy & behaviour. showPicker/showSource drive which rows are visible;
    // sourceRequired/descRequired drive validation.
    const MODE_CONFIG = {
        wrong_metric: {
            title: 'Report an issue with this metric',
            intro: 'Let us know what seems incorrect. We\'ll review it and correct it if needed.',
            nameLabel: 'Metric name',
            namePlaceholder: 'Name of the metric',
            descLabel: 'What is wrong?',
            descPlaceholder: 'Describe the issue',
            showPicker: false, showSource: false, nameReadonly: true,
            sourceRequired: false, descRequired: true, allowAnother: false,
        },
        missing_metric: {
            title: 'Report something missing',
            intro: 'Is a metric, company, publication or framework missing? Share it with a reference so we can verify and add it. Thank you!',
            nameLabel: 'Metric name',
            namePlaceholder: 'Name of the metric',
            sourceLabel: 'Reference to details on metric',
            sourcePlaceholder: 'Publication, company blog/report, or other source',
            descLabel: 'Metric definition',
            descPlaceholder: 'How is this metric defined? What does it measure?',
            showPicker: true, showSource: true, nameReadonly: false,
            sourceRequired: true, descRequired: false, allowAnother: true,
        },
        missing_research: {
            title: 'Report something missing',
            intro: 'Is a metric, company, publication or framework missing? Share it with a reference so we can verify and add it. Thank you!',
            nameLabel: 'Publication / framework name',
            namePlaceholder: 'Name of the publication or framework',
            sourceLabel: 'Reference to the publication or framework',
            sourcePlaceholder: 'Link to the paper, framework documentation, or other source',
            descLabel: 'What does it cover?',
            descPlaceholder: 'Which metrics or dimensions does it define? (optional)',
            showPicker: true, showSource: true, nameReadonly: false,
            sourceRequired: true, descRequired: false, allowAnother: true,
        },
        missing_company: {
            title: 'Report something missing',
            intro: 'Is a metric, company, publication or framework missing? Share it with a reference so we can verify and add it. Thank you!',
            nameLabel: 'Company name',
            namePlaceholder: 'Name of the company',
            sourceLabel: 'Public reference to their DevEx metrics',
            sourcePlaceholder: 'Engineering blog, conference talk, case study, or report',
            descLabel: 'What do they measure?',
            descPlaceholder: 'Which metrics do they report or implement? (optional)',
            showPicker: true, showSource: true, nameReadonly: false,
            sourceRequired: true, descRequired: false, allowAnother: true,
        },
    };

    let currentMode = 'missing_metric';

    // Apply a mode's copy/visibility without clearing the fields the user already typed —
    // so switching subject in the picker keeps their input.
    function applyMode(mode) {
        const cfg = MODE_CONFIG[mode] || MODE_CONFIG.missing_metric;
        currentMode = MODE_CONFIG[mode] ? mode : 'missing_metric';

        titleEl.textContent = cfg.title;
        introEl.textContent = cfg.intro;

        nameLabel.textContent = cfg.nameLabel;
        nameInput.placeholder = cfg.namePlaceholder;
        nameInput.readOnly = !!cfg.nameReadonly;
        nameInput.classList.toggle('report-metric-input--readonly', !!cfg.nameReadonly);

        descLabel.textContent = cfg.descLabel;
        descInput.placeholder = cfg.descPlaceholder;

        subjectRow.classList.toggle('hidden', !cfg.showPicker);
        sourceRow.classList.toggle('hidden', !cfg.showSource);
        if (cfg.showSource) {
            if (sourceLabel) sourceLabel.textContent = cfg.sourceLabel;
            sourceInput.placeholder = cfg.sourcePlaceholder;
        }
        anotherBtn.classList.toggle('hidden', !cfg.allowAnother);

        // Reflect the active subject button
        subjectPicker.querySelectorAll('.report-metric-subject-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.reportMode === currentMode);
        });
    }

    function openOverlay(mode, metricData) {
        resetForm();
        applyMode(MODE_CONFIG[mode] ? mode : 'missing_metric');

        if (currentMode === 'wrong_metric') {
            nameInput.value = metricData && metricData.name ? metricData.name : '';
        }

        overlay.style.display = 'flex';
        nameInput.focus();
    }

    function closeOverlay() {
        overlay.style.display = 'none';
        resetForm();
    }

    function resetForm() {
        allFields.forEach(el => {
            el.value = '';
            el.disabled = false;
            el.classList.remove('report-metric-input--invalid');
        });
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
        thanksEl.classList.add('hidden');
        submitBtn.classList.remove('hidden');
        submitBtn.disabled = false;
        anotherBtn.disabled = false;
    }

    function disableAllFields() {
        allFields.forEach(el => { el.disabled = true; });
        submitBtn.disabled = true;
        anotherBtn.disabled = true;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidUrl(url) {
        let parsed;
        try { parsed = new URL(url); } catch {
            try { parsed = new URL('https://' + url); } catch { return false; }
        }
        return parsed.hostname.includes('.');
    }

    function validate() {
        const cfg = MODE_CONFIG[currentMode];
        let valid = true;
        let errorMsg = 'Please fill in all required fields.';

        const required = [nameInput, emailInput];
        if (cfg.sourceRequired) required.push(sourceInput);
        if (cfg.descRequired)   required.push(descInput);

        required.forEach(el => {
            if (!el.value.trim()) {
                el.classList.add('report-metric-input--invalid');
                valid = false;
            } else {
                el.classList.remove('report-metric-input--invalid');
            }
        });

        if (cfg.showSource) {
            const url = sourceInput.value.trim();
            if (url && !isValidUrl(url)) {
                sourceInput.classList.add('report-metric-input--invalid');
                valid = false;
                errorMsg = 'Please enter a valid URL for the reference (e.g. https://…).';
            }
        }

        const email = emailInput.value.trim();
        if (email && !isValidEmail(email)) {
            emailInput.classList.add('report-metric-input--invalid');
            valid = false;
            errorMsg = 'Please enter a valid email address.';
        }

        if (!valid) {
            errorEl.textContent = errorMsg;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
        return valid;
    }

    function submitReport(andAnother) {
        if (!validate()) return;

        const payload = {
            mode:        currentMode,
            metricName:  nameInput.value.trim(),
            source:      sourceInput.value.trim(),
            description: descInput.value.trim(),
            email:       emailInput.value.trim(),
            timestamp:   new Date().toISOString(),
        };

        const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
        if (isLocal) {
            console.log('[report-metric]', payload);
            logEvent(TELEMETRY.METRIC_REPORTED, { mode: currentMode, metricName: payload.metricName, andAnother: !!andAnother });
            showThanks(andAnother);
            return;
        }

        submitBtn.disabled = true;
        anotherBtn.disabled = true;

        fetch('api/report-metric.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        })
            .then(r => {
                const status = r.status;
                return r.json().then(data => ({ status, data }));
            })
            .then(({ status, data }) => {
                if (data.success) {
                    logEvent(TELEMETRY.METRIC_REPORTED, { mode: currentMode, metricName: payload.metricName, andAnother: !!andAnother });
                    showThanks(andAnother);
                } else {
                    errorEl.textContent = status === 429
                        ? 'Too many submissions — please try again in an hour.'
                        : 'Submission failed. Please try again.';
                    errorEl.classList.remove('hidden');
                    submitBtn.disabled = false;
                    anotherBtn.disabled = false;
                }
            })
            .catch(() => {
                showThanks(andAnother);
            });
    }

    function showThanks(andAnother) {
        if (andAnother) {
            const mode = currentMode;
            thanksEl.classList.remove('hidden');
            setTimeout(() => openOverlay(mode, null), 1200);
        } else {
            disableAllFields();
            submitBtn.classList.add('hidden');
            anotherBtn.classList.add('hidden');
            thanksEl.classList.remove('hidden');
            setTimeout(closeOverlay, 2200);
        }
    }

    closeBtn.addEventListener('click', closeOverlay);

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeOverlay();
    });

    submitBtn.addEventListener('click', function () { submitReport(false); });
    anotherBtn.addEventListener('click', function () { submitReport(true); });

    // Subject picker: switch mode in place, preserving already-entered field values.
    subjectPicker.querySelectorAll('.report-metric-subject-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.dataset.reportMode !== currentMode) applyMode(this.dataset.reportMode);
        });
    });

    allFields.forEach(el => {
        el.addEventListener('input', function () {
            if (this.value.trim()) this.classList.remove('report-metric-input--invalid');
        });
    });

    if (footerLink) {
        footerLink.addEventListener('click', function (e) {
            e.preventDefault();
            openOverlay('missing_metric', null);
        });
    }

    window.openReportMetricOverlay = openOverlay;
}());
