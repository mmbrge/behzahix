<?php
// BEHIX — printable invoice / pro-forma for an order or a shop purchase.
// GET api/?r=invoice&order=ID   or   api/?r=invoice&purchase=ID   (owner or admin)
if (!defined('BX')) { http_response_code(403); exit; }

function r_invoice(): void
{
    $u = me();
    $h = function ($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); };
    $deny = function () { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('فاکتور پیدا نشد یا دسترسی ندارید؛ ابتدا وارد حساب شوید.'); };
    if (!$u) $deny();
    $admin = $u['role'] === 'admin';
    $lines = [];
    $paid = 0;
    if (!empty($_GET['order'])) {
        $o = row('SELECT * FROM orders WHERE id = ?', [(int) $_GET['order']]);
        if (!$o || (!$admin && (int) $o['user_id'] !== (int) $u['id'])) $deny();
        $buyer = row('SELECT * FROM users WHERE id = ?', [$o['user_id']]);
        $price = $o['quote'] !== null ? (int) $o['quote'] : (int) $o['estimate'];
        $svc = row('SELECT title FROM services WHERE id = ?', [$o['service_id']]);
        $lines[] = ['title' => ($svc['title'] ?? $o['service_id']) . ' — ' . $o['title'], 'qty' => 1, 'unit' => $price + (int) $o['discount'], 'off' => (int) $o['discount']];
        $paid = $o['paid'] ? $price : (int) $o['paid_amount'];
        $code = $o['code'];
        $date = $o['created_at'];
        $isFinal = $paid >= $price && $price > 0;
    } elseif (!empty($_GET['purchase'])) {
        $p = row('SELECT * FROM purchases WHERE id = ?', [(int) $_GET['purchase']]);
        if (!$p || (!$admin && (int) $p['user_id'] !== (int) $u['id'])) $deny();
        $buyer = row('SELECT * FROM users WHERE id = ?', [$p['user_id']]);
        // everything bought in the same checkout (same second) goes on one invoice
        foreach (rows('SELECT pu.*, pr.title, pr.price list FROM purchases pu LEFT JOIN products pr ON pr.id = pu.product_id WHERE pu.user_id = ? AND pu.created_at = ? ORDER BY pu.id', [$p['user_id'], $p['created_at']]) as $r) {
            $list = max((int) $r['price'], (int) ($r['list'] ?? 0));
            $lines[] = ['title' => 'فایل دیجیتال: ' . ($r['title'] ?? 'محصول'), 'qty' => 1, 'unit' => $list, 'off' => $list - (int) $r['price']];
        }
        $paid = array_sum(array_map(function ($l) { return $l['unit'] - $l['off']; }, $lines));
        $code = 'S-' . $p['id'];
        $date = $p['created_at'];
        $isFinal = true;
    } else $deny();

    $inv = setting('invoice') ?: [];
    $g = setting('general');
    $c = setting('contact');
    $sub = array_sum(array_map(function ($l) { return $l['unit'] * $l['qty']; }, $lines));
    $off = array_sum(array_column($lines, 'off'));
    $net = $sub - $off;
    $vatPct = (float) ($inv['vatPercent'] ?? 0);
    $vat = $vatPct > 0 ? (int) round($net * $vatPct / 100) : 0;
    $total = $net + $vat;
    $due = max(0, $total - $paid);
    $fa = function ($n) { return fa_digits(number_format((int) $n)); };
    $jdate = function ($dt) {
        $ts = strtotime($dt . ' UTC');
        if (class_exists('IntlDateFormatter')) {
            $f = new IntlDateFormatter('fa_IR@calendar=persian', IntlDateFormatter::MEDIUM, IntlDateFormatter::NONE, 'Asia/Tehran', IntlDateFormatter::TRADITIONAL, 'yyyy/MM/dd');
            $s = $f->format($ts);
            if ($s) return $s;
        }
        return fa_digits(date('Y/m/d', $ts));
    };
    $title = $isFinal ? 'فاکتور فروش' : 'پیش‌فاکتور';
    $seller = $inv['sellerName'] ?: ($g['siteNameFa'] ?? 'بهیکس');
    $root = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');

    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    ?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title><?= $h($title . ' ' . $code) ?></title>
