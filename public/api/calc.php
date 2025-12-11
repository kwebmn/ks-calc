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

$requiredFields = ['load_port', 'discharge_country', 'discharge_port', 'cargo', 'stowage_cbft_mt', 'quantity'];
foreach ($requiredFields as $field) {
    if (!isset($input[$field]) || $input[$field] === '' || $input[$field] === null) {
        http_response_code(400);
        echo json_encode(['error' => "Missing field: {$field}"]);
        exit;
    }
}

$quantity = filter_var($input['quantity'], FILTER_VALIDATE_FLOAT);
if ($quantity === false || $quantity < 5000 || $quantity > 50000) {
    http_response_code(400);
    echo json_encode(['error' => 'Quantity must be between 5000 and 50000']);
    exit;
}

$stowage = filter_var($input['stowage_cbft_mt'], FILTER_VALIDATE_FLOAT);
if ($stowage === false || $stowage <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Stowage factor must be greater than 0']);
    exit;
}

$dataDir = realpath(__DIR__ . '/../data');
if ($dataDir === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Data directory not found']);
    exit;
}

function loadJson(string $path): array
{
    $contents = file_get_contents($path);
    if ($contents === false) {
        return [];
    }
    $decoded = json_decode($contents, true);
    return is_array($decoded) ? $decoded : [];
}

$dischargePorts = loadJson($dataDir . '/discharge_ports.json');
if (!isset($dischargePorts[$input['discharge_country']]) || !in_array($input['discharge_port'], $dischargePorts[$input['discharge_country']], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Discharge port does not belong to selected country']);
    exit;
}

$baseRates = loadJson($dataDir . '/base_rates.json');
$baseRate = null;
if (isset($baseRates['by_pair'][$input['load_port']][$input['discharge_port']])) {
    $baseRate = (float) $baseRates['by_pair'][$input['load_port']][$input['discharge_port']];
} elseif (isset($baseRates['fallback_by_discharge_port'][$input['discharge_port']])) {
    $baseRate = (float) $baseRates['fallback_by_discharge_port'][$input['discharge_port']];
}

if ($baseRate === null) {
    http_response_code(400);
    echo json_encode(['error' => 'No base rate for selected route']);
    exit;
}

function clamp(float $value, float $min, float $max): float
{
    return max($min, min($max, $value));
}

$q = $quantity;
$st = $stowage;
$stRef = 47.0;

$qMultRaw = 1 + (20000 - $q) / 100000;
$qMult = clamp($qMultRaw, 0.75, 1.25);
$cargoMult = 1 + ($st - $stRef) / 470;

$rate = $baseRate * $qMult * $cargoMult;
$rateUsdMt = round($rate, 2);

$rateRange = [
    'min' => round($rateUsdMt * 0.97, 2),
    'max' => round($rateUsdMt * 1.03, 2),
];

$totalUsd = round($rateUsdMt * $q, 2);

$response = [
    'rate_usd_mt' => $rateUsdMt,
    'rate_range' => $rateRange,
    'total_usd' => $totalUsd,
    'stowage_cbft_mt' => $st,
    'base_usd_mt' => $baseRate,
    'q_mult' => $qMult,
    'cargo_mult' => $cargoMult,
];

echo json_encode($response);
