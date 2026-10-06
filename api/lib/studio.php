<?php
// BEHIX — Studio: self-service products made entirely by the site (no outside
// AI service): resume, business card, social post/poster, document templates,
// PowerPoint, brand names, SEO audit, and hosted pages (digital card, QR menu).
// Builders run in the browser; the server stores designs, sells the final file
// and serves hosted pages at /c/<slug>.
if (!defined('BX')) { http_response_code(403); exit; }

const STUDIO_KINDS = ['resume' => 'رزومه', 'card' => 'کارت ویزیت', 'post' => 'پست و پوستر', 'doc' => 'سند و قرارداد', 'slides' => 'پاورپوینت'];
const PAGE_KINDS = ['card' => 'کارت ویزیت دیجیتال', 'menu' => 'منوی دیجیتال QR'];
const PAGE_RESERVED = ['admin', 'api', 'www', 'behix', 'login', 'dashboard', 'shop', 'blog', 'test', 'support'];

function studio_price(string $kind, ?array $item = null): int
{
    $s = setting('studio');
    if ($kind === 'doc' && $item) {
        $tid = (int) (jdec($item['data'], [])['templateId'] ?? 0);
        $p = $tid ? val('SELECT price FROM doc_templates WHERE id = ?', [$tid]) : null;
        if ($p !== null && $p !== false) return (int) $p;
    }
    return max(0, (int) ($s[$kind] ?? 0));
}
function studio_item_out(array $i, bool $withData = false): array
{
    $o = ['id' => (int) $i['id'], 'kind' => $i['kind'], 'kindTitle' => STUDIO_KINDS[$i['kind']] ?? $i['kind'], 'title' => $i['title'], 'paid' => (bool) $i['paid'],
        'price' => (int) $i['price'], 'paidAt' => ms($i['paid_at']), 'updatedAt' => ms($i['updated_at'])];
    if ($withData) $o['data'] = jdec($i['data'], []);
    return $o;
}
function page_out(array $p, bool $withData = false): array
{
    $o = ['id' => (int) $p['id'], 'kind' => $p['kind'], 'kindTitle' => PAGE_KINDS[$p['kind']] ?? $p['kind'], 'slug' => $p['slug'], 'title' => $p['title'],
        'views' => (int) $p['views'], 'expiresAt' => ms($p['expires_at']), 'active' => $p['expires_at'] && strtotime($p['expires_at'] . ' UTC') > time(),
        'url' => base_url() . '/c/' . $p['slug'], 'updatedAt' => ms($p['updated_at'])];
    if ($withData) $o['data'] = jdec($p['data'], []);
    return $o;
}

