<?php if (!defined('STATS_ENTRY')) { http_response_code(403); exit; } ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>DevEx Compass Stats · <?= e($title) ?></title>
<link rel="icon" type="image/png" href="../assets/favicon.png">
<link rel="stylesheet" href="assets/stats.css">
<!-- Charts are dashboard-only: the Compass itself gains no new dependency.
     Pinned to an exact version with the SRI hash cdnjs publishes for that file. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        integrity="sha512-CQBWl4fJHWbryGE+Pc7UAxWMUMNMWzWxF4SQo9CgkJIN1kx6djDQZjh3Y8SZ1d+6I+1zze6Z7kHXO7q3UyZAWw=="
        crossorigin="anonymous" referrerpolicy="no-referrer"></script>
</head>
<body>

<header class="topbar">
    <div class="topbar-inner">
        <a class="brand" href="<?= e(stats_url(['view' => 'overview', 'sid' => null])) ?>">
            <img src="../assets/favicon.png" alt="" width="20" height="20">
            DevEx Compass <span>Stats</span>
        </a>
        <nav class="tabs">
            <?php foreach (['overview' => 'Overview', 'sessions' => 'Sessions', 'feedback' => 'Feedback', 'reports' => 'Reports', 'events' => 'Raw events'] as $key => $label): ?>
                <a class="<?= ($view === $key || ($view === 'session' && $key === 'sessions')) ? 'active' : '' ?>"
                   href="<?= e(stats_url(['view' => $key, 'sid' => null, 'p' => null])) ?>"><?= e($label) ?></a>
            <?php endforeach; ?>
        </nav>
        <a class="logout" href="<?= e(stats_url(['view' => 'logout'])) ?>">Sign out</a>
    </div>
    <div class="timeframes">
        <?php foreach (STATS_TIMEFRAMES as $key => $label): ?>
            <a class="pill <?= $timeframe === $key ? 'active' : '' ?>"
               href="<?= e(stats_url(['tf' => $key])) ?>"><?= e($label) ?></a>
        <?php endforeach; ?>
        <span class="spacer"></span>
        <?php $exCount = count($excludedByIp) + count($excludedByHand); ?>
        <?php if ($exCount > 0 || $showExcluded): ?>
            <a class="pill subtle <?= $showExcluded ? 'active' : '' ?>" href="<?= e(stats_url(['raw' => $showExcluded ? null : 1])) ?>">
                <?php if ($showExcluded): ?>
                    Showing own traffic — hide it
                <?php else: ?>
                    <?= (int)count($excludedByIp) ?> excluded by IP, <?= (int)count($excludedByHand) ?> by hand — show
                <?php endif; ?>
            </a>
        <?php endif; ?>
    </div>
</header>

<main class="wrap">

<?php if ($ignoreErrors): ?>
    <div class="notice warn">
        <strong>ignore_ips needs attention.</strong>
        <ul><?php foreach ($ignoreErrors as $err): ?><li><?= e($err) ?></li><?php endforeach; ?></ul>
    </div>
<?php endif; ?>

<?php if (!stats_cache_writable()): ?>
    <div class="notice">
        <strong>stats/cache/ is not writable.</strong> Everything still works, but aggregates are recomputed
        on every request, and "exclude this session" / "mark as handled" cannot be saved.
    </div>
<?php endif; ?>

<?php if (!$telemetry && !$feedback && !$reports): ?>
    <div class="notice">
        <strong>No data in this timeframe.</strong>
        The dashboard reads <code>compass/api/logs/*.log</code>, which only exist on the web server —
        locally you will see this unless you copy a log file down or seed a synthetic one.
    </div>
<?php endif; ?>

<?php include __DIR__ . '/' . $view . '.php'; ?>

</main>

<footer class="foot">
    Reading <code><?= e(basename(stats_log_dir())) ?>/</code> ·
    Times shown in <?= e($displayTz) ?> · Logs are stored in UTC ·
    <?= (int)count($telemetry) ?> events, <?= (int)count($sessions) ?> sessions in view
</footer>

<script src="assets/stats.js"></script>
</body>
</html>
