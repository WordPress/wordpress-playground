/**
 * Prepares the database for the hosting ZIP. The live WordPress instance is
 * used to identify and validate the account; all writes go to the backup.
 */
export const zipExportAdminPhp = `
function playground_prepare_export_database($document_root, $snapshot_path, $new_login) {
    global $wpdb;

    if (!defined('DB_ENGINE') || DB_ENGINE !== 'sqlite') {
        throw new InvalidArgumentException('Changing the ZIP username requires a Playground SQLite site.');
    }

    $configured_path = defined('DB_PATH') ? DB_PATH : (defined('FQDB') ? FQDB : '');
    $db_path = realpath($configured_path);
    $content_prefix = $document_root . '/wp-content/';
    if ($db_path !== $configured_path || strpos($db_path, $content_prefix) !== 0 || !is_file($db_path)) {
        throw new InvalidArgumentException('The SQLite database must be inside wp-content to include it in the ZIP.');
    }

    $user = get_user_by('login', 'admin');
    if (!$user || (!in_array('administrator', $user->roles, true) && !is_super_admin($user->ID))) {
        throw new InvalidArgumentException('This site has no administrator named admin. Use Download as .zip to keep its existing usernames.');
    }
    if (
        '' === $new_login || '0' === $new_login || 0 === strcasecmp($new_login, 'admin')
        || !validate_username($new_login) || mb_strlen($new_login) > 60
        || in_array(strtolower($new_login), array_map('strtolower', (array) apply_filters('illegal_user_logins', array())), true)
    ) {
        throw new InvalidArgumentException('Enter a valid WordPress username other than admin (up to 60 characters).');
    }

    // A file copy can miss committed pages in the write-ahead log.
    $source = new SQLite3($db_path, SQLITE3_OPEN_READONLY);
    $source->enableExceptions(true);
    $snapshot = new SQLite3($snapshot_path);
    $snapshot->enableExceptions(true);
    if (!$source->backup($snapshot)) {
        throw new RuntimeException('Could not take a SQLite snapshot for the ZIP.');
    }

    // Package one self-contained database, regardless of the live journal mode.
    $snapshot->exec('PRAGMA journal_mode = DELETE');
    $snapshot->exec('PRAGMA secure_delete = ON');
    $snapshot->exec('BEGIN');
    $users_table = '"' . str_replace('"', '""', $wpdb->users) . '"';
    $lookup = $snapshot->prepare('SELECT ID FROM ' . $users_table . ' WHERE user_login = :login COLLATE NOCASE');
    $lookup->bindValue(':login', $new_login, SQLITE3_TEXT);
    $match = $lookup->execute();
    $taken = $match->fetchArray();
    $match->finalize();
    $lookup->close();
    if ($taken) {
        throw new InvalidArgumentException('That username is already in use.');
    }

    // Keep the ID, password, author slug, and all other user fields.
    $update = $snapshot->prepare('UPDATE ' . $users_table . ' SET user_login = :new_login WHERE ID = :id AND user_login = :old_login COLLATE BINARY');
    $update->bindValue(':new_login', $new_login, SQLITE3_TEXT);
    $update->bindValue(':old_login', $user->user_login, SQLITE3_TEXT);
    $update->bindValue(':id', $user->ID, SQLITE3_INTEGER);
    $update->execute()->finalize();
    $update->close();
    if (1 !== $snapshot->changes()) {
        throw new RuntimeException('The admin account changed before the export could be prepared.');
    }

    if (is_multisite()) {
        if (isset($GLOBALS['super_admins'])) {
            throw new InvalidArgumentException('This network sets super admins in code. Use Download as .zip to preserve that configuration.');
        }
        playground_rename_export_super_admin($snapshot, $wpdb->site, $wpdb->sitemeta, $user->user_login, $new_login);
    }
    $snapshot->exec('COMMIT');
    $snapshot->close();
    $source->close();

    return $db_path;
}

/**
 * Network super admins are keyed by login. Update the exact entry in each
 * network, including networks that rely on WordPress's implicit admin list.
 */
function playground_rename_export_super_admin($db, $networks, $metadata, $old_login, $new_login) {
    $networks = '"' . str_replace('"', '""', $networks) . '"';
    $metadata = '"' . str_replace('"', '""', $metadata) . '"';
    $rows = $db->query("SELECT network.id, meta.meta_id, meta.meta_value FROM " . $networks . " AS network
        LEFT JOIN " . $metadata . " AS meta ON meta.site_id = network.id AND meta.meta_key = 'site_admins'");
    $updates = array();
    while ($row = $rows->fetchArray(SQLITE3_ASSOC)) {
        $admins = $row['meta_id'] === null
            ? array('admin')
            : unserialize($row['meta_value'], array('allowed_classes' => false));
        if (!is_array($admins) || !in_array($old_login, $admins, true)) {
            continue;
        }
        foreach ($admins as &$admin) {
            if ($admin === $old_login) {
                $admin = $new_login;
            }
        }
        unset($admin);
        $updates[] = array($row, serialize($admins));
    }
    $rows->finalize();

    foreach ($updates as $update) {
        list($row, $admins) = $update;
        if ($row['meta_id'] === null) {
            $statement = $db->prepare("INSERT INTO " . $metadata . " (site_id, meta_key, meta_value) VALUES (:id, 'site_admins', :admins)");
            $statement->bindValue(':id', $row['id'], SQLITE3_INTEGER);
        } else {
            $statement = $db->prepare('UPDATE ' . $metadata . ' SET meta_value = :admins WHERE meta_id = :id');
            $statement->bindValue(':id', $row['meta_id'], SQLITE3_INTEGER);
        }
        $statement->bindValue(':admins', $admins, SQLITE3_TEXT);
        $statement->execute()->finalize();
        $statement->close();
    }
}
`;
