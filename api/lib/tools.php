<?php
// BEHIX — free tools: usage tracking, link shortener and admin statistics.
// Image / PDF / QR tools run in the visitor's browser; only metadata
// (sizes, page counts…) is logged here — never the files themselves.
if (!defined('BX')) { http_response_code(403); exit; }

const BX_TOOLS = [
    'qr' => 'ساخت QR کد', 'short' => 'کوتاه‌کننده لینک', 'image' => 'کاهش حجم و تغییر اندازه عکس',
    'pdf-split' => 'جداکننده PDF', 'pdf-merge' => 'ادغام PDF', 'img2pdf' => 'تبدیل عکس به PDF',
    'palette' => 'استخراج پالت رنگ', 'favicon' => 'ساخت فاوآیکن', 'counter' => 'شمارنده کلمات',
    'date' => 'تبدیل تاریخ', 'num2words' => 'عدد به حروف', 'password' => 'ساخت رمز عبور',
    'validate' => 'بررسی کد ملی، شبا و کارت', 'utm' => 'ساخت لینک UTM',
];

// ------------------------------------------------------------------ helpers
function visitor_id(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
    return substr(hash_hmac('sha256', $ip, (string) (bx_config()['secret'] ?? 'bx')), 0, 16);
}
function ua_info(): array
{
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $device = preg_match('/iPad|Tablet|(Android(?!.*Mobile))/i', $ua) ? 'tablet' : (preg_match('/Mobi|iPhone|Android/i', $ua) ? 'mobile' : 'desktop');
    if (preg_match('/bot|crawl|spider|preview/i', $ua)) $device = 'bot';
    $browser = 'other';
    foreach (['SamsungBrowser' => 'Samsung', 'Edg' => 'Edge', 'OPR' => 'Opera', 'Firefox' => 'Firefox', 'Chrome' => 'Chrome', 'Safari' => 'Safari'] as $k => $v) {
        if (stripos($ua, $k) !== false) { $browser = $v; break; }
    }
    $os = 'other';
    foreach (['Android' => 'Android', 'iPhone' => 'iOS', 'iPad' => 'iOS', 'Windows' => 'Windows', 'Mac OS' => 'macOS', 'Linux' => 'Linux'] as $k => $v) {
        if (stripos($ua, $k) !== false) { $os = $v; break; }
    }
    return ['device' => $device, 'browser' => $browser, 'os' => $os];
}
function tools_cfg(): array
{
    return setting('tools') + ['enabled' => true, 'disabled' => [], 'shortRequireLogin' => false, 'shortGuestDaily' => 10, 'blockedDomains' => []];
}
function tool_available(string $tool): void
{
    $c = tools_cfg();
    if (empty($c['enabled']) || in_array($tool, (array) $c['disabled'], true)) fail('این ابزار در حال حاضر غیرفعال است.', 403, 'tool_off');
}
function log_tool(string $tool, array $meta = []): void
{
    $u = me();
    insert('tool_events', ['tool' => $tool, 'user_id' => $u['id'] ?? null, 'visitor' => visitor_id(), 'device' => ua_info()['device'],
        'meta' => jenc($meta), 'created_at' => now()]);
}
// Keep only small scalar values from client-sent metadata.
function clean_meta($meta): array
{
    $out = [];
    if (!is_array($meta)) return $out;
    foreach (array_slice($meta, 0, 12, true) as $k => $v) {
        $k = preg_replace('/[^a-zA-Z0-9_]/', '', (string) $k);
        if ($k === '' || !(is_scalar($v) || $v === null)) continue;
        $out[$k] = is_string($v) ? mb_substr($v, 0, 80) : $v;
    }
    return $out;
}
function short_url(string $code): string
{
    return base_url() . '/s/' . $code;
}
function short_out(array $l, bool $withUrl = true): array
{
    return ['id' => (int) $l['id'], 'code' => $l['code'], 'short' => short_url($l['code']), 'url' => $withUrl ? $l['url'] : null,
        'clicks' => (int) $l['clicks'], 'active' => (bool) $l['active'], 'createdAt' => ms($l['created_at']), 'lastClickAt' => ms($l['last_click_at'])];
}
function can_see_link(array $l): bool
{
    $u = me();
    if ($u && ($u['role'] === 'admin' || (int) $l['user_id'] === (int) $u['id'])) return true;
    return in_array((int) $l['id'], $_SESSION['my_links'] ?? [], true);
}
function link_stats(array $l): array
{
    $id = (int) $l['id'];
    $days = rows("SELECT DATE(created_at) d, COUNT(*) n FROM short_clicks WHERE link_id = ? AND created_at >= ? GROUP BY DATE(created_at)", [$id, date('Y-m-d', strtotime('-13 days'))]);
    $by = function (string $col) use ($id) {
        return array_map(function ($r) { return ['k' => $r['k'] ?: '—', 'n' => (int) $r['n']]; },
            rows("SELECT $col k, COUNT(*) n FROM short_clicks WHERE link_id = ? GROUP BY $col ORDER BY n DESC LIMIT 8", [$id]));
    };
    return [
        'link' => short_out($l),
        'unique' => (int) val('SELECT COUNT(DISTINCT visitor) FROM short_clicks WHERE link_id = ?', [$id]),
        'days' => array_map(function ($r) { return ['d' => $r['d'], 'n' => (int) $r['n']]; }, $days),
        'devices' => $by('device'), 'browsers' => $by('browser'), 'os' => $by('os'), 'referrers' => $by('referrer'),
        'recent' => array_map(function ($r) { return ['at' => ms($r['created_at']), 'device' => $r['device'], 'browser' => $r['browser'], 'os' => $r['os'], 'referrer' => $r['referrer']]; },
            rows('SELECT * FROM short_clicks WHERE link_id = ? ORDER BY id DESC LIMIT 20', [$id])),
    ];
}

