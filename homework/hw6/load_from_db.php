<?php
include 'db.php';

$stmt = $pdo->query("SELECT * FROM transactions ORDER BY date");
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($data);
?>
