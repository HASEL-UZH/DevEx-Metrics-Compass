<?php
// The /stats dashboard — the only routable file in this folder.
//
// Everything under lib/ is logic that prints nothing, everything under views/ is a
// template included after the auth gate has already run. Keeping a single entry point
// means no view can accidentally become an unauthenticated URL, and there is exactly
// one place that bootstraps config and sessions.

define('STATS_ENTRY', true);

// The config holds the password hash, so it is looked for outside the web root first — a
// file there cannot be served as text even if PHP stops executing one day (a broken
// handler, an .htaccess the host ignores) and .php starts being sent as plain text.
//
// On Hoststar the document root is <domain>/public_html/, with sibling folders
// (software_data/, private/, logs/, …) that no URL maps to.
// Caveat that decides the order below: shared hosts confine PHP with open_basedir, and a
// path outside it is unreadable no matter how correct it looks over FTP. On Hoststar,
// private/ is NOT in open_basedir but software_data/ is — and software_data/ is still a
// sibling of public_html, so it is just as unreachable over HTTP.
$webRoot   = dirname(__DIR__);            // .../public_html
$aboveRoot = dirname($webRoot);           // .../<domain>
$webHome   = dirname($aboveRoot);         // .../web  (holds files/ shared across domains)
$configCandidates = [
    $aboveRoot . '/software_data/compass-stats-config.php',  // outside web root AND inside open_basedir
    $webHome   . '/files/compass-stats-config.php',          // ditto, shared across domains
    $aboveRoot . '/private/compass-stats-config.php',        // ideal, but often outside open_basedir
    $aboveRoot . '/compass-stats-config.php',                // any host: one level above the web root
    __DIR__ . '/compass-stats-config.php',                   // last resort: inside the dashboard folder
];
$configFile = null;
foreach ($configCandidates as $candidate) {
    if (is_readable($candidate)) { $configFile = $candidate; break; }
}
if ($configFile === null) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');

    // Say what was actually observed per path. "Blocked by open_basedir" and "you forgot to
    // upload it" both surface as file_exists() === false, and confusing the two costs an
    // afternoon — so the two cases are reported separately.
    $basedir = (string)ini_get('open_basedir');
    $allowed = $basedir !== '' ? explode(PATH_SEPARATOR, $basedir) : [];

    $withinBasedir = function ($path) use ($allowed) {
        if (!$allowed) return true;                 // no restriction configured
        foreach ($allowed as $prefix) {
            $prefix = rtrim($prefix, '/');
            if ($prefix !== '' && strpos($path, $prefix . '/') === 0) return true;
        }
        return false;
    };

    $lines = '';
    foreach ($configCandidates as $i => $candidate) {
        if (!$withinBasedir($candidate)) {
            $status = 'UNREADABLE BY PHP — outside open_basedir (the file may well be there)';
        } elseif (is_readable($candidate)) {
            $status = 'readable';
        } elseif (file_exists($candidate)) {
            $status = 'EXISTS BUT IS NOT READABLE — check its permissions (644)';
        } else {
            $status = 'not found';
        }
        $lines .= '  ' . ($i + 1) . '. ' . $candidate . "\n       → " . $status . "\n";
    }

    $note = '';
    if ($allowed) {
        $note = "\nPHP is confined by open_basedir to:\n";
        foreach ($allowed as $prefix) $note .= '  ' . $prefix . "\n";
        $note .= "Nothing outside those paths can be read, however correct it looks over FTP.\n"
               . "Pick a path above that is both inside open_basedir and outside "
               . basename($webRoot) . "/.\n";
    }

    exit("The stats dashboard found no readable config file.\n\n"
       . "Checked, in order:\n" . $lines
       . $note
       . "\nCopy stats/compass-stats-config.example.php to one of those paths and set a password hash:\n"
       . "  php -r \"echo password_hash('your-password', PASSWORD_DEFAULT);\"\n");
}
$config = require $configFile;

require_once __DIR__ . '/lib/parse_logs.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/compute_insights.php';
require_once __DIR__ . '/lib/rebuild_deep_links.php';

date_default_timezone_set('UTC');            // log parsing stays in UTC …
$displayTz = $config['timezone'] ?? 'UTC';   // … only display is localized
try {
    new DateTimeZone($displayTz);
} catch (Exception $e) {
    $displayTz = 'UTC';
}

/** Escapes anything that came out of a log line. Log payloads are stored verbatim by
 *  design (see api/telemetry.php), so this is the one thing standing between a crafted
 *  event and script execution inside the dashboard. */
function e($value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Local-time formatting of a log timestamp. */
function stats_time(int $ts, string $format = 'Y-m-d H:i'): string {
    global $displayTz;
    $d = new DateTime('@' . $ts);
    $d->setTimezone(new DateTimeZone($displayTz));
    return $d->format($format);
}

function stats_url(array $overrides = []): string {
    $params = array_merge($_GET, $overrides);
    foreach ($params as $k => $v) {
        if ($v === null || $v === '') unset($params[$k]);
    }
    return '?' . http_build_query($params);
}

stats_session_start($config);

// ─── Auth ─────────────────────────────────────────────────────────────────────

$view      = $_GET['view'] ?? 'overview';
$loginError = '';

if ($view === 'logout') {
    stats_logout();
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

if (!stats_is_logged_in($config)) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        $loginError = stats_attempt_login($config, (string)$_POST['password']);
        if ($loginError === '') {
            header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
            exit;
        }
    }
    $title = 'Sign in';
    include __DIR__ . '/views/login.php';
    exit;
}

