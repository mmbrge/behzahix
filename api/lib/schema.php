<?php
// BEHIX — MySQL schema (MySQL 5.7+ / MariaDB 10.3+). JSON is stored in LONGTEXT
// columns for compatibility with older shared hosts.
if (!defined('BX')) { http_response_code(403); exit; }

// Bump when tables are added; existing installs pick them up on the next request.
const BX_SCHEMA_VERSION = 6;

// Columns added after the first release: [table, column, definition]
function bx_columns(): array
{
    return [
        ['products', 'image', 'VARCHAR(20) NULL'], // v3 — cover image (files.id, kind = cover)
        ['orders', 'paid_amount', 'BIGINT NOT NULL DEFAULT 0'], // v4 — staged (deposit) payments
        ['users', 'ref_code', 'VARCHAR(16) NULL'], // v4 — referral program
        ['users', 'referred_by', 'INT UNSIGNED NULL'],
        ['users', 'ref_rewarded', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['users', 'cart', 'LONGTEXT NULL'], // v4 — server copy of the shop cart (abandoned-cart reminder)
        ['users', 'cart_at', 'DATETIME NULL'],
        ['users', 'cart_reminded', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['products', 'reviews', 'INT UNSIGNED NOT NULL DEFAULT 0'], // v6 — review count (rating = average)
    ];
}

function bx_schema(): array
{
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    return [
        "CREATE TABLE IF NOT EXISTS settings (
            k VARCHAR(64) NOT NULL PRIMARY KEY,
            v LONGTEXT NOT NULL
        ) $t",
        "CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(15) NOT NULL UNIQUE,
            email VARCHAR(190) NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(16) NOT NULL DEFAULT 'customer',
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            business VARCHAR(190) NULL,
            shop_name VARCHAR(190) NULL,
            bio TEXT NULL,
            skills LONGTEXT NULL,
            cats LONGTEXT NULL,
            card VARCHAR(64) NULL,
            level VARCHAR(64) NULL,
            rating DECIMAL(3,2) NOT NULL DEFAULT 0,
            portfolio_url VARCHAR(255) NULL,
            hue SMALLINT NOT NULL DEFAULT 25,
            wallet BIGINT NOT NULL DEFAULT 0,
            commission DECIMAL(5,2) NULL,
            prefs LONGTEXT NULL,
            is_demo TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            INDEX (role), INDEX (status)
        ) $t",
        "CREATE TABLE IF NOT EXISTS categories (
            id VARCHAR(40) NOT NULL PRIMARY KEY,
            title VARCHAR(120) NOT NULL,
            en VARCHAR(60) NULL,
            icon VARCHAR(40) NOT NULL DEFAULT 'sparkle',
            hue SMALLINT NOT NULL DEFAULT 25,
            descr VARCHAR(255) NULL,
            sort INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1
        ) $t",
        "CREATE TABLE IF NOT EXISTS services (
            id VARCHAR(40) NOT NULL PRIMARY KEY,
            category_id VARCHAR(40) NOT NULL,
            title VARCHAR(160) NOT NULL,
            icon VARCHAR(40) NOT NULL DEFAULT 'sparkle',
            base BIGINT NOT NULL DEFAULT 0,
            days INT NOT NULL DEFAULT 3,
            descr TEXT NULL,
            fields LONGTEXT NULL,
            sort INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            INDEX (category_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS product_categories (
            id VARCHAR(40) NOT NULL PRIMARY KEY,
            title VARCHAR(120) NOT NULL,
            icon VARCHAR(40) NOT NULL DEFAULT 'box',
            sort INT NOT NULL DEFAULT 0
        ) $t",
        "CREATE TABLE IF NOT EXISTS products (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            seller_id INT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            category_id VARCHAR(40) NOT NULL,
            price BIGINT NOT NULL DEFAULT 0,
            discount TINYINT UNSIGNED NOT NULL DEFAULT 0,
            sales INT NOT NULL DEFAULT 0,
            rating DECIMAL(3,2) NOT NULL DEFAULT 0,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            tags LONGTEXT NULL,
            descr TEXT NULL,
            image VARCHAR(20) NULL,
            created_at DATETIME NOT NULL,
            INDEX (seller_id), INDEX (status)
        ) $t",
        "CREATE TABLE IF NOT EXISTS orders (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(20) NOT NULL UNIQUE,
            user_id INT UNSIGNED NOT NULL,
            service_id VARCHAR(40) NOT NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'new',
            designer_id INT UNSIGNED NULL,
            estimate BIGINT NOT NULL DEFAULT 0,
            quote BIGINT NULL,
            discount BIGINT NOT NULL DEFAULT 0,
            deadline VARCHAR(16) NOT NULL DEFAULT 'normal',
            addons LONGTEXT NULL,
            budget VARCHAR(120) NULL,
            details LONGTEXT NULL,
            descr TEXT NULL,
            style LONGTEXT NULL,
            contact LONGTEXT NULL,
            coupon VARCHAR(32) NULL,
            paid TINYINT(1) NOT NULL DEFAULT 0,
            rating TINYINT NULL,
            review TEXT NULL,
            applicants LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            INDEX (user_id), INDEX (designer_id), INDEX (status)
        ) $t",
        "CREATE TABLE IF NOT EXISTS order_events (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_id INT UNSIGNED NOT NULL,
            status VARCHAR(16) NOT NULL,
            note VARCHAR(255) NULL,
            created_at DATETIME NOT NULL,
            INDEX (order_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS order_messages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            body TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX (order_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS files (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            owner_id INT UNSIGNED NOT NULL,
            kind VARCHAR(16) NOT NULL,
            ref_id INT UNSIGNED NULL,
            name VARCHAR(190) NOT NULL,
            path VARCHAR(120) NOT NULL,
            size BIGINT NOT NULL DEFAULT 0,
            mime VARCHAR(120) NULL,
            created_at DATETIME NOT NULL,
            INDEX (kind, ref_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS purchases (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            product_id INT UNSIGNED NOT NULL,
            price BIGINT NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX (user_id), INDEX (product_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS transactions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            type VARCHAR(16) NOT NULL,
            amount BIGINT NOT NULL,
            note VARCHAR(255) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'ok',
            created_at DATETIME NOT NULL,
            INDEX (user_id), INDEX (type)
        ) $t",
        "CREATE TABLE IF NOT EXISTS payouts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            amount BIGINT NOT NULL,
            card VARCHAR(64) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL,
            INDEX (user_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS payments (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            purpose VARCHAR(16) NOT NULL,
            ref LONGTEXT NULL,
            amount BIGINT NOT NULL,
            driver VARCHAR(16) NOT NULL,
            authority VARCHAR(120) NULL,
            ref_id VARCHAR(120) NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL,
            INDEX (authority)
        ) $t",
        "CREATE TABLE IF NOT EXISTS tickets (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NULL,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(15) NULL,
            subject VARCHAR(190) NOT NULL,
            message TEXT NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            created_at DATETIME NOT NULL,
            INDEX (user_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS ticket_replies (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            body TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX (ticket_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS coupons (
            code VARCHAR(32) NOT NULL PRIMARY KEY,
            percent TINYINT UNSIGNED NOT NULL,
            uses INT NOT NULL DEFAULT 0,
            max_uses INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            owner_id INT UNSIGNED NULL
        ) $t",
        "CREATE TABLE IF NOT EXISTS notifications (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            text VARCHAR(255) NOT NULL,
            link VARCHAR(64) NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            INDEX (user_id, is_read)
        ) $t",
        "CREATE TABLE IF NOT EXISTS portfolio (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            designer_id INT UNSIGNED NOT NULL,
            title VARCHAR(190) NOT NULL,
            category_id VARCHAR(40) NOT NULL,
            service_id VARCHAR(40) NOT NULL,
            likes INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            INDEX (designer_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS favorites (
            user_id INT UNSIGNED NOT NULL,
            product_id INT UNSIGNED NOT NULL,
            PRIMARY KEY (user_id, product_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS otps (
            phone VARCHAR(15) NOT NULL PRIMARY KEY,
            code_hash VARCHAR(255) NOT NULL,
            purpose VARCHAR(16) NOT NULL,
            attempts TINYINT NOT NULL DEFAULT 0,
            expires_at DATETIME NOT NULL,
            sent_at DATETIME NOT NULL
        ) $t",
        "CREATE TABLE IF NOT EXISTS leads (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL,
            created_at DATETIME NOT NULL
        ) $t",
        // v6 — shop product reviews (buyers only)
        "CREATE TABLE IF NOT EXISTS product_reviews (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            product_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            rating TINYINT UNSIGNED NOT NULL,
            body TEXT NOT NULL,
            reply TEXT NULL,
            hidden TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            UNIQUE KEY one_per_user (product_id, user_id),
            KEY product (product_id, hidden)
        ) $t",
        // v5 — support chat: smart bot + live chat with the admin (every conversation is archived)
        "CREATE TABLE IF NOT EXISTS chats (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            token CHAR(32) NOT NULL,
            user_id INT UNSIGNED NULL,
            name VARCHAR(120) NOT NULL DEFAULT '',
            phone VARCHAR(15) NOT NULL DEFAULT '',
            status VARCHAR(12) NOT NULL DEFAULT 'bot',
            topic VARCHAR(190) NOT NULL DEFAULT '',
            page VARCHAR(120) NOT NULL DEFAULT '',
            device VARCHAR(16) NOT NULL DEFAULT '',
            misses TINYINT UNSIGNED NOT NULL DEFAULT 0,
            rating TINYINT UNSIGNED NULL,
            admin_unread INT UNSIGNED NOT NULL DEFAULT 0,
            user_unread INT UNSIGNED NOT NULL DEFAULT 0,
            rev INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            escalated_at DATETIME NULL,
            UNIQUE KEY token (token),
            KEY status_time (status, updated_at),
            KEY user (user_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            chat_id INT UNSIGNED NOT NULL,
            sender VARCHAR(8) NOT NULL,
            admin_id INT UNSIGNED NULL,
            body TEXT NOT NULL,
            meta TEXT NULL,
            intent VARCHAR(40) NOT NULL DEFAULT '',
            edited TINYINT(1) NOT NULL DEFAULT 0,
            deleted TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            KEY chat (chat_id, id)
        ) $t",
        // v4 — event SMS log
        "CREATE TABLE IF NOT EXISTS sms_log (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            event VARCHAR(32) NOT NULL,
            phone VARCHAR(15) NOT NULL,
            ok TINYINT(1) NOT NULL DEFAULT 0,
            response VARCHAR(190) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            KEY created (created_at)
        ) $t",
        // v2 — free tools: usage log, short links and their clicks
        "CREATE TABLE IF NOT EXISTS tool_events (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            tool VARCHAR(32) NOT NULL,
            user_id INT UNSIGNED NULL,
            visitor CHAR(16) NOT NULL,
            device VARCHAR(16) NOT NULL DEFAULT '',
            meta LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            KEY tool_time (tool, created_at),
            KEY created (created_at)
        ) $t",
        "CREATE TABLE IF NOT EXISTS short_links (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(32) NOT NULL,
            url TEXT NOT NULL,
            user_id INT UNSIGNED NULL,
            visitor CHAR(16) NOT NULL,
            clicks INT UNSIGNED NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            last_click_at DATETIME NULL,
            UNIQUE KEY code (code),
            KEY owner (user_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS short_clicks (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            link_id INT UNSIGNED NOT NULL,
            visitor CHAR(16) NOT NULL,
            device VARCHAR(16) NOT NULL DEFAULT '',
            browser VARCHAR(24) NOT NULL DEFAULT '',
            os VARCHAR(24) NOT NULL DEFAULT '',
            referrer VARCHAR(190) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            KEY link_time (link_id, created_at)
        ) $t",
    ];
}
