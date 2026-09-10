<?php
// Rebuilds a Compass URL from what a session did, so a logged visit can be reopened
// exactly as the visitor left it.
//
// The parameter grammar mirrors serializeStateToParams() / restoreStateFromUrl() in
// compass/js/url-state.js — when that file's params change, this one has to follow.

if (!defined('STATS_ENTRY')) {
    http_response_code(403);
    exit;
}

// Mirrors url-state.js: multi-value filters travel as comma-separated lists.
const STATS_LIST_FILTERS   = ['aiMetric', 'outcomeGoals', 'easeOfCollection', 'companySize'];
const STATS_SCALAR_FILTERS = ['dataType', 'focus', 'minMentions', 'specificCompany', 'specificFramework'];

/**
 * Replays a session's events in order and returns the final Compass state as URL params.
 *
 * @param array $events The session's telemetry rows, chronologically.
 * @return array{params: array, notes: array} Params in url-state.js order, plus what was inferred.
 */
function stats_rebuild_state(array $events): array {
    $params = [];
    $notes  = [];
    $shortlist = [];   // id => status
    $step = 'explore';

    foreach ($events as $row) {
        $event = (string)($row['event'] ?? '');
        $p     = isset($row['payload']) && is_array($row['payload']) ? $row['payload'] : [];

        switch ($event) {
            case 'step_change':
                if (!empty($p['to'])) $step = (string)$p['to'];
                break;

            case 'wizard_completed':
            case 'wizard_started':
            case 'wizard_step':
                if (!empty($p['role'])) $params['role'] = (string)$p['role'];
                break;

            case 'filter_changed':
                // The payload carries the entire filter state, so the last one wins outright.
                $af = isset($p['activeFilters']) && is_array($p['activeFilters']) ? $p['activeFilters'] : [];
                foreach (STATS_SCALAR_FILTERS as $key) {
                    $val = (string)($af[$key] ?? 'all');
                    if ($val !== '' && $val !== 'all') { $params[$key] = $val; } else { unset($params[$key]); }
                }
                foreach (STATS_LIST_FILTERS as $key) {
                    $val = (array)($af[$key] ?? []);
                    if ($val) { $params[$key] = implode(',', $val); } else { unset($params[$key]); }
                }
                break;

            case 'filters_cleared':
                foreach (array_merge(STATS_SCALAR_FILTERS, STATS_LIST_FILTERS) as $key) unset($params[$key]);
                unset($params['q']);
                break;

            case 'keyword_search':
                $q = trim((string)($p['query'] ?? ''));
                if ($q !== '') $params['q'] = $q;
                break;

            case 'metric_opened':
                if (isset($p['metricId'])) $params['specificMetric'] = (string)$p['metricId'];
                break;

            case 'compare_preset_applied':
                if (!empty($p['leftValue']))  { $params['leftType']  = (string)($p['leftType'] ?? '');  $params['leftValue']  = (string)$p['leftValue']; }
                if (!empty($p['rightValue'])) { $params['rightType'] = (string)($p['rightType'] ?? ''); $params['rightValue'] = (string)$p['rightValue']; }
                break;

            case 'compare_dimension_changed':
                $side = (string)($p['side'] ?? '');
                $type = (string)($p['newType'] ?? ($p['type'] ?? ''));
                $val  = (string)($p['newValue'] ?? '');
                if ($side === 'left'  && $val !== '') { $params['leftType']  = $type; $params['leftValue']  = $val; }
                if ($side === 'right' && $val !== '') { $params['rightType'] = $type; $params['rightValue'] = $val; }
                break;

            case 'compare_sorted':
                $sort = (string)($p['sortDimension'] ?? '');
                if ($sort !== '' && $sort !== 'category') $params['sort'] = $sort;
                break;

            // ── Shortlist replay ──────────────────────────────────────────────
            case 'metric_added':
                if (isset($p['metricId'])) {
                    $shortlist[(string)$p['metricId']] = (string)($p['status'] ?? 'capturing');
                }
                break;

            case 'metric_status_changed':
                if (isset($p['metricId'])) {
                    $shortlist[(string)$p['metricId']] = (string)($p['newStatus'] ?? 'capturing');
                }
                break;

            case 'metric_removed':
                if (isset($p['metricId'])) unset($shortlist[(string)$p['metricId']]);
                break;

            case 'shortlist_cleared':
                $shortlist = [];
                break;

            case 'export_pdf':
            case 'export_json':
                // The export payload is authoritative: it lists the shortlist as it stood
                // at that moment, so prefer it over the incremental replay.
                $metrics = (array)($p['metrics'] ?? []);
                if ($metrics) {
                    $shortlist = [];
                    foreach ($metrics as $m) {
                        if (isset($m['id'])) $shortlist[(string)$m['id']] = (string)($m['status'] ?? 'capturing');
                    }
                    $notes[] = 'Shortlist taken from the export payload (authoritative).';
                }
                break;
        }
    }

    if ($step !== 'explore') $params['step'] = $step;

    $current = $planned = [];
    foreach ($shortlist as $id => $status) {
        if ($status === 'planning') { $planned[] = $id; } else { $current[] = $id; }
    }
    if ($current) $params['shortlist_current'] = implode(',', $current);
    if ($planned) $params['shortlist_planned'] = implode(',', $planned);

    // Match url-state.js's own ordering so the rebuilt link reads like one the app wrote.
    $order = ['step', 'role', 'dataType', 'focus', 'minMentions', 'specificCompany', 'specificFramework',
              'aiMetric', 'outcomeGoals', 'easeOfCollection', 'companySize', 'q',
              'leftType', 'leftValue', 'rightType', 'rightValue', 'sort', 'specificMetric',
              'shortlist_current', 'shortlist_planned'];
    $ordered = [];
    foreach ($order as $key) {
        if (isset($params[$key]) && $params[$key] !== '') $ordered[$key] = $params[$key];
    }

    return ['params' => $ordered, 'notes' => $notes];
}

