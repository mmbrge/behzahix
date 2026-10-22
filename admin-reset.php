<?php
// BEHIX — admin account recovery (forgotten phone number or password).
// Works only while the file api/reset-admin.txt exists: create it from the
// hosting file manager (that proves you own the server), open this page,
// set the new phone/password. The file is deleted afterwards and is ignored
// once it is more than one hour old.
define('BX', true);
ini_set('display_errors', '0');
session_start();
require __DIR__ . '/api/lib/core.php';

$flag = __DIR__ . '/api/reset-admin.txt';
$h = function ($s) { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); };
$state = 'off';
$msg = '';
$admins = [];
if (is_file($flag) && filemtime($flag) > time() - 3600 && installed()) {
    $state = 'form';
    if (empty($_SESSION['ar'])) $_SESSION['ar'] = bin2hex(random_bytes(16));
    try { $admins = rows("SELECT id, name, phone FROM users WHERE role = 'admin' ORDER BY id"); } catch (Throwable $e) { $state = 'off'; }
    if ($state === 'form' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        $phone = en_digits((string) ($_POST['phone'] ?? ''));
        $phone = preg_replace('/\D/', '', $phone);
        if (strlen($phone) === 10 && $phone[0] === '9') $phone = '0' . $phone;
        $pass = (string) ($_POST['password'] ?? '');
        $id = (int) ($_POST['id'] ?? 0);
        $target = null;
        foreach ($admins as $a) if ((int) $a['id'] === $id) $target = $a;
        if (!hash_equals($_SESSION['ar'], (string) ($_POST['t'] ?? ''))) $msg = 'نشست منقضی شده است؛ صفحه را دوباره باز کنید.';
        elseif (!$target) $msg = 'حساب مدیر را انتخاب کنید.';
        elseif (!preg_match('/^09\d{9}$/', $phone)) $msg = 'شماره موبایل معتبر نیست (مثلاً 09121234567).';
        elseif (strlen($pass) < 8) $msg = 'رمز عبور حداقل ۸ کاراکتر باشد.';
        elseif (row("SELECT id FROM users WHERE phone = ? AND role = 'admin' AND id <> ?", [$phone, $id])) $msg = 'این شماره برای حساب مدیر دیگری ثبت شده است.';
        else {
            update('users', ['phone' => $phone, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'status' => 'active', 'session_ver' => random_int(1, 2000000000)], 'id = ?', [$id]);
            if (function_exists('sec_log')) { try { sec_log('admin_action', 'بازیابی حساب مدیر با admin-reset.php', $id); } catch (Throwable $e) {} }
            $removed = @unlink($flag);
            unset($_SESSION['ar']);
            $state = 'done';
            $msg = $removed ? '' : 'فایل api/reset-admin.txt حذف نشد؛ حتماً خودتان آن را پاک کنید.';
        }
    }
}
?><!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>بازیابی حساب مدیر</title>
<link rel="stylesheet" href="assets/css/style.css"><link rel="stylesheet" href="assets/css/pages.css">
<style>.ar { max-width: 560px; margin: 40px auto; padding: 0 16px; } .ar .card { padding: 26px; } .ar h1 { font-size: 1.4rem; font-weight: 900; } .ar ol { margin: 12px 20px 0 0; display: grid; gap: 8px; line-height: 2; list-style: persian; } code { direction: ltr; display: inline-block; }
.err { padding: 12px 16px; border-radius: 14px; background: rgb(248 113 113 / .1); border: 1px solid rgb(248 113 113 / .4); margin-top: 14px; } .admins li { padding: 10px 14px; border-radius: 12px; background: var(--hover); margin-top: 6px; }</style>
</head>
<body>
<main class="ar"><div class="card glow">
  <h1>بازیابی حساب مدیر</h1>
<?php if ($state === 'off'): ?>
  <p class="muted lh mt-2">این صفحه برای امنیت خاموش است. برای بازیابی شماره یا رمز مدیر:</p>
  <ol>
    <li>وارد cPanel (یا DirectAdmin) هاست شوید و <b>File Manager</b> را باز کنید.</li>
    <li>در پوشه سایت، وارد پوشه <code>api</code> شوید و یک فایل خالی با نام <code>reset-admin.txt</code> بسازید.</li>
    <li>همین صفحه را رفرش کنید (تا یک ساعت فعال می‌ماند).</li>
  </ol>
<?php elseif ($state === 'form'): ?>
  <p class="muted lh mt-2">حساب‌های مدیر سایت (نام کاربری ورود = شماره موبایل):</p>
  <ul class="admins"><?php foreach ($admins as $a): ?><li><b><?= $h($a['name']) ?></b> — <span dir="ltr"><?= $h(fa_digits($a['phone'])) ?></span></li><?php endforeach; ?></ul>
  <p class="muted small lh mt-2">اگر فقط شماره را فراموش کرده بودید، همین شماره بالا را در صفحه ورود بزنید. برای تغییر شماره یا رمز فرم زیر را پر کنید.</p>
  <?php if ($msg): ?><div class="err"><?= $h($msg) ?></div><?php endif; ?>
  <form method="post" class="form-grid mt-2" autocomplete="off">
    <input type="hidden" name="t" value="<?= $h($_SESSION['ar']) ?>">
    <div class="field"><label class="field-label" for="id">حساب</label><select class="select" id="id" name="id"><?php foreach ($admins as $a): ?><option value="<?= (int) $a['id'] ?>"><?= $h($a['name']) ?> (<?= $h($a['phone']) ?>)</option><?php endforeach; ?></select></div>
    <div class="field"><label class="field-label" for="phone">شماره موبایل جدید (نام کاربری)</label><input class="input" id="phone" name="phone" dir="ltr" type="tel" placeholder="09xxxxxxxxx" required></div>
    <div class="field"><label class="field-label" for="password">رمز عبور جدید (حداقل ۸ کاراکتر)</label><input class="input" id="password" name="password" type="password" dir="ltr" autocomplete="new-password" required></div>
    <button class="btn btn-primary btn-block" type="submit">ذخیره و ورود</button>
  </form>
<?php else: ?>
  <p class="lh mt-2">✓ شماره و رمز حساب مدیر به‌روز شد. همه نشست‌های قبلی این حساب هم خارج شدند.</p>
  <?php if ($msg): ?><div class="err"><?= $h($msg) ?></div><?php endif; ?>
  <p class="mt-2"><a class="btn btn-primary" href="auth.html?next=dashboard.html">ورود به پنل</a></p>
<?php endif; ?>
</div></main>
</body>
</html>
