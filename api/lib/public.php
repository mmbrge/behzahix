<?php
// BEHIX — public endpoints: boot data, lists, contact, ordering, auth, shop and files.
if (!defined('BX')) { http_response_code(403); exit; }

require_once __DIR__ . '/defaults.php';
require_once __DIR__ . '/gateways.php';

// ------------------------------------------------------------------ boot
function r_boot(): void
{
    $u = me();
    out([
        'csrf' => $_SESSION['csrf'],
        'me' => user_out($u, true),
        'impersonating' => !empty($_SESSION['impersonator']),
        'unread' => $u ? (int) val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [$u['id']]) : 0,
        'settings' => public_settings(),
        'catalog' => catalog(),
        'productCategories' => rows('SELECT id, title, icon FROM product_categories ORDER BY sort, title'),
        'demoAccounts' => setting('general', 'demoMode') ? array_values(array_map(function ($r) { return $r['role']; },
            rows("SELECT DISTINCT role FROM users WHERE is_demo = 1 AND status = 'active' AND role <> 'admin'"))) : [],
    ]);
}

function r_page(): void
{
    $slug = str_in('slug', 20);
    if (!in_array($slug, ['terms', 'privacy'], true)) fail('صفحه پیدا نشد.', 404);
    out(['html' => setting('legal', $slug, '')]);
}

// ------------------------------------------------------------------ lists
function r_portfolio_list(): void
{
    $works = array_map('work_out', rows('SELECT * FROM portfolio ORDER BY created_at DESC'));
    $designers = array_map(function ($u) { return user_out($u); }, rows("SELECT * FROM users WHERE role = 'designer'"));
    out(['works' => $works, 'designers' => $designers, 'liked' => array_keys($_SESSION['likes'] ?? [])]);
}

function r_portfolio_like(): void
{
    $id = int_in('id');
    if (!row('SELECT id FROM portfolio WHERE id = ?', [$id])) fail('پیدا نشد.', 404);
    $liked = !empty($_SESSION['likes'][$id]);
    if ($liked) unset($_SESSION['likes'][$id]);
    else $_SESSION['likes'][$id] = 1;
    q('UPDATE portfolio SET likes = GREATEST(0, likes + ?) WHERE id = ?', [$liked ? -1 : 1, $id]);
    out(['liked' => !$liked, 'likes' => (int) val('SELECT likes FROM portfolio WHERE id = ?', [$id])]);
}

function r_products_list(): void
{
    $products = array_map('product_out', rows("SELECT * FROM products WHERE status = 'active' ORDER BY created_at DESC"));
    $sellers = array_map(function ($u) { return user_out($u); }, rows("SELECT * FROM users WHERE role IN ('seller','admin')"));
    $u = me();
    $favs = $u ? array_map('strval', array_column(rows('SELECT product_id FROM favorites WHERE user_id = ?', [$u['id']]), 'product_id')) : [];
    $owned = $u ? array_map('strval', array_column(rows('SELECT product_id FROM purchases WHERE user_id = ?', [$u['id']]), 'product_id')) : [];
    out(['products' => $products, 'sellers' => $sellers, 'favorites' => $favs, 'owned' => $owned]);
}

function r_designers_list(): void
{
    $list = [];
    foreach (rows("SELECT * FROM users WHERE role = 'designer' AND status = 'active' ORDER BY rating DESC") as $u) {
        $o = user_out($u);
        $o['done'] = (int) val("SELECT COUNT(*) FROM orders WHERE designer_id = ? AND status = 'done'", [$u['id']]);
        $o['works'] = (int) val('SELECT COUNT(*) FROM portfolio WHERE designer_id = ?', [$u['id']]);
        $list[] = $o;
    }
    out(['designers' => $list]);
}

// ------------------------------------------------------------------ contact & newsletter
function r_contact_send(): void
{
    rate_limit('contact', 5, 3600);
    $name = str_in('name', 120);
    $phone = phone_in('phone');
    $subject = str_in('subject', 190) ?: 'پیام از فرم تماس';
    $message = str_in('message', 3000);
    if (mb_strlen($name) < 2 || mb_strlen($message) < 5) fail('نام و پیام را کامل وارد کنید.', 422);
    $u = me();
    insert('tickets', ['user_id' => $u['id'] ?? null, 'name' => $name, 'phone' => $phone, 'subject' => $subject, 'message' => $message, 'status' => 'open', 'created_at' => now()]);
    notify_admins("پیام جدید از $name: $subject", 'tickets');
    out(['ok' => true]);
}

