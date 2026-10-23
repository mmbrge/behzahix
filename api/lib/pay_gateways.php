<?php
// BEHIX — online payment gateways. Several can be active at once; the customer
// picks one at checkout. Each has a settings group gw_<id> (Settings → Payment).
// Payment services: Zarinpal, Zibal, IDPay, PayPing, NextPay.
// Bank (Shaparak PSP) gateways: Mellat (Behpardakht), Saman (SEP), Melli (Sadad),
// Parsian (PEC), Pasargad (PEP), Saderat (Sepehr).
// Amounts are stored in Toman; every gateway here is called in Rial except PayPing (Toman).
if (!defined('BX')) { http_response_code(403); exit; }

const PAY_GATEWAYS = [
    'zarinpal' => 'زرین‌پال', 'zibal' => 'زیبال', 'idpay' => 'آیدی‌پی', 'payping' => 'پی‌پینگ', 'nextpay' => 'نکست‌پی',
    'mellat' => 'بانک ملت (به‌پرداخت)', 'saman' => 'بانک سامان (سپ)', 'sadad' => 'بانک ملی (سداد)', 'parsian' => 'بانک پارسیان (پک)',
    'pasargad' => 'بانک پاسارگاد (پپ)', 'sepehr' => 'بانک صادرات (سپهر)',
];

function gw_cfg(string $id): array
{
    return setting('gw_' . $id) ?: [];
}
// Enabled gateways, in the admin's order
function gw_enabled(): array
{
    $out = [];
    foreach (PAY_GATEWAYS as $id => $title) {
        $c = gw_cfg($id);
        if (!empty($c['enabled'])) $out[$id] = (int) ($c['sort'] ?? 0);
    }
    asort($out);
    return array_keys($out);
}
// Readable reason when a gateway refuses or cannot be reached
function gw_why($detail, int $code = 200): string
{
    if ($code === 0) return 'سرور درگاه پاسخ نداد؛ اتصال اینترنت هاست به درگاه و ثبت آی‌پی سرور نزد بانک را بررسی کنید.';
    return (string) $detail;
}
function gw_need(array $c, array $keys): void
{
    foreach ($keys as $k) if (trim((string) ($c[$k] ?? '')) === '') fail('اطلاعات این درگاه کامل نیست؛ در تنظیمات ← درگاه پرداخت تکمیل کنید.', 503);
}
// Minimal SOAP 1.1 call (no ext-soap needed). Returns the response XML or ''.
function gw_soap(string $url, string $action, string $body): string
{
    $xml = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' . $body . '</soap:Body></soap:Envelope>';
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $xml, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: text/xml; charset=utf-8', 'SOAPAction: "' . $action . '"']]);
    $res = curl_exec($ch);
    curl_close($ch);
    return is_string($res) ? $res : '';
}
function gw_xml(string $xml, string $tag): string
{
    return preg_match('#<(?:\w+:)?' . preg_quote($tag, '#') . '>(.*?)</(?:\w+:)?' . preg_quote($tag, '#') . '>#s', $xml, $m) ? html_entity_decode(trim($m[1])) : '';
}
function gw_x(string $v): string { return htmlspecialchars($v, ENT_XML1 | ENT_QUOTES, 'UTF-8'); }
function gw_tehran(string $fmt): string
{
    return (new DateTime('now', new DateTimeZone('Asia/Tehran')))->format($fmt);
}
// Melli (Sadad) signs requests with TripleDES using the merchant key
function sadad_sign(string $data, string $key): string
{
    return base64_encode((string) openssl_encrypt($data, 'DES-EDE3', (string) base64_decode($key), OPENSSL_RAW_DATA));
}
function pep_token(array $c): string
{
    $api = rtrim(trim((string) ($c['apiUrl'] ?? '')) ?: 'https://pep.shaparak.ir/dorsa1', '/');
    [$code, $b] = http_call('POST', "$api/token/getToken", ['username' => (string) $c['username'], 'password' => (string) $c['password']]);
    $t = $b['token'] ?? ($b['data']['token'] ?? '');
    if ($code !== 200 || !$t) fail($code === 0 ? 'بانک پاسارگاد: ' . gw_why('', 0) : 'ورود به درگاه پاسارگاد ناموفق بود؛ نام کاربری و رمز را بررسی کنید.', 502);
    return (string) $t;
}

