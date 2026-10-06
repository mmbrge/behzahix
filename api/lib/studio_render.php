<?php
// BEHIX — studio files are drawn only on the server. The browser gets a
// low-resolution watermarked preview image; the clean file is rendered from the
// saved design after the purchase (or a PRO allowance) is checked.
if (!defined('BX')) { http_response_code(403); exit; }

function studio_render_boot(): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    @ini_set('memory_limit', '384M');
    @set_time_limit(60);
    require_once dirname(__DIR__) . '/vendor/autoload.php';
    foreach (['canvas', 'common', 'tpl_card', 'tpl_post', 'tpl_resume', 'tpl_doc', 'tpl_slides', 'office'] as $f) require_once __DIR__ . "/render/$f.php";
}
function studio_doc_tpl(array $data): array
{
    $t = row('SELECT * FROM doc_templates WHERE id = ? AND active = 1', [(int) ($data['templateId'] ?? 0)]);
    if (!$t) fail('قالب سند پیدا نشد.', 404);
    return $t;
}
// kind + data → canvas (for doc: preview keeps blanks visible)
function studio_canvas(string $kind, array $data, bool $preview, bool $sample = false): BxCanvas
{
    studio_render_boot();
    switch ($kind) {
        case 'resume': return resume_render($data);
        case 'card': return card_render($data, $sample);
        case 'post': return post_render($data);
        case 'doc': return doc_render(studio_doc_tpl($data), is_array($data['values'] ?? null) ? $data['values'] : [], $preview, $data);
        case 'slides': return slides_canvas(slides_model($data));
    }
    fail('نوع طرح نامعتبر است.', 422);
}
function studio_wm_text(): string { return 'پیش‌نمایش ' . (setting('general', 'siteName') ?: 'BEHIX'); }
// Preview pixel width per kind (deliberately below print quality)
const STUDIO_PREVIEW_PX = ['resume' => 640, 'doc' => 640, 'card' => 620, 'post' => 540, 'slides' => 420];

function studio_preview_images(BxCanvas $c, string $kind, int $max = 3): array
{
    $out = [];
    $n = min(count($c->pages), $max);
    for ($i = 0; $i < $n; $i++) {
        $c->pages[$i]['ops'][] = ['wm', studio_wm_text()];
        // many slides: cheaper single-sample render keeps typing responsive
        $out[] = 'data:image/jpeg;base64,' . base64_encode($kind === 'slides' && $n > 6 ? $c->preview($i, STUDIO_PREVIEW_PX[$kind], 1, 66) : $c->preview($i, STUDIO_PREVIEW_PX[$kind] ?? 600));
    }
    return $out;
}
// Public: live preview while editing (works before login too)
function r_studio_preview(): void
{
    if (function_exists('ip_limit')) ip_limit('studio-preview', 1200, 3600);
    rate_limit('studio-preview', 240, 600);
    $kind = str_in('kind', 20);
    if (!isset(STUDIO_KINDS[$kind])) fail('نوع طرح نامعتبر است.', 422);
    $data = in('data', []);
    if (!is_array($data) || strlen(jenc($data)) > 4 * 1024 * 1024) fail('اطلاعات طرح نامعتبر یا خیلی حجیم است.', 422);
    studio_render_boot();
    $data = bx_clean($data);
    $c = studio_canvas($kind, $data, true, true);
    $max = $kind === 'slides' ? 45 : 3;
    out(['pages' => studio_preview_images($c, $kind, $max), 'total' => count($c->pages)]);
}

// Small thumbnail stored with the design for the «my designs» list
function studio_thumb(string $kind, array $data): ?string
{
    try {
        $c = studio_canvas($kind, $data, true, true);
        $c->pages[0]['ops'][] = ['wm', studio_wm_text()];
        $im = $c->toGd(0, $kind === 'card' || $kind === 'slides' ? 300 : 220, 1, true);
        ob_start(); imagejpeg($im, null, 70); imagedestroy($im);
        return 'data:image/jpeg;base64,' . base64_encode((string) ob_get_clean());
    } catch (Throwable $e) { return null; }
}