// ------------------------------------------------------------------ public
function studio_seed_docs(): void
{
    if ((int) val('SELECT COUNT(*) FROM doc_templates')) return;
    $docs = [
        ['قرارداد همکاری پروژه‌ای (فریلنسری)', 'قرارداد', 'برای سفارش طراحی، برنامه‌نویسی یا تولید محتوا بین کارفرما و مجری', <<<'HTML'
<h2 style="text-align:center">قرارداد همکاری پروژه‌ای</h2>
<p>این قرارداد در تاریخ {{تاریخ قرارداد}} بین <b>{{نام کارفرما}}</b> به کد ملی/شناسه {{کد ملی کارفرما}} به نشانی {{نشانی کارفرما}} که از این پس «کارفرما» نامیده می‌شود و <b>{{نام مجری}}</b> به کد ملی {{کد ملی مجری}} که از این پس «مجری» نامیده می‌شود، منعقد می‌گردد.</p>
<h3>ماده ۱ — موضوع قرارداد</h3><p>{{شرح کامل کار}}</p>
<h3>ماده ۲ — مدت قرارداد</h3><p>مدت انجام کار {{مدت انجام کار}} از تاریخ امضای قرارداد است.</p>
<h3>ماده ۳ — مبلغ و نحوه پرداخت</h3><p>مبلغ کل قرارداد {{مبلغ کل به تومان}} تومان است که {{نحوه پرداخت (مثلاً ۵۰٪ پیش‌پرداخت و ۵۰٪ هنگام تحویل)}} پرداخت می‌شود.</p>
<h3>ماده ۴ — اصلاحات و تحویل</h3><p>مجری متعهد است تا {{تعداد دفعات اصلاح}} مرحله اصلاح را بدون هزینه اضافه انجام دهد. تحویل نهایی پس از تأیید کتبی کارفرما انجام می‌شود.</p>
<h3>ماده ۵ — مالکیت و محرمانگی</h3><p>پس از تسویه کامل، حقوق مادی اثر به کارفرما منتقل می‌شود. طرفین متعهدند اطلاعات محرمانه یکدیگر را افشا نکنند.</p>
<h3>ماده ۶ — فسخ</h3><p>در صورت تأخیر بیش از {{مهلت تأخیر مجاز}} یا عدم پرداخت به‌موقع، طرف مقابل حق فسخ قرارداد را دارد و مبالغ به نسبت کار انجام‌شده تسویه می‌شود.</p>
<h3>ماده ۷ — حل اختلاف</h3><p>اختلافات ابتدا از طریق مذاکره و در صورت عدم توافق از طریق مراجع قانونی {{شهر}} حل‌وفصل می‌شود.</p>
<p>این قرارداد در ۷ ماده و دو نسخه با اعتبار یکسان تنظیم و امضا شد.</p>
<table style="width:100%;margin-top:40px"><tr><td style="text-align:center">امضای کارفرما</td><td style="text-align:center">امضای مجری</td></tr></table>
HTML],
        ['رسید دریافت وجه', 'مالی', 'رسید رسمی دریافت پول نقد، کارت‌به‌کارت یا چک', <<<'HTML'
<h2 style="text-align:center">رسید دریافت وجه</h2>
<p>اینجانب <b>{{نام دریافت‌کننده}}</b> به کد ملی {{کد ملی دریافت‌کننده}} اقرار می‌کنم مبلغ <b>{{مبلغ به تومان}}</b> تومان (به حروف: {{مبلغ به حروف}}) را از <b>{{نام پرداخت‌کننده}}</b> بابت {{بابت}} به‌صورت {{روش پرداخت (نقد/کارت‌به‌کارت/چک)}} در تاریخ {{تاریخ}} دریافت کردم.</p>
<p>شماره پیگیری / شماره چک: {{شماره پیگیری یا چک}}</p>
<p style="margin-top:50px;text-align:left">نام و امضای دریافت‌کننده</p>
HTML],
        ['نامه اداری رسمی', 'اداری', 'نامه رسمی به سازمان یا شرکت با سربرگ ساده', <<<'HTML'
<p style="text-align:left">تاریخ: {{تاریخ}}<br>شماره: {{شماره نامه}}</p>
<p>به: <b>{{گیرنده (نام سازمان یا شخص)}}</b><br>از: <b>{{فرستنده}}</b><br>موضوع: <b>{{موضوع نامه}}</b></p>
<p>با سلام و احترام،</p>
<p>{{متن نامه}}</p>
<p>پیشاپیش از حسن توجه جنابعالی سپاسگزارم.</p>
<p style="margin-top:40px;text-align:left">{{نام و سمت امضاکننده}}<br>امضا</p>
HTML],
        ['استعلام و پیش‌فاکتور ساده', 'مالی', 'پیش‌فاکتور سریع برای مشتری با شرح کار و مبلغ', <<<'HTML'
<h2 style="text-align:center">پیش‌فاکتور</h2>
<p>فروشنده: <b>{{نام فروشنده}}</b> — تلفن: {{تلفن فروشنده}}<br>خریدار: <b>{{نام خریدار}}</b> — تاریخ: {{تاریخ}}</p>
<table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><tr><th>شرح</th><th>تعداد</th><th>مبلغ (تومان)</th></tr>
<tr><td>{{شرح ردیف ۱}}</td><td>{{تعداد ۱}}</td><td>{{مبلغ ۱}}</td></tr>
<tr><td>{{شرح ردیف ۲}}</td><td>{{تعداد ۲}}</td><td>{{مبلغ ۲}}</td></tr>
<tr><td colspan="2"><b>جمع کل</b></td><td><b>{{جمع کل}}</b></td></tr></table>
<p>اعتبار این پیش‌فاکتور تا {{تاریخ اعتبار}} است. {{توضیحات}}</p>
HTML],
        ['درخواست مرخصی / استعفا', 'اداری', 'فرم رسمی درخواست مرخصی یا استعفا از محل کار', <<<'HTML'
<p style="text-align:left">تاریخ: {{تاریخ}}</p>
<p>مدیریت محترم {{نام شرکت یا سازمان}}</p>
<p>با سلام، احتراماً اینجانب <b>{{نام و نام خانوادگی}}</b> با سمت {{سمت}} در واحد {{واحد}}، {{متن درخواست (مثلاً: درخواست ۳ روز مرخصی از تاریخ … تا … را دارم / استعفای خود را از تاریخ … اعلام می‌کنم)}}.</p>
<p>دلیل: {{دلیل}}</p>
<p style="margin-top:40px;text-align:left">با تشکر<br>{{نام و نام خانوادگی}}<br>امضا</p>
HTML],
    ];
    foreach ($docs as $i => [$t, $c, $d, $b]) insert('doc_templates', ['title' => $t, 'category' => $c, 'descr' => $d, 'body' => $b, 'price' => null, 'active' => 1, 'sort' => $i, 'created_at' => now()]);
}
function r_studio_info(): void
{
    studio_seed_docs();
    $s = setting('studio');
    $docs = array_map(function ($d) use ($s) {
        return ['id' => (int) $d['id'], 'title' => $d['title'], 'category' => $d['category'], 'desc' => $d['descr'], 'body' => $d['body'], 'price' => $d['price'] !== null ? (int) $d['price'] : (int) $s['doc']];
    }, rows('SELECT * FROM doc_templates WHERE active = 1 ORDER BY sort, id'));
    out(['enabled' => !empty($s['enabled']), 'prices' => array_intersect_key($s, array_flip(['resume', 'card', 'post', 'doc', 'slides', 'pageCardMonth', 'pageCardYear', 'pageMenuMonth', 'pageMenuYear'])),
        'trialDays' => (int) $s['trialDays'], 'docs' => $docs]);
}

