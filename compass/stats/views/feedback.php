<?php
if (!defined('STATS_ENTRY')) { http_response_code(403); exit; }

$rating     = (string)($_GET['rating'] ?? '');
$onlyText   = !empty($_GET['text']);
$k          = $stats['kpi'];

$rows = $feedback;
if ($rating !== '')  $rows = array_filter($rows, function ($f) use ($rating) { return ($f['rating'] ?? '') === $rating; });
if ($onlyText)       $rows = array_filter($rows, function ($f) { return trim((string)($f['comment'] ?? '')) !== ''; });
$rows = array_values($rows);

// Comments are the payload of this view, and a thumbs-down with words is the most
// actionable thing in the whole dashboard — so those float to the top by default.
usort($rows, function ($a, $b) {
    $score = function ($f) {
        $hasText = trim((string)($f['comment'] ?? '')) !== '';
        if (($f['rating'] ?? '') === 'down' && $hasText) return 3;
        if ($hasText) return 2;
        if (($f['rating'] ?? '') === 'down') return 1;
        return 0;
    };
    return $score($b) <=> $score($a) ?: $b['_ts'] <=> $a['_ts'];
});
?>

<section class="card">
    <div class="card-head"><h2>Feedback <span class="muted"><?= count($feedback) ?> in <?= e(strtolower($timeframeLabel)) ?></span></h2></div>

    <?php if ($k['feedback'] > 0): ?>
        <div class="split">
            <span class="up" style="width:<?= stats_pct($k['feedback_up'], $k['feedback']) ?>%"><?= (int)$k['feedback_up'] ?> up</span>
            <span class="down" style="width:<?= stats_pct($k['feedback_down'], $k['feedback']) ?>%"><?= (int)$k['feedback_down'] ?> down</span>
        </div>
        <p class="card-note">
            <?= e(stats_pct($k['feedback_up'], $k['feedback'])) ?>% positive ·
            <?= e($stats['feedback_comment_rate']) ?>% with a comment ·
            <?= e($stats['feedback_response_rate']) ?>% of sessions responded
        </p>

        <canvas id="chart-feedback" height="80"
                data-labels='<?= e(json_encode(array_keys($stats['feedback_by_day']))) ?>'
                data-up='<?= e(json_encode(array_column($stats['feedback_by_day'], 'up'))) ?>'
                data-down='<?= e(json_encode(array_column($stats['feedback_by_day'], 'down'))) ?>'></canvas>

        <?php if ($stats['feedback_by_step']): ?>
            <h3>Where the votes came from</h3>
            <ul class="chips">
                <?php foreach ($stats['feedback_by_step'] as $step => $counts): ?>
                    <li><?= e($step) ?> <strong>&#128077; <?= (int)$counts['up'] ?> · &#128078; <?= (int)$counts['down'] ?></strong></li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    <?php endif; ?>

    <form class="filters" method="get">
        <input type="hidden" name="view" value="feedback">
        <input type="hidden" name="tf" value="<?= e($timeframe) ?>">
        <select name="rating">
            <option value="">Both ratings</option>
            <option value="up"   <?= $rating === 'up'   ? 'selected' : '' ?>>Thumbs up only</option>
            <option value="down" <?= $rating === 'down' ? 'selected' : '' ?>>Thumbs down only</option>
        </select>
        <label class="check"><input type="checkbox" name="text" value="1" <?= $onlyText ? 'checked' : '' ?>> With a comment</label>
        <button type="submit">Apply</button>
    </form>
</section>

<?php if (!$rows): ?>
    <section class="card"><p class="empty">No feedback matches.</p></section>
<?php else: ?>
<!-- One toggle for the whole list: the numbers and the chart above answer most
     questions, and the individual submissions are what you open when they don't. -->
<details class="card individual-list">
    <summary>See individual submissions (<?= count($rows) ?>)</summary>

    <?php foreach ($rows as $f):
        $context = (array)($f['context'] ?? []);
        $params  = stats_rebuild_from_context($context);
        $comment = trim((string)($f['comment'] ?? '')); ?>
        <section class="card feedback-card <?= ($f['rating'] ?? '') === 'down' ? 'is-down' : 'is-up' ?>">
            <div class="fb-head">
                <span class="rating <?= ($f['rating'] ?? '') === 'down' ? 'down' : 'up' ?>">
                    <?= ($f['rating'] ?? '') === 'down' ? '&#128078;' : '&#128077;' ?>
                </span>
                <span class="meta"><?= e(stats_time($f['_ts'], 'Y-m-d H:i')) ?></span>
                <span class="mono muted"><?= e($f['ip'] ?? '') ?></span>
            </div>

            <?php if ($comment !== ''): ?>
                <blockquote><?= nl2br(e($comment)) ?></blockquote>
            <?php else: ?>
                <p class="empty">No comment.</p>
            <?php endif; ?>

            <?php if ($context): ?>
                <ul class="chips">
                    <li>step <strong><?= e($context['step'] ?? '?') ?></strong></li>
                    <?php if (isset($context['shortlistCount'])): ?>
                        <li>shortlist <strong><?= (int)$context['shortlistCount'] ?></strong></li>
                    <?php endif; ?>
                    <?php foreach ((array)($context['activeFilters'] ?? []) as $key => $val):
                        $val = is_array($val) ? implode('/', $val) : $val;
                        if ($val === '' || $val === 'all') continue; ?>
                        <li><?= e($key) ?> <strong><?= e($val) ?></strong></li>
                    <?php endforeach; ?>
                    <?php if (!empty($context['comparison'])): ?>
                        <li>comparing <strong><?= e($context['comparison']['leftValue'] ?? '?') ?> vs <?= e($context['comparison']['rightValue'] ?? '?') ?></strong></li>
                    <?php endif; ?>
                </ul>
            <?php endif; ?>

            <?php if ($params): ?>
                <a class="more" href="<?= e(stats_compass_url($params)) ?>" target="_blank" rel="noopener">
                    Open the Compass as they saw it →
                </a>
            <?php endif; ?>
        </section>
    <?php endforeach; ?>
</details>
<?php endif; ?>
