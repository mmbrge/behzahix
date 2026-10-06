<?php
// BEHIX — presentation themes and slide layouts. Slides are described once as
// simple elements (points on a 960×540 slide); the same model is painted for the
// watermarked preview and written as an editable right-to-left .pptx.
if (!defined('BX')) { http_response_code(403); exit; }

const SLIDE_W = 960;
const SLIDE_H = 540;
const SLIDE_THEMES = [
    'orange' => ['name' => 'نارنجی بهیکس', 'bg' => '#ffffff', 'fg' => '#111827', 'accent' => '#ff7a1a', 'soft' => '#fff1e6', 'sub' => '#6b7280', 'deco' => 'bar'],
    'ocean' => ['name' => 'اقیانوسی', 'bg' => '#0f172a', 'bg2' => '#1e3a5f', 'fg' => '#ffffff', 'accent' => '#38bdf8', 'soft' => '#1e293b', 'sub' => '#94a3b8', 'deco' => 'circles'],
    'forest' => ['name' => 'سبز طبیعی', 'bg' => '#f4f7f2', 'fg' => '#14281d', 'accent' => '#16a34a', 'soft' => '#dcfce7', 'sub' => '#4b5563', 'deco' => 'corner'],
    'royal' => ['name' => 'بنفش رسمی', 'bg' => '#1e1b4b', 'bg2' => '#312e81', 'fg' => '#ffffff', 'accent' => '#a78bfa', 'soft' => '#2e2a6e', 'sub' => '#c7d2fe', 'deco' => 'circles'],
    'sunset' => ['name' => 'غروب گرادیانی', 'bg' => '#fff7ed', 'fg' => '#1f2937', 'accent' => '#ec4899', 'accent2' => '#f97316', 'soft' => '#ffe4e6', 'sub' => '#6b7280', 'deco' => 'band'],
    'mint' => ['name' => 'نعنایی مدرن', 'bg' => '#ffffff', 'fg' => '#0f172a', 'accent' => '#14b8a6', 'soft' => '#ccfbf1', 'sub' => '#64748b', 'deco' => 'corner'],
    'noir' => ['name' => 'مشکی و طلایی', 'bg' => '#0b0b0d', 'bg2' => '#1a1a1f', 'fg' => '#f5f1e6', 'accent' => '#d4af37', 'soft' => '#1c1c22', 'sub' => '#a8a294', 'deco' => 'frame'],
    'mono' => ['name' => 'سیاه‌وسفید', 'bg' => '#ffffff', 'fg' => '#111111', 'accent' => '#111111', 'soft' => '#f3f4f6', 'sub' => '#6b7280', 'deco' => 'bar'],
];

