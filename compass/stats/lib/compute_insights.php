<?php
// Turns raw log rows into the numbers the views render.
//
// Three counting rules run through everything here, and getting them wrong quietly
// corrupts every widget:
//
//   1. session_end fires on EVERY tab hide with a rising seq, so a session has many
//      such rows. Always take the highest seq per session, and never count these rows
//      as sessions.
//   2. filter_changed re-sends the WHOLE activeFilters object on every interaction, so
//      one visitor re-reports their selected company on each later, unrelated change.
//      Popularity is therefore counted as distinct sessions per value, never as rows.
//   3. Metrics are ranked by id and named at render time — metric_removed carries only
//      an id, and a dataset rename would otherwise split one metric into two rows.

if (!defined('STATS_ENTRY')) {
    http_response_code(403);
    exit;
}

// Events that mean the visitor did something. session_end is excluded because it is
// emitted by the browser on tab switches, not by an action.
const STATS_PASSIVE_EVENTS = ['session_end'];

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Records that $sid showed interest in $key, so the value can be counted per session. */
function stats_note(array &$acc, string $key, string $sid): void {
    if ($key === '' || $key === 'all') return;
    $acc[$key][$sid] = true;
}

/** Turns a {value: {sid: true}} accumulator into a sorted [label, count] list. */
function stats_rank(array $acc, int $limit = 0): array {
    $out = [];
    foreach ($acc as $label => $sids) {
        $out[] = ['label' => (string)$label, 'count' => count($sids)];
    }
    usort($out, function ($a, $b) {
        return $b['count'] <=> $a['count'] ?: strcasecmp($a['label'], $b['label']);
    });
    return $limit > 0 ? array_slice($out, 0, $limit) : $out;
}

function stats_median(array $values): ?float {
    $values = array_values(array_filter($values, function ($v) { return $v !== null; }));
    if (!$values) return null;
    sort($values);
    $n = count($values);
    $mid = intdiv($n, 2);
    return ($n % 2) ? (float)$values[$mid] : ($values[$mid - 1] + $values[$mid]) / 2;
}

function stats_pct(int $part, int $whole): float {
    return $whole > 0 ? round($part * 100 / $whole, 1) : 0.0;
}

/** Human duration from milliseconds: 45s, 3m 12s, 1h 04m. */
function stats_duration(?float $ms): string {
    if ($ms === null) return '—';
    $s = (int)round($ms / 1000);
    if ($s < 60) return $s . 's';
    if ($s < 3600) return floor($s / 60) . 'm ' . str_pad((string)($s % 60), 2, '0', STR_PAD_LEFT) . 's';
    return floor($s / 3600) . 'h ' . str_pad((string)(floor($s / 60) % 60), 2, '0', STR_PAD_LEFT) . 'm';
}

// ─── Session assembly ─────────────────────────────────────────────────────────

/**
 * Groups telemetry rows into sessions, applying the highest-seq rule for session_end
 * and rolling up the per-session facts the sessions list and drill-down need.
 */
