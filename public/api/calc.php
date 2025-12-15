<?php

declare(strict_types=1);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$requiredFields = ['load_port', 'discharge_port', 'cargo', 'quantity_bracket'];
foreach ($requiredFields as $field) {
    if (!isset($input[$field]) || $input[$field] === '' || $input[$field] === null) {
        http_response_code(400);
        echo json_encode(['error' => "Missing field: {$field}"]);
        exit;
    }
}

$configPath = realpath(__DIR__ . '/../data/freight_config.json');
if ($configPath === false || !file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration file not found']);
    exit;
}

$configContents = file_get_contents($configPath);
$config = json_decode($configContents, true);
if (!is_array($config)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration file is malformed']);
    exit;
}

$meta = $config['meta'] ?? [];
$coefficients = $meta['coefficients'] ?? [];
$quantityBracketId = (string) $input['quantity_bracket'];

if (!array_key_exists($quantityBracketId, $coefficients)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown quantity bracket']);
    exit;
}

$loadPorts = $config['load_ports'] ?? [];
$dischargePorts = $config['discharge_ports'] ?? [];
$cargoStowage = $config['cargo_stowage'] ?? [];

if (!in_array($input['load_port'], $loadPorts, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Load port is not in the approved list']);
    exit;
}

if (!in_array($input['discharge_port'], $dischargePorts, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Discharge port is not in the approved list']);
    exit;
}

$cargoMap = [];
foreach ($cargoStowage as $cargoEntry) {
    if (isset($cargoEntry['cargo'], $cargoEntry['stowage_cbft_per_mt'])) {
        $cargoMap[$cargoEntry['cargo']] = (float) $cargoEntry['stowage_cbft_per_mt'];
    }
}

$cargoName = (string) $input['cargo'];
if (!array_key_exists($cargoName, $cargoMap)) {
    http_response_code(400);
    echo json_encode(['error' => 'Cargo is not in the approved list']);
    exit;
}

$routeData = null;
foreach ($config['routes'] ?? [] as $route) {
    if (
        isset($route['load_port'], $route['discharge_port'], $route['cargo'])
        && $route['load_port'] === $input['load_port']
        && $route['discharge_port'] === $input['discharge_port']
        && $route['cargo'] === $cargoName
    ) {
        $routeData = $route;
        break;
    }
}

if ($routeData === null) {
    http_response_code(404);
    echo json_encode(['error' => 'No data available for the selected route.']);
    exit;
}

$baseRate = isset($routeData['base_rate_20000_usd_mt'])
    ? (float) $routeData['base_rate_20000_usd_mt']
    : null;

if ($baseRate === null || $baseRate <= 0) {
    http_response_code(500);
    echo json_encode(['error' => 'Base rate is missing or invalid for the selected route']);
    exit;
}

$coefficient = (float) $coefficients[$quantityBracketId];
$rateUsdMt = round($baseRate * $coefficient, 1);

$distanceNm = isset($routeData['distance_nm']) && is_numeric($routeData['distance_nm'])
    ? (float) $routeData['distance_nm']
    : null;

$speedKnots = isset($meta['speed_knots']) ? (float) $meta['speed_knots'] : null;
$durationDays = null;
if ($distanceNm !== null && $speedKnots !== null && $speedKnots > 0) {
    $durationDays = round($distanceNm / $speedKnots / 24, 1);
}

$response = [
    'currency' => $meta['currency'] ?? 'USD',
    'base_quantity_mt' => $meta['base_quantity_mt'] ?? 20000,
    'speed_knots' => $speedKnots,
    'last_update' => $meta['last_update'] ?? null,
    'rate_usd_mt' => $rateUsdMt,
    'base_rate_20000_usd_mt' => $baseRate,
    'coefficient' => $coefficient,
    'quantity_bracket' => $quantityBracketId,
    'stowage_cbft_per_mt' => $cargoMap[$cargoName],
    'voyage' => [
        'distance_nm' => $distanceNm,
        'duration_days' => $durationDays,
    ],
];

echo json_encode($response);
