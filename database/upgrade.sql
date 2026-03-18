SET @dbname = DATABASE();

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bankruptcy_count'
        ),
        'SELECT 1',
        'ALTER TABLE users ADD COLUMN bankruptcy_count INT NOT NULL DEFAULT 0'
    )
);
PREPARE ensure_users_bankruptcy_count FROM @stmt;
EXECUTE ensure_users_bankruptcy_count;
DEALLOCATE PREPARE ensure_users_bankruptcy_count;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'session_token'
        ),
        'SELECT 1',
        'ALTER TABLE users ADD COLUMN session_token VARCHAR(100) NULL'
    )
);
PREPARE ensure_users_session_token FROM @stmt;
EXECUTE ensure_users_session_token;
DEALLOCATE PREPARE ensure_users_session_token;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'users' AND COLUMN_NAME = 'has_fotobox_access'
        ),
        'SELECT 1',
        'ALTER TABLE users ADD COLUMN has_fotobox_access BOOLEAN NOT NULL DEFAULT FALSE'
    )
);
PREPARE ensure_users_has_fotobox_access FROM @stmt;
EXECUTE ensure_users_has_fotobox_access;
DEALLOCATE PREPARE ensure_users_has_fotobox_access;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'dealers' AND COLUMN_NAME = 'current_game'
        ),
        'SELECT 1',
        'ALTER TABLE dealers ADD COLUMN current_game VARCHAR(50) NULL'
    )
);
PREPARE ensure_dealers_current_game FROM @stmt;
EXECUTE ensure_dealers_current_game;
DEALLOCATE PREPARE ensure_dealers_current_game;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'dealers' AND COLUMN_NAME = 'last_activity_at'
        ),
        'SELECT 1',
        'ALTER TABLE dealers ADD COLUMN last_activity_at TIMESTAMP NULL'
    )
);
PREPARE ensure_dealers_last_activity_at FROM @stmt;
EXECUTE ensure_dealers_last_activity_at;
DEALLOCATE PREPARE ensure_dealers_last_activity_at;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'dealers' AND COLUMN_NAME = 'session_token'
        ),
        'SELECT 1',
        'ALTER TABLE dealers ADD COLUMN session_token VARCHAR(50) NULL'
    )
);
PREPARE ensure_dealers_session_token FROM @stmt;
EXECUTE ensure_dealers_session_token;
DEALLOCATE PREPARE ensure_dealers_session_token;

CREATE TABLE IF NOT EXISTS game_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_key VARCHAR(50) NOT NULL,
    game_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_game_settings_game_key (game_key)
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dealer_id INT NOT NULL,
    user_id INT NOT NULL,
    game VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    CONSTRAINT fk_table_sessions_dealer FOREIGN KEY (dealer_id) REFERENCES dealers(id),
    CONSTRAINT fk_table_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_user_id'
        ),
        'SELECT 1',
        'CREATE INDEX idx_transactions_user_id ON transactions(user_id)'
    )
);
PREPARE ensure_idx_transactions_user_id FROM @stmt;
EXECUTE ensure_idx_transactions_user_id;
DEALLOCATE PREPARE ensure_idx_transactions_user_id;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_transactions_timestamp'
        ),
        'SELECT 1',
        'CREATE INDEX idx_transactions_timestamp ON transactions(timestamp)'
    )
);
PREPARE ensure_idx_transactions_timestamp FROM @stmt;
EXECUTE ensure_idx_transactions_timestamp;
DEALLOCATE PREPARE ensure_idx_transactions_timestamp;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'table_sessions' AND INDEX_NAME = 'idx_table_sessions_dealer'
        ),
        'SELECT 1',
        'CREATE INDEX idx_table_sessions_dealer ON table_sessions(dealer_id)'
    )
);
PREPARE ensure_idx_table_sessions_dealer FROM @stmt;
EXECUTE ensure_idx_table_sessions_dealer;
DEALLOCATE PREPARE ensure_idx_table_sessions_dealer;

SET @stmt = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'table_sessions' AND INDEX_NAME = 'idx_table_sessions_active'
        ),
        'SELECT 1',
        'CREATE INDEX idx_table_sessions_active ON table_sessions(dealer_id, left_at)'
    )
);
PREPARE ensure_idx_table_sessions_active FROM @stmt;
EXECUTE ensure_idx_table_sessions_active;
DEALLOCATE PREPARE ensure_idx_table_sessions_active;
