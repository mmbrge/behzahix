<?php
// BEHIX — security: IP throttling and blocking, security event log, session
// revocation, admin two-step login, file integrity, backups and the admin
// security report.
if (!defined('BX')) { http_response_code(403); exit; }

function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    // Behind a trusted proxy/CDN (e.g. ArvanCloud) the real address is in a header
    if (!empty(setting('security', 'trustProxy'))) {
        foreach (['HTTP_AR_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
            if (!empty($_SERVER[$h])) { $c = trim(explode(',', (string) $_SERVER[$h])[0]); if (filter_var($c, FILTER_VALIDATE_IP)) return $c; }
        }
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}
function sec_ready(): bool
{
    static $ok = null;
    if ($ok === null) { try { $ok = (bool) val("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'security_log'"); } catch (Throwable $e) { $ok = false; } }
    return $ok;
}
function sec_log(string $type, string $detail = '', ?int $userId = null): void
{
    if (!sec_ready()) return;
    try {
        insert('security_log', ['type' => $type, 'ip' => client_ip(), 'user_id' => $userId, 'detail' => mb_substr($detail, 0, 250),
            'ua' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 190), 'created_at' => now()]);
    } catch (Throwable $e) { /* logging never breaks a request */ }
}
// Counts hits for key+IP in a window; true when over the limit (does not stop the request)
function ip_hits(string $key, int $max, int $window): bool
{
    if (!sec_ready()) return false;
    $k = substr($key . '|' . client_ip(), 0, 120);
    $t = time();
    $r = row('SELECT hits, reset_at FROM throttle WHERE k = ?', [$k]);
    if (!$r || (int) $r['reset_at'] <= $t) { q('REPLACE INTO throttle (k, hits, reset_at) VALUES (?, 1, ?)', [$k, $t + $window]); return 1 > $max; }
    q('UPDATE throttle SET hits = hits + 1 WHERE k = ?', [$k]);
    return (int) $r['hits'] + 1 > $max;
}
// Hard limit by IP (survives cookie deletion, unlike the per-session limit)
function ip_limit(string $key, int $max, int $window): void
{
    if (ip_hits($key, $max, $window)) {
        sec_log('rate', $key);
        fail('تعداد درخواست‌ها از این اتصال زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.', 429, 'rate');
    }
}
function ip_blocked(): ?array
{
    if (!sec_ready()) return null;
    return row('SELECT * FROM ip_blocks WHERE ip = ? AND (until_at IS NULL OR until_at > ?)', [client_ip(), now()]) ?: null;
}
function ip_block(string $ip, string $reason, ?int $minutes): void
{
    q('REPLACE INTO ip_blocks (ip, reason, until_at, created_at) VALUES (?, ?, ?, ?)', [$ip, mb_substr($reason, 0, 190), $minutes ? gmdate('Y-m-d H:i:s', time() + $minutes * 60) : null, now()]);
    sec_log('blocked', $ip . ' — ' . $reason);
}
// Called on every failed sign-in: blocks the IP after too many failures
function login_failed(string $phone, string $how): void
{
    sec_log('login_fail', $how . ' ' . $phone);
    $s = setting('security');
    if (ip_hits('loginfail', max(3, (int) $s['maxFails']), 900)) {
        ip_block(client_ip(), 'تلاش‌های ناموفق ورود', max(5, (int) $s['blockMinutes']));
        $admins = (int) val("SELECT COUNT(*) FROM users WHERE phone = ? AND role = 'admin'", [$phone]);
        if ($admins) notify_admins('⚠️ آی‌پی ' . client_ip() . ' به‌خاطر تلاش‌های ناموفق برای ورود به حساب مدیر مسدود شد.', 'security');
    }
}
function login_succeeded(array $u): void
{
    if ($u['role'] !== 'admin') return;
    sec_log('admin_login', 'ورود مدیر', (int) $u['id']);
    if (!empty(setting('security', 'loginAlert'))) {
        require_once __DIR__ . '/gateways.php';
        sms_notify('admin_login', (string) $u['phone'], ['name' => $u['name'], 'date' => client_ip()], true);
    }
}
// Session version: bumping users.session_ver signs the account out everywhere
function session_mark(int $uid): void
{
    try { $_SESSION['sv'] = (int) val('SELECT session_ver FROM users WHERE id = ?', [$uid]); } catch (Throwable $e) { $_SESSION['sv'] = 0; }
}

