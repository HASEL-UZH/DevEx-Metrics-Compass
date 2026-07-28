<?php
// Shared utilities for api endpoints.
// Not meant to be called directly — exit if loaded as the entry script.
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit;
}

/**
 * Anonymizes an IP address.
 * IPv4: last octet zeroed       (e.g. 1.2.3.4 → 1.2.3.0)
 * IPv6: last 80 bits zeroed     (retains the /48 network prefix)
 */
function anonymize_ip(string $ip): string {
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return preg_replace('/\.\d+$/', '.0', $ip);
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        return inet_ntop(substr(inet_pton($ip), 0, 6) . str_repeat("\x00", 10));
    }
    return '';
}

/**
 * Exits with 403 if the HTTP_ORIGIN header is present and does not match the server host.
 * Requests from the same origin (the Compass itself) don't send Origin, so they pass through.
 */
function check_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host   = $_SERVER['HTTP_HOST']   ?? '';
    if ($origin === '') return;
    $parsed     = parse_url($origin);
    $originHost = isset($parsed['port'])
        ? ($parsed['host'] ?? '') . ':' . $parsed['port']
        : ($parsed['host'] ?? '');
    if ($originHost !== $host) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        exit;
    }
}

/**
 * Enforces a sliding-window rate limit for the current IP.
 *
 * One small JSON file per IP (named by MD5 hash of the IP).
 * On each call: load the file, drop timestamps older than $window, check the count,
 * append the current timestamp, save. On ~2% of calls, also scan and delete all
 * ratelimit_*.json files whose entries have fully expired (probabilistic cleanup).
 *
 * @param string $logDir   Directory where rate-limit files live (same as log dir).
 * @param string $prefix   Filename prefix: 'ratelimit_feedback_' or 'ratelimit_report_'.
 * @param int    $maxReqs  Maximum allowed requests within the window.
 * @param int    $window   Sliding window in seconds (default 3600 = 1 hour).
 */
function enforce_rate_limit(string $logDir, string $prefix, int $maxReqs, int $window = 3600): void {
    $ip        = $_SERVER['REMOTE_ADDR'] ?? '';
    $rlDir = $logDir . '/ratelimits';
    $file  = $rlDir . '/' . $prefix . md5($ip) . '.json';
    $now  = time();

    $times = [];
    if (file_exists($file)) {
        $raw   = file_get_contents($file);
        $times = ($raw !== false) ? (json_decode($raw, true) ?? []) : [];
    }
    // Drop timestamps outside the window (compacts the file on every access)
    $pruned = array_values(array_filter($times, function ($t) use ($now, $window) {
        return $now - $t < $window;
    }));

    // Always write back the pruned array so stale entries don't accumulate
    // even when the rate limit is hit and no new entry is appended.
    if (count($pruned) !== count($times)) {
        file_put_contents($file, json_encode($pruned), LOCK_EX);
    }

    if (count($pruned) >= $maxReqs) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Too many requests']);
        exit;
    }

    $pruned[] = $now;
    file_put_contents($file, json_encode($pruned), LOCK_EX);

    // Probabilistic cleanup (~5% of requests): delete fully-expired ratelimit files
    if (rand(1, 20) === 1) {
        foreach (glob($rlDir . '/ratelimit_*.json') as $f) {
            $raw  = file_get_contents($f);
            $data = ($raw !== false) ? (json_decode($raw, true) ?? []) : [];
            $live = array_filter($data, function ($t) use ($now, $window) {
                return $now - $t < $window;
            });
            if (empty($live)) {
                @unlink($f);
            }
        }
    }
}