<style>
  @font-face { font-family: "Vazirmatn"; src: url("<?= $h($root) ?>/assets/fonts/Vazirmatn.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Vazirmatn", Tahoma, sans-serif; background: #eef0f5; color: #15161c; font-size: 13px; line-height: 1.9; }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; justify-content: center; padding: 12px; background: #15161c; }
  .bar button, .bar a { font: inherit; font-weight: 700; padding: 8px 18px; border-radius: 999px; border: 0; cursor: pointer; background: #ff7a1a; color: #15161c; text-decoration: none; }
  .bar a { background: #2a2c35; color: #fff; }
  .bar small { color: #aaa; align-self: center; }
  .page { width: 210mm; min-height: 270mm; margin: 20px auto; padding: 14mm 14mm 12mm; background: #fff; box-shadow: 0 10px 40px -10px rgb(0 0 0 / .2); }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ff7a1a; padding-bottom: 12px; }
  .logo { font-size: 30px; font-weight: 900; letter-spacing: -1px; direction: ltr; }
  .logo span { color: #ff7a1a; }
  h1 { font-size: 20px; font-weight: 900; text-align: left; }
  .meta { text-align: left; color: #555; font-size: 12px; }
  .meta b { color: #15161c; }
  .stamp { display: inline-block; margin-top: 4px; padding: 2px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; background: <?= $isFinal ? '#dcfce7; color:#15803d' : '#fff7ed; color:#c2410c' ?>; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .party { border: 1px solid #e3e5ec; border-radius: 12px; padding: 10px 14px; }
  .party h3 { font-size: 12px; color: #ff7a1a; margin-bottom: 4px; }
  .party p { font-size: 12px; }
  .party [contenteditable] { border-bottom: 1px dashed #ccc; min-width: 80px; display: inline-block; outline: none; }
  .party [contenteditable]:empty::before { content: attr(data-ph); color: #aaa; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #15161c; color: #fff; font-weight: 700; font-size: 12px; padding: 8px; }
  td { border-bottom: 1px solid #eceef3; padding: 9px 8px; text-align: center; }
  td.t { text-align: right; }
  .sum { display: flex; justify-content: space-between; gap: 20px; margin-top: 14px; }
  .note { flex: 1; font-size: 11.5px; color: #555; border: 1px dashed #d8dbe3; border-radius: 12px; padding: 10px 14px; }
  .totals { width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 10px; }
  .totals .grand { background: #ff7a1a; color: #15161c; border-radius: 10px; font-weight: 900; font-size: 15px; margin-top: 4px; }
  .totals .due { color: #c2410c; font-weight: 800; }
  .words { margin-top: 10px; font-size: 12px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 36px; text-align: center; font-size: 12px; color: #555; }
  .sign div { border-top: 1px solid #ccc; padding-top: 6px; min-height: 70px; }
  footer { margin-top: 20px; text-align: center; font-size: 11px; color: #888; }
  @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 8mm; } @page { size: A4; margin: 6mm; } }
  @media (max-width: 820px) { .page { width: auto; margin: 10px; padding: 18px; } .parties, .sum { grid-template-columns: 1fr; flex-direction: column; } .totals { width: 100%; } }
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">چاپ / ذخیره PDF</button><a href="<?= $h($root) ?>/dashboard.html">بازگشت به پنل</a><small>مشخصات خریدار قابل ویرایش است (روی خط‌چین‌ها بنویسید)</small></div>
<div class="page">
  <header>
    <div>
      <div class="logo"><?= $h(preg_replace('/X$/', '', (string) ($g['siteName'] ?? 'BEHIX'))) ?><span><?= preg_match('/X$/', (string) ($g['siteName'] ?? 'BEHIX')) ? 'X' : '' ?></span></div>
      <div style="font-weight:700"><?= $h($seller) ?></div>
    </div>
    <div class="meta">
      <h1><?= $h($title) ?></h1>
      شماره: <b dir="ltr"><?= $h($code) ?></b><br>تاریخ: <b><?= $h($jdate($date)) ?></b><br>
      <span class="stamp"><?= $isFinal ? 'پرداخت‌شده' : ($paid ? 'پیش‌پرداخت شده' : 'در انتظار پرداخت') ?></span>
    </div>
  </header>
  <div class="parties">
    <div class="party"><h3>فروشنده</h3><p>
      <b><?= $h($seller) ?></b><br>
      <?php if (!empty($inv['economicCode'])): ?>کد اقتصادی: <?= $h(fa_digits($inv['economicCode'])) ?><br><?php endif; ?>
      <?php if (!empty($inv['nationalId'])): ?>شناسه ملی: <?= $h(fa_digits($inv['nationalId'])) ?><?= !empty($inv['regNo']) ? ' · شماره ثبت: ' . $h(fa_digits($inv['regNo'])) : '' ?><br><?php endif; ?>
      <?php $addr = $inv['address'] ?: ($c['address'] ?? ''); if ($addr): ?>نشانی: <?= $h($addr) ?><?= !empty($inv['postalCode']) ? ' · کدپستی: ' . $h(fa_digits($inv['postalCode'])) : '' ?><br><?php endif; ?>
      <?php $ph = $inv['phone'] ?: ($c['phone'] ?? ''); if ($ph): ?>تلفن: <span dir="ltr"><?= $h(fa_digits($ph)) ?></span><?php endif; ?>
    </p></div>
    <div class="party"><h3>خریدار</h3><p>
      نام: <b contenteditable="true" data-ph="نام / نام شرکت"><?= $h($buyer['name'] ?? '') ?></b><br>
      موبایل: <span dir="ltr"><?= $h(fa_digits($buyer['phone'] ?? '')) ?></span><br>
      کد/شناسه ملی یا اقتصادی: <span contenteditable="true" data-ph="اختیاری"></span><br>
      نشانی و کدپستی: <span contenteditable="true" data-ph="اختیاری"></span>
    </p></div>
  </div>
  <table>
    <thead><tr><th style="width:36px">#</th><th>شرح کالا / خدمت</th><th style="width:50px">تعداد</th><th style="width:120px">مبلغ واحد (تومان)</th><th style="width:100px">تخفیف</th><th style="width:130px">مبلغ کل (تومان)</th></tr></thead>
    <tbody>
    <?php foreach ($lines as $i => $l): ?>
      <tr><td><?= fa_digits((string) ($i + 1)) ?></td><td class="t"><?= $h($l['title']) ?></td><td><?= fa_digits((string) $l['qty']) ?></td><td><?= $fa($l['unit']) ?></td><td><?= $l['off'] ? $fa($l['off']) : '—' ?></td><td><b><?= $fa($l['unit'] * $l['qty'] - $l['off']) ?></b></td></tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <div class="sum">
    <div class="note">
      <?= $h($inv['note'] ?: 'تحویل خدمات و فایل‌ها از طریق پنل کاربری انجام می‌شود. این سند به‌صورت الکترونیکی صادر شده است.') ?>
      <?php if (!$isFinal && $due > 0): ?><br><b>برای پرداخت به پنل کاربری خود مراجعه کنید.</b><?php endif; ?>
    </div>
    <div class="totals">
      <div><span>جمع کل</span><b><?= $fa($sub) ?></b></div>
      <?php if ($off): ?><div><span>تخفیف</span><b>−<?= $fa($off) ?></b></div><?php endif; ?>
      <?php if ($vat): ?><div><span>مالیات بر ارزش افزوده (<?= fa_digits((string) $vatPct) ?>٪)</span><b><?= $fa($vat) ?></b></div><?php endif; ?>
      <div class="grand"><span>مبلغ قابل پرداخت</span><span><?= $fa($total) ?> تومان</span></div>
      <?php if ($paid && !$isFinal): ?><div><span>پرداخت‌شده</span><b><?= $fa($paid) ?></b></div><div class="due"><span>مانده</span><b><?= $fa($due) ?></b></div><?php endif; ?>
    </div>
  </div>
  <div class="sign"><div>مهر و امضای فروشنده</div><div>امضای خریدار</div></div>
  <footer><?= $h($g['siteNameFa'] ?? '') ?> · <?= $h($_SERVER['HTTP_HOST'] ?? '') ?></footer>
</div>
</body>
</html>
<?php
    exit;
}