function r_newsletter(): void
{
    rate_limit('newsletter', 3, 3600);
    $email = str_in('email', 190);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('ایمیل معتبر نیست.', 422);
    insert('leads', ['email' => $email, 'created_at' => now()]);
    out(['ok' => true]);
}

function r_coupon_check(): void
{
    rate_limit('coupon', 20, 600);
    $c = coupon_valid(str_in('code', 32));
    if (!$c || $c['owner_id'] !== null) out(['valid' => false]);
    out(['valid' => true, 'percent' => (int) $c['percent']]);
}

// ------------------------------------------------------------------ ordering
// Keeps only declared fields and coerces each value to its field type.
function clean_details(array $svc, array $raw): array
{
    $out = [];
    foreach ($svc['fields'] as $f) {
        $id = $f['id'];
        $v = $raw[$id] ?? null;
        $type = $f['type'] ?? 'text';
        if ($type === 'number') {
            $n = (int) en_digits((string) ($v ?? ($f['value'] ?? 0)));
            $out[$id] = max((int) ($f['min'] ?? 0), min((int) ($f['max'] ?? 1000000), $n));
        } elseif ($type === 'chips') {
            $allowed = array_map(function ($o) { return (string) $o['v']; }, $f['options'] ?? []);
            $out[$id] = array_values(array_intersect(array_map('strval', is_array($v) ? $v : []), $allowed));
        } elseif ($type === 'select' || $type === 'cards') {
            $allowed = array_map(function ($o) { return (string) $o['v']; }, $f['options'] ?? []);
            $out[$id] = in_array((string) $v, $allowed, true) ? (string) $v : ($type === 'select' ? ($allowed[0] ?? '') : '');
        } else {
            $out[$id] = mb_substr(is_scalar($v) ? trim((string) $v) : '', 0, $type === 'textarea' ? 3000 : 300);
        }
        $empty = $out[$id] === '' || $out[$id] === [] || $out[$id] === null;
        if (!empty($f['required']) && $empty) fail('«' . $f['label'] . '» را مشخص کنید.', 422);
    }
    return $out;
}

function next_order_code(): string
{
    $max = 1000;
    foreach (rows('SELECT code FROM orders') as $r) $max = max($max, (int) preg_replace('/\D/', '', $r['code']));
    return 'BX-' . ($max + 1);
}

