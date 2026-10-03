<?php
// BEHIX — dashboard: role-scoped snapshot + every panel action.
// Each action checks the caller's role and ownership before changing data.
if (!defined('BX')) { http_response_code(403); exit; }

require_once __DIR__ . '/defaults.php';
require_once __DIR__ . '/gateways.php';
require_once __DIR__ . '/public.php';

// ------------------------------------------------------------------ snapshot
function r_dash(): void
{
    $u = require_user();
    $id = (int) $u['id'];
    $role = $u['role'];
    $active = $u['status'] === 'active';
    $snap = [
        'me' => user_out($u, true),
        'impersonating' => !empty($_SESSION['impersonator']),
        'users' => [], 'orders' => [], 'products' => [], 'portfolio' => [], 'transactions' => [], 'purchases' => [],
        'payouts' => [], 'coupons' => [], 'favorites' => [], 'leads' => 0,
        'notifications' => array_map(function ($n) {
            return ['id' => (string) $n['id'], 'text' => $n['text'], 'link' => $n['link'], 'read' => (bool) $n['is_read'], 'at' => ms($n['created_at'])];
        }, rows('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60', [$id])),
        'tickets' => tickets_out($role === 'admin' ? rows('SELECT * FROM tickets ORDER BY id DESC LIMIT 300') : rows('SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC', [$id])),
        'settings' => $role === 'admin' ? settings() : public_settings(),
    ];
    $snap['notifications'] = array_map(function ($n) use ($id) { $n['userId'] = (string) $id; return $n; }, $snap['notifications']);
    $userIds = [$id];
    $txOf = function ($uid) { return array_map('tx_out', rows('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200', [$uid])); };

    if ($role === 'customer') {
        foreach (rows('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [$id]) as $o) {
            $snap['orders'][] = order_out($o);
            if ($o['designer_id']) $userIds[] = (int) $o['designer_id'];
        }
        $snap['purchases'] = array_map('purchase_out', rows('SELECT * FROM purchases WHERE user_id = ? ORDER BY id DESC', [$id]));
        $favs = array_map('intval', array_column(rows('SELECT product_id FROM favorites WHERE user_id = ?', [$id]), 'product_id'));
        $snap['favorites'] = [(string) $id => array_map('strval', $favs)];
        $pids = array_unique(array_merge($favs, array_map(function ($p) { return (int) $p['productId']; }, $snap['purchases'])));
        if ($pids) $snap['products'] = array_map(function ($p) { return product_out($p, true); }, rows('SELECT * FROM products WHERE id IN (' . implode(',', $pids) . ')'));
        $snap['transactions'] = $txOf($id);
    } elseif ($role === 'designer' && $active) {
        foreach (rows('SELECT * FROM orders WHERE designer_id = ? ORDER BY id DESC', [$id]) as $o) {
            $snap['orders'][] = order_out($o, true, false);
            $userIds[] = (int) $o['user_id'];
        }
        $skills = jdec($u['skills'], []);
        if ($skills) {
            $ph = implode(',', array_fill(0, count($skills), '?'));
            foreach (rows("SELECT * FROM orders WHERE designer_id IS NULL AND status IN ('new','review') AND service_id IN ($ph) ORDER BY id DESC", $skills) as $o) {
                $snap['orders'][] = order_out($o, false, false);
            }
        }
        $snap['portfolio'] = array_map('work_out', rows('SELECT * FROM portfolio WHERE designer_id = ? ORDER BY id DESC', [$id]));
        $snap['transactions'] = $txOf($id);
        $snap['payouts'] = array_map('payout_out', rows('SELECT * FROM payouts WHERE user_id = ? ORDER BY id DESC', [$id]));
    } elseif ($role === 'seller' && $active) {
        $snap['products'] = array_map(function ($p) { return product_out($p, true); }, rows('SELECT * FROM products WHERE seller_id = ? ORDER BY id DESC', [$id]));
        $snap['transactions'] = $txOf($id);
        $snap['payouts'] = array_map('payout_out', rows('SELECT * FROM payouts WHERE user_id = ? ORDER BY id DESC', [$id]));
        $snap['coupons'] = array_map('coupon_out', rows('SELECT * FROM coupons WHERE owner_id = ?', [$id]));
    } elseif ($role === 'admin') {
        $snap['users'] = array_map(function ($x) { return user_out($x, true); }, rows('SELECT * FROM users ORDER BY id DESC'));
        $snap['orders'] = array_map('order_out', rows('SELECT * FROM orders ORDER BY id DESC LIMIT 500'));
        $snap['products'] = array_map(function ($p) { return product_out($p, true); }, rows('SELECT * FROM products ORDER BY id DESC'));
        $snap['portfolio'] = array_map('work_out', rows('SELECT * FROM portfolio ORDER BY id DESC'));
        $snap['transactions'] = array_map('tx_out', rows('SELECT * FROM transactions ORDER BY id DESC LIMIT 400'));
        $snap['purchases'] = array_map('purchase_out', rows('SELECT * FROM purchases ORDER BY id DESC LIMIT 400'));
        $snap['payouts'] = array_map('payout_out', rows('SELECT * FROM payouts ORDER BY id DESC'));
        $snap['coupons'] = array_map('coupon_out', rows('SELECT * FROM coupons'));
        $snap['catalogAll'] = catalog(false);
        $snap['productCategories'] = rows('SELECT * FROM product_categories ORDER BY sort, title');
        $snap['leads'] = (int) val('SELECT COUNT(*) FROM leads');
        $snap['demoUsers'] = (int) val('SELECT COUNT(*) FROM users WHERE is_demo = 1');
        out($snap);
    }
    // Non-admins only receive the people they work with (name & avatar colour)
    $userIds = array_unique(array_filter($userIds));
    foreach ($userIds as $uid) {
        $x = row('SELECT * FROM users WHERE id = ?', [$uid]);
        if ($x) $snap['users'][] = $uid === $id ? user_out($x, true) : user_out($x);
    }
    out($snap);
}

function tickets_out(array $list): array
{
    return array_map(function ($t) {
        return ['id' => (string) $t['id'], 'userId' => $t['user_id'] ? (string) $t['user_id'] : null, 'name' => $t['name'], 'phone' => $t['phone'],
            'subject' => $t['subject'], 'message' => $t['message'], 'status' => $t['status'], 'at' => ms($t['created_at']),
            'replies' => array_map(function ($r) { return ['from' => (string) $r['user_id'], 'name' => $r['name'], 'text' => $r['body'], 'at' => ms($r['created_at'])]; },
                rows('SELECT r.*, u.name FROM ticket_replies r LEFT JOIN users u ON u.id = r.user_id WHERE ticket_id = ? ORDER BY r.id', [$t['id']]))];
    }, $list);
}
function tx_out(array $t): array
{
    return ['id' => (string) $t['id'], 'userId' => (string) $t['user_id'], 'type' => $t['type'], 'amount' => (int) $t['amount'], 'note' => $t['note'], 'status' => $t['status'], 'at' => ms($t['created_at'])];
}
function purchase_out(array $p): array
{
    return ['id' => (string) $p['id'], 'userId' => (string) $p['user_id'], 'productId' => (string) $p['product_id'], 'price' => (int) $p['price'], 'at' => ms($p['created_at'])];
}
function payout_out(array $p): array
{
    return ['id' => (string) $p['id'], 'userId' => (string) $p['user_id'], 'amount' => (int) $p['amount'], 'card' => $p['card'], 'status' => $p['status'], 'at' => ms($p['created_at'])];
}
function coupon_out(array $c): array
{
    return ['code' => $c['code'], 'percent' => (int) $c['percent'], 'uses' => (int) $c['uses'], 'limit' => (int) $c['max_uses'], 'active' => (bool) $c['active'], 'ownerId' => $c['owner_id'] ? (string) $c['owner_id'] : null];
}

// ------------------------------------------------------------------ helpers
function done(string $msg = '', array $extra = []): void
{
    out(array_merge(['ok' => true, 'message' => $msg], $extra));
}
function get_order(int $id): array
{
    $o = row('SELECT * FROM orders WHERE id = ?', [$id]);
    if (!$o) fail('سفارش پیدا نشد.', 404);
    return $o;
}
function is_participant(array $o, array $u): bool
{
    return $u['role'] === 'admin' || (int) $o['user_id'] === (int) $u['id'] || (int) $o['designer_id'] === (int) $u['id'];
}
function price_of(array $o): int
{
    return $o['quote'] !== null ? (int) $o['quote'] : (int) $o['estimate'];
}
function notify_order(array $o, string $text, int $exceptId): void
{
    $targets = array_unique(array_filter([(int) $o['user_id'], (int) $o['designer_id']]));
    foreach ($targets as $t) {
        if ($t === $exceptId) continue;
        notify($t, $text, (int) $t === (int) $o['designer_id'] ? 'projects' : 'orders');
    }
    foreach (rows("SELECT id FROM users WHERE role = 'admin'") as $a) if ((int) $a['id'] !== $exceptId) notify((int) $a['id'], $text, 'orders');
}

function order_pay_from_wallet(array $o, int $uid): void
{
    $amount = price_of($o);
    $wallet = (int) val('SELECT wallet FROM users WHERE id = ?', [$uid]);
    if ($wallet < $amount) fail('موجودی کیف پول کافی نیست.', 422);
    wallet_add($uid, -$amount);
    tx($uid, 'payment', -$amount, 'پرداخت ' . $o['code']);
    q('UPDATE orders SET paid = 1 WHERE id = ?', [$o['id']]);
    if ($o['designer_id'] && in_array($o['status'], ['new', 'review'], true)) order_event((int) $o['id'], 'in_progress');
    notify_order($o, 'پیش‌فاکتور ' . $o['code'] . ' پرداخت شد.', $uid);
}

// ------------------------------------------------------------------ common actions
function a_notif_read(): void
{
    $u = require_user();
    q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [int_in('id'), $u['id']]);
    done();
}
function a_notif_readAll(): void
{
    $u = require_user();
    q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$u['id']]);
    done('همه اعلان‌ها خوانده شد.');
}
function a_ticket_create(): void
{
    $u = require_user();
    rate_limit('ticket', 10, 3600);
    $subject = str_in('subject', 190);
    $message = str_in('message', 5000);
    if (!$subject || mb_strlen($message) < 3) fail('موضوع و پیام را وارد کنید.', 422);
    insert('tickets', ['user_id' => $u['id'], 'name' => $u['name'], 'phone' => $u['phone'], 'subject' => $subject, 'message' => $message, 'status' => 'open', 'created_at' => now()]);
    notify_admins('تیکت جدید: ' . $subject, 'tickets');
    done('تیکت ثبت شد؛ به‌زودی پاسخ می‌دهیم.');
}
function a_ticket_reply(): void
{
    $u = require_user();
    $t = row('SELECT * FROM tickets WHERE id = ?', [int_in('id')]);
    if (!$t || ($u['role'] !== 'admin' && (int) $t['user_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
    $text = str_in('text', 5000);
    if (!$text) fail('متن پاسخ را بنویسید.', 422);
    insert('ticket_replies', ['ticket_id' => $t['id'], 'user_id' => $u['id'], 'body' => $text, 'created_at' => now()]);
    if ($u['role'] === 'admin') {
        q("UPDATE tickets SET status = 'answered' WHERE id = ?", [$t['id']]);
        if ($t['user_id']) notify((int) $t['user_id'], 'پاسخ جدید برای تیکت «' . $t['subject'] . '»', 'tickets');
    } else {
        q("UPDATE tickets SET status = 'open' WHERE id = ?", [$t['id']]);
        notify_admins('پاسخ جدید در تیکت «' . $t['subject'] . '»', 'tickets');
    }
    done('پاسخ ارسال شد.');
}
function a_ticket_close(): void
{
    require_active('admin');
    $t = row('SELECT * FROM tickets WHERE id = ?', [int_in('id')]);
    if (!$t) fail('پیدا نشد.', 404);
    q("UPDATE tickets SET status = 'closed' WHERE id = ?", [$t['id']]);
    if ($t['user_id']) notify((int) $t['user_id'], 'تیکت «' . $t['subject'] . '» بسته شد.', 'tickets');
    done('تیکت بسته شد.');
}
function a_ticket_delete(): void
{
    require_active('admin');
    q('DELETE FROM ticket_replies WHERE ticket_id = ?', [int_in('id')]);
    q('DELETE FROM tickets WHERE id = ?', [int_in('id')]);
    done('تیکت حذف شد.');
}

function a_profile_save(): void
{
    $u = require_user();
    $data = ['name' => str_in('name', 120) ?: $u['name'], 'email' => str_in('email', 190) ?: null];
    if ($data['email'] && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) fail('ایمیل معتبر نیست.', 422);
    if ($u['role'] === 'customer') $data['business'] = str_in('business', 190) ?: null;
    if (in_array($u['role'], ['designer', 'seller'], true)) {
        $data['bio'] = str_in('bio', 1000);
        $data['card'] = str_in('card', 64) ?: null;
    }
    if ($u['role'] === 'seller') $data['shop_name'] = str_in('shopName', 190) ?: $u['shop_name'];
    if ($u['role'] === 'designer' && in('skills') !== null) {
        $valid = array_column(rows('SELECT id FROM services'), 'id');
        $data['skills'] = jenc(array_values(array_intersect(array_map('strval', arr_in('skills')), $valid)));
    }
    update('users', $data, 'id = ?', [$u['id']]);
    done('پروفایل ذخیره شد.');
}
function a_password_change(): void
{
    $u = require_user();
    if (!password_verify((string) in('old', ''), $u['password_hash'])) fail('رمز فعلی اشتباه است.', 422);
    $new = (string) in('new', '');
    if (strlen($new) < 6) fail('رمز جدید باید حداقل ۶ کاراکتر باشد.', 422);
    update('users', ['password_hash' => password_hash($new, PASSWORD_DEFAULT)], 'id = ?', [$u['id']]);
    done('رمز عبور تغییر کرد.');
}
function a_prefs_save(): void
{
    $u = require_user();
    $prefs = jdec($u['prefs'], ['email' => true, 'sms' => true]);
    $key = str_in('key', 20);
    if (!in_array($key, ['email', 'sms'], true)) fail('نامعتبر.', 422);
    $prefs[$key] = (bool) in('value');
    update('users', ['prefs' => jenc($prefs)], 'id = ?', [$u['id']]);
    done('ذخیره شد.');
}
function a_order_message(): void
{
    $u = require_user();
    $o = get_order(int_in('id'));
    if (!is_participant($o, $u)) fail('دسترسی ندارید.', 403);
    $text = str_in('text', 3000);
    if (!$text) fail('پیام خالی است.', 422);
    insert('order_messages', ['order_id' => $o['id'], 'user_id' => $u['id'], 'body' => $text, 'created_at' => now()]);
    notify_order($o, 'پیام جدید در ' . $o['code'] . ' از ' . $u['name'], (int) $u['id']);
    done();
}
function a_payout_request(): void
{
    $u = require_active('designer', 'seller');
    $amount = amount_in('amount');
    $min = (int) setting('commission', 'minPayout');
    if ($amount < $min) fail('حداقل مبلغ تسویه ' . toman($min) . ' است.', 422);
    if ($amount > (int) $u['wallet']) fail('موجودی کافی نیست.', 422);
    $card = str_in('card', 64);
    if (strlen($card) < 8) fail('شماره شبا یا کارت را وارد کنید.', 422);
    db()->beginTransaction();
    wallet_add((int) $u['id'], -$amount);
    update('users', ['card' => $card], 'id = ?', [$u['id']]);
    insert('payouts', ['user_id' => $u['id'], 'amount' => $amount, 'card' => $card, 'status' => 'pending', 'created_at' => now()]);
    db()->commit();
    notify_admins('درخواست تسویه ' . toman($amount) . ' از ' . $u['name'], 'finance');
    done('درخواست تسویه ثبت شد.');
}
function a_unimpersonate(): void
{
    $admin = $_SESSION['impersonator'] ?? null;
    if (!$admin) fail('نامعتبر.', 422);
    unset($_SESSION['impersonator']);
    login_as((int) $admin);
    done('به حساب مدیر برگشتید.');
}

// ------------------------------------------------------------------ customer
function own_order(): array
{
    $u = require_user('customer', 'admin');
    $o = get_order(int_in('id'));
    if ((int) $o['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin') fail('دسترسی ندارید.', 403);
    return [$u, $o];
}
function a_order_cancel(): void
{
    [$u, $o] = own_order();
    if (!in_array($o['status'], ['new', 'review'], true) || $o['paid']) fail('این سفارش قابل لغو نیست؛ با پشتیبانی تماس بگیرید.', 422);
    order_event((int) $o['id'], 'cancelled', 'توسط مشتری');
    notify_order($o, 'سفارش ' . $o['code'] . ' توسط مشتری لغو شد.', (int) $u['id']);
    done('سفارش لغو شد.');
}
function a_order_pay(): void
{
    [$u, $o] = own_order();
    if ($o['paid']) fail('این سفارش قبلاً پرداخت شده است.', 422);
    if ($o['status'] !== 'review') fail('پیش‌فاکتور هنوز صادر نشده است.', 422);
    $amount = price_of($o);
    if (str_in('method', 16) === 'wallet') {
        db()->beginTransaction();
        order_pay_from_wallet($o, (int) $u['id']);
        db()->commit();
        done('پرداخت با موفقیت انجام شد.');
    }
    $need = $amount - max(0, (int) $u['wallet']);
    $url = payment_start((int) $u['id'], 'order', ['orderId' => (int) $o['id']], max(1000, $need), 'پرداخت سفارش ' . $o['code']);
    done('', ['redirect' => $url]);
}
function a_order_approve(): void
{
    [$u, $o] = own_order();
    if ($o['status'] !== 'awaiting') fail('سفارش در وضعیت تأیید نیست.', 422);
    db()->beginTransaction();
    if ($o['designer_id']) {
        $des = row('SELECT * FROM users WHERE id = ?', [$o['designer_id']]);
        if ($des) {
            $pct = commission_for($des); // computed before this order counts as done
            $earn = (int) round(price_of($o) * (1 - $pct / 100));
            wallet_add((int) $des['id'], $earn);
            tx((int) $des['id'], 'earning', $earn, 'درآمد ' . $o['code'] . ' (کارمزد ' . fa_digits($pct) . '٪)');
        }
    }
    order_event((int) $o['id'], 'done');
    db()->commit();
    notify_order($o, 'سفارش ' . $o['code'] . ' تأیید و تحویل شد 🎉', (int) $u['id']);
    done('سفارش تحویل شد.');
}
function a_order_rate(): void
{
    [$u, $o] = own_order();
    $r = int_in('rating');
    if ($o['status'] !== 'done' || $r < 1 || $r > 5) fail('امتیاز نامعتبر.', 422);
    update('orders', ['rating' => $r, 'review' => str_in('review', 1000)], 'id = ?', [$o['id']]);
    if ($o['designer_id']) {
        $avg = (float) val('SELECT AVG(rating) FROM orders WHERE designer_id = ? AND rating IS NOT NULL', [$o['designer_id']]);
        update('users', ['rating' => round($avg, 2)], 'id = ?', [$o['designer_id']]);
        notify((int) $o['designer_id'], 'امتیاز ' . fa_digits($r) . ' ستاره برای ' . $o['code'] . ' ثبت شد.', 'overview');
    }
    done('ممنون از امتیاز شما!');
}
function a_order_revise(): void
{
    [$u, $o] = own_order();
    if ($o['status'] !== 'awaiting') fail('سفارش در وضعیت بررسی نیست.', 422);
    $note = str_in('note', 2000);
    if (mb_strlen($note) < 5) fail('توضیح اصلاحات را بنویسید.', 422);
    insert('order_messages', ['order_id' => $o['id'], 'user_id' => $u['id'], 'body' => 'درخواست اصلاح: ' . $note, 'created_at' => now()]);
    order_event((int) $o['id'], 'revision', mb_substr($note, 0, 250));
    notify_order($o, 'درخواست اصلاح برای ' . $o['code'] . ' ثبت شد.', (int) $u['id']);
    done('درخواست اصلاح ارسال شد.');
}
function a_wallet_charge(): void
{
    $u = require_user();
    $amount = amount_in('amount');
    if ($amount < 10000) fail('حداقل مبلغ شارژ ۱۰ هزار تومان است.', 422);
    done('', ['redirect' => payment_start((int) $u['id'], 'charge', [], $amount, 'شارژ کیف پول بهیکس')]);
}
function a_fav_toggle(): void
{
    r_fav_toggle();
}

// ------------------------------------------------------------------ designer
function a_order_apply(): void
{
    $u = require_active('designer');
    $o = get_order(int_in('id'));
    if ($o['designer_id'] || !in_array($o['status'], ['new', 'review'], true)) fail('این پروژه دیگر باز نیست.', 422);
    $apps = array_map('intval', jdec($o['applicants'], []));
    if (!in_array((int) $u['id'], $apps, true)) $apps[] = (int) $u['id'];
    update('orders', ['applicants' => jenc($apps)], 'id = ?', [$o['id']]);
    notify_admins($u['name'] . ' برای ' . $o['code'] . ' اعلام آمادگی کرد.', 'orders');
    done('آمادگی شما ثبت شد؛ پس از تأیید مدیر پروژه به شما واگذار می‌شود.');
}
function assigned_order(): array
{
    $u = require_active('designer', 'admin');
    $o = get_order(int_in('id'));
    if ($u['role'] !== 'admin' && (int) $o['designer_id'] !== (int) $u['id']) fail('دسترسی ندارید.', 403);
    return [$u, $o];
}
function a_order_deliver(): void
{
    [$u, $o] = assigned_order();
    if (!in_array($o['status'], ['in_progress', 'revision'], true)) fail('در این وضعیت امکان آپلود نیست.', 422);
    $files = uploaded_files();
    if (!$files) fail('فایلی انتخاب نشده است.', 422);
    foreach (array_slice($files, 0, 20) as $f) store_upload($f, 'deliverable', (int) $o['id'], (int) $u['id']);
    done(fa_digits(count($files)) . ' فایل آپلود شد.');
}
function a_order_submitReview(): void
{
    [$u, $o] = assigned_order();
    if (!in_array($o['status'], ['in_progress', 'revision'], true)) fail('در این وضعیت امکان ارسال نیست.', 422);
    if (!val("SELECT COUNT(*) FROM files WHERE kind = 'deliverable' AND ref_id = ?", [$o['id']])) fail('ابتدا حداقل یک فایل تحویلی آپلود کنید.', 422);
    order_event((int) $o['id'], 'awaiting');
    notify_order($o, 'نسخه جدید ' . $o['code'] . ' آماده بررسی است.', (int) $u['id']);
    done('برای تأیید مشتری ارسال شد.');
}
function a_file_delete(): void
{
    $u = require_user();
    $f = row('SELECT * FROM files WHERE id = ?', [int_in('id')]);
    if (!$f || ($u['role'] !== 'admin' && (int) $f['owner_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
    if ($f['path']) @unlink(dirname(__DIR__, 2) . '/uploads/' . $f['path']);
    q('DELETE FROM files WHERE id = ?', [$f['id']]);
    done('فایل حذف شد.');
}
function a_work_add(): void
{
    $u = require_active('designer', 'admin');
    $title = str_in('title', 190);
    $svc = find_service(str_in('service', 40));
    if (mb_strlen($title) < 3 || !$svc) fail('عنوان و خدمت را مشخص کنید.', 422);
    $designer = $u['role'] === 'admin' && int_in('designerId') ? int_in('designerId') : (int) $u['id'];
    $id = insert('portfolio', ['designer_id' => $designer, 'title' => $title, 'category_id' => $svc['category_id'], 'service_id' => $svc['id'], 'likes' => 0, 'created_at' => now()]);
    foreach (array_slice(uploaded_files(), 0, 6) as $f) store_upload($f, 'portfolio', $id, (int) $u['id']);
    done('نمونه‌کار اضافه شد.');
}
function a_work_delete(): void
{
    $u = require_active('designer', 'admin');
    $w = row('SELECT * FROM portfolio WHERE id = ?', [int_in('id')]);
    if (!$w || ($u['role'] !== 'admin' && (int) $w['designer_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
    foreach (rows("SELECT * FROM files WHERE kind = 'portfolio' AND ref_id = ?", [$w['id']]) as $f) if ($f['path']) @unlink(dirname(__DIR__, 2) . '/uploads/' . $f['path']);
    q("DELETE FROM files WHERE kind = 'portfolio' AND ref_id = ?", [$w['id']]);
    q('DELETE FROM portfolio WHERE id = ?', [$w['id']]);
    done('نمونه‌کار حذف شد.');
}

// ------------------------------------------------------------------ seller / products
function a_product_save(): void
{
    $u = require_active('seller', 'admin');
    $id = int_in('id');
    $title = str_in('title', 190);
    $price = amount_in('price');
    if (mb_strlen($title) < 3 || $price < 1000) fail('عنوان و قیمت را درست وارد کنید.', 422);
    $cat = str_in('category', 40);
    if (!row('SELECT id FROM product_categories WHERE id = ?', [$cat])) fail('دسته‌بندی نامعتبر است.', 422);
    $tags = array_values(array_filter(array_map('trim', preg_split('/[,،]/u', str_in('tags', 500)))));
    $data = ['title' => $title, 'category_id' => $cat, 'price' => $price, 'discount' => max(0, min(90, int_in('discount'))), 'tags' => jenc($tags), 'descr' => str_in('desc', 5000)];
    if ($u['role'] === 'admin') {
        $status = str_in('status', 16);
        if (in_array($status, ['pending', 'active', 'hidden', 'rejected'], true)) $data['status'] = $status;
        $seller = int_in('sellerId');
        if ($seller) $data['seller_id'] = $seller;
    } else {
        $data['status'] = 'pending'; // every seller edit is reviewed again
    }
    if ($id) {
        $p = row('SELECT * FROM products WHERE id = ?', [$id]);
        if (!$p || ($u['role'] !== 'admin' && (int) $p['seller_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
        update('products', $data, 'id = ?', [$id]);
    } else {
        $data += ['seller_id' => $u['id'], 'sales' => 0, 'rating' => 0, 'created_at' => now()];
        if (!isset($data['status'])) $data['status'] = 'pending';
        $id = insert('products', $data);
    }
    foreach (array_slice(uploaded_files(), 0, 10) as $f) store_upload($f, 'product', $id, (int) $u['id']);
    if ($u['role'] !== 'admin') notify_admins('محصول «' . $title . '» برای تأیید ارسال شد.', 'sellers');
    done($u['role'] === 'admin' ? 'محصول ذخیره شد.' : 'محصول برای بررسی ارسال شد.');
}
function own_product(): array
{
    $u = require_active('seller', 'admin');
    $p = row('SELECT * FROM products WHERE id = ?', [int_in('id')]);
    if (!$p || ($u['role'] !== 'admin' && (int) $p['seller_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
    return [$u, $p];
}
function a_product_delete(): void
{
    [$u, $p] = own_product();
    foreach (rows("SELECT * FROM files WHERE kind = 'product' AND ref_id = ?", [$p['id']]) as $f) if ($f['path']) @unlink(dirname(__DIR__, 2) . '/uploads/' . $f['path']);
    q("DELETE FROM files WHERE kind = 'product' AND ref_id = ?", [$p['id']]);
    q('DELETE FROM favorites WHERE product_id = ?', [$p['id']]);
    q('DELETE FROM products WHERE id = ?', [$p['id']]);
    done('محصول حذف شد.');
}
function a_product_status(): void
{
    [$u, $p] = own_product();
    $status = str_in('status', 16);
    if ($u['role'] === 'admin') {
        if (!in_array($status, ['pending', 'active', 'hidden', 'rejected'], true)) fail('نامعتبر.', 422);
        notify((int) $p['seller_id'], 'وضعیت «' . $p['title'] . '» تغییر کرد.', 'products');
    } elseif (!in_array($p['status'], ['active', 'hidden'], true) || !in_array($status, ['active', 'hidden'], true)) {
        fail('این محصول هنوز تأیید نشده است.', 422);
    }
    update('products', ['status' => $status], 'id = ?', [$p['id']]);
    done('وضعیت محصول به‌روز شد.');
}
function a_coupon_create(): void
{
    $u = require_active('seller', 'admin');
    $code = strtoupper(preg_replace('/\s/', '', str_in('code', 20)));
    $pct = int_in('percent');
    if (!preg_match('/^[A-Z0-9]{3,20}$/', $code)) fail('کد باید ۳ تا ۲۰ حرف/عدد انگلیسی باشد.', 422);
    if ($pct < 1 || $pct > 90) fail('درصد تخفیف بین ۱ تا ۹۰ باشد.', 422);
    if (row('SELECT code FROM coupons WHERE code = ?', [$code])) fail('این کد قبلاً ساخته شده است.', 422);
    insert('coupons', ['code' => $code, 'percent' => $pct, 'uses' => 0, 'max_uses' => max(0, int_in('limit')), 'active' => 1, 'owner_id' => $u['role'] === 'admin' ? null : $u['id']]);
    done('کد تخفیف ساخته شد.');
}
function own_coupon(): array
{
    $u = require_active('seller', 'admin');
    $c = row('SELECT * FROM coupons WHERE code = ?', [str_in('code', 32)]);
    if (!$c || ($u['role'] !== 'admin' && (int) $c['owner_id'] !== (int) $u['id'])) fail('دسترسی ندارید.', 403);
    return $c;
}
function a_coupon_toggle(): void
{
    $c = own_coupon();
    update('coupons', ['active' => in('active') ? 1 : 0], 'code = ?', [$c['code']]);
    done(in('active') ? 'کد فعال شد.' : 'کد غیرفعال شد.');
}
function a_coupon_delete(): void
{
    $c = own_coupon();
    q('DELETE FROM coupons WHERE code = ?', [$c['code']]);
    done('کد حذف شد.');
}

// ------------------------------------------------------------------ admin: orders
function a_order_quote(): void
{
    require_active('admin');
    $o = get_order(int_in('id'));
    $amount = amount_in('amount');
    if ($amount < 1000) fail('مبلغ معتبر وارد کنید.', 422);
    update('orders', ['quote' => $amount], 'id = ?', [$o['id']]);
    if ($o['status'] === 'new') order_event((int) $o['id'], 'review');
    notify((int) $o['user_id'], 'پیش‌فاکتور ' . $o['code'] . ' صادر شد: ' . toman($amount), 'orders');
    done('پیش‌فاکتور برای مشتری ارسال شد.');
}
function a_order_assign(): void
{
    $admin = require_active('admin');
    $o = get_order(int_in('id'));
    $d = row("SELECT * FROM users WHERE id = ? AND role = 'designer' AND status = 'active'", [int_in('designerId')]);
    if (!$d) fail('طراح معتبر انتخاب کنید.', 422);
    update('orders', ['designer_id' => $d['id']], 'id = ?', [$o['id']]);
    if ($o['paid'] && in_array($o['status'], ['new', 'review'], true)) order_event((int) $o['id'], 'in_progress');
    notify((int) $d['id'], 'پروژه ' . $o['code'] . ' به شما واگذار شد.', 'projects');
    notify((int) $o['user_id'], 'طراح سفارش ' . $o['code'] . ': ' . $d['name'], 'orders');
    done('طراح تخصیص یافت.');
}
function a_order_status(): void
{
    $admin = require_active('admin');
    $o = get_order(int_in('id'));
    $st = str_in('status', 16);
    if (!in_array($st, ORDER_STATUSES, true)) fail('وضعیت نامعتبر.', 422);
    if ($st === $o['status']) done();
    order_event((int) $o['id'], $st, 'توسط مدیر');
    notify_order($o, 'وضعیت ' . $o['code'] . ': ' . ORDER_LABELS[$st], (int) $admin['id']);
    done('وضعیت به‌روز شد.');
}
function a_order_markPaid(): void
{
    $admin = require_active('admin');
    $o = get_order(int_in('id'));
    q('UPDATE orders SET paid = 1 WHERE id = ?', [$o['id']]);
    if ($o['designer_id'] && in_array($o['status'], ['new', 'review'], true)) order_event((int) $o['id'], 'in_progress');
    notify_order($o, 'پرداخت ' . $o['code'] . ' تأیید شد.', (int) $admin['id']);
    done('سفارش پرداخت‌شده علامت خورد.');
}
function a_order_refund(): void
{
    require_active('admin');
    $o = get_order(int_in('id'));
    if (!$o['paid']) fail('این سفارش پرداخت نشده است.', 422);
    $amount = amount_in('amount') ?: price_of($o);
    wallet_add((int) $o['user_id'], $amount);
    tx((int) $o['user_id'], 'refund', $amount, 'بازگشت وجه ' . $o['code']);
    q('UPDATE orders SET paid = 0 WHERE id = ?', [$o['id']]);
    order_event((int) $o['id'], 'cancelled', 'بازگشت وجه');
    notify((int) $o['user_id'], toman($amount) . ' بابت ' . $o['code'] . ' به کیف پول شما برگشت.', 'wallet');
    done('مبلغ به کیف پول مشتری برگشت.');
}
function a_order_delete(): void
{
    require_active('admin');
    $o = get_order(int_in('id'));
    foreach (rows("SELECT * FROM files WHERE kind IN ('attachment','deliverable') AND ref_id = ?", [$o['id']]) as $f) if ($f['path']) @unlink(dirname(__DIR__, 2) . '/uploads/' . $f['path']);
    q("DELETE FROM files WHERE kind IN ('attachment','deliverable') AND ref_id = ?", [$o['id']]);
    q('DELETE FROM order_events WHERE order_id = ?', [$o['id']]);
    q('DELETE FROM order_messages WHERE order_id = ?', [$o['id']]);
    q('DELETE FROM orders WHERE id = ?', [$o['id']]);
    done('سفارش حذف شد.');
}

// ------------------------------------------------------------------ admin: users
function a_user_save(): void
{
    $admin = require_active('admin');
    $id = int_in('id');
    $name = str_in('name', 120);
    if (mb_strlen($name) < 2) fail('نام را وارد کنید.', 422);
    $phone = phone_in();
    $dup = row('SELECT id FROM users WHERE phone = ? AND id <> ?', [$phone, $id]);
    if ($dup) fail('این شماره برای کاربر دیگری ثبت شده است.', 422);
    $role = str_in('role', 16);
    $status = str_in('status', 16);
    if (!in_array($role, ROLES, true) || !in_array($status, USER_STATUSES, true)) fail('نقش یا وضعیت نامعتبر است.', 422);
    if ($id === (int) $admin['id'] && ($role !== 'admin' || $status !== 'active')) fail('نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید.', 422);
    $commission = trim(en_digits((string) in('commission', '')));
    $email = str_in('email', 190) ?: null;
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('ایمیل معتبر نیست.', 422);
    $data = ['name' => $name, 'phone' => $phone, 'email' => $email, 'role' => $role, 'status' => $status,
        'business' => str_in('business', 190) ?: null, 'shop_name' => str_in('shopName', 190) ?: null, 'bio' => str_in('bio', 1000) ?: null,
        'level' => str_in('level', 64) ?: null, 'card' => str_in('card', 64) ?: null,
        'commission' => $commission === '' ? null : max(0, min(100, (float) $commission))];
    if (in('skills') !== null) {
        $valid = array_column(rows('SELECT id FROM services'), 'id');
        $data['skills'] = jenc(array_values(array_intersect(array_map('strval', arr_in('skills')), $valid)));
    }
    $pass = (string) in('password', '');
    if ($pass !== '') {
        if (strlen($pass) < 6) fail('رمز عبور باید حداقل ۶ کاراکتر باشد.', 422);
        $data['password_hash'] = password_hash($pass, PASSWORD_DEFAULT);
    }
    db()->beginTransaction();
    if ($id) {
        $old = row('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$old) fail('کاربر پیدا نشد.', 404);
        update('users', $data, 'id = ?', [$id]);
        if ($old['status'] !== $status && $status === 'active' && $old['status'] === 'pending') notify($id, 'حساب شما تأیید و فعال شد 🎉', 'overview');
    } else {
        if ($pass === '') fail('برای کاربر جدید رمز عبور تعیین کنید.', 422);
        $data += ['hue' => random_int(0, 359), 'created_at' => now()];
        $id = insert('users', $data);
    }
    $adj = (int) en_digits((string) in('walletAdjust', '0'));
    if ($adj !== 0) {
        wallet_add($id, $adj);
        tx($id, $adj > 0 ? 'charge' : 'payment', $adj, 'اصلاح موجودی توسط مدیر');
    }
    db()->commit();
    done('اطلاعات کاربر ذخیره شد.', ['id' => (string) $id]);
}
function a_user_status(): void
{
    $admin = require_active('admin');
    $id = int_in('id');
    $st = str_in('status', 16);
    if ($id === (int) $admin['id'] || !in_array($st, USER_STATUSES, true)) fail('نامعتبر.', 422);
    update('users', ['status' => $st], 'id = ?', [$id]);
    notify($id, $st === 'active' ? 'حساب شما تأیید و فعال شد 🎉' : ($st === 'rejected' ? 'درخواست همکاری شما تأیید نشد.' : 'وضعیت حساب شما تغییر کرد.'), 'overview');
    done('وضعیت کاربر به‌روز شد.');
}
function delete_user_data(int $id): void
{
    foreach (rows('SELECT id FROM orders WHERE user_id = ?', [$id]) as $o) {
        q('DELETE FROM order_events WHERE order_id = ?', [$o['id']]);
        q('DELETE FROM order_messages WHERE order_id = ?', [$o['id']]);
        q("DELETE FROM files WHERE kind IN ('attachment','deliverable') AND ref_id = ?", [$o['id']]);
    }
    q('DELETE FROM orders WHERE user_id = ?', [$id]);
    q('UPDATE orders SET designer_id = NULL WHERE designer_id = ?', [$id]);
    foreach (rows('SELECT id FROM products WHERE seller_id = ?', [$id]) as $p) {
        q("DELETE FROM files WHERE kind = 'product' AND ref_id = ?", [$p['id']]);
        q('DELETE FROM favorites WHERE product_id = ?', [$p['id']]);
    }
    q('DELETE FROM products WHERE seller_id = ?', [$id]);
    foreach (rows('SELECT id FROM portfolio WHERE designer_id = ?', [$id]) as $w) q("DELETE FROM files WHERE kind = 'portfolio' AND ref_id = ?", [$w['id']]);
    q('DELETE FROM portfolio WHERE designer_id = ?', [$id]);
    foreach (['transactions', 'payouts', 'payments', 'purchases', 'notifications', 'favorites'] as $t) q("DELETE FROM $t WHERE user_id = ?", [$id]);
    foreach (rows('SELECT id FROM tickets WHERE user_id = ?', [$id]) as $t) q('DELETE FROM ticket_replies WHERE ticket_id = ?', [$t['id']]);
    q('DELETE FROM tickets WHERE user_id = ?', [$id]);
    q('DELETE FROM coupons WHERE owner_id = ?', [$id]);
    q('DELETE FROM users WHERE id = ?', [$id]);
}
function a_user_delete(): void
{
    $admin = require_active('admin');
    $id = int_in('id');
    if ($id === (int) $admin['id']) fail('نمی‌توانید حساب خودتان را حذف کنید.', 422);
    if (!row('SELECT id FROM users WHERE id = ?', [$id])) fail('کاربر پیدا نشد.', 404);
    db()->beginTransaction();
    delete_user_data($id);
    db()->commit();
    done('کاربر و اطلاعات مرتبط حذف شد.');
}
function a_user_impersonate(): void
{
    $admin = require_active('admin');
    $target = row('SELECT * FROM users WHERE id = ?', [int_in('id')]);
    if (!$target || (int) $target['id'] === (int) $admin['id']) fail('نامعتبر.', 422);
    $_SESSION['impersonator'] = (int) $admin['id'];
    login_as((int) $target['id']);
    $_SESSION['impersonator'] = (int) $admin['id'];
    done('وارد پنل کاربر شدید.');
}
function a_demo_purge(): void
{
    require_active('admin');
    db()->beginTransaction();
    foreach (rows('SELECT id FROM users WHERE is_demo = 1') as $u) delete_user_data((int) $u['id']);
    q("DELETE FROM coupons WHERE code IN ('WELCOME10', 'MEHR25')");
    q('DELETE FROM tickets WHERE user_id IS NULL');
    db()->commit();
    $g = setting('general');
    $g['demoMode'] = false;
    save_setting('general', $g);
    done('داده‌های نمایشی حذف شد و حالت نمایشی خاموش شد.');
}

// ------------------------------------------------------------------ admin: finance
function a_payout_paid(): void
{
    require_active('admin');
    $p = row("SELECT * FROM payouts WHERE id = ? AND status = 'pending'", [int_in('id')]);
    if (!$p) fail('درخواست پیدا نشد.', 404);
    update('payouts', ['status' => 'paid'], 'id = ?', [$p['id']]);
    tx((int) $p['user_id'], 'payout', -(int) $p['amount'], 'تسویه حساب');
    notify((int) $p['user_id'], 'مبلغ ' . toman((int) $p['amount']) . ' به حساب شما واریز شد.', 'earnings');
    done('واریز ثبت شد.');
}
function a_payout_reject(): void
{
    require_active('admin');
    $p = row("SELECT * FROM payouts WHERE id = ? AND status = 'pending'", [int_in('id')]);
    if (!$p) fail('درخواست پیدا نشد.', 404);
    update('payouts', ['status' => 'rejected'], 'id = ?', [$p['id']]);
    wallet_add((int) $p['user_id'], (int) $p['amount']);
    notify((int) $p['user_id'], 'درخواست تسویه رد شد و مبلغ به موجودی برگشت.', 'earnings');
    done('درخواست رد شد و مبلغ برگشت.');
}

// ------------------------------------------------------------------ admin: catalog
function slug_in(string $k): string
{
    $s = strtolower(str_in($k, 40));
    if (!preg_match('/^[a-z0-9][a-z0-9_-]{1,39}$/', $s)) fail('شناسه باید با حروف انگلیسی کوچک، عدد، - یا _ باشد.', 422);
    return $s;
}
function a_category_save(): void
{
    require_active('admin');
    $id = slug_in('id');
    $isNew = (bool) in('isNew');
    if ($isNew && row('SELECT id FROM categories WHERE id = ?', [$id])) fail('این شناسه قبلاً استفاده شده است.', 422);
    $title = str_in('title', 120);
    if (!$title) fail('عنوان را وارد کنید.', 422);
    q('REPLACE INTO categories (id, title, en, icon, hue, descr, sort, active) VALUES (?,?,?,?,?,?,?,?)',
        [$id, $title, str_in('en', 60), (preg_replace('/[^a-z0-9-]/', '', str_in('icon', 40)) ?: 'sparkle'), max(0, min(360, int_in('hue', 25))), str_in('desc', 255), int_in('sort'), in('active', true) ? 1 : 0]);
    done('شاخه ذخیره شد.');
}
function a_category_delete(): void
{
    require_active('admin');
    $id = str_in('id', 40);
    if (val('SELECT COUNT(*) FROM services WHERE category_id = ?', [$id])) fail('ابتدا خدمات این شاخه را حذف یا جابه‌جا کنید.', 422);
    q('DELETE FROM categories WHERE id = ?', [$id]);
    done('شاخه حذف شد.');
}
function clean_fields(array $raw): array
{
    $types = ['number', 'select', 'cards', 'chips', 'text', 'textarea'];
    $out = [];
    $seen = [];
    foreach (array_slice($raw, 0, 30) as $f) {
        if (!is_array($f)) continue;
        $id = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($f['id'] ?? '')));
        $type = in_array($f['type'] ?? '', $types, true) ? $f['type'] : 'text';
        $label = mb_substr(trim((string) ($f['label'] ?? '')), 0, 120);
        if (!$id || !$label || isset($seen[$id])) continue;
        $seen[$id] = true;
        $c = ['id' => $id, 'type' => $type, 'label' => $label];
        if (!empty($f['required'])) $c['required'] = true;
        if (!empty($f['placeholder'])) $c['placeholder'] = mb_substr((string) $f['placeholder'], 0, 120);
        if (!empty($f['dir']) && $f['dir'] === 'ltr') $c['dir'] = 'ltr';
        if ($type === 'number') {
            foreach (['min' => 0, 'max' => 100, 'value' => 1, 'included' => 0, 'perUnit' => 0, 'step' => 1] as $k => $d) $c[$k] = (int) en_digits((string) ($f[$k] ?? $d));
            if ($c['max'] < $c['min']) $c['max'] = $c['min'];
            $c['value'] = max($c['min'], min($c['max'], $c['value']));
            $c['step'] = max(1, $c['step']);
            $c['suffix'] = mb_substr((string) ($f['suffix'] ?? ''), 0, 30);
        }
        if (in_array($type, ['select', 'cards', 'chips'], true)) {
            $opts = [];
            $ov = [];
            foreach (array_slice((array) ($f['options'] ?? []), 0, 30) as $i => $o) {
                if (!is_array($o)) continue;
                $label2 = mb_substr(trim((string) ($o['label'] ?? '')), 0, 120);
                if (!$label2) continue;
                $v = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($o['v'] ?? ''))) ?: 'o' . ($i + 1);
                if (isset($ov[$v])) $v .= $i;
                $ov[$v] = true;
                $opt = ['v' => $v, 'label' => $label2, 'price' => (int) en_digits((string) ($o['price'] ?? 0))];
                if (!empty($o['icon'])) $opt['icon'] = preg_replace('/[^a-z0-9-]/', '', (string) $o['icon']);
                $opts[] = $opt;
            }
            if (!$opts) continue;
            $c['options'] = $opts;
        }
        $out[] = $c;
    }
    return $out;
}
function a_service_save(): void
{
    require_active('admin');
    $id = slug_in('id');
    $isNew = (bool) in('isNew');
    if ($isNew && row('SELECT id FROM services WHERE id = ?', [$id])) fail('این شناسه قبلاً استفاده شده است.', 422);
    $cat = str_in('category', 40);
    if (!row('SELECT id FROM categories WHERE id = ?', [$cat])) fail('شاخه نامعتبر است.', 422);
    $title = str_in('title', 160);
    if (!$title) fail('عنوان خدمت را وارد کنید.', 422);
    $fields = clean_fields(arr_in('fields'));
    q('REPLACE INTO services (id, category_id, title, icon, base, days, descr, fields, sort, active) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [$id, $cat, $title, (preg_replace('/[^a-z0-9-]/', '', str_in('icon', 40)) ?: 'sparkle'), amount_in('base'), max(1, int_in('days', 3)), str_in('desc', 1000), jenc($fields), int_in('sort'), in('active', true) ? 1 : 0]);
    done('خدمت ذخیره شد.');
}
function a_service_delete(): void
{
    require_active('admin');
    $id = str_in('id', 40);
    if (val('SELECT COUNT(*) FROM orders WHERE service_id = ?', [$id])) {
        q('UPDATE services SET active = 0 WHERE id = ?', [$id]);
        done('این خدمت سفارش ثبت‌شده دارد؛ به‌جای حذف غیرفعال شد.');
    }
    q('DELETE FROM services WHERE id = ?', [$id]);
    done('خدمت حذف شد.');
}
function a_productCategory_save(): void
{
    require_active('admin');
    $id = slug_in('id');
    if (in('isNew') && row('SELECT id FROM product_categories WHERE id = ?', [$id])) fail('این شناسه قبلاً استفاده شده است.', 422);
    $title = str_in('title', 120);
    if (!$title) fail('عنوان را وارد کنید.', 422);
    q('REPLACE INTO product_categories (id, title, icon, sort) VALUES (?,?,?,?)', [$id, $title, (preg_replace('/[^a-z0-9-]/', '', str_in('icon', 40)) ?: 'box'), int_in('sort')]);
    done('دسته‌بندی ذخیره شد.');
}
function a_productCategory_delete(): void
{
    require_active('admin');
    $id = str_in('id', 40);
    if (val('SELECT COUNT(*) FROM products WHERE category_id = ?', [$id])) fail('این دسته محصول دارد؛ ابتدا محصولات را جابه‌جا کنید.', 422);
    q('DELETE FROM product_categories WHERE id = ?', [$id]);
    done('دسته‌بندی حذف شد.');
}

// ------------------------------------------------------------------ admin: settings
// Accepts only known keys and coerces each value to the type of its default.
function coerce_like($default, $v)
{
    if (is_bool($default)) return (bool) $v;
    if (is_int($default)) return (int) en_digits((string) $v);
    if (is_float($default)) return (float) en_digits((string) $v);
    if (is_array($default)) return is_array($v) ? $v : $default;
    return is_scalar($v) ? (string) $v : (string) $default;
}
function a_settings_save(): void
{
    require_active('admin');
    $group = str_in('group', 32);
    $defaults = default_settings();
    if (!isset($defaults[$group]) || !is_array($defaults[$group])) fail('بخش تنظیمات نامعتبر است.', 422);
    $value = in('value', []);
    if (!is_array($value)) fail('مقدار نامعتبر است.', 422);
    $current = setting($group);
    foreach ($defaults[$group] as $k => $d) {
        if (array_key_exists($k, $value)) $current[$k] = coerce_like($d, $value[$k]);
    }
    if ($group === 'commission') {
        foreach (['percent', 'newcomerPercent'] as $k) $current[$k] = max(0, min(100, (float) $current[$k]));
        $current['newcomerUntil'] = max(0, (int) $current['newcomerUntil']);
    }
    if ($group === 'theme') {
        foreach (['brand', 'brand2'] as $k) if (!preg_match('/^#[0-9a-fA-F]{6}$/', $current[$k])) $current[$k] = $defaults['theme'][$k];
        if (!in_array($current['defaultTheme'], ['dark', 'light'], true)) $current['defaultTheme'] = 'dark';
    }
    if ($group === 'orders') {
        $current['deadlines'] = array_values(array_filter(array_map(function ($d) {
            if (!is_array($d) || empty($d['v']) || empty($d['label'])) return null;
            return ['v' => preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $d['v'])), 'label' => mb_substr((string) $d['label'], 0, 40),
                'hint' => mb_substr((string) ($d['hint'] ?? ''), 0, 60), 'mult' => max(0.1, (float) ($d['mult'] ?? 1)),
                'daysMult' => max(0.1, (float) ($d['daysMult'] ?? 1)), 'icon' => preg_replace('/[^a-z0-9-]/', '', (string) ($d['icon'] ?? 'clock'))];
        }, $current['deadlines'])));
        if (!$current['deadlines']) $current['deadlines'] = $defaults['orders']['deadlines'];
        $current['addons'] = array_values(array_filter(array_map(function ($a) {
            if (!is_array($a) || empty($a['v']) || empty($a['label'])) return null;
            return ['v' => preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $a['v'])), 'label' => mb_substr((string) $a['label'], 0, 80), 'pct' => max(0, (float) ($a['pct'] ?? 0))];
        }, $current['addons'])));
        $current['styles'] = array_values(array_filter(array_map(function ($x) { return mb_substr(trim((string) $x), 0, 40); }, (array) $current['styles'])));
        $current['budgets'] = array_values(array_filter(array_map(function ($x) { return mb_substr(trim((string) $x), 0, 60); }, (array) $current['budgets'])));
    }
    if ($group === 'home') {
        $current['packages'] = array_values(array_filter(array_map(function ($p) {
            if (!is_array($p) || empty($p['title'])) return null;
            return ['id' => preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($p['id'] ?? ''))) ?: 'p' . random_int(100, 999), 'title' => mb_substr((string) $p['title'], 0, 120),
                'price' => (int) en_digits((string) ($p['price'] ?? 0)), 'days' => max(1, (int) en_digits((string) ($p['days'] ?? 1))), 'selected' => !empty($p['selected'])];
        }, $current['packages'])));
    }
    if ($group === 'payment' && !in_array($current['driver'], ['test', 'zarinpal', 'zibal'], true)) $current['driver'] = 'test';
    if ($group === 'sms' && !in_array($current['driver'], ['none', 'kavenegar', 'smsir'], true)) $current['driver'] = 'none';
    save_setting($group, $current);
    done('تنظیمات ذخیره شد.');
}
function a_sms_test(): void
{
    $u = require_active('admin');
    if (!sms_enabled()) fail('ابتدا سرویس پیامک و کلید API را ذخیره کنید.', 422);
    if (!sms_send_code($u['phone'], '12345')) fail('ارسال ناموفق بود؛ کلید، الگو و اعتبار پنل پیامک را بررسی کنید.', 502);
    done('پیامک آزمایشی به شماره شما ارسال شد.');
}