/**
 * Builds the state a feedback submission was given in. Feedback lines carry only a
 * context object, not an event history, so this is a much smaller reconstruction.
 */
function stats_rebuild_from_context(array $context): array {
    $params = [];

    $step = (string)($context['step'] ?? '');
    if ($step !== '' && $step !== 'explore') $params['step'] = $step;

    $af = isset($context['activeFilters']) && is_array($context['activeFilters']) ? $context['activeFilters'] : [];
    foreach (STATS_SCALAR_FILTERS as $key) {
        $val = (string)($af[$key] ?? 'all');
        if ($val !== '' && $val !== 'all') $params[$key] = $val;
    }
    foreach (STATS_LIST_FILTERS as $key) {
        $val = (array)($af[$key] ?? []);
        if ($val) $params[$key] = implode(',', $val);
    }

    $cmp = isset($context['comparison']) && is_array($context['comparison']) ? $context['comparison'] : [];
    foreach (['leftType', 'leftValue', 'rightType', 'rightValue'] as $key) {
        if (!empty($cmp[$key]) && $cmp[$key] !== 'all') $params[$key] = (string)$cmp[$key];
    }
    if (!empty($context['groupBy']) && $context['groupBy'] !== 'category') $params['sort'] = (string)$context['groupBy'];

    return $params;
}

/**
 * Absolute URL into the Compass. Commas stay literal, exactly as readableQueryString()
 * in url-state.js writes them, so a rebuilt link looks like one the app itself produced.
 */
function stats_compass_url(array $params): string {
    if (!$params) return stats_compass_base();
    $qs = str_replace('%2C', ',', http_build_query($params, '', '&', PHP_QUERY_RFC3986));
    return stats_compass_base() . '?' . $qs;
}

/** The app's own URL, derived from where the dashboard is running (…/stats/ → …/). */
function stats_compass_base(): string {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $path   = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/stats/index.php'), '/\\');
    $path   = preg_replace('#/stats$#', '', $path);
    return $scheme . '://' . $host . ($path === '' ? '/' : $path . '/');
}
