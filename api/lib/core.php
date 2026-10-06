<?php
// BEHIX — backend core: config, database, session, security and helpers.
// Compatible with PHP 7.4+.
if (!defined('BX')) { http_response_code(403); exit; }

date_default_timezone_set('UTC');

const ROLES = ['customer', 'designer', 'seller', 'admin'];
const USER_STATUSES = ['active', 'pending', 'blocked', 'rejected'];
const ORDER_STATUSES = ['new', 'review', 'in_progress', 'awaiting', 'revision', 'done', 'cancelled'];
const ORDER_LABELS = [
    'new' => 'ثبت شده', 'review' => 'بررسی و پیش‌فاکتور', 'in_progress' => 'در حال انجام',
    'awaiting' => 'منتظر تأیید', 'revision' => 'در حال اصلاح', 'done' => 'تحویل شده', 'cancelled' => 'لغو شده',
];

// ------------------------------------------------------------------ config
function bx_config(): array
{
    static $c = null;
    if ($c === null) {
        $f = __DIR__ . '/../config.php';
        $c = is_file($f) ? (require $f) : [];
    }
    return $c;
}

function installed(): bool
{
    return !empty(bx_config()['db']);
}

// ------------------------------------------------------------------ database
function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = bx_config()['db'] ?? null;
    if (!$c) fail('سایت هنوز نصب نشده است. فایل install.php را اجرا کنید.', 503, 'not_installed');
    try {
        $pdo = new PDO(
            "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4",
            $c['user'],
            $c['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
        );
    } catch (PDOException $e) {
        fail('اتصال به پایگاه داده برقرار نشد.', 500, 'db');
    }
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function q(string $sql, array $p = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($p);
    return $st;
}
function row(string $sql, array $p = []): ?array
{
    $r = q($sql, $p)->fetch();
    return $r ?: null;
}
function rows(string $sql, array $p = []): array
{
    return q($sql, $p)->fetchAll();
}
function val(string $sql, array $p = [])
{
    $v = q($sql, $p)->fetchColumn();
    return $v === false ? null : $v;
}
function insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql = "INSERT INTO $table (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
    q($sql, array_values($data));
    return (int) db()->lastInsertId();
}
function update(string $table, array $data, string $where, array $wp = []): void
{
    $set = implode(',', array_map(function ($c) { return "$c = ?"; }, array_keys($data)));
    q("UPDATE $table SET $set WHERE $where", array_merge(array_values($data), $wp));
}

function now(): string
{
    return gmdate('Y-m-d H:i:s');
}
function ms(?string $dt): ?int
{
    return $dt ? strtotime($dt . ' UTC') * 1000 : null;
}
function jdec(?string $s, $default = [])
{
    if ($s === null || $s === '') return $default;
    $v = json_decode($s, true);
    return $v === null ? $default : $v;
}
function jenc($v): string
{
    return json_encode($v, JSON_UNESCAPED_UNICODE);
}