// ─── Actions (state the dashboard itself writes) ──────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!stats_csrf_valid($_POST['csrf'] ?? null)) {
        http_response_code(403);
        exit('Invalid or expired form token. Go back, reload the page, and try again.');
    }
    if (!empty($_POST['exclude_session'])) {
        stats_toggle_excluded_session((string)$_POST['exclude_session']);
    }
    if (!empty($_POST['handle_report'])) {
        stats_toggle_handled_report((string)$_POST['handle_report']);
    }
    // Redirect after POST so a reload doesn't repeat the toggle. The return value comes
    // from a form field, so only a query string on this page is accepted — never a URL
    // that could send someone off-site.
    $return = (string)($_POST['return'] ?? '');
    if ($return === '' || $return[0] !== '?') $return = stats_url();
    header('Location: ' . $return);
    exit;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

$timeframe = (string)($_GET['tf'] ?? '30d');
// array_key_exists, not isset(): isset() cannot be applied to a constant expression.
if (!array_key_exists($timeframe, STATS_TIMEFRAMES)) $timeframe = '30d';
$timeframeLabel = STATS_TIMEFRAMES[$timeframe];

$showExcluded = !empty($_GET['raw']);       // include own/excluded traffic
$since        = stats_timeframe_start($timeframe, $displayTz);

$ignore       = stats_parse_ignore_ips((array)($config['ignore_ips'] ?? []));
$ignoreErrors = $ignore['errors'];
$excludedIds  = array_flip(stats_excluded_sessions());

$telemetryRaw = stats_read_log('telemetry', $since);
$feedbackRaw  = stats_read_log('feedback',  $since);
$reportsRaw   = stats_read_log('reports',   $since);

// Apply the two exclusions, counting what each removed so the numbers stay auditable.
$excludedByIp = $excludedByHand = [];
$telemetry = [];
foreach ($telemetryRaw as $row) {
    $sid = (string)($row['session_id'] ?? '');
    $byIp   = stats_ip_ignored((string)($row['ip'] ?? ''), $ignore['rules']);
    $byHand = isset($excludedIds[$sid]);
    if ($byIp)   $excludedByIp[$sid]   = true;
    if ($byHand) $excludedByHand[$sid] = true;
    if (!$showExcluded && ($byIp || $byHand)) continue;
    $telemetry[] = $row;
}
$feedback = $showExcluded ? $feedbackRaw : array_values(array_filter($feedbackRaw, function ($f) use ($ignore) {
    return !stats_ip_ignored((string)($f['ip'] ?? ''), $ignore['rules']);
}));
$reports = $showExcluded ? $reportsRaw : array_values(array_filter($reportsRaw, function ($r) use ($ignore) {
    return !stats_ip_ignored((string)($r['ip'] ?? ''), $ignore['rules']);
}));

$sessions = stats_build_sessions($telemetry);

// Cached aggregates: the parse is cheap, the aggregation less so, and neither changes
// until a log file does. Falls back to computing inline when cache/ isn't writable.
$cacheKey = md5($timeframe . '|' . ($showExcluded ? 'raw' : 'clean') . '|' . $displayTz . '|'
    . stats_log_fingerprint($since) . '|' . count($excludedIds) . '|' . json_encode($config['ignore_ips'] ?? []));
$stats = stats_cache_get($cacheKey);
if ($stats === null) {
    $stats = stats_compute($telemetry, $feedback, $reports, $sessions, $displayTz);
    stats_cache_put($cacheKey, $stats);
}
$narrative = stats_narrative($stats, $timeframeLabel);

// ─── Downloads ────────────────────────────────────────────────────────────────
// Handled before any HTML is sent, and deliberately limited to the telemetry stream:
// the reported-metrics log holds email addresses and stays inside the dashboard.

if ($view === 'events' && !empty($_GET['download'])) {
    $rows   = stats_filter_events($telemetry, $_GET);
    $format = $_GET['download'] === 'csv' ? 'csv' : 'jsonl';
    $name   = 'compass-events-' . date('Ymd-His') . '.' . ($format === 'csv' ? 'csv' : 'jsonl');

    header('Content-Type: ' . ($format === 'csv' ? 'text/csv' : 'application/x-ndjson') . '; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '"');

    $out = fopen('php://output', 'w');
    if ($format === 'csv') {
        // Telemetry payloads are attacker-supplied (the endpoint stores them verbatim), so a
        // search query like "=HYPERLINK(...)" would be executed as a formula by Excel or
        // Sheets when the export is opened. Prefixing with an apostrophe makes the cell text.
        $safe = function ($value) {
            $value = (string)$value;
            return ($value !== '' && strpos("=+-@\t\r", $value[0]) !== false) ? "'" . $value : $value;
        };
        fputcsv($out, ['timestamp', 'session_id', 'event', 'browser', 'referrer_domain', 'ip', 'payload']);
        foreach ($rows as $row) {
            fputcsv($out, array_map($safe, [
                $row['timestamp'] ?? '', $row['session_id'] ?? '', $row['event'] ?? '',
                $row['browser'] ?? '', $row['referrer_domain'] ?? '', $row['ip'] ?? '',
                json_encode($row['payload'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]));
        }
    } else {
        foreach ($rows as $row) {
            unset($row['_ts']);
            fwrite($out, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
        }
    }
    fclose($out);
    exit;
}

$views = ['overview', 'sessions', 'session', 'feedback', 'reports', 'events'];
if (!in_array($view, $views, true)) $view = 'overview';

$titles = [
    'overview' => 'Overview',
    'sessions' => 'Sessions',
    'session'  => 'Session detail',
    'feedback' => 'Feedback',
    'reports'  => 'Reported metrics',
    'events'   => 'Raw events',
];
$title = $titles[$view];

include __DIR__ . '/views/layout.php';
