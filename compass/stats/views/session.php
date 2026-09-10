<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

$sid = (string)($_GET['sid'] ?? '');
$s   = $sessions[$sid] ?? null;

if (!$s) {
    echo '<section class="card"><h2>Session not found</h2><p class="empty">'
       . 'No session <code>' . e($sid) . '</code> in this timeframe — try "All time".</p>'
       . '<a class="more" href="' . e(stats_url(['view' => 'sessions', 'sid' => null])) . '">← Back to sessions</a></section>';
    return;
}

$rebuilt = stats_rebuild_state($s['events']);
$link    = stats_compass_url($rebuilt['params']);

// A visitor can arrive with state already in the URL (a shared shortlist, a comparison,
// a metric link). page_load records only the *kind* of entry and the shortlist size —
// never the URL itself — so those ids cannot be recovered from the log. Say so instead
// of claiming the session did nothing.
$arrivedWithState = ($s['entry'] !== '' && $s['entry'] !== 'direct') || $s['shortlist'] > 0;
$shortlistUnknown = $s['shortlist'] > 0
    && !isset($rebuilt['params']['shortlist_current'])
    && !isset($rebuilt['params']['shortlist_planned']);

// Feedback and reports can't be joined by session id (the endpoints don't store one),
// so fall back to same-anonymized-IP within the session's own time window. That is a
// heuristic, and labelled as one.
$nearby = [];
foreach ($feedback as $f) {
    if (($f['ip'] ?? '') !== '' && $f['ip'] === $s['ip']
        && $f['_ts'] >= $s['first_ts'] - 60 && $f['_ts'] <= $s['last_ts'] + 300) {
        $nearby[] = $f;
    }
}

/** One-line human summary of an event, so the timeline reads without opening payloads. */
function stats_event_summary(string $event, array $p): string {
    switch ($event) {
        case 'page_load':      return 'entry: ' . ($p['entry'] ?? '?') . ', ' . ($p['viewport'] ?? '?')
                                    . (!empty($p['seoPage']) ? ', from ' . $p['seoPage'] : '');
        case 'step_change':    return ($p['from'] ?? '?') . ' → ' . ($p['to'] ?? '?');
        case 'metric_opened':  return $p['metricName'] ?? stats_metric_name($p['metricId'] ?? '');
        case 'metric_added':   return stats_metric_name($p['metricId'] ?? '') . ' as ' . ($p['status'] ?? '?');
        case 'metric_removed': return stats_metric_name($p['metricId'] ?? '');
        case 'metric_status_changed': return stats_metric_name($p['metricId'] ?? '') . ' → ' . ($p['newStatus'] ?? '?');
        case 'keyword_search': return '"' . ($p['query'] ?? '') . '" → ' . ($p['resultCount'] ?? '?') . ' results';
        case 'filter_changed': {
            $af = (array)($p['activeFilters'] ?? []);
            $parts = [];
            foreach ($af as $key => $val) {
                $val = is_array($val) ? implode('/', $val) : $val;
                if ($val === '' || $val === 'all' || $val === []) continue;
                $parts[] = $key . '=' . $val;
            }
            return ($parts ? implode(', ', $parts) : 'no filters') . ' → ' . ($p['resultCount'] ?? '?') . ' metrics';
        }
        case 'compare_preset_applied':    return ($p['leftValue'] ?? '?') . ' vs ' . ($p['rightValue'] ?? '?');
        case 'compare_dimension_changed': return ($p['side'] ?? '?') . ' → ' . ($p['newValue'] ?? '?');
        case 'compare_sorted':   return 'by ' . ($p['sortDimension'] ?? '?');
        case 'wizard_started':   return ($p['role'] ?? '?') . (!empty($p['action']) ? ' (' . $p['action'] . ')' : '');
        case 'wizard_step':      return ($p['screen'] ?? '?') . ': ' . (is_array($p['answer'] ?? '') ? implode(', ', $p['answer']) : ($p['answer'] ?? ''));
        case 'wizard_completed': return 'role ' . ($p['role'] ?? '?');
        case 'wizard_abandoned': return 'on ' . ($p['screen'] ?? '?') . ' after ' . ($p['answeredCount'] ?? 0) . ' answers';
        case 'export_pdf':
        case 'export_json':      return ($p['shortlistCount'] ?? 0) . ' metrics';
        case 'feedback_submitted': return ($p['rating'] ?? '?') . ($p['hasComment'] ? ' with comment' : '');
        case 'source_link_clicked': return ($p['sourceName'] ?? '?') . ' (' . ($p['context'] ?? '?') . ')';
        case 'seo_page_view':    return ($p['slug'] ?? '?') . ' · ' . ($p['page_type'] ?? '?');
        case 'seo_cta_click':    return ($p['position'] ?? '?') . ' → ' . ($p['href'] ?? '');
        case 'session_end':      return 'seq ' . ($p['seq'] ?? 0) . ' · total ' . stats_duration($p['totalMs'] ?? null)
                                    . ' · active ' . stats_duration($p['activeMs'] ?? null);
        case 'overlay_opened':   return $p['overlay'] ?? '?';
        case 'predefined_company_loaded':   return ($p['company'] ?? '?') . ' (' . ($p['metricCount'] ?? 0) . ' metrics)';
        case 'predefined_framework_loaded': return ($p['framework'] ?? '?') . ' (' . ($p['metricCount'] ?? 0) . ' metrics)';
        default: return '';
    }
}
?>