// ------------------------------------------------------------------ admin two-step login
function admin_2fa_needed(array $u): bool
{
    return $u['role'] === 'admin' && !empty(setting('security', 'admin2fa')) && function_exists('sms_enabled') && sms_enabled();
}
function admin_2fa_start(array $u): void
{
    $code = (string) random_int(100000, 999999);
    $_SESSION['2fa'] = ['uid' => (int) $u['id'], 'hash' => password_hash($code, PASSWORD_DEFAULT), 'exp' => time() + 300, 'tries' => 0];
    if (!sms_send_code((string) $u['phone'], $code)) fail('ارسال کد تأیید ناموفق بود.', 502);
    out(['need2fa' => true, 'message' => 'کد تأیید به موبایل مدیر پیامک شد.']);
}
function r_auth_2fa(): void
{
    ip_limit('2fa', 10, 900);
    $p = $_SESSION['2fa'] ?? null;
    if (!$p || $p['exp'] < time()) fail('کد منقضی شده است؛ دوباره وارد شوید.', 422);
    $_SESSION['2fa']['tries']++;
    if ($_SESSION['2fa']['tries'] > 5) { unset($_SESSION['2fa']); fail('تعداد تلاش زیاد بود؛ دوباره وارد شوید.', 429); }
    if (!password_verify(preg_replace('/\D/', '', en_digits(str_in('code', 10))), $p['hash'])) { login_failed('', 'کد دومرحله‌ای'); fail('کد تأیید اشتباه است.', 422); }
    unset($_SESSION['2fa']);
    login_as((int) $p['uid']);
    $u = row('SELECT * FROM users WHERE id = ?', [$p['uid']]);
    login_succeeded($u);
    out(['me' => user_out($u, true)]);
}