function slides_model(array $d): array
{
    $t = SLIDE_THEMES[$d['theme'] ?? ''] ?? SLIDE_THEMES['orange'];
    $W = SLIDE_W; $H = SLIDE_H; $M = 44;
    $ac2 = $t['accent2'] ?? $t['accent'];
    $logo = $d['logo'] ?? '';
    $deco = function (array &$e, bool $title = false) use ($t, $W, $H, $ac2) {
        switch ($t['deco']) {
            case 'bar': $e[] = ['rect', $W - ($title ? 26 : 10), 0, $title ? 26 : 10, $H, $t['accent']]; break;
            case 'circles':
                $e[] = ['ellipse', $W - 180, -160, 380, 380, $t['accent'], 0.12];
                $e[] = ['ellipse', -120, $H - 140, 260, 260, $t['accent'], 0.08]; break;
            case 'corner':
                $e[] = ['ellipse', $W - 120, -120, 240, 240, $t['accent'], 0.9];
                $e[] = ['ellipse', $W - 70, -70, 140, 140, $t['soft'], 1]; break;
            case 'band': $e[] = ['grad', 0, $H - 14, $W, 14, $t['accent'], $ac2]; break;
            case 'frame': $e[] = ['frame', 16, 16, $W - 32, $H - 32, $t['accent']]; break;
        }
    };
    $header = function (array &$e, string $title) use ($t, $W, $M) {
        $e[] = ['rect', $W - $M - 6, 40, 6, 40, $t['accent'], 1, 3];
        $e[] = ['text', $M + 70, 32, $W - 2 * $M - 84, 56, $title, ['size' => 28, 'bold' => true, 'color' => $t['fg'], 'valign' => 'middle']];
    };
    $foot = function (array &$e, int $n) use ($t, $M, $H, $logo) {
        $e[] = ['text', $M, $H - 40, 60, 24, bx_fa($n), ['size' => 11, 'color' => $t['sub'], 'align' => 'left']];
        if ($logo) $e[] = ['image', $M, 28, 56, 56, $logo, 'contain'];
    };
    $bg = fn () => isset($t['bg2']) ? ['grad', $t['bg'], $t['bg2']] : $t['bg'];
    $out = [];

    // title slide
    $e = [];
    $deco($e, true);
    if ($t['deco'] === 'band') $e[] = ['grad', 0, 0, $W, 10, $t['accent'], $ac2];
    $e[] = ['text', $M, 170, $W - 2 * $M - 40, 110, (string) ($d['title'] ?? ''), ['size' => 44, 'bold' => true, 'color' => $t['fg'], 'valign' => 'bottom']];
    $e[] = ['rect', $W - $M - 40 - 90, 296, 90, 5, $t['accent'], 1, 2.5];
    $e[] = ['text', $M, 312, $W - 2 * $M - 40, 46, (string) ($d['subtitle'] ?? ''), ['size' => 22, 'color' => $t['accent']]];
    $e[] = ['text', $M, 370, $W - 2 * $M - 40, 34, bx_fa(implode('  ·  ', array_filter([$d['author'] ?? '', $d['date'] ?? '']))), ['size' => 15, 'color' => $t['sub']]];
    if ($logo) $e[] = ['image', $M, 40, 90, 90, $logo, 'contain'];
    $out[] = ['bg' => $bg(), 'els' => $e];

    foreach (array_slice(is_array($d['slides'] ?? null) ? $d['slides'] : [], 0, 40) as $i => $s) {
        $n = $i + 2;
        $e = [];
        $type = $s['type'] ?? 'bullets';
        $title = (string) ($s['title'] ?? '');
        $lines = bx_lines($s['text'] ?? '');
        $sbg = $bg();
        if ($type === 'section') {
            $sbg = ['grad', $t['accent'], bx_shade($t['accent'], -0.35)];
            $e[] = ['ellipse', $W - 260, -100, 420, 420, '#ffffff', 0.08];
            $e[] = ['text', $M, 150, $W - 2 * $M, 120, bx_fa(str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT)), ['size' => 80, 'bold' => true, 'color' => bx_rgba('#ffffff', 0.45), 'valign' => 'bottom']];
            $e[] = ['text', $M, 280, $W - 2 * $M, 110, $title, ['size' => 40, 'bold' => true, 'color' => '#ffffff']];
            $out[] = ['bg' => $sbg, 'els' => $e];
            continue;
        }
        $deco($e);
        if ($type === 'quote') {
            $e[] = ['text', $W - $M - 120, 50, 110, 120, '«', ['size' => 110, 'bold' => true, 'color' => $t['accent']]];
            $e[] = ['text', $M + 40, 150, $W - 2 * $M - 80, 220, implode(' ', $lines) ?: $title, ['size' => 32, 'bold' => true, 'color' => $t['fg'], 'valign' => 'middle', 'lh' => 1.6]];
            if ($lines && $title !== '') $e[] = ['text', $M + 40, 390, $W - 2 * $M - 80, 36, '— ' . $title, ['size' => 18, 'color' => $t['sub']]];
        } elseif ($type === 'numbers') {
            $header($e, $title);
            $items = array_map(fn ($l) => array_map('trim', explode('|', $l, 2)), array_slice($lines, 0, 4));
            $k = max(1, count($items)); $gap = 20; $bw = ($W - 2 * $M - $gap * ($k - 1)) / $k;
            foreach ($items as $j => $it) {
                $x = $W - $M - $bw - $j * ($bw + $gap);
                $e[] = ['rect', $x, 150, $bw, 250, $t['soft'], 1, 14];
                $e[] = ['rect', $x + $bw / 2 - 20, 170, 40, 5, $t['accent'], 1, 2.5];
                $e[] = ['text', $x + 10, 190, $bw - 20, 100, bx_fa($it[0] ?? ''), ['size' => 50, 'bold' => true, 'color' => $t['accent'], 'align' => 'center', 'valign' => 'middle']];
                $e[] = ['text', $x + 16, 296, $bw - 32, 90, (string) ($it[1] ?? ''), ['size' => 17, 'color' => $t['sub'], 'align' => 'center']];
            }
        } elseif ($type === 'image') {
            $header($e, $title);
            if (!empty($s['image'])) $e[] = ['image', $M, 115, 430, 370, $s['image'], 'cover', 12];
            else $e[] = ['rect', $M, 115, 430, 370, $t['soft'], 1, 12];
            $e[] = ['text', $M + 460, 120, $W - 2 * $M - 470, 370, array_slice($lines, 0, 6), ['size' => 19, 'color' => $t['fg'], 'bullet' => $t['accent'], 'lh' => 1.6, 'gap' => 10]];
        } elseif ($type === 'two') {
            $header($e, $title);
            $half = (int) ceil(count($lines) / 2);
            $cw = ($W - 2 * $M - 30) / 2;
            foreach ([array_slice($lines, 0, $half), array_slice($lines, $half)] as $j => $part) {
                $x = $W - $M - $cw - $j * ($cw + 30);
                $e[] = ['rect', $x, 120, $cw, 370, $t['soft'], 1, 14];
                $e[] = ['text', $x + 22, 140, $cw - 44, 330, $part, ['size' => 18, 'color' => $t['fg'], 'bullet' => $t['accent'], 'lh' => 1.6, 'gap' => 8]];
            }
        } elseif ($type === 'timeline') {
            $header($e, $title);
            $items = array_map(fn ($l) => array_map('trim', explode('|', $l, 2)), array_slice($lines, 0, 5));
            $k = max(1, count($items)); $step = ($W - 2 * $M) / $k;
            $e[] = ['rect', $M + $step / 2, 258, ($k - 1) * $step, 4, $t['accent'], 0.35, 2];
            foreach ($items as $j => $it) {
                $cx = $W - $M - $step / 2 - $j * $step;
                $e[] = ['ellipse', $cx - 22, 238, 44, 44, $t['accent'], 1];
                $e[] = ['text', $cx - 22, 238, 44, 44, bx_fa($j + 1), ['size' => 18, 'bold' => true, 'color' => bx_on($t['accent']), 'align' => 'center', 'valign' => 'middle']];
                $e[] = ['text', $cx - $step / 2 + 8, 300, $step - 16, 40, (string) ($it[0] ?? ''), ['size' => 18, 'bold' => true, 'color' => $t['fg'], 'align' => 'center']];
                $e[] = ['text', $cx - $step / 2 + 8, 342, $step - 16, 120, (string) ($it[1] ?? ''), ['size' => 14, 'color' => $t['sub'], 'align' => 'center']];
            }
        } else {
            $header($e, $title);
            $e[] = ['text', $M, 120, $W - 2 * $M - 20, 380, array_slice($lines, 0, 8), ['size' => 22, 'color' => $t['fg'], 'bullet' => $t['accent'], 'lh' => 1.6, 'gap' => 12]];
        }
        $foot($e, $n);
        $out[] = ['bg' => $sbg, 'els' => $e];
    }
    // closing slide
    $e = [];
    $deco($e, true);
    $e[] = ['grad', 0, $H - 12, $W, 12, $t['accent'], $ac2];
    $e[] = ['text', $M, 170, $W - 2 * $M, 100, (string) (($d['end'] ?? '') ?: 'با تشکر از توجه شما'), ['size' => 42, 'bold' => true, 'color' => $t['fg'], 'align' => 'center', 'valign' => 'middle']];
    if (!empty($d['contact'])) $e[] = ['text', $M, 290, $W - 2 * $M, 40, bx_fa($d['contact']), ['size' => 20, 'color' => $t['sub'], 'align' => 'center']];
    if ($logo) $e[] = ['image', $W / 2 - 40, 350, 80, 80, $logo, 'contain'];
    $out[] = ['bg' => $bg(), 'els' => $e];
    return $out;
}