// ------------------------------------------------------------------ user: designs
function a_studio_save(): void
{
    $u = require_user();
    rate_limit('studio-save', 60, 600);
    $kind = str_in('kind', 20);
    if (!isset(STUDIO_KINDS[$kind])) fail('نوع طرح نامعتبر است.', 422);
    $data = in('data', []);
    if (!is_array($data)) fail('اطلاعات طرح نامعتبر است.', 422);
    $json = jenc($data);
    if (strlen($json) > 3 * 1024 * 1024) fail('حجم طرح زیاد است؛ تصاویر کوچک‌تری بگذارید.', 422);
    $title = str_in('title', 190) ?: STUDIO_KINDS[$kind];
    $id = int_in('id');
    if ($id) {
        $it = row('SELECT * FROM studio_items WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        if (!$it) fail('طرح پیدا نشد.', 404);
        update('studio_items', ['title' => $title, 'data' => $json, 'updated_at' => now()], 'id = ?', [$id]);
    } else {
        $id = insert('studio_items', ['user_id' => $u['id'], 'kind' => $kind, 'title' => $title, 'data' => $json, 'paid' => 0, 'price' => 0, 'created_at' => now(), 'updated_at' => now()]);
    }
    $it = row('SELECT * FROM studio_items WHERE id = ?', [$id]);
    out(['item' => studio_item_out($it), 'price' => $it['paid'] ? 0 : studio_price($kind, $it)]);
}
function a_studio_list(): void
{
    $u = require_user();
    out(['items' => array_map('studio_item_out', rows('SELECT * FROM studio_items WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200', [$u['id']])),
        'pages' => array_map('page_out', rows('SELECT * FROM pages WHERE user_id = ? ORDER BY id DESC', [$u['id']]))]);
}
function a_studio_get(): void
{
    $u = require_user();
    $it = row('SELECT * FROM studio_items WHERE id = ?', [int_in('id')]);
    if (!$it || ((int) $it['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin')) fail('طرح پیدا نشد.', 404);
    out(['item' => studio_item_out($it, true), 'price' => $it['paid'] ? 0 : studio_price($it['kind'], $it)]);
}
function a_studio_delete(): void
{
    $u = require_user();
    q('DELETE FROM studio_items WHERE id = ? AND user_id = ? AND paid = 0', [int_in('id'), $u['id']]);
    done('پیش‌نویس حذف شد.');
}
// Mark a design as bought: wallet first, otherwise the payment gateway
function studio_mark_paid(int $itemId, int $price): void
{
    update('studio_items', ['paid' => 1, 'price' => $price, 'paid_at' => now()], 'id = ?', [$itemId]);
}
function a_studio_buy(): void
{
    $u = require_user();
    $it = row('SELECT * FROM studio_items WHERE id = ? AND user_id = ?', [int_in('id'), $u['id']]);
    if (!$it) fail('ابتدا طرح را ذخیره کنید.', 404);
    if ($it['paid']) out(['done' => true]);
    $price = studio_price($it['kind'], $it);
    if ($price <= 0) { studio_mark_paid((int) $it['id'], 0); out(['done' => true]); }
    $wallet = (int) val('SELECT wallet FROM users WHERE id = ?', [$u['id']]);
    if ($wallet >= $price) {
        db()->beginTransaction();
        q('UPDATE users SET wallet = wallet - ? WHERE id = ?', [$price, $u['id']]);
        tx((int) $u['id'], 'purchase', -$price, 'استودیو: ' . (STUDIO_KINDS[$it['kind']] ?? '') . ' — ' . $it['title']);
        studio_mark_paid((int) $it['id'], $price);
        db()->commit();
        referral_check((int) $u['id']);
        out(['done' => true, 'paidFromWallet' => $price]);
    }
    $url = payment_start((int) $u['id'], 'studio', ['itemId' => (int) $it['id'], 'back' => str_in('back', 200)], $price - max(0, $wallet), 'استودیو بهیکس: ' . (STUDIO_KINDS[$it['kind']] ?? ''), str_in('method', 16));
    out(['redirect' => $url]);
}
// Called by payment_apply after the gateway confirms
function studio_apply_payment(int $uid, int $amount, array $ref): string
{
    wallet_add($uid, $amount);
    tx($uid, 'charge', $amount, 'پرداخت آنلاین');
    if (!empty($ref['itemId'])) {
        $it = row('SELECT * FROM studio_items WHERE id = ? AND user_id = ?', [(int) $ref['itemId'], $uid]);
        if ($it && !$it['paid']) {
            $price = studio_price($it['kind'], $it);
            q('UPDATE users SET wallet = wallet - ? WHERE id = ?', [$price, $uid]);
            tx($uid, 'purchase', -$price, 'استودیو: ' . (STUDIO_KINDS[$it['kind']] ?? '') . ' — ' . $it['title']);
            studio_mark_paid((int) $it['id'], $price);
        }
        return 'پرداخت انجام شد؛ فایل نهایی آماده دریافت است.';
    }
    if (!empty($ref['pageId'])) {
        page_extend((int) $ref['pageId'], $uid, (string) ($ref['plan'] ?? 'month'), true);
        return 'اشتراک صفحه شما فعال شد.';
    }
    return 'پرداخت انجام شد.';
}

// ------------------------------------------------------------------ user: hosted pages
function page_plan_price(string $kind, string $plan): int
{
    $s = setting('studio');
    $key = 'page' . ucfirst($kind) . ($plan === 'year' ? 'Year' : 'Month');
    return max(0, (int) ($s[$key] ?? 0));
}
function page_extend(int $pageId, int $uid, string $plan, bool $alreadyCharged): void
{
    $p = row('SELECT * FROM pages WHERE id = ? AND user_id = ?', [$pageId, $uid]);
    if (!$p) return;
    $price = page_plan_price($p['kind'], $plan);
    if ($alreadyCharged || $price > 0) {
        q('UPDATE users SET wallet = wallet - ? WHERE id = ?', [$price, $uid]);
        tx($uid, 'purchase', -$price, 'اشتراک ' . (PAGE_KINDS[$p['kind']] ?? 'صفحه') . ' (' . ($plan === 'year' ? 'سالانه' : 'ماهانه') . ') — ' . $p['slug']);
    }
    $base = $p['expires_at'] && strtotime($p['expires_at'] . ' UTC') > time() ? strtotime($p['expires_at'] . ' UTC') : time();
    update('pages', ['expires_at' => gmdate('Y-m-d H:i:s', $base + ($plan === 'year' ? 365 : 30) * 86400)], 'id = ?', [$pageId]);
}
function page_slug_ok(string $slug, int $exceptId = 0): string
{
    $slug = strtolower(trim($slug));
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/', $slug)) fail('آدرس صفحه فقط حروف انگلیسی کوچک، عدد و خط‌تیره (۳ تا ۴۰ حرف) باشد.', 422);
    if (in_array($slug, PAGE_RESERVED, true)) fail('این آدرس رزرو شده است؛ آدرس دیگری انتخاب کنید.', 422);
    if (val('SELECT id FROM pages WHERE slug = ? AND id <> ?', [$slug, $exceptId])) fail('این آدرس قبلاً گرفته شده است.', 409);
    return $slug;
}
function a_page_save(): void
{
    $u = require_user();
    rate_limit('page-save', 60, 600);
    $kind = str_in('kind', 12);
    if (!isset(PAGE_KINDS[$kind])) fail('نوع صفحه نامعتبر است.', 422);
    $data = in('data', []);
    if (!is_array($data)) fail('اطلاعات نامعتبر است.', 422);
    $json = jenc($data);
    if (strlen($json) > 400 * 1024) fail('اطلاعات صفحه بیش از حد مجاز است.', 422);
    $id = int_in('id');
    $title = str_in('title', 190);
    if ($id) {
        $p = row('SELECT * FROM pages WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        if (!$p) fail('صفحه پیدا نشد.', 404);
        $slug = page_slug_ok(str_in('slug', 60) ?: $p['slug'], $id);
        update('pages', ['slug' => $slug, 'title' => $title, 'data' => $json, 'updated_at' => now()], 'id = ?', [$id]);
    } else {
        $slug = page_slug_ok(str_in('slug', 60));
        $trial = max(0, (int) setting('studio', 'trialDays'));
        // one free trial per account and page type
        $hadTrial = (bool) val('SELECT COUNT(*) FROM pages WHERE user_id = ? AND kind = ?', [$u['id'], $kind]);
        $id = insert('pages', ['user_id' => $u['id'], 'kind' => $kind, 'slug' => $slug, 'title' => $title, 'data' => $json, 'views' => 0,
            'expires_at' => $trial && !$hadTrial ? gmdate('Y-m-d H:i:s', time() + $trial * 86400) : null, 'created_at' => now(), 'updated_at' => now()]);
        notify_admins('صفحه جدید در استودیو: ' . (PAGE_KINDS[$kind] ?? '') . ' /c/' . $slug, 'studio');
    }
    out(['page' => page_out(row('SELECT * FROM pages WHERE id = ?', [$id]))]);
}
function a_page_get(): void
{
    $u = require_user();
    $p = row('SELECT * FROM pages WHERE id = ?', [int_in('id')]);
    if (!$p || ((int) $p['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin')) fail('صفحه پیدا نشد.', 404);
    out(['page' => page_out($p, true), 'prices' => ['month' => page_plan_price($p['kind'], 'month'), 'year' => page_plan_price($p['kind'], 'year')]]);
}
function a_page_buy(): void
{
    $u = require_user();
    $p = row('SELECT * FROM pages WHERE id = ? AND user_id = ?', [int_in('id'), $u['id']]);
    if (!$p) fail('صفحه پیدا نشد.', 404);
    $plan = str_in('plan', 8) === 'year' ? 'year' : 'month';
    $price = page_plan_price($p['kind'], $plan);
    $wallet = (int) val('SELECT wallet FROM users WHERE id = ?', [$u['id']]);
    if ($wallet >= $price) {
        db()->beginTransaction();
        page_extend((int) $p['id'], (int) $u['id'], $plan, false);
        db()->commit();
        referral_check((int) $u['id']);
        out(['done' => true]);
    }
    out(['redirect' => payment_start((int) $u['id'], 'studio', ['pageId' => (int) $p['id'], 'plan' => $plan], $price - max(0, $wallet), 'اشتراک ' . (PAGE_KINDS[$p['kind']] ?? 'صفحه'), str_in('method', 16))]);
}
function a_page_delete(): void
{
    $u = require_user();
    $p = row('SELECT * FROM pages WHERE id = ?', [int_in('id')]);
    if (!$p || ((int) $p['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin')) fail('صفحه پیدا نشد.', 404);
    foreach (rows("SELECT id FROM files WHERE kind = 'page' AND ref_id = ?", [$p['id']]) as $f) delete_file_row((int) $f['id']);
    q('DELETE FROM pages WHERE id = ?', [$p['id']]);
    done('صفحه حذف شد.');
}
// Image for a hosted page (logo, avatar, menu item photo) → public URL
function a_page_image(): void
{
    $u = require_user();
    $f = uploaded_files('image')[0] ?? null;
    if (!$f || !preg_match('/\.(jpe?g|png|webp|gif)$/i', (string) $f['name'])) fail('یک تصویر JPG، PNG یا WebP انتخاب کنید.', 422);
    if ($f['size'] > 3 * 1024 * 1024) fail('حجم تصویر حداکثر ۳ مگابایت باشد.', 422);
    $r = store_upload($f, 'page', int_in('id') ?: null, (int) $u['id']);
    out(['id' => (string) $r['id'], 'url' => 'api/index.php?r=file&id=' . $r['id']]);
}

// ------------------------------------------------------------------ admin
function a_studio_admin(): void
{
    require_active('admin');
    $sold = rows('SELECT s.*, u.name uname, u.phone FROM studio_items s JOIN users u ON u.id = s.user_id WHERE s.paid = 1 ORDER BY s.paid_at DESC LIMIT 100');
    $byKind = [];
    foreach (rows('SELECT kind, COUNT(*) n, SUM(price) total FROM studio_items WHERE paid = 1 GROUP BY kind') as $r) $byKind[$r['kind']] = ['n' => (int) $r['n'], 'total' => (int) $r['total']];
    out(['sold' => array_map(function ($s) { return studio_item_out($s) + ['user' => $s['uname'], 'phone' => $s['phone']]; }, $sold), 'byKind' => $byKind,
        'drafts' => (int) val('SELECT COUNT(*) FROM studio_items WHERE paid = 0'),
        'pages' => array_map(function ($p) { return page_out($p) + ['user' => $p['uname']]; }, rows('SELECT p.*, u.name uname FROM pages p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 200')),
        'docs' => array_map(function ($d) { return ['id' => (int) $d['id'], 'title' => $d['title'], 'category' => $d['category'], 'desc' => $d['descr'], 'body' => $d['body'], 'price' => $d['price'] !== null ? (int) $d['price'] : null, 'active' => (bool) $d['active'], 'sort' => (int) $d['sort']]; }, rows('SELECT * FROM doc_templates ORDER BY sort, id')),
        'kinds' => STUDIO_KINDS]);
}
function a_doctpl_save(): void
{
    require_active('admin');
    $title = str_in('title', 190);
    if (mb_strlen($title) < 3) fail('عنوان قالب را بنویسید.', 422);
    require_once __DIR__ . '/seo.php';
    $body = seo_clean_html((string) in('body', ''));
    if (strpos($body, '{{') === false) fail('متن قالب باید حداقل یک فیلد مثل {{نام مشتری}} داشته باشد.', 422);
    $price = trim((string) in('price', ''));
    $data = ['title' => $title, 'category' => str_in('category', 80), 'descr' => str_in('desc', 300), 'body' => $body,
        'price' => $price === '' ? null : (int) en_digits($price), 'active' => in('active', true) ? 1 : 0, 'sort' => int_in('sort')];
    $id = int_in('id');
    if ($id) update('doc_templates', $data, 'id = ?', [$id]);
    else insert('doc_templates', $data + ['created_at' => now()]);
    done('قالب ذخیره شد.');
}
function a_doctpl_delete(): void
{
    require_active('admin');
    q('DELETE FROM doc_templates WHERE id = ?', [int_in('id')]);
    done('قالب حذف شد.');
}

// ------------------------------------------------------------------ SEO audit (free tool → lead for the SEO service)
function r_studio_seo(): void
{
    rate_limit('seo-audit', 8, 600);
    ip_limit('seo-audit', 15, 3600);
    $url = trim(str_in('url', 300));
    if (!preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
    // Only public addresses: each hop (incl. redirects) is resolved, checked and pinned
    $publicIp = function (string $u) {
        $host = parse_url($u, PHP_URL_HOST);
        if (!$host || !preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $host)) return null;
        $ip = gethostbyname($host);
        if ($ip === $host || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return null;
        return [$host, $ip];
    };
    if (!$publicIp($url)) fail('آدرس سایت معتبر نیست یا قابل بررسی نیست.', 422);
    $fetch = function (string $u, int $max = 2000000) use ($publicIp) {
        $t = microtime(true);
        for ($hop = 0; $hop < 4; $hop++) {
            $hi = $publicIp($u);
            if (!$hi || !preg_match('#^https?://#i', $u)) return ['body' => '', 'code' => 0, 'time' => 0, 'url' => $u, 'size' => 0];
            $ch = curl_init($u);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6,
                CURLOPT_RESOLVE => [$hi[0] . ':80:' . $hi[1], $hi[0] . ':443:' . $hi[1]],
                CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; BehixSEOCheck/1.0)', CURLOPT_ENCODING => '',
                CURLOPT_NOPROGRESS => false, CURLOPT_PROGRESSFUNCTION => function ($c, $dt, $d) use ($max) { return $d > $max ? 1 : 0; }]);
            $body = curl_exec($ch);
            $info = curl_getinfo($ch);
            curl_close($ch);
            $code = (int) $info['http_code'];
            if ($code >= 300 && $code < 400 && !empty($info['redirect_url'])) { $u = $info['redirect_url']; continue; }
            return ['body' => is_string($body) ? $body : '', 'code' => $code, 'time' => microtime(true) - $t, 'url' => $u, 'size' => (int) ($info['size_download'] ?? 0)];
        }
        return ['body' => '', 'code' => 0, 'time' => 0, 'url' => $u, 'size' => 0];
    };
    $r = $fetch($url);
    if (!$r['code']) fail('سایت در دسترس نبود یا پاسخ نداد.', 422);
    $h = $r['body'];
    $final = $r['url'];
    $base = parse_url($final, PHP_URL_SCHEME) . '://' . parse_url($final, PHP_URL_HOST);
    $get = function ($re) use ($h) { return preg_match($re, $h, $m) ? html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES, 'UTF-8') : ''; };
    $title = $get('#<title[^>]*>(.*?)</title>#is');
    $desc = $get('#<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)#i') ?: $get('#<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description#i');
    $h1 = preg_match_all('#<h1[\s>]#i', $h);
    $h2 = preg_match_all('#<h2[\s>]#i', $h);
    $imgs = preg_match_all('#<img\b[^>]*>#i', $h, $im);
    $noAlt = 0;
    foreach ($im[0] ?? [] as $tag) if (!preg_match('#\salt=["\'][^"\']+#i', $tag)) $noAlt++;
    $words = count(preg_split('/\s+/u', trim(strip_tags(preg_replace('#<(script|style)[^>]*>.*?</\1>#is', '', $h)))));
    $robots = $fetch($base . '/robots.txt', 200000);
    $sitemap = $fetch($base . '/sitemap.xml', 500000);
    $checks = [
        ['https', 'اتصال امن (HTTPS)', stripos($final, 'https://') === 0, 'گواهی SSL فعال کنید؛ گوگل سایت‌های HTTPS را ترجیح می‌دهد.'],
        ['status', 'پاسخ صفحه', $r['code'] === 200, 'صفحه اصلی باید کد ۲۰۰ برگرداند (کد فعلی: ' . $r['code'] . ').'],
        ['speed', 'سرعت پاسخ سرور', $r['time'] < 1.5, 'زمان پاسخ ' . fa_digits(number_format($r['time'], 1)) . ' ثانیه است؛ زیر ۱٫۵ ثانیه خوب است (کش، هاست بهتر، فشرده‌سازی).'],
        ['size', 'حجم صفحه', $r['size'] < 600000, 'حجم HTML ' . fa_digits((string) round($r['size'] / 1024)) . ' کیلوبایت است؛ کدهای اضافه را کم کنید.'],
        ['title', 'عنوان صفحه (title)', mb_strlen($title) >= 20 && mb_strlen($title) <= 65, $title ? 'طول عنوان ' . fa_digits((string) mb_strlen($title)) . ' کاراکتر است؛ ۳۰ تا ۶۰ کاراکتر با کلمه کلیدی اصلی بهترین است.' : 'صفحه عنوان ندارد!'],
        ['desc', 'توضیحات متا', mb_strlen($desc) >= 70 && mb_strlen($desc) <= 170, $desc ? 'طول توضیحات ' . fa_digits((string) mb_strlen($desc)) . ' کاراکتر است؛ ۱۲۰ تا ۱۶۰ ایده‌آل است.' : 'توضیحات متا ندارد؛ گوگل خودش متنی انتخاب می‌کند.'],
        ['h1', 'تیتر اصلی (H1)', $h1 === 1, $h1 ? 'صفحه ' . fa_digits((string) $h1) . ' تیتر H1 دارد؛ فقط یک H1 بگذارید.' : 'صفحه تیتر H1 ندارد.'],
        ['h2', 'زیرتیترها (H2)', $h2 >= 2, 'برای ساختار بهتر محتوا از چند تیتر H2 استفاده کنید.'],
        ['alt', 'متن جایگزین تصاویر', $imgs === 0 || $noAlt / max(1, $imgs) < 0.2, fa_digits((string) $noAlt) . ' تصویر از ' . fa_digits((string) $imgs) . ' بدون alt است.'],
        ['content', 'حجم محتوای متنی', $words > 300, 'حدود ' . fa_digits((string) $words) . ' کلمه متن دارد؛ صفحه اصلی بهتر است ۳۰۰+ کلمه متن مفید داشته باشد.'],
        ['viewport', 'سازگاری با موبایل', (bool) preg_match('#name=["\']viewport#i', $h), 'تگ viewport برای نمایش درست در موبایل لازم است.'],
        ['canonical', 'آدرس canonical', (bool) preg_match('#rel=["\']canonical#i', $h), 'لینک canonical از محتوای تکراری جلوگیری می‌کند.'],
        ['og', 'تصویر و عنوان اشتراک‌گذاری (Open Graph)', (bool) preg_match('#property=["\']og:title#i', $h) && (bool) preg_match('#property=["\']og:image#i', $h), 'برای نمایش زیبا در تلگرام و واتساپ og:title و og:image بگذارید.'],
        ['schema', 'داده ساختاریافته (Schema)', stripos($h, 'application/ld+json') !== false, 'با JSON-LD ستاره امتیاز، قیمت و سؤالات متداول در نتایج گوگل نمایش داده می‌شود.'],
        ['lang', 'زبان صفحه', (bool) preg_match('#<html[^>]+lang=#i', $h), 'ویژگی lang="fa" را در تگ html قرار دهید.'],
        ['robots', 'فایل robots.txt', $robots['code'] === 200 && $robots['body'] !== '', 'فایل robots.txt برای راهنمایی ربات‌های گوگل لازم است.'],
        ['sitemap', 'نقشه سایت (sitemap.xml)', $sitemap['code'] === 200 && (stripos($sitemap['body'], '<urlset') !== false || stripos($sitemap['body'], '<sitemapindex') !== false), 'نقشه سایت را بسازید و در سرچ کنسول ثبت کنید.'],
        ['noindex', 'اجازه ایندکس', !preg_match('#<meta[^>]+name=["\']robots["\'][^>]+noindex#i', $h), 'صفحه noindex است و در گوگل نمایش داده نمی‌شود!'],
    ];
    $pass = count(array_filter($checks, function ($c) { return $c[2]; }));
    $score = (int) round($pass / count($checks) * 100);
    out(['url' => $final, 'score' => $score, 'title' => $title, 'desc' => $desc, 'time' => round($r['time'], 2),
        'checks' => array_map(function ($c) { return ['id' => $c[0], 'label' => $c[1], 'ok' => (bool) $c[2], 'tip' => $c[3]]; }, $checks)]);
}
