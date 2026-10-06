<?php
// BEHIX API router — every request: /api/?r=<route>
declare(strict_types=1);
define('BX', true);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/public.php';
require __DIR__ . '/lib/tools.php';
require __DIR__ . '/lib/chat.php';
require __DIR__ . '/lib/delivery.php';

set_exception_handler(function (Throwable $e) {
    error_log('[BEHIX] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (db_in_tx()) db()->rollBack();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'server', 'message' => 'خطای سرور رخ داد؛ دوباره تلاش کنید.'], JSON_UNESCAPED_UNICODE);
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

// GET routes (no state change, no CSRF)
// Scheduled jobs (abandoned-cart SMS…): piggyback on traffic; never blocks the request
try { lazy_cron(($route === 'cron')); } catch (Throwable $e) { error_log('[BEHIX] cron: ' . $e->getMessage()); }
if ($route === 'cron') out(['ok' => true]);
$get = ['boot' => 'r_boot', 'file' => 'r_file', 'pay.callback' => 'payment_callback', 'go' => 'r_short_go', 'invoice' => 'r_invoice'];
// SEO feeds (also reachable as /sitemap.xml and /robots.txt through seo.php)
$feeds = ['feed.torob' => 'seo_feed_torob', 'feed.blog' => 'blog', 'feed.products' => 'products', 'sitemap' => 'seo_sitemap', 'robots' => 'seo_robots'];
if (isset($feeds[$route])) {
    require_once __DIR__ . '/lib/seo.php';
    $f = $feeds[$route];
    function_exists($f) ? $f() : seo_feed_rss($f);
}
if (isset($get[$route])) {
    if ($route === 'pay.callback') require_once __DIR__ . '/lib/gateways.php';
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
    'auth.register' => 'r_auth_register', 'auth.logout' => 'r_auth_logout', 'auth.demo' => 'r_auth_demo',
    'fav.toggle' => 'r_fav_toggle', 'shop.checkout' => 'r_shop_checkout', 'shop.quote' => 'r_shop_quote',
    'cart.sync' => 'r_cart_sync',
    'chat.open' => 'r_chat_open', 'chat.send' => 'r_chat_send', 'chat.poll' => 'r_chat_poll', 'chat.escalate' => 'r_chat_escalate', 'chat.feedback' => 'r_chat_feedback',
    'delivery.slots' => 'r_delivery_slots',
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
