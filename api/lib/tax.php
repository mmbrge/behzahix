<?php
// BEHIX — VAT (مالیات بر ارزش افزوده) ledger and report.
// Iranian VAT law (قانون مالیات بر ارزش افزوده مصوب ۱۴۰۰، اجرا از ۱۴۰۲/۰۱/۰۱): general
// rate 9%; the 1403 budget law raised it to 10%. Only businesses registered in the VAT
// system (مؤدیان ثبت‌نام‌شده) may charge it, and their invoices go to «سامانه مودیان».
// Site prices are treated as VAT-inclusive: VAT = amount × r ÷ (100 + r).
// Every sale is written to tax_ledger when it happens (orders, shop, studio, X PRO,
// hosted pages, gateway fees); refunds are negative rows. Settings → Tax holds the rate
// history, so a new rate from a given date is just one more line.
if (!defined('BX')) { http_response_code(403); exit; }

// ---- Jalali ⇄ Gregorian (standard arithmetic conversion)
function jalali_to_gregorian(int $jy, int $jm, int $jd): array
{
    $jy += 1595;
    $days = -355668 + (365 * $jy) + (intdiv($jy, 33) * 8) + intdiv((($jy % 33) + 3), 4) + $jd + (($jm < 7) ? ($jm - 1) * 31 : (($jm - 7) * 30) + 186);
    $gy = 400 * intdiv($days, 146097);
    $days %= 146097;
    if ($days > 36524) { $gy += 100 * intdiv(--$days, 36524); $days %= 36524; if ($days >= 365) $days++; }
    $gy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) { $gy += intdiv(($days - 1), 365); $days = ($days - 1) % 365; }
    $gd = $days + 1;
    $sal = [0, 31, (($gy % 4 === 0 && $gy % 100 !== 0) || ($gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for ($gm = 0; $gm < 13 && $gd > $sal[$gm]; $gm++) $gd -= $sal[$gm];
    return [$gy, $gm, $gd];
}
function gregorian_to_jalali(int $gy, int $gm, int $gd): array
{
    $g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    $gy2 = ($gm > 2) ? ($gy + 1) : $gy;
    $days = 355666 + (365 * $gy) + intdiv(($gy2 + 3), 4) - intdiv(($gy2 + 99), 100) + intdiv(($gy2 + 399), 400) + $gd + $g_d_m[$gm - 1];
    $jy = -1595 + (33 * intdiv($days, 12053));
    $days %= 12053;
    $jy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) { $jy += intdiv(($days - 1), 365); $days = ($days - 1) % 365; }
    $jm = ($days < 186) ? 1 + intdiv($days, 31) : 7 + intdiv(($days - 186), 30);
    $jd = 1 + (($days < 186) ? ($days % 31) : (($days - 186) % 30));
    return [$jy, $jm, $jd];
}
// UTC datetime → Tehran «۱۴۰۵/۰۸/۰۷ ۱۴:۳۵» parts
function tax_local(string $utc): array
{
    $d = new DateTime($utc, new DateTimeZone('UTC'));
    $d->setTimezone(new DateTimeZone('Asia/Tehran'));
    [$jy, $jm, $jd] = gregorian_to_jalali((int) $d->format('Y'), (int) $d->format('n'), (int) $d->format('j'));
    return ['date' => sprintf('%04d/%02d/%02d', $jy, $jm, $jd), 'time' => $d->format('H:i'), 'jy' => $jy, 'jm' => $jm];
}
// «۱۴۰۳/۰۱/۰۱» (Tehran) → UTC «2024-03-19 20:30:00»
function tax_utc(string $jalali, bool $endOfDay = false): ?string
{
    if (!preg_match('#^(\d{4})/(\d{1,2})/(\d{1,2})$#', trim(en_digits($jalali)), $m)) return null;
    [$gy, $gm, $gd] = jalali_to_gregorian((int) $m[1], (int) $m[2], (int) $m[3]);
    $d = new DateTime(sprintf('%04d-%02d-%02d %s', $gy, $gm, $gd, $endOfDay ? '23:59:59' : '00:00:00'), new DateTimeZone('Asia/Tehran'));
    $d->setTimezone(new DateTimeZone('UTC'));
    return $d->format('Y-m-d H:i:s');
}

// ---- rates
// Settings → Tax «rates»: lines «from (Jalali) | percent», e.g. «1403/01/01 | 10»
function tax_rates(): array
{
    $out = [];
    foreach ((array) setting('tax', 'rates') as $line) {
        $parts = array_map('trim', explode('|', en_digits((string) $line)));
        if (count($parts) < 2 || !($from = tax_utc($parts[0]))) continue;
        $out[] = [$from, max(0.0, min(100.0, (float) $parts[1])), $parts[0]];
    }
    usort($out, function ($a, $b) { return strcmp($a[0], $b[0]); });
    return $out;
}
// Rate (%) in force at a UTC datetime; 0 when the business is not registered for VAT
function tax_rate_at(string $utc): float
{
    if (empty(setting('tax', 'enabled'))) return 0.0;
    $r = 0.0;
    foreach (tax_rates() as [$from, $pct]) if ($from <= $utc) $r = $pct;
    return $r;
}
function tax_split(int $amount, float $rate): array
{
    $vat = $rate > 0 ? (int) round($amount * $rate / (100 + $rate)) : 0;
    return [$amount - $vat, $vat];
}

// ---- ledger
function tax_kind_of(string $type, string $note): string
{
    if ($type === 'refund') return 'refund';
    if (strpos($note, 'استودیو') === 0) return 'studio';
    if (strpos($note, 'اشتراک') === 0) return mb_strpos($note, 'صفحه') !== false || mb_strpos($note, 'کارت ویزیت') !== false || mb_strpos($note, 'منو') !== false ? 'page' : 'pro';
    if (strpos($note, 'خرید ') === 0) return 'shop';
    return 'order';
}
// Called from tx() for sales (payment / purchase) and refunds, and for gateway fees
function tax_record(string $kind, int $uid, int $amount, string $title, string $code = '', ?string $at = null): void
{
    if ($amount === 0 || !table_exists('tax_ledger')) return;
    $at = $at ?: now();
    $rate = tax_rate_at($at);
    [$net, $vat] = tax_split($amount, $rate);
    insert('tax_ledger', ['kind' => $kind, 'user_id' => $uid ?: null, 'code' => mb_substr($code, 0, 40) ?: null, 'title' => mb_substr($title, 0, 250),
        'amount' => $amount, 'net' => $net, 'vat' => $vat, 'rate' => $rate, 'created_at' => $at]);
}
function tax_code_from(string $note): string
{
    return preg_match('/\b([A-Z]{1,3}-\d{2,})\b/', $note, $m) ? $m[1] : '';
}
// Fills the ledger from the existing transactions (first run / «ساخت دوباره»)
function tax_backfill(): int
{
    $n = 0;
    foreach (rows("SELECT * FROM transactions WHERE (type IN ('payment', 'purchase') AND amount < 0) OR type = 'refund' ORDER BY id") as $t) {
        $amount = $t['type'] === 'refund' ? -abs((int) $t['amount']) : abs((int) $t['amount']);
        tax_record(tax_kind_of($t['type'], (string) $t['note']), (int) $t['user_id'], $amount, (string) $t['note'], tax_code_from((string) $t['note']), $t['created_at']);
        $n++;
    }
    foreach (rows("SELECT * FROM payments WHERE status = 'paid' AND fee > 0 ORDER BY id") as $p) {
        tax_record('fee', (int) $p['user_id'], (int) $p['fee'], 'کارمزد درگاه پرداخت', 'P-' . $p['id'], $p['created_at']);
        $n++;
    }
    return $n;
}

const TAX_KINDS = ['order' => 'سفارش خدمات', 'shop' => 'فروشگاه', 'studio' => 'استودیو', 'page' => 'صفحه میزبانی', 'pro' => 'اشتراک X PRO', 'fee' => 'کارمزد درگاه', 'refund' => 'بازگشت وجه'];

function tax_filter(): array
{
    $w = ['1 = 1']; $a = [];
    if ($from = tax_utc(str_in('from', 12))) { $w[] = 'l.created_at >= ?'; $a[] = $from; }
    if ($to = tax_utc(str_in('to', 12), true)) { $w[] = 'l.created_at <= ?'; $a[] = $to; }
    $kind = str_in('kind', 12);
    if (isset(TAX_KINDS[$kind])) { $w[] = 'l.kind = ?'; $a[] = $kind; }
    if (!in('fees', true)) $w[] = "l.kind <> 'fee'";
    return [implode(' AND ', $w), $a];
}
function tax_rows_out(array $rows): array
{
    return array_map(function ($r) {
        $l = tax_local($r['created_at']);
        return ['id' => (int) $r['id'], 'kind' => $r['kind'], 'kindTitle' => TAX_KINDS[$r['kind']] ?? $r['kind'], 'code' => (string) $r['code'], 'title' => $r['title'],
            'customer' => (string) ($r['uname'] ?? ''), 'phone' => (string) ($r['uphone'] ?? ''), 'date' => $l['date'], 'time' => $l['time'],
            'amount' => (int) $r['amount'], 'net' => (int) $r['net'], 'vat' => (int) $r['vat'], 'rate' => (float) $r['rate']];
    }, $rows);
}
function a_tax_report(): void
{
    require_staff('finance');
    if (!(int) val('SELECT COUNT(*) FROM tax_ledger') && (int) val("SELECT COUNT(*) FROM transactions WHERE type IN ('payment','purchase','refund')")) tax_backfill();
    [$w, $a] = tax_filter();
    $sum = row("SELECT COUNT(*) n, COALESCE(SUM(amount),0) amount, COALESCE(SUM(net),0) net, COALESCE(SUM(vat),0) vat FROM tax_ledger l WHERE $w", $a);
    $byKind = rows("SELECT kind, COUNT(*) n, SUM(amount) amount, SUM(vat) vat FROM tax_ledger l WHERE $w GROUP BY kind", $a);
    $list = rows("SELECT l.*, u.name uname, u.phone uphone FROM tax_ledger l LEFT JOIN users u ON u.id = l.user_id WHERE $w ORDER BY l.created_at DESC, l.id DESC LIMIT 500", $a);
    $now = tax_local(now());
    out(['rows' => tax_rows_out($list), 'total' => ['count' => (int) $sum['n'], 'amount' => (int) $sum['amount'], 'net' => (int) $sum['net'], 'vat' => (int) $sum['vat']],
        'byKind' => array_map(function ($k) { return ['kind' => $k['kind'], 'title' => TAX_KINDS[$k['kind']] ?? $k['kind'], 'count' => (int) $k['n'], 'amount' => (int) $k['amount'], 'vat' => (int) $k['vat']]; }, $byKind),
        'enabled' => !empty(setting('tax', 'enabled')), 'rateNow' => tax_rate_at(now()), 'kinds' => TAX_KINDS, 'today' => $now['date'],
        'rates' => array_map(function ($r) { return ['from' => $r[2], 'rate' => $r[1]]; }, tax_rates())]);
}
// Excel-friendly CSV (UTF-8 with BOM) of the filtered rows
function a_tax_export(): void
{
    require_staff('finance');
    [$w, $a] = tax_filter();
    $list = tax_rows_out(rows("SELECT l.*, u.name uname, u.phone uphone FROM tax_ledger l LEFT JOIN users u ON u.id = l.user_id WHERE $w ORDER BY l.created_at, l.id", $a));
    $esc = function ($v) { $v = (string) $v; return preg_match('/[",\n\r]/', $v) ? '"' . str_replace('"', '""', $v) . '"' : $v; };
    $out = "\xEF\xBB\xBF" . implode(',', ['ردیف', 'تاریخ', 'ساعت', 'نوع', 'کد سفارش', 'شرح', 'مشتری', 'موبایل', 'مبلغ کل (تومان)', 'مبلغ بدون مالیات', 'نرخ مالیات (٪)', 'مالیات بر ارزش افزوده']) . "\r\n";
    $t = ['amount' => 0, 'net' => 0, 'vat' => 0];
    foreach ($list as $i => $r) {
        $out .= implode(',', array_map($esc, [$i + 1, $r['date'], $r['time'], $r['kindTitle'], $r['code'], $r['title'], $r['customer'], $r['phone'], $r['amount'], $r['net'], $r['rate'], $r['vat']])) . "\r\n";
        foreach ($t as $k => $v) $t[$k] += $r[$k];
    }
    $out .= implode(',', array_map($esc, ['', '', '', '', '', 'جمع', '', '', $t['amount'], $t['net'], '', $t['vat']])) . "\r\n";
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: text/csv; charset=utf-8');
    $f = preg_replace('/\D/', '', en_digits(str_in('from', 12))) ?: 'all';
    $t2 = preg_replace('/\D/', '', en_digits(str_in('to', 12))) ?: 'now';
    header('Content-Disposition: attachment; filename="behix-vat-' . $f . '-' . $t2 . '.csv"');
    header('Cache-Control: private, no-store');
    echo $out;
    exit;
}
// Recompute VAT of the filtered rows with the current settings (e.g. after registering
// for VAT late, or when a new rate is entered with an earlier start date)
function a_tax_recalc(): void
{
    require_staff('finance');
    [$w, $a] = tax_filter();
    $n = 0;
    foreach (rows("SELECT * FROM tax_ledger l WHERE $w", $a) as $r) {
        $rate = tax_rate_at($r['created_at']);
        [$net, $vat] = tax_split((int) $r['amount'], $rate);
        update('tax_ledger', ['rate' => $rate, 'net' => $net, 'vat' => $vat], 'id = ?', [$r['id']]);
        $n++;
    }
    done(fa_digits((string) $n) . ' ردیف با نرخ‌های فعلی دوباره محاسبه شد.');
}
