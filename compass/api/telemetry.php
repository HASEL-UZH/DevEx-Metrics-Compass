<?php
// Accepts POST { event, session_id, payload }
// Appends one JSON line per call to logs/telemetry.log
// logs/ is blocked from direct browser access via logs/.htaccess

require_once __DIR__ . '/helpers.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

check_origin();

$ALLOWED_EVENTS = [
    'page_load',
    'step_change',
    'filter_changed',
    'filters_cleared',
    'keyword_search',
    'colorby_changed',
    'metric_opened',
    'metric_added',
    'metric_removed',
    'metric_status_changed',
    'shortlist_cleared',
    'wizard_started',
    'wizard_step',
    'wizard_skipped',
    'wizard_completed',
    'wizard_abandoned',
    'wizard_restarted',
    'predefined_company_loaded',
    'import_json',
    'shortlist_link_copied',
    'predefined_framework_loaded',
    'compare_dimension_changed',
    'compare_preset_applied',
    'compare_sorted',
    'comparison_added_to_pdf',
    'comparison_removed_from_pdf',
    'export_pdf',
    'export_json',
    'feedback_submitted',
    'metric_reported',
    'session_end',
    'source_link_clicked',
    'overlay_opened',
    // Fired by the static landing pages under /library/ (js/seo-telemetry.js).
    'seo_page_view',
    'seo_cta_click',
];

$data    = json_decode(file_get_contents('php://input'), true);
$event   = $data['event']      ?? '';
$payload = $data['payload']    ?? [];
$session = preg_replace('/[^a-f0-9]/', '', substr($data['session_id'] ?? '', 0, 16));
$browser         = mb_substr(strip_tags($data['browser']         ?? ''), 0, 30);
$referrer_domain = mb_substr(strip_tags($data['referrer_domain'] ?? ''), 0, 100);

if (!in_array($event, $ALLOWED_EVENTS, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown event type']);
    exit;
}

$logDir = __DIR__ . '/logs';
enforce_rate_limit($logDir, 'ratelimit_telemetry_', 2000);

$entry = json_encode([
    'timestamp'       => gmdate('c'),
    'session_id'      => $session,
    'event'           => $event,
    'payload'         => $payload,
    'ip'              => anonymize_ip($_SERVER['REMOTE_ADDR'] ?? ''),
    'browser'         => $browser,
    'referrer_domain' => $referrer_domain,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

$ok = file_put_contents($logDir . '/telemetry-' . gmdate('Y-m') . '.log', $entry, FILE_APPEND | LOCK_EX);

if ($ok === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not write log']);
    exit;
}

echo json_encode(['success' => true]);