function stats_build_sessions(array $events): array {
    $sessions = [];

    foreach ($events as $row) {
        $sid = (string)($row['session_id'] ?? '');
        if ($sid === '') continue;

        if (!isset($sessions[$sid])) {
            $sessions[$sid] = [
                'id'          => $sid,
                'first_ts'    => $row['_ts'],
                'last_ts'     => $row['_ts'],
                'events'      => [],
                'event_count' => 0,   // meaningful events only
                'browser'     => '',
                'ip'          => '',
                'referrer'    => '',
                'viewport'    => '',
                'entry'       => '',
                'from_seo'    => false,
                'seo_page'    => '',
                'role'        => '',
                'max_step'    => 'explore',
                'shortlist'   => 0,
                'total_ms'    => null,
                'active_ms'   => null,
                'end_seq'     => -1,
                'wizard_done' => false,
                'exported'    => false,
                'feedback'    => false,
                'seo_only'    => true,
            ];
        }

        $s     = &$sessions[$sid];
        $event = (string)($row['event'] ?? '');
        $p     = isset($row['payload']) && is_array($row['payload']) ? $row['payload'] : [];

        $s['events'][] = $row;
        $s['last_ts']  = max($s['last_ts'], $row['_ts']);
        $s['first_ts'] = min($s['first_ts'], $row['_ts']);

        if (!in_array($event, STATS_PASSIVE_EVENTS, true)) $s['event_count']++;
        if ($event !== 'seo_page_view' && $event !== 'seo_cta_click') $s['seo_only'] = false;

        if ($s['browser'] === ''  && !empty($row['browser']))         $s['browser']  = (string)$row['browser'];
        if ($s['ip'] === ''       && !empty($row['ip']))              $s['ip']       = (string)$row['ip'];
        if ($s['referrer'] === '' && !empty($row['referrer_domain'])) $s['referrer'] = (string)$row['referrer_domain'];

        switch ($event) {
            case 'page_load':
                if (!empty($p['viewport'])) $s['viewport'] = (string)$p['viewport'];
                if (!empty($p['entry']))    $s['entry']    = (string)$p['entry'];
                if (!empty($p['fromSeo']))  $s['from_seo'] = true;
                if (!empty($p['seoPage']))  $s['seo_page'] = (string)$p['seoPage'];
                if (isset($p['shortlistCount'])) $s['shortlist'] = (int)$p['shortlistCount'];
                break;

            case 'seo_page_view':
                if ($s['viewport'] === '' && !empty($p['viewport'])) $s['viewport'] = (string)$p['viewport'];
                break;

            case 'step_change':
                $order = ['explore' => 0, 'compare' => 1, 'nextsteps' => 2];
                $to    = (string)($p['to'] ?? '');
                if (isset($order[$to]) && $order[$to] > ($order[$s['max_step']] ?? 0)) $s['max_step'] = $to;
                break;

            case 'wizard_completed':
                $s['wizard_done'] = true;
                if (!empty($p['role'])) $s['role'] = (string)$p['role'];
                break;

            case 'wizard_started':
            case 'wizard_step':
            case 'wizard_skipped':
                if ($s['role'] === '' && !empty($p['role'])) $s['role'] = (string)$p['role'];
                break;

            case 'export_pdf':
            case 'export_json':
                $s['exported'] = true;
                break;

            case 'feedback_submitted':
                $s['feedback'] = true;
                break;

            case 'session_end':
                // Rule 1: many rows per session, the highest seq is the real one.
                $seq = (int)($p['seq'] ?? 0);
                if ($seq >= $s['end_seq']) {
                    $s['end_seq']   = $seq;
                    $s['total_ms']  = isset($p['totalMs'])  ? (float)$p['totalMs']  : null;
                    $s['active_ms'] = isset($p['activeMs']) ? (float)$p['activeMs'] : null;
                    if (!empty($p['maxStep'])) {
                        $order = ['explore' => 0, 'compare' => 1, 'nextsteps' => 2];
                        $ms = (string)$p['maxStep'];
                        if (isset($order[$ms]) && $order[$ms] > ($order[$s['max_step']] ?? 0)) $s['max_step'] = $ms;
                    }
                    if (isset($p['shortlistCount'])) $s['shortlist'] = (int)$p['shortlistCount'];
                }
                break;
        }

        if (isset($p['shortlistCount']) && $event !== 'session_end') {
            $s['shortlist'] = max($s['shortlist'], (int)$p['shortlistCount']);
        }
        unset($s);
    }

    uasort($sessions, function ($a, $b) { return $b['first_ts'] <=> $a['first_ts']; });
    return $sessions;
}

// ─── The main aggregation ─────────────────────────────────────────────────────

/**
 * @param array $events    telemetry rows (already timeframe- and exclusion-filtered)
 * @param array $feedback  feedback rows
 * @param array $reports   reported-metric rows
 * @param array $sessions  output of stats_build_sessions()
 */
