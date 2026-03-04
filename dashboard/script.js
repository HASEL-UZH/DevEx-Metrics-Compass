let SOURCE_URL_MAPPING = {};

// Get the overlay elements
const myOverlay = document.getElementById('myOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');

// Get the new button that opens the maturity assessment
const openMaturityAssessmentBtn = document.getElementById('openMaturityAssessmentBtn');

// Get all overlay screens
const initialChoiceScreen = document.getElementById('initial-choice-screen');
const question1Screen = document.getElementById('question1-screen');
const level1Screen = document.getElementById('level1-screen');
const question2Screen = document.getElementById('question2-screen');
const level2Screen = document.getElementById('level2-screen');
const question3Screen = document.getElementById('question3-screen');
const level3Screen = document.getElementById('level3-screen');
const question4Screen = document.getElementById('question4-screen');
const level4Screen = document.getElementById('level4-screen');
const level5Screen = document.getElementById('level5-screen');

// Get the navigation hint elements
const navigationHint = document.getElementById('navigation-hint');
const closeHintButton = document.getElementById('close-hint'); 

// Get the slider elements and display spans
const minMentionsSlider = document.getElementById('min-mentions-slider');
const minMentionsDisplay = document.getElementById('min-mentions-display');

// Store the original data and filtered data
let originalData = [];
let filteredData = [];
let chart = null;
let activeFilters = {
    dataType: 'all', // filter for data type
    focus: 'all', // filter for research vs. practionner
    company: 'all', // filter for company size
    specificCompany: 'all', // filter for company dropdown
    specificFramework: 'all', // filter for research dropdown
    minMentions: 0 // min mentions slider
};

// Store clicked metrics
let clickedMetrics = [];

// Get reference to the message div
const noMetricsMessage = document.getElementById('no-metrics-message');

// Global variable for custom tooltip
const customTooltip = document.getElementById('custom-tooltip');

// Overlay navigation logic
let currentOverlayScreen = initialChoiceScreen;