<a class="more" href="<?= e(stats_url(['view' => 'sessions', 'sid' => null])) ?>">← Back to sessions</a>

<section class="card">
    <div class="card-head">
        <h2>Session <span class="mono"><?= e($s['id']) ?></span></h2>
        <form method="post" class="inline">
            <input type="hidden" name="exclude_session" value="<?= e($s['id']) ?>">
            <input type="hidden" name="return" value="<?= e(stats_url()) ?>">
            <input type="hidden" name="csrf" value="<?= e(stats_csrf_token()) ?>">
            <?php $isExcluded = in_array($s['id'], stats_excluded_sessions(), true); ?>
            <button type="submit" class="linkish"
                    data-confirm="<?= $isExcluded
                        ? 'Include this session in the statistics again?'
                        : 'Exclude this session from every number in the dashboard? You can undo this at any time.' ?>">
                <?= $isExcluded ? 'Include in stats again' : 'Exclude from stats' ?>
            </button>
        </form>
    </div>

    <dl class="facts">
        <dt>Started</dt><dd><?= e(stats_time($s['first_ts'], 'Y-m-d H:i:s')) ?></dd>
        <dt>Last event</dt><dd><?= e(stats_time($s['last_ts'], 'H:i:s')) ?></dd>
        <dt>Total / active</dt><dd><?= e(stats_duration($s['total_ms'])) ?> / <?= e(stats_duration($s['active_ms'])) ?>
            <?php if ($s['end_seq'] < 0): ?><span class="muted">(no session_end — duration unknown)</span><?php endif; ?></dd>
        <dt>Events</dt><dd><?= (int)$s['event_count'] ?></dd>
        <dt>Furthest step</dt><dd><?= e($s['max_step']) ?></dd>
        <dt>Entry</dt><dd><?= e($s['entry'] !== '' ? $s['entry'] : '—') ?><?= $s['from_seo'] ? ' · from ' . e($s['seo_page']) : '' ?></dd>
        <dt>Browser</dt><dd><?= e($s['browser']) ?> · <?= e($s['viewport'] ?: 'unknown viewport') ?></dd>
        <dt>Referrer</dt><dd><?= e($s['referrer'] !== '' ? $s['referrer'] : 'none') ?></dd>
        <dt>IP</dt><dd class="mono"><?= e($s['ip']) ?> <span class="muted">(anonymized /24)</span></dd>
    </dl>
</section>