/**
 * Starts a payment. Returns ['url' => …] for a plain redirect, or
 * ['form' => [action, fields]] when the bank needs a POSTed form.
 */
function gw_start(string $id, int $pid, int $amount, string $desc, string $mobile, string $callback): array
{
    $c = gw_cfg($id);
    $rial = $amount * 10;
    $sandbox = !empty($c['sandbox']);
    switch ($id) {
        case 'zarinpal':
            gw_need($c, ['merchant']);
            $host = $sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
            $r = http_json('POST', "$host/pg/v4/payment/request.json", ['merchant_id' => $c['merchant'], 'amount' => $rial, 'callback_url' => $callback, 'description' => $desc, 'metadata' => ['mobile' => $mobile]]);
            $auth = $r['data']['authority'] ?? null;
            if (($r['data']['code'] ?? 0) !== 100 || !$auth) fail('زرین‌پال درخواست را نپذیرفت: ' . jenc($r['errors'] ?? $r['_error'] ?? 'unknown'), 502);
            return ['authority' => $auth, 'url' => "$host/pg/StartPay/$auth"];
        case 'zibal':
            $merchant = $sandbox ? 'zibal' : (string) ($c['merchant'] ?? '');
            if (!$merchant) gw_need($c, ['merchant']);
            $r = http_json('POST', 'https://gateway.zibal.ir/v1/request', ['merchant' => $merchant, 'amount' => $rial, 'callbackUrl' => $callback, 'description' => $desc, 'mobile' => $mobile]);
            if (($r['result'] ?? 0) !== 100 || empty($r['trackId'])) fail('زیبال درخواست را نپذیرفت: ' . ($r['message'] ?? $r['_error'] ?? 'unknown'), 502);
            return ['authority' => (string) $r['trackId'], 'url' => 'https://gateway.zibal.ir/start/' . $r['trackId']];
        case 'idpay':
            gw_need($c, ['apiKey']);
            [$code, $b] = http_call('POST', 'https://api.idpay.ir/v1.1/payment', ['order_id' => 'BX' . $pid, 'amount' => $rial, 'phone' => $mobile, 'desc' => $desc, 'callback' => $callback],
                ['X-API-KEY: ' . $c['apiKey'], 'X-SANDBOX: ' . ($sandbox ? '1' : '0')]);
            if ($code !== 201 || empty($b['id']) || empty($b['link'])) fail('آیدی‌پی درخواست را نپذیرفت: ' . gw_why($b['error_message'] ?? $code, $code), 502);
            return ['authority' => (string) $b['id'], 'url' => (string) $b['link']];
        case 'payping':
            gw_need($c, ['token']);
            [$code, $b] = http_call('POST', 'https://api.payping.ir/v2/pay', ['amount' => $amount, 'payerIdentity' => $mobile, 'description' => $desc, 'returnUrl' => $callback, 'clientRefId' => 'BX' . $pid],
                ['Authorization: Bearer ' . $c['token']]);
            if ($code !== 200 || empty($b['code'])) fail('پی‌پینگ درخواست را نپذیرفت: ' . gw_why('کد ' . $code, $code), 502);
            return ['authority' => (string) $b['code'], 'url' => 'https://api.payping.ir/v2/pay/gotoipg/' . rawurlencode((string) $b['code'])];
        case 'nextpay':
            gw_need($c, ['apiKey']);
            [$code, $b] = http_form('https://nextpay.org/nx/gateway/token', ['api_key' => $c['apiKey'], 'order_id' => 'BX' . $pid, 'amount' => $rial, 'currency' => 'IRR', 'callback_uri' => $callback, 'customer_phone' => $mobile]);
            if ((int) ($b['code'] ?? 0) !== -1 || empty($b['trans_id'])) fail('نکست‌پی درخواست را نپذیرفت: ' . gw_why('کد ' . ($b['code'] ?? $code), $code), 502);
            return ['authority' => (string) $b['trans_id'], 'url' => 'https://nextpay.org/nx/gateway/payment/' . rawurlencode((string) $b['trans_id'])];
        case 'mellat':
            gw_need($c, ['terminalId', 'username', 'password']);
            $xml = gw_soap('https://bpm.shaparak.ir/pgwchannel/services/pgw', '', '<ns1:bpPayRequest xmlns:ns1="http://interfaces.core.sw.bps.com/">'
                . '<terminalId>' . gw_x((string) $c['terminalId']) . '</terminalId><userName>' . gw_x((string) $c['username']) . '</userName><userPassword>' . gw_x((string) $c['password']) . '</userPassword>'
                . '<orderId>' . $pid . '</orderId><amount>' . $rial . '</amount><localDate>' . gw_tehran('Ymd') . '</localDate><localTime>' . gw_tehran('His') . '</localTime>'
                . '<additionalData>' . gw_x($desc) . '</additionalData><callBackUrl>' . gw_x($callback) . '</callBackUrl><payerId>0</payerId><mobileNo>' . gw_x(preg_replace('/^0/', '98', $mobile)) . '</mobileNo></ns1:bpPayRequest>');
            $ret = explode(',', gw_xml($xml, 'return'));
            if (($ret[0] ?? '') !== '0' || empty($ret[1])) fail('بانک ملت درخواست را نپذیرفت: ' . ($ret[0] !== '' ? 'کد ' . $ret[0] : gw_why('', 0)), 502);
            return ['authority' => $ret[1], 'form' => ['https://bpm.shaparak.ir/pgwchannel/startpay.mellat', ['RefId' => $ret[1], 'MobileNo' => preg_replace('/^0/', '98', $mobile)]]];
        case 'saman':
            gw_need($c, ['terminalId']);
            [$code, $b] = http_call('POST', 'https://sep.shaparak.ir/onlinepg/onlinepg', ['action' => 'token', 'TerminalId' => (string) $c['terminalId'], 'Amount' => $rial, 'ResNum' => 'BX' . $pid, 'RedirectUrl' => $callback, 'CellNumber' => $mobile]);
            if ((int) ($b['status'] ?? 0) !== 1 || empty($b['token'])) fail('بانک سامان درخواست را نپذیرفت: ' . gw_why($b['errorDesc'] ?? ('کد ' . $code), $code), 502);
            return ['authority' => (string) $b['token'], 'url' => 'https://sep.shaparak.ir/OnlinePG/SendToken?token=' . rawurlencode((string) $b['token'])];
        case 'sadad':
            gw_need($c, ['terminalId', 'merchantId', 'key']);
            [$code, $b] = http_call('POST', 'https://sadad.shaparak.ir/vpg/api/v0/Request/PaymentRequest', [
                'TerminalId' => (string) $c['terminalId'], 'MerchantId' => (string) $c['merchantId'], 'Amount' => $rial, 'OrderId' => $pid,
                'LocalDateTime' => gw_tehran('m/d/Y g:i:s a'), 'ReturnUrl' => $callback, 'SignData' => sadad_sign($c['terminalId'] . ';' . $pid . ';' . $rial, (string) $c['key']), 'UserId' => $mobile]);
            if ((int) ($b['ResCode'] ?? -1) !== 0 || empty($b['Token'])) fail('بانک ملی (سداد) درخواست را نپذیرفت: ' . gw_why($b['Description'] ?? ('کد ' . $code), $code), 502);
            return ['authority' => (string) $b['Token'], 'url' => 'https://sadad.shaparak.ir/VPG/Purchase?Token=' . rawurlencode((string) $b['Token'])];
        case 'parsian':
            gw_need($c, ['pin']);
            $xml = gw_soap('https://pec.shaparak.ir/NewIPGServices/Sale/SaleService.asmx', 'https://pec.Shaparak.ir/NewIPGServices/Sale/SaleService/SalePaymentRequest',
                '<SalePaymentRequest xmlns="https://pec.Shaparak.ir/NewIPGServices/Sale/SaleService"><requestData><LoginAccount>' . gw_x((string) $c['pin']) . '</LoginAccount><Amount>' . $rial . '</Amount><OrderId>' . $pid . '</OrderId><CallBackUrl>' . gw_x($callback) . '</CallBackUrl><AdditionalData>' . gw_x($desc) . '</AdditionalData><Originator>' . gw_x($mobile) . '</Originator></requestData></SalePaymentRequest>');
            $token = gw_xml($xml, 'Token');
            if (gw_xml($xml, 'Status') !== '0' || !$token || $token === '0') fail('بانک پارسیان درخواست را نپذیرفت: ' . (gw_xml($xml, 'Message') ?: gw_why('', $xml === '' ? 0 : 200) ?: 'پاسخ نامعتبر'), 502);
            return ['authority' => $token, 'url' => 'https://pec.shaparak.ir/NewIPG/?token=' . rawurlencode($token)];
        case 'pasargad':
            gw_need($c, ['terminalNumber', 'username', 'password']);
            $api = rtrim(trim((string) ($c['apiUrl'] ?? '')) ?: 'https://pep.shaparak.ir/dorsa1', '/');
            $token = pep_token($c);
            $invoice = (string) $pid . gw_tehran('His');
            [$code, $b] = http_call('POST', "$api/api/payment/purchase", ['amount' => $rial, 'callbackApi' => $callback, 'description' => $desc, 'invoice' => $invoice, 'invoiceDate' => gw_tehran('Y-m-d'),
                'mobileNumber' => $mobile, 'serviceCode' => '8', 'serviceType' => 'PURCHASE', 'terminalNumber' => (int) $c['terminalNumber']], ['Authorization: Bearer ' . $token]);
            if ((int) ($b['resultCode'] ?? -1) !== 0 || empty($b['data']['url'])) fail('بانک پاسارگاد درخواست را نپذیرفت: ' . gw_why($b['resultMsg'] ?? ('کد ' . $code), $code), 502);
            return ['authority' => $invoice . '|' . ($b['data']['urlId'] ?? ''), 'url' => (string) $b['data']['url']];
        case 'sepehr':
            gw_need($c, ['terminalId']);
            [$code, $b] = http_call('POST', 'https://sepehr.shaparak.ir:8081/V1/PeymentApi/GetToken', ['Amount' => $rial, 'callbackURL' => $callback, 'invoiceID' => (string) $pid, 'terminalID' => (string) $c['terminalId'], 'payload' => '']);
            if ((int) ($b['Status'] ?? -1) !== 0 || empty($b['Accesstoken'])) fail('بانک صادرات (سپهر) درخواست را نپذیرفت: ' . gw_why('کد ' . ($b['Status'] ?? $code), $code), 502);
            return ['authority' => (string) $b['Accesstoken'], 'form' => ['https://sepehr.shaparak.ir:8080/Pay', ['TerminalID' => (string) $c['terminalId'], 'token' => (string) $b['Accesstoken'], 'getMethod' => '0']]];
    }
    fail('درگاه نامعتبر است.', 422);
}

