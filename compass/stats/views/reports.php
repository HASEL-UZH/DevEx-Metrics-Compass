<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

$mode        = (string)($_GET['mode'] ?? '');
$showHandled = !empty($_GET['handled']);
$handled     = stats_handled_reports();

$rows = array_reverse($reports);
if ($mode !== '') {
    $rows = array_values(array_filter($rows, function ($r) use ($mode) { return ($r['mode'] ?? '') === $mode; }));
}
if (!$showHandled) {
    $rows = array_values(array_filter($rows, function ($r) use ($handled) {
        return !in_array(stats_report_key($r), $handled, true);
    }));
}
$openCount = 0;
foreach ($reports as $r) if (!in_array(stats_report_key($r), $handled, true)) $openCount++;
?>

<section class="card toolbar-card">
    <div class="card-head">
        <h2>Reported metrics <span class="muted"><?= (int)$openCount ?> open of <?= count($reports) ?></span></h2>
    </div>

    <?php if ($stats['reports_by_mode']): ?>
        <ul class="chips">
            <?php foreach ($stats['reports_by_mode'] as $m => $count): ?>
                <li><?= e(str_replace('_', ' ', $m)) ?> <strong><?= (int)$count ?></strong></li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>

    <form class="filters" method="get">
        <input type="hidden" name="view" value="reports">
        <input type="hidden" name="tf" value="<?= e($timeframe) ?>">
        <select name="mode">
            <option value="">All kinds</option>
            <?php foreach (['missing_metric', 'wrong_metric', 'missing_research', 'missing_company'] as $m): ?>
                <option value="<?= e($m) ?>" <?= $mode === $m ? 'selected' : '' ?>><?= e(str_replace('_', ' ', $m)) ?></option>
            <?php endforeach; ?>
        </select>
        <label class="check"><input type="checkbox" name="handled" value="1" <?= $showHandled ? 'checked' : '' ?>> Include handled</label>
        <button type="submit">Apply</button>
    </form>
</section>

<?php if (!$rows): ?>
    <section class="card"><p class="empty">
        <?= $openCount === 0 && $reports ? 'Everything in this period has been handled.' : 'Nothing reported in this period.' ?>
    </p></section>
<?php else: ?>
    <div class="report-list">
    <?php foreach ($rows as $r):
        $key = stats_report_key($r);
        $isHandled = in_array($key, $handled, true); ?>
        <section class="card report-card <?= $isHandled ? 'is-handled' : '' ?>">
            <div class="card-head">
                <h2><?= e($r['metricName'] ?? '(no name given)') ?></h2>
                <form method="post" class="inline">
                    <input type="hidden" name="handle_report" value="<?= e($key) ?>">
                    <input type="hidden" name="return" value="<?= e(stats_url()) ?>">
                    <input type="hidden" name="csrf" value="<?= e(stats_csrf_token()) ?>">
                    <button type="submit" class="linkish"><?= $isHandled ? 'Mark as open' : 'Mark as handled' ?></button>
                </form>
            </div>
            <ul class="chips">
                <li><?= e(str_replace('_', ' ', $r['mode'] ?? 'unknown')) ?></li>
                <li><?= e(stats_time($r['_ts'], 'Y-m-d H:i')) ?></li>
                <?php if (!empty($r['email'])): ?>
                    <li><a href="mailto:<?= e($r['email']) ?>"><?= e($r['email']) ?></a></li>
                <?php endif; ?>
            </ul>
            <?php if (!empty($r['description'])): ?><p><?= nl2br(e($r['description'])) ?></p><?php endif; ?>
            <?php if (!empty($r['source'])): ?>
                <p class="card-note">Source: <?= e($r['source']) ?></p>
            <?php endif; ?>
        </section>
    <?php endforeach; ?>
    </div>
<?php endif; ?>
