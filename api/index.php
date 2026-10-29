<?php
// BEHIX API router — every request: /api/?r=<route>
declare(strict_types=1);
define('BX', true);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/security.php';
require __DIR__ . '/lib/public.php';
require __DIR__ . '/lib/tools.php';
require __DIR__ . '/lib/chat.php';
require __DIR__ . '/lib/delivery.php';
require __DIR__ . '/lib/studio.php';
require __DIR__ . '/lib/studio_render.php';
require __DIR__ . '/lib/pro.php';
require __DIR__ . '/lib/tax.php';

// A readable reason for host problems (limits, missing PHP extensions)
function bx_error_reason(string $m): string
{
    if (stripos($m, 'Allowed memory') !== false) return 'حافظه هاست کافی نیست (memory_limit را حداقل 256M کنید).';
    if (stripos($m, 'Maximum execution time') !== false) return 'زمان اجرای هاست کافی نیست (max_execution_time را حداقل 60 کنید).';
    if (stripos($m, 'undefined function') !== false) return 'یکی از افزونه‌های PHP روی هاست نصب نیست (' . preg_replace('/^.*undefined function ([^\s(]+).*$/s', '$1', $m) . ')؛ از پشتیبانی هاست بخواهید فعالش کنند.';
    if (stripos($m, 'not found') !== false && stripos($m, 'Class') !== false) return 'یکی از افزونه‌های PHP روی هاست نصب نیست (' . preg_replace('/^.*Class "?([^"\s]+)"? not found.*$/s', '$1', $m) . ').';
    return 'خطای سرور رخ داد؛ دوباره تلاش کنید.';
}
set_exception_handler(function (Throwable $e) {
    error_log('[BEHIX] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (db_in_tx()) db()->rollBack();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'server', 'message' => bx_error_reason($e->getMessage())], JSON_UNESCAPED_UNICODE);
});
// Fatal errors (memory or time limit, missing PHP extension…) cannot be caught above;
// answer JSON anyway so the page shows a clear message instead of a broken response.
register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
    error_log('[BEHIX] fatal: ' . $e['message'] . ' @ ' . $e['file'] . ':' . $e['line']);
    if (headers_sent()) return;
    while (ob_get_level()) ob_end_clean();
    $why = bx_error_reason($e['message']);
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'server', 'message' => $why], JSON_UNESCAPED_UNICODE);
});
function db_in_tx(): bool
{
    try { return installed() && db()->inTransaction(); } catch (Throwable $e) { return false; }
}

$route = preg_replace('/[^a-zA-Z0-9_.]/', '', (string) ($_GET['r'] ?? ''));
if (!installed()) fail('سایت هنوز نصب نشده است. فایل install.php را اجرا کنید.', 503, 'not_installed');
try {
    ensure_schema();
} catch (Throwable $e) {
    error_log('[BEHIX] schema migration: ' . $e->getMessage()); // keep the site up; retried next request
}
start_session();
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
// Blocked addresses get nothing but the boot data (so the site still shows a message)
if (($b = ip_blocked()) && $route !== 'boot') fail('دسترسی از این اتصال موقتاً مسدود شده است. اگر اشتباهی رخ داده با پشتیبانی تماس بگیرید.', 403, 'blocked');

// GET routes (no state change, no CSRF)
// Scheduled jobs (abandoned-cart SMS…): piggyback on traffic; never blocks the request
try { lazy_cron(($route === 'cron')); } catch (Throwable $e) { error_log('[BEHIX] cron: ' . $e->getMessage()); }
if ($route === 'cron') out(['ok' => true]);
$get = ['boot' => 'r_boot', 'file' => 'r_file', 'pay.callback' => 'payment_callback', 'pay.go' => 'r_pay_go', 'go' => 'r_short_go', 'invoice' => 'r_invoice'];
// SEO feeds (also reachable as /sitemap.xml and /robots.txt through seo.php)
$feeds = ['feed.torob' => 'seo_feed_torob', 'feed.blog' => 'blog', 'feed.products' => 'products', 'sitemap' => 'seo_sitemap', 'robots' => 'seo_robots'];
if (isset($feeds[$route])) {
    require_once __DIR__ . '/lib/seo.php';
    $f = $feeds[$route];
    function_exists($f) ? $f() : seo_feed_rss($f);
}
if (isset($get[$route])) {
    if ($route === 'pay.callback' || $route === 'pay.go') require_once __DIR__ . '/lib/gateways.php';
    if ($route === 'invoice') require_once __DIR__ . '/lib/invoice.php';
    $get[$route]();
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('روش درخواست نامعتبر است.', 405);
csrf_check();

$public = [
    'page' => 'r_page', 'portfolio.list' => 'r_portfolio_list', 'portfolio.like' => 'r_portfolio_like',
    'products.list' => 'r_products_list', 'designers.list' => 'r_designers_list', 'contact.send' => 'r_contact_send',
    'newsletter' => 'r_newsletter', 'coupon.check' => 'r_coupon_check', 'order.submit' => 'r_order_submit', 'order.attach' => 'r_order_attach',
    'auth.login' => 'r_auth_login', 'auth.otp.send' => 'r_auth_otp_send', 'auth.otp.login' => 'r_auth_otp_login',
    'auth.register' => 'r_auth_register', 'auth.lookup' => 'r_auth_lookup', 'auth.2fa' => 'r_auth_2fa', 'auth.logout' => 'r_auth_logout', 'auth.demo' => 'r_auth_demo',
    'fav.toggle' => 'r_fav_toggle', 'shop.checkout' => 'r_shop_checkout', 'shop.quote' => 'r_shop_quote',
    'cart.sync' => 'r_cart_sync',
    'chat.open' => 'r_chat_open', 'chat.send' => 'r_chat_send', 'chat.poll' => 'r_chat_poll', 'chat.escalate' => 'r_chat_escalate', 'chat.feedback' => 'r_chat_feedback',
    'delivery.slots' => 'r_delivery_slots', 'studio.info' => 'r_studio_info', 'studio.seo' => 'r_studio_seo',
    'studio.preview' => 'r_studio_preview', 'studio.names' => 'r_studio_names', 'pro.info' => 'r_pro_info', 'tools.quota' => 'r_tools_quota', 'tools.use' => 'r_tools_use',
    'product.reviews' => 'r_product_reviews', 'product.review' => 'r_product_review',
    'tools.track' => 'r_tools_track', 'tools.short.create' => 'r_short_create', 'tools.short.mine' => 'r_short_mine', 'tools.short.stats' => 'r_short_stats',
];
if (isset($public[$route])) {
    $public[$route]();
    exit;
}

require __DIR__ . '/lib/dash.php';
if ($route === 'dash') {
    r_dash();
    exit;
}
// Panel actions: a.<name> → a_<name with dots as underscores>
if (strpos($route, 'a.') === 0) {
    $fn = 'a_' . str_replace('.', '_', substr($route, 2));
    if (function_exists($fn)) {
        $fn();
        exit;
    }
}
fail('مسیر نامعتبر است.', 404, 'not_found');