// ------------------------------------------------------------------ http
function out($data = []): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400, string $err = 'error'): void
{
    http_response_code($code);
    out(['error' => $err, 'message' => $msg]);
}
function input(): array
{
    static $in = null;
    if ($in === null) {
        $in = $_POST;
        $raw = file_get_contents('php://input');
        if ($raw && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
            $j = json_decode($raw, true);
            if (is_array($j)) $in = array_merge($in, $j);
        }
        // multipart requests send JSON params in a "payload" field
        if (isset($in['payload']) && is_string($in['payload'])) {
            $j = json_decode($in['payload'], true);
            if (is_array($j)) $in = array_merge($in, $j);
        }
    }
    return $in;
}
function in(string $k, $default = null)
{
    $in = input();
    return array_key_exists($k, $in) ? $in[$k] : $default;
}
function str_in(string $k, int $max = 255): string
{
    $v = in($k, '');
    if (!is_scalar($v)) return '';
    return mb_substr(trim((string) $v), 0, $max);
}
function int_in(string $k, int $default = 0): int
{
    $v = in($k, $default);
    return (int) en_digits(is_scalar($v) ? (string) $v : (string) $default);
}
function arr_in(string $k): array
{
    $v = in($k, []);
    return is_array($v) ? $v : [];
}
function en_digits(string $s): string
{
    return strtr($s, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']);
}
function amount_in(string $k): int
{
    $v = in($k, 0);
    $s = en_digits(is_scalar($v) ? (string) $v : '0');
    return (int) preg_replace('/\D/', '', $s);
}
function phone_in(string $k = 'phone'): string
{
    $p = preg_replace('/\D/', '', en_digits(str_in($k, 20)));
    if (strpos($p, '98') === 0 && strlen($p) === 12) $p = '0' . substr($p, 2);
    if (strlen($p) === 10 && $p[0] === '9') $p = '0' . $p;
    if (!preg_match('/^09\d{9}$/', $p)) fail('شماره موبایل معتبر نیست.', 422);
    return $p;
}
function fa_digits($s): string
{
    return strtr((string) $s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
}
function toman(int $n): string
{
    return fa_digits(number_format($n)) . ' تومان';
}
function base_url(): string
{
    $c = bx_config();
    if (!empty($c['url'])) return rtrim($c['url'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $dir = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'))), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}

// ------------------------------------------------------------------ session & security
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name('BXSESS');
    session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
function csrf_check(): void
{
    $sent = $_SERVER['HTTP_X_CSRF'] ?? (input()['_csrf'] ?? '');
    if (!is_string($sent) || !hash_equals($_SESSION['csrf'] ?? '', $sent)) fail('نشست شما منقضی شده است؛ صفحه را دوباره بارگذاری کنید.', 419, 'csrf');
}
// Simple per-session rate limit: max $max hits per $window seconds for $key
function rate_limit(string $key, int $max, int $window): void
{
    $now = time();
    $hits = array_filter($_SESSION['rl'][$key] ?? [], function ($t) use ($now, $window) { return $t > $now - $window; });
    if (count($hits) >= $max) fail('تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.', 429, 'rate');
    $hits[] = $now;
    $_SESSION['rl'][$key] = array_values($hits);
}

function me(): ?array
{
    static $cache = [null, null];
    $id = $_SESSION['uid'] ?? null;
    if ($cache[0] === $id && $cache[1] !== null) return $cache[1];
    $u = $id ? row('SELECT * FROM users WHERE id = ?', [$id]) : null;
    if ($u && $u['status'] === 'blocked') {
        unset($_SESSION['uid']);
        $u = null;
    }
    // signed out everywhere (password change / admin «sign out all devices»)
    if ($u && isset($u['session_ver']) && (int) $u['session_ver'] !== (int) ($_SESSION['sv'] ?? 0)) {
        unset($_SESSION['uid']);
        $u = null;
    }
    $cache = [$id, $u];
    return $u;
}
function require_user(string ...$roles): array
{
    $u = me();
    if (!$u) fail('ابتدا وارد حساب کاربری شوید.', 401, 'auth');
    if ($roles && !in_array($u['role'], $roles, true)) fail('دسترسی ندارید.', 403, 'forbidden');
    return $u;
}
function require_active(string ...$roles): array
{
    $u = require_user(...$roles);
    if ($u['status'] !== 'active') fail('حساب شما هنوز تأیید نشده است.', 403, 'pending');
    return $u;
}
function login_as(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    if (function_exists('session_mark')) session_mark($id);
}

// ------------------------------------------------------------------ settings
// Existing installs get new tables automatically (CREATE TABLE IF NOT EXISTS).
function ensure_schema(): void
{
    require_once __DIR__ . '/schema.php';
    $v = (int) val("SELECT v FROM settings WHERE k = 'schema_version'");
    if ($v >= BX_SCHEMA_VERSION) return;
    foreach (bx_schema() as $sql) db()->exec($sql);
    foreach (bx_columns() as [$table, $col, $def]) {
        $has = val('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$table, $col]);
        if (!$has) db()->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def");
    }
    bx_migrate($v);
    q("INSERT INTO settings (k, v) VALUES ('schema_version', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [(string) BX_SCHEMA_VERSION]);
}
function settings(): array
{
    static $s = null;
    if ($s !== null) return $s;
    require_once __DIR__ . '/defaults.php';
    $s = default_settings();
    foreach (rows('SELECT k, v FROM settings') as $r) {
        $v = jdec($r['v'], null);
        if (is_array($v) && isset($s[$r['k']]) && is_array($s[$r['k']])) $s[$r['k']] = array_replace($s[$r['k']], $v);
        elseif ($v !== null) $s[$r['k']] = $v;
    }
    return $s;
}
function setting(string $group, ?string $key = null, $default = null)
{
    $g = settings()[$group] ?? [];
    if ($key === null) return $g;
    return $g[$key] ?? $default;
}
function save_setting(string $group, $value): void
{
    q('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$group, jenc($value)]);
}

// ------------------------------------------------------------------ domain helpers
function notify(int $userId, string $text, ?string $link = null): void
{
    insert('notifications', ['user_id' => $userId, 'text' => mb_substr($text, 0, 250), 'link' => $link, 'is_read' => 0, 'created_at' => now()]);
}
function notify_admins(string $text, ?string $link = null): void
{
    foreach (rows("SELECT id FROM users WHERE role = 'admin' AND status = 'active'") as $a) notify((int) $a['id'], $text, $link);
}
function tx(int $userId, string $type, int $amount, string $note): void
{
    insert('transactions', ['user_id' => $userId, 'type' => $type, 'amount' => $amount, 'note' => mb_substr($note, 0, 250), 'status' => 'ok', 'created_at' => now()]);
}
function wallet_add(int $userId, int $amount): void
{
    q('UPDATE users SET wallet = wallet + ? WHERE id = ?', [$amount, $userId]);
}

// Platform commission (%) for a designer or seller:
// per-user override > newcomer rate (first N completed jobs/sales) > global rate.
function commission_for(array $u): float
{
    if ($u['commission'] !== null && $u['commission'] !== '') return (float) $u['commission'];
    $c = setting('commission');
    if (!empty($c['newcomerEnabled'])) {
        $done = $u['role'] === 'seller'
            ? (int) val('SELECT COUNT(*) FROM purchases p JOIN products x ON x.id = p.product_id WHERE x.seller_id = ?', [$u['id']])
            : (int) val("SELECT COUNT(*) FROM orders WHERE designer_id = ? AND status = 'done'", [$u['id']]);
        if ($done < (int) $c['newcomerUntil']) return (float) $c['newcomerPercent'];
    }
    return (float) $c['percent'];
}

function catalog(bool $onlyActive = true): array
{
    $cats = rows('SELECT * FROM categories' . ($onlyActive ? ' WHERE active = 1' : '') . ' ORDER BY sort, title');
    $svcs = rows('SELECT * FROM services' . ($onlyActive ? ' WHERE active = 1' : '') . ' ORDER BY sort, title');
    $out = [];
    foreach ($cats as $c) {
        $list = [];
        foreach ($svcs as $s) {
            if ($s['category_id'] !== $c['id']) continue;
            $list[] = ['id' => $s['id'], 'title' => $s['title'], 'icon' => $s['icon'], 'base' => (int) $s['base'], 'days' => (int) $s['days'],
                'desc' => $s['descr'] ?? '', 'fields' => jdec($s['fields'], []), 'sort' => (int) $s['sort'], 'active' => (bool) $s['active'], 'category' => $c['id'],
                'delivery' => !empty($s['delivery'])];
        }
        $out[] = ['id' => $c['id'], 'title' => $c['title'], 'en' => $c['en'] ?? '', 'icon' => $c['icon'], 'hue' => (int) $c['hue'],
            'desc' => $c['descr'] ?? '', 'sort' => (int) $c['sort'], 'active' => (bool) $c['active'], 'services' => $list];
    }
    return $out;
}
function find_service(string $id): ?array
{
    $s = row('SELECT * FROM services WHERE id = ?', [$id]);
    if (!$s) return null;
    $s['fields'] = jdec($s['fields'], []);
    return $s;
}

// Server-side price estimate (mirrors the live estimate in the browser)
function estimate(array $svc, array $details, string $deadline, array $addons): array
{
    $total = (int) $svc['base'];
    foreach ($svc['fields'] as $f) {
        $v = $details[$f['id']] ?? null;
        if (($f['type'] ?? '') === 'number') {
            $n = (int) ($v ?? $f['value'] ?? 0);
            $total += max(0, $n - (int) ($f['included'] ?? 0)) * (int) ($f['perUnit'] ?? 0);
        } elseif (!empty($f['options'])) {
            $vals = is_array($v) ? $v : ($v !== null && $v !== '' ? [$v] : []);
            foreach ($vals as $x) foreach ($f['options'] as $o) if ((string) $o['v'] === (string) $x) $total += (int) ($o['price'] ?? 0);
        }
    }
    $o = setting('orders');
    $dl = null;
    foreach ($o['deadlines'] as $d) if ($d['v'] === $deadline) $dl = $d;
    if (!$dl) $dl = $o['deadlines'][0];
    $pct = 0;
    foreach ($addons as $a) foreach ($o['addons'] as $x) if ($x['v'] === $a) $pct += (float) $x['pct'];
    $total = $total * (float) $dl['mult'] * (1 + $pct);
    return ['total' => max(0, (int) (round($total / 100000) * 100000)), 'days' => max(1, (int) round($svc['days'] * $dl['daysMult']))];
}

function coupon_valid(string $code, ?int $ownerId = null): ?array
{
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    $c = row('SELECT * FROM coupons WHERE code = ? AND active = 1', [$code]);
    if (!$c) return null;
    if ((int) $c['max_uses'] > 0 && (int) $c['uses'] >= (int) $c['max_uses']) return null;
    if ($c['owner_id'] !== null && (int) $c['owner_id'] !== (int) $ownerId) return null;
    return $c;
}

// ------------------------------------------------------------------ JSON shapes for the front-end
function user_out(?array $u, bool $private = false): ?array
{
    if (!$u) return null;
    $o = ['id' => (string) $u['id'], 'name' => $u['name'], 'role' => $u['role'], 'status' => $u['status'], 'hue' => (int) $u['hue'],
        'level' => $u['level'], 'rating' => (float) $u['rating'], 'bio' => $u['bio'], 'shopName' => $u['shop_name'],
        'skills' => jdec($u['skills'], []), 'createdAt' => ms($u['created_at']),
        // X PRO badge (shown next to the user everywhere)
        'pro' => !empty($u['pro_until']) && strtotime($u['pro_until'] . ' UTC') > time(), 'proBiz' => !empty($u['pro_biz']) && !empty($u['pro_until']) && strtotime($u['pro_until'] . ' UTC') > time()];
    if ($private) {
        $o += ['phone' => $u['phone'], 'email' => $u['email'], 'business' => $u['business'], 'card' => $u['card'], 'wallet' => (int) $u['wallet'],
            'commission' => $u['commission'] === null ? null : (float) $u['commission'], 'cats' => jdec($u['cats'], []),
            'portfolioUrl' => $u['portfolio_url'], 'prefs' => jdec($u['prefs'], ['email' => true, 'sms' => true]), 'isDemo' => (bool) $u['is_demo'],
            'proUntil' => !empty($u['pro_until']) ? ms($u['pro_until']) : null];
        if (in_array($u['role'], ['designer', 'seller'], true)) $o['effectiveCommission'] = commission_for($u);
    }
    return $o;
}

function file_out(array $f): array
{
    return ['id' => (string) $f['id'], 'name' => $f['name'], 'size' => (int) $f['size'], 'at' => ms($f['created_at'])];
}

// ------------------------------------------------------------------ referrals
function ref_code_for(int $uid): string
{
    $code = (string) val('SELECT ref_code FROM users WHERE id = ?', [$uid]);
    if ($code !== '') return $code;
    $abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    do {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= $abc[random_int(0, strlen($abc) - 1)];
    } while (val('SELECT id FROM users WHERE ref_code = ?', [$code]));
    q('UPDATE users SET ref_code = ? WHERE id = ?', [$code, $uid]);
    return $code;
}
// Links a freshly created account to the inviter (code sent by the browser as "ref")
function referral_attach(int $newUserId): void
{
    $code = preg_replace('/[^a-z0-9]/', '', strtolower((string) (input()['ref'] ?? '')));
    if ($code === '' || empty(setting('referral', 'enabled'))) return;
    $inviter = (int) val('SELECT id FROM users WHERE ref_code = ?', [$code]);
    if ($inviter && $inviter !== $newUserId) q('UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL', [$inviter, $newUserId]);
}
// After a payment: reward inviter + friend once the friend has spent minPurchase
function referral_check(int $uid): void
{
    $r = setting('referral');
    if (empty($r['enabled'])) return;
    $u = row('SELECT id, name, referred_by, ref_rewarded FROM users WHERE id = ?', [$uid]);
    if (!$u || !$u['referred_by'] || $u['ref_rewarded']) return;
    $spent = -(int) val("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = ? AND type IN ('payment', 'purchase')", [$uid]);
    if ($spent < (int) $r['minPurchase']) return;
    q('UPDATE users SET ref_rewarded = 1 WHERE id = ?', [$uid]);
    $inv = (int) $u['referred_by'];
    if ((int) $r['rewardInviter'] > 0) {
        wallet_add($inv, (int) $r['rewardInviter']);
        tx($inv, 'referral', (int) $r['rewardInviter'], 'هدیه معرفی ' . $u['name']);
        notify($inv, 'دوست شما ' . $u['name'] . ' اولین خریدش را انجام داد؛ ' . toman((int) $r['rewardInviter']) . ' هدیه گرفتید 🎁', 'wallet');
        if (function_exists('sms_user')) sms_user('referral_reward', $inv, ['amount' => number_format((int) $r['rewardInviter'])]);
    }
    if ((int) $r['rewardFriend'] > 0) {
        wallet_add($uid, (int) $r['rewardFriend']);
        tx($uid, 'referral', (int) $r['rewardFriend'], 'هدیه دعوت دوستان');
        notify($uid, toman((int) $r['rewardFriend']) . ' هدیه دعوت به کیف پول شما اضافه شد 🎁', 'wallet');
    }
}

// Deposit the customer may pay first (0 when staged payment does not apply)
function order_deposit(array $o): int
{
    $c = setting('orders');
    $price = $o['quote'] !== null ? (int) $o['quote'] : (int) $o['estimate'];
    if (empty($c['stagedEnabled']) || $o['paid'] || (int) ($o['paid_amount'] ?? 0) > 0 || $price < (int) ($c['stagedMin'] ?? 0)) return 0;
    $pct = max(10, min(90, (int) ($c['stagedPercent'] ?? 50)));
    return (int) (ceil($price * $pct / 100 / 1000) * 1000);
}
function order_out(array $o, bool $full = true, bool $withContact = true): array
{
    $id = (int) $o['id'];
    $out = ['id' => (string) $id, 'code' => $o['code'], 'userId' => (string) $o['user_id'], 'serviceId' => $o['service_id'], 'title' => $o['title'],
        'status' => $o['status'], 'designerId' => $o['designer_id'] ? (string) $o['designer_id'] : null, 'estimate' => (int) $o['estimate'],
        'quote' => $o['quote'] !== null ? (int) $o['quote'] : null, 'discount' => (int) $o['discount'], 'deadline' => $o['deadline'],
        'addons' => jdec($o['addons'], []), 'budget' => $o['budget'], 'details' => jdec($o['details'], []), 'desc' => $o['descr'],
        'style' => jdec($o['style'], []), 'coupon' => $o['coupon'], 'paid' => (bool) $o['paid'], 'paidAmount' => (int) ($o['paid_amount'] ?? 0), 'deposit' => order_deposit($o), 'rating' => $o['rating'] !== null ? (int) $o['rating'] : null,
        'review' => $o['review'], 'applicants' => array_map('strval', jdec($o['applicants'], [])), 'createdAt' => ms($o['created_at'])];
    if ($withContact) $out['contact'] = jdec($o['contact'], []);
    // In-person delivery slot booked with this order (latest non-cancelled, else the latest)
    try {
        $b = row("SELECT * FROM bookings WHERE order_id = ? ORDER BY (status = 'cancelled'), id DESC LIMIT 1", [$id]);
        $out['delivery'] = $b ? ['id' => (int) $b['id'], 'date' => $b['date'], 'slot' => $b['slot'], 'label' => $b['slot_label'], 'status' => $b['status']] : null;
        if (function_exists('order_ready_in')) $out['readyIn'] = order_ready_in($o);
    } catch (Throwable $e) { $out['delivery'] = null; }
    if ($full) {
        $out['timeline'] = array_map(function ($e) { return ['status' => $e['status'], 'note' => $e['note'], 'at' => ms($e['created_at'])]; },
            rows('SELECT * FROM order_events WHERE order_id = ? ORDER BY id', [$id]));
        $out['messages'] = array_map(function ($m) { return ['from' => (string) $m['user_id'], 'text' => $m['body'], 'at' => ms($m['created_at'])]; },
            rows('SELECT * FROM order_messages WHERE order_id = ? ORDER BY id', [$id]));
        $out['deliverables'] = array_map('file_out', rows("SELECT * FROM files WHERE kind = 'deliverable' AND ref_id = ? ORDER BY id", [$id]));
        $out['files'] = array_map('file_out', rows("SELECT * FROM files WHERE kind = 'attachment' AND ref_id = ? ORDER BY id", [$id]));
    } else {
        $out['timeline'] = [];
        $out['messages'] = [];
        $out['deliverables'] = [];
        $out['files'] = [];
    }
    return $out;
}

function product_out(array $p, bool $withFiles = false): array
{
    $o = ['id' => (string) $p['id'], 'sellerId' => (string) $p['seller_id'], 'title' => $p['title'], 'category' => $p['category_id'],
        'price' => (int) $p['price'], 'discount' => (int) $p['discount'], 'sales' => (int) $p['sales'], 'rating' => (float) $p['rating'],
        'status' => $p['status'], 'tags' => jdec($p['tags'], []), 'desc' => $p['descr'], 'image' => $p['image'] ?? null, 'createdAt' => ms($p['created_at']),
        'reviews' => (int) ($p['reviews'] ?? 0),
        'gallery' => array_map('strval', array_column(rows("SELECT id FROM files WHERE kind = 'gallery' AND ref_id = ? ORDER BY id", [$p['id']]), 'id'))];
    if ($withFiles) $o['files'] = array_map('file_out', rows("SELECT * FROM files WHERE kind = 'product' AND ref_id = ?", [$p['id']]));
    return $o;
}
function final_price(array $p): int
{
    return (int) (round(((int) $p['price'] * (100 - (int) $p['discount']) / 100) / 1000) * 1000);
}

function work_out(array $w): array
{
    $img = val("SELECT id FROM files WHERE kind = 'portfolio' AND ref_id = ? ORDER BY id LIMIT 1", [$w['id']]);
    return ['id' => (string) $w['id'], 'title' => $w['title'], 'category' => $w['category_id'], 'serviceId' => $w['service_id'],
        'designerId' => (string) $w['designer_id'], 'likes' => (int) $w['likes'], 'image' => $img ? (string) $img : null, 'createdAt' => ms($w['created_at'])];
}

function order_event(int $orderId, string $status, ?string $note = null): void
{
    q('UPDATE orders SET status = ? WHERE id = ?', [$status, $orderId]);
    insert('order_events', ['order_id' => $orderId, 'status' => $status, 'note' => $note, 'created_at' => now()]);
}