function showOverlayScreen(screenToShow) {
    // Hide all overlay screens first
    document.querySelectorAll('.overlay-screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    // Show the desired screen
    screenToShow.classList.remove('hidden');
    currentOverlayScreen = screenToShow; // Update current screen
}

// Function to control hint visibility
function updateHintVisibility() {
    // Check if the overlay is active (its display is not 'none')
    const overlayStyle = window.getComputedStyle(myOverlay);
    const overlayIsActive = overlayStyle.display !== 'none';

    // Show hint if overlay is NOT active and it hasn't been dismissed, hide otherwise
    if (!overlayIsActive) {
        // Only show if it hasn't been dismissed by the user (check local storage)
        if (localStorage.getItem('navigationHintDismissed') !== 'true') {
             navigationHint.style.display = 'block'; 
        }
    } else {
        navigationHint.style.display = 'none';
    }
}

// Initial state: show the choice screen AND update hint visibility
showOverlayScreen(initialChoiceScreen);
updateHintVisibility();

// Start from scratch button
document.getElementById('start-scratch-btn').addEventListener('click', () => {
    myOverlay.style.display = 'none'; // Hide the overlay
    clearAllFilters(); // Ensure no filters are active by default 
    updateHintVisibility(); // Update hint visibility after hiding overlay
});

// Start maturity assessment button
document.getElementById('start-assessment-btn').addEventListener('click', () => {
    myOverlay.style.display = 'flex'; // Ensure overlay is visible if not already
    showOverlayScreen(question1Screen); // Go to the first question
    updateHintVisibility(); // Update hint visibility after activating overlay
});

// Event listener for the button outside the overlay to open Maturity Assessment directly
openMaturityAssessmentBtn.addEventListener('click', () => {
    myOverlay.style.display = 'flex'; // Make the overlay visible
    showOverlayScreen(question1Screen); // Jump directly to Question 1 of the assessment
    updateHintVisibility(); // Update hint visibility after activating overlay
});

// Close overlay button
closeOverlayBtn.addEventListener('click', () => {
    myOverlay.style.display = 'none';
    showOverlayScreen(initialChoiceScreen); // Reset to initial screen when closed
    updateHintVisibility(); // Update hint visibility after hiding overlay
});

// Close overlay if clicked outside the content (on the overlay itself)
myOverlay.addEventListener('click', (event) => {
    if (event.target === myOverlay) {
        myOverlay.style.display = 'none';
        showOverlayScreen(initialChoiceScreen); // Reset to initial screen when closed
        updateHintVisibility(); // Update hint visibility after hiding overlay
    }
});

// Hint dismissal logic
if (navigationHint && closeHintButton) {
    // Dismiss by clicking the 'x' button
    closeHintButton.addEventListener('click', function(event) {
        event.stopPropagation(); // Prevent click from propagating to the hint itself
        navigationHint.style.display = 'none';
        localStorage.setItem('navigationHintDismissed', 'true'); // Store dismissal in local storage
    });

    // Dismiss by clicking anywhere on the hint itself
    navigationHint.addEventListener('click', function() {
        this.style.display = 'none';
        localStorage.setItem('navigationHintDismissed', 'true'); // Store dismissal in local storage
    });
}


// Question and result logic

// Question 1
document.getElementById('q1-yes-btn').addEventListener('click', () => showOverlayScreen(question2Screen));
document.getElementById('q1-no-btn').addEventListener('click', () => showOverlayScreen(level1Screen));

// Question 2
document.getElementById('q2-yes-btn').addEventListener('click', () => showOverlayScreen(question3Screen));
document.getElementById('q2-no-btn').addEventListener('click', () => showOverlayScreen(level2Screen));

// Question 3
document.getElementById('q3-yes-btn').addEventListener('click', () => showOverlayScreen(question4Screen));
document.getElementById('q3-no-btn').addEventListener('click', () => showOverlayScreen(level3Screen));

// Question 4
document.getElementById('q4-yes-btn').addEventListener('click', () => showOverlayScreen(level5Screen));
document.getElementById('q4-no-btn').addEventListener('click', () => showOverlayScreen(level4Screen));

// Go back buttons ---
document.querySelectorAll('.go-back-btn').forEach(button => {
    button.addEventListener('click', function() {
        const targetScreenId = this.dataset.targetScreen;
        const targetScreen = document.getElementById(targetScreenId);
        if (targetScreen) {
            showOverlayScreen(targetScreen);
        }
    });
});

// Show metrics buttons ---
document.querySelectorAll('.show-metrics-btn').forEach(button => {
    button.addEventListener('click', function() {
        myOverlay.style.display = 'none'; // Hide overlay
        clearAllFilters(); // Clear previous filters first

        // Apply specific filters based on data attributes
        const filterFramework = this.dataset.filterFramework;
        const filterDataType = this.dataset.filterDatatype;
        const filterFocus = this.dataset.filterFocus;
        const filterCompany = this.dataset.filterCompany;
        const filterAll = this.dataset.filterAll;

        if (filterAll) {
            // Do nothing, filters are already cleared to 'all'
        } else if (filterFramework) {
            applySpecificFilter('specificFramework', filterFramework, 'research-dropdown');
        } else if (filterDataType && filterFocus) {
            applySpecificFilter('dataType', filterDataType, 'dataType');
            applySpecificFilter('focus', filterFocus, 'focus');
        } else if (filterCompany) {
            applySpecificFilter('company', filterCompany, 'company');
        }

        filterData(); // Re-apply filters to update the chart
        updateHintVisibility(); // Update hint visibility after hiding overlay
    });
});

/**
 * Helper function to apply a filter and visually update the corresponding buttons/dropdown.
 * @param {string} filterGroup - The filter group (e.g., 'dataType', 'focus', 'company', 'specificCompany', 'specificFramework').
 * @param {string} filterValue - The value to set for the filter.
 * @param {string} [htmlGroupId] - Optional. The ID of the HTML group (e.g., 'dataType' for data type buttons, 'company-dropdown' for dropdowns) to update active states.
 */
function applySpecificFilter(filterGroup, filterValue, htmlGroupId = null) {
    activeFilters[filterGroup] = filterValue;

    if (htmlGroupId) {
        // Handle filter buttons
        const buttonsInGroup = document.querySelectorAll(`.filter-btn[data-group="${htmlGroupId}"]`);
        if (buttonsInGroup.length > 0) {
            buttonsInGroup.forEach(btn => {
                if (btn.dataset.filter === filterValue) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // Handle dropdowns
        const dropdown = document.getElementById(htmlGroupId);
        if (dropdown && dropdown.tagName === 'SELECT') {
            dropdown.value = filterValue;
        }
    }
}


// Function to create and display the chart (from anychart)
function createChart(data) {
    // Clear previous chart if exists
    if (chart) {
        chart.dispose();
    }

    // Makes tree from the data
    const dataTree = anychart.data.tree(data, 'as-table');

    // Create sunburst chart
    chart = anychart.sunburst(dataTree);

    // Disable AnyChart's built-in tooltip
    chart.tooltip(false);

    // Disable right-click context menu
    chart.contextMenu().enabled(false);

    // Set calculation mode
    chart.calculationMode('parent-independent');

    // Configure labels
    chart.labels().format("{%name}");

    // Set the position of labels
    chart.labels().position("radial");

    // Set the color gradient, lighter color for child nodes
    chart.fill(function() {
        if (this.parent)
            return anychart.color.lighten(this.parentColor, 0.15);
        return this.mainColor;
    });

    // Modify the pointClick event listener to show the custom tooltip
    chart.listen('pointClick', function(e) {
        const point = e.point;
        // Only show tooltip for actual metrics (nodes with 'type' property)
        if (point && point.get('type')) {
            const metricData = { // Prepare data object for the tooltip
                id: point.get('id'),
                name: point.get('name'),
                alsoknownas: point.get('alsoknownas'),
                company: point.get('company'), 
                research: point.get('research'), 
                type: point.get('type'),
                description: point.get('description'),
                value: point.get('value'),
                is_research: point.get('is_research') 
            };
            showCustomTooltip(metricData, e.originalEvent); 
        }
        
    });

    // Specify the container element id
    chart.container('container');

    // Initiate the drawing of the chart
    chart.draw();
}

// Function to show the custom tooltip
function showCustomTooltip(metricData, event) {
    // Always hide any existing tooltip first before showing a new one
    hideCustomTooltip();

    const metricName = metricData.name;
    const metricAlsoKnownAs = metricData.alsoknownas;
    const metricType = metricData.type;
    const metricDescription = metricData.description;
    const metricValue = metricData.value;
    const metricId = metricData.id;
    const metricIs_Research = metricData.is_research; 

    // Determine the class for the tag based on the type
    let typeTagClass = '';
    if (metricType === 'survey-based') {
        typeTagClass = 'survey-based';
    } else if (metricType === 'telemetry/log-based') {
        typeTagClass = 'telemetry-log-based';
    }

    // Determine the class and text for the research/practitioner tag 
    let focusTagClass = '';
    let focusTagText = '';

    if (metricIs_Research === 2) { // If it's *only* practitioner-focused (is_research is 2)
        focusTagClass = 'practitioners-only';
        focusTagText = 'Practitioners only';
    } else if (metricIs_Research === 1) { // If research-focused (is_research is 1)
        focusTagClass = 'research-only';
        focusTagText = 'Research only';
    } else { // If metric used by practitioner and research
        focusTagClass = 'research-and-practitioners';
        focusTagText = 'Practitioners and research';
    }

    // Generate HTML for 'company' field with hyperlinks
    let companyUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.company) && metricData.company.length > 0) {
        // Sort by name before mapping
        companyUsedByHtml = [...metricData.company].sort((a, b) => a.name.localeCompare(b.name)).map(source => {
            if (source.url && source.url !== '') {
                return `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.name}</a>`;
            } else {
                return source.name;
            }
        }).join('; ');
    }

     // Generate HTML for 'research' field with hyperlinks
    let researchUsedByHtml = 'no mentions';
    if (Array.isArray(metricData.research) && metricData.research.length > 0) {
        // Sort by name before mapping
        researchUsedByHtml = [...metricData.research].sort((a, b) => a.name.localeCompare(b.name)).map(source => {
            if (source.url && source.url !== '') {
                return `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.name}</a>`;
            } else {
                return source.name;
            }
        }).join('; ');
    }
    
    let content = `
        <span class="close-tooltip-button">&times;</span>
        <br>
        <div class="metric-name-title">${metricName}</div> `;

    content += `
        <hr>
        <div class="metric-detail"><strong>Description:</strong> ${metricDescription || 'No description available'}</div>
        
    `

    if (metricAlsoKnownAs && metricAlsoKnownAs !== '-') { // Check for actual value
        content += `<div class="metric-detail"><strong>Also known as:</strong> ${metricAlsoKnownAs}</div>`;
    }

    content += `
        <br>
        <div class="metric-detail">
            <strong>Tags:</strong> <span class="metric-type-tag ${typeTagClass}">${metricType}</span><span class="metric-focus-tag ${focusTagClass}">${focusTagText}</span> 
        </div>
        <hr>
        <div class="metric-detail"><strong>Number of mentions:</strong> ${metricValue}</div>
        <div class="metric-detail"><strong>Companies:</strong> ${companyUsedByHtml}</div>
        <div class="metric-detail"><strong>Research:</strong> ${researchUsedByHtml}</div>
        
    
        
        <br>
        <button data-metric-id="${metricId}">Add to selected metrics</button>
    `;

    customTooltip.innerHTML = content;
    customTooltip.classList.add('active'); // Show and make interactive

    // Position the tooltip near the click, but prevent it from going off-screen
    const x = event.clientX + 15; // Offset from click point
    const y = event.clientY + 15;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get tooltip dimensions after content is rendered
    const tooltipRect = customTooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    // Adjust position if it goes off-screen
    if (x + tooltipWidth > viewportWidth - 20) { // 20px padding from right edge
        customTooltip.style.left = `${event.clientX - tooltipWidth - 15}px`;
    } else {
        customTooltip.style.left = `${x}px`;
    }

    if (y + tooltipHeight > viewportHeight - 20) { // 20px padding from bottom edge
        customTooltip.style.top = `${event.clientY - tooltipHeight - 15}px`;
    } else {
        customTooltip.style.top = `${y}px`;
    }

    // Add event listener to the "Add to selected metrics" button inside the tooltip
    const addButton = customTooltip.querySelector('button[data-metric-id]');
    if (addButton) {
        // No need to clear old listeners if we hide and re-render innerHTML
        addButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent click from bubbling up
            addClickedMetric(metricData); // Use the metricData passed to this function
            hideCustomTooltip(); // Close tooltip after adding
        });
    }

    // Add event listener to the Close button inside the tooltip
    const closeButton = customTooltip.querySelector('.close-tooltip-button');
    if (closeButton) {
        closeButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent click from bubbling up
            hideCustomTooltip(); // Close the tooltip
        });
    }

    // Close tooltip if user clicks anywhere else on the document
    document.addEventListener('click', handleDocumentClick);
}

