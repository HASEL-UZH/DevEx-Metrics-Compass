<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

$k = $stats['kpi'];

/**
 * An "i" next to a heading whose explanation appears on hover or keyboard focus —
 * keeps the definition one gesture away without spending three lines of the card on it.
 */
function stats_info(string $text): void {
    echo '<span class="info-wrap">'
       . '<button type="button" class="info" aria-label="What this means">i</button>'
       . '<span class="tip" role="tooltip">' . e($text) . '</span>'
       . '</span>';
}

/** A ranked list with a proportional bar, optionally linking each row somewhere. */
function stats_ranklist(array $rows, array $opts = []): void {
    $max = 0;
    foreach ($rows as $r) $max = max($max, $r['count']);
    if (!$rows) { echo '<p class="empty">' . e($opts['empty'] ?? 'Nothing yet.') . '</p>'; return; }

    $limit = $opts['limit'] ?? 8;
    // "compact" drops the proportional bar and tightens the rows, for lists where the
    // values matter more than their relative size.
    $classes = 'ranklist' . (!empty($opts['compact']) ? ' compact' : '') . (count($rows) > $limit ? ' collapsible' : '');
    echo '<ol class="' . $classes . '">';
    foreach ($rows as $i => $r) {
        $hidden = $i >= $limit ? ' class="extra" hidden' : '';
        echo '<li' . $hidden . '>';
        echo '<span class="bar" style="width:' . ($max ? round($r['count'] * 100 / $max) : 0) . '%"></span>';
        $label = e($r['name'] ?? $r['label']);
        if (!empty($opts['link'])) {
            echo '<a class="label" href="' . e($opts['link']($r)) . '">' . $label . '</a>';
        } else {
            echo '<span class="label">' . $label . '</span>';
        }
        echo '<span class="count">' . (int)$r['count'] . '</span>';

        // One meta line, not several spans: as separate flex items they refused to
        // shrink and squeezed the label down to one character per line.
        $meta = [];
        if (isset($r['results']) && $r['results'] !== null) {
            // Averaged across the sessions that ran the query, since each had its own
            // filters active — say "avg" whenever those counts actually differed.
            $meta[] = (!empty($r['varied']) ? 'avg ' : '') . e($r['results']) . ' results';
        }
        if (!empty($r['sources'])) {
            // Fixed order, so the same columns appear in the same place on every row.
            $order = ['opened', 'added', 'exported', 'deeplink', 'preset', 'filter', 'library', 'wizard', 'source'];
            uksort($r['sources'], function ($a, $b) use ($order) {
                $ia = array_search($a, $order, true);
                $ib = array_search($b, $order, true);
                return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
            });
            $parts = [];
            foreach ($r['sources'] as $src => $n) $parts[] = e($src) . ' ' . (int)$n;
            $meta[] = implode(' · ', $parts);
        }
        if (isset($r['add_rate']) && $r['add_rate'] !== null) {
            $meta[] = (int)$r['add_rate'] . '% shortlisted after opening';
        }
        if ($meta) echo '<span class="meta">' . implode(' — ', $meta) . '</span>';
        echo '</li>';
    }
    echo '</ol>';
    if (count($rows) > $limit) {
        echo '<button class="showall" type="button">Show all ' . count($rows) . '</button>';
    }
}
?>

<!-- ── Narrative summary ─────────────────────────────────────────────────── -->
<section class="card narrative">
    <div class="card-head">
        <h2>Summary — <?= e($narrative['timeframe']) ?></h2>
        <button type="button" class="copy-md" data-target="narrative-md">Copy as Markdown</button>
    </div>

    <h3>Funnel (<?= (int)$k['sessions'] ?> sessions)</h3>
    <ul class="prose">
        <?php foreach ($narrative['funnel'] as $line): ?><li><?= e($line) ?></li><?php endforeach; ?>
    </ul>
    <p class="prose-note"><?= e($narrative['bounce']) ?> <?= e($narrative['engaged']) ?></p>

    <h3>What they look at</h3>
    <dl class="prose-dl">
        <?php foreach ($narrative['look'] as $label => $text): ?>
            <dt><?= e($label) ?>:</dt><dd><?= e($text) ?></dd>
        <?php endforeach; ?>
    </dl>

    <?php if ($narrative['takeaways']): ?>
        <h3>Takeaways</h3>
        <ol class="prose">
            <?php foreach ($narrative['takeaways'] as $t): ?><li><?= e($t) ?></li><?php endforeach; ?>
        </ol>
    <?php endif; ?>

    <textarea id="narrative-md" class="hidden-md" readonly><?= e(stats_narrative_markdown($narrative)) ?></textarea>
