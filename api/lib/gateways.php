<?php
// BEHIX — payment gateways (Zarinpal, Zibal, test) and SMS providers (Kavenegar, SMS.ir).
// Amounts are stored in Toman; gateways are called in Rial.
if (!defined('BX')) { http_response_code(403); exit; }

function http_json(string $method, string $url, ?array $body = null, array $headers = []): array
{
    $ch = curl_init($url);
    $h = array_merge(['Accept: application/json'], $headers);
    if ($body !== null) {
        $h[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) return ['_error' => $err ?: 'network'];
    $j = json_decode($res, true);
    return is_array($j) ? $j : ['_error' => 'bad_response', '_raw' => mb_substr((string) $res, 0, 300)];
}

// Form-encoded or multipart POST (OAuth token endpoints). Returns [status, decoded body].
function http_form(string $url, array $fields, array $headers = [], bool $multipart = false): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_POSTFIELDS => $multipart ? $fields : http_build_query($fields),
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = is_string($res) ? json_decode($res, true) : null;
    return [$code, is_array($j) ? $j : []];
}
// JSON request that also returns the HTTP status: [status, body]
function http_call(string $method, string $url, ?array $body, array $headers = []): array
{
    $ch = curl_init($url);
    $h = array_merge(['Accept: application/json', 'Content-Type: application/json'], $headers);
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = is_string($res) ? json_decode($res, true) : null;
    return [$code, is_array($j) ? $j : []];
}

// ------------------------------------------------------------------ installment (BNPL) gateways
// Flows follow the open-source shetabit/multipay drivers (MIT). Each provider
// has its own settings group: bnpl_snapppay, bnpl_digipay, bnpl_azki, bnpl_torobpay.
const BNPL_PROVIDERS = ['snapppay' => 'اسنپ‌پی', 'digipay' => 'دیجی‌پی', 'azki' => 'ازکی وام', 'torobpay' => 'ترب‌پی'];

function bnpl_cfg(string $id): array
{
    return setting('bnpl_' . $id) ?: [];
}
// Providers a customer can pick for this amount (Toman)
function bnpl_available(int $amount): array
{
    $out = [];
    foreach (BNPL_PROVIDERS as $id => $name) {
        $c = bnpl_cfg($id);
        if (empty($c['enabled'])) continue;
        if (!empty($c['min']) && $amount < (int) $c['min']) continue;
        if (!empty($c['max']) && $amount > (int) $c['max']) continue;
        $out[] = $id;
    }
    return $out;
}
// Line items the providers need (amounts in Toman; converted to Rial when sent)
function bnpl_items(string $purpose, array $ref, int $amount, string $title): array
{
    $items = [];
    if ($purpose === 'cart') {
        foreach (rows('SELECT id, title FROM products WHERE id IN (' . (implode(',', array_map('intval', $ref['items'] ?? [])) ?: '0') . ')') as $p) {
            $items[] = ['id' => 'P' . $p['id'], 'name' => mb_substr($p['title'], 0, 100), 'category' => 'فایل دیجیتال'];
        }
    }
    if (!$items) $items[] = ['id' => $purpose === 'order' ? 'O' . (int) ($ref['orderId'] ?? 0) : 'X', 'name' => mb_substr($title, 0, 100), 'category' => 'خدمات طراحی'];
    // Spread the payable amount over the items so the cart total matches exactly
    $n = count($items);
    $share = intdiv($amount, $n);
    foreach ($items as $i => &$it) {
        $it['count'] = 1;
        $it['amount'] = $i === $n - 1 ? $amount - $share * ($n - 1) : $share;
    }
    return $items;
}
function bnpl_oauth(string $url, array $c, bool $multipart, array $extra = []): string
{
    [$code, $b] = http_form($url, ['grant_type' => 'password', 'username' => $c['username'] ?? '', 'password' => $c['password'] ?? ''] + $extra,
        ['Authorization: Basic ' . base64_encode(($c['clientId'] ?? '') . ':' . ($c['clientSecret'] ?? ''))], $multipart);
    if ($code !== 200 || empty($b['access_token'])) throw new RuntimeException('bnpl_oauth');
    return (string) $b['access_token'];
}
function bnpl_api(array $c, string $default): string
{
    return rtrim(trim((string) ($c['apiUrl'] ?? '')) ?: $default, '/');
}
function azki_signature(string $subUrl, string $key): string
{
    $plain = $subUrl . '#' . time() . '#POST#' . $key;
    return bin2hex((string) openssl_encrypt($plain, 'AES-256-CBC', (string) hex2bin($key), OPENSSL_RAW_DATA));
}
function azki_call(array $c, string $sub, array $data): array
{
    [$code, $b] = http_call('POST', bnpl_api($c, 'https://api.azkivam.com') . $sub, $data,
        ['Signature: ' . azki_signature($sub, (string) $c['key']), 'MerchantId: ' . $c['merchantId']]);
    if ($code !== 200 || (int) ($b['rsCode'] ?? -1) !== 0) return ['_error' => 'کد خطای ازکی: ' . ($b['rsCode'] ?? $code)];
    return (array) ($b['result'] ?? []);
}

