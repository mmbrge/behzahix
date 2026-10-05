<?php
// BEHIX — SEO: per-page meta, structured data (JSON-LD), server-rendered
// content for crawlers (services, products, blog), sitemap, robots and feeds.
if (!defined('BX')) { http_response_code(403); exit; }

function seo_h($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}
function seo_base(): string
{
    $c = bx_config();
    if (!empty($c['url'])) return rtrim($c['url'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/seo.php')), '/');
    if (substr($dir, -4) === '/api') $dir = substr($dir, 0, -4);
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}
function seo_url(string $path = ''): string
{
    return seo_base() . '/' . ltrim($path, '/');
}
function seo_cut(string $s, int $n): string
{
    $s = trim(preg_replace('/\s+/u', ' ', strip_tags($s)));
    return mb_strlen($s) > $n ? rtrim(mb_substr($s, 0, $n - 1)) . '…' : $s;
}
function seo_ld(array $data): string
{
    return '<script type="application/ld+json">' . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . '</script>';
}
function seo_site(): string
{
    return (string) (setting('general', 'siteNameFa') ?: 'بهیکس');
}
// «page | title | description» lines from the SEO settings
function seo_page_meta(string $page): array
{
    foreach ((array) (setting('seo', 'pages') ?: []) as $line) {
        $p = array_map('trim', explode('|', (string) $line, 3));
        if (($p[0] ?? '') === $page) return ['title' => $p[1] ?? '', 'desc' => $p[2] ?? ''];
    }
    return ['title' => '', 'desc' => ''];
}
function seo_img(?string $fileId): string
{
    return $fileId ? seo_url('api/index.php?r=file&id=' . rawurlencode($fileId)) : '';
}

// ------------------------------------------------------------------ structured data
function seo_org_ld(): array
{
    $c = setting('contact');
    $so = array_values(array_filter((array) setting('socials')));
    $seo = setting('seo');
    $o = ['@context' => 'https://schema.org', '@type' => $seo['orgType'] ?: 'Organization', '@id' => seo_url('#org'), 'name' => seo_site(),
        'alternateName' => (string) setting('general', 'siteName'), 'url' => seo_url(), 'logo' => seo_url('assets/img/icon-512.png'), 'image' => seo_url('assets/img/icon-512.png'),
        'description' => (string) $seo['description']];
    if (!empty($c['phone'])) $o['telephone'] = $c['phone'];
    if (!empty($c['email'])) $o['email'] = $c['email'];
    if ($so) $o['sameAs'] = $so;
    if (!empty($c['address']) || !empty($seo['city'])) $o['address'] = ['@type' => 'PostalAddress', 'addressCountry' => 'IR', 'addressLocality' => (string) $seo['city'], 'streetAddress' => (string) $c['address']];
    if (in_array($o['@type'], ['ProfessionalService', 'LocalBusiness', 'Store'], true)) $o['priceRange'] = $seo['priceRange'] ?: '$$';
    return $o;
}
function seo_crumbs_ld(array $items): array
{
    $list = [];
    foreach ($items as $i => [$name, $path]) $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => seo_url($path)];
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
}

// ------------------------------------------------------------------ services
function seo_service(string $id): ?array
{
    foreach (catalog(true) as $c) foreach ($c['services'] as $s) if ($s['id'] === $id) return $s + ['cat' => $c];
    return null;
}
function seo_service_faq(array $s): array
{
    $o = setting('orders');
    $rev = fa_digits((string) ($o['revisions'] ?? 2));
    $pay = 'پرداخت آنلاین با همه کارت‌های بانکی و کیف پول پنل' . (!empty($o['stagedEnabled']) ? '؛ برای سفارش‌های از ' . fa_digits(number_format((int) $o['stagedMin'])) . ' تومان به بالا پرداخت مرحله‌ای (' . fa_digits((string) $o['stagedPercent']) . '٪ پیش‌پرداخت)' : '') . '.';
    $bn = [];
    foreach (['snapppay', 'digipay', 'azki', 'torobpay'] as $b) { $x = setting('bnpl_' . $b); if (!empty($x['enabled'])) $bn[] = $x['label']; }
    if ($bn) $pay .= ' خرید اقساطی با ' . implode('، ', $bn) . ' هم امکان‌پذیر است.';
    return [
        ['قیمت ' . $s['title'] . ' چقدر است؟', 'قیمت پایه ' . $s['title'] . ' از ' . fa_digits(number_format((int) $s['base'])) . ' تومان شروع می‌شود. در فرم سفارش با انتخاب جزئیات، قیمت تقریبی همان لحظه نمایش داده می‌شود و بعد از بررسی بریف، پیش‌فاکتور دقیق صادر می‌شود.'],
        [$s['title'] . ' چند روز طول می‌کشد؟', 'در حالت عادی حدود ' . fa_digits((string) $s['days']) . ' روز کاری. حالت‌های «سریع» و «فوری» هم برای کارهای عجله‌ای وجود دارد.'],
        ['اگر از طرح راضی نباشم چه می‌شود؟', 'هر سفارش شامل ' . $rev . ' مرحله اصلاح رایگان است و تا تأیید نهایی شما، فایل نهایی تحویل نمی‌شود.'],
        ['روش‌های پرداخت چیست؟', $pay],
        ['فایل‌ها چطور تحویل داده می‌شوند؟', 'همه نسخه‌ها و فایل‌های نهایی در پنل کاربری شما قرار می‌گیرد و برای همیشه قابل دانلود است.'],
    ];
}
function seo_service_html(array $s): string
{
    $h = 'seo_h';
    $c = $s['cat'];
    $dl = setting('orders', 'deadlines') ?: [];
    $faq = seo_service_faq($s);
    $related = array_filter($c['services'], function ($x) use ($s) { return $x['id'] !== $s['id']; });
    ob_start(); ?>
  <section class="container page-hero svc-hero" data-reveal style="--h:<?= (int) $c['hue'] ?>">
    <nav class="crumbs" aria-label="مسیر"><a href="index.html">خانه</a><svg class="icon"><use href="#i-chevron-left"/></svg><a href="services.html#cat-<?= $h($c['id']) ?>"><?= $h($c['title']) ?></a><svg class="icon"><use href="#i-chevron-left"/></svg><span><?= $h($s['title']) ?></span></nav>
    <span class="svc-icon-lg"><svg class="icon"><use href="#i-<?= $h($s['icon']) ?>"/></svg></span>
    <h1><?= $h($s['title']) ?></h1>
    <p><?= $h($s['desc']) ?></p>
    <div class="svc-facts">
      <div><small>شروع قیمت</small><b><?= fa_digits(number_format((int) $s['base'])) ?> <small>تومان</small></b></div>
      <div><small>زمان تحویل</small><b><?= fa_digits((string) $s['days']) ?> <small>روز کاری</small></b></div>
      <div><small>اصلاح رایگان</small><b><?= fa_digits((string) (setting('orders', 'revisions') ?: 2)) ?> <small>مرحله</small></b></div>
    </div>
    <div class="cta-actions"><a class="btn btn-primary" href="order.html?service=<?= $h(rawurlencode($s['id'])) ?>">ثبت سفارش و محاسبه قیمت <svg class="icon"><use href="#i-arrow"/></svg></a><a class="btn btn-ghost" href="portfolio.html">نمونه‌کارها</a></div>
  </section>
  <section class="container section-sm">
    <div class="grid-2 svc-grid">
      <div class="card pad-lg" data-reveal>
        <h2 class="h2-xs">برای <?= $h($s['title']) ?> چه اطلاعاتی می‌گیریم؟</h2>
        <p class="muted small lh">فرم سفارش قدم‌به‌قدم این موارد را می‌پرسد و با هر انتخاب، قیمت به‌روز می‌شود:</p>
        <ul class="svc-fields mt-2"><?php foreach ($s['fields'] as $f): ?><li><svg class="icon"><use href="#i-check"/></svg><?= $h($f['label']) ?></li><?php endforeach; ?></ul>
      </div>
      <div class="card pad-lg" data-reveal style="--d:80ms">
        <h2 class="h2-xs">زمان‌بندی و هزینه</h2>
        <table class="svc-table"><thead><tr><th>سرعت</th><th>زمان تقریبی</th><th>ضریب قیمت</th></tr></thead><tbody>
        <?php foreach ($dl as $d): ?><tr><td><b><?= $h($d['label']) ?></b><br><small class="muted"><?= $h($d['hint'] ?? '') ?></small></td><td><?= fa_digits((string) max(1, (int) round($s['days'] * (float) ($d['daysMult'] ?? 1)))) ?> روز</td><td><?= fa_digits(number_format((int) round($s['base'] * (float) ($d['mult'] ?? 1)))) ?> تومان</td></tr><?php endforeach; ?>
        </tbody></table>
        <p class="muted small lh mt-2">قیمت‌ها پایه هستند؛ قیمت دقیق بعد از بررسی جزئیات در پیش‌فاکتور اعلام می‌شود.</p>
      </div>
    </div>
  </section>
  <section class="container section-sm">
    <div class="section-head" data-reveal><p class="eyebrow">FAQ</p><h2>سؤالات متداول <?= $h($s['title']) ?></h2></div>
    <div class="faq mt-2"><?php foreach ($faq as [$q, $a]): ?><details class="card faq-item" data-reveal><summary><?= $h($q) ?></summary><p class="muted lh"><?= $h($a) ?></p></details><?php endforeach; ?></div>
  </section>
  <?php if ($related): ?>
  <section class="container section-sm">
    <div class="section-head" data-reveal><h2 class="h2-sm">سایر خدمات <?= $h($c['title']) ?></h2></div>
    <div class="grid-auto mt-2"><?php foreach ($related as $r): ?>
      <a class="card service-detail" href="service.html?id=<?= $h(rawurlencode($r['id'])) ?>" data-reveal>
        <div class="row-between"><span class="svc-icon-lg"><svg class="icon"><use href="#i-<?= $h($r['icon']) ?>"/></svg></span><span class="badge"><?= fa_digits((string) $r['days']) ?> روز</span></div>
        <h3><?= $h($r['title']) ?></h3><p class="muted small lh"><?= $h(seo_cut($r['desc'], 110)) ?></p>
        <span class="small muted">شروع قیمت <b class="brand"><?= fa_digits(number_format((int) $r['base'])) ?> تومان</b></span>
      </a><?php endforeach; ?></div>
  </section>
  <?php endif; ?>
  <section class="container section-sm">
    <div class="cta glow" data-reveal><h2 class="h2-sm">همین حالا <?= $h($s['title']) ?> را سفارش دهید</h2>
      <p class="muted lh">بدون نیاز به ثبت‌نام قبلی؛ قیمت را همان لحظه ببینید و پیش‌فاکتور را در پنل دریافت کنید.</p>
      <div class="cta-actions"><a href="order.html?service=<?= $h(rawurlencode($s['id'])) ?>" class="btn btn-primary">شروع سفارش <svg class="icon"><use href="#i-arrow"/></svg></a><a href="index.html#support" class="btn btn-ghost">مشاوره رایگان</a></div></div>
  </section>
<?php
    return (string) ob_get_clean();
}
function seo_service_ld(array $s): array
{
    $faq = array_map(function ($x) { return ['@type' => 'Question', 'name' => $x[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $x[1]]]; }, seo_service_faq($s));
    return [
        ['@context' => 'https://schema.org', '@type' => 'Service', 'name' => $s['title'], 'description' => $s['desc'], 'serviceType' => $s['cat']['title'],
            'provider' => ['@id' => seo_url('#org')], 'areaServed' => ['@type' => 'Country', 'name' => 'Iran'], 'url' => seo_url('service.html?id=' . rawurlencode($s['id'])),
            'offers' => ['@type' => 'Offer', 'priceCurrency' => 'IRR', 'price' => (int) $s['base'] * 10, 'availability' => 'https://schema.org/InStock',
                'priceSpecification' => ['@type' => 'PriceSpecification', 'minPrice' => (int) $s['base'] * 10, 'priceCurrency' => 'IRR']]],
        ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $faq],
    ];
}

