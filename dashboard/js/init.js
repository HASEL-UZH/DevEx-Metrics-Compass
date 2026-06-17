// ─── App initialization ───────────────────────────────────────────────────────

anychart.onDocumentReady(function() {
    loadClickedMetricsFromLocalStorage();

    Promise.all([
        fetch("data/data.json").then(response => response.json()),
        fetch("data/source_ids.json").then(response => response.json())
    ])
    .then(([data, urls]) => {
        SOURCE_URL_MAPPING = urls.reduce((acc, current) => {
            acc[current.ref_number] = current;
            return acc;
        }, {});

        originalData = data.map(item => {
            if (item.company) { item.company = transformSources(item.company, 'company'); }
            if (item.research) { item.research = transformSources(item.research, 'research'); }
            return item;
        });

        originalData.forEach(m => {
            if (m.related_metrics && m.related_metrics !== '-') {
                m.resolvedRelated = m.related_metrics.split(';')
                    .map(s => parseInt(s.trim(), 10))
                    .map(id => originalData.find(r => r.id === id && r.description !== undefined))
                    .filter(Boolean);
            } else {
                m.resolvedRelated = [];
            }
        });

        filterData();
        updateStepBar();
        updateColorLegend('categorization');
    })
    .catch(error => {
        console.error("Error loading JSON data:", error);
    });
});