function r_order_submit(): void
{
    rate_limit('order', 10, 3600);
    ip_limit('order', 25, 3600);
    $svc = find_service(str_in('serviceId', 40));
    if (!$svc || !$svc['active']) fail('خدمت انتخاب‌شده معتبر نیست.', 422);
    $details = clean_details($svc, arr_in('details'));
    $o = setting('orders');
    $deadline = str_in('deadline', 16);
    if (!in_array($deadline, array_column($o['deadlines'], 'v'), true)) $deadline = $o['deadlines'][0]['v'];
    $addons = array_values(array_intersect(array_map('strval', arr_in('addons')), array_column($o['addons'], 'v')));
    $contact = arr_in('contact');
    $name = mb_substr(trim((string) ($contact['name'] ?? '')), 0, 120);
    if (mb_strlen($name) < 3) fail('نام را کامل وارد کنید.', 422);

    $u = me();
    $created = null;
    if (!$u) {
        if (!setting('orders', 'guestOrders')) fail('برای ثبت سفارش ابتدا وارد شوید.', 401, 'auth');
        $phone = (function ($p) {
            $p = preg_replace('/\D/', '', en_digits((string) $p));
            if (strlen($p) === 10 && $p[0] === '9') $p = '0' . $p;
            if (!preg_match('/^09\d{9}$/', $p)) fail('شماره موبایل معتبر نیست.', 422);
            return $p;
        })($contact['phone'] ?? '');
        if (row('SELECT id FROM users WHERE phone = ?', [$phone])) fail('این شماره قبلاً ثبت‌نام کرده است؛ لطفاً ابتدا وارد شوید. بریف شما ذخیره شده است.', 409, 'exists');
        $temp = (string) random_int(100000, 999999);
        $uid = insert('users', ['name' => $name, 'phone' => $phone, 'email' => mb_substr((string) ($contact['email'] ?? ''), 0, 190) ?: null,
            'password_hash' => password_hash($temp, PASSWORD_DEFAULT), 'role' => 'customer', 'status' => 'active',
            'business' => mb_substr((string) ($contact['business'] ?? ''), 0, 190) ?: null, 'hue' => random_int(0, 359), 'created_at' => now()]);
        referral_attach($uid);
        login_as($uid);
        $u = me();
        $created = $temp;
    }

    $est = estimate($svc, $details, $deadline, $addons);
    $coupon = coupon_valid(str_in('coupon', 32));
    if ($coupon && $coupon['owner_id'] !== null) $coupon = null;
    $discount = $coupon ? (int) (round($est['total'] * (int) $coupon['percent'] / 100 / 100000) * 100000) : 0;
    $style = arr_in('style');
    $cleanStyle = [
        'styles' => array_values(array_intersect(array_map('strval', $style['styles'] ?? []), $o['styles'])),
        'colors' => array_values(array_filter(array_map('strval', array_slice($style['colors'] ?? [], 0, 5)), function ($c) { return (bool) preg_match('/^#[0-9a-fA-F]{6}$/', $c); })),
        'noColors' => !empty($style['noColors']),
        'refs' => mb_substr((string) ($style['refs'] ?? ''), 0, 2000),
        'hasBrand' => in_array($style['hasBrand'] ?? 'no', ['no', 'logo', 'full'], true) ? ($style['hasBrand'] ?? 'no') : 'no',
    ];
    $business = mb_substr(trim((string) ($contact['business'] ?? '')), 0, 120);
    // In-person delivery: the chosen date + time slot must still have room
    $dlv = !empty($svc['delivery']) && !empty(setting('delivery', 'enabled')) ? arr_in('delivery') : null;
    if ($dlv !== null && (empty($dlv['date']) || empty($dlv['slot']))) fail('زمان تحویل حضوری را از تقویم انتخاب کنید.', 422);
    db()->beginTransaction();
    $code = '';
    for ($i = 0; $i < 3; $i++) {
        $code = next_order_code();
        try {
            $oid = insert('orders', [
                'code' => $code, 'user_id' => $u['id'], 'service_id' => $svc['id'], 'title' => $svc['title'] . ($business ? " — $business" : ''),
                'status' => 'new', 'estimate' => $est['total'] - $discount, 'discount' => $discount, 'deadline' => $deadline, 'addons' => jenc($addons),
                'budget' => mb_substr(str_in('budget', 120), 0, 120), 'details' => jenc($details), 'descr' => str_in('desc', 5000), 'style' => jenc($cleanStyle),
                'contact' => jenc(['name' => $name, 'phone' => $u['phone'], 'email' => mb_substr((string) ($contact['email'] ?? ''), 0, 190), 'business' => $business,
                    'way' => in_array($contact['way'] ?? '', ['phone', 'telegram', 'whatsapp', 'panel'], true) ? $contact['way'] : 'phone']),
                'coupon' => $coupon ? $coupon['code'] : null, 'paid' => 0, 'applicants' => '[]', 'created_at' => now(),
            ]);
            break;
        } catch (PDOException $e) {
            if ($i === 2) throw $e;
        }
    }
    insert('order_events', ['order_id' => $oid, 'status' => 'new', 'created_at' => now()]);
    $booking = null;
    if ($dlv !== null) {
        $lead = !empty(setting('delivery', 'afterWork')) ? (int) $est['days'] : 0;
        $booking = dlv_book((int) $oid, (int) $u['id'], (string) $dlv['date'], (string) $dlv['slot'], $lead);
    }
    db()->commit();
    if ($booking) sms_notify('delivery_booked', (string) $u['phone'], ['code' => $code, 'date' => $booking['label']]);
    if ($coupon) q('UPDATE coupons SET uses = uses + 1 WHERE code = ?', [$coupon['code']]);
    notify_admins("سفارش جدید $code — {$svc['title']}", 'orders');
    notify((int) $u['id'], "سفارش $code ثبت شد و در صف بررسی است.", 'orders');
    sms_notify('order_new', (string) $u['phone'], ['name' => $name ?: $u['name'], 'code' => $code]);
    sms_admin('admin_new_order', ['code' => $code, 'name' => $name ?: $u['name']]);
    out(['id' => (string) $oid, 'code' => $code, 'estimate' => $est['total'] - $discount, 'delivery' => $booking['label'] ?? null, 'createdAccount' => $created !== null, 'tempPassword' => $created, 'phone' => $u['phone']]);
}

