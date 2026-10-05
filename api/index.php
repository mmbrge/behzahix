<?php
// BEHIX API router — every request: /api/?r=<route>
declare(strict_types=1);
define('BX', true);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/public.php';
require __DIR__ . '/lib/tools.php';

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
ensure_schema();
start_session();

// GET routes (no state change, no CSRF)
$get = ['boot' => 'r_boot', 'file' => 'r_file', 'pay.callback' => 'payment_callback', 'go' => 'r_short_go'];
if (isset($get[$route])) {
    if ($route === 'pay.callback') require_once __DIR__ . '/lib/gateways.php';
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
