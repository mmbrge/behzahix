<?php
// BEHIX — event SMS (order status, shop, support…) using provider "pattern"
// templates: Kavenegar lookup (%token…) or SMS.ir verify (#PARAM#).
// The admin copies each ready text below into the SMS panel, gets it approved,
// then enters the template name / id in «تنظیمات ← پیامک‌ها».
if (!defined('BX')) { http_response_code(403); exit; }

// Variables: [key, Persian label, has spaces?, sample value]
const SMS_VARS = [
    'name' => ['نام', true, 'سارا محمدی'], 'code' => ['کد', false, 'BX-1024'], 'amount' => ['مبلغ (تومان)', false, '2,500,000'],
    'count' => ['تعداد', false, '3'], 'phone' => ['موبایل', false, '09121234567'],
    'date' => ['تاریخ و ساعت', true, 'چهارشنبه ۱۶ مهر، صبح (۰۹:۰۰ تا ۱۲:۰۰)'],
];

// id => [title, recipient, vars, text]; {site} is replaced by the site name when shown
function sms_events_def(): array
{
    return [
        'order_new' => ['ثبت سفارش', 'مشتری', ['name', 'code'], "{name} عزیز، سفارش {code} در {site} ثبت شد.\nپیش‌فاکتور تا ۲ ساعت کاری در پنل شما قرار می‌گیرد."],
        'order_quote' => ['صدور پیش‌فاکتور', 'مشتری', ['name', 'code', 'amount'], "{name} عزیز، پیش‌فاکتور سفارش {code} به مبلغ {amount} تومان صادر شد.\nپرداخت و پیگیری از پنل کاربری {site}"],
        'order_paid' => ['پرداخت سفارش', 'مشتری', ['code'], "پرداخت سفارش {code} ثبت شد و کار طراحی آغاز شد.\nممنون از اعتماد شما — {site}"],
        'order_review' => ['آماده بررسی', 'مشتری', ['code'], "نسخه جدید سفارش {code} آماده بررسی است.\nلطفاً از پنل کاربری {site} نظرتان را ثبت کنید."],
        'order_due' => ['مانده پرداخت مرحله‌ای', 'مشتری', ['name', 'code', 'amount'], "{name} عزیز، کار سفارش {code} آماده تحویل است.\nمانده حساب {amount} تومان را از پنل {site} پرداخت کنید."],
        'order_done' => ['تحویل نهایی', 'مشتری', ['code'], "سفارش {code} تحویل شد و فایل‌های نهایی در پنل شما آماده دانلود است.\n{site}"],
        'shop_paid' => ['خرید از فروشگاه', 'مشتری', ['code'], "خرید شما در {site} ثبت شد (کد {code}).\nفایل‌ها در بخش دانلودهای پنل آماده است."],
        'cart_reminder' => ['یادآوری سبد خرید', 'مشتری', ['name', 'count'], "{name} عزیز، {count} فایل در سبد خرید {site} منتظر شماست.\nهمین حالا خریدتان را کامل کنید."],
        'ticket_reply' => ['پاسخ تیکت', 'مشتری', ['code'], "پاسخ تیکت شماره {code} در {site} ثبت شد.\nبرای مشاهده به پنل کاربری بروید."],
        'referral_reward' => ['هدیه معرفی دوست', 'کاربر معرف', ['amount'], "دوست شما اولین خریدش را در {site} انجام داد و {amount} تومان هدیه به کیف پول شما اضافه شد."],
        'designer_assigned' => ['واگذاری پروژه', 'طراح', ['code'], "پروژه جدید {code} به شما واگذار شد.\nجزئیات در پنل طراح {site}"],
        'revision_requested' => ['درخواست اصلاح', 'طراح', ['code'], "مشتری برای سفارش {code} درخواست اصلاح ثبت کرد.\n{site}"],
        'product_sold' => ['فروش محصول', 'فروشنده', ['amount'], "یک فروش جدید در فروشگاه شما ثبت شد؛ سهم شما {amount} تومان.\n{site}"],
        'payout_paid' => ['واریز تسویه', 'طراح / فروشنده', ['amount'], "مبلغ {amount} تومان به حساب شما واریز شد.\n{site}"],
        'admin_new_order' => ['سفارش جدید (برای مدیر)', 'مدیر', ['code', 'name'], "سفارش جدید {code} از {name} در {site} ثبت شد."],
        'delivery_booked' => ['ثبت/تغییر زمان تحویل', 'مشتری', ['code', 'date'], "زمان تحویل سفارش {code}: {date}\nتغییر زمان از پنل کاربری {site}"],
        'delivery_reminder' => ['یادآوری تحویل (روز قبل)', 'مشتری', ['name', 'date'], "{name} عزیز، یادآوری: زمان تحویل سفارش شما فردا {date} است.\n{site}"],
        'admin_support' => ['درخواست پشتیبانی (برای مدیر)', 'مدیر', ['name', 'phone'], "درخواست گفتگوی پشتیبانی از {name} با شماره {phone} در {site} ثبت شد."],
    ];
}

