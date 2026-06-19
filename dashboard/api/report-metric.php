<?php
// Accepts POST { mode, metricName, source, description, email }
// Appends one JSON line per submission to logs/report-metric-log.json
// logs/ is blocked from direct browser access via logs/.htaccess

require_once __DIR__ . '/helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

check_origin();

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['metricName']) || empty($data['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$mode = $data['mode'] ?? '';
if (!in_array($mode, ['missing', 'wrong'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid mode']);
    exit;
}

$logDir = __DIR__ . '/logs';
enforce_rate_limit($logDir, 'ratelimit_', 20);

$entry = [
    'timestamp'   => gmdate('c'),
    'mode'        => $mode,
    'metricName'  => mb_substr(strip_tags($data['metricName']  ?? ''), 0, 200),
    'source'      => mb_substr(strip_tags($data['source']      ?? ''), 0, 500),
    'description' => mb_substr(strip_tags($data['description'] ?? ''), 0, 500),
    'email'       => mb_substr(strip_tags($data['email']       ?? ''), 0, 200),
    'ip'          => anonymize_ip($_SERVER['REMOTE_ADDR'] ?? ''),
];

$line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
$ok   = file_put_contents($logDir . '/report-metric-log.json', $line, FILE_APPEND | LOCK_EX);

if ($ok === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not write log']);
    exit;
}

echo json_encode(['success' => true]);
