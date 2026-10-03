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

// ------------------------------------------------------------------ payments
// Creates a pending payment and returns the URL the browser should open.
function payment_start(int $userId, string $purpose, array $ref, int $amount, string $description): string
{
    $p = setting('payment');
    $driver = $p['driver'];
    if ($amount < 1000) fail('مبلغ پرداخت معتبر نیست.', 422);
    $id = insert('payments', ['user_id' => $userId, 'purpose' => $purpose, 'ref' => jenc($ref), 'amount' => $amount, 'driver' => $driver, 'status' => 'pending', 'created_at' => now()]);
    $callback = base_url() . '/api/index.php?r=pay.callback&pid=' . $id;
    $mobile = (string) val('SELECT phone FROM users WHERE id = ?', [$userId]);

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
