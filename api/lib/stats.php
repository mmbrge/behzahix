<?php
// BEHIX — visit statistics, kept on the site's own database (no outside service).
// Every public page sends one «hit» after it loads (core.js). Bots, headless
// browsers and the site's own team (admin, accountant, partner) are not counted.
// A visitor is an anonymous fingerprint (keyed hash of IP + browser), never stored raw.
if (!defined('BX')) { http_response_code(403); exit; }

// page key → label (the page title is stored too, for posts, services and products)
const STATS_PAGES = ['index' => 'صفحه اصلی', 'services' => 'خدمات', 'service' => 'صفحه خدمت', 'shop' => 'فروشگاه', 'blog' => 'وبلاگ', 'studio' => 'استودیو',
    'tools' => 'ابزارها', 'about' => 'درباره ما', 'portfolio' => 'نمونه‌کارها', 'designers' => 'طراحان', 'order' => 'ثبت سفارش', 'terms' => 'قوانین',
    'auth' => 'ورود و ثبت‌نام', '404' => 'صفحه پیدا نشد', 'c' => 'کارت ویزیت / منوی دیجیتال'];
// referrer host → source
const STATS_SOURCES = ['google' => 'گوگل', 'bing' => 'بینگ', 'yandex' => 'یاندکس', 'duckduckgo' => 'داک‌داک‌گو', 'telegram' => 'تلگرام', 'instagram' => 'اینستاگرام',
    'whatsapp' => 'واتس‌اپ', 'eitaa' => 'ایتا', 'bale' => 'بله', 'rubika' => 'روبیکا', 'linkedin' => 'لینکدین', 'facebook' => 'فیسبوک', 'twitter' => 'ایکس (توییتر)',
    'aparat' => 'آپارات', 'torob' => 'ترب', 'direct' => 'مستقیم / ناشناس', 'other' => 'سایر سایت‌ها'];

function stats_tehran(int $ts): DateTime
{
    $d = new DateTime('@' . $ts);
    $d->setTimezone(new DateTimeZone('Asia/Tehran'));
    return $d;
}
function stats_source(string $ref, string $utm): string
{
    // ?utm_source=… is kept as written (telegram, telegram-kanal1, ads-instagram…), so each campaign
    // or channel gets its own row; a few short forms are normalised
    $utm = substr(preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($utm))), 0, 32);
    if ($utm !== '') {
        $alias = ['tg' => 'telegram', 't.me' => 'telegram', 'ig' => 'instagram', 'insta' => 'instagram', 'wa' => 'whatsapp'];
        return $alias[$utm] ?? $utm;
    }
    $host = strtolower((string) parse_url($ref, PHP_URL_HOST));
    if ($host === '') return 'direct';
    $self = strtolower((string) parse_url(base_url(), PHP_URL_HOST));
    if ($host === $self || $host === 'www.' . $self || ($self && substr($host, -strlen('.' . $self)) === '.' . $self) || $host === ($_SERVER['HTTP_HOST'] ?? '')) return '';
    $map = ['google.' => 'google', 'bing.com' => 'bing', 'yandex.' => 'yandex', 'duckduckgo' => 'duckduckgo', 't.me' => 'telegram', 'telegram' => 'telegram', 'instagram' => 'instagram',
        'whatsapp' => 'whatsapp', 'wa.me' => 'whatsapp', 'eitaa' => 'eitaa', 'ble.ir' => 'bale', 'bale.ai' => 'bale', 'rubika' => 'rubika', 'linkedin' => 'linkedin', 'lnkd.in' => 'linkedin',
        'facebook' => 'facebook', 'fb.' => 'facebook', 'twitter' => 'twitter', 'x.com' => 'twitter', 't.co' => 'twitter', 'aparat' => 'aparat', 'torob' => 'torob'];
    foreach ($map as $needle => $k) if (strpos($host, $needle) !== false) return $k;
    return 'other';
}