// Verifies on the gateway's callback (GET or POST). Returns [ok, refId].
function gw_verify(string $id, array $pay): array
{
    $c = gw_cfg($id);
    $in = $_REQUEST;
    $rial = (int) $pay['amount'] * 10;
    $auth = (string) $pay['authority'];
    $same = function ($v) use ($auth) { return $auth !== '' && hash_equals($auth, (string) $v); };
    switch ($id) {
        case 'zarinpal':
            if (($in['Status'] ?? '') !== 'OK' || !$same($in['Authority'] ?? '')) return [false, null];
            $host = !empty($c['sandbox']) ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
            $r = http_json('POST', "$host/pg/v4/payment/verify.json", ['merchant_id' => $c['merchant'] ?? '', 'amount' => $rial, 'authority' => $auth]);
            return [in_array($r['data']['code'] ?? 0, [100, 101], true), $r['data']['ref_id'] ?? null];
        case 'zibal':
            if (($in['success'] ?? '') !== '1' || !$same($in['trackId'] ?? '')) return [false, null];
            $r = http_json('POST', 'https://gateway.zibal.ir/v1/verify', ['merchant' => !empty($c['sandbox']) ? 'zibal' : ($c['merchant'] ?? ''), 'trackId' => (int) $auth]);
            return [in_array($r['result'] ?? 0, [100, 201], true) && (int) ($r['amount'] ?? 0) === $rial, $r['refNumber'] ?? null];
        case 'idpay':
            if ((int) ($in['status'] ?? 0) !== 10 || !$same($in['id'] ?? '')) return [false, null];
            [$code, $b] = http_call('POST', 'https://api.idpay.ir/v1.1/payment/verify', ['id' => $auth, 'order_id' => 'BX' . $pay['id']], ['X-API-KEY: ' . ($c['apiKey'] ?? ''), 'X-SANDBOX: ' . (!empty($c['sandbox']) ? '1' : '0')]);
            return [$code === 200 && in_array((int) ($b['status'] ?? 0), [100, 101], true) && (int) ($b['amount'] ?? 0) === $rial, $b['track_id'] ?? null];
        case 'payping':
            $refId = (string) ($in['refid'] ?? $in['refId'] ?? '');
            if ($refId === '' || (string) ($in['clientrefid'] ?? $in['clientRefId'] ?? '') !== 'BX' . $pay['id']) return [false, null];
            [$code] = http_call('POST', 'https://api.payping.ir/v2/pay/verify', ['refId' => $refId, 'amount' => (int) $pay['amount']], ['Authorization: Bearer ' . ($c['token'] ?? '')]);
            return [$code === 200, $refId];
        case 'nextpay':
            if (!$same($in['trans_id'] ?? '')) return [false, null];
            [, $b] = http_form('https://nextpay.org/nx/gateway/verify', ['api_key' => $c['apiKey'] ?? '', 'trans_id' => $auth, 'amount' => $rial, 'currency' => 'IRR']);
            return [(int) ($b['code'] ?? -1) === 0, $b['Shaparak_Ref_Id'] ?? null];
        case 'mellat':
            if ((string) ($in['ResCode'] ?? '') !== '0' || !$same($in['RefId'] ?? '') || (int) ($in['SaleOrderId'] ?? 0) !== (int) $pay['id']) return [false, null];
            $sale = preg_replace('/\D/', '', (string) ($in['SaleReferenceId'] ?? ''));
            $args = '<terminalId>' . gw_x((string) $c['terminalId']) . '</terminalId><userName>' . gw_x((string) $c['username']) . '</userName><userPassword>' . gw_x((string) $c['password']) . '</userPassword>'
                . '<orderId>' . (int) $pay['id'] . '</orderId><saleOrderId>' . (int) $pay['id'] . '</saleOrderId><saleReferenceId>' . $sale . '</saleReferenceId>';
            $v = gw_xml(gw_soap('https://bpm.shaparak.ir/pgwchannel/services/pgw', '', '<ns1:bpVerifyRequest xmlns:ns1="http://interfaces.core.sw.bps.com/">' . $args . '</ns1:bpVerifyRequest>'), 'return');
            if ($v !== '0') return [false, null];
            // settle moves the money to the merchant; 45 = already settled
            $s = gw_xml(gw_soap('https://bpm.shaparak.ir/pgwchannel/services/pgw', '', '<ns1:bpSettleRequest xmlns:ns1="http://interfaces.core.sw.bps.com/">' . $args . '</ns1:bpSettleRequest>'), 'return');
            return [in_array($s, ['0', '45'], true), $sale];
        case 'saman':
            if ((int) ($in['Status'] ?? 0) !== 2 || (string) ($in['ResNum'] ?? '') !== 'BX' . $pay['id']) return [false, null];
            [, $b] = http_call('POST', 'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction', ['RefNum' => (string) ($in['RefNum'] ?? ''), 'TerminalNumber' => (int) ($c['terminalId'] ?? 0)]);
            $ok = !empty($b['Success']) && (int) ($b['ResultCode'] ?? -1) === 0 && (int) ($b['TransactionDetail']['OrginalAmount'] ?? 0) === $rial;
            return [$ok, $b['TransactionDetail']['RRN'] ?? ($in['RRN'] ?? null)];
        case 'sadad':
            if ((string) ($in['ResCode'] ?? '') !== '0' || !$same($in['token'] ?? $in['Token'] ?? '')) return [false, null];
            [, $b] = http_call('POST', 'https://sadad.shaparak.ir/vpg/api/v0/Advice/Verify', ['Token' => $auth, 'SignData' => sadad_sign($auth, (string) ($c['key'] ?? ''))]);
            return [(int) ($b['ResCode'] ?? -1) === 0 && (int) ($b['Amount'] ?? 0) === $rial, $b['RetrivalRefNo'] ?? null];
        case 'parsian':
            if ((string) ($in['status'] ?? '') !== '0' || !$same($in['Token'] ?? '') || (int) ($in['OrderId'] ?? 0) !== (int) $pay['id']) return [false, null];
            $xml = gw_soap('https://pec.shaparak.ir/NewIPGServices/Confirm/ConfirmService.asmx', 'https://pec.Shaparak.ir/NewIPGServices/Confirm/ConfirmService/ConfirmPayment',
                '<ConfirmPayment xmlns="https://pec.Shaparak.ir/NewIPGServices/Confirm/ConfirmService"><requestData><LoginAccount>' . gw_x((string) $c['pin']) . '</LoginAccount><Token>' . gw_x($auth) . '</Token></requestData></ConfirmPayment>');
            return [gw_xml($xml, 'Status') === '0', gw_xml($xml, 'RRN') ?: null];
        case 'pasargad':
            [$invoice, $urlId] = array_pad(explode('|', $auth, 2), 2, '');
            if (strtolower((string) ($in['status'] ?? '')) !== 'success' || (string) ($in['invoiceId'] ?? '') !== $invoice) return [false, null];
            $api = rtrim(trim((string) ($c['apiUrl'] ?? '')) ?: 'https://pep.shaparak.ir/dorsa1', '/');
            [, $b] = http_call('POST', "$api/api/payment/confirm-transactions", ['invoice' => $invoice, 'urlId' => $urlId], ['Authorization: Bearer ' . pep_token($c)]);
            return [(int) ($b['resultCode'] ?? -1) === 0, $b['data']['referenceNumber'] ?? ($in['referenceNumber'] ?? null)];
        case 'sepehr':
            if ((string) ($in['respcode'] ?? '') !== '0' || (string) ($in['invoiceid'] ?? '') !== (string) $pay['id']) return [false, null];
            $receipt = (string) ($in['digitalreceipt'] ?? '');
            [, $b] = http_call('POST', 'https://sepehr.shaparak.ir:8081/V1/PeymentApi/Advice', ['digitalreceipt' => $receipt, 'Tid' => (string) ($c['terminalId'] ?? '')]);
            $st = strtolower((string) ($b['Status'] ?? ''));
            return [in_array($st, ['ok', 'duplicate'], true) && (int) ($b['ReturnId'] ?? 0) === $rial, $in['rrn'] ?? $receipt];
    }
    return [false, null];
}

// GET pay.go&pid=… — banks that start with a POSTed form get it here
function r_pay_go(): void
{
    $pay = row("SELECT * FROM payments WHERE id = ? AND status = 'pending'", [(int) ($_GET['pid'] ?? 0)]);
    $f = $pay ? jdec((string) ($pay['meta'] ?? ''), []) : [];
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    if (empty($f['action'])) exit('<p dir="rtl" style="font-family:Tahoma">پرداخت پیدا نشد یا منقضی شده است.</p>');
    $h = function ($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); };
    echo '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>انتقال به درگاه بانک</title></head><body style="font-family:Tahoma;text-align:center;padding:60px 16px">'
        . '<form id="f" method="post" action="' . $h($f['action']) . '">';
    foreach ((array) ($f['fields'] ?? []) as $k => $v) echo '<input type="hidden" name="' . $h($k) . '" value="' . $h($v) . '">';
    echo '<p>در حال انتقال به درگاه بانک…</p><button type="submit">اگر منتقل نشدید، اینجا را بزنید</button></form><script>document.getElementById("f").submit()</script></body></html>';
    exit;
}
