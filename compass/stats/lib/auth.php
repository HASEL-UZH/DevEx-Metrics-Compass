<?php
// Login/logout logic for the stats dashboard. Logic only — this file never prints anything;
// index.php decides what to render based on what these functions return.
//
// One password, no user accounts: the dashboard has exactly one reader (the maintainer).
// The hash lives in the gitignored config file outside the web root;
// see compass-stats-config.example.php.

if (!defined('STATS_ENTRY')) {
    http_response_code(403);
    exit;
}

// Its own cookie name, so the dashboard's session can't collide with another PHP app
// on the same host. Not configurable — there is no reason to ever change it.
const STATS_SESSION_NAME = 'compass_stats';

/** Starts the dashboard session. */
function stats_session_start(array $config): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    session_name(STATS_SESSION_NAME);

    // Only ask for a Secure cookie when the request itself is HTTPS, so the dashboard
    // still works over plain http on a dev server.
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    // The array form (with SameSite) needs PHP 7.3; fall back on anything older so the
    // dashboard doesn't fatal on a host that hasn't been updated.
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'httponly' => true,
            'secure'   => $secure,
            'samesite' => 'Strict',
        ]);
    } else {
        session_set_cookie_params(0, '/', '', $secure, true);
    }
    session_start();
}

/** True when the current session is logged in and hasn't gone idle. */
function stats_is_logged_in(array $config): bool {
    if (empty($_SESSION['stats_auth'])) return false;

    $timeout = (int)($config['idle_timeout'] ?? 8 * 3600);
    $last    = (int)($_SESSION['stats_last_seen'] ?? 0);
    if ($timeout > 0 && $last > 0 && (time() - $last) > $timeout) {
        stats_logout();
        return false;
    }

    $_SESSION['stats_last_seen'] = time();
    return true;
}

/**
 * Verifies a submitted password. Rate limited per IP by the same sliding-window
 * helper the public API endpoints use, so a guessing attempt gets 10 tries an hour.
 *
 * @return string '' on success, otherwise a message to show on the login form.
 */
function stats_attempt_login(array $config, string $password): string {
    // enforce_rate_limit() exits with 429 on its own; catch that case first so the
    // form can say something useful instead of the endpoint's JSON error.
    if (stats_login_attempts_exhausted()) {
        return 'Too many attempts. Try again later.';
    }
    stats_record_login_attempt();

    $hash = (string)($config['password_hash'] ?? '');
    if ($hash === '' || strpos($hash, 'replace.this') !== false) {
        return 'No password is configured yet — see stats/compass-stats-config.example.php.';
    }

    if (!password_verify($password, $hash)) {
        return 'Wrong password.';
    }

    session_regenerate_id(true);
    $_SESSION['stats_auth']      = true;
    $_SESSION['stats_last_seen'] = time();
    return '';
}

// ─── CSRF ─────────────────────────────────────────────────────────────────────
// The dashboard's POSTs change what the numbers include ("exclude this session") and
// the triage state of reports. Without a token, any page the logged-in admin visits
// could fire those requests from their browser.

function stats_csrf_token(): string {
    if (empty($_SESSION['stats_csrf'])) {
        $_SESSION['stats_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['stats_csrf'];
}

function stats_csrf_valid(?string $token): bool {
    return !empty($_SESSION['stats_csrf'])
        && is_string($token)
        && hash_equals($_SESSION['stats_csrf'], $token);
}

function stats_logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ─── Attempt throttling ───────────────────────────────────────────────────────
// Same sliding-window-file approach as api/helpers.php's enforce_rate_limit(), but
// split into "check" and "record" so a failed login can be answered with a form
// message rather than the helper's hard 429-and-exit.

const STATS_LOGIN_MAX_ATTEMPTS = 10;
const STATS_LOGIN_WINDOW       = 3600;

function stats_login_attempt_file(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return stats_cache_dir() . '/ratelimit_stats_login_' . md5($ip) . '.json';
}

function stats_login_attempts(): array {
    $file = stats_login_attempt_file();
    if (!file_exists($file)) return [];
    $raw   = file_get_contents($file);
    $times = ($raw !== false) ? (json_decode($raw, true) ?: []) : [];
    $now   = time();
    return array_values(array_filter($times, function ($t) use ($now) {
        return ($now - (int)$t) < STATS_LOGIN_WINDOW;
    }));
}

function stats_login_attempts_exhausted(): bool {
    return count(stats_login_attempts()) >= STATS_LOGIN_MAX_ATTEMPTS;
}

function stats_record_login_attempt(): void {
    $times   = stats_login_attempts();
    $times[] = time();
    @file_put_contents(stats_login_attempt_file(), json_encode($times), LOCK_EX);
}