// Public: one page view (called by core.js after the page is shown)
function r_hit(): void
{
    $u = me();
    if ($u && in_array($u['role'], STAFF_ROLES, true)) out(['ok' => true, 'skip' => 'staff']);
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $info = ua_info();
    if ($ua === '' || $info['device'] === 'bot' || preg_match('/Headless|Lighthouse|PageSpeed|Chrome-Lighthouse|GTmetrix|Pingdom|uptime/i', $ua)) out(['ok' => true, 'skip' => 'bot']);
    rate_limit('hit', 240, 600);
    // the page: file name + the few query keys that make it a different page
    $raw = str_in('path', 400);
    $parts = parse_url($raw) ?: [];
    $p = (string) ($parts['path'] ?? '/');
    if (preg_match('#^/c/([A-Za-z0-9-]+)/?$#', $p, $m)) { $page = 'c'; $path = '/c/' . $m[1]; }
    else {
        $file = basename($p);
        $page = ($file === '' || $file === '/' || $p === '/' || substr($p, -1) === '/') ? 'index' : preg_replace('/\.html$/', '', $file);
        if (!isset(STATS_PAGES[$page])) out(['ok' => true, 'skip' => 'page']);
        parse_str((string) ($parts['query'] ?? ''), $qs);
        $keep = array_intersect_key($qs, array_flip(['p', 'id', 'product', 'tag', 'page']));
        foreach ($keep as $k => $v) $keep[$k] = mb_substr((string) $v, 0, 120);
        $path = '/' . ($page === 'index' ? '' : $page . '.html') . ($keep ? '?' . http_build_query($keep) : '');
    }
    $path = mb_substr($path, 0, 190);
    $postId = null;
    if ($page === 'blog' && !empty($keep['p'])) $postId = (int) val("SELECT id FROM posts WHERE slug = ? AND status = 'published'", [(string) $keep['p']]) ?: null;
    $site = (string) (setting('general', 'siteNameFa') ?: '');
    $title = trim(preg_replace('/\s*[|–-]\s*(' . preg_quote($site, '/') . '|' . preg_quote((string) setting('general', 'siteName'), '/') . ')\s*$/u', '', str_in('title', 250)));
    $visitor = substr(hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $ua, (string) (bx_config()['secret'] ?? 'bx')), 0, 16);
    $now = time();
    // a new visit = no page from this visitor in the last 30 minutes
    $recent = (int) val('SELECT COUNT(*) FROM page_views WHERE visitor = ? AND created_at > ?', [$visitor, gmdate('Y-m-d H:i:s', $now - 1800)]);
    // where the visit came from (only the first page of a visit has one); an internal referrer on a new
    // visit = a tab left open or a bookmark → «direct»
    $source = $recent ? '' : (stats_source(str_in('ref', 400), str_in('utm', 60)) ?: 'direct');
    insert('page_views', ['day' => stats_tehran($now)->format('Y-m-d'), 'created_at' => gmdate('Y-m-d H:i:s', $now), 'path' => $path, 'page' => $page, 'post_id' => $postId,
        'title' => mb_substr($title, 0, 190), 'visitor' => $visitor, 'new_visit' => $recent ? 0 : 1, 'source' => $source,
        'device' => mb_substr($info['device'], 0, 10), 'browser' => mb_substr($info['browser'], 0, 16), 'os' => mb_substr($info['os'], 0, 16), 'user_id' => $u['id'] ?? null]);
    // keep about 13 months
    if (mt_rand(1, 200) === 1) q('DELETE FROM page_views WHERE day < ? LIMIT 5000', [gmdate('Y-m-d', $now - 400 * 86400)]);
    out(['ok' => true]);
}

