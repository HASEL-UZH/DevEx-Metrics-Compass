<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

// The escape hatch: whatever a widget doesn't answer, answer it here.
$rows    = stats_filter_events($telemetry, $_GET);
$sort    = (string)($_GET['sort'] ?? 'time');
$dir     = ($_GET['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
$page    = max(1, (int)($_GET['p'] ?? 1));
$perPage = 200;

// Newest first by default; the other columns are there for scanning one session or
// one event type without setting a filter.
$columns = [
    'time'    => function ($r) { return $r['_ts']; },
    'session' => function ($r) { return (string)($r['session_id'] ?? ''); },
    'event'   => function ($r) { return (string)($r['event'] ?? ''); },
];
$rows = stats_sort_rows($rows, $columns, $sort, $dir, 'time');

$total   = count($rows);
$pages   = max(1, (int)ceil($total / $perPage));
$page    = min($page, $pages);
$slice   = array_slice($rows, ($page - 1) * $perPage, $perPage);

$eventTypes = array_keys($stats['event_counts']);
sort($eventTypes);
?>

<section class="card">
    <div class="card-head">
        <h2>Raw events <span class="muted"><?= (int)$total ?> matching</span></h2>
        <span>
            <a class="linkish" href="<?= e(stats_url(['download' => 'jsonl'])) ?>">Download JSONL</a> ·
            <a class="linkish" href="<?= e(stats_url(['download' => 'csv'])) ?>">Download CSV</a>
        </span>
    </div>

    <form class="filters" method="get">
        <input type="hidden" name="view" value="events">
        <input type="hidden" name="tf" value="<?= e($timeframe) ?>">
        <select name="event">
            <option value="">Any event</option>
            <?php foreach ($eventTypes as $type): ?>
                <option value="<?= e($type) ?>" <?= ($_GET['event'] ?? '') === $type ? 'selected' : '' ?>>
                    <?= e($type) ?> (<?= (int)$stats['event_counts'][$type] ?>)
                </option>
            <?php endforeach; ?>
        </select>
        <input type="search" name="sid" value="<?= e($_GET['sid'] ?? '') ?>" placeholder="Session id">
        <input type="search" name="q"   value="<?= e($_GET['q'] ?? '') ?>" placeholder="Anything in the line">
        <input type="hidden" name="sort" value="<?= e($sort) ?>">
        <input type="hidden" name="dir"  value="<?= e($dir) ?>">
        <button type="submit">Apply</button>
        <a class="clear" href="<?= e(stats_url(['view' => 'events', 'event' => null, 'sid' => null, 'q' => null, 'p' => null])) ?>">Clear</a>
    </form>

    <?php if (!$slice): ?>
        <p class="empty">Nothing matches.</p>
    <?php else: ?>
        <div class="tablewrap">
        <table class="events">
            <thead><tr>
                <?= stats_sort_header('time',    'Time',    $sort, $dir) ?>
                <?= stats_sort_header('session', 'Session', $sort, $dir, 'asc') ?>
                <?= stats_sort_header('event',   'Event',   $sort, $dir, 'asc') ?>
                <th>Payload</th>
            </tr></thead>
            <tbody>
            <?php foreach ($slice as $row): ?>
                <tr>
                    <td class="nowrap"><?= e(stats_time($row['_ts'], 'Y-m-d H:i:s')) ?></td>
                    <td><a class="mono" href="<?= e(stats_url(['view' => 'session', 'sid' => $row['session_id'] ?? '', 'p' => null])) ?>"><?= e($row['session_id'] ?? '') ?></a></td>
                    <td><span class="badge"><?= e($row['event'] ?? '') ?></span></td>
                    <td><code class="payload"><?= e(json_encode($row['payload'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></code></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        </div>

        <?php if ($pages > 1): ?>
            <nav class="pager">
                <?php for ($i = 1; $i <= min($pages, 40); $i++): ?>
                    <a class="<?= $i === $page ? 'active' : '' ?>" href="<?= e(stats_url(['p' => $i])) ?>"><?= $i ?></a>
                <?php endfor; ?>
            </nav>
        <?php endif; ?>
    <?php endif; ?>

    <p class="card-note">
        Downloads cover the telemetry stream only — the reported-metrics log contains email
        addresses and is not exportable from here.
    </p>
</section>
