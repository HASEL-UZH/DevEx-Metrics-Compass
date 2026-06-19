// Report-metric overlay: two modes ('wrong' and 'missing'), POSTs to report-metric.php.
// On localhost, logs to console instead of posting.

(function () {
    const overlay     = document.getElementById('reportMetricOverlay');
    const titleEl     = document.getElementById('reportMetricOverlayTitle');
    const introEl     = document.getElementById('reportMetricIntro');
    const closeBtn    = document.getElementById('closeReportMetricOverlayBtn');
    const nameInput   = document.getElementById('reportMetricName');
    const sourceRow   = document.getElementById('reportMetricSourceRow');
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

    let currentMode = 'missing';

    function openOverlay(mode, metricData) {
        currentMode = mode || 'missing';
        resetForm();

        if (currentMode === 'wrong') {
            titleEl.textContent = 'Report an issue with this metric';
            introEl.textContent = 'Let us know what seems incorrect. We\'ll review it and correct it if needed.';
            nameInput.value = metricData && metricData.name ? metricData.name : '';
            nameInput.readOnly = true;
            nameInput.classList.add('report-metric-input--readonly');
            sourceRow.classList.add('hidden');
            descLabel.textContent = 'What is wrong?';
            descInput.placeholder = 'Describe the issue';
            anotherBtn.classList.add('hidden');
        } else {
            titleEl.textContent = 'Report a missing metric';
            introEl.textContent = 'Submit a missing or incorrect metric with a reference so we can verify and add it. Thank you!';
            nameInput.readOnly = false;
            nameInput.classList.remove('report-metric-input--readonly');
            sourceRow.classList.remove('hidden');
            descLabel.textContent = 'Metric definition';
            descInput.placeholder = 'How is this metric defined? What does it measure?';
            anotherBtn.classList.remove('hidden');
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
        let valid = true;
        let errorMsg = 'Please fill in all required fields.';

        const required = [nameInput, emailInput];
        if (currentMode === 'missing') required.push(sourceInput);
        if (currentMode === 'wrong')   required.push(descInput);

        required.forEach(el => {
            if (!el.value.trim()) {
                el.classList.add('report-metric-input--invalid');
                valid = false;
            } else {
                el.classList.remove('report-metric-input--invalid');
            }
        });

        if (currentMode === 'missing') {
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
            thanksEl.classList.remove('hidden');
            setTimeout(() => openOverlay('missing', null), 1200);
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

    allFields.forEach(el => {
        el.addEventListener('input', function () {
            if (this.value.trim()) this.classList.remove('report-metric-input--invalid');
        });
    });

    if (footerLink) {
        footerLink.addEventListener('click', function (e) {
            e.preventDefault();
            openOverlay('missing', null);
        });
    }

    window.openReportMetricOverlay = openOverlay;
}());
