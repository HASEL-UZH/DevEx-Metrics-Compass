// ─── Metrics shortlist, CSV export ───────────────────────────────────────────

function addClickedMetric(metric) {
    const exists = clickedMetrics.some(m => m.id === metric.id);
    if (!exists) {
        clickedMetrics.push(metric);
        updateClickedMetricsList();
        saveClickedMetricsToLocalStorage();
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
    listElement.innerHTML = '';

    if (clickedMetrics.length === 0) {
        listElement.innerHTML = '<div class="no-metrics-message">No metrics selected yet.</div>';
        return;
    }

    clickedMetrics.forEach(metric => {
        const metricElement = document.createElement('div');
        metricElement.className = 'clicked-metric-item';
        metricElement.setAttribute('title', metric.description);

        const nameElement = document.createElement('span');
        nameElement.className = 'clicked-metric-name';
        nameElement.textContent = metric.name;

        const removeElement = document.createElement('span');
        removeElement.className = 'remove-metric';
        removeElement.textContent = '×';
        removeElement.addEventListener('click', function() {
            removeClickedMetric(metric.id);
        });

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

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += ["name", "alsoknownas", "companies", "research", "type", "description"].join(",") + "\r\n";

    clickedMetrics.forEach(metric => {
        const companySourcesFormatted = [];
        if (Array.isArray(metric.company) && metric.company.length > 0) {
            metric.company.forEach(source => {
                companySourcesFormatted.push(source.url && source.url !== '' ? `${source.name}: ${source.url}` : source.name);
            });
        }

        const researchSourcesFormatted = [];
        if (Array.isArray(metric.research) && metric.research.length > 0) {
            metric.research.forEach(source => {
                researchSourcesFormatted.push(source.url && source.url !== '' ? `${source.name}: ${source.url}` : source.name);
            });
        }

        const escapedFields = [
            escapeCsvField(metric.name),
            escapeCsvField(metric.alsoknownas),
            escapeCsvField(companySourcesFormatted.join('; ')),
            escapeCsvField(researchSourcesFormatted.join('; ')),
            escapeCsvField(metric.type),
            escapeCsvField(metric.description)
        ];
        csvContent += escapedFields.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "selected_developer_experience_metrics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function escapeCsvField(field) {
    if (field === undefined || field === null) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('clear-all-metrics').addEventListener('click', clearAllClickedMetrics);
document.getElementById('download-csv').addEventListener('click', downloadCsv);