// Fitted font size of a text element (shared by preview and pptx)
function slide_text_size(BxCanvas $c, array $el): float
{
    [, , , $w, $h, $txt, $o] = $el;
    $size = (float) $o['size'];
    $lh = (float) ($o['lh'] ?? 1.35);
    $paras = is_array($txt) ? $txt : [$txt];
    $bw = !empty($o['bullet']) ? $w - $size * 1.2 : $w;
    $font = !empty($o['bold']) ? 'k' : 'r';
    while ($size > 9) {
        $total = 0; $wide = false;
        foreach ($paras as $p) {
            $total += $c->measure((string) $p, $bw, ['size' => $size, 'lh' => $lh, 'font' => $font]) + ($o['gap'] ?? 0);
            foreach (preg_split('/\s+/u', (string) $p) as $wd) if ($wd !== '' && $c->textWidth($wd, $font, $size) > $bw) $wide = true;
        }
        if ($total <= $h && !$wide) break;
        $size *= 0.93;
    }
    return $size;
}

function slides_canvas(array $slides, array $only = null): BxCanvas
{
    $c = new BxCanvas(SLIDE_W, SLIDE_H);
    $c->defaultDir = 'rtl';
    $first = true;
    $imgs = [];
    foreach ($slides as $i => $s) {
        if ($only !== null && !in_array($i, $only, true)) continue;
        if (!$first) $c->page(SLIDE_W, SLIDE_H);
        $first = false;
        $bg = $s['bg'];
        $c->rect(0, 0, SLIDE_W, SLIDE_H, is_array($bg) ? bx_grad(0, 0, SLIDE_W, SLIDE_H, $bg[1], $bg[2]) : $bg);
        foreach ($s['els'] as $el) {
            switch ($el[0]) {
                case 'rect': $c->rect($el[1], $el[2], $el[3], $el[4], bx_rgba($el[5], $el[6] ?? 1), $el[7] ?? 0); break;
                case 'ellipse': $c->ellipse($el[1] + $el[3] / 2, $el[2] + $el[4] / 2, $el[3] / 2, $el[4] / 2, bx_rgba($el[5], $el[6] ?? 1)); break;
                case 'grad': $c->rect($el[1], $el[2], $el[3], $el[4], bx_grad($el[1], 0, $el[1] + $el[3], 0, $el[5], $el[6])); break;
                case 'frame': $c->stroke('rect', $el[1], $el[2], $el[3], $el[4], $el[5], 1.5); break;
                case 'image':
                    $im = $imgs[$el[5]] ??= bx_image_load($el[5]);
                    if ($im) $c->image($im, $el[1], $el[2], $el[3], $el[4], ($el[7] ?? 0) ? 'round' : 'rect', $el[7] ?? 0, $el[6] ?? 'contain');
                    break;
                case 'text':
                    [, $x, $y, $w, $h, $txt, $o] = $el;
                    $size = slide_text_size($c, $el);
                    $lh = (float) ($o['lh'] ?? 1.35);
                    $font = !empty($o['bold']) ? 'k' : 'r';
                    $paras = is_array($txt) ? $txt : [$txt];
                    $bw = !empty($o['bullet']) ? $w - $size * 1.2 : $w;
                    $total = 0;
                    foreach ($paras as $p) $total += $c->measure((string) $p, $bw, ['size' => $size, 'lh' => $lh]) + ($o['gap'] ?? 0);
                    $va = $o['valign'] ?? 'top';
                    $cy = $va === 'middle' ? $y + ($h - $total) / 2 : ($va === 'bottom' ? $y + $h - $total : $y);
                    foreach ($paras as $p) {
                        if (!empty($o['bullet'])) $c->circle($x + $w - $size * 0.35, $cy + $size * $lh / 2, $size * 0.17, $o['bullet']);
                        $cy += $c->text($x, $cy, $bw, (string) $p, ['size' => $size, 'lh' => $lh, 'font' => $font, 'color' => $o['color'], 'align' => $o['align'] ?? 'right']) + ($o['gap'] ?? 0);
                    }
                    break;
            }
        }
    }
    return $c;
}