</section>

<!-- ── KPIs ──────────────────────────────────────────────────────────────── -->
<section class="kpis">
    <?php
    $tiles = [
        ['Sessions',        number_format($k['sessions']),                                   ''],
        ['Events',          number_format($k['events']),                                     ''],
        ['Unique IPs',      number_format($k['unique_ips']),                                 '/24 granularity'],
        ['Bounce',          $k['bounce_pct'] . '%',                                          $k['bounced'] . ' single-event sessions'],
        ['Median active',   stats_duration($k['median_active']),                             $k['duration_coverage'] . '% of sessions reported one'],
        ['Reached step 2',  number_format($k['reached_compare']),                            stats_pct($k['reached_compare'], $k['sessions']) . '% of sessions'],
        ['Reached step 3',  number_format($k['reached_next']),                               stats_pct($k['reached_next'], $k['sessions']) . '% of sessions'],
        ['Exports',         number_format($k['exports']),                                    $k['links_copied'] . ' links copied'],
        ['Feedback',        number_format($k['feedback']),                                   $k['feedback_up'] . ' up / ' . $k['feedback_down'] . ' down'],
        ['Reports',         number_format($k['reports']),                                    'missing / wrong metrics'],
    ];
    foreach ($tiles as $t): ?>
        <div class="kpi">
            <div class="kpi-label"><?= e($t[0]) ?></div>
            <div class="kpi-value"><?= e($t[1]) ?></div>
            <?php if ($t[2] !== ''): ?><div class="kpi-note"><?= e($t[2]) ?></div><?php endif; ?>
        </div>
    <?php endforeach; ?>
</section>

<!-- ── Charts ────────────────────────────────────────────────────────────── -->
<div class="grid">
    <section class="card">
        <h2>Sessions over time</h2>
        <canvas id="chart-sessions" height="120"
                data-labels='<?= e(json_encode(array_keys($stats['timeseries']))) ?>'
                data-values='<?= e(json_encode(array_values($stats['timeseries']))) ?>'></canvas>
    </section>

    <section class="card">
        <h2>Journey funnel</h2>
        <?php $first = $stats['funnel'][0]['count'] ?: 1; ?>
        <ul class="funnel">
            <?php foreach ($stats['funnel'] as $i => $stage):
                $prev = $i > 0 ? $stats['funnel'][$i - 1]['count'] : null; ?>
                <li>
                    <span class="bar" style="width:<?= round($stage['count'] * 100 / $first) ?>%"></span>
                    <span class="label"><?= e($stage['label']) ?></span>
                    <span class="count"><?= (int)$stage['count'] ?> · <?= e($stage['pct']) ?>%</span>
                    <?php if ($prev !== null && $prev > 0): ?>
                        <span class="meta"><?= e(stats_pct($stage['count'], $prev)) ?>% of previous</span>
                    <?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ul>
    </section>
</div>

<!-- ── What people look at ───────────────────────────────────────────────── -->
<div class="grid grid-3">
    <section class="card">
        <h2>Most used companies <?php stats_info(
            'The big number counts sessions that touched the company at all; the small ones say how. '
            . 'preset = loaded its predefined shortlist, filter = selected it in the company filter, '
            . 'seo = viewed its SEO page, source = clicked one of its source links. '
            . 'A session can do several, so the small numbers add up to more than the total.'
        ); ?></h2>
        <?php stats_ranklist($stats['top_companies'], [
            'empty' => 'No company was picked in this period.',
            'link'  => function ($r) { return stats_url(['view' => 'sessions', 'q' => $r['label'], 'p' => null]); },
        ]); ?>
    </section>

    <section class="card">
        <h2>Most used frameworks <?php stats_info(
            'Counted like companies, per distinct session: preset = loaded the framework\'s shortlist, '
            . 'filter = selected it in the framework filter, wizard = named it when the wizard asked, '
            . 'seo = viewed its SEO page.'
        ); ?></h2>
        <?php stats_ranklist($stats['top_frameworks'], [
            'empty' => 'No framework was picked in this period.',
            'link'  => function ($r) { return stats_url(['view' => 'sessions', 'q' => $r['label'], 'p' => null]); },
        ]); ?>
    </section>

    <section class="card">
        <h2>Most used metrics <?php stats_info(
            'opened = viewed the metric\'s detail popup, added = put it on a shortlist, '
            . 'exported = carried it into a PDF or JSON export. The percentage is how often '
            . 'opening the metric led to shortlisting it.'
        ); ?></h2>
        <?php stats_ranklist($stats['top_metrics'], [
            'empty' => 'No metric was opened in this period.',
            'link'  => function ($r) { return stats_url(['view' => 'sessions', 'q' => $r['id'], 'p' => null]); },
        ]); ?>
    </section>