// Provider token for each variable of an event: Kavenegar allows spaces only in token10/token20.
function sms_tokens(array $vars): array
{
    $plain = ['token', 'token2', 'token3'];
    $spaced = ['token10', 'token20'];
    $map = [];
    foreach ($vars as $v) $map[$v] = SMS_VARS[$v][1] ? array_shift($spaced) : array_shift($plain);
    return $map;
}
// The ready text for the provider's panel
function sms_template_text(string $event, string $driver): string
{
    $d = sms_events_def()[$event];
    $site = (string) (setting('general', 'siteNameFa') ?: 'بهیکس');
    $text = str_replace('{site}', $site, $d[3]);
    $tokens = sms_tokens($d[2]);
    foreach ($d[2] as $v) $text = str_replace('{' . $v . '}', $driver === 'smsir' ? '#' . strtoupper($v) . '#' : '%' . $tokens[$v], $text);
    return $text;
}
function sms_admin_phone(): string
{
    return (string) (setting('sms', 'adminPhone') ?: setting('contact', 'phone') ?: '');
}

// Sends one event SMS; never throws. Returns true when the provider accepted it.
function sms_notify(string $event, string $phone, array $vars, bool $force = false): bool
{
    try {
        $defs = sms_events_def();
        $s = setting('sms');
        $cfg = (setting('sms_events') ?: [])[$event] ?? [];
        if (!isset($defs[$event]) || $s['driver'] === 'none' || empty($s['apiKey'])) return false;
        if ((!$force && empty($cfg['on'])) || empty($cfg['template'])) return false;
        $phone = preg_replace('/\D/', '', en_digits($phone));
        if (!preg_match('/^09\d{9}$/', $phone)) return false;
        $tokens = sms_tokens($defs[$event][2]);
        $ok = false;
        $resp = '';
        if ($s['driver'] === 'kavenegar') {
            $q = ['receptor' => $phone, 'template' => $cfg['template']];
            foreach ($defs[$event][2] as $v) {
                $val = trim((string) ($vars[$v] ?? '')) ?: '-';
                // token/token2/token3 cannot contain spaces
                $q[$tokens[$v]] = SMS_VARS[$v][1] ? $val : str_replace(' ', '‌', $val);
            }
            $r = http_json('GET', 'https://api.kavenegar.com/v1/' . rawurlencode($s['apiKey']) . '/verify/lookup.json?' . http_build_query($q));
            $ok = (int) ($r['return']['status'] ?? 0) === 200;
            $resp = (string) ($r['return']['message'] ?? $r['_error'] ?? '');
        } elseif ($s['driver'] === 'smsir') {
            $params = [];
            foreach ($defs[$event][2] as $v) $params[] = ['name' => strtoupper($v), 'value' => (string) ($vars[$v] ?? '-')];
            $r = http_json('POST', 'https://api.sms.ir/v1/send/verify', ['mobile' => $phone, 'templateId' => (int) $cfg['template'], 'parameters' => $params], ['X-API-KEY: ' . $s['apiKey']]);
            $ok = (int) ($r['status'] ?? 0) === 1;
            $resp = (string) ($r['message'] ?? $r['_error'] ?? '');
        }
        insert('sms_log', ['event' => $event, 'phone' => $phone, 'ok' => $ok ? 1 : 0, 'response' => mb_substr($resp, 0, 190), 'created_at' => now()]);
        return $ok;
    } catch (Throwable $e) {
        error_log('[BEHIX] sms: ' . $e->getMessage());
        return false;
    }
}
// Convenience: notify a user by id
function sms_user(string $event, int $userId, array $vars): void
{
    $u = row('SELECT name, phone FROM users WHERE id = ?', [$userId]);
    if ($u) sms_notify($event, (string) $u['phone'], $vars + ['name' => $u['name']]);
}
function sms_admin(string $event, array $vars): void
{
    $p = sms_admin_phone();
    if ($p) sms_notify($event, $p, $vars);
}