// ------------------------------------------------------------------ public routes
function r_tools_track(): void
{
    $tool = str_in('tool', 32);
    if (!isset(BX_TOOLS[$tool]) || $tool === 'short') fail('ابزار نامعتبر است.', 422);
    rate_limit('tools', 120, 3600);
    log_tool($tool, clean_meta(in('meta', [])));
    out(['ok' => true]);
}

function r_short_create(): void
{
    tool_available('short');
    $c = tools_cfg();
    $u = me();
    if (!$u && !empty($c['shortRequireLogin'])) fail('برای ساخت لینک کوتاه ابتدا وارد حساب خود شوید.', 401, 'login');
    rate_limit('short', 20, 3600);
    $url = trim(str_in('url', 2000));
    if ($url !== '' && !preg_match('~^[a-z][a-z0-9+.-]*://~i', $url)) $url = 'https://' . $url;
    $parts = parse_url($url);
    if (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
        fail('لینک واردشده معتبر نیست.', 422);
    }
    $host = strtolower($parts['host']);
    foreach ((array) $c['blockedDomains'] as $d) {
        $d = strtolower(trim((string) $d));
        if ($d !== '' && ($host === $d || substr($host, -strlen($d) - 1) === ".$d")) fail('کوتاه کردن لینک این دامنه مجاز نیست.', 422);
    }
    if (!$u) {
        $today = (int) val('SELECT COUNT(*) FROM short_links WHERE visitor = ? AND user_id IS NULL AND created_at >= ?', [visitor_id(), date('Y-m-d H:i:s', time() - 86400)]);
        if ($today >= max(1, (int) $c['shortGuestDaily'])) fail('سقف ساخت لینک برای مهمان امروز پر شده؛ با ورود به حساب، بدون محدودیت لینک بسازید.', 429, 'limit');
    }
    $alias = str_in('alias', 40);
    if ($alias !== '') {
        if (!preg_match('/^[A-Za-z0-9_-]{3,30}$/', $alias)) fail('نام دلخواه فقط می‌تواند حروف انگلیسی، عدد، - و _ (۳ تا ۳۰ کاراکتر) باشد.', 422);
        if (val('SELECT id FROM short_links WHERE code = ?', [$alias])) fail('این نام قبلاً گرفته شده است؛ نام دیگری انتخاب کنید.', 409);
        $code = $alias;
    } else {
        $abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) $code .= $abc[random_int(0, strlen($abc) - 1)];
        } while (val('SELECT id FROM short_links WHERE code = ?', [$code]));
    }
    $id = insert('short_links', ['code' => $code, 'url' => $url, 'user_id' => $u['id'] ?? null, 'visitor' => visitor_id(), 'created_at' => now()]);
    $_SESSION['my_links'] = array_slice(array_merge($_SESSION['my_links'] ?? [], [$id]), -50);
    log_tool('short', ['host' => mb_substr($host, 0, 80), 'alias' => $alias !== '']);
    out(['link' => short_out(row('SELECT * FROM short_links WHERE id = ?', [$id]))]);
}

function r_short_mine(): void
{
    $u = me();
    $ids = array_map('intval', $_SESSION['my_links'] ?? []);
    if ($u) $list = rows('SELECT * FROM short_links WHERE user_id = ? ORDER BY id DESC LIMIT 50', [$u['id']]);
    elseif ($ids) $list = rows('SELECT * FROM short_links WHERE id IN (' . implode(',', $ids) . ') ORDER BY id DESC');
    else $list = [];
    out(['links' => array_map('short_out', $list)]);
}

function r_short_stats(): void
{
    $l = row('SELECT * FROM short_links WHERE code = ?', [str_in('code', 32)]);
    if (!$l || !can_see_link($l)) fail('لینک پیدا نشد.', 404);
    out(link_stats($l));
}