</div>

<div class="grid">
    <section class="card">
        <h2>Top comparisons</h2>
        <p class="card-note">
            <?= (int)$stats['preset_applied'] ?> preset applications ·
            <?= (int)$stats['manual_changes'] ?> manual dimension changes ·
            <?= (int)$stats['pdf_comparisons'] ?> carried into a PDF
        </p>
        <?php stats_ranklist($stats['top_pairs'], ['empty' => 'Nobody completed a comparison in this period.']); ?>
    </section>

    <section class="card">
        <h2>Top searches <?php stats_info(
            'Counted per distinct session. The result figure is what the search returned to the '
            . 'people who ran it — averaged, and marked "avg", when they got different numbers, '
            . 'which happens because each has their own filters active. Because the box is '
            . 'debounced by 600ms, half-typed prefixes are logged too; a run of growing prefixes '
            . 'within one session is collapsed into the query that was actually finished.'
        ); ?></h2>
        <p class="card-note">
            <?= (int)$stats['search_total'] ?> searches
        </p>
        <?php stats_ranklist($stats['searches'], ['empty' => 'The search box went unused.', 'compact' => true, 'limit' => 12]); ?>
        <?php if ($stats['zero_searches']): ?>
            <h3>Zero results — content gaps</h3>
            <ul class="chips zero-results">
                <?php foreach ($stats['zero_searches'] as $z): ?>
                    <li>"<?= e($z['label']) ?>" <strong><?= (int)$z['count'] ?></strong></li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </section>
</div>

<!-- ── Sentiment ─────────────────────────────────────────────────────────── -->
<div class="grid">
    <section class="card">
        <h2>Sentiment</h2>
        <?php if ($k['feedback'] > 0): ?>
            <div class="split">
                <span class="up" style="width:<?= stats_pct($k['feedback_up'], $k['feedback']) ?>%"><?= (int)$k['feedback_up'] ?> up</span>
                <span class="down" style="width:<?= stats_pct($k['feedback_down'], $k['feedback']) ?>%"><?= (int)$k['feedback_down'] ?> down</span>
            </div>
            <p class="card-note">
                <?= e(stats_pct($k['feedback_up'], $k['feedback'])) ?>% positive ·
                <?= e($stats['feedback_comment_rate']) ?>% came with a comment ·
                <?= e($stats['feedback_response_rate']) ?>% of sessions left feedback
            </p>
            <h3>Latest comments</h3>
            <?php
            $withComments = array_values(array_filter($feedback, function ($f) { return trim((string)($f['comment'] ?? '')) !== ''; }));
            $withComments = array_slice(array_reverse($withComments), 0, 5);
            ?>
            <?php if ($withComments): ?>
                <ul class="comments">
                    <?php foreach ($withComments as $f): ?>
                        <li>
                            <span class="rating <?= ($f['rating'] ?? '') === 'down' ? 'down' : 'up' ?>"><?= ($f['rating'] ?? '') === 'down' ? '&#128078;' : '&#128077;' ?></span>
                            <span class="text"><?= e($f['comment']) ?></span>
                            <span class="meta"><?= e(stats_time($f['_ts'])) ?> · step <?= e($f['context']['step'] ?? '?') ?></span>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <a class="more" href="<?= e(stats_url(['view' => 'feedback'])) ?>">All feedback →</a>
            <?php else: ?>
                <p class="empty">Votes but no written comments in this period.</p>
            <?php endif; ?>
        <?php else: ?>
            <p class="empty">No feedback in this period.</p>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Reported metrics</h2>
        <?php if ($reports): ?>
            <ul class="chips">
                <?php foreach ($stats['reports_by_mode'] as $mode => $count): ?>
                    <li><?= e(str_replace('_', ' ', $mode)) ?> <strong><?= (int)$count ?></strong></li>
                <?php endforeach; ?>
            </ul>
            <?php $handled = stats_handled_reports(); $open = 0;
            foreach ($reports as $r) if (!in_array(stats_report_key($r), $handled, true)) $open++; ?>
            <p class="card-note"><strong><?= (int)$open ?></strong> not yet marked as handled.</p>
            <ul class="comments">
                <?php foreach (array_slice(array_reverse($reports), 0, 5) as $r): ?>
                    <li>
                        <span class="text"><strong><?= e($r['metricName'] ?? '(no name)') ?></strong>
                            <?php if (!empty($r['description'])): ?>— <?= e(mb_substr($r['description'], 0, 140)) ?><?php endif; ?></span>
                        <span class="meta"><?= e(stats_time($r['_ts'])) ?> · <?= e(str_replace('_', ' ', $r['mode'] ?? '')) ?></span>
                    </li>
                <?php endforeach; ?>
            </ul>
            <a class="more" href="<?= e(stats_url(['view' => 'reports'])) ?>">All reports →</a>
        <?php else: ?>
            <p class="empty">Nothing reported in this period.</p>
        <?php endif; ?>
    </section>
