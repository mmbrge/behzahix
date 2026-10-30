<?php
// BEHIX — blog: SEO audit of a post and importing a ready article package
// (article.html + images, as a .zip or a single .html file).
if (!defined('BX')) { http_response_code(403); exit; }

// ------------------------------------------------------------------ text helpers
// Persian text normalised for matching: Arabic ي/ك → ی/ک, half-space → space, lower case
function blog_norm(string $s): string
{
    $s = strtr($s, ['ي' => 'ی', 'ك' => 'ک', 'ى' => 'ی', "\u{200C}" => ' ', "\u{00A0}" => ' ']);
    return trim(preg_replace('/\s+/u', ' ', mb_strtolower(en_digits($s))));
}
function blog_words(string $text): array
{
    return preg_split('/\s+/u', blog_norm($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
}
function blog_count(string $hay, string $needle): int
{
    $needle = blog_norm($needle);
    return $needle === '' ? 0 : substr_count(' ' . blog_norm($hay) . ' ', $needle);
}
function blog_has(string $hay, string $needle): bool
{
    return blog_count($hay, $needle) > 0;
}
// DOM of an HTML fragment (UTF-8 safe on PHP 7.4 – 8.4)
function blog_dom(string $html): DOMDocument
{
    $d = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $d->loadHTML('<?xml encoding="UTF-8"><html><body>' . $html . '</body></html>', LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $d;
}
function blog_inner(DOMNode $n): string
{
    $out = '';
    foreach ($n->childNodes as $c) $out .= $n->ownerDocument->saveHTML($c);
    return $out;
}

// ------------------------------------------------------------------ SEO audit
// $p: title, seoTitle, seoDesc, slug, body, excerpt, focus, category, tags (array), cover (bool), id
// Returns score 0–100 and checks [key, status ok|warn|bad, text, tip].
function post_seo_audit(array $p): array
{
    require_once __DIR__ . '/seo.php';
    $site = seo_site();
    $title = trim((string) ($p['title'] ?? ''));
    $seoTitle = trim((string) ($p['seoTitle'] ?? '')) ?: $title;
    $fullTitle = $seoTitle . ' | ' . $site; // what the page's <title> becomes
    $desc = trim((string) ($p['seoDesc'] ?? ''));
    $slug = trim((string) ($p['slug'] ?? '')) ?: post_slug($title);
    $focus = trim((string) ($p['focus'] ?? ''));
    $body = (string) ($p['body'] ?? '');
    $id = (int) ($p['id'] ?? 0);
    $dom = blog_dom($body);
    $text = trim(html_entity_decode(strip_tags(preg_replace('#<(br|/p|/h[2-6]|/li|/td|/th|/blockquote|/figcaption)[^>]*>#i', ' ', $body)), ENT_QUOTES, 'UTF-8'));
    $words = count(blog_words($text));
    $C = [];
    $add = function (string $k, string $st, string $txt, string $tip = '') use (&$C) { $C[] = ['key' => $k, 'status' => $st, 'text' => $txt, 'tip' => $tip]; };
    $fa = 'fa_digits';

    // focus keyword
    if ($focus === '') $add('focus', 'bad', 'کلمه کلیدی اصلی مشخص نشده است.', 'عبارتی را که می‌خواهید با آن در گوگل پیدا شوید (مثلاً «طراحی لوگو») بنویسید تا بقیه بررسی‌ها دقیق شود.');
    else {
        $other = val('SELECT title FROM posts WHERE id <> ? AND focus_kw <> \'\' AND focus_kw = ? LIMIT 1', [$id, $focus]);
        if ($other) $add('cannibal', 'warn', "مطلب «{$other}» هم همین کلمه کلیدی را دارد.", 'دو مطلب با یک کلمه کلیدی با هم رقابت می‌کنند؛ برای این یکی عبارت دیگری انتخاب کنید یا دو مطلب را ادغام کنید.');
    }
    // title
    $tl = mb_strlen($fullTitle);
    if ($tl < 30) $add('title-len', 'warn', 'عنوان گوگل کوتاه است (' . $fa($tl) . ' کاراکتر).', 'بین ۳۰ تا ۶۵ کاراکتر (همراه نام سایت) بهترین نمایش را دارد.');
    elseif ($tl > 65) $add('title-len', 'warn', 'عنوان گوگل بلند است (' . $fa($tl) . ' کاراکتر با نام سایت) و در نتایج بریده می‌شود.', 'در «عنوان در گوگل» نسخه کوتاه‌تری بنویسید؛ مهم‌ترین کلمه‌ها اول بیایند.');
    else $add('title-len', 'ok', 'طول عنوان گوگل مناسب است (' . $fa($tl) . ' کاراکتر).');
    if ($focus !== '') {
        $pos = mb_strpos(blog_norm($seoTitle), blog_norm($focus));
        if ($pos === false) $add('title-kw', 'bad', 'کلمه کلیدی در عنوان نیست.', 'کلمه کلیدی را در عنوان (ترجیحاً اول آن) بیاورید.');
        elseif ($pos > mb_strlen($seoTitle) / 2) $add('title-kw', 'warn', 'کلمه کلیدی در نیمه دوم عنوان آمده است.', 'هرچه کلمه کلیدی به ابتدای عنوان نزدیک‌تر باشد بهتر است.');
        else $add('title-kw', 'ok', 'کلمه کلیدی در ابتدای عنوان آمده است.');
    }
    $dup = val('SELECT title FROM posts WHERE id <> ? AND (title = ? OR (seo_title <> \'\' AND seo_title = ?)) LIMIT 1', [$id, $title, $seoTitle]);
    if ($dup) $add('title-dup', 'bad', "عنوان با مطلب «{$dup}» یکی است.", 'گوگل عنوان تکراری را محتوای تکراری حساب می‌کند؛ عنوان را تغییر دهید.');
    // meta description
    $dl = mb_strlen($desc);
    if ($dl === 0) $add('desc', 'bad', 'توضیحات متا خالی است.', 'یک جمله ۱۲۰ تا ۱۶۰ کاراکتری بنویسید که کلمه کلیدی و فایده مطلب برای خواننده را بگوید.');
    elseif ($dl < 110) $add('desc', 'warn', 'توضیحات متا کوتاه است (' . $fa($dl) . ' کاراکتر).', 'بین ۱۲۰ تا ۱۶۰ کاراکتر بهترین است.');
    elseif ($dl > 165) $add('desc', 'warn', 'توضیحات متا بلند است (' . $fa($dl) . ' کاراکتر) و بریده می‌شود.', 'به ۱۲۰ تا ۱۶۰ کاراکتر کوتاهش کنید.');
    else $add('desc', 'ok', 'طول توضیحات متا مناسب است (' . $fa($dl) . ' کاراکتر).');
    if ($focus !== '' && $dl > 0) $add('desc-kw', blog_has($desc, $focus) ? 'ok' : 'warn', blog_has($desc, $focus) ? 'کلمه کلیدی در توضیحات متا هست.' : 'کلمه کلیدی در توضیحات متا نیست.', 'گوگل کلمه جستجوشده را در توضیحات پررنگ نشان می‌دهد و نرخ کلیک بیشتر می‌شود.');
    // slug
    $sl = mb_strlen($slug);
    if ($sl > 75) $add('slug', 'warn', 'آدرس مطلب طولانی است (' . $fa($sl) . ' کاراکتر).', 'آدرس کوتاه (۳ تا ۶ کلمه) و شامل کلمه کلیدی بهتر است.');
    elseif ($focus !== '' && mb_strpos($slug, post_slug($focus)) === false) $add('slug', 'warn', 'کلمه کلیدی در آدرس مطلب نیست.', 'در فیلد «آدرس» کلمه کلیدی را با خط تیره بنویسید، مثلاً ' . post_slug($focus));
    else $add('slug', 'ok', 'آدرس مطلب کوتاه و مرتبط است.');
    // length
    if ($words < 300) $add('words', 'bad', 'متن خیلی کوتاه است (' . $fa($words) . ' کلمه).', 'مطالب زیر ۳۰۰ کلمه معمولاً در گوگل رتبه نمی‌گیرند؛ حداقل ۸۰۰ کلمه بنویسید.');
    elseif ($words < 800) $add('words', 'warn', 'طول متن ' . $fa($words) . ' کلمه است.', 'برای موضوعات رقابتی ۸۰۰ تا ۲۰۰۰ کلمه کامل‌تر و بهتر است.');
    else $add('words', 'ok', 'طول متن خوب است (' . $fa($words) . ' کلمه).');
    // keyword in the opening and density
    if ($focus !== '' && $words) {
        $first = '';
        foreach ($dom->getElementsByTagName('p') as $para) { $first = $para->textContent; if (trim($first) !== '') break; }
        $add('intro-kw', blog_has($first, $focus) ? 'ok' : 'warn', blog_has($first, $focus) ? 'کلمه کلیدی در پاراگراف اول آمده است.' : 'کلمه کلیدی در پاراگراف اول نیست.', 'در همان چند جمله اول بگویید مطلب درباره چیست و کلمه کلیدی را بیاورید.');
        $n = blog_count($text, $focus);
        $dens = $n * max(1, count(blog_words($focus))) / $words * 100;
        $d = $fa(str_replace('.', '٫', number_format($dens, 1)));
        if ($n === 0) $add('density', 'bad', 'کلمه کلیدی در متن تکرار نشده است.', 'کلمه کلیدی و هم‌معنی‌هایش را به‌طور طبیعی در متن بیاورید.');
        elseif ($dens > 3) $add('density', 'bad', "کلمه کلیدی بیش از حد تکرار شده ({$d}٪).", 'تکرار زیاد (keyword stuffing) از نظر گوگل اسپم است؛ بعضی را با هم‌معنی جایگزین کنید.');
        elseif ($dens < 0.4) $add('density', 'warn', "کلمه کلیدی کم تکرار شده ({$d}٪، " . $fa($n) . ' بار).', 'حدود ۰٫۵ تا ۲٫۵ درصد، طبیعی و در جاهای مهم (تیترها، اول و آخر متن).');
        else $add('density', 'ok', "تکرار کلمه کلیدی طبیعی است ({$d}٪، " . $fa($n) . ' بار).');
    }
    // headings
    $h1 = $dom->getElementsByTagName('h1')->length;
    $h2s = []; $hs = [];
    foreach ((new DOMXPath($dom))->query('//h2|//h3|//h4') as $h) { $hs[] = (int) substr($h->nodeName, 1); if ($h->nodeName === 'h2') $h2s[] = $h->textContent; }
    if ($h1) $add('h1', 'bad', 'داخل متن تیتر H1 هست.', 'صفحه یک H1 دارد (عنوان مطلب)؛ تیترهای داخل متن را H2 و H3 کنید.');
    if (count($h2s) < 2) $add('h2', $words > 500 ? 'bad' : 'warn', 'متن تیتر فرعی (H2) کافی ندارد.', 'هر ۲۵۰ تا ۳۵۰ کلمه یک تیتر H2 بگذارید تا خواننده و گوگل ساختار مطلب را ببینند.');
    else $add('h2', 'ok', 'ساختار تیترها خوب است (' . $fa(count($h2s)) . ' تیتر H2).');
    $skip = false;
    for ($i = 1; $i < count($hs); $i++) if ($hs[$i] > $hs[$i - 1] + 1) $skip = true;
    if ($hs && $hs[0] > 2) $skip = true;
    if ($skip) $add('h-order', 'warn', 'ترتیب تیترها پرش دارد (مثلاً H4 بعد از H2).', 'زیرتیترها به ترتیب H2 ← H3 ← H4 بیایند.');
    if ($focus !== '' && $h2s) {
        $in = false; foreach ((new DOMXPath($dom))->query('//h2|//h3') as $h) if (blog_has($h->textContent, $focus)) $in = true;
        $add('h-kw', $in ? 'ok' : 'warn', $in ? 'کلمه کلیدی در یکی از تیترها آمده است.' : 'کلمه کلیدی در هیچ تیتر H2/H3 نیست.', 'حداقل در یک تیتر فرعی کلمه کلیدی یا شکل نزدیکش را بیاورید.');
    }
    // images
    $imgs = $dom->getElementsByTagName('img');
    $noAlt = 0; $altKw = false; $ext = 0; $noSize = 0;
    foreach ($imgs as $im) {
        $alt = trim($im->getAttribute('alt'));
        if ($alt === '') $noAlt++;
        if ($focus !== '' && blog_has($alt, $focus)) $altKw = true;
        if (preg_match('#^(https?:)?//#i', $im->getAttribute('src'))) $ext++;
        if (!$im->getAttribute('width') || !$im->getAttribute('height')) $noSize++;
    }
    if (empty($p['cover'])) $add('cover', 'warn', 'تصویر شاخص ندارد.', 'تصویر شاخص ۱۲۰۰×۶۷۵ در گوگل دیسکاور، نتایج تصویری و اشتراک‌گذاری نمایش داده می‌شود.');
    else $add('cover', 'ok', 'تصویر شاخص دارد.');
    if (!$imgs->length) $add('images', $words > 600 ? 'warn' : 'ok', 'داخل متن تصویری نیست.', 'برای مطالب بلند ۲ تا ۵ تصویر یا نمودار مرتبط، خواندن را راحت‌تر و زمان ماندن را بیشتر می‌کند.');
    elseif ($noAlt) $add('alt', 'bad', $fa($noAlt) . ' تصویر متن جایگزین (alt) ندارد.', 'برای هر تصویر یک توضیح کوتاه بنویسید؛ گوگل تصویر را با همین متن می‌فهمد.');
    else $add('alt', 'ok', 'همه ' . $fa($imgs->length) . ' تصویر متن جایگزین دارند.');
    if ($imgs->length && $focus !== '' && !$altKw) $add('alt-kw', 'warn', 'کلمه کلیدی در متن جایگزین هیچ تصویری نیست.', 'در alt حداقل یکی از تصاویر کلمه کلیدی را بیاورید.');
    if ($ext) $add('img-ext', 'warn', $fa($ext) . ' تصویر از سایت دیگری بارگذاری می‌شود.', 'تصویرها را روی هاست خودتان آپلود کنید تا سرعت و پایداری صفحه دست شما باشد.');
    if ($noSize) $add('img-size', 'warn', $fa($noSize) . ' تصویر عرض و ارتفاع مشخص ندارد.', 'تصویرهای ایمپورت‌شده خودکار اندازه می‌گیرند؛ برای بقیه جابه‌جایی صفحه هنگام بارگذاری (CLS) بیشتر می‌شود.');
    // links
    $in = 0; $out = 0; $broken = [];
    $svc = []; foreach (catalog(true) as $c) foreach ($c['services'] as $s) $svc[$s['id']] = 1;
    foreach ($dom->getElementsByTagName('a') as $a) {
        $href = trim($a->getAttribute('href'));
        if ($href === '' || $href[0] === '#') continue;
        if (preg_match('#^(https?:)?//#i', $href)) {
            $host = parse_url($href, PHP_URL_HOST);
            if ($host && $host === parse_url(seo_base(), PHP_URL_HOST)) $in++; else $out++;
            continue;
        }
        if (preg_match('#^(mailto|tel):#i', $href)) continue;
        $in++;
        if (preg_match('#^service\.html\?id=([^&]+)#', $href, $m) && !isset($svc[rawurldecode($m[1])])) $broken[] = $href;
        elseif (preg_match('#^blog\.html\?p=([^&]+)#', $href, $m) && !val("SELECT id FROM posts WHERE slug = ? AND status = 'published'", [rawurldecode($m[1])])) $broken[] = $href;
        elseif (preg_match('#^([a-z0-9-]+\.html)#', $href, $m) && !is_file(dirname(__DIR__, 2) . '/' . $m[1])) $broken[] = $href;
    }
    if ($in === 0) $add('links-in', 'bad', 'لینک داخلی ندارد.', 'به ۲ تا ۵ صفحه مرتبط سایت (خدمت، استودیو، مطلب دیگر) لینک بدهید؛ هم به سئو کمک می‌کند هم به فروش.');
    elseif ($in < 2) $add('links-in', 'warn', 'فقط یک لینک داخلی دارد.', 'حداقل ۲ لینک داخلی مرتبط بگذارید.');
    else $add('links-in', 'ok', $fa($in) . ' لینک داخلی دارد.');
    if ($broken) $add('links-broken', 'bad', 'لینک‌های خراب: ' . implode('، ', array_slice($broken, 0, 4)), 'این صفحه‌ها وجود ندارند یا منتشر نشده‌اند؛ آدرس را درست کنید.');
    if ($out) $add('links-out', 'ok', $fa($out) . ' لینک به منابع بیرونی دارد.');
    // readability: long paragraphs
    $long = 0; foreach ($dom->getElementsByTagName('p') as $para) if (count(blog_words($para->textContent)) > 150) $long++;
    if ($long) $add('paras', 'warn', $fa($long) . ' پاراگراف بیش از ۱۵۰ کلمه است.', 'پاراگراف‌های کوتاه (۳ تا ۵ جمله) در موبایل راحت‌تر خوانده می‌شوند.');
    // excerpt, category, tags
    $add('excerpt', trim((string) ($p['excerpt'] ?? '')) !== '' ? 'ok' : 'warn', trim((string) ($p['excerpt'] ?? '')) !== '' ? 'خلاصه مطلب نوشته شده است.' : 'خلاصه مطلب خالی است.', 'خلاصه زیر عنوان و در لیست وبلاگ نمایش داده می‌شود.');
    if (trim((string) ($p['category'] ?? '')) === '') $add('category', 'warn', 'دسته مطلب مشخص نیست.', 'دسته‌بندی، مطالب هم‌موضوع را به هم وصل می‌کند.');

    // score: bad = 0, warn = half, ok = full; heavier weight on the essentials
    $weight = ['focus' => 3, 'title-kw' => 3, 'title-len' => 2, 'title-dup' => 3, 'desc' => 2, 'words' => 3, 'h2' => 2, 'h1' => 2, 'alt' => 2, 'links-in' => 2, 'links-broken' => 2, 'density' => 2];
    $tot = 0; $got = 0;
    foreach ($C as $c) {
        if ($c['key'] === 'links-out') continue;
        $w = $weight[$c['key']] ?? 1;
        $tot += $w;
        $got += $c['status'] === 'ok' ? $w : ($c['status'] === 'warn' ? $w / 2 : 0);
    }
    usort($C, function ($a, $b) { $o = ['bad' => 0, 'warn' => 1, 'ok' => 2]; return $o[$a['status']] <=> $o[$b['status']]; });
    return ['score' => $tot ? (int) round($got / $tot * 100) : 0, 'words' => $words, 'checks' => $C];
}
function a_post_audit(): void
{
    require_staff('blog');
    $tags = array_values(array_filter(array_map('trim', preg_split('/[,،#]/u', str_in('tags', 500)))));
    out(post_seo_audit(['id' => int_in('id'), 'title' => str_in('title', 255), 'seoTitle' => str_in('seoTitle', 255), 'seoDesc' => str_in('seoDesc', 400),
        'slug' => str_in('slug', 190), 'focus' => str_in('focus', 120), 'excerpt' => str_in('excerpt', 600), 'category' => str_in('category', 80), 'tags' => $tags,
        'cover' => (bool) in('cover'), 'body' => (string) in('body', '')]));
}

// ------------------------------------------------------------------ import
// Saves an image from the package; big pictures are scaled down to 1600px wide.
function blog_store_image(string $bin, string $name, int $postId, int $owner): ?array
{
    $info = @getimagesizefromstring($bin);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true) || $info[0] * $info[1] > 30000000) return null;
    [$w, $h] = $info;
    if ($w > 1600 && $info[2] !== IMAGETYPE_GIF && function_exists('imagecreatefromstring') && ($im = @imagecreatefromstring($bin))) {
        $nh = (int) round($h * 1600 / $w);
        $dst = imagecreatetruecolor(1600, $nh);
        $png = $info[2] === IMAGETYPE_PNG;
        if ($png) { imagealphablending($dst, false); imagesavealpha($dst, true); }
        imagecopyresampled($dst, $im, 0, 0, 0, 0, 1600, $nh, $w, $h);
        ob_start(); $png ? imagepng($dst, null, 8) : imagejpeg($dst, null, 85); $bin = (string) ob_get_clean();
        imagedestroy($im); imagedestroy($dst);
        [$w, $h] = [1600, $nh];
    }
    $mime = image_type_to_mime_type($info[2]);
    $dir = dirname(__DIR__, 2) . '/uploads/' . gmdate('Y/m');
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('پوشه آپلود قابل ساخت نیست.', 500);
    $stored = gmdate('Y/m') . '/' . bin2hex(random_bytes(12)) . '.bin';
    if (file_put_contents(dirname(__DIR__, 2) . '/uploads/' . $stored, $bin) === false) fail('ذخیره تصویر ناموفق بود.', 500);
    $id = insert('files', ['owner_id' => $owner, 'kind' => 'blog', 'ref_id' => $postId, 'name' => mb_substr(basename($name), 0, 180), 'path' => $stored, 'size' => strlen($bin), 'mime' => $mime, 'created_at' => now()]);
    return ['id' => $id, 'w' => $w, 'h' => $h];
}
// Reads the uploaded package → [html, images by normalised path]
function blog_package(array $f): array
{
    $name = strtolower((string) $f['name']);
    if (preg_match('/\.html?$/', $name)) {
        if ($f['size'] > 5 * 1024 * 1024) fail('فایل HTML بزرگ‌تر از ۵ مگابایت است.', 422);
        return [(string) file_get_contents($f['tmp_name']), []];
    }
    if (!preg_match('/\.zip$/', $name)) fail('فایل مقاله باید ‎.zip (همراه تصاویر) یا ‎.html باشد.', 422);
    if (!class_exists('ZipArchive')) fail('افزونه zip روی هاست فعال نیست؛ از Select PHP Version در cPanel تیک zip را بزنید یا فایل HTML تنها را ایمپورت کنید.', 422);
    $z = new ZipArchive();
    if ($z->open($f['tmp_name']) !== true) fail('فایل zip خراب است یا باز نمی‌شود.', 422);
    if ($z->numFiles > 80) fail('تعداد فایل‌های بسته مقاله زیاد است (حداکثر ۸۰).', 422);
    $html = null; $imgs = []; $total = 0;
    for ($i = 0; $i < $z->numFiles; $i++) {
        $st = $z->statIndex($i);
        $path = str_replace('\\', '/', (string) $st['name']);
        if (substr($path, -1) === '/' || strpos($path, '__MACOSX/') === 0 || strpos($path, '..') !== false) continue;
        $total += (int) $st['size'];
        if ($total > 60 * 1024 * 1024) fail('حجم بسته مقاله بعد از باز شدن بیشتر از ۶۰ مگابایت است.', 422);
        if (preg_match('/\.html?$/i', $path)) {
            // article.html wins; otherwise the first page in the package
            if ($html === null || strtolower(basename($path)) === 'article.html') $html = (string) $z->getFromIndex($i);
        } elseif (preg_match('/\.(jpe?g|png|webp|gif)$/i', $path) && $st['size'] <= 12 * 1024 * 1024) {
            $imgs[strtolower($path)] = $i;
        }
    }
    if ($html === null) { $z->close(); fail('داخل فایل zip صفحه article.html پیدا نشد.', 422); }
    $out = [];
    foreach ($imgs as $p => $i) $out[$p] = (string) $z->getFromIndex($i);
    $z->close();
    return [$html, $out];
}
// Finds the image a src points to inside the package («images/a.jpg», «./images/a.jpg», «a.jpg»)
function blog_pkg_image(array $imgs, string $src): ?string
{
    $s = strtolower(rawurldecode(preg_replace('#^\./#', '', trim($src))));
    if (isset($imgs[$s])) return $s;
    foreach (array_keys($imgs) as $k) if (substr($k, -strlen('/' . $s)) === '/' . $s || basename($k) === basename($s)) return $k;
    return null;
}
function a_post_import(): void
{
    $u = require_staff('blog');
    rate_limit('post-import', 30, 3600);
    require_once __DIR__ . '/seo.php';
    $f = uploaded_files('file')[0] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('فایل مقاله را انتخاب کنید.', 422);
    [$html, $imgs] = blog_package($f);
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8">' . preg_replace('/^\xEF\xBB\xBF/', '', $html), LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($prev);
    $xp = new DOMXPath($doc);
    $meta = function (string $n) use ($xp) {
        foreach ($xp->query('//meta[@name or @property]') as $m) if (strtolower($m->getAttribute('name') ?: $m->getAttribute('property')) === $n) return trim($m->getAttribute('content'));
        return '';
    };
    $metaAll = function (string $n) use ($xp) {
        $o = []; foreach ($xp->query('//meta[@name or @property]') as $m) if (strtolower($m->getAttribute('name') ?: $m->getAttribute('property')) === $n) $o[] = trim($m->getAttribute('content'));
        return $o;
    };
    $root = $xp->query('//article')->item(0) ?: ($doc->getElementsByTagName('body')->item(0) ?: $doc);
    // page chrome never belongs to the article
    foreach (['script', 'style', 'nav', 'header', 'footer', 'link', 'noscript'] as $t) foreach (iterator_to_array($root->getElementsByTagName($t)) as $n) $n->parentNode->removeChild($n);
    $h1 = $root->getElementsByTagName('h1')->item(0);
    $docTitle = trim((string) ($xp->query('//title')->item(0)->textContent ?? ''));
    $title = trim(preg_replace('/\s+/u', ' ', $h1 ? $h1->textContent : $docTitle));
    if ($h1) $h1->parentNode->removeChild($h1);
    if (mb_strlen($title) < 3) fail('عنوان مقاله پیدا نشد؛ عنوان را داخل تگ h1 بنویسید.', 422);
    $seoTitle = $meta('behix:seo-title') ?: ($docTitle !== $title ? $docTitle : '');
    $tags = $meta('behix:tags') !== '' ? preg_split('/[,،]/u', $meta('behix:tags')) : ($metaAll('article:tag') ?: preg_split('/[,،]/u', $meta('keywords')));
    $tags = array_values(array_unique(array_filter(array_map('trim', (array) $tags))));
    $warn = [];

    // the post is created first so images can be attached to it
    $slug = post_slug($meta('behix:slug') ?: $title);
    $base = $slug;
    for ($i = 2; val('SELECT id FROM posts WHERE slug = ?', [$slug]); $i++) $slug = $base . '-' . $i;
    if ($slug !== $base) $warn[] = "آدرس «{$base}» قبلاً استفاده شده بود؛ «{$slug}» گذاشته شد.";
    $id = insert('posts', ['title' => mb_substr($title, 0, 255), 'slug' => $slug, 'excerpt' => '', 'body' => '', 'category' => mb_substr($meta('behix:category') ?: $meta('article:section'), 0, 80),
        'tags' => jenc($tags), 'status' => 'draft', 'seo_title' => mb_substr($seoTitle, 0, 255), 'seo_desc' => mb_substr($meta('description'), 0, 400), 'focus_kw' => mb_substr($meta('behix:focus'), 0, 120),
        'author_id' => $u['id'], 'views' => 0, 'created_at' => now(), 'updated_at' => now()]);
    try {
        $saved = [];
        $put = function (string $src) use (&$saved, $imgs, $id, $u) {
            $k = blog_pkg_image($imgs, $src);
            if ($k === null) return null;
            if (!isset($saved[$k])) $saved[$k] = blog_store_image($imgs[$k], $k, $id, (int) $u['id']);
            return $saved[$k];
        };
        foreach (iterator_to_array($root->getElementsByTagName('img')) as $im) {
            $src = trim($im->getAttribute('src'));
            if (preg_match('#^(https?:)?//#i', $src)) { $warn[] = 'تصویر بیرونی دست‌نخورده ماند: ' . mb_substr($src, 0, 80); continue; }
            $r = $src !== '' && strncmp($src, 'data:', 5) !== 0 ? $put($src) : null;
            if (!$r) { $warn[] = 'تصویر «' . mb_substr($src, 0, 60) . '» در بسته پیدا نشد یا معتبر نبود و حذف شد.'; $im->parentNode->removeChild($im); continue; }
            $im->setAttribute('src', 'api/index.php?r=file&id=' . $r['id']);
            $im->setAttribute('width', (string) $r['w']);
            $im->setAttribute('height', (string) $r['h']);
        }
        // cover: behix:cover / og:image, else the first picture in the package
        $cover = null;
        $cs = $meta('behix:cover') ?: $meta('og:image');
        if ($cs !== '' && !preg_match('#^(https?:)?//#i', $cs)) $cover = $put($cs);
        if (!$cover && $cs === '') foreach (array_keys($imgs) as $k) if (preg_match('/cover|shakhes|featured/i', basename($k))) { $cover = $put($k); break; }
        $body = seo_clean_html(blog_inner($root));
        $excerpt = $meta('behix:excerpt');
        if ($excerpt === '') foreach (blog_dom($body)->getElementsByTagName('p') as $para) { $t = trim($para->textContent); if ($t !== '') { $excerpt = seo_cut($t, 280); break; } }
        $status = in_array(strtolower($meta('behix:status')), ['published', 'publish'], true) ? 'published' : 'draft';
        update('posts', ['body' => $body, 'excerpt' => mb_substr($excerpt, 0, 600), 'cover' => $cover ? (string) $cover['id'] : null, 'status' => $status,
            'published_at' => $status === 'published' ? now() : null, 'updated_at' => now()], 'id = ?', [$id]);
    } catch (Throwable $e) {
        foreach (rows("SELECT id FROM files WHERE kind = 'blog' AND ref_id = ?", [$id]) as $fr) delete_file_row((int) $fr['id']);
        q('DELETE FROM posts WHERE id = ?', [$id]);
        throw $e;
    }
    $p = row('SELECT * FROM posts WHERE id = ?', [$id]);
    $audit = post_seo_audit(['id' => $id, 'title' => $p['title'], 'seoTitle' => $p['seo_title'], 'seoDesc' => $p['seo_desc'], 'slug' => $p['slug'], 'focus' => $p['focus_kw'],
        'excerpt' => $p['excerpt'], 'category' => $p['category'], 'tags' => $tags, 'cover' => (bool) $p['cover'], 'body' => $p['body']]);
    out(['ok' => true, 'id' => $id, 'title' => $p['title'], 'images' => count(array_filter($saved)), 'warnings' => $warn, 'audit' => $audit,
        'message' => 'مقاله ایمپورت شد' . ($p['status'] === 'published' ? ' و منتشر شد.' : ' و به‌صورت پیش‌نویس ذخیره شد؛ بررسی سئو را ببینید و منتشر کنید.')]);
}
