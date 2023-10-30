<?php

$pdo = new PDO('sqlite://wordpress/wp-content/database/.ht.sqlite');

try {
    $new_value = mt_rand(1, 100) * 100_000;
    $stmt = $pdo->prepare("UPDATE sqlite_sequence SET seq = :new_seq where seq < :new_seq");
    $stmt->bindParam(':new_seq', $new_value);
    $stmt->execute();
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
