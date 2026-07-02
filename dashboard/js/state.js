// ─── Global state & DOM references ───────────────────────────────────────────

// Shared tooltip texts for filter dimensions — used in step 1 button titles and step 2 diff/sort views
const DIMENSION_TOOLTIPS = {
    // Maturity (ease_of_collection values)
    'Easy':     'Getting started: Metrics available out-of-the-box from standard tooling (e.g. code repo, CI, issue tracker) or a single survey question. No custom instrumentation required.',
    'Moderate': 'Established: Metrics requiring combining data sources, adding a structured survey instrument, or light custom instrumentation. Achievable within a few weeks of setup.',
    'Complex':  'Advanced: Metrics requiring significant custom tooling, IDE/calendar integration, dedicated research infrastructure, or ongoing qualitative data collection. Typically needs a dedicated DevEx or research team.',
    // Outcome goals
    'Developer Experience':         'Developer Experience: metrics about developer well-being, satisfaction, flow/focus, tooling friction, and onboarding (e.g. Burnout, Flow State, Cognitive Load, Feedback Loops, Sentiment).',
    'Product Excellence':           'Product Excellence: metrics about software quality, reliability, user-facing outcomes, and test quality (e.g. Change Failure Rate, Defects, Reliability, Test Coverage, Customer-Reported Defects).',
    'Organizational Effectiveness': 'Organizational Effectiveness: metrics about delivery throughput, business outcomes, DORA core metrics, and resource efficiency (e.g. Deployment Frequency, Lead Time, MTTR, Revenue per Engineer, Retention).',
    // AI categories
    'AI Impact':      'AI Impact: metrics that show whether AI tools improve delivery speed, code quality, and developer experience.',
    'AI Utilization': 'AI Utilization: metrics that reveal how many and what types of developers are adopting AI tooling, and how much work is being touched by AI.',
    'AI Cost':        'AI Cost: metrics related to AI spend, license usage, and identifying power users to optimize AI investment.',
};

// Display labels for ease_of_collection values
const MATURITY_FULL_LABEL = {
    Easy:     '🌱 Getting started (easy)',
    Moderate: '⚙️ Established (moderate)',
    Complex:  '🔬 Advanced (complex)',
};
const MATURITY_SHORT_LABEL = {
    Easy:     '🌱 Getting started',
    Moderate: '⚙️ Established',
    Complex:  '🔬 Advanced',
};

// Maps step-1 data-filter values to DIMENSION_TOOLTIPS keys (only where they differ from the key)
const FILTER_TO_TOOLTIP_KEY = {
    'ai-impact':      'AI Impact',
    'ai-utilization': 'AI Utilization',
    'ai-cost':        'AI Cost',
};

let SOURCE_URL_MAPPING = {};

// Overlay elements
const myOverlay = document.getElementById('myOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');

// Button that opens the mode-selection welcome screen
const openMaturityAssessmentBtn = document.getElementById('openMaturityAssessmentBtn');


// Data stores
let originalData = [];
let filteredData = [];
let chart = null;
let activeFilters = {
    dataType: 'all',
    aiMetric: 'all',
    focus: 'all',
    companySize: 'all',
    outcomeGoals: 'all',
    easeOfCollection: [],
    specificCompany: 'all',
    specificFramework: 'all',
    minMentions: 'all'
};

// Current "color by" dimension for the sunburst chart
let currentColorBy = 'categorization';

// Named mode constants for clarity and logging
const MODE = { BROWSE: 'browse', GUIDED: 'guided', COMPARE: 'compare', NEXTSTEPS: 'nextsteps' };
let currentMode = MODE.BROWSE;

// Role picked in Step 0 of the entry wizard; drives which questions get asked
// and which filters are shown by default afterward (see ROLE_CONFIG below).
const ROLE = { NEWCOMER: 'newcomer', PRACTITIONER: 'practitioner', RESEARCHER: 'researcher' };
let currentRole = null;

// Per-role wizard sequence + filter-panel layout.
// `sequence`      - fixed question order asked right after picking this role (Newcomer only).
// `quickSequence` - question order asked only if Practitioner/Researcher pick "quick questions".
// `keyFilters`    - filter dims shown by default. Static — unaffected by which
//                   wizard questions were actually asked/answered this session.
// `collapsedFilters` - filter dims tucked under "Advanced Filters". Also static.
// Nothing is ever fully hidden — every dim lands in keyFilters or collapsedFilters.
const ROLE_CONFIG = {
    [ROLE.NEWCOMER]: {
        sequence: ['dataType', 'outcomeGoals'],
        keyFilters: ['minMentions', 'outcomeGoals', 'aiMetric', 'dataType'],
        collapsedFilters: ['specificCompany', 'specificFramework', 'companySize', 'easeOfCollection', 'focus']
    },
    [ROLE.PRACTITIONER]: {
        quickSequence: ['easeOfCollection', 'outcomeGoals', 'aiMetric', 'dataType'],
        keyFilters: ['minMentions', 'outcomeGoals', 'easeOfCollection', 'aiMetric', 'dataType', 'specificCompany', 'specificFramework'],
        collapsedFilters: ['companySize', 'focus']
    },
    [ROLE.RESEARCHER]: {
        quickSequence: ['dataType', 'specificFramework'],
        keyFilters: ['minMentions', 'dataType', 'specificFramework', 'focus'],
        collapsedFilters: ['specificCompany', 'companySize', 'outcomeGoals', 'aiMetric', 'easeOfCollection']
    }
};

// Step constants for the 3-step progress bar
const STEP = { EXPLORE: 'explore', COMPARE: 'compare', NEXTSTEPS: 'nextsteps' };
let currentStep = STEP.EXPLORE;

// State for Compare step (Step 2)
let compareState = { leftType: 'company', leftValue: 'all', rightType: 'company', rightValue: 'all' };

// Selected metrics shortlist
let clickedMetrics = [];

// Comparisons saved from Step 2 to include in the PDF export
let savedComparisons = [];

// Misc DOM refs
const noMetricsMessage = document.getElementById('no-metrics-message');
const customTooltip = document.getElementById('custom-tooltip');
const customTooltip2 = document.getElementById('custom-tooltip-2');
