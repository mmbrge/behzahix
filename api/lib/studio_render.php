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
