<?php
// Reads the JSON-lines logs written by compass/api/{telemetry,feedback,report-metric}.php
// and turns them into timeframe-filtered arrays the insight layer can work on.
//
// Nothing here writes to the logs; the dashboard is strictly a reader.

if (!defined('STATS_ENTRY')) {
    http_response_code(403);
    exit;
}

// ─── Locations ────────────────────────────────────────────────────────────────

/** compass/api/logs — where the public endpoints append their lines. */
function stats_log_dir(): string {
    return dirname(__DIR__, 2) . '/api/logs';
}

/** compass/stats/cache — aggregate snapshots plus the dashboard's own small state files. */
function stats_cache_dir(): string {
    return dirname(__DIR__) . '/cache';
}

function stats_cache_writable(): bool {
    $dir = stats_cache_dir();
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return is_dir($dir) && is_writable($dir);
}

// ─── Timeframes ───────────────────────────────────────────────────────────────

const STATS_TIMEFRAMES = [
    'today' => 'Today',
    '7d'    => 'Last 7 days',
    '30d'   => 'Last 30 days',
    '90d'   => 'Last 90 days',
    'all'   => 'All time',
];

/**
 * Start of a timeframe as a Unix timestamp, cut on day boundaries in the *display*
 * timezone (so "today" means today where you are, not in UTC), while the log lines
 * it is compared against are UTC instants — which is fine, both are absolute times.
 *
 * @return int 0 for "all time".
 */
function stats_timeframe_start(string $tf, string $tz): int {
    if ($tf === 'all') return 0;

    $days = ['today' => 0, '7d' => 6, '30d' => 29, '90d' => 89];
    if (!isset($days[$tf])) return 0;

    $zone  = new DateTimeZone($tz);
    $start = new DateTime('now', $zone);
    $start->setTime(0, 0, 0);
    if ($days[$tf] > 0) $start->modify('-' . $days[$tf] . ' days');

    return $start->getTimestamp();
}

/** Length of a timeframe in seconds, used to build the preceding comparison period. */
function stats_timeframe_length(string $tf, string $tz): int {
    if ($tf === 'all') return 0;
    return time() - stats_timeframe_start($tf, $tz);
}

// ─── Reading ──────────────────────────────────────────────────────────────────

const STATS_LOG_KINDS = [
    'telemetry' => 'telemetry',
    'feedback'  => 'feedback',
    'reports'   => 'reported-metrics',
];

/**
 * The monthly log files for a kind, oldest first.
 * Only files whose month can contain $sinceTs are opened — a 7-day window normally
 * touches one file, two around a month boundary.
 */
function stats_log_files(string $kind, int $sinceTs = 0): array {
    $prefix = STATS_LOG_KINDS[$kind] ?? $kind;
    $files  = glob(stats_log_dir() . '/' . $prefix . '-*.log') ?: [];
    sort($files);

    if ($sinceTs > 0) {
        $sinceMonth = gmdate('Y-m', $sinceTs);
        $files = array_values(array_filter($files, function ($f) use ($sinceMonth, $prefix) {
            if (preg_match('/' . preg_quote($prefix, '/') . '-(\d{4}-\d{2})\.log$/', $f, $m)) {
                return $m[1] >= $sinceMonth;
            }
            return true;
        }));
    }
    return $files;
}

/** Newest mtime+size across a kind's files — the cache key ingredient that spots new events. */
function stats_log_fingerprint(int $sinceTs = 0): string {
    $parts = [];
    foreach (array_keys(STATS_LOG_KINDS) as $kind) {
        foreach (stats_log_files($kind, $sinceTs) as $f) {
            $parts[] = basename($f) . ':' . @filemtime($f) . ':' . @filesize($f);
        }
    }
    return md5(implode('|', $parts));
}

/**
 * Decoded log lines for a kind, in file order, from $sinceTs onwards.
 * Malformed lines (a truncated write, a half-flushed append) are skipped rather than
 * aborting the whole page — losing one line matters far less than losing the dashboard.
 * Each returned row gets an added '_ts' (Unix timestamp) for cheap comparisons.
 */
function stats_read_log(string $kind, int $sinceTs = 0): array {
    $rows = [];
    foreach (stats_log_files($kind, $sinceTs) as $file) {
        $fh = @fopen($file, 'r');
        if (!$fh) continue;
        while (($line = fgets($fh)) !== false) {
            $line = trim($line);
            if ($line === '') continue;
            $row = json_decode($line, true);
            if (!is_array($row) || empty($row['timestamp'])) continue;
            $ts = strtotime($row['timestamp']);
            if ($ts === false) continue;
            if ($sinceTs > 0 && $ts < $sinceTs) continue;
            $row['_ts'] = $ts;
            $rows[] = $row;
        }
        fclose($fh);
    }
    usort($rows, function ($a, $b) { return $a['_ts'] <=> $b['_ts']; });
    return $rows;
}

