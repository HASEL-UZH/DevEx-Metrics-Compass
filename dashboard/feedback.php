<?php
// Accepts POST { rating: "up"|"down", comment: "..." }
// Appends one JSON line per submission to feedback.log (same directory)
// feedback.log is blocked from direct browser access via .htaccess

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data    = json_decode(file_get_contents('php://input'), true);
$rating  = $data['rating']  ?? '';
$comment = mb_substr(trim($data['comment'] ?? ''), 0, 2000);
$context = $data['context'] ?? [];  // step, activeFilters, shortlistCount

// Only accept valid rating values
if (!in_array($rating, ['up', 'down'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid rating']);
    exit;
}

// Anonymize IP: last octet zeroed for IPv4, last 80 bits zeroed for IPv6
$raw_ip   = $_SERVER['REMOTE_ADDR'] ?? '';
$anon_ip  = '';
if (filter_var($raw_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
    $anon_ip = preg_replace('/\.\d+$/', '.0', $raw_ip);
} elseif (filter_var($raw_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
    $anon_ip = inet_ntop(substr(inet_pton($raw_ip), 0, 6) . str_repeat("\x00", 10));
}

$entry = json_encode([
    'timestamp' => gmdate('c'),  // ISO 8601 in UTC, e.g. 2026-04-23T14:05:00+00:00
    'rating'    => $rating,     // "up" or "down"
    'comment'   => $comment,    // may be empty string
    'ip'        => $anon_ip,    // anonymized: IPv4 last octet zeroed, IPv6 last 80 bits zeroed
    'context'   => $context,    // step, activeFilters (non-default only), shortlistCount
]) . "\n";

file_put_contents(__DIR__ . '/feedback.log', $entry, FILE_APPEND | LOCK_EX);
echo json_encode(['success' => true]);


?>