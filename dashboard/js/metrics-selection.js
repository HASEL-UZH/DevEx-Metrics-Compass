// ─── Metrics shortlist, CSV export ───────────────────────────────────────────

function addClickedMetric(metric, status) {
    const existingIndex = clickedMetrics.findIndex(m => m.id === metric.id);
    if (existingIndex >= 0) {
        clickedMetrics[existingIndex].collectionStatus = status;
    } else {
        clickedMetrics.push({ ...metric, collectionStatus: status });
    }
    updateClickedMetricsList();
    saveClickedMetricsToLocalStorage();
    expandShortlist();
}

function expandShortlist() {
    const content = document.getElementById('shortlist-collapsible');
    const chevron = document.querySelector('.collapsible-title .collapse-chevron');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    }
}

function removeClickedMetric(metricId) {
    clickedMetrics = clickedMetrics.filter(m => m.id !== metricId);
    updateClickedMetricsList();
    saveClickedMetricsToLocalStorage();
}

function clearAllClickedMetrics() {
    clickedMetrics = [];
    updateClickedMetricsList();
    saveClickedMetricsToLocalStorage();
}

function updateClickedMetricsList() {
    const listElement = document.getElementById('clicked-metrics-list');
    const countBadge = document.getElementById('metrics-count-badge');
    listElement.innerHTML = '';

    if (countBadge) {
        if (clickedMetrics.length > 0) {
            countBadge.textContent = clickedMetrics.length;
            countBadge.style.display = 'inline';
        } else {
            countBadge.style.display = 'none';
        }
    }

    if (clickedMetrics.length === 0) {
        listElement.innerHTML = '<div class="no-metrics-message">No metrics selected yet.</div>';
        return;
    }

    const sorted = [...clickedMetrics].sort((a, b) => {
        if (a.collectionStatus !== b.collectionStatus) {
            return a.collectionStatus === 'capturing' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(metric => {
        const metricElement = document.createElement('div');
        metricElement.className = 'clicked-metric-item';
        metricElement.setAttribute('title', metric.description);

        const statusBadge = document.createElement('span');
        const isCapturing = metric.collectionStatus === 'capturing';
        statusBadge.className = `metric-status-badge ${isCapturing ? 'status-capturing' : 'status-planning'}`;
        statusBadge.textContent = isCapturing ? '✓' : '+';
        statusBadge.title = isCapturing ? 'Already capturing' : 'Plan to capture';

        const nameElement = document.createElement('span');
        nameElement.className = 'clicked-metric-name';
        nameElement.textContent = metric.name;

        const removeElement = document.createElement('span');
        removeElement.className = 'remove-metric';
        removeElement.textContent = '×';
        removeElement.addEventListener('click', function() {
            removeClickedMetric(metric.id);
        });

        metricElement.appendChild(statusBadge);
        metricElement.appendChild(nameElement);
        metricElement.appendChild(removeElement);
        listElement.appendChild(metricElement);
    });
}

function saveClickedMetricsToLocalStorage() {
    localStorage.setItem('clickedMetrics', JSON.stringify(clickedMetrics));
}

function loadClickedMetricsFromLocalStorage() {
    const saved = localStorage.getItem('clickedMetrics');
    if (saved) {
        clickedMetrics = JSON.parse(saved);
        updateClickedMetricsList();
    }
}

function toggleShortlist(titleEl) {
    const content = document.getElementById('shortlist-collapsible');
    const chevron = titleEl.querySelector('.collapse-chevron');
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function downloadCsv() {
    if (clickedMetrics.length === 0) {
        alert("No metrics selected to download.");
        return;
    }

    let csvContent = ["name", "also_known_as", "collection_status", "description", "type", "outcome_goals", "number_of_mentions", "companies", "research"].join(",") + "\r\n";

    const sorted = [...clickedMetrics].sort((a, b) => {
        if (a.collectionStatus !== b.collectionStatus) {
            return a.collectionStatus === 'capturing' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    sorted.forEach(metric => {
        const companyNames = Array.isArray(metric.company)
            ? metric.company.map(s => s.name).join('; ')
            : '';

        const researchNames = Array.isArray(metric.research)
            ? metric.research.map(s => s.name).join('; ')
            : '';

        const rawType = (metric.type || '').toLowerCase();
        const typeLabel = rawType === 'both' ? 'Self-reported & Automated'
            : rawType.startsWith('quantitative') ? 'Automated'
            : rawType.startsWith('qualitative') ? 'Self-reported'
            : metric.type;

        const escapedFields = [
            escapeCsvField(metric.name),
            escapeCsvField(metric.alsoknownas),
            escapeCsvField(metric.collectionStatus === 'capturing' ? 'Already capturing' : 'Plan to capture'),
            escapeCsvField(metric.description),
            escapeCsvField(typeLabel),
            escapeCsvField(metric.outcome_goals),
            escapeCsvField(metric.value),
            escapeCsvField(companyNames),
            escapeCsvField(researchNames)
        ];
        csvContent += escapedFields.join(",") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "selected_developer_experience_metrics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCsvField(field) {
    if (field === undefined || field === null) return '""';
    const str = String(field);
    return '"' + str.replace(/"/g, '""') + '"';
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('clear-all-metrics').addEventListener('click', clearAllClickedMetrics);
document.getElementById('download-csv').addEventListener('click', downloadCsv);