// Starts an installment payment; returns the provider's payment page URL.
function bnpl_start(string $method, int $pid, string $purpose, array $ref, int $amount, string $description, string $mobile): string
{
    $c = bnpl_cfg($method);
    $callback = base_url() . '/api/index.php?r=pay.callback&pid=' . $pid;
    $items = bnpl_items($purpose, $ref, $amount, $description);
    $rial = $amount * 10;
    $mobile98 = preg_replace('/^0/', '+98', $mobile);

    if ($method === 'snapppay' || $method === 'torobpay') {
        $api = bnpl_api($c, $method === 'snapppay' ? 'https://fms-gateway-staging.apps.public.teh-1.snappcloud.io' : 'https://cpg.torobpay.com');
        $token = $method === 'snapppay'
            ? bnpl_oauth("$api/api/online/v1/oauth/token", $c, false, ['scope' => 'online-merchant'])
            : bnpl_oauth("$api/api/online/v1/oauth/token", $c, true);
        $cart = [[
            'cartId' => 'BX' . $pid, 'totalAmount' => $rial, 'shippingAmount' => 0, 'taxAmount' => 0,
            'isShipmentIncluded' => false, 'isTaxIncluded' => true,
            'cartItems' => array_map(function ($it) { return ['id' => $it['id'], 'name' => $it['name'], 'count' => 1, 'amount' => $it['amount'] * 10, 'category' => $it['category'], 'commissionType' => 100]; }, $items),
        ]];
        $body = ['amount' => $rial, 'mobile' => $mobile98, 'paymentMethodTypeDto' => $method === 'snapppay' ? 'INSTALLMENT' : 'ONLINE_CREDIT',
            'transactionId' => 'BX' . $pid . '-' . bin2hex(random_bytes(3)), 'returnURL' => $callback, 'cartList' => $cart];
        [$code, $b] = http_call('POST', "$api/api/online/payment/v1/token", $body, ['Authorization: Bearer ' . $token]);
        $payToken = $b['response']['paymentToken'] ?? null;
        $url = $b['response']['paymentPageUrl'] ?? null;
        if ($code !== 200 || ($b['successful'] ?? true) === false || !$payToken || !$url) {
            fail('درگاه اقساطی درخواست را نپذیرفت: ' . ($b['errorData']['message'] ?? $b['result']['message'] ?? 'خطای نامشخص'), 502);
        }
        update('payments', ['authority' => mb_substr((string) $payToken, 0, 120)], 'id = ?', [$pid]);
        return $url;
    }
    if ($method === 'digipay') {
        $api = bnpl_api($c, 'https://api.mydigipay.com');
        $token = bnpl_oauth("$api/digipay/api/oauth/token", $c, true);
        $provider = 'BX' . $pid;
        [$code, $b] = http_call('POST', "$api/digipay/api/tickets/business?type=11",
            ['amount' => $rial, 'cellNumber' => $mobile, 'providerId' => $provider, 'callbackUrl' => $callback],
            ['Authorization: Bearer ' . $token, 'Agent: WEB', 'Digipay-Version: 2022-02-02']);
        if ($code !== 200 || empty($b['redirectUrl'])) fail('دیجی‌پی درخواست را نپذیرفت: ' . ($b['result']['message'] ?? 'خطای نامشخص'), 502);
        update('payments', ['authority' => mb_substr((string) ($b['ticket'] ?? $provider), 0, 120)], 'id = ?', [$pid]);
        return $b['redirectUrl'];
    }
    if ($method === 'azki') {
        if (empty($c['merchantId']) || empty($c['key'])) fail('ازکی وام هنوز تنظیم نشده است.', 503);
        $r = azki_call($c, '/payment/purchase', [
            'amount' => $rial, 'redirect_uri' => $callback, 'fallback_uri' => $callback, 'provider_id' => 'BX' . $pid,
            'mobile_number' => $mobile, 'merchant_id' => $c['merchantId'], 'description' => $description,
            'items' => array_map(function ($it) { return ['name' => $it['name'], 'count' => 1, 'amount' => $it['amount'] * 10, 'url' => base_url()]; }, $items),
        ]);
        if (isset($r['_error']) || empty($r['payment_uri'])) fail('ازکی وام درخواست را نپذیرفت. ' . ($r['_error'] ?? ''), 502);
        update('payments', ['authority' => (string) $r['ticket_id']], 'id = ?', [$pid]);
        return $r['payment_uri'] . (strpos($r['payment_uri'], '?') === false ? '?' : '&') . 'ticketId=' . rawurlencode((string) $r['ticket_id']);
    }
    fail('روش پرداخت نامعتبر است.', 422);
}