// ------------------------------------------------------------------ files
function store_upload(array $file, string $kind, ?int $refId, int $ownerId): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('آپلود فایل ناموفق بود (حجم یا خطای سرور).', 422);
    $maxMB = (int) setting('uploads', 'maxMB', 50);
    if ($file['size'] > $maxMB * 1024 * 1024) fail("حجم فایل بیشتر از $maxMB مگابایت است.", 422);
    $name = mb_substr(preg_replace('/[\\\\\/:*?"<>|]+/', '_', basename($file['name'])), 0, 180);
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $allowed = array_filter(array_map('trim', explode(',', strtolower(setting('uploads', 'ext', '')))));
    if (in_array($kind, ['portfolio', 'cover', 'gallery', 'blog', 'page'], true)) $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']; // public images only
    if (!$ext || !in_array($ext, $allowed, true)) fail("پسوند «.$ext» مجاز نیست.", 422);
    $dir = dirname(__DIR__, 2) . '/uploads/' . gmdate('Y/m');
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail('پوشه آپلود قابل ساخت نیست.', 500);
    $stored = gmdate('Y/m') . '/' . bin2hex(random_bytes(12)) . '.bin';
    if (!move_uploaded_file($file['tmp_name'], dirname(__DIR__, 2) . '/uploads/' . $stored)) fail('ذخیره فایل ناموفق بود.', 500);
    $mime = function_exists('mime_content_type') ? (mime_content_type(dirname(__DIR__, 2) . '/uploads/' . $stored) ?: null) : null;
    $id = insert('files', ['owner_id' => $ownerId, 'kind' => $kind, 'ref_id' => $refId, 'name' => $name, 'path' => $stored, 'size' => (int) $file['size'], 'mime' => $mime, 'created_at' => now()]);
    return row('SELECT * FROM files WHERE id = ?', [$id]);
}

