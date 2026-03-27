// ─── App initialization ───────────────────────────────────────────────────────

anychart.onDocumentReady(function() {
    loadClickedMetricsFromLocalStorage();

    Promise.all([
        fetch("data.json").then(response => response.json()),
        fetch("source_ids.json").then(response => response.json())
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

        filterData();
        updateHintVisibility();
    })
    .catch(error => {
        console.error("Error loading JSON data:", error);
    });
});
