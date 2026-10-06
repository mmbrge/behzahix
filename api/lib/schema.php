<?php
// BEHIX — MySQL schema (MySQL 5.7+ / MariaDB 10.3+). JSON is stored in LONGTEXT
// columns for compatibility with older shared hosts.
if (!defined('BX')) { http_response_code(403); exit; }

// Bump when tables are added; existing installs pick them up on the next request.
const BX_SCHEMA_VERSION = 12;

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
        ['services', 'delivery', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['users', 'session_ver', 'INT UNSIGNED NOT NULL DEFAULT 0'], // v10 — «sign out everywhere»
        ['users', 'pro_until', 'DATETIME NULL'], // v11 — X PRO membership
        ['users', 'pro_biz', 'TINYINT(1) NOT NULL DEFAULT 0'],
        ['studio_items', 'thumb', 'MEDIUMTEXT NULL'], // v11 — small preview for «my designs»
        ['studio_items', 'via', "VARCHAR(8) NOT NULL DEFAULT ''"], // pay | pro
    ];
}

// One-time data changes when an install moves past a version
function bx_migrate(int $from): void
{
    if ($from < 11) {
        // market-based prices (Oct 2026): only rows still at the old default are changed
        $svc = ['pptx' => [1500000, 690000], 'resume' => [900000, 450000], 'excel' => [2000000, 1800000], 'docs' => [1800000, 1600000], 'landing' => [6000000, 5600000],
            'corporate' => [14000000, 23000000], 'shop' => [22000000, 32000000], 'uiux' => [8000000, 7400000], 'seo' => [5000000, 4600000], 'ai-teaser' => [3500000, 3100000],
            'motion' => [5000000, 4700000], 'edit' => [1500000, 1390000], 'lipsync' => [2500000, 2300000], 'reels' => [2400000, 2200000], 'logo' => [4000000, 2900000],
            'poster' => [700000, 590000], 'social' => [2000000, 1690000], 'ai-art' => [1200000, 990000], 'packaging' => [3500000, 3200000], 'chatbot' => [7000000, 6500000],
            'automation' => [6000000, 5500000], 'infra' => [3000000, 2790000]];
        foreach ($svc as $id => [$old, $new]) q('UPDATE services SET base = ? WHERE id = ? AND base = ?', [$new, $id, $old]);
        $st = jdec((string) val("SELECT v FROM settings WHERE k = 'studio'"), null);
        if (is_array($st)) {
            $old = ['resume' => 290000, 'card' => 190000, 'post' => 90000, 'doc' => 150000, 'slides' => 390000, 'pageCardMonth' => 99000, 'pageCardYear' => 790000, 'pageMenuMonth' => 149000, 'pageMenuYear' => 1190000];
            $new = ['resume' => 45000, 'card' => 89000, 'post' => 45000, 'doc' => 49000, 'slides' => 129000, 'pageCardMonth' => 29000, 'pageCardYear' => 265000, 'pageMenuMonth' => 169000, 'pageMenuYear' => 1690000];
            foreach ($old as $k => $v) if ((int) ($st[$k] ?? -1) === $v) $st[$k] = $new[$k];
            q("UPDATE settings SET v = ? WHERE k = 'studio'", [jenc($st)]);
        }
        q('UPDATE doc_templates SET price = NULL WHERE price = 150000');
    }
    if ($from < 12) {
        // +50% on everything except corporate and shop sites; new office services, packages and shop categories
        $cat = json_decode((string) file_get_contents(__DIR__ . '/catalog.json'), true);
        $v11 = ['pptx' => 690000, 'resume' => 450000, 'excel' => 1800000, 'docs' => 1600000, 'landing' => 5600000, 'uiux' => 7400000, 'seo' => 4600000, 'ai-teaser' => 3100000, 'motion' => 4700000, 'edit' => 1390000, 'lipsync' => 2300000, 'reels' => 2200000, 'logo' => 2900000, 'poster' => 590000, 'social' => 1690000, 'ai-art' => 990000, 'packaging' => 3200000, 'chatbot' => 6500000, 'automation' => 5500000, 'infra' => 2790000];
        foreach ($cat['catalog'] as $c) {
            q('INSERT IGNORE INTO categories (id, title, en, icon, hue, descr, sort, active) VALUES (?,?,?,?,?,?,?,1)', [$c['id'], $c['title'], $c['en'], $c['icon'], $c['hue'], $c['desc'], $c['sort']]);
            if ($c['id'] === 'office') q('UPDATE categories SET descr = ? WHERE id = ?', [$c['desc'], 'office']);
            foreach ($c['services'] as $sv) {
                $cur = row('SELECT base FROM services WHERE id = ?', [$sv['id']]);
                if (!$cur) {
                    insert('services', ['id' => $sv['id'], 'category_id' => $c['id'], 'title' => $sv['title'], 'icon' => $sv['icon'], 'base' => $sv['base'], 'days' => $sv['days'], 'descr' => $sv['desc'], 'fields' => jenc($sv['fields']), 'sort' => $sv['sort'], 'active' => 1]);
                } elseif (isset($v11[$sv['id']]) && (int) $cur['base'] === $v11[$sv['id']]) {
                    q('UPDATE services SET base = ?, fields = ? WHERE id = ?', [$sv['base'], jenc($sv['fields']), $sv['id']]);
                }
            }
        }
        foreach ($cat['productCategories'] as $i => $pc) q('INSERT IGNORE INTO product_categories (id, title, icon, sort) VALUES (?,?,?,?)', [$pc['id'], $pc['title'], $pc['icon'], $i]);
        $st = jdec((string) val("SELECT v FROM settings WHERE k = 'studio'"), null);
        if (is_array($st)) {
            $old = ['resume' => 45000, 'card' => 89000, 'post' => 45000, 'doc' => 49000, 'slides' => 129000, 'pageCardMonth' => 29000, 'pageCardYear' => 265000, 'pageMenuMonth' => 169000, 'pageMenuYear' => 1690000];
            $new = ['resume' => 69000, 'card' => 135000, 'post' => 69000, 'doc' => 75000, 'slides' => 195000, 'pageCardMonth' => 45000, 'pageCardYear' => 399000, 'pageMenuMonth' => 255000, 'pageMenuYear' => 2550000];
            foreach ($old as $k => $v) if ((int) ($st[$k] ?? -1) === $v) $st[$k] = $new[$k];
            q("UPDATE settings SET v = ? WHERE k = 'studio'", [jenc($st)]);
        }
        $pro = jdec((string) val("SELECT v FROM settings WHERE k = 'pro'"), null);
        if (is_array($pro) && !empty($pro['plans'])) {
            $map = [89000 => [135000, 0], 249000 => [375000, 405000], 849000 => [1290000, 1620000], 169000 => [255000, 0], 1590000 => [2390000, 3060000]];
            foreach ($pro['plans'] as &$pl) if (isset($map[(int) $pl['price']])) [$pl['price'], $pl['old']] = $map[(int) $pl['price']];
            unset($pl);
            q("UPDATE settings SET v = ? WHERE k = 'pro'", [jenc($pro)]);
        }
    }
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
        // v11 — usage of premium tools and PRO studio allowance
        "CREATE TABLE IF NOT EXISTS usage_log (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NULL,
            ip VARCHAR(45) NOT NULL DEFAULT '',
            k VARCHAR(32) NOT NULL,
            at DATETIME NOT NULL,
            KEY k_user (k, user_id, at),
            KEY k_ip (k, ip, at)
        ) $t",
        // v10 — security: event log, per-IP throttling, blocked addresses
        "CREATE TABLE IF NOT EXISTS security_log (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(20) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            user_id INT UNSIGNED NULL,
            detail VARCHAR(255) NOT NULL DEFAULT '',
            ua VARCHAR(190) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            KEY type_time (type, created_at),
            KEY ip (ip)
        ) $t",
        "CREATE TABLE IF NOT EXISTS throttle (
            k VARCHAR(120) NOT NULL PRIMARY KEY,
            hits INT UNSIGNED NOT NULL DEFAULT 0,
            reset_at INT UNSIGNED NOT NULL
        ) $t",
        "CREATE TABLE IF NOT EXISTS ip_blocks (
            ip VARCHAR(45) NOT NULL PRIMARY KEY,
            reason VARCHAR(190) NOT NULL DEFAULT '',
            until_at DATETIME NULL,
            created_at DATETIME NOT NULL
        ) $t",
        // v9 — studio: self-service builders (resume, card, post, docs, slides) and hosted pages (digital card, QR menu)
        "CREATE TABLE IF NOT EXISTS studio_items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            kind VARCHAR(20) NOT NULL,
            title VARCHAR(190) NOT NULL DEFAULT '',
            data LONGTEXT NOT NULL,
            paid TINYINT(1) NOT NULL DEFAULT 0,
            price BIGINT NOT NULL DEFAULT 0,
            paid_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            KEY user_kind (user_id, kind),
            KEY paid (paid, paid_at)
        ) $t",
        "CREATE TABLE IF NOT EXISTS pages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            kind VARCHAR(12) NOT NULL,
            slug VARCHAR(60) NOT NULL,
            title VARCHAR(190) NOT NULL DEFAULT '',
            data LONGTEXT NOT NULL,
            views INT UNSIGNED NOT NULL DEFAULT 0,
            expires_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE KEY slug (slug),
            KEY user_id (user_id)
        ) $t",
        "CREATE TABLE IF NOT EXISTS doc_templates (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(190) NOT NULL,
            category VARCHAR(80) NOT NULL DEFAULT '',
            descr VARCHAR(300) NOT NULL DEFAULT '',
            body LONGTEXT NOT NULL,
            price BIGINT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            sort INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL
        ) $t",
        // v8 — in-person delivery bookings (date + time slot with capacity)
        "CREATE TABLE IF NOT EXISTS bookings (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            order_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            date DATE NOT NULL,
            slot VARCHAR(20) NOT NULL,
            slot_label VARCHAR(190) NOT NULL DEFAULT '',
            status VARCHAR(12) NOT NULL DEFAULT 'booked',
            note VARCHAR(300) NULL,
            reminded TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            KEY date_slot (date, slot, status),
            KEY order_id (order_id)
        ) $t",
        // v7 — blog
        "CREATE TABLE IF NOT EXISTS posts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(190) NOT NULL,
            title VARCHAR(255) NOT NULL,
            excerpt TEXT NULL,
            body LONGTEXT NULL,
            cover VARCHAR(20) NULL,
            tags LONGTEXT NULL,
            category VARCHAR(80) NOT NULL DEFAULT '',
            status VARCHAR(12) NOT NULL DEFAULT 'draft',
            seo_title VARCHAR(255) NOT NULL DEFAULT '',
            seo_desc VARCHAR(400) NOT NULL DEFAULT '',
            views INT UNSIGNED NOT NULL DEFAULT 0,
            author_id INT UNSIGNED NULL,
            published_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE KEY slug (slug),
            KEY status_time (status, published_at)
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