// Function to hide the custom tooltip
function hideCustomTooltip() {
    customTooltip.classList.remove('active');
    // Remove the global document click listener when tooltip is hidden
    document.removeEventListener('click', handleDocumentClick);
}

// Global click handler to dismiss tooltip if click is outside of it
function handleDocumentClick(event) {
    // If the click is not inside the custom tooltip and not on the chart itself
    if (customTooltip.classList.contains('active') &&
        !customTooltip.contains(event.target) &&
        !document.getElementById('container').contains(event.target)) {
        hideCustomTooltip();
    }
}

// Function to add clicked metrics to the list
function addClickedMetric(metric) {
    // Check if metric already exists in the list
    const exists = clickedMetrics.some(m => m.id === metric.id);
    if (!exists) {
        clickedMetrics.push(metric);
        updateClickedMetricsList();
        saveClickedMetricsToLocalStorage();
    }
}

// Function to remove a clicked metric from the list
function removeClickedMetric(metricId) {
    clickedMetrics = clickedMetrics.filter(m => m.id !== metricId);
    updateClickedMetricsList();
    saveClickedMetricsToLocalStorage();
}

// Function to clear all clicked metrics
function clearAllClickedMetrics() {
    clickedMetrics = [];
    updateClickedMetricsList();
    saveClickedMetricsToLocalStorage();
}

