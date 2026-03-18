<?php
/**
 * Avatar Upload Handler für mikesBAR PartyPoker
 * Speichert hochgeladene Avatar-Bilder und gibt die URL zurück
 */

// Same-Origin CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigin = '';

if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    if (is_string($originHost) && $originHost === $host) {
        $allowedOrigin = $origin;
    }
}

if ($allowedOrigin === '' && $host !== '') {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $allowedOrigin = $scheme . '://' . $host;
}

if ($allowedOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Nur POST erlauben
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Prüfe ob Datei vorhanden
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error']);
    exit();
}

$file = $_FILES['file'];

// Erlaubte Dateitypen
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Allowed: jpg, png, gif, webp']);
    exit();
}

// Max 5MB
$maxSize = 5 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large. Max 5MB']);
    exit();
}

// Generiere einzigartigen Dateinamen
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$extension = strtolower($extension);
if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
    $extension = 'jpg'; // Fallback
}

$userId = isset($_POST['userId']) ? preg_replace('/[^0-9]/', '', $_POST['userId']) : '0';
$filename = $userId . '_' . bin2hex(random_bytes(8)) . '.' . $extension;

// Speichere Datei
$uploadDir = __DIR__ . '/';
$targetPath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit();
}

// Generiere öffentliche URL
$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$path = dirname($_SERVER['REQUEST_URI']);
$avatarUrl = $protocol . '://' . $host . $path . '/' . $filename;

// Erfolg
http_response_code(200);
echo json_encode([
    'success' => true,
    'avatarUrl' => $avatarUrl,
    'filename' => $filename
]);