// ─── Sortable tables ──────────────────────────────────────────────────────────

/**
 * Sorts rows by a named key. Each column supplies a callable that returns its sort
 * value, so a table can sort on things that aren't plain fields (a session's furthest
 * step, say). Unknown keys fall back to $default.
 */
function stats_sort_rows(array $rows, array $columns, string $key, string $dir, string $default): array {
    if (!isset($columns[$key])) $key = $default;
    $get  = $columns[$key];
    $sign = ($dir === 'asc') ? 1 : -1;

    usort($rows, function ($a, $b) use ($get, $sign) {
        $va = $get($a);
        $vb = $get($b);
        if (is_string($va) || is_string($vb)) {
            return $sign * strcasecmp((string)$va, (string)$vb);
        }
        // Nulls (an unknown duration, say) always sort last, whichever way the column runs.
        if ($va === null && $vb === null) return 0;
        if ($va === null) return 1;
        if ($vb === null) return -1;
        return $sign * ($va <=> $vb);
    });
    return $rows;
}

/**
 * A clickable column header. Clicking the active column flips its direction; clicking
 * another switches to it in its natural direction (dates and numbers start descending,
 * text ascending).
 */
function stats_sort_header(string $key, string $label, string $activeKey, string $dir, string $naturalDir = 'desc'): string {
    $isActive = ($key === $activeKey);
    $next     = $isActive ? ($dir === 'asc' ? 'desc' : 'asc') : $naturalDir;
    $arrow    = $isActive ? ($dir === 'asc' ? ' ▲' : ' ▼') : '';
    $url      = stats_url(['sort' => $key, 'dir' => $next, 'p' => null]);

    return '<th class="sortable' . ($isActive ? ' active' : '') . '">'
         . '<a href="' . htmlspecialchars($url, ENT_QUOTES) . '">'
         . htmlspecialchars($label, ENT_QUOTES) . $arrow . '</a></th>';
}

/**
 * The raw-events view's filter, shared with the download route in index.php so the
 * file you download is exactly the list you were looking at.
 */
function stats_filter_events(array $events, array $filters): array {
    $event = trim((string)($filters['event'] ?? ''));
    $sid   = trim((string)($filters['sid'] ?? ''));
    $text  = trim((string)($filters['q'] ?? ''));

    return array_values(array_filter($events, function ($row) use ($event, $sid, $text) {
        if ($event !== '' && ($row['event'] ?? '') !== $event) return false;
        if ($sid !== '' && stripos((string)($row['session_id'] ?? ''), $sid) === false) return false;
        if ($text !== '') {
            $hay = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (stripos((string)$hay, $text) === false) return false;
        }
        return true;
    }));
}

// ─── Self-traffic exclusion ───────────────────────────────────────────────────
//
// Logged IPs are already anonymized: IPv4 keeps three octets, IPv6 its /48. So an
// ignore entry can only ever be as precise as a /24 (or /48) — anything finer was
// destroyed before the line was written and would silently match nothing. Rather
// than fail quietly, normalize what can be normalized and report what cannot.

/**
 * @return array{rules: array, errors: array} Parsed rules plus human-readable problems.
 */