// GET api/index.php?r=go&c=CODE  (and /s/CODE via .htaccess)
function r_short_go(): void
{
    $code = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_GET['c'] ?? ''));
    $l = $code !== '' ? row('SELECT * FROM short_links WHERE code = ? AND active = 1', [$code]) : null;
    if (!$l) {
        header('Location: ' . base_url() . '/404.html', true, 302);
        return;
    }
    $ua = ua_info();
    if ($ua['device'] !== 'bot') {
        $ref = parse_url((string) ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_HOST) ?: '';
        insert('short_clicks', ['link_id' => $l['id'], 'visitor' => visitor_id(), 'device' => $ua['device'], 'browser' => $ua['browser'], 'os' => $ua['os'],
            'referrer' => mb_substr((string) $ref, 0, 190), 'created_at' => now()]);
        q('UPDATE short_links SET clicks = clicks + 1, last_click_at = ? WHERE id = ?', [now(), $l['id']]);
    }
    header('Cache-Control: no-store');
    header('Location: ' . $l['url'], true, 302);
}

// ------------------------------------------------------------------ admin
function a_tools_stats(): void
{
    require_active('admin');
    $since7 = date('Y-m-d H:i:s', strtotime('-7 days'));
    $today = date('Y-m-d 00:00:00');
    $per = [];
    foreach (rows('SELECT tool, COUNT(*) total, SUM(created_at >= ?) week, SUM(created_at >= ?) today, MAX(created_at) last, COUNT(DISTINCT visitor) people FROM tool_events GROUP BY tool', [$since7, $today]) as $r) {
        $per[$r['tool']] = ['total' => (int) $r['total'], 'week' => (int) $r['week'], 'today' => (int) $r['today'], 'last' => ms($r['last']), 'people' => (int) $r['people']];
    }
    $tools = [];
    foreach (BX_TOOLS as $id => $title) $tools[] = ['id' => $id, 'title' => $title] + ($per[$id] ?? ['total' => 0, 'week' => 0, 'today' => 0, 'last' => null, 'people' => 0]);
    $days = rows('SELECT DATE(created_at) d, COUNT(*) n FROM tool_events WHERE created_at >= ? GROUP BY DATE(created_at)', [date('Y-m-d', strtotime('-13 days'))]);
    out([
        'tools' => $tools,
        'days' => array_map(function ($r) { return ['d' => $r['d'], 'n' => (int) $r['n']]; }, $days),
        'totals' => [
            'uses' => (int) val('SELECT COUNT(*) FROM tool_events'),
            'today' => (int) val('SELECT COUNT(*) FROM tool_events WHERE created_at >= ?', [$today]),
            'people' => (int) val('SELECT COUNT(DISTINCT visitor) FROM tool_events WHERE created_at >= ?', [$since7]),
            'links' => (int) val('SELECT COUNT(*) FROM short_links'),
            'clicks' => (int) val('SELECT COALESCE(SUM(clicks), 0) FROM short_links'),
        ],
        'devices' => array_map(function ($r) { return ['k' => $r['device'], 'n' => (int) $r['n']]; }, rows('SELECT device, COUNT(*) n FROM tool_events GROUP BY device ORDER BY n DESC')),
        'settings' => tools_cfg(),
    ]);
}

function a_tools_events(): void
{
    require_active('admin');
    $tool = str_in('tool', 32);
    $page = max(0, int_in('page'));
    $where = $tool !== '' && isset(BX_TOOLS[$tool]) ? 'WHERE e.tool = ?' : '';
    $p = $where ? [$tool] : [];
    $list = rows("SELECT e.*, u.name uname FROM tool_events e LEFT JOIN users u ON u.id = e.user_id $where ORDER BY e.id DESC LIMIT 40 OFFSET " . ($page * 40), $p);
    out(['events' => array_map(function ($e) {
        return ['id' => (int) $e['id'], 'tool' => $e['tool'], 'user' => $e['uname'], 'userId' => $e['user_id'] ? (int) $e['user_id'] : null,
            'visitor' => $e['visitor'], 'device' => $e['device'], 'meta' => jdec($e['meta']), 'at' => ms($e['created_at'])];
    }, $list), 'more' => count($list) === 40]);
}

function a_short_list(): void
{
    require_active('admin');
    $term = str_in('q', 100);
    $where = $term !== '' ? 'WHERE l.code LIKE ? OR l.url LIKE ?' : '';
    $p = $term !== '' ? ["%$term%", "%$term%"] : [];
    $list = rows("SELECT l.*, u.name uname FROM short_links l LEFT JOIN users u ON u.id = l.user_id $where ORDER BY l.id DESC LIMIT 100", $p);
    out(['links' => array_map(function ($l) { return short_out($l) + ['owner' => $l['uname']]; }, $list)]);
}
function a_short_stats(): void
{
    require_active('admin');
    $l = row('SELECT * FROM short_links WHERE id = ?', [int_in('id')]);
    if (!$l) fail('لینک پیدا نشد.', 404);
    out(link_stats($l));
}
function a_short_toggle(): void
{
    require_active('admin');
    q('UPDATE short_links SET active = 1 - active WHERE id = ?', [int_in('id')]);
    out(['ok' => true]);
}
function a_short_delete(): void
{
    require_active('admin');
    $id = int_in('id');
    q('DELETE FROM short_clicks WHERE link_id = ?', [$id]);
    q('DELETE FROM short_links WHERE id = ?', [$id]);
    out(['ok' => true]);
}