// Verifies an installment payment on callback. Returns [ok, refId].
function bnpl_verify(array $pay): array
{
    $method = $pay['driver'];
    $c = bnpl_cfg($method);
    $in = $_REQUEST;
    if ($method === 'snapppay' || $method === 'torobpay') {
        if (isset($in['state']) && strtoupper((string) $in['state']) !== 'OK') return [false, null];
        $api = bnpl_api($c, $method === 'snapppay' ? 'https://fms-gateway-staging.apps.public.teh-1.snappcloud.io' : 'https://cpg.torobpay.com');
        $token = $method === 'snapppay'
            ? bnpl_oauth("$api/api/online/v1/oauth/token", $c, false, ['scope' => 'online-merchant'])
            : bnpl_oauth("$api/api/online/v1/oauth/token", $c, true);
        $auth = ['Authorization: Bearer ' . $token];
        [$code, $b] = http_call('POST', "$api/api/online/payment/v1/verify", ['paymentToken' => $pay['authority']], $auth);
        if ($code !== 200 || ($b['successful'] ?? false) !== true) return [false, null];
        if ($method === 'snapppay') {
            // SnappPay needs a settle after verify; if it fails the purchase is reverted.
            [$sc, $sb] = http_call('POST', "$api/api/online/payment/v1/settle", ['paymentToken' => $pay['authority']], $auth);
            if ($sc !== 200 || ($sb['successful'] ?? false) !== true) {
                http_call('POST', "$api/api/online/payment/v1/revert", ['paymentToken' => $pay['authority']], $auth);
                return [false, null];
            }
        }
        return [true, (string) ($b['response']['transactionId'] ?? $pay['authority'])];
    }
    if ($method === 'digipay') {
        $tracking = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($in['trackingCode'] ?? ''));
        $type = (int) ($in['type'] ?? 0);
        if ($tracking === '' || (isset($in['providerId']) && (string) $in['providerId'] !== 'BX' . $pay['id'])) return [false, null];
        if (isset($in['result']) && strtoupper((string) $in['result']) !== 'SUCCESS') return [false, null];
        $api = bnpl_api($c, 'https://api.mydigipay.com');
        $token = bnpl_oauth("$api/digipay/api/oauth/token", $c, true);
        [$code, $b] = http_call('POST', "$api/digipay/api/purchases/verify/$tracking?type=$type", null, ['Authorization: Bearer ' . $token]);
        if ($code !== 200) return [false, null];
        if (isset($b['amount']) && (int) $b['amount'] !== (int) $pay['amount'] * 10) return [false, null];
        return [true, (string) ($b['trackingCode'] ?? $tracking)];
    }
    if ($method === 'azki') {
        $st = azki_call($c, '/payment/status', ['ticket_id' => $pay['authority']]);
        if (isset($st['_error']) || (int) ($st['status'] ?? 0) !== 8) return [false, null];
        $v = azki_call($c, '/payment/verify', ['ticket_id' => $pay['authority']]);
        if (isset($v['_error'])) return [false, null];
        return [true, (string) $pay['authority']];
    }
    return [false, null];
}