// ------------------------------------------------------------------ integrity & report
function integrity_files(): array
{
    $root = dirname(__DIR__, 2);
    $list = array_merge(glob($root . '/api/lib/*.php') ?: [], [$root . '/api/index.php', $root . '/seo.php', $root . '/p.php']);
    return array_values(array_filter($list, 'is_file'));
}
function integrity_check(): array
{
    $root = dirname(__DIR__, 2);
    $manifest = is_file($root . '/api/integrity.json') ? (json_decode((string) file_get_contents($root . '/api/integrity.json'), true) ?: []) : [];
    $changed = $missing = $extra = [];
    $files = integrity_files();
    $seen = [];
    foreach ($files as $f) {
        $rel = ltrim(str_replace($root, '', $f), '/');
        $seen[$rel] = true;
        if (!isset($manifest[$rel])) { $extra[] = $rel; continue; }
        if (!hash_equals($manifest[$rel], hash_file('sha256', $f))) $changed[] = $rel;
    }
    foreach ($manifest as $rel => $h) if (!isset($seen[$rel])) $missing[] = $rel;
    // anything executable inside uploads is a red flag
    $shells = [];
    $it = is_dir($root . '/uploads') ? new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/uploads', FilesystemIterator::SKIP_DOTS)) : [];
    foreach ($it as $f) if (preg_match('/\.(php\d?|phtml|phar|cgi|pl|py|sh|asp|aspx|jsp)$/i', $f->getFilename())) $shells[] = ltrim(str_replace($root, '', $f->getPathname()), '/');
    // and PHP files in public folders where none should exist
    foreach (['assets', 'uploads'] as $d) foreach (glob($root . "/$d/*.php") ?: [] as $f) $shells[] = ltrim(str_replace($root, '', $f), '/');
    return ['manifest' => (bool) $manifest, 'changed' => $changed, 'missing' => $missing, 'extra' => $extra, 'suspicious' => array_values(array_unique($shells)), 'checked' => count($files)];
}
function security_checks(): array
{
    $root = dirname(__DIR__, 2);
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || stripos(base_url(), 'https://') === 0;
    $cfg = $root . '/api/config.php';
    $perm = is_file($cfg) ? substr(sprintf('%o', fileperms($cfg)), -3) : '';
    $admins = rows("SELECT id, name, phone, password_hash, created_at FROM users WHERE role = 'admin' AND status = 'active'");
    $integrity = integrity_check();
    $pay = setting('payment');
    $checks = [
        ['https', 'اتصال امن HTTPS', $https, 'critical', 'گواهی SSL را در cPanel (بخش SSL/TLS یا AutoSSL) فعال و ریدایرکت HTTPS را در .htaccess روشن کنید.'],
        ['php', 'نسخه PHP (۸٫۱ به بالا)', version_compare(PHP_VERSION, '8.1', '>='), 'high', 'نسخه فعلی ' . PHP_VERSION . ' است؛ از بخش «Select PHP Version» در cPanel نسخه ۸٫۲ یا بالاتر را انتخاب کنید.'],
        ['install', 'حذف فایل نصب (install.php)', !is_file($root . '/install.php'), 'high', 'فایل install.php را از هاست حذف کنید؛ با وجود قفل بودن، بهتر است روی سرور نماند.'],
        ['errors', 'نمایش‌ندادن خطاهای PHP', !ini_get('display_errors') || ini_get('display_errors') === '0', 'medium', 'display_errors را در تنظیمات PHP هاست خاموش کنید.'],
        ['config', 'دسترسی امن فایل تنظیمات', $perm === '' || in_array($perm, ['600', '640', '644', '400', '440'], true), 'medium', "دسترسی فعلی config.php برابر $perm است؛ در File Manager آن را ۶۴۴ یا ۶۰۰ کنید."],
        ['uploads', 'قفل پوشه آپلود (اجرای کد ممنوع)', is_file($root . '/uploads/.htaccess'), 'critical', 'فایل uploads/.htaccess حذف شده است؛ آن را از فایل zip سایت دوباره آپلود کنید.'],
        ['apilock', 'قفل پوشه API', is_file($root . '/api/.htaccess'), 'high', 'فایل api/.htaccess را از فایل zip سایت دوباره آپلود کنید.'],
        ['demo', 'حالت نمایشی خاموش', empty(setting('general', 'demoMode')), 'high', 'از «تنظیمات ← داده‌های نمایشی» حالت نمایشی را خاموش و داده‌های نمونه را حذف کنید.'],
        ['paytest', 'درگاه واقعی (نه تست)', $pay['driver'] !== 'test', 'critical', 'درگاه «تست» فقط برای آزمایش است؛ از «تنظیمات ← درگاه پرداخت» زرین‌پال یا زیبال را تنظیم کنید.'],
        ['2fa', 'ورود دومرحله‌ای مدیر', !empty(setting('security', 'admin2fa')) && sms_enabled(), 'high', 'سرویس پیامک را تنظیم و «ورود دومرحله‌ای مدیر» را در همین بخش روشن کنید.'],
        ['admins', 'تعداد مدیران کم', count($admins) <= 2, 'medium', 'تعداد حساب‌های مدیر ' . count($admins) . ' است؛ مدیرهای اضافه را به نقش دیگری تغییر دهید.'],
        ['integrity', 'سالم بودن فایل‌های هسته', $integrity['manifest'] && !$integrity['changed'] && !$integrity['missing'], 'high', $integrity['changed'] ? 'فایل‌های تغییرکرده: ' . implode('، ', $integrity['changed']) . ' — اگر خودتان تغییر نداده‌اید، فایل‌ها را از نسخه اصلی جایگزین کنید.' : 'فهرست اثرانگشت فایل‌ها پیدا نشد.'],
        ['shells', 'نبود فایل اجرایی مشکوک', !$integrity['suspicious'], 'critical', 'فایل‌های مشکوک: ' . implode('، ', $integrity['suspicious']) . ' — فوراً حذف و رمزهای هاست و مدیر را عوض کنید.'],
        ['backup', 'پشتیبان‌گیری در ۷ روز اخیر', (int) val('SELECT v FROM settings WHERE k = ?', ['last_backup']) > time() - 7 * 86400, 'medium', 'از دکمه «دانلود پشتیبان کامل» نسخه پشتیبان بگیرید و جای امنی نگه دارید (cPanel هم بخش Backup دارد).'],
        ['sms', 'سرویس پیامک فعال (برای کد ورود)', sms_enabled(), 'low', 'سرویس پیامک را تنظیم کنید تا ورود با کد یک‌بارمصرف و هشدارها کار کند.'],
    ];
    $weights = ['critical' => 4, 'high' => 3, 'medium' => 2, 'low' => 1];
    $total = array_sum(array_map(function ($c) use ($weights) { return $weights[$c[3]]; }, $checks));
    $got = array_sum(array_map(function ($c) use ($weights) { return $c[2] ? $weights[$c[3]] : 0; }, $checks));
    return ['score' => (int) round($got / max(1, $total) * 100), 'checks' => array_map(function ($c) { return ['id' => $c[0], 'label' => $c[1], 'ok' => (bool) $c[2], 'level' => $c[3], 'tip' => $c[4]]; }, $checks), 'integrity' => $integrity];
}

