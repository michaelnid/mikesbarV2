CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    avatar_url VARCHAR(255) NOT NULL DEFAULT '/avatars/default.svg',
    qr_code_uuid CHAR(36) NOT NULL UNIQUE,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    bankruptcy_count INT NOT NULL DEFAULT 0,
    session_token VARCHAR(100) NULL,
    has_fotobox_access BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS dealers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    current_game VARCHAR(50) NULL,
    last_activity_at TIMESTAMP NULL,
    session_token VARCHAR(50) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nfc_cards (
    card_uid VARCHAR(50) PRIMARY KEY,
    user_id INT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nfc_cards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    dealer_id INT NULL,
    game VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_transactions_dealer FOREIGN KEY (dealer_id) REFERENCES dealers(id)
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

CREATE TABLE IF NOT EXISTS game_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_key VARCHAR(50) NOT NULL,
    game_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_game_settings_game_key (game_key)
);