// Static list of services for crawlers (services.js replaces it with the interactive version)
function seo_services_list(): string
{
    $out = '';
    foreach (catalog(true) as $c) {
        $out .= '<section class="container section-sm" id="cat-' . seo_h($c['id']) . '"><h2 class="h2-xs">' . seo_h($c['title']) . '</h2><p class="muted small">' . seo_h($c['desc']) . '</p><ul class="seo-links">';
        foreach ($c['services'] as $s) $out .= '<li><a href="service.html?id=' . seo_h(rawurlencode($s['id'])) . '">' . seo_h($s['title']) . '</a> — از ' . fa_digits(number_format((int) $s['base'])) . ' تومان</li>';
        $out .= '</ul></section>';
    }
    return $out;
}

// ------------------------------------------------------------------ products
function seo_final_price(array $p): int
{
    return (int) (round(((int) $p['price'] * (100 - (int) $p['discount']) / 100) / 1000) * 1000);
}
function seo_product_html(array $p): string
{
    $h = 'seo_h';
    $img = seo_img($p['image']);
    $out = '<article class="card pad-lg seo-product"><h1 class="h2-sm">' . $h($p['title']) . '</h1>';
    if ($img) $out .= '<img src="' . $h($img) . '" alt="' . $h($p['title']) . '" width="600" loading="lazy">';
    $out .= '<p><b>' . fa_digits(number_format(seo_final_price($p))) . ' تومان</b>' . ((int) $p['discount'] ? ' <del>' . fa_digits(number_format((int) $p['price'])) . '</del>' : '') . '</p>';
    if ($p['descr']) $out .= '<p class="muted lh">' . nl2br($h($p['descr'])) . '</p>';
    $out .= '</article>';
    return $out;
}
function seo_shop_list(): string
{
    $out = '<ul class="seo-links">';
    foreach (rows("SELECT * FROM products WHERE status = 'active' ORDER BY sales DESC LIMIT 200") as $p) {
        $out .= '<li><a href="shop.html?product=' . (int) $p['id'] . '">' . seo_h($p['title']) . '</a> — ' . fa_digits(number_format(seo_final_price($p))) . ' تومان</li>';
    }
    return $out . '</ul>';
}
function seo_product_ld(array $p): array
{
    $ld = ['@context' => 'https://schema.org', '@type' => 'Product', 'name' => $p['title'], 'sku' => 'P' . $p['id'], 'description' => seo_cut((string) $p['descr'], 500) ?: $p['title'],
        'brand' => ['@type' => 'Brand', 'name' => seo_site()], 'url' => seo_url('shop.html?product=' . (int) $p['id']),
        'offers' => ['@type' => 'Offer', 'priceCurrency' => 'IRR', 'price' => seo_final_price($p) * 10, 'availability' => 'https://schema.org/InStock',
            'url' => seo_url('shop.html?product=' . (int) $p['id']), 'seller' => ['@id' => seo_url('#org')]]];
    $imgs = array_filter(array_merge([seo_img($p['image'])], array_map('seo_img', array_column(rows("SELECT id FROM files WHERE kind = 'gallery' AND ref_id = ?", [$p['id']]), 'id'))));
    if ($imgs) $ld['image'] = array_values($imgs);
    if ((int) ($p['reviews'] ?? 0) > 0) {
        $ld['aggregateRating'] = ['@type' => 'AggregateRating', 'ratingValue' => (float) $p['rating'], 'reviewCount' => (int) $p['reviews'], 'bestRating' => 5];
        $ld['review'] = array_map(function ($r) { return ['@type' => 'Review', 'reviewRating' => ['@type' => 'Rating', 'ratingValue' => (int) $r['rating']], 'author' => ['@type' => 'Person', 'name' => explode(' ', (string) $r['uname'])[0] ?: 'خریدار'], 'reviewBody' => $r['body']]; },
            rows('SELECT r.rating, r.body, u.name uname FROM product_reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.hidden = 0 ORDER BY r.id DESC LIMIT 5', [$p['id']]));
    }
    return $ld;
}