// ------------------------------------------------------------------ admin routes
function a_security_report(): void
{
    require_active('admin');
    $since = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
    $stat = function ($type) use ($since) { return (int) val('SELECT COUNT(*) FROM security_log WHERE type = ? AND created_at > ?', [$type, $since]); };
    out(['report' => security_checks(), 'settings' => setting('security'), 'ip' => client_ip(),
        'stats' => ['loginFail' => $stat('login_fail'), 'blocked' => $stat('blocked'), 'rate' => $stat('rate'), 'adminLogin' => $stat('admin_login')],
        'events' => array_map(function ($e) { return ['type' => $e['type'], 'ip' => $e['ip'], 'detail' => $e['detail'], 'user' => $e['uname'], 'ua' => $e['ua'], 'at' => ms($e['created_at'])]; },
            rows('SELECT l.*, u.name uname FROM security_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 120')),
        'blocks' => array_map(function ($b) { return ['ip' => $b['ip'], 'reason' => $b['reason'], 'until' => ms($b['until_at']), 'at' => ms($b['created_at'])]; },
            rows('SELECT * FROM ip_blocks WHERE until_at IS NULL OR until_at > ? ORDER BY created_at DESC', [now()]))]);
}
function a_security_unblock(): void
{
    require_active('admin');
    q('DELETE FROM ip_blocks WHERE ip = ?', [str_in('ip', 45)]);
    sec_log('admin_action', 'رفع مسدودیت ' . str_in('ip', 45));
    done('مسدودیت برداشته شد.');
}
function a_security_block(): void
{
    $me = require_active('admin');
    $ip = str_in('ip', 45);
    if (!filter_var($ip, FILTER_VALIDATE_IP)) fail('آی‌پی معتبر نیست.', 422);
    if ($ip === client_ip()) fail('نمی‌توانید آی‌پی خودتان را مسدود کنید.', 422);
    ip_block($ip, str_in('reason', 190) ?: 'مسدودسازی دستی مدیر', int_in('minutes') ?: null);
    done('آی‌پی مسدود شد.');
}
// Signs every account (or one user) out on all devices
function a_security_logoutAll(): void
{
    $me = require_active('admin');
    $uid = int_in('userId');
    if ($uid) q('UPDATE users SET session_ver = session_ver + 1 WHERE id = ?', [$uid]);
    else q('UPDATE users SET session_ver = session_ver + 1');
    sec_log('admin_action', $uid ? "خروج اجباری کاربر #$uid" : 'خروج اجباری همه کاربران', (int) $me['id']);
    if (!$uid || $uid === (int) $me['id']) session_mark((int) $me['id']); // keep the admin signed in here
    done($uid ? 'کاربر از همه دستگاه‌ها خارج شد.' : 'همه کاربران (جز همین نشست شما) از حساب خارج شدند.');
}
// Full database dump as .sql.gz
function a_security_backup(): void
{
    $me = require_active('admin');
    sec_log('admin_action', 'دانلود پشتیبان پایگاه داده', (int) $me['id']);
    q("INSERT INTO settings (k, v) VALUES ('last_backup', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [(string) time()]);
    $pdo = db();
    $out = "-- BEHIX backup " . gmdate('c') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n";
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) {
        $create = $pdo->query("SHOW CREATE TABLE `$t`")->fetch(PDO::FETCH_NUM)[1];
        $out .= "\nDROP TABLE IF EXISTS `$t`;\n$create;\n";
        $st = $pdo->query("SELECT * FROM `$t`");
        while ($r = $st->fetch(PDO::FETCH_NUM)) {
            $out .= "INSERT INTO `$t` VALUES (" . implode(',', array_map(function ($v) use ($pdo) { return $v === null ? 'NULL' : $pdo->quote((string) $v); }, $r)) . ");\n";
        }
    }
    $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
    $gz = gzencode($out, 6);
    header('Content-Type: application/gzip');
    header('Content-Disposition: attachment; filename="behix-backup-' . gmdate('Y-m-d') . '.sql.gz"');
    header('Content-Length: ' . strlen($gz));
    echo $gz;
    exit;
}