// Normalises $_FILES['files'] (multiple) into a list
function uploaded_files(string $key = 'files'): array
{
    if (empty($_FILES[$key])) return [];
    $f = $_FILES[$key];
    if (!is_array($f['name'])) return [$f];
    $list = [];
    foreach ($f['name'] as $i => $n) $list[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    return $list;
}

function r_order_attach(): void
{
    $u = require_user();
    $o = row('SELECT * FROM orders WHERE id = ?', [int_in('id')]);
    if (!$o || ((int) $o['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin')) fail('دسترسی ندارید.', 403);
    $out = [];
    foreach (array_slice(uploaded_files(), 0, 20) as $f) $out[] = file_out(store_upload($f, 'attachment', (int) $o['id'], (int) $u['id']));
    out(['files' => $out]);
}

function can_access_file(array $f, ?array $u): bool
{
    if (in_array($f['kind'], ['portfolio', 'cover', 'gallery', 'blog', 'page'], true)) return true;
    if (!$u) return false;
    if ($u['role'] === 'admin' || (int) $f['owner_id'] === (int) $u['id']) return true;
    if (in_array($f['kind'], ['attachment', 'deliverable'], true)) {
        $o = row('SELECT user_id, designer_id FROM orders WHERE id = ?', [$f['ref_id']]);
        return $o && ((int) $o['user_id'] === (int) $u['id'] || (int) $o['designer_id'] === (int) $u['id']);
    }
    if ($f['kind'] === 'product') {
        return (bool) val('SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ?', [$u['id'], $f['ref_id']])
            || (bool) val('SELECT 1 FROM products WHERE id = ? AND seller_id = ?', [$f['ref_id'], $u['id']]);
    }
    return false;
}

function r_file(): void
{
    $f = row('SELECT * FROM files WHERE id = ?', [(int) ($_GET['id'] ?? 0)]);
    if (!$f || !can_access_file($f, me())) {
        http_response_code(404);
        exit('فایل پیدا نشد یا دسترسی ندارید.');
    }
    $path = dirname(__DIR__, 2) . '/uploads/' . $f['path'];
    if (!$f['path'] || !is_file($path)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        exit('این فایل نمونه است و محتوای واقعی ندارد.');
    }
    $isImage = in_array($f['kind'], ['portfolio', 'cover', 'gallery', 'blog', 'page'], true) && preg_match('/^image\/(png|jpe?g|webp|gif)$/', (string) $f['mime']);
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: ' . ($isImage ? $f['mime'] : 'application/octet-stream'));
    header('Content-Length: ' . filesize($path));
    header(($isImage ? 'Content-Disposition: inline' : 'Content-Disposition: attachment') . "; filename*=UTF-8''" . rawurlencode($f['name']));
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

// ------------------------------------------------------------------ auth
function r_auth_login(): void
{
    rate_limit('login', 8, 600);
    ip_limit('login', 30, 900);
    $phone = phone_in();
    $u = row('SELECT * FROM users WHERE phone = ?', [$phone]);
    if (!$u || !password_verify((string) in('password', ''), $u['password_hash'])) { login_failed($phone, 'رمز'); fail('شماره موبایل یا رمز عبور اشتباه است.', 422); }
    if ($u['status'] === 'blocked') fail('حساب کاربری شما مسدود شده است.', 403);
    if (admin_2fa_needed($u)) admin_2fa_start($u);
    login_as((int) $u['id']);
    login_succeeded($u);
    out(['me' => user_out(row('SELECT * FROM users WHERE id = ?', [$u['id']]), true)]);
}

function r_auth_otp_send(): void
{
    rate_limit('otp', 5, 3600);
    ip_limit('otp', 12, 3600);
    $phone = phone_in();
    $purpose = str_in('purpose', 16) === 'register' ? 'register' : 'login';
    $exists = (bool) row('SELECT id FROM users WHERE phone = ?', [$phone]);
    if ($purpose === 'login' && !$exists) fail('حسابی با این شماره پیدا نشد؛ ثبت‌نام کنید.', 404);
    if ($purpose === 'register' && $exists) fail('این شماره قبلاً ثبت‌نام کرده است؛ وارد شوید.', 409);
    $last = row('SELECT sent_at FROM otps WHERE phone = ?', [$phone]);
    if ($last && strtotime($last['sent_at'] . ' UTC') > time() - 60) fail('کد قبلی هنوز معتبر است؛ یک دقیقه صبر کنید.', 429);
    $code = (string) random_int(10000, 99999);
    q('REPLACE INTO otps (phone, code_hash, purpose, attempts, expires_at, sent_at) VALUES (?,?,?,0,?,?)',
        [$phone, password_hash($code, PASSWORD_DEFAULT), $purpose, gmdate('Y-m-d H:i:s', time() + 300), now()]);
    if (sms_enabled()) {
        if (!sms_send_code($phone, $code)) fail('ارسال پیامک ناموفق بود؛ دوباره تلاش کنید.', 502);
        out(['sent' => true]);
    }
    // Without an SMS provider the code is only shown while demo mode is on.
    if (setting('general', 'demoMode')) out(['sent' => true, 'demoCode' => $code]);
    fail('ارسال پیامک فعال نیست؛ با رمز عبور وارد شوید.', 503);
}

function otp_verify(string $phone, string $purpose): void
{
    $o = row('SELECT * FROM otps WHERE phone = ?', [$phone]);
    $code = preg_replace('/\D/', '', en_digits(str_in('code', 10)));
    if (!$o || $o['purpose'] !== $purpose || strtotime($o['expires_at'] . ' UTC') < time()) fail('کد منقضی شده است؛ دوباره درخواست کنید.', 422);
    if ((int) $o['attempts'] >= 5) fail('تعداد تلاش‌ها زیاد است؛ کد جدید بگیرید.', 429);
    if (!password_verify($code, $o['code_hash'])) {
        q('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?', [$phone]);
        login_failed($phone, 'کد پیامکی');
        fail('کد تأیید اشتباه است.', 422);
    }
    q('DELETE FROM otps WHERE phone = ?', [$phone]);
}

function r_auth_otp_login(): void
{
    $phone = phone_in();
    otp_verify($phone, 'login');
    $u = row('SELECT * FROM users WHERE phone = ?', [$phone]);
    if (!$u || $u['status'] === 'blocked') fail('حساب کاربری فعال نیست.', 403);
    if (admin_2fa_needed($u)) admin_2fa_start($u);
    login_as((int) $u['id']);
    login_succeeded($u);
    out(['me' => user_out($u, true)]);
}

function r_auth_register(): void
{
    rate_limit('register', 5, 3600);
    ip_limit('register', 10, 3600);
    $role = str_in('role', 16);
    if (!in_array($role, ['customer', 'designer', 'seller'], true)) $role = 'customer';
    $name = str_in('name', 120);
    $phone = phone_in();
    $pass = (string) in('password', '');
    if (mb_strlen($name) < 3) fail('نام را کامل وارد کنید.', 422);
    if (strlen($pass) < 6) fail('رمز عبور باید حداقل ۶ کاراکتر باشد.', 422);
    if (row('SELECT id FROM users WHERE phone = ?', [$phone])) fail('این شماره قبلاً ثبت‌نام کرده است؛ وارد شوید.', 409);
    if (sms_enabled() || in('code') !== null) otp_verify($phone, 'register');
    $data = ['name' => $name, 'phone' => $phone, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'role' => $role,
        'status' => $role === 'customer' ? 'active' : 'pending', 'hue' => random_int(0, 359), 'created_at' => now()];
    if ($role === 'designer') {
        $cats = array_map('strval', arr_in('skills'));
        if (!$cats) fail('حداقل یک تخصص انتخاب کنید.', 422);
        $ph = implode(',', array_fill(0, count($cats), '?'));
        $data['skills'] = jenc(array_column(rows("SELECT id FROM services WHERE category_id IN ($ph)", $cats), 'id'));
        $data['portfolio_url'] = mb_substr(str_in('portfolio', 255), 0, 255) ?: null;
        $data['bio'] = 'سابقه: ' . str_in('exp', 40);
        $data['level'] = 'تازه‌وارد';
    }
    if ($role === 'seller') {
        $shop = str_in('shop', 190);
        if (mb_strlen($shop) < 2) fail('نام فروشگاه را وارد کنید.', 422);
        $data['shop_name'] = $shop;
        $data['cats'] = jenc(array_values(array_map('strval', arr_in('cats'))));
    }
    $id = insert('users', $data);
    referral_attach($id);
    if ($role !== 'customer') notify_admins('درخواست ' . ($role === 'designer' ? 'طراح' : 'فروشنده') . " جدید: $name", $role === 'designer' ? 'designers' : 'sellers');
    notify($id, 'به بهیکس خوش آمدید! 🎉', 'overview');
    login_as($id);
    out(['me' => user_out(row('SELECT * FROM users WHERE id = ?', [$id]), true)]);
}

function r_auth_logout(): void
{
    $_SESSION = ['csrf' => bin2hex(random_bytes(16))];
    session_regenerate_id(true);
    out(['ok' => true]);
}

function r_auth_demo(): void
{
    if (!setting('general', 'demoMode')) fail('حالت نمایشی غیرفعال است.', 403);
    $role = str_in('role', 16);
    if (!in_array($role, ['customer', 'designer', 'seller'], true)) fail('نقش نامعتبر.', 422);
    $u = row("SELECT * FROM users WHERE is_demo = 1 AND role = ? AND status = 'active' ORDER BY id LIMIT 1", [$role]);
    if (!$u) fail('حساب نمایشی پیدا نشد.', 404);
    login_as((int) $u['id']);
    out(['me' => user_out($u, true)]);
}

// ------------------------------------------------------------------ shop
function r_fav_toggle(): void
{
    $u = require_user();
    $pid = int_in('productId');
    if (!row('SELECT id FROM products WHERE id = ?', [$pid])) fail('محصول پیدا نشد.', 404);
    if (val('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?', [$u['id'], $pid])) {
        q('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [$u['id'], $pid]);
        out(['on' => false]);
    }
    q('INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)', [$u['id'], $pid]);
    out(['on' => true]);
}

function cart_products(int $uid, array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) return [];
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $list = rows("SELECT * FROM products WHERE status = 'active' AND id IN ($ph)", $ids);
    // skip items already bought
    return array_values(array_filter($list, function ($p) use ($uid) { return !val('SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ?', [$uid, $p['id']]); }));
}

// Price of a product after an optional coupon (global, or the product seller's own).
function item_price(array $p, ?array $coupon): int
{
    $price = final_price($p);
    if ($coupon && ($coupon['owner_id'] === null || (int) $coupon['owner_id'] === (int) $p['seller_id'])) {
        $price = (int) (round($price * (100 - (int) $coupon['percent']) / 100 / 1000) * 1000);
    }
    return max(0, $price);
}
function shop_coupon(string $code): ?array
{
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    $c = row('SELECT * FROM coupons WHERE code = ? AND active = 1', [$code]);
    if (!$c || ((int) $c['max_uses'] > 0 && (int) $c['uses'] >= (int) $c['max_uses'])) return null;
    return $c;
}

// Charges the wallet and records the purchases (wallet must already hold the total).
function r_cart_sync(): void
{
    $u = me();
    if (!$u) out(['ok' => false]);
    rate_limit('cart', 60, 600);
    $ids = array_values(array_unique(array_filter(array_map('intval', arr_in('items')))));
    $ids = array_slice($ids, 0, 50);
    $prev = jdec((string) val('SELECT cart FROM users WHERE id = ?', [$u['id']]), []);
    if ($ids !== $prev) update('users', ['cart' => $ids ? jenc($ids) : null, 'cart_at' => now(), 'cart_reminded' => 0], 'id = ?', [$u['id']]);
    out(['ok' => true]);
}

// Lightweight scheduler: runs at most every 10 minutes on normal traffic
// (a cPanel cron calling api/index.php?r=cron also works).
function lazy_cron(bool $force = false): void
{
    $last = (int) val("SELECT v FROM settings WHERE k = 'cron_last'");
    if (!$force && time() - $last < 600) return;
    q("INSERT INTO settings (k, v) VALUES ('cron_last', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [(string) time()]);
    $c = setting('cart');
    if (!empty($c['reminder'])) {
        $before = date('Y-m-d H:i:s', time() - max(1, (int) $c['hours']) * 3600);
        foreach (rows('SELECT id, name, phone, cart FROM users WHERE cart IS NOT NULL AND cart_reminded = 0 AND cart_at < ? LIMIT 20', [$before]) as $u) {
            $ids = array_map('intval', jdec($u['cart'], []));
            $left = $ids ? (int) val('SELECT COUNT(*) FROM products WHERE status = \'active\' AND id IN (' . implode(',', $ids) . ') AND id NOT IN (SELECT product_id FROM purchases WHERE user_id = ?)', [$u['id']]) : 0;
            q('UPDATE users SET cart_reminded = 1 WHERE id = ?', [$u['id']]);
            if ($left < 1) continue;
            notify((int) $u['id'], fa_digits((string) $left) . ' فایل در سبد خرید شما منتظر است.', 'shop');
            sms_notify('cart_reminder', (string) $u['phone'], ['name' => $u['name'], 'count' => (string) $left]);
        }
    }
    if (function_exists('dlv_reminders')) dlv_reminders();
}

function shop_complete(int $uid, array $ids, string $couponCode = ''): array
{
    $items = cart_products($uid, $ids);
    $coupon = shop_coupon($couponCode);
    $total = array_sum(array_map(function ($p) use ($coupon) { return item_price($p, $coupon); }, $items));
    $wallet = (int) val('SELECT wallet FROM users WHERE id = ?', [$uid]);
    if ($total > $wallet) fail('موجودی کیف پول کافی نیست.', 422);
    foreach ($items as $p) {
        $price = item_price($p, $coupon);
        wallet_add($uid, -$price);
        insert('purchases', ['user_id' => $uid, 'product_id' => $p['id'], 'price' => $price, 'created_at' => now()]);
        tx($uid, 'purchase', -$price, 'خرید ' . $p['title']);
        $seller = row('SELECT * FROM users WHERE id = ?', [$p['seller_id']]);
        if ($seller && $seller['role'] !== 'admin') {
            $earn = (int) round($price * (1 - commission_for($seller) / 100));
            wallet_add((int) $seller['id'], $earn);
            tx((int) $seller['id'], 'sale', $earn, 'فروش ' . $p['title']);
            notify((int) $seller['id'], '«' . $p['title'] . '» فروخته شد (+' . toman($earn) . ')', 'sales');
            sms_user('product_sold', (int) $seller['id'], ['amount' => number_format($earn)]);
        }
        q('UPDATE products SET sales = sales + 1 WHERE id = ?', [$p['id']]);
    }
    if ($items && $coupon) q('UPDATE coupons SET uses = uses + 1 WHERE code = ?', [$coupon['code']]);
    if ($items) {
        notify($uid, fa_digits(count($items)) . ' فایل خریداری شد و در بخش دانلودها آماده است.', 'downloads');
        sms_user('shop_paid', $uid, ['code' => 'S' . (int) val('SELECT MAX(id) FROM purchases WHERE user_id = ?', [$uid])]);
        q('UPDATE users SET cart = NULL, cart_reminded = 0 WHERE id = ?', [$uid]);
        referral_check($uid);
    }
    return ['count' => count($items), 'total' => $total];
}

function r_shop_quote(): void
{
    $u = me();
    $items = $u ? cart_products((int) $u['id'], arr_in('items')) : cart_products(0, arr_in('items'));
    $coupon = shop_coupon(str_in('coupon', 32));
    $before = array_sum(array_map('final_price', $items));
    $after = array_sum(array_map(function ($p) use ($coupon) { return item_price($p, $coupon); }, $items));
    out(['total' => $after, 'discount' => $before - $after, 'coupon' => $coupon && $after < $before ? (int) $coupon['percent'] : 0]);
}

function r_shop_checkout(): void
{
    $u = require_user();
    $ids = arr_in('items');
    $code = str_in('coupon', 32);
    $items = cart_products((int) $u['id'], $ids);
    if (!$items) fail('سبد خرید خالی است یا قبلاً این فایل‌ها را خریده‌اید.', 422);
    $coupon = shop_coupon($code);
    $total = array_sum(array_map(function ($p) use ($coupon) { return item_price($p, $coupon); }, $items));
    $wallet = (int) $u['wallet'];
    if ($wallet >= $total) {
        db()->beginTransaction();
        $r = shop_complete((int) $u['id'], $ids, $code);
        db()->commit();
        out(['done' => true, 'paidFromWallet' => $r['total']]);
    }
    $url = payment_start((int) $u['id'], 'cart', ['items' => array_map(function ($p) { return (int) $p['id']; }, $items), 'coupon' => $code], $total - max(0, $wallet), 'خرید از فروشگاه', str_in('method', 16));
    out(['redirect' => $url]);
}

// ------------------------------------------------------------------ product reviews (buyers only)
function review_out(array $r, bool $admin = false): array
{
    $name = trim((string) ($r['uname'] ?? ''));
    $parts = preg_split('/\s+/u', $name);
    $o = ['id' => (int) $r['id'], 'rating' => (int) $r['rating'], 'text' => $r['body'], 'reply' => $r['reply'], 'at' => ms($r['created_at']),
        'name' => $admin ? $name : (($parts[0] ?? '') ?: 'خریدار') . (count($parts) > 1 ? ' ' . mb_substr(end($parts), 0, 1) . '.' : '')];
    if ($admin) $o += ['hidden' => (bool) $r['hidden'], 'productId' => (int) $r['product_id'], 'product' => $r['ptitle'] ?? '', 'userId' => (int) $r['user_id']];
    return $o;
}
function product_rating_refresh(int $pid): void
{
    $s = row('SELECT COUNT(*) n, AVG(rating) a FROM product_reviews WHERE product_id = ? AND hidden = 0', [$pid]);
    update('products', ['rating' => round((float) $s['a'], 2), 'reviews' => (int) $s['n']], 'id = ?', [$pid]);
}
function r_product_reviews(): void
{
    $pid = int_in('id');
    $list = rows('SELECT r.*, u.name uname FROM product_reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.hidden = 0 ORDER BY r.id DESC LIMIT 50', [$pid]);
    $dist = array_fill(1, 5, 0);
    foreach (rows('SELECT rating, COUNT(*) n FROM product_reviews WHERE product_id = ? AND hidden = 0 GROUP BY rating', [$pid]) as $d) $dist[(int) $d['rating']] = (int) $d['n'];
    $u = me();
    $mine = $u ? row('SELECT * FROM product_reviews WHERE product_id = ? AND user_id = ?', [$pid, $u['id']]) : null;
    $bought = $u && val('SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ?', [$u['id'], $pid]);
    out(['reviews' => array_map('review_out', $list), 'dist' => $dist, 'canReview' => (bool) $bought,
        'mine' => $mine ? ['rating' => (int) $mine['rating'], 'text' => $mine['body']] : null]);
}
function r_product_review(): void
{
    $u = require_user();
    rate_limit('review', 10, 3600);
    $pid = int_in('id');
    if (!val('SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ?', [$u['id'], $pid])) fail('فقط خریداران این محصول می‌توانند نظر ثبت کنند.', 403);
    $rating = max(1, min(5, int_in('rating')));
    $text = str_in('text', 1500);
    if (mb_strlen($text) < 3) fail('چند کلمه درباره محصول بنویسید.', 422);
    $old = row('SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?', [$pid, $u['id']]);
    if ($old) update('product_reviews', ['rating' => $rating, 'body' => $text], 'id = ?', [$old['id']]);
    else insert('product_reviews', ['product_id' => $pid, 'user_id' => $u['id'], 'rating' => $rating, 'body' => $text, 'created_at' => now()]);
    product_rating_refresh($pid);
    $p = row('SELECT title, seller_id FROM products WHERE id = ?', [$pid]);
    if ($p) {
        notify((int) $p['seller_id'], '⭐ نظر جدید (' . fa_digits((string) $rating) . ' ستاره) برای «' . $p['title'] . '»', 'products');
        if (!$old) notify_admins('⭐ نظر جدید برای «' . $p['title'] . '»', 'catalog/reviews');
    }
    out(['ok' => true, 'message' => 'نظر شما ثبت شد؛ ممنون!']);
}