function stats_parse_ignore_ips(array $entries): array {
    $rules = [];
    $errors = [];

    foreach ($entries as $entry) {
        $entry = trim((string)$entry);
        if ($entry === '') continue;

        $bits = null;
        $addr = $entry;
        if (strpos($entry, '/') !== false) {
            list($addr, $bitsRaw) = explode('/', $entry, 2);
            $bits = (int)$bitsRaw;
        }

        $isV4 = filter_var($addr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
        $isV6 = filter_var($addr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
        if (!$isV4 && !$isV6) {
            $errors[] = "'{$entry}' is not a valid IP address or CIDR range — ignored.";
            continue;
        }

        $maxBits = $isV4 ? 24 : 48;
        if ($bits === null) {
            // A bare address: widen it to what the log actually stores.
            $bits = $maxBits;
        } elseif ($bits > $maxBits) {
            $errors[] = "'{$entry}' is more specific than /{$maxBits}, but logged IPs are anonymized "
                      . "to /{$maxBits} before being written — it can never match. Widen it to /{$maxBits}.";
            continue;
        } elseif ($bits < 0) {
            $errors[] = "'{$entry}' has an invalid prefix length — ignored.";
            continue;
        }

        $rules[] = ['addr' => $addr, 'bits' => $bits, 'v4' => $isV4];
    }

    return ['rules' => $rules, 'errors' => $errors];
}

/** True when an already-anonymized log IP falls inside one of the configured ranges. */
function stats_ip_ignored(string $ip, array $rules): bool {
    if ($ip === '' || !$rules) return false;
    $packed = @inet_pton($ip);
    if ($packed === false) return false;

    foreach ($rules as $rule) {
        $rulePacked = @inet_pton($rule['addr']);
        if ($rulePacked === false) continue;
        if (strlen($rulePacked) !== strlen($packed)) continue; // different family

        $bits  = $rule['bits'];
        $bytes = intdiv($bits, 8);
        $rest  = $bits % 8;

        if ($bytes > 0 && strncmp($packed, $rulePacked, $bytes) !== 0) continue;
        if ($rest > 0) {
            $mask = ~((1 << (8 - $rest)) - 1) & 0xFF;
            if ((ord($packed[$bytes]) & $mask) !== (ord($rulePacked[$bytes]) & $mask)) continue;
        }
        return true;
    }
    return false;
}

// ─── Manually excluded sessions ───────────────────────────────────────────────
// Precise counterpart to the IP list: one click removes exactly one session, with no
// collateral damage to visitors who happen to share a /24.

function stats_excluded_sessions_file(): string {
    return stats_cache_dir() . '/excluded_sessions.json';
}

function stats_excluded_sessions(): array {
    $file = stats_excluded_sessions_file();
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    $ids = ($raw !== false) ? (json_decode($raw, true) ?: []) : [];
    return is_array($ids) ? array_values(array_unique(array_map('strval', $ids))) : [];
}

function stats_toggle_excluded_session(string $sessionId): bool {
    if (!preg_match('/^[a-f0-9]{1,16}$/', $sessionId)) return false;
    if (!stats_cache_writable()) return false;

    $ids = stats_excluded_sessions();
    $pos = array_search($sessionId, $ids, true);
    if ($pos === false) {
        $ids[] = $sessionId;
    } else {
        array_splice($ids, $pos, 1);
    }
    @file_put_contents(stats_excluded_sessions_file(), json_encode(array_values($ids)), LOCK_EX);
    return true;
}

// ─── Handled reports ──────────────────────────────────────────────────────────
// Real state, not derived: which "report something missing" submissions have been
// dealt with. Keyed by a hash of the line so it survives log rotation.

function stats_handled_file(): string {
    return stats_cache_dir() . '/handled.json';
}

function stats_handled_reports(): array {
    $file = stats_handled_file();
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    $ids = ($raw !== false) ? (json_decode($raw, true) ?: []) : [];
    return is_array($ids) ? $ids : [];
}

function stats_report_key(array $report): string {
    return substr(md5(($report['timestamp'] ?? '') . '|' . ($report['metricName'] ?? '') . '|' . ($report['email'] ?? '')), 0, 12);
}

function stats_toggle_handled_report(string $key): bool {
    if (!preg_match('/^[a-f0-9]{1,32}$/', $key)) return false;
    if (!stats_cache_writable()) return false;

    $ids = stats_handled_reports();
    $pos = array_search($key, $ids, true);
    if ($pos === false) {
        $ids[] = $key;
    } else {
        array_splice($ids, $pos, 1);
    }
    @file_put_contents(stats_handled_file(), json_encode(array_values($ids)), LOCK_EX);
    return true;
}

// ─── Aggregate cache ──────────────────────────────────────────────────────────
// The expensive part is parsing + aggregating, not reading; cache the result and
// throw it away whenever any log file changes. Purely an optimization: if the
// directory isn't writable the dashboard still works, just recomputes every time.

function stats_cache_get(string $key) {
    $file = stats_cache_dir() . '/agg-' . $key . '.json';
    if (!file_exists($file)) return null;
    $raw = file_get_contents($file);
    if ($raw === false) return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function stats_cache_put(string $key, array $data): void {
    if (!stats_cache_writable()) return;
    @file_put_contents(stats_cache_dir() . '/agg-' . $key . '.json', json_encode($data), LOCK_EX);

    // Drop snapshots for older fingerprints so the directory can't grow without bound.
    foreach (glob(stats_cache_dir() . '/agg-*.json') ?: [] as $f) {
        if (basename($f) !== 'agg-' . $key . '.json' && (time() - @filemtime($f)) > 86400) {
            @unlink($f);
        }
    }
}

// ─── Metric / catalogue names ─────────────────────────────────────────────────

/** id => name for every node in data.json, so logged ids can be shown as names. */
function stats_metric_names(): array {
    static $names = null;
    if ($names !== null) return $names;

    $names = [];
    $file  = dirname(__DIR__, 2) . '/data/data.json';
    $raw   = @file_get_contents($file);
    if ($raw === false) return $names;

    $data = json_decode($raw, true);
    if (!is_array($data)) return $names;

    foreach ($data as $node) {
        if (isset($node['id'], $node['name'])) $names[(string)$node['id']] = $node['name'];
    }
    return $names;
}

/** Display name for a metric id, keeping unknown ids visible rather than dropping them. */
function stats_metric_name($id): string {
    $names = stats_metric_names();
    $key   = (string)$id;
    return $names[$key] ?? ('(removed metric #' . $key . ')');
}