function stats_compute(array $events, array $feedback, array $reports, array $sessions, string $tz): array {
    $out = [];
    $sessionCount = count($sessions);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    $ips = $durations = $actives = [];
    $bounced = $withEnd = $reachedCompare = $reachedNext = 0;

    foreach ($sessions as $s) {
        if ($s['ip'] !== '') $ips[$s['ip']] = true;
        if ($s['event_count'] <= 1) $bounced++;
        if ($s['end_seq'] >= 0) {
            $withEnd++;
            // Rule 2: a missing session_end means "unknown", never zero — so only
            // sessions that actually reported one contribute to the averages.
            if ($s['total_ms']  !== null) $durations[] = $s['total_ms'];
            if ($s['active_ms'] !== null && $s['event_count'] > 1) $actives[] = $s['active_ms'];
        }
        if ($s['max_step'] === 'compare' || $s['max_step'] === 'nextsteps') $reachedCompare++;
        if ($s['max_step'] === 'nextsteps') $reachedNext++;
    }

    $eventCounts = [];
    foreach ($events as $row) {
        $e = (string)($row['event'] ?? '');
        $eventCounts[$e] = ($eventCounts[$e] ?? 0) + 1;
    }
    $out['event_counts'] = $eventCounts;

    $up   = count(array_filter($feedback, function ($f) { return ($f['rating'] ?? '') === 'up'; }));
    $down = count(array_filter($feedback, function ($f) { return ($f['rating'] ?? '') === 'down'; }));

    $out['kpi'] = [
        'sessions'         => $sessionCount,
        'unique_ips'       => count($ips),
        'events'           => count($events),
        'bounced'          => $bounced,
        'bounce_pct'       => stats_pct($bounced, $sessionCount),
        'median_active'    => stats_median($actives),
        'mean_active'      => $actives ? array_sum($actives) / count($actives) : null,
        'median_total'     => stats_median($durations),
        'duration_coverage'=> stats_pct($withEnd, $sessionCount),
        'reached_compare'  => $reachedCompare,
        'reached_next'     => $reachedNext,
        'exports'          => ($eventCounts['export_pdf'] ?? 0) + ($eventCounts['export_json'] ?? 0),
        'links_copied'     => $eventCounts['shortlist_link_copied'] ?? 0,
        'feedback'         => count($feedback),
        'feedback_up'      => $up,
        'feedback_down'    => $down,
        'reports'          => count($reports),
    ];

    // ── Funnel ────────────────────────────────────────────────────────────────
    $stage = [
        'visited'          => [],
        'wizard_started'   => [],
        'wizard_completed' => [],
        'metric_opened'    => [],
        'metric_added'     => [],
        'compare'          => [],
        'nextsteps'        => [],
        'exported'         => [],
    ];
    foreach ($sessions as $sid => $s) {
        $stage['visited'][$sid] = true;
        if ($s['max_step'] === 'compare' || $s['max_step'] === 'nextsteps') $stage['compare'][$sid] = true;
        if ($s['max_step'] === 'nextsteps') $stage['nextsteps'][$sid] = true;
        if ($s['exported']) $stage['exported'][$sid] = true;
        foreach ($s['events'] as $row) {
            switch ($row['event'] ?? '') {
                case 'wizard_started':   $stage['wizard_started'][$sid] = true; break;
                case 'wizard_completed': $stage['wizard_completed'][$sid] = true; break;
                case 'metric_opened':    $stage['metric_opened'][$sid] = true; break;
                case 'metric_added':     $stage['metric_added'][$sid] = true; break;
            }
        }
    }
    $labels = [
        'visited'          => 'Visited',
        'wizard_started'   => 'Started the wizard',
        'wizard_completed' => 'Completed the wizard',
        'metric_opened'    => 'Opened a metric',
        'metric_added'     => 'Shortlisted a metric',
        'compare'          => 'Reached step 2 (compare)',
        'nextsteps'        => 'Reached step 3 (next steps)',
        'exported'         => 'Exported',
    ];
    $out['funnel'] = [];
    foreach ($labels as $key => $label) {
        $n = count($stage[$key]);
        $out['funnel'][] = [
            'key'     => $key,
            'label'   => $label,
            'count'   => $n,
            'pct'     => stats_pct($n, $sessionCount),
        ];
    }

    // ── Sessions over time ────────────────────────────────────────────────────
    $zone    = new DateTimeZone($tz);
    $buckets = [];
    foreach ($sessions as $s) {
        $d = new DateTime('@' . $s['first_ts']);
        $d->setTimezone($zone);
        $key = $d->format('Y-m-d');
        $buckets[$key] = ($buckets[$key] ?? 0) + 1;
    }
    ksort($buckets);
    $out['timeseries'] = $buckets;

    // ── Entry points, referrers, tech ─────────────────────────────────────────
    $entries = $referrers = $browsers = $viewports = [];
    $fromSeo = 0;
    foreach ($sessions as $sid => $s) {
        $entry = $s['entry'] !== '' ? $s['entry'] : ($s['seo_only'] ? 'library page only' : 'unknown');
        stats_note($entries, $entry, $sid);
        if ($s['referrer'] !== '') stats_note($referrers, $s['referrer'], $sid);
        if ($s['browser'] !== '')  stats_note($browsers, $s['browser'], $sid);
        if ($s['viewport'] !== '') stats_note($viewports, $s['viewport'], $sid);
        if ($s['from_seo']) $fromSeo++;
    }
    $out['entries']   = stats_rank($entries);
    $out['referrers'] = stats_rank($referrers, 12);
    $out['browsers']  = stats_rank($browsers);
    $out['viewports'] = stats_rank($viewports);
    $out['from_seo']  = $fromSeo;

    // ── Per-event accumulators ────────────────────────────────────────────────
    $companies = $frameworks = [];          // value => [source => [sid => true]]
    $metrics   = [];                        // id    => [source => [sid => true]]
    $pairs     = [];                        // key   => ['label'=>, 'sids'=>[]]
    $searchBySession = [];                  // sid   => [[query, resultCount], …]
    $filterUse = $colorBy = $sortUse = $outbound = [];
    $wizardRoles = $wizardAnswers = $abandonScreens = [];
    $roleSkips = [];
    $seoPages = $seoCta = $seoCtaByPos = [];
    $presetApplied = 0; $manualChanges = 0;
    $compareState = [];                     // sid => [leftType, leftValue, rightType, rightValue]

    $noteMulti = function (array &$acc, string $value, string $source, string $sid) {
        if ($value === '' || $value === 'all') return;
        $acc[$value][$source][$sid] = true;
    };

    foreach ($events as $row) {
        $sid   = (string)($row['session_id'] ?? '');
        $event = (string)($row['event'] ?? '');
        $p     = isset($row['payload']) && is_array($row['payload']) ? $row['payload'] : [];
        if ($sid === '') continue;

        switch ($event) {
            case 'predefined_company_loaded':
                $noteMulti($companies, (string)($p['company'] ?? ''), 'preset', $sid);
                break;

            case 'predefined_framework_loaded':
                $noteMulti($frameworks, (string)($p['framework'] ?? ''), 'preset', $sid);
                break;

            case 'filter_changed':
                // Rule 2: this payload repeats the full filter state, so only the
                // distinct session behind it counts, no matter how often it repeats.
                $af = isset($p['activeFilters']) && is_array($p['activeFilters']) ? $p['activeFilters'] : [];
                $noteMulti($companies,  (string)($af['specificCompany'] ?? ''),   'filter', $sid);
                $noteMulti($frameworks, (string)($af['specificFramework'] ?? ''), 'filter', $sid);
                foreach ($af as $dim => $val) {
                    if (in_array($dim, ['specificCompany', 'specificFramework'], true)) continue;
                    foreach ((array)$val as $v) {
                        if ($v === '' || $v === 'all') continue;
                        stats_note($filterUse, $dim . ': ' . $v, $sid);
                    }
                }
                break;

            case 'metric_opened':
                $noteMulti($metrics, (string)($p['metricId'] ?? ''), 'opened', $sid);
                break;

            case 'metric_added':
                $noteMulti($metrics, (string)($p['metricId'] ?? ''), 'added', $sid);
                break;

            case 'export_pdf':
            case 'export_json':
                foreach ((array)($p['metrics'] ?? []) as $m) {
                    if (isset($m['id'])) $noteMulti($metrics, (string)$m['id'], 'exported', $sid);
                }
                break;

            case 'compare_preset_applied':
                $presetApplied++;
                $compareState[$sid] = [
                    (string)($p['leftType'] ?? ''),  (string)($p['leftValue'] ?? ''),
                    (string)($p['rightType'] ?? ''), (string)($p['rightValue'] ?? ''),
                ];
                break;

            case 'compare_dimension_changed':
                $manualChanges++;
                $side = (string)($p['side'] ?? '');
                $type = (string)($p['newType'] ?? ($p['type'] ?? ''));
                $val  = (string)($p['newValue'] ?? '');
                if (!isset($compareState[$sid])) $compareState[$sid] = ['', '', '', ''];
                if ($side === 'left')  { $compareState[$sid][0] = $type; $compareState[$sid][1] = $val; }
                if ($side === 'right') { $compareState[$sid][2] = $type; $compareState[$sid][3] = $val; }
                break;

            case 'compare_sorted':
                stats_note($sortUse, (string)($p['sortDimension'] ?? ''), $sid);
                break;

            case 'colorby_changed':
                stats_note($colorBy, (string)($p['value'] ?? ''), $sid);
                break;

            case 'keyword_search':
                $searchBySession[$sid][] = [
                    'q'   => trim((string)($p['query'] ?? '')),
                    'n'   => isset($p['resultCount']) ? (int)$p['resultCount'] : null,
                ];
                break;

            case 'source_link_clicked':
                $name = (string)($p['sourceName'] ?? '');
                if ($name !== '') stats_note($outbound, $name, $sid);
                if ((string)($p['sourceType'] ?? '') === 'company') {
                    $noteMulti($companies, $name, 'source', $sid);
                }
                break;

            case 'wizard_started':
                if (!empty($p['role'])) stats_note($wizardRoles, (string)$p['role'], $sid);
                if (($p['action'] ?? '') === 'skip' && !empty($p['role'])) stats_note($roleSkips, (string)$p['role'], $sid);
                break;

            case 'wizard_skipped':
                if (!empty($p['role'])) stats_note($roleSkips, (string)$p['role'], $sid);
                break;

            case 'wizard_step':
                $screen = (string)($p['screen'] ?? '');
                $answer = $p['answer'] ?? '';
                if (is_array($answer)) $answer = implode(', ', $answer);
                $answer = (string)$answer;
                if ($screen !== '' && $answer !== '') {
                    $wizardAnswers[$screen][$answer][$sid] = true;
                    if ($screen === 'specificFramework') $noteMulti($frameworks, $answer, 'wizard', $sid);
                }
                break;

            case 'wizard_abandoned':
                stats_note($abandonScreens, (string)($p['screen'] ?? 'unknown'), $sid);
                break;

            case 'seo_page_view':
                $slug = (string)($p['slug'] ?? '');
                stats_note($seoPages, $slug, $sid);
                $type = (string)($p['page_type'] ?? '');
                if ($type === 'company')   $noteMulti($companies, $slug, 'library', $sid);
                if ($type === 'framework') $noteMulti($frameworks, $slug, 'library', $sid);
                break;

            case 'seo_cta_click':
                stats_note($seoCta, (string)($p['slug'] ?? ''), $sid);
                stats_note($seoCtaByPos, (string)($p['position'] ?? 'other'), $sid);
                break;
        }

        // A finished comparison (both sides chosen) counts once per session per pair.
        if (($event === 'compare_preset_applied' || $event === 'compare_dimension_changed') && isset($compareState[$sid])) {
            list($lt, $lv, $rt, $rv) = $compareState[$sid];
            if ($lv !== '' && $rv !== '' && $lv !== 'all' && $rv !== 'all') {
                // Order-normalized so "A vs B" and "B vs A" are one comparison, but the
                // type is kept in the key so a company never merges with a framework of
                // the same name.
                $a = $lt . ':' . $lv;
                $b = $rt . ':' . $rv;
                $ends = [$a, $b];
                sort($ends);
                $key = implode('||', $ends);
                if (!isset($pairs[$key])) {
                    $parts = array_map(function ($e) { return substr($e, strpos($e, ':') + 1); }, $ends);
                    $pairs[$key] = ['label' => $parts[0] . ' vs ' . $parts[1], 'sids' => []];
                }
                $pairs[$key]['sids'][$sid] = true;
            }
        }
    }

    // ── Companies / frameworks / metrics ──────────────────────────────────────
    $rankMulti = function (array $acc, int $limit = 15) {
        $rows = [];
        foreach ($acc as $label => $sources) {
            $all = [];
            $per = [];
            foreach ($sources as $source => $sids) {
                $per[$source] = count($sids);
                foreach ($sids as $sid => $_) $all[$sid] = true;
            }
            $rows[] = ['label' => (string)$label, 'count' => count($all), 'sources' => $per];
        }
        usort($rows, function ($a, $b) {
            return $b['count'] <=> $a['count'] ?: strcasecmp($a['label'], $b['label']);
        });
        return array_slice($rows, 0, $limit);
    };

    $out['top_companies']  = $rankMulti($companies);
    $out['top_frameworks'] = $rankMulti($frameworks);

    $metricRows = $rankMulti($metrics, 20);
    foreach ($metricRows as &$row) {
        $row['id']   = $row['label'];
        $row['name'] = stats_metric_name($row['label']);
        $opened      = $row['sources']['opened'] ?? 0;
        $added       = $row['sources']['added'] ?? 0;
        $row['add_rate'] = $opened > 0 ? round($added * 100 / $opened) : null;
    }
    unset($row);
    $out['top_metrics'] = $metricRows;

    // ── Comparisons ───────────────────────────────────────────────────────────
    $pairRows = [];
    foreach ($pairs as $pair) {
        $pairRows[] = ['label' => $pair['label'], 'count' => count($pair['sids'])];
    }
    usort($pairRows, function ($a, $b) {
        return $b['count'] <=> $a['count'] ?: strcasecmp($a['label'], $b['label']);
    });
    $out['top_pairs']       = array_slice($pairRows, 0, 15);
    $out['preset_applied']  = $presetApplied;
    $out['manual_changes']  = $manualChanges;
    $out['compare_sorts']   = stats_rank($sortUse);
    $out['pdf_comparisons'] = ($eventCounts['comparison_added_to_pdf'] ?? 0) - ($eventCounts['comparison_removed_from_pdf'] ?? 0);

    // ── Searches ──────────────────────────────────────────────────────────────
    // The search box is debounced by only 600ms, so one search usually logs several
    // prefixes of itself ("dev", "devel", "developer"). Collapse a run of growing
    // prefixes within a session down to the longest one, or the ranking becomes a
    // list of fragments.
    $queries = [];
    $zeroResult = [];
    foreach ($searchBySession as $sid => $list) {
        $kept = [];
        foreach ($list as $i => $item) {
            $q = $item['q'];
            if ($q === '') continue;
            $next = $list[$i + 1]['q'] ?? null;
            if ($next !== null && $next !== $q && stripos($next, $q) === 0) continue; // a prefix of what came next
            $kept[] = $item;
        }
        foreach ($kept as $item) {
            $norm = mb_strtolower($item['q']);
            if (!isset($queries[$norm])) {
                $queries[$norm] = ['display' => $item['q'], 'sids' => [], 'results' => []];
            }
            $queries[$norm]['sids'][$sid] = true;
            if ($item['n'] !== null) $queries[$norm]['results'][] = $item['n'];
        }
    }
    $searchRows = [];
    foreach ($queries as $norm => $q) {
        // The same query returns different counts to different people, because each has
        // their own filters active — so this is a mean, and the view labels it as one
        // whenever the underlying numbers actually differed.
        $avg = $q['results'] ? array_sum($q['results']) / count($q['results']) : null;
        $varied = $q['results'] && (min($q['results']) !== max($q['results']));
        $rowData = [
            'label'   => $q['display'],
            'count'   => count($q['sids']),
            'results' => $avg === null ? null : ($varied ? round($avg, 1) : (int)$avg),
            'varied'  => $varied,
        ];
        $searchRows[] = $rowData;
        if ($avg !== null && $avg < 1) $zeroResult[] = $rowData;
    }
    usort($searchRows, function ($a, $b) {
        return $b['count'] <=> $a['count'] ?: strcasecmp($a['label'], $b['label']);
    });
    $out['searches']       = array_slice($searchRows, 0, 20);
    $out['search_total']   = array_sum(array_column($searchRows, 'count'));
    $out['zero_searches']  = $zeroResult;

    // ── Filters, outbound, wizard, SEO ────────────────────────────────────────
    $out['filters']   = stats_rank($filterUse, 15);
    $out['colorby']   = stats_rank($colorBy);
    $out['outbound']  = stats_rank($outbound, 12);
    $out['roles']     = stats_rank($wizardRoles);
    $out['role_skips']= [];
    foreach ($out['roles'] as $r) {
        $skips = isset($roleSkips[$r['label']]) ? count($roleSkips[$r['label']]) : 0;
        $out['role_skips'][$r['label']] = ['skipped' => $skips, 'pct' => stats_pct($skips, $r['count'])];
    }
    $out['wizard_answers'] = [];
    foreach ($wizardAnswers as $screen => $answers) {
        $out['wizard_answers'][$screen] = stats_rank($answers, 5);
    }
    $out['abandon_screens'] = stats_rank($abandonScreens);
    $out['seo_pages']       = stats_rank($seoPages, 12);
    $out['seo_cta']         = stats_rank($seoCta, 12);
    $out['seo_cta_pos']     = stats_rank($seoCtaByPos);
    $out['seo_views']       = array_sum(array_column($out['seo_pages'], 'count'));
    $out['seo_clicks']      = array_sum(array_column($out['seo_cta'], 'count'));

    // ── Feedback ──────────────────────────────────────────────────────────────
    $byDay = $byStep = [];
    $withComment = 0;
    foreach ($feedback as $f) {
        $d = new DateTime('@' . $f['_ts']);
        $d->setTimezone($zone);
        $key = $d->format('Y-m-d');
        if (!isset($byDay[$key])) $byDay[$key] = ['up' => 0, 'down' => 0];
        $byDay[$key][($f['rating'] ?? '') === 'down' ? 'down' : 'up']++;
        if (trim((string)($f['comment'] ?? '')) !== '') $withComment++;
        $step = (string)($f['context']['step'] ?? 'unknown');
        if (!isset($byStep[$step])) $byStep[$step] = ['up' => 0, 'down' => 0];
        $byStep[$step][($f['rating'] ?? '') === 'down' ? 'down' : 'up']++;
    }
    ksort($byDay);
    $out['feedback_by_day']  = $byDay;
    $out['feedback_by_step'] = $byStep;
    $out['feedback_comment_rate'] = stats_pct($withComment, count($feedback));
    $out['feedback_response_rate'] = stats_pct(count($feedback), $sessionCount);

    // ── Reports ───────────────────────────────────────────────────────────────
    $byMode = [];
    foreach ($reports as $r) {
        $mode = (string)($r['mode'] ?? 'unknown');
        $byMode[$mode] = ($byMode[$mode] ?? 0) + 1;
    }
    arsort($byMode);
    $out['reports_by_mode'] = $byMode;

    return $out;
}