// Function to update the clicked metrics list in the DOM
function updateClickedMetricsList() {
    const listElement = document.getElementById('clicked-metrics-list');

    // Clear current content
    listElement.innerHTML = '';

    // If there are no metrics, show a message
    if (clickedMetrics.length === 0) {
        listElement.innerHTML = '<div class="no-metrics-message">No metrics selected yet.</div>';
        return;
    }

    // Add each metric to the list
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

// Function to save clicked metrics to local storage
function saveClickedMetricsToLocalStorage() {
    localStorage.setItem('clickedMetrics', JSON.stringify(clickedMetrics));
}

// Function to load clicked metrics from local storage
function loadClickedMetricsFromLocalStorage() {
    const saved = localStorage.getItem('clickedMetrics');
    if (saved) {
        clickedMetrics = JSON.parse(saved);
        updateClickedMetricsList();
    }
}

// Function to extract unique companies from the data, considering filters
function extractCompanies(data, currentFilters) {
    const companies = new Set(); // Use a Set for unique names
    companies.add('all');

    data.forEach(item => {
        let matches = true;

        if (!item.type) { // Only consider actual metrics (nodes with a 'type')
            matches = false;
        }
        if (currentFilters.dataType !== 'all' && item.type !== currentFilters.dataType) {
            matches = false;
        }
        if (currentFilters.focus !== 'all' && item.is_research !== parseInt(currentFilters.focus)) {
            matches = false;
        }
        if (currentFilters.company !== 'all' && item.bigcompany !== parseInt(currentFilters.company)) {
            matches = false;
        }
        
        // Keyword search needs to check across names in company and research arrays
        const keyword = document.getElementById('keyword-search').value.toLowerCase();
        if (keyword && !(
                (item.name && item.name.toLowerCase().includes(keyword)) ||
                (item.description && item.description.toLowerCase().includes(keyword)) ||
                (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword)) ||
                (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) || // Check company array
                (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword))) // Check research array
            )) {
            matches = false;
        }

        // Check for specific framework if selected
        if (currentFilters.specificFramework !== 'all' && Array.isArray(item.research)) {
            const frameworkNames = item.research.map(source => source.name);
            if (!frameworkNames.includes(currentFilters.specificFramework)) {
                matches = false;
            }
        }

        if (matches && Array.isArray(item.company)) { // Ensure 'company' is an array of objects
            item.company.forEach(source => {
                const companyName = source.name.trim();
                const lowerCompanyName = companyName.toLowerCase();
                if (
                    companyName &&
                    !lowerCompanyName.includes("framework") && // Keep this if you want to exclude any company names accidentally tagged as frameworks
                    !lowerCompanyName.includes("metrics overview") &&
                    !lowerCompanyName.includes("used widely") // Explicitly exclude "used widely" here
                ) {
                    companies.add(companyName); // Add to Set
                }
            });
        }
    });

    const sortedCompanies = Array.from(companies).sort((a, b) => {
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return a.localeCompare(b);
    });
    return sortedCompanies;
}

