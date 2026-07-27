<?php
// Accepts POST { rating: "up"|"down", comment: "...", context: {...} }
// Appends one JSON line per submission to logs/feedback.log
// logs/ is blocked from direct browser access via logs/.htaccess

require_once __DIR__ . '/helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

check_origin();

$data    = json_decode(file_get_contents('php://input'), true);
$rating  = $data['rating'] ?? '';
$comment = mb_substr(strip_tags(trim($data['comment'] ?? '')), 0, 500);
$context = $data['context'] ?? [];

if (!in_array($rating, ['up', 'down'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid rating']);
    exit;
}

$logDir = __DIR__ . '/logs';
enforce_rate_limit($logDir, 'ratelimit_feedback_', 5);

$entry = json_encode([
    'timestamp' => gmdate('c'),
    'rating'    => $rating,
    'comment'   => $comment,
    'ip'        => anonymize_ip($_SERVER['REMOTE_ADDR'] ?? ''),
    'context'   => $context,
]) . "\n";

$ok = file_put_contents($logDir . '/feedback-' . gmdate('Y-m') . '.log', $entry, FILE_APPEND | LOCK_EX);

if ($ok === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not write log']);
    exit;
}

echo json_encode(['success' => true]);
