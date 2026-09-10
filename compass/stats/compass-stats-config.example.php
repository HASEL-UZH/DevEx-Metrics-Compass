<?php
// Template for the stats dashboard's configuration. It is gitignored, lives ONLY on the
// web server, and must never be committed.
//
// WHERE TO PUT IT — index.php checks these paths in order and uses the first READABLE one:
//   1. <domain>/software_data/compass-stats-config.php   ← use this on Hoststar
//   2. <web home>/files/compass-stats-config.php         ← same idea, shared across domains
//   3. <domain>/private/compass-stats-config.php         ← the obvious choice, but see below
//   4. <domain>/compass-stats-config.php                 ← other hosts: above the web root
//   5. compass/stats/compass-stats-config.php            ← last resort, inside the web root:
//                                                           protected only by .htaccess
//
// The document root is <domain>/public_html/, so options 1-4 are all outside it and can
// never be requested over HTTP — the hash stays unreachable even if PHP were to stop
// executing one day and .php files started being served as plain text.
//
// WHY NOT private/, WHICH SOUNDS RIGHT? Shared hosts confine PHP with open_basedir, and on
// Hoststar that list covers public_html, software_data, files and tmp — but NOT private/.
// A config in private/ is therefore invisible to PHP no matter how correct the path looks
// over FTP, and no chmod fixes it. software_data/ is just as unreachable over HTTP and is
// inside open_basedir, so it gets the same protection while actually working.
//
// IF IT IS NOT FOUND, the dashboard prints every path it checked and what it saw at each
// one — "not found", "exists but is not readable" (chmod 644), or "outside open_basedir"
// — followed by the host's actual open_basedir list.
//
// TO ADD A DIFFERENT PATH, edit $configCandidates near the top of compass/stats/index.php.
//
// Generate the password hash on any machine with PHP:
//     php -r "echo password_hash('your-password-here', PASSWORD_DEFAULT), PHP_EOL;"
// then paste the result below. The plain password is never stored anywhere.

return [
    // Output of password_hash() — bcrypt, so it starts with $2y$ and is 60 characters.
    // MUST be in single quotes: in double quotes PHP would read $2y and $10 as variables
    // and silently mangle the hash. The value below is a placeholder and matches nothing.
    'password_hash' => '$2y$10$replace.this.with.the.output.of.password_hash.xxxxxxxxxxxxxxxxxxxxxx',

    // Log out after this many seconds of inactivity.
    'idle_timeout' => 8 * 3600,

    // Timezone used to render timestamps and to cut day boundaries ("today", per-day charts).
    // The logs themselves are always UTC; this only affects display and bucketing.
    'timezone' => 'Europe/Zurich',

    // Your own traffic, so repeated testing does not dominate a small dataset.
    //
    // IMPORTANT — logged IPs are already anonymized by anonymize_ip() in api/helpers.php:
    // IPv4 keeps only the first three octets (1.2.3.4 is stored as 1.2.3.0) and IPv6 only
    // its /48. Anything finer than /24 (IPv4) or /48 (IPv6) can therefore never match and is
    // rejected with a visible warning in the dashboard. A full address is accepted and
    // automatically widened to its /24 — but be aware that this excludes up to 256 addresses,
    // so on a home ISP or a campus network you may also be dropping real visitors.
    //
    // For precise removal of a single visit, use "exclude this session" in the sessions list
    // instead; that is exact and needs no entry here.
    'ignore_ips' => [
        // '85.1.2.0',        // home (whole /24)
        // '130.60.0.0/16',   // UZH campus — WARNING: also hides colleagues and students
    ],
];