// Function to populate company dropdown
function populateCompanyDropdown(companies, selectedCompany) {
    const dropdown = document.getElementById('company-dropdown');
    dropdown.innerHTML = ''; // Clear existing options

    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company === 'all' ? 'No company selected' : company;
        dropdown.appendChild(option);
    });

    // Set the selected value
    dropdown.value = selectedCompany || 'all';
}

// Function to extract unique research frameworks from the data
function extractFrameworks(data, currentFilters) {
    const frameworks = new Set(); // Use a Set for unique names
    frameworks.add('all');

    data.forEach(item => {
        let matches = true;

        if (currentFilters.dataType !== 'all' && item.type !== currentFilters.dataType) {
            matches = false;
        }
        if (currentFilters.focus !== 'all' && item.is_research !== parseInt(currentFilters.focus)) { 
            matches = false;
        }
        if (currentFilters.company !== 'all' && item.bigcompany !== parseInt(currentFilters.company)) {
            matches = false;
        }

        // Keyword search needs to check across names in usedby array
        const keyword = document.getElementById('keyword-search').value.toLowerCase();
        if (keyword && !(
                (item.name && item.name.toLowerCase().includes(keyword)) ||
                (item.description && item.description.toLowerCase().includes(keyword)) ||
                (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) || // Check company array
                (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword))) || // Check research array
                (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword))
            )) {
            matches = false;
        }


        // Check for specific company if selected
        if (currentFilters.specificCompany !== 'all' && Array.isArray(item.company)) {
            const companyNames = item.company.map(source => source.name);
            if (!companyNames.includes(currentFilters.specificCompany)) {
                matches = false;
            }
        }

        if (matches && Array.isArray(item.research)) { // Ensure 'research' is an array
            item.research.forEach(source => {
                const frameworkName = source.name.trim();
                const lowerFrameworkName = frameworkName.toLowerCase();
                if (lowerFrameworkName.includes("framework")) {
                    frameworks.add(frameworkName); // Add to Set
                }
            });
        }
    });

    console.log("Found frameworks:", frameworks);

    const sortedFrameworks = Array.from(frameworks).sort((a, b) => {
        if (a === 'all') return -1;
        if (b === 'all') return 1;
        return a.localeCompare(b);
    });
    return sortedFrameworks;
}

