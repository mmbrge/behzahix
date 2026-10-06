<?php
// BEHIX — in-person delivery calendar: weekly time slots with a capacity,
// closed days, booking a slot with an order, rescheduling and reminders.
if (!defined('BX')) { http_response_code(403); exit; }

const DLV_WEEKDAYS = [6 => 'شنبه', 0 => 'یکشنبه', 1 => 'دوشنبه', 2 => 'سه‌شنبه', 3 => 'چهارشنبه', 4 => 'پنجشنبه', 5 => 'جمعه'];
const DLV_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// ------------------------------------------------------------------ Jalali calendar
function g2j(int $gy, int $gm, int $gd): array
{
    $g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    $gy2 = $gm > 2 ? $gy + 1 : $gy;
    $days = 355666 + (365 * $gy) + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100) + intdiv($gy2 + 399, 400) + $gd + $g_d_m[$gm - 1];
    $jy = -1595 + (33 * intdiv($days, 12053));
    $days %= 12053;
    $jy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) { $jy += intdiv($days - 1, 365); $days = ($days - 1) % 365; }
    $jm = $days < 186 ? 1 + intdiv($days, 31) : 7 + intdiv($days - 186, 30);
    $jd = 1 + ($days < 186 ? $days % 31 : ($days - 186) % 30);
    return [$jy, $jm, $jd];
}
function j2g(int $jy, int $jm, int $jd): array
{
    $jy += 1595;
    $days = -355668 + (365 * $jy) + (intdiv($jy, 33) * 8) + intdiv(($jy % 33) + 3, 4) + $jd + ($jm < 7 ? ($jm - 1) * 31 : (($jm - 7) * 30) + 186);
    $gy = 400 * intdiv($days, 146097);
    $days %= 146097;
    if ($days > 36524) { $gy += 100 * intdiv(--$days, 36524); $days %= 36524; if ($days >= 365) $days++; }
    $gy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) { $gy += intdiv($days - 1, 365); $days = ($days - 1) % 365; }
    $gd = $days + 1;
    $sal = [0, 31, (($gy % 4 === 0 && $gy % 100 !== 0) || $gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for ($gm = 1; $gm <= 12 && $gd > $sal[$gm]; $gm++) $gd -= $sal[$gm];
    return [$gy, $gm, $gd];
}
// «2026-10-08» → «چهارشنبه ۱۶ مهر»
function dlv_label(string $ymd, bool $withYear = false): string
{
    [$y, $m, $d] = array_map('intval', explode('-', $ymd));
    [$jy, $jm, $jd] = g2j($y, $m, $d);
    $wd = (int) date('w', mktime(12, 0, 0, $m, $d, $y));
    return DLV_WEEKDAYS[$wd] . ' ' . fa_digits((string) $jd) . ' ' . DLV_MONTHS[$jm - 1] . ($withYear ? ' ' . fa_digits((string) $jy) : '');
}
// Accepts «1405/07/20», «۱۴۰۵-۰۷-۲۰» or «2026-10-12»; returns Y-m-d or ''
function dlv_parse_date(string $s): string
{
    $s = trim(en_digits($s));
    if (!preg_match('/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/', $s, $m)) return '';
    [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    if ($y < 1700) [$y, $mo, $d] = j2g($y, $mo, $d);
    return checkdate($mo, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $mo, $d) : '';
}
function dlv_now(): DateTime
{
    return new DateTime('now', new DateTimeZone('Asia/Tehran'));
}

// ------------------------------------------------------------------ availability
function dlv_cfg(): array
{
    $c = setting('delivery') ?: [];
    $c['slots'] = array_values(array_filter((array) ($c['slots'] ?? []), function ($s) { return !empty($s['id']) && !empty($s['label']); }));
    $c['weekdays'] = array_map('intval', (array) ($c['weekdays'] ?? []));
    $c['closed'] = array_values(array_filter(array_map('dlv_parse_date', array_map('strval', (array) ($c['closed'] ?? [])))));
    return $c;
}
function dlv_booked(string $date, string $slot): int
{
    return (int) val("SELECT COUNT(*) FROM bookings WHERE date = ? AND slot = ? AND status <> 'cancelled'", [$date, $slot]);
}
// Days the customer can pick, starting $leadDays from today
function dlv_days(int $leadDays = 0, int $ignoreBooking = 0): array
{
    $c = dlv_cfg();
    if (empty($c['enabled'])) return [];
    $now = dlv_now();
    $lead = max((int) ($c['minDays'] ?? 0), $leadDays);
    $max = max($lead + 1, (int) ($c['maxDays'] ?? 21));
    $out = [];
    // all bookings in range at once
    $from = (clone $now)->modify("+$lead day")->format('Y-m-d');
    $to = (clone $now)->modify("+$max day")->format('Y-m-d');
    $counts = [];
    foreach (rows("SELECT date, slot, COUNT(*) n FROM bookings WHERE date BETWEEN ? AND ? AND status <> 'cancelled' AND id <> ? GROUP BY date, slot", [$from, $to, $ignoreBooking]) as $r) $counts[$r['date'] . '|' . $r['slot']] = (int) $r['n'];
    for ($i = $lead; $i <= $max; $i++) {
        $d = (clone $now)->modify("+$i day");
        $ymd = $d->format('Y-m-d');
        $wd = (int) $d->format('w');
        if (!in_array($wd, $c['weekdays'], true) || in_array($ymd, $c['closed'], true)) continue;
        $slots = [];
        foreach ($c['slots'] as $s) {
            $days = array_map('intval', (array) ($s['days'] ?? []));
            if ($days && !in_array($wd, $days, true)) continue;
            if ($i === 0 && !empty($s['from']) && $s['from'] <= $now->format('H:i')) continue; // already started today
            $cap = max(0, (int) ($s['cap'] ?? 0));
            $left = max(0, $cap - ($counts[$ymd . '|' . $s['id']] ?? 0));
            $slots[] = ['id' => (string) $s['id'], 'label' => (string) $s['label'], 'time' => fa_digits(trim(($s['from'] ?? '') . ' تا ' . ($s['to'] ?? ''), ' تا')), 'cap' => $cap, 'left' => $left];
        }
        if (!$slots) continue;
        [$jy, $jm, $jd] = g2j((int) $d->format('Y'), (int) $d->format('n'), (int) $d->format('j'));
        $out[] = ['date' => $ymd, 'label' => dlv_label($ymd), 'wd' => DLV_WEEKDAYS[$wd], 'day' => fa_digits((string) $jd), 'month' => DLV_MONTHS[$jm - 1], 'full' => !array_filter($slots, function ($s) { return $s['left'] > 0; }), 'slots' => $slots];
    }
    return $out;
}
// Validates and stores a booking for an order (call inside a transaction)
function dlv_book(int $orderId, int $userId, string $date, string $slotId, int $leadDays = 0, int $replaceId = 0): array
{
    $c = dlv_cfg();
    $slot = null;
    foreach ($c['slots'] as $s) if ((string) $s['id'] === $slotId) $slot = $s;
    $date = dlv_parse_date($date);
    if (!$slot || !$date) fail('زمان تحویل را از تقویم انتخاب کنید.', 422);
    $ok = false;
    foreach (dlv_days($leadDays, $replaceId) as $d) if ($d['date'] === $date) foreach ($d['slots'] as $s) if ($s['id'] === $slotId) $ok = $s['left'] > 0;
    // lock the slot's rows so two customers cannot take the last place together
    q("SELECT id FROM bookings WHERE date = ? AND slot = ? AND status <> 'cancelled' FOR UPDATE", [$date, $slotId]);
    if (!$ok || dlv_booked($date, $slotId) - ($replaceId && val('SELECT 1 FROM bookings WHERE id = ? AND date = ? AND slot = ?', [$replaceId, $date, $slotId]) ? 1 : 0) >= (int) $slot['cap']) {
        fail('ظرفیت این بازه تکمیل شده یا قابل انتخاب نیست؛ زمان دیگری انتخاب کنید.', 409, 'slot_full');
    }
    $label = dlv_label($date) . '، ' . $slot['label'] . (!empty($slot['from']) ? ' (' . fa_digits($slot['from'] . ' تا ' . ($slot['to'] ?? '')) . ')' : '');
    if ($replaceId) {
        update('bookings', ['date' => $date, 'slot' => $slotId, 'slot_label' => $label, 'status' => 'booked', 'reminded' => 0], 'id = ?', [$replaceId]);
        return ['id' => $replaceId, 'label' => $label];
    }
    $id = insert('bookings', ['order_id' => $orderId, 'user_id' => $userId, 'date' => $date, 'slot' => $slotId, 'slot_label' => $label, 'status' => 'booked', 'reminded' => 0, 'created_at' => now()]);
    return ['id' => $id, 'label' => $label];
}
// Days from today until the work of an order is expected to be ready (0 when ready/done)
function order_ready_in(array $o): int
{
    if (in_array($o['status'], ['awaiting', 'done', 'cancelled'], true) || empty(setting('delivery', 'afterWork'))) return 0;
    $svc = row('SELECT days FROM services WHERE id = ?', [$o['service_id']]);
    $mult = 1.0;
    foreach ((array) setting('orders', 'deadlines') as $d) if (($d['v'] ?? '') === $o['deadline']) $mult = (float) ($d['daysMult'] ?? 1);
    $ready = strtotime($o['created_at'] . ' UTC') + max(1, (int) round(((int) ($svc['days'] ?? 1)) * $mult)) * 86400;
    return max(0, (int) ceil(($ready - time()) / 86400));
}
function booking_out(?array $b): ?array
{
    if (!$b) return null;
    return ['id' => (int) $b['id'], 'date' => $b['date'], 'slot' => $b['slot'], 'label' => $b['slot_label'], 'status' => $b['status'], 'note' => (string) ($b['note'] ?? '')];
}

// ------------------------------------------------------------------ routes
function r_delivery_slots(): void
{
    $c = dlv_cfg();
    out(['enabled' => !empty($c['enabled']), 'place' => (string) ($c['place'] ?? ''), 'note' => (string) ($c['note'] ?? ''),
        'days' => dlv_days(max(0, min(120, int_in('days'))), 0)]);
}
// Customer (own order, before the change deadline) or admin moves a booking
function a_booking_change(): void
{
    $u = require_user();
    $b = row('SELECT b.*, o.user_id ouid, o.status ostatus, o.service_id, o.deadline, o.created_at ocreated FROM bookings b JOIN orders o ON o.id = b.order_id WHERE b.id = ?', [int_in('id')]);
    if (!$b || ($u['role'] !== 'admin' && (int) $b['ouid'] !== (int) $u['id'])) fail('نوبت پیدا نشد.', 404);
    if ($u['role'] !== 'admin') {
        if ($b['status'] !== 'booked') fail('این نوبت قابل تغییر نیست.', 422);
        $hours = (int) (setting('delivery', 'changeHours') ?? 24);
        $start = new DateTime($b['date'] . ' 00:00', new DateTimeZone('Asia/Tehran'));
        foreach (dlv_cfg()['slots'] as $s) if ((string) $s['id'] === $b['slot'] && !empty($s['from'])) $start = new DateTime($b['date'] . ' ' . $s['from'], new DateTimeZone('Asia/Tehran'));
        if ($start->getTimestamp() - time() < $hours * 3600) fail('تغییر زمان تا ' . fa_digits((string) $hours) . ' ساعت قبل از نوبت امکان‌پذیر است؛ با پشتیبانی تماس بگیرید.', 422);
    }
    db()->beginTransaction();
    $lead = $u['role'] === 'admin' ? 0 : order_ready_in(['status' => $b['ostatus'], 'service_id' => $b['service_id'], 'deadline' => $b['deadline'], 'created_at' => $b['ocreated']]);
    $r = dlv_book((int) $b['order_id'], (int) $b['user_id'], str_in('date', 20), str_in('slot', 20), $lead, (int) $b['id']);
    db()->commit();
    $code = (string) val('SELECT code FROM orders WHERE id = ?', [$b['order_id']]);
    if ($u['role'] === 'admin') { notify((int) $b['user_id'], "زمان تحویل سفارش $code به {$r['label']} تغییر کرد.", 'orders/' . $b['order_id']); sms_user('delivery_booked', (int) $b['user_id'], ['code' => $code, 'date' => $r['label']]); }
    else notify_admins("مشتری زمان تحویل $code را به {$r['label']} تغییر داد.", 'delivery');
    done('زمان تحویل به ' . $r['label'] . ' تغییر کرد.');
}
function a_booking_list(): void
{
    require_active('admin');
    $from = dlv_parse_date(str_in('from', 20)) ?: dlv_now()->format('Y-m-01');
    $to = dlv_parse_date(str_in('to', 20)) ?: (new DateTime($from))->modify('+42 day')->format('Y-m-d');
    $list = rows("SELECT b.*, o.code, o.title otitle, o.status ostatus, u.name, u.phone FROM bookings b JOIN orders o ON o.id = b.order_id JOIN users u ON u.id = b.user_id WHERE b.date BETWEEN ? AND ? ORDER BY b.date, b.slot, b.id", [$from, $to]);
    $c = dlv_cfg();
    out(['bookings' => array_map(function ($b) { return booking_out($b) + ['orderId' => (int) $b['order_id'], 'code' => $b['code'], 'title' => $b['otitle'], 'orderStatus' => $b['ostatus'], 'name' => $b['name'], 'phone' => $b['phone'], 'dayLabel' => dlv_label($b['date'])]; }, $list),
        'slots' => $c['slots'], 'weekdays' => $c['weekdays'], 'closed' => $c['closed'], 'enabled' => !empty($c['enabled']),
        'today' => dlv_now()->format('Y-m-d')]);
}
function a_booking_status(): void
{
    require_active('admin');
    $b = row('SELECT * FROM bookings WHERE id = ?', [int_in('id')]);
    if (!$b) fail('نوبت پیدا نشد.', 404);
    $st = str_in('status', 12);
    if (!in_array($st, ['booked', 'done', 'cancelled', 'noshow'], true)) fail('وضعیت نامعتبر است.', 422);
    update('bookings', ['status' => $st, 'note' => str_in('note', 300) ?: ($b['note'] ?? null)], 'id = ?', [$b['id']]);
    if ($st === 'cancelled') notify((int) $b['user_id'], 'نوبت تحویل شما لغو شد؛ برای انتخاب زمان جدید از صفحه سفارش اقدام کنید.', 'orders/' . $b['order_id']);
    done(['done' => 'تحویل ثبت شد.', 'cancelled' => 'نوبت لغو شد و ظرفیتش آزاد شد.', 'noshow' => 'عدم مراجعه ثبت شد.', 'booked' => 'نوبت فعال شد.'][$st]);
}
// Customer picks a time for an existing order that needs delivery but has none yet
function a_booking_create(): void
{
    $u = require_user();
    $o = row('SELECT * FROM orders WHERE id = ?', [int_in('orderId')]);
    if (!$o || ($u['role'] !== 'admin' && (int) $o['user_id'] !== (int) $u['id'])) fail('سفارش پیدا نشد.', 404);
    if (row("SELECT id FROM bookings WHERE order_id = ? AND status <> 'cancelled'", [$o['id']])) fail('این سفارش نوبت فعال دارد؛ آن را تغییر دهید.', 422);
    db()->beginTransaction();
    $r = dlv_book((int) $o['id'], (int) $o['user_id'], str_in('date', 20), str_in('slot', 20), $u['role'] === 'admin' ? 0 : order_ready_in($o));
    db()->commit();
    notify_admins("نوبت تحویل {$o['code']}: {$r['label']}", 'delivery');
    done('زمان تحویل ثبت شد: ' . $r['label']);
}

// Day-before SMS reminders (run from lazy_cron)
function dlv_reminders(): void
{
    if (!(bool) val("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bookings'")) return;
    $tomorrow = dlv_now()->modify('+1 day')->format('Y-m-d');
    foreach (rows("SELECT b.*, o.code, u.phone, u.name FROM bookings b JOIN orders o ON o.id = b.order_id JOIN users u ON u.id = b.user_id WHERE b.date = ? AND b.status = 'booked' AND b.reminded = 0 LIMIT 50", [$tomorrow]) as $b) {
        update('bookings', ['reminded' => 1], 'id = ?', [$b['id']]);
        notify((int) $b['user_id'], "یادآوری: فردا {$b['slot_label']} زمان تحویل سفارش {$b['code']} است.", 'orders/' . $b['order_id']);
        sms_notify('delivery_reminder', (string) $b['phone'], ['name' => $b['name'], 'date' => $b['slot_label']]);
    }
}
