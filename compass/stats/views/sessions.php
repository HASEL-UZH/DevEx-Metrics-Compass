<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

// Filters
$q        = trim((string)($_GET['q'] ?? ''));
$onlyStep = (string)($_GET['step'] ?? '');
$only     = (string)($_GET['only'] ?? '');
$sort     = (string)($_GET['sort'] ?? 'started');
$dir      = ($_GET['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
$page     = max(1, (int)($_GET['p'] ?? 1));
$perPage  = 50;

$rows = [];
foreach ($sessions as $sid => $s) {
    if ($onlyStep === 'compare'   && !in_array($s['max_step'], ['compare', 'nextsteps'], true)) continue;
    if ($onlyStep === 'nextsteps' && $s['max_step'] !== 'nextsteps') continue;
    if ($only === 'feedback' && !$s['feedback']) continue;
    if ($only === 'export'   && !$s['exported']) continue;
    if ($only === 'wizard'   && !$s['wizard_done']) continue;

    if ($q !== '') {
        // Free text matches the session id, or anything the session's payloads mention —
        // which is what makes the "sessions that touched company X" links from the
        // overview work without a second index.
        $haystack = $sid;
        foreach ($s['events'] as $row) {
            $haystack .= ' ' . json_encode($row['payload'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if (stripos($haystack, $q) === false) continue;
    }
    $rows[] = $s;
}

// Every column is sortable; "Started", newest first, is the default.
$STEP_ORDER = ['explore' => 0, 'compare' => 1, 'nextsteps' => 2];
$columns = [
    'session'   => function ($s) { return $s['id']; },
    'started'   => function ($s) { return $s['first_ts']; },
    'active'    => function ($s) { return $s['active_ms']; },   // null = unknown, sorts last
    'events'    => function ($s) { return $s['event_count']; },
    'step'      => function ($s) use ($STEP_ORDER) { return $STEP_ORDER[$s['max_step']] ?? 0; },
    'shortlist' => function ($s) { return $s['shortlist']; },
    'entry'     => function ($s) { return $s['entry']; },
    'browser'   => function ($s) { return $s['browser']; },
    'ip'        => function ($s) { return $s['ip']; },
];
$rows = stats_sort_rows($rows, $columns, $sort, $dir, 'started');

$total = count($rows);
$pages = max(1, (int)ceil($total / $perPage));
$page  = min($page, $pages);
$slice = array_slice($rows, ($page - 1) * $perPage, $perPage);
$excluded = array_flip(stats_excluded_sessions());
?>

<section class="card">
    <div class="card-head">
        <h2>Sessions <span class="muted"><?= (int)$total ?> in <?= e(strtolower($timeframeLabel)) ?></span></h2>
    </div>

    <form class="filters" method="get">
        <input type="hidden" name="view" value="sessions">
        <input type="hidden" name="tf" value="<?= e($timeframe) ?>">
        <?php if ($showExcluded): ?><input type="hidden" name="raw" value="1"><?php endif; ?>

        <input type="search" name="q" value="<?= e($q) ?>" placeholder="Session id, company, metric id…">

        <select name="step">
            <option value="">Any step</option>
            <option value="compare"   <?= $onlyStep === 'compare'   ? 'selected' : '' ?>>Reached step 2</option>
            <option value="nextsteps" <?= $onlyStep === 'nextsteps' ? 'selected' : '' ?>>Reached step 3</option>
        </select>

        <select name="only">
            <option value="">Everyone</option>
            <option value="wizard"   <?= $only === 'wizard'   ? 'selected' : '' ?>>Completed the wizard</option>
            <option value="export"   <?= $only === 'export'   ? 'selected' : '' ?>>Exported</option>
            <option value="feedback" <?= $only === 'feedback' ? 'selected' : '' ?>>Left feedback</option>
        </select>

        <!-- Sorting lives in the column headers; carry it through a filter change. -->
        <input type="hidden" name="sort" value="<?= e($sort) ?>">
        <input type="hidden" name="dir" value="<?= e($dir) ?>">

        <button type="submit">Apply</button>
        <?php if ($q !== '' || $onlyStep !== '' || $only !== ''): ?>
            <a class="clear" href="<?= e(stats_url(['view' => 'sessions', 'q' => null, 'step' => null, 'only' => null, 'p' => null])) ?>">Clear</a>
        <?php endif; ?>
    </form>

    <?php if (!$slice): ?>
        <p class="empty">No sessions match.</p>
    <?php else: ?>
    <div class="tablewrap">
    <table class="sessions">
        <thead>
            <tr>
                <?= stats_sort_header('session',   'Session',   $sort, $dir, 'asc') ?>
                <?= stats_sort_header('started',   'Started',   $sort, $dir) ?>
                <?= stats_sort_header('active',    'Active',    $sort, $dir) ?>
                <?= stats_sort_header('events',    'Events',    $sort, $dir) ?>
                <?= stats_sort_header('step',      'Step',      $sort, $dir) ?>
                <?= stats_sort_header('shortlist', 'Shortlist', $sort, $dir) ?>
                <?= stats_sort_header('entry',     'Entry',     $sort, $dir, 'asc') ?>
                <?= stats_sort_header('browser',   'Browser',   $sort, $dir, 'asc') ?>
                <?= stats_sort_header('ip',        'IP',        $sort, $dir, 'asc') ?>
                <th></th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($slice as $s): ?>
            <tr class="<?= isset($excluded[$s['id']]) ? 'is-excluded' : '' ?>">
                <td><a class="mono" href="<?= e(stats_url(['view' => 'session', 'sid' => $s['id'], 'p' => null])) ?>"><?= e($s['id']) ?></a></td>
                <td><?= e(stats_time($s['first_ts'])) ?></td>
                <td><?= e(stats_duration($s['active_ms'])) ?></td>
                <td><?= (int)$s['event_count'] ?></td>
                <td><?= e($s['max_step']) ?></td>
                <td><?= (int)$s['shortlist'] ?></td>
                <td><?= e($s['entry'] !== '' ? $s['entry'] : ($s['seo_only'] ? 'library only' : '—')) ?></td>
                <td><?= e($s['browser']) ?><?= $s['viewport'] === 'mobile' ? ' · mobile' : '' ?></td>
                <td class="mono muted"><?= e($s['ip']) ?></td>
                <td class="flags">
                    <?php if ($s['wizard_done']): ?><span title="Completed the wizard">W</span><?php endif; ?>
                    <?php if ($s['exported']): ?><span title="Exported">E</span><?php endif; ?>
                    <?php if ($s['feedback']): ?><span title="Left feedback">F</span><?php endif; ?>
                    <form method="post" class="inline">
                        <input type="hidden" name="exclude_session" value="<?= e($s['id']) ?>">
                        <input type="hidden" name="return" value="<?= e(stats_url()) ?>">
                        <input type="hidden" name="csrf" value="<?= e(stats_csrf_token()) ?>">
                        <button type="submit" class="linkish"
                                data-confirm="<?= isset($excluded[$s['id']])
                                    ? 'Include session ' . e($s['id']) . ' in the statistics again?'
                                    : 'Exclude session ' . e($s['id']) . ' from every number in the dashboard? You can undo this at any time.' ?>"
                                title="<?= isset($excluded[$s['id']]) ? 'Include this session again' : 'Exclude this session from all stats' ?>">
                            <?= isset($excluded[$s['id']]) ? 'include' : 'exclude' ?>
                        </button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    </div>

    <?php if ($pages > 1): ?>
        <nav class="pager">
            <?php for ($i = 1; $i <= $pages; $i++): ?>
                <a class="<?= $i === $page ? 'active' : '' ?>" href="<?= e(stats_url(['p' => $i])) ?>"><?= $i ?></a>
            <?php endfor; ?>
        </nav>
    <?php endif; ?>
    <?php endif; ?>

    <p class="card-note">
        "Exclude" removes exactly one session from every number — the precise alternative to
        <code>ignore_ips</code>, which always covers a whole /24. IPs are shown as stored:
        anonymized to their /24.
    </p>
</section>