// Function to populate research framework dropdown
function populateFrameworkDropdown(frameworks, selectedFramework) {
    const dropdown = document.getElementById('research-dropdown');
    dropdown.innerHTML = '';

    frameworks.forEach(framework => {
        const option = document.createElement('option');
        option.value = framework;
        option.textContent = framework === 'all' ? 'No research framework selected' : framework;
        dropdown.appendChild(option);
    });

    // Set the selected value
    dropdown.value = selectedFramework || 'all';
}

// Function to filter data 
function filterData() {
    const keyword = document.getElementById('keyword-search').value.toLowerCase();
    const specificCompany = activeFilters.specificCompany;
    const specificFramework = activeFilters.specificFramework;
    const minMentions = activeFilters.minMentions;

    const actualMatchingMetrics = originalData.filter(item => {
        // Only process items that are actual metrics (have a 'type' property)
        if (!item.type) {
            return false;
        }

        let matches = true;

        if (activeFilters.dataType !== 'all' && item.type !== activeFilters.dataType) {
            matches = false;
        }
        if (activeFilters.focus !== 'all' && item.is_research !== parseInt(activeFilters.focus)) { 
            matches = false;
        }
        if (activeFilters.company !== 'all' && item.bigcompany !== parseInt(activeFilters.company)) {
            matches = false;
        }

        // Logic for specificCompany and specificFramework with array of objects
        // The transformSources function ensures these are arrays of objects
        if (specificCompany !== 'all' && !(Array.isArray(item.company) && item.company.some(source => source.name === specificCompany))) {
            matches = false;
        }
        if (specificFramework !== 'all' && !(Array.isArray(item.research) && item.research.some(source => source.name === specificFramework))) {
            matches = false;
        }

        // Keyword search needs to check across names in company and research arrays
        if (keyword && !(
            (item.name && item.name.toLowerCase().includes(keyword)) ||
            (item.description && item.description.toLowerCase().includes(keyword)) ||
            (item.alsoknownas && item.alsoknownas.toLowerCase().includes(keyword)) ||
            (Array.isArray(item.company) && item.company.some(source => source.name.toLowerCase().includes(keyword))) ||
            (Array.isArray(item.research) && item.research.some(source => source.name.toLowerCase().includes(keyword)))
        )) {
            matches = false;
        }
        

        if (item.value !== undefined && item.value < minMentions) {
            matches = false;
        }

        return matches;
    });

    filteredData = [];
    const includedIds = new Set();

    actualMatchingMetrics.forEach(metric => {
        if (!includedIds.has(metric.id)) {
            filteredData.push(metric);
            includedIds.add(metric.id);
        }
        let currentParentId = metric.parent;
        while (currentParentId) {
            const parentNode = originalData.find(item => item.id === currentParentId);
            if (parentNode && !includedIds.has(parentNode.id)) {
                filteredData.push(parentNode);
                includedIds.add(parentNode.id);
            }
            currentParentId = parentNode ? parentNode.parent : null;
        }
    });

    updateMetricsCount(actualMatchingMetrics);

    const availableCompanies = extractCompanies(originalData, activeFilters);
    populateCompanyDropdown(availableCompanies, activeFilters.specificCompany);

    const availableFrameworks = extractFrameworks(originalData, activeFilters);
    populateFrameworkDropdown(availableFrameworks, activeFilters.specificFramework);

    if (actualMatchingMetrics.length === 0) {
        if (chart) {
            chart.dispose();
            chart = null;
        }
        noMetricsMessage.style.display = 'block';
    } else {
        noMetricsMessage.style.display = 'none';
        createChart(filteredData);
    }
}

