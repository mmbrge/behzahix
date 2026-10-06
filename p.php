<?php
// BEHIX — hosted pages made in the studio: digital business card and QR menu.
// URL: /c/<slug> (rewritten here by .htaccess). ?vcf=1 downloads the contact card.
define('BX', true);
ini_set('display_errors', '0');
require __DIR__ . '/api/lib/core.php';
require __DIR__ . '/api/lib/seo.php';

$h = 'seo_h';
$slug = strtolower(preg_replace('/[^a-z0-9-]/i', '', (string) ($_GET['s'] ?? '')));
$p = null;
try {
    if (installed() && $slug !== '') $p = row('SELECT * FROM pages WHERE slug = ?', [$slug]);
} catch (Throwable $e) { $p = null; }
// Live preview from the studio editor (nothing is stored)
$preview = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['preview']);
if ($preview) {
    $kind = ($_POST['kind'] ?? '') === 'menu' ? 'menu' : 'card';
    $p = ['id' => 0, 'kind' => $kind, 'slug' => 'preview', 'data' => (string) ($_POST['data'] ?? '{}'), 'expires_at' => gmdate('Y-m-d H:i:s', time() + 3600)];
    header('X-Robots-Tag: noindex');
}
$base = seo_base();
$site = installed() ? seo_site() : 'بهیکس';
$active = $p && $p['expires_at'] && strtotime($p['expires_at'] . ' UTC') > time();
// X PRO includes the digital card page; X PRO Business also the QR menu
if ($p && !$active && !empty($p['user_id'])) {
    try {
        $o = row('SELECT pro_until, pro_biz FROM users WHERE id = ?', [(int) $p['user_id']]);
        $active = $o && $o['pro_until'] && strtotime($o['pro_until'] . ' UTC') > time() && ($p['kind'] === 'card' || $o['pro_biz']);
    } catch (Throwable $e) { /* keep inactive */ }
}
$d = $p ? (jdec($p['data'], []) ?: []) : [];
$img = function ($id) use ($base) { return $id ? $base . '/api/index.php?r=file&id=' . rawurlencode((string) $id) : ''; };
$color = preg_match('/^#[0-9a-f]{6}$/i', (string) ($d['color'] ?? '')) ? $d['color'] : '#ff7a1a';
$dark = !empty($d['dark']);