// ------------------------------------------------------------------ admin report
function stats_jdate(string $ymd): string
{
    [$y, $m, $d] = array_map('intval', explode('-', $ymd));
    [$jy, $jm, $jd] = gregorian_to_jalali($y, $m, $d);
    return sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
}
function a_stats_views(): void
{
    require_staff('stats');
    $days = max(1, min(365, int_in('days') ?: 30));
    $today = stats_tehran(time());
    $to = $today->format('Y-m-d');
    $from = (clone $today)->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
    $pFrom = (clone $today)->modify('-' . (2 * $days - 1) . ' days')->format('Y-m-d');
    $pTo = (clone $today)->modify('-' . $days . ' days')->format('Y-m-d');
    // optional: one page or one post
    $path = str_in('path', 190);
    $w = 'day BETWEEN ? AND ?';
    $f = $path !== '' ? ' AND path = ?' : '';
    $args = function ($a, $b) use ($path) { return $path !== '' ? [$a, $b, $path] : [$a, $b]; };
    $tot = function ($a, $b) use ($w, $f, $args) {
        $r = row("SELECT COUNT(*) views, COUNT(DISTINCT visitor) visitors, COALESCE(SUM(new_visit), 0) visits FROM page_views WHERE $w$f", $args($a, $b));
        return ['views' => (int) $r['views'], 'visitors' => (int) $r['visitors'], 'visits' => (int) $r['visits']];
    };
    $cur = $tot($from, $to);
    $prev = $tot($pFrom, $pTo);
    $cur['perVisit'] = $cur['visits'] ? round($cur['views'] / $cur['visits'], 1) : 0;
    $cur['online'] = (int) val('SELECT COUNT(DISTINCT visitor) FROM page_views WHERE created_at > ?' . ($path !== '' ? ' AND path = ?' : ''), $path !== '' ? [gmdate('Y-m-d H:i:s', time() - 300), $path] : [gmdate('Y-m-d H:i:s', time() - 300)]);
    $cur['today'] = (int) val('SELECT COUNT(*) FROM page_views WHERE day = ?' . ($path !== '' ? ' AND path = ?' : ''), $path !== '' ? [$to, $path] : [$to]);
    // day by day (missing days are zero)
    $byDay = [];
    foreach (rows("SELECT day, COUNT(*) views, COUNT(DISTINCT visitor) visitors FROM page_views WHERE $w$f GROUP BY day", $args($from, $to)) as $r) $byDay[$r['day']] = $r;
    $series = [];
    for ($d = new DateTime($from); $d->format('Y-m-d') <= $to; $d->modify('+1 day')) {
        $k = $d->format('Y-m-d');
        $series[] = ['day' => $k, 'label' => stats_jdate($k), 'views' => (int) ($byDay[$k]['views'] ?? 0), 'visitors' => (int) ($byDay[$k]['visitors'] ?? 0)];
    }
    $grp = function (string $col, string $extra = '', int $limit = 12) use ($w, $f, $args, $from, $to) {
        return array_map(function ($r) { return ['k' => (string) $r['k'], 'n' => (int) $r['n'], 'v' => (int) ($r['v'] ?? 0)]; },
            rows("SELECT $col k, COUNT(*) n, COUNT(DISTINCT visitor) v FROM page_views WHERE $w$f $extra GROUP BY $col ORDER BY n DESC LIMIT $limit", $args($from, $to)));
    };
    $out = ['days' => $days, 'from' => stats_jdate($from), 'to' => stats_jdate($to), 'path' => $path, 'totals' => $cur, 'prev' => $prev, 'series' => $series,
        'sources' => array_map(function ($r) { return $r + ['label' => STATS_SOURCES[$r['k']] ?? $r['k']]; }, $grp('source', "AND new_visit = 1")),
        'devices' => $grp('device'), 'browsers' => $grp('browser', '', 8), 'os' => $grp('os', '', 8),
        'hours' => array_fill(0, 24, 0)];
    foreach (rows("SELECT HOUR(DATE_ADD(created_at, INTERVAL 210 MINUTE)) h, COUNT(*) n FROM page_views WHERE $w$f GROUP BY h", $args($from, $to)) as $r) $out['hours'][(int) $r['h']] = (int) $r['n'];
    if ($path === '') {
        $out['pages'] = array_map(function ($r) {
            return ['path' => $r['path'], 'page' => $r['page'], 'label' => STATS_PAGES[$r['page']] ?? $r['page'], 'title' => (string) $r['title'], 'views' => (int) $r['views'], 'visitors' => (int) $r['visitors'], 'entries' => (int) $r['entries']];
        }, rows("SELECT path, MAX(page) page, MAX(title) title, COUNT(*) views, COUNT(DISTINCT visitor) visitors, SUM(new_visit) entries FROM page_views WHERE $w GROUP BY path ORDER BY views DESC LIMIT 60", [$from, $to]));
        $out['posts'] = array_map(function ($r) {
            return ['id' => (int) $r['id'], 'title' => $r['title'], 'slug' => $r['slug'], 'path' => '/blog.html?p=' . rawurlencode($r['slug']), 'views' => (int) $r['views'], 'visitors' => (int) $r['visitors'], 'total' => (int) $r['total'], 'publishedAt' => ms($r['published_at'])];
        }, rows("SELECT p.id, p.title, p.slug, p.published_at, p.views total, COUNT(v.id) views, COUNT(DISTINCT v.visitor) visitors FROM posts p LEFT JOIN page_views v ON v.post_id = p.id AND v.day BETWEEN ? AND ?
            WHERE p.status = 'published' GROUP BY p.id ORDER BY views DESC, p.published_at DESC LIMIT 50", [$from, $to]));
        $out['groups'] = array_map(function ($r) { return ['k' => $r['k'], 'label' => STATS_PAGES[$r['k']] ?? $r['k'], 'n' => (int) $r['n'], 'v' => (int) $r['v']]; }, $grp('page', '', 20));
    }
    out($out);
}
