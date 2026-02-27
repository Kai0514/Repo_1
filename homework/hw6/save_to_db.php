<?php
include 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

if ($data) {
    $stmt = $pdo->prepare("INSERT INTO transactions (description, date, amount, type) VALUES (?, ?, ?, ?)");
    foreach ($data as $entry) {
        $stmt->execute([
            $entry['description'],
            $entry['date'],
            $entry['amount'],
            $entry['type']
        ]);
    }
    echo "資料已成功儲存！";
} else {
    echo "無效的數據！";
}
?>