<section class="card">
    <h2>Reopen this session in the Compass</h2>
    <p class="card-note">
        Rebuilt by replaying the session's events against the URL grammar in
        <code>js/url-state.js</code>: filters, compare pair, sorting, open metric and shortlist.
        <?php foreach ($rebuilt['notes'] as $note): ?><br><?= e($note) ?><?php endforeach; ?>
    </p>
    <?php if ($shortlistUnknown): ?>
        <p class="notice warn inline-notice">
            This visitor <strong>arrived with <?= (int)$s['shortlist'] ?> metrics already on their
            shortlist</strong><?= $s['entry'] !== '' ? ' (entry: ' . e($s['entry']) . ')' : '' ?>, but
            those came in on the link they followed, and the incoming URL is not logged —
            <code>page_load</code> records only the entry type and the shortlist size. The metric ids
            are therefore not recoverable, so the link below (if any) leaves the shortlist out.
        </p>
    <?php endif; ?>

    <?php if ($rebuilt['params']): ?>
        <p><a class="button" href="<?= e($link) ?>" target="_blank" rel="noopener">Open the Compass in this state →</a></p>
        <div class="linkbox">
            <input type="text" readonly value="<?= e($link) ?>" id="deeplink">
            <button type="button" class="copy-text" data-target="deeplink">Copy</button>
        </div>
        <ul class="chips">
            <?php foreach ($rebuilt['params'] as $key => $val): ?>
                <li><?= e($key) ?> <strong><?= e($val) ?></strong></li>
            <?php endforeach; ?>
        </ul>
    <?php elseif ($arrivedWithState): ?>
        <p class="empty">
            Nothing to rebuild: this visitor arrived on a link that already carried state
            <?= $s['entry'] !== '' ? '(entry: <code>' . e($s['entry']) . '</code>)' : '' ?>
            and then did nothing the app logs — so the only state this session had is the part
            that lives in the URL the log never sees.
            <a href="<?= e(stats_compass_base()) ?>" target="_blank" rel="noopener">Open the Compass</a>.
        </p>
    <?php else: ?>
        <p class="empty">This session never changed anything worth putting in a URL — it would just
        be the homepage. <a href="<?= e(stats_compass_base()) ?>" target="_blank" rel="noopener">Open the Compass</a>.</p>
    <?php endif; ?>
</section>

<?php if ($nearby): ?>
<section class="card">
    <h2>Feedback from this visitor</h2>
    <p class="card-note">Matched by anonymized IP and time, not by session id — the feedback endpoint
    does not store one, so this is a likely match rather than a certain one.</p>
    <ul class="comments">
        <?php foreach ($nearby as $f): ?>
            <li>
                <span class="rating <?= ($f['rating'] ?? '') === 'down' ? 'down' : 'up' ?>"><?= ($f['rating'] ?? '') === 'down' ? '&#128078;' : '&#128077;' ?></span>
                <span class="text"><?= e($f['comment'] !== '' ? $f['comment'] : '(no comment)') ?></span>
                <span class="meta"><?= e(stats_time($f['_ts'], 'H:i:s')) ?></span>
            </li>
        <?php endforeach; ?>
    </ul>
</section>
<?php endif; ?>

<section class="card">
    <h2>Timeline</h2>
    <ol class="timeline">
        <?php $prevTs = null; foreach ($s['events'] as $row):
            $p = (array)($row['payload'] ?? []);
            $delta = $prevTs === null ? '' : '+' . ($row['_ts'] - $prevTs) . 's';
            $prevTs = $row['_ts'];
            $summary = stats_event_summary((string)$row['event'], $p); ?>
            <li>
                <span class="ts"><?= e(stats_time($row['_ts'], 'H:i:s')) ?></span>
                <span class="delta"><?= e($delta) ?></span>
                <span class="badge"><?= e($row['event']) ?></span>
                <span class="summary"><?= e($summary) ?></span>
                <?php if ($p): ?>
                    <details><summary>payload</summary><pre><?= e(json_encode($p, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) ?></pre></details>
                <?php endif; ?>
            </li>
        <?php endforeach; ?>
    </ol>
</section>
