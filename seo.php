<?php
// BEHIX — serves the site's HTML pages with server-side SEO: title, meta
// description, canonical, Open Graph, JSON-LD and real content for crawlers.
// .htaccess routes *.html, /sitemap.xml and /robots.txt here. If anything
// fails, the original static page is sent unchanged.
define('BX', true);
ini_set('display_errors', '0');

const SEO_PAGES = ['index', 'services', 'service', 'order', 'portfolio', 'shop', 'designers', 'about', 'terms', 'tools', 'blog', '404'];
$page = preg_replace('/[^a-z0-9]/', '', strtolower((string) ($_GET['page'] ?? 'index')));
$special = $_GET['sitemap'] ?? $_GET['robots'] ?? $_GET['feed'] ?? null;
if (!in_array($page, SEO_PAGES, true)) $page = '404';
$file = __DIR__ . '/' . $page . '.html';

function seo_raw(string $file, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    readfile($file);
    exit;
}

try {
    require __DIR__ . '/api/lib/core.php';
    if (!installed()) {
        if ($special !== null) { http_response_code(404); exit; }
        seo_raw($file);
    }
    try { ensure_schema(); } catch (Throwable $e) { error_log('[BEHIX] schema: ' . $e->getMessage()); }
    require_once __DIR__ . '/api/lib/seo.php';
    if (isset($_GET['sitemap'])) seo_sitemap();
    if (isset($_GET['robots'])) seo_robots();
    if (isset($_GET['feed'])) { $_GET['feed'] === 'torob' ? seo_feed_torob() : seo_feed_rss($_GET['feed'] === 'blog' ? 'blog' : 'products'); }
    // fragment for the client fallback (no URL rewriting on the host)
    if (isset($_GET['frag'])) seo_fragment((string) $_GET['frag']);

    $html = file_get_contents($file);
    $site = seo_site();
    $seo = setting('seo');
    $pm = seo_page_meta($page);
    $m = ['title' => $pm['title'], 'desc' => $pm['desc'], 'canonical' => $page === 'index' ? '' : $page . '.html', 'image' => '', 'type' => 'website', 'ld' => [seo_org_ld()], 'noindex' => false, 'head' => ''];
    $status = 200;
    $inject = [];
    $crumb = ['index.html' => 'خانه'];
    $titles = ['services' => 'خدمات', 'shop' => 'فروشگاه', 'portfolio' => 'نمونه‌کارها', 'designers' => 'طراحان', 'about' => 'درباره ما', 'tools' => 'ابزارهای رایگان', 'blog' => 'وبلاگ', 'order' => 'ثبت سفارش', 'terms' => 'قوانین'];

    if ($page === 'index') {
        $m['title'] = $seo['title'];
        $m['desc'] = $seo['description'];
        $m['ld'][] = ['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => $site, 'url' => seo_url(), 'inLanguage' => 'fa-IR', 'publisher' => ['@id' => seo_url('#org')]];
    } elseif ($page === 'service') {
        $s = seo_service((string) ($_GET['id'] ?? ''));
        if (!$s) { $page = '404'; $status = 404; $html = file_get_contents(__DIR__ . '/404.html'); $m['noindex'] = true; }
        else {
            $m['title'] = $s['title'] . ' | قیمت و ثبت سفارش آنلاین | ' . $site;
            $m['desc'] = seo_cut($s['desc'] . ' قیمت از ' . fa_digits(number_format((int) $s['base'])) . ' تومان، تحویل حدود ' . fa_digits((string) $s['days']) . ' روز، ' . fa_digits((string) (setting('orders', 'revisions') ?: 2)) . ' مرحله اصلاح رایگان.', 160);
            $m['canonical'] = 'service.html?id=' . rawurlencode($s['id']);
            $m['ld'] = array_merge($m['ld'], seo_service_ld($s));
            $m['ld'][] = seo_crumbs_ld([['خانه', ''], ['خدمات', 'services.html'], [$s['title'], $m['canonical']]]);
            $inject['<div id="svc-page"></div>'] = '<div id="svc-page" data-ssr="1" data-id="' . seo_h($s['id']) . '">' . seo_service_html($s) . '</div>';
        }
    } elseif ($page === 'shop' && !empty($_GET['product'])) {
        $p = row("SELECT * FROM products WHERE id = ? AND status = 'active'", [(int) $_GET['product']]);
        if ($p) {
            $price = seo_final_price($p);
            $m['title'] = $p['title'] . ' | خرید و دانلود | ' . $site;
            $m['desc'] = seo_cut(($p['descr'] ?: $p['title']) . ' — قیمت ' . fa_digits(number_format($price)) . ' تومان، دانلود آنی.', 160);
            $m['canonical'] = 'shop.html?product=' . (int) $p['id'];
            $m['image'] = seo_img($p['image']);
            $m['type'] = 'product';
            $m['ld'][] = seo_product_ld($p);
            $m['ld'][] = seo_crumbs_ld([['خانه', ''], ['فروشگاه', 'shop.html'], [$p['title'], $m['canonical']]]);
            // Torob product meta tags
            $m['head'] .= '<meta name="product_id" content="' . (int) $p['id'] . '"><meta name="product_name" content="' . seo_h($p['title']) . '"><meta name="product_price" content="' . $price . '">'
                . ((int) $p['discount'] ? '<meta name="product_old_price" content="' . (int) $p['price'] . '">' : '') . '<meta name="availability" content="instock">'
                . '<meta property="product:price:amount" content="' . ($price * 10) . '"><meta property="product:price:currency" content="IRR">';
            $inject['<div data-view="shop"></div>'] = '<div data-view="shop">' . seo_product_html($p) . '</div>';
        } else {
            $m['noindex'] = true;
        }
    } elseif ($page === 'blog') {
        $slug = (string) ($_GET['p'] ?? '');
        if ($slug !== '') {
            $post = row("SELECT * FROM posts WHERE slug = ? AND status = 'published' AND published_at <= ?", [$slug, gmdate('Y-m-d H:i:s')]);
            $me = null;
            if (!$post) {
                // admins can preview drafts
                start_session();
                $me = me();
                if ($me && $me['role'] === 'admin') $post = row('SELECT * FROM posts WHERE slug = ?', [$slug]);
            }
            if ($post) {
                if ($post['status'] === 'published') q('UPDATE posts SET views = views + 1 WHERE id = ?', [$post['id']]);
                $m['title'] = ($post['seo_title'] ?: $post['title']) . ' | ' . $site;
                $m['desc'] = seo_cut((string) ($post['seo_desc'] ?: $post['excerpt'] ?: $post['body']), 160);
                $m['canonical'] = seo_post_url($post);
                $m['image'] = seo_img($post['cover']);
                $m['type'] = 'article';
                $m['noindex'] = $post['status'] !== 'published';
                $m['head'] .= '<meta property="article:published_time" content="' . seo_h(gmdate('c', strtotime($post['published_at'] . ' UTC'))) . '">';
                $m['ld'][] = seo_post_ld($post);
                $m['ld'][] = seo_crumbs_ld([['خانه', ''], ['وبلاگ', 'blog.html'], [$post['title'], $m['canonical']]]);
                $inject['<div id="blog-root"></div>'] = '<div id="blog-root" data-ssr="1">' . seo_post_html($post) . '</div>';
            } else {
                $status = 404;
                $m['noindex'] = true;
                $inject['<div id="blog-root"></div>'] = '<div id="blog-root" data-ssr="1"><section class="container page-hero"><h1>مطلب پیدا نشد</h1><p><a class="brand" href="blog.html">بازگشت به وبلاگ</a></p></section></div>';
            }
        } else {
            $pg = max(1, (int) ($_GET['page'] ?? 1));
            $tag = mb_substr(trim((string) ($_GET['tag'] ?? '')), 0, 60);
            $m['title'] = $m['title'] ?: ($tag !== '' ? 'مطالب ' . $tag . ' | وبلاگ ' . $site : 'وبلاگ ' . $site . ' | آموزش طراحی، برندینگ و هوش مصنوعی');
            $m['desc'] = $m['desc'] ?: 'مقاله‌ها و آموزش‌های کاربردی درباره طراحی سایت، لوگو و برندینگ، تولید محتوا، تیزر هوش مصنوعی و اتوماسیون کسب‌وکار.';
            $m['canonical'] = 'blog.html' . ($tag !== '' ? '?tag=' . rawurlencode($tag) : ($pg > 1 ? '?page=' . $pg : ''));
            $inject['<div id="blog-root"></div>'] = '<div id="blog-root" data-ssr="1">' . seo_blog_list_html($pg, $tag) . '</div>';
            $m['head'] .= '<link rel="alternate" type="application/rss+xml" title="' . seo_h('وبلاگ ' . $site) . '" href="' . seo_h(seo_url('api/index.php?r=feed.blog')) . '">';
        }
    } elseif ($page === 'services') {
        $inject['<div id="service-sections"></div>'] = '<div id="service-sections">' . seo_services_list() . '</div>';
    } elseif ($page === 'shop') {
        $inject['<div data-view="shop"></div>'] = '<div data-view="shop">' . seo_shop_list() . '</div>';
    } elseif ($page === '404') {
        $status = 404;
        $m['noindex'] = true;
    }
    if (isset($titles[$page]) && !in_array($page, ['service', 'blog'], true) && empty($_GET['product'])) $m['ld'][] = seo_crumbs_ld([['خانه', ''], [$titles[$page], $page . '.html']]);
    if (!empty($seo['noindex'])) $m['noindex'] = true;

    // ---- build <head> additions
    $title = $m['title'] ?: null;
    $desc = $m['desc'] ?: null;
    if ($title) $html = preg_replace('#<title>.*?</title>#s', '<title>' . seo_h($title) . '</title>', $html, 1);
    else $title = preg_match('#<title>(.*?)</title>#s', $html, $tm) ? html_entity_decode($tm[1]) : $site;
    if ($desc) $html = preg_replace('#<meta name="description" content="[^"]*">#', '<meta name="description" content="' . seo_h($desc) . '">', $html, 1);
    else $desc = preg_match('#<meta name="description" content="([^"]*)">#', $html, $dm) ? html_entity_decode($dm[1]) : '';
    $canon = seo_url($m['canonical']);
    $img = $m['image'] ?: ($seo['ogImage'] ?: seo_url('assets/img/og.png'));
    $head = "\n  " . '<link rel="canonical" href="' . seo_h($canon) . '">'
        . ($m['noindex'] ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">')
        . '<meta property="og:locale" content="fa_IR"><meta property="og:site_name" content="' . seo_h($site) . '"><meta property="og:type" content="' . $m['type'] . '">'
        . '<meta property="og:title" content="' . seo_h($title) . '"><meta property="og:description" content="' . seo_h($desc) . '"><meta property="og:url" content="' . seo_h($canon) . '"><meta property="og:image" content="' . seo_h($img) . '">'
        . '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' . seo_h($title) . '"><meta name="twitter:description" content="' . seo_h($desc) . '"><meta name="twitter:image" content="' . seo_h($img) . '">'
        . (!empty($seo['googleVerify']) ? '<meta name="google-site-verification" content="' . seo_h($seo['googleVerify']) . '">' : '')
        . (!empty($seo['bingVerify']) ? '<meta name="msvalidate.01" content="' . seo_h($seo['bingVerify']) . '">' : '')
        . $m['head'] . implode('', array_map('seo_ld', $m['ld']));
    if (!empty($seo['gaId']) && preg_match('/^G-[A-Z0-9]+$/', $seo['gaId'])) {
        $head .= '<script async src="https://www.googletagmanager.com/gtag/js?id=' . $seo['gaId'] . '"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","' . $seo['gaId'] . '");</script>';
    }
    if (!empty($seo['headCode'])) $head .= "\n" . $seo['headCode'];
    $html = str_replace('</head>', $head . "\n</head>", $html);
    foreach ($inject as $from => $to) $html = str_replace($from, $to, $html);
    $html = str_replace('<footer id="site-footer"></footer>', '<footer id="site-footer">' . seo_footer_html() . '</footer>', $html);

    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    echo $html;
} catch (Throwable $e) {
    error_log('[BEHIX] seo: ' . $e->getMessage() . ' @ ' . $e->getLine());
    if ($special !== null) { http_response_code(503); exit; }
    seo_raw(is_file($file) ? $file : __DIR__ . '/index.html');
}

// Client fallback: the page asks for its server-rendered block when the host has no URL rewriting
function seo_fragment(string $what): void
{
    header('Content-Type: text/html; charset=utf-8');
    if ($what === 'service' && ($s = seo_service((string) ($_GET['id'] ?? '')))) exit(seo_service_html($s));
    if ($what === 'blog') {
        $slug = (string) ($_GET['p'] ?? '');
        if ($slug !== '') {
            $post = row("SELECT * FROM posts WHERE slug = ? AND status = 'published' AND published_at <= ?", [$slug, gmdate('Y-m-d H:i:s')]);
            exit($post ? seo_post_html($post) : '<section class="container page-hero"><h1>مطلب پیدا نشد</h1><p><a class="brand" href="blog.html">بازگشت به وبلاگ</a></p></section>');
        }
        exit(seo_blog_list_html(max(1, (int) ($_GET['page'] ?? 1)), mb_substr(trim((string) ($_GET['tag'] ?? '')), 0, 60)));
    }
    http_response_code(404);
    exit;
}