// ------------------------------------------------------------------ payments
// Creates a pending payment and returns the URL the browser should open.
// $method: '' or 'gateway' = the site's bank gateway; or an installment provider id.
function payment_start(int $userId, string $purpose, array $ref, int $amount, string $description, string $method = ''): string
{
    $p = setting('payment');
    $driver = $p['driver'];
    if ($amount < 1000) fail('مبلغ پرداخت معتبر نیست.', 422);
    if (isset(BNPL_PROVIDERS[$method])) {
        if ($purpose === 'charge') fail('شارژ کیف پول با پرداخت اقساطی ممکن نیست.', 422);
        if (!in_array($method, bnpl_available($amount), true)) fail('این روش پرداخت برای این مبلغ در دسترس نیست.', 422);
        $driver = $method;
    }
    $id = insert('payments', ['user_id' => $userId, 'purpose' => $purpose, 'ref' => jenc($ref), 'amount' => $amount, 'driver' => $driver, 'status' => 'pending', 'created_at' => now()]);
    $callback = base_url() . '/api/index.php?r=pay.callback&pid=' . $id;
    $mobile = (string) val('SELECT phone FROM users WHERE id = ?', [$userId]);
    if (isset(BNPL_PROVIDERS[$driver])) {
        try {
            return bnpl_start($driver, $id, $purpose, $ref, $amount, $description, $mobile);
        } catch (RuntimeException $e) {
            fail('اتصال به درگاه اقساطی ناموفق بود؛ اطلاعات پذیرنده را در تنظیمات بررسی کنید.', 502);
        }
    }

    if ($driver === 'zarinpal') {
        if (!$p['merchant']) fail('درگاه پرداخت هنوز تنظیم نشده است.', 503);
        $host = !empty($p['sandbox']) ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
        $r = http_json('POST', "$host/pg/v4/payment/request.json", [
            'merchant_id' => $p['merchant'], 'amount' => $amount * 10, 'callback_url' => $callback,
            'description' => $description, 'metadata' => ['mobile' => $mobile],
        ]);
        $auth = $r['data']['authority'] ?? null;
        if (($r['data']['code'] ?? 0) !== 100 || !$auth) fail('اتصال به درگاه ناموفق بود: ' . jenc($r['errors'] ?? $r['_error'] ?? 'unknown'), 502);
        update('payments', ['authority' => $auth], 'id = ?', [$id]);
        return "$host/pg/StartPay/$auth";
    }
    if ($driver === 'zibal') {
        $merchant = !empty($p['sandbox']) ? 'zibal' : $p['merchant'];
        if (!$merchant) fail('درگاه پرداخت هنوز تنظیم نشده است.', 503);
        $r = http_json('POST', 'https://gateway.zibal.ir/v1/request', ['merchant' => $merchant, 'amount' => $amount * 10, 'callbackUrl' => $callback, 'description' => $description, 'mobile' => $mobile]);
        if (($r['result'] ?? 0) !== 100 || empty($r['trackId'])) fail('اتصال به درگاه ناموفق بود: ' . ($r['message'] ?? $r['_error'] ?? 'unknown'), 502);
        update('payments', ['authority' => (string) $r['trackId']], 'id = ?', [$id]);
        return 'https://gateway.zibal.ir/start/' . $r['trackId'];
    }
    // Test driver: completes without real money, so it only works while demo mode is on.
    if (!setting('general', 'demoMode')) fail('درگاه پرداخت هنوز تنظیم نشده است. لطفاً با پشتیبانی تماس بگیرید.', 503);
    $auth = 'TEST-' . bin2hex(random_bytes(6));
    update('payments', ['authority' => $auth], 'id = ?', [$id]);
    return $callback . '&Authority=' . $auth . '&Status=OK';
}