// Formats each kind can be downloaded as
const STUDIO_FORMATS = [
    'resume' => ['pdf' => 'PDF چاپی A4', 'png' => 'تصویر PNG'],
    'doc' => ['pdf' => 'PDF', 'docx' => 'فایل Word قابل ویرایش'],
    'card' => ['pdf' => 'PDF چاپی ۹×۵ (رو و پشت)', 'png' => 'دو تصویر PNG ۳۰۰dpi (zip)'],
    'post' => ['png' => 'تصویر PNG با کیفیت کامل', 'jpg' => 'JPG سبک برای انتشار', 'pdf' => 'PDF'],
    'slides' => ['pptx' => 'پاورپوینت قابل ویرایش (pptx)', 'pdf' => 'PDF برای ارائه و چاپ'],
];
function studio_send(string $bin, string $name, string $mime): void
{
    while (ob_get_level()) ob_end_clean();
    $ascii = preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo($name, PATHINFO_FILENAME));
    $ext = pathinfo($name, PATHINFO_EXTENSION);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($bin));
    header("Content-Disposition: attachment; filename=\"behix-" . ($ascii ?: 'file') . ".$ext\"; filename*=UTF-8''" . rawurlencode($name));
    header('Cache-Control: private, no-store');
    echo $bin;
    exit;
}
// Logged-in owner downloads the final file. Needs a purchase or PRO allowance.
function a_studio_export(): void
{
    $u = require_user();
    rate_limit('studio-export', 40, 600);
    $it = row('SELECT * FROM studio_items WHERE id = ?', [int_in('id')]);
    if (!$it || ((int) $it['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin')) fail('طرح پیدا نشد.', 404);
    $kind = $it['kind'];
    $fmt = str_in('format', 8);
    if (!isset(STUDIO_FORMATS[$kind][$fmt])) $fmt = array_key_first(STUDIO_FORMATS[$kind]);
    if (!$it['paid']) {
        require_once __DIR__ . '/pro.php';
        if (!pro_active($u)) fail('برای دریافت فایل نهایی ابتدا طرح را خریداری کنید.', 402, 'unpaid');
        if ($u['role'] !== 'admin') {
            if (pro_studio_left($u) <= 0) fail('سهمیه فایل این ماه اشتراک شما تمام شده است؛ می‌توانید همین طرح را جداگانه بخرید.', 402, 'quota');
            usage_add('studio-file', (int) $u['id']);
        }
        update('studio_items', ['paid' => 1, 'price' => 0, 'paid_at' => now(), 'via' => 'pro'], 'id = ?', [$it['id']]);
    }
    studio_render_boot();
    $data = bx_clean(jdec($it['data'], []));
    $title = trim((string) $it['title']) ?: (STUDIO_KINDS[$kind] ?? 'file');
    $title = mb_substr(preg_replace('/[\\\\\/:*?"<>|]+/u', ' ', $title), 0, 60);
    if ($kind === 'slides' && $fmt === 'pptx') studio_send(pptx_build(slides_model($data), (string) ($data['font'] ?? 'Tahoma'), $title), "$title.pptx", 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    if ($kind === 'doc' && $fmt === 'docx') {
        $t = studio_doc_tpl($data);
        studio_send(docx_build(doc_blocks((string) $t['body'], is_array($data['values'] ?? null) ? $data['values'] : [], false), $t['title']), "$title.docx", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    $c = studio_canvas($kind, $data, false);
    if ($fmt === 'pdf') studio_send($c->pdf(), "$title.pdf", 'application/pdf');
    if ($kind === 'card' && $fmt === 'png') {
        studio_send(ox_zip(["$title-front.png" => $c->png(0, CARD_W, 2), "$title-back.png" => $c->png(1, CARD_W, 2)]), "$title.zip", 'application/zip');
    }
    $px = $kind === 'resume' ? 1654 : (int) $c->pages[0]['w'];
    if ($fmt === 'jpg') {
        $im = $c->toGd(0, $px, 2);
        ob_start(); imagejpeg($im, null, 90);
        studio_send((string) ob_get_clean(), "$title.jpg", 'image/jpeg');
    }
    studio_send($c->png(0, $px, 2), "$title.png", 'image/png');
}

// ------------------------------------------------------------------ ready-made templates for the shop
// Real, editable files built by the same engine (PowerPoint decks and Word
// resumes), created once under the admin account. Runs from the lazy cron.
function store_bytes(string $bin, string $name, string $kind, int $refId, int $owner, string $mime): int
{
    $dir = dirname(__DIR__, 2) . '/uploads/' . gmdate('Y/m');
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $stored = gmdate('Y/m') . '/' . bin2hex(random_bytes(12)) . '.bin';
    file_put_contents(dirname(__DIR__, 2) . '/uploads/' . $stored, $bin);
    return insert('files', ['owner_id' => $owner, 'kind' => $kind, 'ref_id' => $refId, 'name' => $name, 'path' => $stored, 'size' => strlen($bin), 'mime' => $mime, 'created_at' => now()]);
}
function seed_shop_templates(): void
{
    if ((int) val("SELECT COUNT(*) FROM settings WHERE k = 'tpl_seed' AND v = '1'")) return;
    $admin = (int) val("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    if (!$admin || !is_dir(dirname(__DIR__, 2) . '/uploads') || !is_writable(dirname(__DIR__, 2) . '/uploads')) return;
    q("INSERT INTO settings (k, v) VALUES ('tpl_seed', '1') ON DUPLICATE KEY UPDATE v = '1'");
    studio_render_boot();
    $S = fn ($type, $title, $text = '') => ['type' => $type, 'title' => $title, 'text' => $text, 'image' => ''];
    $decks = [
        'ارائه کاری و گزارش' => [$S('bullets', 'خلاصه', "مهم‌ترین نتایج\nچالش‌های اصلی\nبرنامه بعدی"), $S('numbers', 'شاخص‌های کلیدی', "۲۴۰ | مشتری فعال\n۹۸٪ | رضایت\n۳۵٪ | رشد"), $S('timeline', 'کارهای انجام‌شده', "فروردین | شروع\nتیر | فاز اول\nمهر | راه‌اندازی\nاسفند | جمع‌بندی"), $S('two', 'نقاط قوت و ضعف', "نقطه قوت ۱\nنقطه قوت ۲\nنقطه ضعف ۱\nنقطه ضعف ۲"), $S('section', 'برنامه سال آینده'), $S('bullets', 'اهداف', "هدف اول\nهدف دوم\nهدف سوم"), $S('quote', 'پیام پایانی', 'یک جمله کلیدی برای به خاطر سپردن.')],
        'ارائه استارتاپ و جذب سرمایه' => [$S('bullets', 'مسئله', "مشکل مشتری\nهزینه این مشکل"), $S('bullets', 'راه‌حل ما', "محصول ما چه می‌کند\nچرا بهتر است"), $S('numbers', 'اندازه بازار', "۲۰ هزار میلیارد | کل بازار\n۲ هزار میلیارد | بازار در دسترس\n۲۰۰ میلیارد | هدف"), $S('two', 'رقبا و مزیت ما', "رقیب الف\nرقیب ب\nمزیت ۱\nمزیت ۲"), $S('timeline', 'مسیر رشد', "فاز ۱ | محصول\nفاز ۲ | ۱۰۰۰ کاربر\nفاز ۳ | درآمد\nفاز ۴ | توسعه"), $S('bullets', 'تیم', "بنیان‌گذار — سابقه\nهم‌بنیان‌گذار — سابقه"), $S('numbers', 'درخواست سرمایه', "۵ میلیارد | مبلغ\n۱۸ ماه | زمان\n۱۰٪ | سهام")],
        'دفاع پایان‌نامه' => [$S('bullets', 'بیان مسئله', "اهمیت موضوع\nخلأ پژوهشی"), $S('bullets', 'اهداف و سؤالات', "هدف اصلی\nسؤال اول\nسؤال دوم"), $S('bullets', 'پیشینه پژوهش', "مطالعه ۱ — نتیجه\nمطالعه ۲ — نتیجه"), $S('timeline', 'روش تحقیق', "جامعه | نمونه‌گیری\nابزار | پرسشنامه\nتحلیل | آزمون آماری"), $S('numbers', 'یافته‌ها', "۰٫۰۱ | معناداری\n۸۵٪ | پایایی\n۳۸۴ | نمونه"), $S('bullets', 'نتیجه‌گیری و پیشنهادها', "نتیجه اصلی\nپیشنهاد پژوهشی"), $S('quote', '', 'با سپاس از استاد راهنما و مشاور')],
        'معرفی شرکت و خدمات' => [$S('bullets', 'ما که هستیم', "داستان شکل‌گیری\nمأموریت و چشم‌انداز"), $S('numbers', 'در یک نگاه', "۱۰ سال | تجربه\n۵۰۰+ | مشتری\n۳ | شعبه"), $S('two', 'خدمات ما', "خدمت ۱\nخدمت ۲\nخدمت ۳\nخدمت ۴"), $S('timeline', 'روند همکاری', "۱ | جلسه\n۲ | طراحی\n۳ | اجرا\n۴ | تحویل"), $S('quote', 'نظر مشتریان', 'کیفیت و تعهد این مجموعه بی‌نظیر است.')],
    ];
    $themes = [['orange', 'ارائه کاری و گزارش'], ['ocean', 'ارائه استارتاپ و جذب سرمایه'], ['royal', 'دفاع پایان‌نامه'], ['noir', 'معرفی شرکت و خدمات'], ['mint', 'ارائه کاری و گزارش'], ['sunset', 'معرفی شرکت و خدمات'], ['forest', 'دفاع پایان‌نامه'], ['mono', 'ارائه استارتاپ و جذب سرمایه']];
    foreach ($themes as $i => [$th, $deck]) {
        $name = SLIDE_THEMES[$th]['name'];
        $title = "قالب پاورپوینت «{$name}» — {$deck}";
        if (val('SELECT id FROM products WHERE title = ?', [$title])) continue;
        $data = ['theme' => $th, 'font' => 'Tahoma', 'title' => 'عنوان ارائه شما', 'subtitle' => $deck, 'author' => 'نام ارائه‌دهنده', 'date' => '۱۴۰۵', 'logo' => '', 'slides' => $decks[$deck], 'end' => 'با تشکر از توجه شما', 'contact' => 'info@example.com'];
        $model = slides_model($data);
        $pid = insert('products', ['seller_id' => $admin, 'title' => $title, 'category_id' => 'pptx-tpl', 'price' => 129000, 'discount' => 0, 'sales' => 0, 'rating' => 0, 'status' => 'active',
            'tags' => jenc(['پاورپوینت', $deck, $name, 'قابل ویرایش', 'راست‌چین']),
            'descr' => "قالب کاملاً قابل ویرایش پاورپوینت با پوسته «{$name}»، مخصوص {$deck}.\n\n• " . bx_fa(count($model)) . " اسلاید آماده با ساختار استاندارد\n• راست‌چین و فارسی، سازگار با PowerPoint و Google Slides\n• فونت Tahoma (روی همه سیستم‌ها) — قابل تغییر\n• شامل اسلاید آمار، خط زمانی، دوستونه و نقل‌قول", 'created_at' => now()]);
        store_bytes(pptx_build($model, 'Tahoma', $title), "{$title}.pptx", 'product', $pid, $admin, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        $c = slides_canvas($model);
        // 4:3 cover: the title slide large, two inner slides below it
        $t = SLIDE_THEMES[$th];
        $gd = fn ($pg) => imagecreatefromstring($c->png($pg, 900, 1));
        $cv = new BxCanvas(1200, 900);
        $cv->rect(0, 0, 1200, 900, bx_grad(0, 0, 1200, 900, bx_shade($t['accent'], 0.55), bx_shade($t['accent'], -0.35)));
        $cv->circle(1100, 80, 260, bx_rgba('#ffffff', 0.12));
        $cv->rect(126, 86, 960, 540, bx_rgba('#000000', 0.25), 14);
        $cv->image($gd(0), 110, 70, 960, 540, 'round', 12);
        foreach ([[2, 150], [3, 640]] as [$pg, $x]) if (isset($c->pages[$pg])) { $cv->rect($x + 10, 660, 410, 231, bx_rgba('#000000', 0.25), 10); $cv->image($gd($pg), $x, 650, 410, 231, 'round', 10); }
        $cv->rect(880, 30, 290, 54, '#ffffff', 27);
        $cv->text(880, 40, 290, bx_fa(count($model)) . ' اسلاید قابل ویرایش', ['size' => 20, 'font' => 'k', 'color' => bx_shade($t['accent'], -0.3), 'align' => 'center', 'lh' => 1.6]);
        $cover = store_bytes($cv->png(0, 1200, 1), 'cover.png', 'cover', $pid, $admin, 'image/png');
        update('products', ['image' => (string) $cover], 'id = ?', [$pid]);
        foreach ([2, 4, 5] as $pg) if (isset($c->pages[$pg])) store_bytes($c->png($pg, 960, 2), "slide-$pg.png", 'gallery', $pid, $admin, 'image/png');
    }
    $resumes = [['#2563eb', 'آبی رسمی', true], ['#0f766e', 'سبز آرام', true], ['#7c3aed', 'بنفش خلاق', false], ['#111827', 'مشکی مینیمال', true], ['#b45309', 'قهوه‌ای کلاسیک', false], ['#e11d48', 'قرمز جسور', false]];
    foreach ($resumes as [$col, $nm, $right]) {
        $title = "قالب رزومه Word «{$nm}»";
        if (val('SELECT id FROM products WHERE title = ?', [$title])) continue;
        $pid = insert('products', ['seller_id' => $admin, 'title' => $title, 'category_id' => 'word-tpl', 'price' => 99000, 'discount' => 0, 'sales' => 0, 'rating' => 0, 'status' => 'active',
            'tags' => jenc(['رزومه', 'Word', 'قالب رزومه', 'قابل ویرایش']),
            'descr' => "قالب رزومه دوستونه فارسی در Word با رنگ «{$nm}».\n\n• فقط متن‌ها را با اطلاعات خودتان جایگزین کنید\n• بخش‌های درباره من، سوابق، تحصیلات، مهارت و زبان\n• راست‌چین، سازگار با Word 2010 به بعد و WPS\n• مناسب چاپ A4 و ارسال PDF", 'created_at' => now()]);
        store_bytes(docx_resume_template($col, 'Tahoma', $right), "{$title}.docx", 'product', $pid, $admin, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        // cover: a mock-up of the Word page on a soft background
        $W = 1200; $H = 900;
        $cv = new BxCanvas($W, $H);
        $cv->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, bx_shade($col, 0.85), bx_shade($col, 0.6)));
        $px = 330; $py = 70; $pw = 540; $ph = 764;
        $cv->rect($px + 14, $py + 22, $pw, $ph, bx_rgba('#000000', 0.18), 6);
        $cv->rect($px, $py, $pw, $ph, '#ffffff', 4);
        $cv->rect($px, $py, $pw, 92, $col, 4);
        $cv->text($px + 30, $py + 18, $pw - 60, 'نام و نام خانوادگی', ['size' => 26, 'font' => 'k', 'color' => '#ffffff', 'max' => 1, 'lh' => 1.4]);
        $cv->text($px + 30, $py + 56, $pw - 60, 'عنوان شغلی', ['size' => 14, 'color' => bx_rgba('#ffffff', 0.85), 'max' => 1, 'lh' => 1.4]);
        $sx = $right ? $px + $pw - 170 : $px; $mx = $right ? $px + 20 : $px + 190;
        $cv->rect($sx, $py + 92, 170, $ph - 92, bx_shade($col, 0.9));
        foreach ([['اطلاعات تماس', 4], ['مهارت‌ها', 5], ['زبان‌ها', 2]] as $k => [$hd, $n]) {
            $y = $py + 120 + $k * 190;
            $cv->text($sx + 14, $y, 142, $hd, ['size' => 13, 'font' => 'b', 'color' => $col, 'dir' => 'rtl', 'lh' => 1.5]);
            $cv->rect($sx + 14, $y + 24, 142, 2, $col);
            for ($j = 0; $j < $n; $j++) $cv->rect($sx + 14 + ($j % 2) * 30, $y + 40 + $j * 22, 112 - ($j % 2) * 30, 8, '#cbd5e1', 4);
        }
        foreach ([['درباره من', 3], ['سوابق کاری', 7], ['تحصیلات', 3], ['دوره‌ها', 2]] as $k => [$hd, $n]) {
            $y = $py + 120 + [0, 120, 340, 470][$k];
            $cv->text($mx, $y, 310, $hd, ['size' => 14, 'font' => 'b', 'color' => $col, 'dir' => 'rtl', 'lh' => 1.5]);
            $cv->rect($mx, $y + 26, 310, 2, $col);
            for ($j = 0; $j < $n; $j++) $cv->rect($mx + ($j % 3) * 24, $y + 42 + $j * 20, 310 - ($j % 3) * 24, 8, '#e2e8f0', 4);
        }
        $cv->rect(60, 70, 210, 64, $col, 32);
        $cv->text(60, 82, 210, 'قالب Word', ['size' => 22, 'font' => 'k', 'color' => '#ffffff', 'align' => 'center', 'lh' => 1.6]);
        $cv->text(40, 760, 260, "رنگ «{$nm}»\nقابل ویرایش", ['size' => 20, 'font' => 'b', 'color' => bx_shade($col, -0.4), 'align' => 'center', 'lh' => 1.7]);
        $cover = store_bytes($cv->png(0, $W, 2), 'cover.png', 'cover', $pid, $admin, 'image/png');
        update('products', ['image' => (string) $cover], 'id = ?', [$pid]);
    }
}