// Function to update metrics count display
function updateMetricsCount(data) {
    const metricsWithType = data.filter(item => item.type);
    document.getElementById('metrics-count').textContent = `Showing ${metricsWithType.length} metrics`;
}

// Handle button clicks for filters
document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
        const filterGroup = this.dataset.group;
        const filterValue = this.dataset.filter;
        applySpecificFilter(filterGroup, filterValue, filterGroup); // Use applySpecificFilter
        filterData();
    });
});

// Handle company dropdown change
document.getElementById('company-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificCompany', this.value); 
    filterData();
});

// Handle research dropdown change
document.getElementById('research-dropdown').addEventListener('change', function() {
    applySpecificFilter('specificFramework', this.value); 
    filterData();
});

// Handle radio button changes 
document.querySelectorAll('input[name="dataType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        activeFilters.dataType = this.value;
        filterData();
    });
});

// Slider event listener
minMentionsSlider.addEventListener('input', function() {
    let minValue = parseInt(this.value);
    activeFilters.minMentions = minValue;
    minMentionsDisplay.textContent = minValue;
    filterData();
});

// Handle clear all clicked metrics button
document.getElementById('clear-all-metrics').addEventListener('click', clearAllClickedMetrics);

// Handle download CSV button click
document.getElementById('download-csv').addEventListener('click', downloadCsv);

// Handle clear all filters button
document.getElementById('clear-filters').addEventListener('click', function() {
    clearAllFilters();
    noMetricsMessage.style.display = 'none'; // Hide message when filters are cleared
});

// Handle keyword search
document.getElementById('keyword-search').addEventListener('input', filterData);