// ------------------------------------------------------------------ blog
function seo_post_url(array $p): string
{
    return 'blog.html?p=' . rawurlencode($p['slug']);
}
function seo_blog_list_html(int $page = 1, string $tag = ''): string
{
    $h = 'seo_h';
    $per = 12;
    $w = "status = 'published' AND published_at <= ?";
    $args = [gmdate('Y-m-d H:i:s')];
    if ($tag !== '') { $w .= ' AND (tags LIKE ? OR category = ?)'; $args[] = '%' . json_encode($tag, JSON_UNESCAPED_UNICODE) . '%'; $args[] = $tag; }
    $total = (int) val("SELECT COUNT(*) FROM posts WHERE $w", $args);
    $list = rows("SELECT * FROM posts WHERE $w ORDER BY published_at DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args);
    ob_start(); ?>
  <section class="container page-hero" data-reveal>
    <nav class="crumbs" aria-label="مسیر"><a href="index.html">خانه</a><svg class="icon"><use href="#i-chevron-left"/></svg><span>وبلاگ</span><?php if ($tag !== ''): ?><svg class="icon"><use href="#i-chevron-left"/></svg><span><?= $h($tag) ?></span><?php endif; ?></nav>
    <h1><?= $tag !== '' ? 'مطالب ' . $h($tag) : 'وبلاگ <span class="grad">' . $h(seo_site()) . '</span>' ?></h1>
    <p>آموزش، ایده و تجربه درباره طراحی، برندینگ، سایت، تولید محتوا و هوش مصنوعی برای کسب‌وکارها.</p>
  </section>
  <section class="container section-sm" style="padding-top:8px">
    <?php if (!$list): ?><div class="card empty"><svg class="icon"><use href="#i-book"/></svg><p>به‌زودی اولین مطالب منتشر می‌شود.</p></div>
    <?php else: ?><div class="grid-auto blog-grid"><?php foreach ($list as $i => $p): ?>
      <article class="card blog-card" data-reveal style="--d:<?= ($i % 6) * 60 ?>ms">
        <a href="<?= $h(seo_post_url($p)) ?>" class="blog-thumb"<?= $p['cover'] ? ' style="background-image:url(\'' . $h('api/index.php?r=file&id=' . rawurlencode($p['cover'])) . '\')"' : '' ?>><?= $p['cover'] ? '' : '<svg class="icon"><use href="#i-book"/></svg>' ?></a>
        <div class="blog-body">
          <?php if ($p['category']): ?><a class="badge badge--brand" href="blog.html?tag=<?= $h(rawurlencode($p['category'])) ?>"><?= $h($p['category']) ?></a><?php endif; ?>
          <h2><a href="<?= $h(seo_post_url($p)) ?>"><?= $h($p['title']) ?></a></h2>
          <p class="muted small lh"><?= $h(seo_cut((string) ($p['excerpt'] ?: $p['body']), 160)) ?></p>
          <small class="muted"><?= $h(seo_jdate($p['published_at'])) ?> · <?= fa_digits((string) seo_read_min((string) $p['body'])) ?> دقیقه مطالعه</small>
        </div>
      </article><?php endforeach; ?></div>
      <?php if ($total > $per): ?><nav class="pager mt-3"><?php for ($i = 1; $i <= (int) ceil($total / $per); $i++): ?><a class="<?= $i === $page ? 'is-active' : '' ?>" href="blog.html?page=<?= $i ?><?= $tag !== '' ? '&tag=' . $h(rawurlencode($tag)) : '' ?>"><?= fa_digits((string) $i) ?></a><?php endfor; ?></nav><?php endif; ?>
    <?php endif; ?>
  </section>
<?php
    return (string) ob_get_clean();
}
function seo_read_min(string $html): int
{
    return max(1, (int) round(count(preg_split('/\s+/u', trim(strip_tags($html)))) / 200));
}
function seo_jdate(?string $dt): string
{
    if (!$dt) return '';
    $ts = strtotime($dt . ' UTC');
    if (class_exists('IntlDateFormatter')) {
        $f = new IntlDateFormatter('fa_IR@calendar=persian', IntlDateFormatter::LONG, IntlDateFormatter::NONE, 'Asia/Tehran', IntlDateFormatter::TRADITIONAL, 'd MMMM yyyy');
        $s = $f->format($ts);
        if ($s) return $s;
    }
    return fa_digits(date('Y/m/d', $ts));
}
function seo_post_html(array $p): string
{
    $h = 'seo_h';
    $tags = jdec($p['tags'], []) ?: [];
    $related = rows("SELECT * FROM posts WHERE status = 'published' AND id <> ? AND published_at <= ? ORDER BY (category = ?) DESC, published_at DESC LIMIT 3", [$p['id'], gmdate('Y-m-d H:i:s'), $p['category']]);
    ob_start(); ?>
  <article class="container post" itemscope itemtype="https://schema.org/BlogPosting">
    <header class="page-hero post-hero" data-reveal>
      <nav class="crumbs" aria-label="مسیر"><a href="index.html">خانه</a><svg class="icon"><use href="#i-chevron-left"/></svg><a href="blog.html">وبلاگ</a><?php if ($p['category']): ?><svg class="icon"><use href="#i-chevron-left"/></svg><a href="blog.html?tag=<?= $h(rawurlencode($p['category'])) ?>"><?= $h($p['category']) ?></a><?php endif; ?></nav>
      <h1 itemprop="headline"><?= $h($p['title']) ?></h1>
      <?php if ($p['excerpt']): ?><p itemprop="description"><?= $h($p['excerpt']) ?></p><?php endif; ?>
      <small class="muted"><time datetime="<?= $h(gmdate('c', strtotime($p['published_at'] . ' UTC'))) ?>" itemprop="datePublished"><?= $h(seo_jdate($p['published_at'])) ?></time> · <?= fa_digits((string) seo_read_min((string) $p['body'])) ?> دقیقه مطالعه</small>
    </header>
    <?php if ($p['cover']): ?><img class="post-cover" src="<?= $h('api/index.php?r=file&id=' . rawurlencode($p['cover'])) ?>" alt="<?= $h($p['title']) ?>" itemprop="image"><?php endif; ?>
    <div class="post-body card" itemprop="articleBody"><?= $p['body'] /* sanitized on save */ ?></div>
    <?php if ($tags): ?><div class="post-tags"><?php foreach ($tags as $t): ?><a class="chip" href="blog.html?tag=<?= $h(rawurlencode($t)) ?>">#<?= $h($t) ?></a><?php endforeach; ?></div><?php endif; ?>
    <div class="cta glow mt-3"><h2 class="h2-sm">برای کسب‌وکارتان اجرا کنیم؟</h2><p class="muted lh">مشاوره رایگان بگیرید یا مستقیم سفارش ثبت کنید؛ قیمت را همان لحظه می‌بینید.</p>
      <div class="cta-actions"><a class="btn btn-primary" href="order.html">ثبت سفارش <svg class="icon"><use href="#i-arrow"/></svg></a><a class="btn btn-ghost" href="services.html">همه خدمات</a></div></div>
    <?php if ($related): ?><section class="mt-3"><h2 class="h2-xs">مطالب مرتبط</h2><div class="grid-auto mt-2"><?php foreach ($related as $r): ?>
      <a class="card blog-card blog-card--sm" href="<?= $h(seo_post_url($r)) ?>"><div class="blog-body"><h3><?= $h($r['title']) ?></h3><small class="muted"><?= $h(seo_jdate($r['published_at'])) ?></small></div></a><?php endforeach; ?></div></section><?php endif; ?>
  </article>
<?php
    return (string) ob_get_clean();
}
function seo_post_ld(array $p): array
{
    return ['@context' => 'https://schema.org', '@type' => 'BlogPosting', 'headline' => mb_substr($p['title'], 0, 110), 'description' => seo_cut((string) ($p['seo_desc'] ?: $p['excerpt'] ?: $p['body']), 300),
        'datePublished' => gmdate('c', strtotime($p['published_at'] . ' UTC')), 'dateModified' => gmdate('c', strtotime($p['updated_at'] . ' UTC')),
        'mainEntityOfPage' => seo_url(seo_post_url($p)), 'image' => $p['cover'] ? [seo_img($p['cover'])] : [seo_url('assets/img/og.png')],
        'author' => ['@type' => 'Organization', 'name' => seo_site(), 'url' => seo_url()], 'publisher' => ['@id' => seo_url('#org')], 'keywords' => implode('، ', jdec($p['tags'], []) ?: [])];
}

// Allow-list HTML sanitizer for blog bodies (admin-written, still cleaned)
function seo_clean_html(string $html): string
{
    $html = preg_replace('#<(script|style|iframe|object|embed|form|input|button|svg|math)[^>]*>.*?</\1>#is', '', $html);
    $html = strip_tags($html, '<p><br><h2><h3><h4><b><strong><i><em><u><s><ul><ol><li><a><img><blockquote><figure><figcaption><table><thead><tbody><tr><th><td><hr><code><pre><span><mark>');
    // keep only safe attributes
    $html = preg_replace_callback('#<([a-z0-9]+)(\s[^>]*)?>#i', function ($m) {
        $tag = strtolower($m[1]);
        $keep = [];
        if (!empty($m[2]) && preg_match_all('#([a-z-]+)\s*=\s*("([^"]*)"|\'([^\']*)\')#i', $m[2], $am, PREG_SET_ORDER)) {
            foreach ($am as $a) {
                $name = strtolower($a[1]);
                $v = $a[3] !== '' ? $a[3] : ($a[4] ?? '');
                $allowed = ['a' => ['href', 'title', 'target', 'rel'], 'img' => ['src', 'alt', 'width', 'height', 'loading'], 'td' => ['colspan', 'rowspan'], 'th' => ['colspan', 'rowspan']][$tag] ?? [];
                if (!in_array($name, $allowed, true)) continue;
                if (in_array($name, ['href', 'src'], true) && preg_match('#^\s*(javascript|data|vbscript):#i', html_entity_decode($v))) continue;
                $keep[] = $name . '="' . htmlspecialchars(html_entity_decode($v, ENT_QUOTES, 'UTF-8'), ENT_QUOTES, 'UTF-8') . '"';
            }
        }
        if ($tag === 'a' && preg_match('#target="_blank"#', implode(' ', $keep))) $keep[] = 'rel="noopener"';
        if ($tag === 'img') $keep[] = 'loading="lazy"';
        return '<' . $tag . ($keep ? ' ' . implode(' ', array_unique($keep)) : '') . '>';
    }, $html);
    return trim($html);
}

// ------------------------------------------------------------------ footer links for crawlers (core.js replaces the footer)
function seo_footer_html(): string
{
    $out = '<nav class="container seo-foot" aria-label="نقشه سایت"><ul>';
    foreach (['index.html' => 'خانه', 'services.html' => 'خدمات', 'shop.html' => 'فروشگاه', 'portfolio.html' => 'نمونه‌کارها', 'designers.html' => 'طراحان', 'blog.html' => 'وبلاگ', 'tools.html' => 'ابزارهای رایگان', 'about.html' => 'درباره ما', 'terms.html' => 'قوانین'] as $u => $t) $out .= '<li><a href="' . $u . '">' . seo_h($t) . '</a></li>';
    $out .= '</ul><ul>';
    foreach (catalog(true) as $c) foreach ($c['services'] as $s) $out .= '<li><a href="service.html?id=' . seo_h(rawurlencode($s['id'])) . '">' . seo_h($s['title']) . '</a></li>';
    return $out . '</ul></nav>';
}

// ------------------------------------------------------------------ sitemap, robots, feeds
function seo_sitemap(): void
{
    header('Content-Type: application/xml; charset=utf-8');
    $u = function ($loc, $mod = null, $pri = '0.7', $freq = 'weekly') {
        return '<url><loc>' . seo_h(seo_url($loc)) . '</loc>' . ($mod ? '<lastmod>' . gmdate('Y-m-d', strtotime($mod . ' UTC')) . '</lastmod>' : '') . '<changefreq>' . $freq . '</changefreq><priority>' . $pri . '</priority></url>';
    };
    $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    $x .= $u('', null, '1.0', 'daily');
    foreach (['services.html' => '0.9', 'shop.html' => '0.8', 'blog.html' => '0.8', 'portfolio.html' => '0.7', 'designers.html' => '0.6', 'tools.html' => '0.7', 'order.html' => '0.6', 'about.html' => '0.5', 'terms.html' => '0.2'] as $p => $pri) {
        if ($p === 'shop.html' && setting('shop', 'enabled') === false) continue;
        $x .= $u($p, null, $pri);
    }
    foreach (catalog(true) as $c) foreach ($c['services'] as $s) $x .= $u('service.html?id=' . rawurlencode($s['id']), null, '0.9');
    foreach (rows("SELECT id, created_at FROM products WHERE status = 'active'") as $p) $x .= $u('shop.html?product=' . $p['id'], $p['created_at'], '0.6');
    foreach (rows("SELECT slug, updated_at FROM posts WHERE status = 'published' AND published_at <= ?", [gmdate('Y-m-d H:i:s')]) as $p) $x .= $u('blog.html?p=' . rawurlencode($p['slug']), $p['updated_at'], '0.7', 'monthly');
    echo $x . '</urlset>';
    exit;
}
function seo_robots(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    if (!empty(setting('seo', 'noindex'))) exit("User-agent: *\nDisallow: /\n");
    echo "User-agent: *\nAllow: /\nDisallow: /api/\nAllow: /api/index.php?r=file\nDisallow: /dashboard.html\nDisallow: /auth.html\nDisallow: /install.php\nDisallow: /*?ref=\n\nSitemap: " . seo_url('sitemap.xml') . "\n";
    exit;
}
// Torob product web service (JSON, paged)
function seo_feed_torob(): void
{
    header('Content-Type: application/json; charset=utf-8');
    $page = max(1, (int) ($_GET['page'] ?? $_POST['page'] ?? 1));
    $per = 100;
    $total = (int) val("SELECT COUNT(*) FROM products WHERE status = 'active'");
    $list = rows("SELECT * FROM products WHERE status = 'active' ORDER BY id LIMIT $per OFFSET " . (($page - 1) * $per));
    echo json_encode(['count' => $total, 'max_pages' => max(1, (int) ceil($total / $per)), 'products' => array_map(function ($p) {
        $o = ['product_id' => (string) $p['id'], 'page_url' => seo_url('shop.html?product=' . $p['id']), 'price' => (string) seo_final_price($p), 'availability' => 'instock', 'title' => $p['title']];
        if ((int) $p['discount']) $o['old_price'] = (string) (int) $p['price'];
        if ($p['image']) $o['image_link'] = seo_img($p['image']);
        return $o;
    }, $list)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
// Generic RSS product feed (Emalls and other aggregators) + blog RSS
function seo_feed_rss(string $kind): void
{
    header('Content-Type: application/rss+xml; charset=utf-8');
    $x = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>' . seo_h(seo_site()) . '</title><link>' . seo_h(seo_url()) . '</link><description>' . seo_h(setting('seo', 'description')) . '</description>';
    if ($kind === 'blog') {
        foreach (rows("SELECT * FROM posts WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC LIMIT 30", [gmdate('Y-m-d H:i:s')]) as $p) {
            $x .= '<item><title>' . seo_h($p['title']) . '</title><link>' . seo_h(seo_url(seo_post_url($p))) . '</link><guid>' . seo_h(seo_url(seo_post_url($p))) . '</guid><pubDate>' . gmdate(DATE_RSS, strtotime($p['published_at'] . ' UTC')) . '</pubDate><description>' . seo_h(seo_cut((string) ($p['excerpt'] ?: $p['body']), 300)) . '</description></item>';
        }
    } else {
        foreach (rows("SELECT * FROM products WHERE status = 'active' ORDER BY id") as $p) {
            $x .= '<item><g:id>P' . (int) $p['id'] . '</g:id><title>' . seo_h($p['title']) . '</title><link>' . seo_h(seo_url('shop.html?product=' . $p['id'])) . '</link><description>' . seo_h(seo_cut((string) $p['descr'], 500) ?: $p['title']) . '</description>'
                . ($p['image'] ? '<g:image_link>' . seo_h(seo_img($p['image'])) . '</g:image_link>' : '') . '<g:price>' . (seo_final_price($p) * 10) . ' IRR</g:price><g:availability>in_stock</g:availability><g:condition>new</g:condition></item>';
        }
    }
    echo $x . '</channel></rss>';
    exit;
}