</div>

<!-- ── Acquisition & context ─────────────────────────────────────────────── -->
<div class="grid grid-3">
    <section class="card">
        <h2>Entry points</h2>
        <?php stats_ranklist($stats['entries'], ['limit' => 10]); ?>
        <p class="card-note"><?= (int)$stats['from_seo'] ?> sessions arrived from an SEO page.</p>
    </section>

    <section class="card">
        <h2>Referrers</h2>
        <?php stats_ranklist($stats['referrers'], ['empty' => 'All traffic was direct or without a referrer.']); ?>
    </section>

    <section class="card">
        <h2>SEO pages <?php stats_info(
            'The static landing pages under /library/, generated from the metric data. '
            . 'Views are page loads; click-throughs are visitors who followed a link into the app.'
        ); ?></h2>
        <?php if ($stats['seo_views'] > 0): ?>
            <p class="card-note">
                <?= (int)$stats['seo_views'] ?> views · <?= (int)$stats['seo_clicks'] ?> click-throughs
                (<?= e(stats_pct($stats['seo_clicks'], $stats['seo_views'])) ?>%)
            </p>
            <?php stats_ranklist($stats['seo_pages']); ?>
        <?php else: ?>
            <p class="empty">No SEO-page views recorded yet — these only exist for visits after
            the landing-page tracking was deployed.</p>
        <?php endif; ?>
    </section>
</div>

<div class="grid grid-3">
    <section class="card">
        <h2>Wizard</h2>
        <?php stats_ranklist($stats['roles'], ['empty' => 'Nobody started the wizard.']); ?>
        <?php if ($stats['role_skips']): ?>
            <p class="card-note">
                <?php $parts = [];
                foreach ($stats['role_skips'] as $role => $s) {
                    if ($s['skipped'] > 0) $parts[] = e($role) . ' ' . e($s['pct']) . '% skipped';
                }
                echo $parts ? implode(' · ', $parts) : 'No role skipped straight to browsing.'; ?>
            </p>
        <?php endif; ?>
        <?php if ($stats['abandon_screens']): ?>
            <h3>Abandoned on</h3>
            <?php stats_ranklist($stats['abandon_screens'], ['limit' => 5]); ?>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Filters &amp; sorting</h2>
        <?php stats_ranklist($stats['filters'], ['empty' => 'No filters were touched.']); ?>
        <?php if ($stats['compare_sorts']): ?>
            <h3>Step 2 grouping <?php stats_info(
                'In the compare step, which dimension the metrics were grouped by — the sort cards '
                . 'above the comparison: category (the default), outcome, maturity, data type, AI, '
                . 'or alphabetical. Only non-default choices are logged.'
            ); ?></h3>
            <?php stats_ranklist($stats['compare_sorts'], ['limit' => 6, 'compact' => true]); ?>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Outbound source clicks <?php stats_info(
            'Clicks on the source links in a metric popup or on a step 3 card, which lead to the '
            . 'underlying paper or report — the clearest sign the catalogue sent someone to the '
            . 'original material.'
        ); ?></h2>
        <?php stats_ranklist($stats['outbound'], [
            'empty' => 'Nobody followed a source link in this period.',
            'limit' => 8,
        ]); ?>
    </section>
</div>

<section class="card">
    <h2>Browser &amp; viewport</h2>
    <div class="grid">
        <div>
            <h3>Browser</h3>
            <?php stats_ranklist($stats['browsers'], ['limit' => 8, 'compact' => true]); ?>
        </div>
        <div>
            <h3>Viewport</h3>
            <?php stats_ranklist($stats['viewports'], ['limit' => 4, 'compact' => true]); ?>
        </div>
    </div>
</section>

<?php if ($stats['wizard_answers']): ?>
<section class="card">
    <h2>Wizard answers</h2>
    <div class="grid grid-3">
        <?php foreach ($stats['wizard_answers'] as $screen => $answers): ?>
            <div>
                <h3><?= e($screen) ?></h3>
                <?php stats_ranklist($answers, ['limit' => 5]); ?>
            </div>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>