// Set active button style
function setActiveButton(activeBtn) {
    const group = activeBtn.dataset.group;
    if (group) {
        document.querySelectorAll(`.filter-btn[data-group="${group}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }
}

// Function to download clicked metrics as CSV-file
function downloadCsv() {
    if (clickedMetrics.length === 0) {
        alert("No metrics selected to download.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Update CSV header to only include one 'Source' column
    csvContent += ["name", "alsoknownas", "companies", "research", "type", "description"].join(",") + "\r\n";

    clickedMetrics.forEach(metric => {
        const companySourcesFormatted = [];
        if (Array.isArray(metric.company) && metric.company.length > 0) {
            metric.company.forEach(source => {
                if (source.url && source.url !== '') {
                    companySourcesFormatted.push(`${source.name}: ${source.url}`);
                } else {
                    companySourcesFormatted.push(source.name);
                }
            });
        }
        const companiesCsv = companySourcesFormatted.join('; ');

        const researchSourcesFormatted = [];
        if (Array.isArray(metric.research) && metric.research.length > 0) {
            metric.research.forEach(source => {
                if (source.url && source.url !== '') {
                    researchSourcesFormatted.push(`${source.name}: ${source.url}`);
                } else {
                    researchSourcesFormatted.push(source.name);
                }
            });
        }
        const researchCsv = researchSourcesFormatted.join('; ');

        const escapedFields = [
            escapeCsvField(metric.name),
            escapeCsvField(metric.alsoknownas),
            escapeCsvField(companiesCsv), // Use the formatted company string
            escapeCsvField(researchCsv), // Use the formatted research string
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

    document.body.removeChild(link); // Clean up
}

// Helper function for escaped CSV fields
function escapeCsvField(field) {
    if (field === undefined || field === null) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Function to clear all filters
function clearAllFilters() {
    activeFilters = {
        dataType: 'all',
        focus: 'all',
        company: 'all',
        specificCompany: 'all',
        specificFramework: 'all',
        minMentions: 0 // Reset slider min to 0
    };
    // Reset active button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') {
            btn.classList.add('active'); // Set 'All' buttons to active
        }
    });
    document.getElementById('keyword-search').value = ''; // Clear keyword search
    document.getElementById('company-dropdown').value = 'all'; // Reset company dropdown
    document.getElementById('research-dropdown').value = 'all'; // Reset framework dropdown

    // Reset slider display and values
    initializeMentionsSlider(); // Call the initialization function to reset

    filterData(); // Reapply the default filters
}

// Function to initialize the mentions slider based on data
function initializeMentionsSlider() {
    let allMentionValues = originalData
        .filter(item => item.value !== undefined && item.type) // Only consider actual metrics with a value
        .map(item => item.value);

    if (allMentionValues.length > 0) {
        const minVal = Math.min(...allMentionValues);
        const maxVal = Math.max(...allMentionValues); 

        minMentionsSlider.min = minVal;
        minMentionsSlider.max = maxVal; 
        minMentionsSlider.value = minVal;

        minMentionsDisplay.textContent = minVal;

        activeFilters.minMentions = minVal;
    } else {
        // No data with 'value', disable or hide sliders, set to default 0-100
        minMentionsSlider.min = 0;
        minMentionsSlider.max = 100; // Default max if no data
        minMentionsSlider.value = 0;

        minMentionsDisplay.textContent = 0;

        activeFilters.minMentions = 0;
    }
}

// Function to transform source strings into an array of objects for 'company' and 'research'
function transformSources(sourceString, type) {
    if (typeof sourceString === 'string' && sourceString !== '-') {
        const ids = sourceString.split(';').map(s => s.trim());
        return ids.map(id => {
            // Find the matching source from SOURCE_URL_MAPPING
            const sourceInfo = Object.values(SOURCE_URL_MAPPING).find(source => source.ref_number === id);
            return {
                name: sourceInfo ? sourceInfo.ref_name : id, // Use ref_name if found, otherwise the ID
                url: sourceInfo ? sourceInfo.ref_link : null // Use ref_link if found, otherwise null
            };
        });
    }
    return []; // Return an empty array if no valid string or is '-'
}

// Initialize AnyChart Graph
anychart.onDocumentReady(function() {
    loadClickedMetricsFromLocalStorage();

    // Use Promise.all to fetch both JSON files concurrently
    Promise.all([
        fetch("data.json").then(response => response.json()),
        fetch("source_ids.json").then(response => response.json()) 
    ])
    .then(([data, urls]) => {
        // Convert the array of objects in urls to a more accessible map
        SOURCE_URL_MAPPING = urls.reduce((acc, current) => {
            acc[current.ref_number] = current;
            return acc;
        }, {});
        
        // Transform the data for 'company' and 'research' fields
        originalData = data.map(item => {
            if (item.company) {
                item.company = transformSources(item.company, 'company');
            }
            if (item.research) {
                item.research = transformSources(item.research, 'research');
            }
            return item;
        });

        initializeMentionsSlider();
        filterData();
        updateHintVisibility();
    })
    .catch(error => {
        console.error("Error loading JSON data:", error);
    });
});