// Gateway callback: verify, then apply the payment's purpose exactly once.
function payment_callback(): void
{
    $pid = (int) ($_GET['pid'] ?? 0);
    $pay = row('SELECT * FROM payments WHERE id = ?', [$pid]);
    $back = function (string $hash, bool $ok, string $msg) {
        header('Location: ' . base_url() . '/dashboard.html?pay=' . ($ok ? 'ok' : 'fail') . '&msg=' . rawurlencode($msg) . '#' . $hash);
        exit;
    };
    if (!$pay) $back('overview', false, 'پرداخت پیدا نشد.');
    $hash = ['charge' => 'wallet', 'order' => 'orders', 'cart' => 'downloads'][$pay['purpose']] ?? 'overview';
    if ($pay['status'] === 'paid') $back($hash, true, 'این پرداخت قبلاً تأیید شده است.');

    $p = setting('payment');
    $ok = false;
    $refId = null;
    if ($pay['driver'] === 'zarinpal') {
        $auth = $_GET['Authority'] ?? '';
        if (($_GET['Status'] ?? '') === 'OK' && hash_equals((string) $pay['authority'], (string) $auth)) {
            $host = !empty($p['sandbox']) ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
            $r = http_json('POST', "$host/pg/v4/payment/verify.json", ['merchant_id' => $p['merchant'], 'amount' => (int) $pay['amount'] * 10, 'authority' => $auth]);
            $code = $r['data']['code'] ?? 0;
            $ok = in_array($code, [100, 101], true);
            $refId = $r['data']['ref_id'] ?? null;
        }
    } elseif ($pay['driver'] === 'zibal') {
        $track = $_GET['trackId'] ?? '';
        if (($_GET['success'] ?? '') === '1' && hash_equals((string) $pay['authority'], (string) $track)) {
            $merchant = !empty($p['sandbox']) ? 'zibal' : $p['merchant'];
            $r = http_json('POST', 'https://gateway.zibal.ir/v1/verify', ['merchant' => $merchant, 'trackId' => (int) $track]);
            $ok = in_array($r['result'] ?? 0, [100, 201], true) && (int) ($r['amount'] ?? 0) === (int) $pay['amount'] * 10;
            $refId = $r['refNumber'] ?? null;
        }
    } elseif (isset(BNPL_PROVIDERS[$pay['driver']])) {
        try { [$ok, $refId] = bnpl_verify($pay); } catch (Throwable $e) { $ok = false; }
    } elseif ($pay['driver'] === 'test') {
        $ok = ($_GET['Status'] ?? '') === 'OK' && hash_equals((string) $pay['authority'], (string) ($_GET['Authority'] ?? ''));
        $refId = 'TEST';
    }
    if (!$ok) {
        update('payments', ['status' => 'failed'], 'id = ? AND status = ?', [$pid, 'pending']);
        $back($hash, false, 'پرداخت انجام نشد یا لغو شد.');
    }

    db()->beginTransaction();
    // Lock the row so a double callback cannot apply the payment twice
    $locked = row('SELECT * FROM payments WHERE id = ? FOR UPDATE', [$pid]);
    if ($locked['status'] === 'paid') {
        db()->commit();
        $back($hash, true, 'این پرداخت قبلاً تأیید شده است.');
    }
    update('payments', ['status' => 'paid', 'ref_id' => (string) $refId], 'id = ?', [$pid]);
    $msg = payment_apply($locked);
    db()->commit();
    $back($hash, true, $msg);
}

function payment_apply(array $pay): string
{
    $uid = (int) $pay['user_id'];
    $amount = (int) $pay['amount'];
    $ref = jdec($pay['ref'], []);
    if ($pay['purpose'] === 'charge') {
        wallet_add($uid, $amount);
        tx($uid, 'charge', $amount, 'شارژ کیف پول');
        return toman($amount) . ' به کیف پول اضافه شد.';
    }
    if ($pay['purpose'] === 'order') {
        // The amount is credited to the wallet first, then the order is paid from it.
        wallet_add($uid, $amount);
        tx($uid, 'charge', $amount, 'پرداخت آنلاین');
        require_once __DIR__ . '/dash.php';
        $o = row('SELECT * FROM orders WHERE id = ?', [(int) $ref['orderId']]);
        if ($o && !$o['paid']) order_pay_from_wallet($o, $uid);
        return 'پرداخت سفارش با موفقیت انجام شد.';
    }
    if ($pay['purpose'] === 'cart') {
        wallet_add($uid, $amount);
        tx($uid, 'charge', $amount, 'پرداخت آنلاین');
        require_once __DIR__ . '/public.php';
        shop_complete($uid, array_map('intval', $ref['items'] ?? []), (string) ($ref['coupon'] ?? ''));
        return 'خرید با موفقیت انجام شد؛ فایل‌ها در بخش دانلودها آماده است.';
    }
    return 'پرداخت انجام شد.';
}

// ------------------------------------------------------------------ SMS
function sms_enabled(): bool
{
    return setting('sms', 'driver') !== 'none' && setting('sms', 'apiKey') !== '';
}

// Sends a one-time code. Returns true on success.
function sms_send_code(string $phone, string $code): bool
{
    $s = setting('sms');
    if ($s['driver'] === 'kavenegar') {
        $url = 'https://api.kavenegar.com/v1/' . rawurlencode($s['apiKey']) . '/verify/lookup.json?' . http_build_query(['receptor' => $phone, 'token' => $code, 'template' => $s['template']]);
        $r = http_json('GET', $url);
        return (int) ($r['return']['status'] ?? 0) === 200;
    }
    if ($s['driver'] === 'smsir') {
        $r = http_json('POST', 'https://api.sms.ir/v1/send/verify', [
            'mobile' => $phone, 'templateId' => (int) $s['templateId'],
            'parameters' => [['name' => $s['paramName'] ?: 'CODE', 'value' => $code]],
        ], ['X-API-KEY: ' . $s['apiKey']]);
        return (int) ($r['status'] ?? 0) === 1;
    }
    return false;
}