// ─── Narrative summary ────────────────────────────────────────────────────────
// The prose block that would otherwise be written by hand after reading the log.
// Deterministic string building — no model, no dependency. Every takeaway must be
// able to cite a number, otherwise it doesn't fire.

function stats_narrative(array $st, string $timeframeLabel): array {
    $k = $st['kpi'];
    $n = $k['sessions'];

    $funnelLines = [];
    foreach ($st['funnel'] as $i => $stage) {
        if ($i === 0) {
            $funnelLines[] = sprintf('100%% %s (%d sessions)', strtolower($stage['label']), $stage['count']);
        } elseif ($stage['count'] > 0) {
            $funnelLines[] = sprintf('%s%% %s', rtrim(rtrim(number_format($stage['pct'], 1), '0'), '.'), strtolower($stage['label']));
        }
    }

    $look = [];
    if ($st['top_metrics']) {
        $parts = [];
        foreach (array_slice($st['top_metrics'], 0, 6) as $m) $parts[] = $m['name'] . ' ' . $m['count'];
        $look['Metrics'] = implode(', ', $parts) . '.';
    }
    if ($st['top_pairs']) {
        $parts = [];
        foreach (array_slice($st['top_pairs'], 0, 5) as $p) $parts[] = $p['label'] . ' ' . $p['count'];
        $ratio = $st['manual_changes'] > 0
            ? sprintf(' %d preset applications vs %d manual dimension changes.', $st['preset_applied'], $st['manual_changes'])
            : sprintf(' %d preset applications, no manual dimension changes at all.', $st['preset_applied']);
        $look['Compare'] = implode(', ', $parts) . '.' . $ratio;
    }
    if ($st['top_companies']) {
        $parts = [];
        foreach (array_slice($st['top_companies'], 0, 5) as $c) $parts[] = $c['label'] . ' ' . $c['count'];
        $look['Companies'] = implode(', ', $parts) . '.';
    }
    if ($st['top_frameworks']) {
        $parts = [];
        foreach (array_slice($st['top_frameworks'], 0, 5) as $f) $parts[] = $f['label'] . ' ' . $f['count'];
        $look['Frameworks'] = implode(', ', $parts) . '.';
    }
    if ($st['search_total'] > 0) {
        $parts = [];
        foreach (array_slice($st['searches'], 0, 5) as $s) $parts[] = '"' . $s['label'] . '" ' . $s['count'];
        $zero = $st['zero_searches'] ? ' Zero results for: ' . implode(', ', array_map(function ($z) {
            return '"' . $z['label'] . '"';
        }, array_slice($st['zero_searches'], 0, 5))) . '.' : '';
        $look['Search'] = $st['search_total'] . ' queries — ' . implode(', ', $parts) . '.' . $zero;
    } else {
        $look['Search'] = 'no searches at all.';
    }
    if ($st['roles']) {
        $parts = [];
        foreach ($st['roles'] as $r) {
            $skip = $st['role_skips'][$r['label']]['pct'] ?? 0;
            $parts[] = $r['label'] . ' ' . $r['count'] . ($skip > 0 ? sprintf(' (%s%% skipped to browsing)', $skip) : '');
        }
        $look['Wizard roles'] = implode(', ', $parts) . '.';
    }
    $look['Feedback'] = $k['feedback'] === 0
        ? 'none.'
        : sprintf('%d submissions, %d up / %d down, %s%% with a comment.',
            $k['feedback'], $k['feedback_up'], $k['feedback_down'], $st['feedback_comment_rate']);

    // ── Takeaways ─────────────────────────────────────────────────────────────
    $takeaways = [];

    // Biggest drop between two adjacent funnel stages.
    $biggest = null;
    for ($i = 1; $i < count($st['funnel']); $i++) {
        $prev = $st['funnel'][$i - 1];
        $cur  = $st['funnel'][$i];
        if ($prev['count'] < 5) continue;
        $drop = $prev['pct'] - $cur['pct'];
        if ($biggest === null || $drop > $biggest['drop']) {
            $biggest = ['drop' => $drop, 'from' => $prev, 'to' => $cur];
        }
    }
    if ($biggest && $biggest['drop'] >= 10) {
        $takeaways[] = sprintf(
            'The biggest drop-off is between "%s" (%s%%) and "%s" (%s%%) — %s points lost at that step.',
            $biggest['from']['label'], $biggest['from']['pct'],
            $biggest['to']['label'], $biggest['to']['pct'],
            round($biggest['drop'], 1)
        );
    }

    if ($n >= 20 && $k['bounce_pct'] >= 40) {
        $takeaways[] = sprintf(
            '%d of %d sessions (%s%%) fire a single event and leave — the catalogue is being read, not used.',
            $k['bounced'], $n, $k['bounce_pct']
        );
    }

    if ($st['seo_views'] > 10 && $st['seo_clicks'] === 0) {
        $takeaways[] = sprintf(
            'The library pages drew %d views but produced no click-throughs into the app at all.',
            $st['seo_views']
        );
    } elseif ($st['seo_views'] > 0) {
        $takeaways[] = sprintf(
            'Library pages: %d views, %d click-throughs (%s%%).',
            $st['seo_views'], $st['seo_clicks'], stats_pct($st['seo_clicks'], $st['seo_views'])
        );
    }

    if ($st['zero_searches']) {
        $takeaways[] = sprintf(
            '%d search term%s returned nothing — the most direct signal of a gap in the catalogue: %s.',
            count($st['zero_searches']),
            count($st['zero_searches']) === 1 ? '' : 's',
            implode(', ', array_map(function ($z) { return '"' . $z['label'] . '"'; }, array_slice($st['zero_searches'], 0, 5)))
        );
    }

    if ($st['preset_applied'] >= 5 && $st['manual_changes'] < $st['preset_applied'] / 2) {
        $takeaways[] = sprintf(
            'Comparisons are almost entirely preset-driven (%d presets vs %d manual changes) — people click what is offered and stop.',
            $st['preset_applied'], $st['manual_changes']
        );
    }

    if ($k['feedback_down'] > 0 && $k['feedback_down'] >= $k['feedback_up']) {
        $takeaways[] = sprintf(
            'Feedback turned negative: %d down vs %d up in this period.',
            $k['feedback_down'], $k['feedback_up']
        );
    }

    if ($k['duration_coverage'] < 60 && $n >= 20) {
        $takeaways[] = sprintf(
            'Only %s%% of sessions reported a session_end, so duration figures cover just over half the traffic — treat them as indicative.',
            $k['duration_coverage']
        );
    }

    return [
        'timeframe' => $timeframeLabel,
        'funnel'    => $funnelLines,
        'bounce'    => sprintf('%d of %d sessions (%s%%) fire exactly one event and leave.', $k['bounced'], $n, $k['bounce_pct']),
        'engaged'   => $k['median_active'] === null
            ? 'No session-length data yet for this period.'
            : sprintf('Median engaged-session length is %s (from %s%% of sessions that reported one).',
                stats_duration($k['median_active']), $k['duration_coverage']),
        'look'      => $look,
        'takeaways' => $takeaways,
    ];
}

/** The same block as Markdown, for pasting into a status update or an issue. */
function stats_narrative_markdown(array $nar): string {
    $md = '## Compass usage — ' . $nar['timeframe'] . "\n\n### Funnel\n";
    foreach ($nar['funnel'] as $line) $md .= '- ' . $line . "\n";
    $md .= "\n" . $nar['bounce'] . ' ' . $nar['engaged'] . "\n\n### What they look at\n";
    foreach ($nar['look'] as $label => $text) $md .= '- **' . $label . ':** ' . $text . "\n";
    if ($nar['takeaways']) {
        $md .= "\n### Takeaways\n";
        foreach ($nar['takeaways'] as $i => $t) $md .= ($i + 1) . '. ' . $t . "\n";
    }
    return $md;
}