// ---- vCard download
if ($p && $active && !$preview && $p['kind'] === 'card' && isset($_GET['vcf'])) {
    $esc = function ($v) { return str_replace([',', ';', "\n"], ['\,', '\;', '\n'], (string) $v); };
    $v = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:" . $esc($d['name'] ?? '') . "\r\nN:" . $esc($d['name'] ?? '') . ";;;;\r\n";
    if (!empty($d['company'])) $v .= 'ORG:' . $esc($d['company']) . "\r\n";
    if (!empty($d['title'])) $v .= 'TITLE:' . $esc($d['title']) . "\r\n";
    foreach (['phone' => 'TEL;TYPE=CELL', 'phone2' => 'TEL;TYPE=WORK'] as $k => $t) if (!empty($d[$k])) $v .= "$t:" . preg_replace('/[^\d+]/', '', en_digits((string) $d[$k])) . "\r\n";
    if (!empty($d['email'])) $v .= 'EMAIL:' . $esc($d['email']) . "\r\n";
    if (!empty($d['website'])) $v .= 'URL:' . $esc($d['website']) . "\r\n";
    if (!empty($d['address'])) $v .= 'ADR:;;' . $esc($d['address']) . ";;;;\r\n";
    $v .= 'NOTE:' . $esc($base . '/c/' . $p['slug']) . "\r\nEND:VCARD\r\n";
    header('Content-Type: text/vcard; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $p['slug'] . '.vcf"');
    exit($v);
}

if ($p && $active && !$preview && empty($_SERVER['HTTP_X_PURPOSE']) && !preg_match('/bot|crawl|spider|preview/i', $_SERVER['HTTP_USER_AGENT'] ?? '')) {
    try { q('UPDATE pages SET views = views + 1 WHERE id = ?', [$p['id']]); } catch (Throwable $e) {}
}
if (!$p || !$active) http_response_code($p ? 402 : 404);

$ICON = [
    'phone' => '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'map' => '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    'globe' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'link' => '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    'whatsapp' => '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2Z"/>',
    'telegram' => '<path d="M21 4 3 11l6 2.2M21 4l-3 16-7.5-6.5M21 4 9 13.2m0 0V19l3-3"/>',
    'instagram' => '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".8" fill="currentColor"/>',
    'bale' => '<path d="M12 3a9 9 0 0 0-8.4 12.2L3 21l5.8-.6A9 9 0 1 0 12 3z"/><path d="M9.5 8v8h3.2a2.1 2.1 0 0 0 0-4.2H9.5m0 0h2.6a1.9 1.9 0 0 0 0-3.8H9.5"/>',
    'linkedin' => '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    'save' => '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/>',
    'share' => '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
    'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'search' => '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
];
$ic = function ($n) use ($ICON) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' . ($ICON[$n] ?? $ICON['link']) . '</svg>'; };
$fa = function ($n) { return fa_digits(number_format((int) en_digits((string) $n))); };
$socialUrl = function ($k, $v) {
    $v = trim((string) $v);
    if ($v === '' || preg_match('#^https?://#i', $v)) return $v;
    $v = ltrim($v, '@');
    return ['instagram' => 'https://instagram.com/', 'telegram' => 'https://t.me/', 'bale' => 'https://ble.ir/', 'linkedin' => 'https://linkedin.com/in/', 'whatsapp' => 'https://wa.me/'][$k] . ($k === 'whatsapp' ? preg_replace('/^0/', '98', preg_replace('/\D/', '', en_digits($v))) : $v);
};
$safeUrl = function ($u) { $u = trim((string) $u); return preg_match('#^(https?://|tel:|mailto:)#i', $u) ? $u : ($u !== '' ? 'https://' . $u : ''); };
$title = $p ? ($p['kind'] === 'menu' ? ($d['name'] ?? 'منو') . ' | منوی آنلاین' : ($d['name'] ?? 'کارت ویزیت') . (!empty($d['title']) ? ' — ' . $d['title'] : '')) : 'صفحه پیدا نشد';
?><!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= $h($title) ?></title>
<meta name="description" content="<?= $h(seo_cut((string) ($d['bio'] ?? $d['intro'] ?? $title), 160)) ?>">
<meta property="og:title" content="<?= $h($title) ?>">
<?php if (!empty($d['avatar']) || !empty($d['logo'])): ?><meta property="og:image" content="<?= $h($img($d['avatar'] ?? $d['logo'])) ?>"><?php endif; ?>
<meta name="theme-color" content="<?= $h($color) ?>">
<?php if (!$p || !$active): ?><meta name="robots" content="noindex"><?php endif; ?>
<style>
@font-face { font-family: V; src: url("<?= $h($base) ?>/assets/fonts/Vazirmatn.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
:root { --c: <?= $h($color) ?>; --bg: <?= $dark ? '#0b0c10' : '#f4f5f8' ?>; --card: <?= $dark ? '#15171e' : '#fff' ?>; --fg: <?= $dark ? '#f3f4f6' : '#15161c' ?>; --mut: <?= $dark ? '#a3a8b6' : '#6b7080' ?>; --line: <?= $dark ? 'rgb(255 255 255 / .08)' : 'rgb(0 0 0 / .07)' ?>; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: V, Tahoma, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.8; min-height: 100vh; -webkit-tap-highlight-color: transparent; }
a { color: inherit; text-decoration: none; }
.i { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.wrap { max-width: 520px; margin: 0 auto; padding: 0 16px 40px; }
.foot { text-align: center; font-size: .75rem; color: var(--mut); padding: 26px 0 10px; }
.foot a { color: var(--c); font-weight: 700; }
/* card */
.cover { height: 170px; background: linear-gradient(135deg, var(--c), color-mix(in srgb, var(--c) 55%, #000)); border-radius: 0 0 32px 32px; margin: 0 -16px; position: relative; overflow: hidden; }
.cover::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 20% 20%, rgb(255 255 255 / .25), transparent 50%); }
.prof { background: var(--card); border-radius: 26px; margin-top: -70px; position: relative; padding: 70px 20px 22px; text-align: center; box-shadow: 0 20px 50px -25px rgb(0 0 0 / .35); }
.ava { position: absolute; top: -58px; left: 50%; translate: -50% 0; width: 116px; height: 116px; border-radius: 50%; border: 5px solid var(--card); background: var(--c) center/cover; display: grid; place-items: center; color: #fff; font-size: 2.6rem; font-weight: 900; }
.prof h1 { font-size: 1.45rem; font-weight: 900; }
.prof .role { color: var(--c); font-weight: 700; font-size: .95rem; }
.prof .bio { color: var(--mut); font-size: .88rem; margin-top: 8px; }
.acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; margin-top: 18px; }
.acts a { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px; border-radius: 16px; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); font-size: .72rem; font-weight: 700; }
.list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.list a, .list div { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; background: var(--card); border: 1px solid var(--line); font-size: .9rem; font-weight: 600; }
.list .i { color: var(--c); }
.list small { color: var(--mut); font-weight: 400; display: block; font-size: .75rem; }
.save { display: flex; gap: 8px; margin-top: 16px; }
.save a, .save button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 18px; border: 0; font: inherit; font-weight: 800; cursor: pointer; background: var(--c); color: #fff; }
.save button { background: var(--card); color: var(--fg); border: 1px solid var(--line); flex: 0 0 auto; padding: 14px 18px; }
/* menu */
.mhead { padding: 26px 0 14px; text-align: center; }
.mlogo { width: 84px; height: 84px; border-radius: 24px; margin: 0 auto 10px; background: var(--c) center/cover; display: grid; place-items: center; color: #fff; font-size: 2rem; font-weight: 900; box-shadow: 0 14px 30px -12px color-mix(in srgb, var(--c) 70%, transparent); }
.mhead h1 { font-size: 1.5rem; font-weight: 900; }
.mhead p { color: var(--mut); font-size: .85rem; }
.minfo { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; font-size: .78rem; color: var(--mut); margin-top: 8px; }
.minfo span, .minfo a { display: inline-flex; align-items: center; gap: 4px; }
.minfo .i { width: 15px; height: 15px; color: var(--c); }
.tabs { position: sticky; top: 0; z-index: 3; display: flex; gap: 6px; overflow-x: auto; padding: 10px 0; background: var(--bg); scrollbar-width: none; }
.tabs a { flex-shrink: 0; padding: 7px 14px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: .82rem; font-weight: 700; }
.tabs a.on { background: var(--c); color: #fff; border-color: var(--c); }
.msearch { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); margin-bottom: 6px; }
.msearch input { flex: 1; border: 0; background: none; font: inherit; color: var(--fg); outline: none; }
.cat { padding-top: 14px; scroll-margin-top: 60px; }
.cat h2 { font-size: 1.1rem; font-weight: 900; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.cat h2::before { content: ""; width: 6px; height: 20px; border-radius: 3px; background: var(--c); }
.item { display: flex; gap: 12px; padding: 12px; border-radius: 18px; background: var(--card); border: 1px solid var(--line); margin-bottom: 8px; }
.item.off { opacity: .45; }
.item .ph { width: 76px; height: 76px; border-radius: 14px; background: var(--line) center/cover; flex-shrink: 0; }
.item .b { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.item b { font-size: .95rem; }
.item p { color: var(--mut); font-size: .78rem; line-height: 1.7; }
.item .pr { margin-top: auto; color: var(--c); font-weight: 900; font-size: .95rem; }
.item .pr small { font-weight: 500; color: var(--mut); font-size: .72rem; }
.badge { display: inline-block; font-size: .65rem; padding: 1px 8px; border-radius: 999px; background: color-mix(in srgb, var(--c) 15%, transparent); color: var(--c); margin-right: 4px; vertical-align: 2px; }
.off-note { color: #dc2626; font-size: .72rem; font-weight: 700; }
/* inactive */
.na { min-height: 80vh; display: grid; place-items: center; text-align: center; padding: 30px; }
.na h1 { font-size: 1.3rem; margin-bottom: 8px; }
.na p { color: var(--mut); }
.na a { display: inline-block; margin-top: 16px; padding: 10px 20px; border-radius: 999px; background: var(--c); color: #fff; font-weight: 700; }
</style>
</head>
<body>
<?php if (!$p || !$active): ?>
<div class="na"><div><h1><?= $p ? 'این صفحه موقتاً غیرفعال است' : 'صفحه پیدا نشد' ?></h1><p><?= $p ? 'اشتراک این صفحه به پایان رسیده است.' : 'آدرس را بررسی کنید.' ?></p><a href="<?= $h($base) ?>/studio.html">ساخت صفحه اختصاصی در <?= $h($site) ?></a></div></div>
<?php elseif ($p['kind'] === 'card'):
    $name = (string) ($d['name'] ?? '');
    $phone = en_digits((string) ($d['phone'] ?? ''));
?>
<div class="wrap">
  <div class="cover"></div>
  <section class="prof">
    <div class="ava" <?= !empty($d['avatar']) ? 'style="background-image:url(\'' . $h($img($d['avatar'])) . '\')"' : '' ?>><?= empty($d['avatar']) ? $h(mb_substr($name, 0, 1)) : '' ?></div>
    <h1><?= $h($name) ?></h1>
    <?php if (!empty($d['title']) || !empty($d['company'])): ?><p class="role"><?= $h(trim(($d['title'] ?? '') . (!empty($d['company']) ? ' · ' . $d['company'] : ''), ' ·')) ?></p><?php endif; ?>
    <?php if (!empty($d['bio'])): ?><p class="bio"><?= nl2br($h($d['bio'])) ?></p><?php endif; ?>
    <div class="acts">
      <?php if ($phone): ?><a href="tel:<?= $h($phone) ?>"><?= $ic('phone') ?>تماس</a><?php endif; ?>
      <?php if (!empty($d['whatsapp']) || $phone): ?><a href="<?= $h($socialUrl('whatsapp', $d['whatsapp'] ?? $phone)) ?>" target="_blank" rel="noopener"><?= $ic('whatsapp') ?>واتساپ</a><?php endif; ?>
      <?php if (!empty($d['email'])): ?><a href="mailto:<?= $h($d['email']) ?>"><?= $ic('mail') ?>ایمیل</a><?php endif; ?>
      <?php if (!empty($d['map']) || !empty($d['address'])): ?><a href="<?= $h(!empty($d['map']) ? $safeUrl($d['map']) : 'https://www.google.com/maps/search/' . rawurlencode($d['address'])) ?>" target="_blank" rel="noopener"><?= $ic('map') ?>مسیر</a><?php endif; ?>
    </div>
  </section>
  <div class="save"><a href="?vcf=1"><?= $ic('save') ?> ذخیره در مخاطبین</a><button type="button" onclick="navigator.share?navigator.share({title:document.title,url:location.href}):navigator.clipboard.writeText(location.href).then(()=>alert('لینک کپی شد'))" aria-label="اشتراک‌گذاری"><?= $ic('share') ?></button></div>
  <div class="list">
    <?php foreach (['instagram' => 'اینستاگرام', 'telegram' => 'تلگرام', 'bale' => 'بله', 'linkedin' => 'لینکدین'] as $k => $l): if (empty($d[$k])) continue; ?>
      <a href="<?= $h($socialUrl($k, $d[$k])) ?>" target="_blank" rel="noopener"><?= $ic($k) ?><span><?= $l ?><small dir="ltr"><?= $h(ltrim(preg_replace('#^https?://(www\.)?[^/]+/#', '', (string) $d[$k]), '@')) ?></small></span></a>
    <?php endforeach; ?>
    <?php if (!empty($d['website'])): ?><a href="<?= $h($safeUrl($d['website'])) ?>" target="_blank" rel="noopener"><?= $ic('globe') ?><span>وب‌سایت<small dir="ltr"><?= $h(preg_replace('#^https?://#', '', $d['website'])) ?></small></span></a><?php endif; ?>
    <?php foreach ((array) ($d['links'] ?? []) as $l): if (empty($l['url']) || empty($l['label'])) continue; ?>
      <a href="<?= $h($safeUrl($l['url'])) ?>" target="_blank" rel="noopener"><?= $ic('link') ?><span><?= $h($l['label']) ?></span></a>
    <?php endforeach; ?>
    <?php if (!empty($d['phone2'])): ?><a href="tel:<?= $h(en_digits($d['phone2'])) ?>"><?= $ic('phone') ?><span>تلفن ثابت<small dir="ltr"><?= $h(fa_digits($d['phone2'])) ?></small></span></a><?php endif; ?>
    <?php if (!empty($d['address'])): ?><div><?= $ic('map') ?><span><?= $h($d['address']) ?></span></div><?php endif; ?>
  </div>
  <p class="foot">ساخته‌شده با <a href="<?= $h($base) ?>/studio.html"><?= $h($site) ?></a> — کارت ویزیت دیجیتال خودتان را بسازید</p>
</div>
<?php else:
    $cats = array_values(array_filter((array) ($d['cats'] ?? []), function ($c) { return !empty($c['title']); }));
?>
<div class="wrap">
  <header class="mhead">
    <div class="mlogo" <?= !empty($d['logo']) ? 'style="background-image:url(\'' . $h($img($d['logo'])) . '\')"' : '' ?>><?= empty($d['logo']) ? $h(mb_substr((string) ($d['name'] ?? ''), 0, 1)) : '' ?></div>
    <h1><?= $h($d['name'] ?? '') ?></h1>
    <?php if (!empty($d['intro'])): ?><p><?= $h($d['intro']) ?></p><?php endif; ?>
    <div class="minfo">
      <?php if (!empty($d['hours'])): ?><span><?= $ic('clock') ?><?= $h($d['hours']) ?></span><?php endif; ?>
      <?php if (!empty($d['phone'])): ?><a href="tel:<?= $h(en_digits($d['phone'])) ?>"><?= $ic('phone') ?><span dir="ltr"><?= $h(fa_digits($d['phone'])) ?></span></a><?php endif; ?>
      <?php if (!empty($d['address'])): ?><span><?= $ic('map') ?><?= $h($d['address']) ?></span><?php endif; ?>
      <?php if (!empty($d['instagram'])): ?><a href="<?= $h($socialUrl('instagram', $d['instagram'])) ?>" target="_blank" rel="noopener"><?= $ic('instagram') ?>اینستاگرام</a><?php endif; ?>
    </div>
  </header>
  <?php if (count($cats) > 1): ?><nav class="tabs"><?php foreach ($cats as $i => $c): ?><a href="#c<?= $i ?>" class="<?= $i ? '' : 'on' ?>"><?= $h($c['title']) ?></a><?php endforeach; ?></nav><?php endif; ?>
  <label class="msearch"><?= $ic('search') ?><input type="search" placeholder="جستجو در منو…" oninput="q(this.value)"></label>
  <?php foreach ($cats as $i => $c): ?>
  <section class="cat" id="c<?= $i ?>"><h2><?= $h($c['title']) ?></h2>
    <?php foreach ((array) ($c['items'] ?? []) as $it): if (empty($it['name'])) continue; $off = !empty($it['off']); ?>
    <div class="item<?= $off ? ' off' : '' ?>" data-n="<?= $h(mb_strtolower($it['name'] . ' ' . ($it['desc'] ?? ''))) ?>">
      <?php if (!empty($it['img'])): ?><span class="ph" style="background-image:url('<?= $h($img($it['img'])) ?>')"></span><?php endif; ?>
      <div class="b"><b><?= $h($it['name']) ?><?php if (!empty($it['tag'])): ?><span class="badge"><?= $h($it['tag']) ?></span><?php endif; ?></b>
        <?php if (!empty($it['desc'])): ?><p><?= $h($it['desc']) ?></p><?php endif; ?>
        <span class="pr"><?= $off ? '<span class="off-note">ناموجود</span>' : ((string) ($it['price'] ?? '') !== '' ? $fa($it['price']) . ' <small>' . $h($d['unit'] ?? 'تومان') . '</small>' : '') ?></span></div>
    </div>
    <?php endforeach; ?>
  </section>
  <?php endforeach; ?>
  <p class="foot">منوی دیجیتال ساخته‌شده با <a href="<?= $h($base) ?>/studio.html"><?= $h($site) ?></a></p>
</div>
<script>
function q(v){v=v.trim().toLowerCase();document.querySelectorAll(".item").forEach(function(e){e.style.display=!v||e.dataset.n.indexOf(v)>-1?"":"none"});document.querySelectorAll(".cat").forEach(function(c){c.style.display=[].some.call(c.querySelectorAll(".item"),function(e){return e.style.display!=="none"})?"":"none"})}
var tabs=document.querySelectorAll(".tabs a");if(tabs.length&&"IntersectionObserver"in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){tabs.forEach(function(t){t.classList.toggle("on",t.getAttribute("href")==="#"+e.target.id)});var on=document.querySelector(".tabs a.on");on&&on.scrollIntoView({inline:"center",block:"nearest"})}})},{rootMargin:"-40% 0px -55% 0px"});document.querySelectorAll(".cat").forEach(function(c){io.observe(c)})}
</script>
<?php endif; ?>
</body>
</html>
