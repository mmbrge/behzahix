<?php
// BEHIX — social post, story and poster templates (design units = output pixels).
if (!defined('BX')) { http_response_code(403); exit; }

const POST_SIZES = ['post' => [1080, 1080], 'portrait' => [1080, 1350], 'story' => [1080, 1920], 'poster' => [1240, 1754]];
const POST_TPLS = ['sale', 'product', 'occasion', 'announce', 'quote', 'event', 'hiring', 'tips', 'menu', 'review', 'launch', 'photo'];

function post_render(array $d): BxCanvas
{
    [$W, $H] = POST_SIZES[$d['size'] ?? 'post'] ?? POST_SIZES['post'];
    $c = new BxCanvas($W, $H);
    if (($d['size'] ?? '') === 'poster') $c->pdfScale = 595.28 / $W;
    $c->title = (string) ($d['title'] ?? 'پست');
    $col = bx_hex($d['color'] ?? '', '#ff7a1a'); $col2 = bx_hex($d['color2'] ?? '', '#facc15');
    $t = in_array($d['tpl'] ?? '', POST_TPLS, true) ? $d['tpl'] : 'sale';
    $photo = bx_image_load($d['photo'] ?? ''); $logo = bx_image_load($d['logo'] ?? '');
    $pad = $W * 0.08; $tall = $H / $W;
    $dim = max(0, min(90, (int) ($d['dim'] ?? 45))) / 100;
    $title = (string) ($d['title'] ?? ''); $subt = (string) ($d['subtitle'] ?? ''); $body = (string) ($d['body'] ?? '');
    $badge = bx_fa($d['badge'] ?? ''); $cta = (string) ($d['cta'] ?? ''); $date = bx_fa($d['date'] ?? ''); $footer = bx_fa($d['footer'] ?? '');
    $logoAt = function ($x, $y, $s) use ($c, $logo) { if ($logo) $c->image($logo, $x, $y, $s, $s, 'rect', 0, 'contain'); };
    $ctaBtn = function ($y, $bg, $fg, $align = 'center') use ($c, $cta, $W, $pad) {
        if ($cta === '') return;
        $fs = $W * 0.04;
        $w = min($W - $pad * 2, $c->textWidth($cta, 'k', $fs) + $W * 0.12); $h = $W * 0.095;
        $x = $align === 'center' ? ($W - $w) / 2 : $W - $pad - $w;
        $c->rect($x, $y + $h * 0.08, $w, $h, bx_alpha('#000000', 0.18), $h / 2);
        $c->rect($x, $y, $w, $h, $bg, $h / 2);
        bx_one($c, $cta, $x + 20, $y + $h / 2, $w - 40, ['size' => $fs, 'font' => 'k', 'color' => $fg, 'align' => 'center']);
    };
    $foot = function ($color = null, $align = 'center') use ($c, $footer, $W, $H, $pad) {
        if ($footer !== '') bx_one($c, $footer, $pad, $H - $pad * 0.62, $W - $pad * 2, ['size' => $W * 0.03, 'font' => 'b', 'color' => $color ?? bx_rgba('#ffffff', 0.9), 'align' => $align]);
    };
    // bottom edge for content (above the CTA button / footer)
    $limit = $H - $pad - ($cta !== '' ? $W * 0.21 : ($footer !== '' ? $W * 0.06 : 0));
    // body text limited to the lines that fit above $limit
    $bodyFit = function ($x, $y, $w, array $o) use ($c, $body, &$limit) {
        if ($body === '') return 0;
        $size = $o['size']; $lh = $o['lh'] ?? 1.7;
        $n = (int) floor(($limit - $y) / ($size * $lh));
        if ($n < 1) return 0;
        return $c->text($x, $y, $w, $body, ['max' => min($n, $o['max'] ?? 12), 'lh' => $lh] + $o);
    };
    $cover = function ($a = null) use ($c, $photo, $W, $H, $dim) {
        if (!$photo) return;
        $c->image($photo, 0, 0, $W, $H);
        $c->rect(0, 0, $W, $H, bx_rgba('#000000', $a ?? $dim));
    };

    switch ($t) {
        case 'sale':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, bx_shade($col, -0.55)));
            if ($photo) { $c->image($photo, 0, 0, $W, $H); $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, bx_alpha($col, 0.82), bx_alpha(bx_shade($col, -0.55), 0.92))); }
            for ($i = 0; $i < 6; $i++) $c->circle($W * ($i % 3) / 2, $H * (0.15 + $i * 0.15), $W * 0.18, bx_rgba('#ffffff', 0.06));
            for ($i = 0; $i < 9; $i++) $c->poly([[$W - $i * 64, 0], [$W - $i * 64 - 26, 0], [$W - $i * 64 - 120, $W * 0.09], [$W - $i * 64 - 94, $W * 0.09]], bx_alpha($col2, 0.85));
            $logoAt($pad, $pad * 1.2, $W * 0.13);
            $y0 = $H * 0.2;
            if ($badge !== '') {
                $r = $tall < 1.2 ? $W * 0.14 : $W * 0.2;
                $by = max($W * 0.12 + $r, $tall < 1.2 ? 0 : $H * 0.3);
                $c->circle($W / 2, $by + $r * 0.06, $r, bx_alpha('#000000', 0.2));
                $pts = []; for ($i = 0; $i < 32; $i++) { $rr = $i % 2 ? $r * 0.9 : $r; $a = $i * M_PI / 16; $pts[] = [$W / 2 + $rr * cos($a), $by + $rr * sin($a)]; }
                $c->poly($pts, $col2);
                bx_one($c, $badge, $W / 2 - $r * 0.8, $by - $r * 0.05, $r * 1.6, ['size' => $r * 0.62, 'font' => 'k', 'color' => bx_shade($col, -0.45), 'align' => 'center']);
                bx_one($c, 'تخفیف', $W / 2 - $r * 0.6, $by + $r * 0.5, $r * 1.2, ['size' => $r * 0.17, 'font' => 'b', 'color' => bx_shade($col, -0.45), 'align' => 'center']);
                $y0 = $by + $r + $W * 0.05;
            }
            [$th] = bx_title($c, $title, $pad, $y0, $W - $pad * 2, min($H * 0.2, ($limit - $y0) * 0.6), ['size' => $W * 0.11, 'color' => '#ffffff', 'align' => 'center']);
            $y = $y0 + $th + $W * 0.01;
            if ($subt !== '' && $y + $W * 0.06 < $limit) { bx_one($c, $subt, $pad, $y + $W * 0.03, $W - $pad * 2, ['size' => $W * 0.045, 'font' => 'b', 'color' => $col2, 'align' => 'center']); $y += $W * 0.075; }
            $bodyFit($pad * 1.3, $y, $W - $pad * 2.6, ['size' => $W * 0.033, 'color' => bx_rgba('#ffffff', 0.9), 'align' => 'center', 'max' => 3]);
            $ctaBtn($H - $pad - $W * 0.17, $col2, bx_shade($col, -0.5));
            $foot();
            break;

        case 'product':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, 0, $H, '#f8f9fc', bx_shade($col, 0.88)));
            $R = min($W * 0.37, $H * 0.26);
            $cy = $tall < 1.2 ? $pad * 0.5 + $R : $H * 0.36;
            $c->circle($W * 0.5, $cy, $R, bx_grad(0, $cy - $R, 0, $cy + $R, bx_shade($col, 0.2), bx_shade($col, -0.25)));
            $c->circle($W * 0.86, $H * 0.1, $W * 0.15, bx_alpha(bx_shade($col, 0.5), 0.45));
            $c->circle($W * 0.12, $H * 0.55, $W * 0.06, bx_alpha($col2, 0.7));
            $c->ellipse($W / 2, $cy + $R * 0.9, $R * 0.68, $W * 0.03, bx_rgba('#000000', 0.12));
            if ($photo) $c->image($photo, $W / 2 - $R * 0.9, $cy - $R * 0.9, $R * 1.8, $R * 1.8, 'rect', 0, 'contain');
            $logoAt($W - $pad - $W * 0.13, $pad * 0.6, $W * 0.13);
            if ($badge !== '') { $c->rect($pad, $pad * 0.8, $W * 0.26, $W * 0.1, $col2, $W * 0.05); bx_one($c, $badge, $pad + 10, $pad * 0.8 + $W * 0.05, $W * 0.26 - 20, ['size' => $W * 0.045, 'font' => 'k', 'color' => '#111', 'align' => 'center']); }
            $y0 = $cy + $R + $W * 0.04;
            [$th] = bx_title($c, $title, $pad, $y0, $W - $pad * 2, min($H * 0.14, ($limit - $y0) * 0.55), ['size' => $W * 0.085, 'color' => '#111827', 'align' => 'center']);
            $y = $y0 + $th;
            if ($subt !== '' && $y + $W * 0.06 < $limit) { bx_one($c, bx_fa($subt), $pad, $y + $W * 0.035, $W - $pad * 2, ['size' => $W * 0.055, 'font' => 'k', 'color' => $col, 'align' => 'center']); $y += $W * 0.08; }
            $bodyFit($pad, $y, $W - $pad * 2, ['size' => $W * 0.031, 'color' => '#555b6b', 'align' => 'center', 'max' => 2]);
            $ctaBtn($H - $pad - $W * 0.13, $col, '#ffffff');
            $foot('#6b7280');
            break;

        case 'occasion':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W * 0.3, $H, bx_shade($col, 0.15), bx_shade($col, -0.6)));
            if ($photo) { $c->image($photo, 0, 0, $W, $H); $c->rect(0, 0, $W, $H, bx_grad(0, 0, 0, $H, bx_alpha($col, 0.55 + $dim * 0.3), bx_alpha(bx_shade($col, -0.6), 0.9))); }
            $seed = mb_strlen($title) * 97 + 7;
            for ($i = 0; $i < 70; $i++) {
                $x = bx_rand($seed) * $W; $y = bx_rand($seed) * $H; $s = 3 + bx_rand($seed) * $W * 0.012; $a = 0.25 + bx_rand($seed) * 0.6;
                if ($i % 5 === 0) bx_icon($c, 'star', $x, $y, $s * 4, bx_alpha($col2, $a)); else $c->circle($x, $y, $s, bx_alpha($i % 3 ? $col2 : '#ffffff', $a));
            }
            $c->stroke('round', $pad * 0.6, $pad * 0.6, $W - $pad * 1.2, $H - $pad * 1.2, $col2, $W * 0.006, $W * 0.04);
            $c->stroke('round', $pad * 0.75, $pad * 0.75, $W - $pad * 1.5, $H - $pad * 1.5, bx_alpha($col2, 0.4), $W * 0.002, $W * 0.035);
            $logoAt($W / 2 - $W * 0.08, $pad * 1.15, $W * 0.16);
            $y0 = $H * 0.34;
            [$th] = bx_title($c, $title, $pad * 1.2, $y0, $W - $pad * 2.4, $H * 0.25, ['size' => $W * 0.12, 'color' => '#ffffff', 'align' => 'center']);
            $y = $y0 + $th;
            if ($subt !== '') { $c->rect($W / 2 - $W * 0.06, $y + $W * 0.015, $W * 0.12, $W * 0.006, $col2); bx_one($c, $subt, $pad * 1.2, $y + $W * 0.07, $W - $pad * 2.4, ['size' => $W * 0.048, 'font' => 'b', 'color' => $col2, 'align' => 'center']); $y += $W * 0.12; }
            if ($body !== '') $c->text($pad * 1.3, $y, $W - $pad * 2.6, $body, ['size' => $W * 0.036, 'color' => bx_rgba('#ffffff', 0.92), 'align' => 'center', 'max' => 4]);
            $foot(null);
            break;

        case 'announce':
            $c->rect(0, 0, $W, $H, '#0f1117');
            if ($photo) { $c->image($photo, 0, 0, $W, $H * 0.45); $c->rect(0, $H * 0.2, $W, $H * 0.26, bx_grad(0, $H * 0.2, 0, $H * 0.45, bx_rgba('#0f1117', 0), bx_rgba('#0f1117', 1))); }
            $c->rect(0, 0, $W, $W * 0.02, $col); $c->rect(0, $H - $W * 0.02, $W, $W * 0.02, $col);
            $logoAt($W - $pad - $W * 0.12, $pad * 0.8, $W * 0.12);
            $y0 = $photo ? $H * 0.46 : $H * 0.2;
            if ($badge !== '') { $bw = min($W * 0.5, $c->textWidth($badge, 'k', $W * 0.036) + $W * 0.08); $c->rect($W - $pad - $bw, $y0, $bw, $W * 0.08, $col, $W * 0.02); bx_one($c, $badge, $W - $pad - $bw + 10, $y0 + $W * 0.04, $bw - 20, ['size' => $W * 0.036, 'font' => 'k', 'color' => '#fff', 'align' => 'center']); }
            $y = $y0 + $W * 0.12;
            [$th] = bx_title($c, $title, $pad, $y, $W - $pad * 2, min($H * 0.2, ($limit - $y) * 0.5), ['size' => $W * 0.09, 'color' => '#ffffff']);
            $y += $th;
            if ($subt !== '' && $y + $W * 0.06 < $limit) { bx_one($c, $subt, $pad, $y + $W * 0.03, $W - $pad * 2, ['size' => $W * 0.042, 'font' => 'b', 'color' => $col, 'align' => 'right']); $y += $W * 0.08; }
            $bodyFit($pad, $y, $W - $pad * 2, ['size' => $W * 0.033, 'color' => '#d1d5db', 'lh' => 1.8]);
            $ctaBtn($H - $pad - $W * 0.15, $col, '#ffffff', 'right');
            $foot('#9ca3af', 'left');
            break;

        case 'quote':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, bx_shade($col, -0.4)));
            $cover();
            bx_one($c, '«', $W - $pad - $W * 0.25, $H * 0.2, $W * 0.25, ['size' => $W * 0.3, 'font' => 'k', 'color' => $col2, 'align' => 'right']);
            $y0 = $H * 0.3;
            [$th] = bx_title($c, $title, $pad, $y0, $W - $pad * 2, $H * 0.42, ['size' => $W * 0.08, 'min' => 26, 'font' => 'b', 'color' => '#ffffff', 'lh' => 1.55]);
            if ($subt !== '') { $c->rect($W - $pad - $W * 0.08, $y0 + $th + $W * 0.05, $W * 0.08, $W * 0.008, $col2); bx_one($c, $subt, $pad, $y0 + $th + $W * 0.054, $W - $pad * 2 - $W * 0.11, ['size' => $W * 0.04, 'font' => 'm', 'color' => '#ffffff', 'align' => 'right']); }
            $logoAt($pad, $H - $pad - $W * 0.12, $W * 0.12);
            if ($footer !== '') bx_one($c, $footer, $W * 0.3, $H - $pad - $W * 0.06, $W * 0.7 - $pad, ['size' => $W * 0.03, 'font' => 'b', 'color' => bx_rgba('#ffffff', 0.85), 'align' => 'right']);
            break;

        case 'event':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, 0, $H, '#111827', bx_shade($col, -0.45)));
            for ($i = 12; $i >= 1; $i--) $c->stroke('ellipse', $W * 0.9 - $W * 0.06 * $i, $H * 0.08 - $W * 0.06 * $i, $W * 0.12 * $i, $W * 0.12 * $i, bx_alpha($col, 0.25), 2);
            $logoAt($pad, $pad * 0.8, $W * 0.12);
            if ($badge !== '') { $c->rect($W - $pad - $W * 0.26, $pad, $W * 0.26, $W * 0.075, $col, $W * 0.04); bx_one($c, $badge, $W - $pad - $W * 0.26 + 10, $pad + $W * 0.0375, $W * 0.26 - 20, ['size' => $W * 0.034, 'font' => 'k', 'color' => '#fff', 'align' => 'center']); }
            $y0 = $H * 0.22;
            [$th] = bx_title($c, $title, $pad, $y0, $W - $pad * 2, $H * 0.24, ['size' => $W * 0.1, 'color' => '#ffffff']);
            if ($subt !== '') bx_one($c, $subt, $pad, $y0 + $th + $W * 0.04, $W - $pad * 2, ['size' => $W * 0.045, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            $my = max($H * 0.56, $y0 + $th + $W * 0.12);
            if ($tall < 1.2) $my = $y0 + $th + $W * 0.1;
            if ($photo) { $s = max($W * 0.12, min($W * 0.32, $limit - $my)); $c->circle($pad + $s / 2, $my + $s / 2, $s / 2 + $W * 0.012, $col); $c->image($photo, $pad, $my, $s, $s, 'circle'); }
            if ($date !== '') {
                $c->rect($W - $pad - $W * 0.5, $my, $W * 0.5, $W * 0.16, bx_rgba('#ffffff', 0.08), $W * 0.03);
                bx_icon($c, 'cal', $W - $pad - $W * 0.09, $my + $W * 0.05, $W * 0.06, $col);
                bx_one($c, $date, $W - $pad - $W * 0.47, $my + $W * 0.08, $W * 0.36, ['size' => $W * 0.036, 'font' => 'k', 'color' => '#fff', 'align' => 'right']);
            }
            $bodyFit($W - $pad - $W * 0.5, $my + ($date !== '' ? $W * 0.2 : 0), $W * 0.5, ['size' => $W * 0.03, 'color' => '#d1d5db', 'max' => 5, 'lh' => 1.6]);
            $ctaBtn($H - $pad - $W * 0.15, $col, '#ffffff');
            $foot();
            break;

        case 'hiring':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->rect(0, 0, $W, $H * 0.42, bx_grad(0, 0, $W, $H * 0.42, $col, bx_shade($col, -0.35)));
            $c->poly([[0, $H * 0.42], [$W, $H * 0.34], [$W, $H * 0.42]], '#ffffff');
            $c->circle($W * 0.12, $H * 0.08, $W * 0.2, bx_rgba('#ffffff', 0.08));
            $logoAt($pad, $pad * 0.8, $W * 0.12);
            bx_one($c, $badge !== '' ? $badge : 'استخدام', $pad, $H * 0.11, $W - $pad * 2, ['size' => $W * 0.05, 'font' => 'b', 'color' => $col2, 'align' => 'right']);
            bx_title($c, $title ?: 'به تیم ما بپیوندید', $pad, $H * 0.15, $W - $pad * 2, $H * 0.16, ['size' => $W * 0.1, 'color' => '#ffffff']);
            $y = $H * 0.46;
            if ($subt !== '') { bx_one($c, $subt, $pad, $y, $W - $pad * 2, ['size' => $W * 0.045, 'font' => 'k', 'color' => '#111827', 'align' => 'right']); $y += $W * 0.07; }
            foreach (array_slice(bx_lines($body), 0, $tall > 1.5 ? 9 : 5) as $ln) {
                $c->circle($W - $pad - $W * 0.022, $y + $W * 0.022, $W * 0.022, bx_shade($col, 0.85));
                bx_icon($c, 'check', $W - $pad - $W * 0.04, $y + $W * 0.004, $W * 0.036, $col);
                $hh = $c->text($pad, $y - $W * 0.004, $W - $pad * 2 - $W * 0.07, $ln, ['size' => $W * 0.032, 'color' => '#374151', 'max' => 2, 'lh' => 1.55]);
                $y += max($W * 0.065, $hh + $W * 0.015);
            }
            $ctaBtn($H - $pad - $W * 0.15, $col, '#ffffff');
            $foot('#6b7280');
            break;

        case 'tips':
            $c->rect(0, 0, $W, $H, bx_shade($col, 0.92));
            $c->rect($pad * 0.5, $pad * 0.5, $W - $pad, $H - $pad, '#ffffff', $W * 0.04);
            $c->rect($pad * 0.5, $pad * 0.5, $W - $pad, $W * 0.025, $col, $W * 0.012);
            $logoAt($pad, $pad * 0.9, $W * 0.1);
            $y = $pad * 1.1;
            [$th] = bx_title($c, $title, $pad * 1.1, $y, $W - $pad * 2.2 - $W * 0.12, $H * 0.14, ['size' => $W * 0.075, 'color' => '#111827']);
            $y += $th;
            if ($subt !== '') { bx_one($c, $subt, $pad * 1.1, $y + $W * 0.02, $W - $pad * 2.2, ['size' => $W * 0.038, 'font' => 'm', 'color' => $col, 'align' => 'right']); $y += $W * 0.06; }
            $y += $W * 0.03;
            $lines = array_slice(bx_lines($body), 0, $tall > 1.5 ? 8 : 5);
            $gap = $lines ? min($W * 0.15, ($H - $pad * 1.6 - $y) / count($lines)) : 0;
            foreach ($lines as $i => $ln) {
                $c->rect($W - $pad * 1.1 - $W * 0.09, $y, $W * 0.09, $W * 0.09, $i % 2 ? $col2 : $col, $W * 0.025);
                bx_one($c, bx_fa($i + 1), $W - $pad * 1.1 - $W * 0.09, $y + $W * 0.045, $W * 0.09, ['size' => $W * 0.05, 'font' => 'k', 'color' => bx_on($i % 2 ? $col2 : $col), 'align' => 'center']);
                $c->text($pad * 1.1, $y + $W * 0.002, $W - $pad * 2.2 - $W * 0.12, $ln, ['size' => $W * 0.034, 'font' => 'm', 'color' => '#1f2937', 'max' => 2, 'lh' => 1.5]);
                $y += $gap;
            }
            $foot('#6b7280');
            break;

        case 'menu':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, 0, $H, '#1a1410', '#0d0a08'));
            if ($photo) { $c->image($photo, 0, 0, $W, $H * 0.3); $c->rect(0, $H * 0.12, $W, $H * 0.19, bx_grad(0, $H * 0.12, 0, $H * 0.3, bx_rgba('#1a1410', 0), bx_rgba('#1a1410', 1))); }
            $logoAt($W / 2 - $W * 0.06, $pad * 0.6, $W * 0.12);
            $y = $photo ? $H * 0.28 : $pad * 2;
            bx_title($c, $title ?: 'منوی ویژه', $pad, $y, $W - $pad * 2, $W * 0.12, ['size' => $W * 0.08, 'color' => $col2, 'align' => 'center']);
            $y += $W * 0.13;
            if ($subt !== '') { bx_one($c, $subt, $pad, $y, $W - $pad * 2, ['size' => $W * 0.035, 'font' => 'm', 'color' => '#d6cfc4', 'align' => 'center']); $y += $W * 0.06; }
            $c->rect($W / 2 - $W * 0.1, $y, $W * 0.2, 2, $col2); $y += $W * 0.04;
            $items = array_slice(bx_lines($body), 0, $tall > 1.5 ? 14 : 8);
            foreach ($items as $ln) {
                $p = array_map('trim', explode('|', $ln, 2));
                $price = bx_fa($p[1] ?? '');
                $pw = $price !== '' ? $c->textWidth($price, 'k', $W * 0.036) : 0;
                bx_one($c, $p[0], $W / 2, $y + $W * 0.03, $W / 2 - $pad, ['size' => $W * 0.036, 'font' => 'b', 'color' => '#f3ede4', 'align' => 'right']);
                if ($price !== '') bx_one($c, $price, $pad, $y + $W * 0.03, $W * 0.3, ['size' => $W * 0.036, 'font' => 'k', 'color' => $col2, 'align' => 'left']);
                for ($dx = $pad + $pw + 20; $dx < $W / 2 - 10; $dx += 14) $c->circle($dx, $y + $W * 0.04, 2, bx_rgba('#ffffff', 0.25));
                $y += $W * 0.075;
            }
            $foot('#a8a29e');
            break;

        case 'review':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, bx_shade($col, 0.9), bx_shade($col2, 0.85)));
            $cw = $W - $pad * 1.6; $ch = $H * 0.62; $cx = $pad * 0.8; $cy = ($H - $ch) / 2;
            $c->rect($cx + 8, $cy + 16, $cw, $ch, bx_rgba('#000000', 0.08), $W * 0.05);
            $c->rect($cx, $cy, $cw, $ch, '#ffffff', $W * 0.05);
            $s = $W * 0.2;
            $c->circle($W / 2, $cy, $s / 2 + 8, '#ffffff');
            if ($photo) $c->image($photo, $W / 2 - $s / 2, $cy - $s / 2, $s, $s, 'circle'); else { $c->circle($W / 2, $cy, $s / 2, $col); bx_icon($c, 'user', $W / 2 - $s * 0.3, $cy - $s * 0.3, $s * 0.6, '#ffffff'); }
            for ($i = 0; $i < 5; $i++) bx_icon($c, 'star', $W / 2 - $W * 0.15 + $i * $W * 0.06, $cy + $s * 0.62, $W * 0.055, '#f5b301');
            $y = $cy + $s * 0.62 + $W * 0.09;
            [$th] = bx_title($c, $title, $cx + $pad * 0.6, $y, $cw - $pad * 1.2, $ch * 0.45, ['size' => $W * 0.05, 'font' => 'b', 'color' => '#1f2937', 'align' => 'center', 'lh' => 1.6, 'min' => 20]);
            if ($subt !== '') bx_one($c, '— ' . $subt, $cx + $pad, $y + $th + $W * 0.04, $cw - $pad * 2, ['size' => $W * 0.036, 'font' => 'k', 'color' => $col, 'align' => 'center']);
            $logoAt($W / 2 - $W * 0.06, $H - $pad * 0.5 - $W * 0.14, $W * 0.12);
            if (!$logo) $foot('#4b5563');
            break;

        case 'launch':
            $c->rect(0, 0, $W, $H, '#07070c');
            $c->circle($W * 0.5, $H * 0.42, $W * 0.6, bx_grad(0, $H * 0.42 - $W * 0.6, 0, $H * 0.42 + $W * 0.6, bx_alpha($col, 0.55), bx_alpha($col2, 0.15)));
            $c->circle($W * 0.5, $H * 0.42, $W * 0.42, bx_rgba('#07070c', 0.55));
            $seed = 41;
            for ($i = 0; $i < 90; $i++) $c->circle(bx_rand($seed) * $W, bx_rand($seed) * $H, 1 + bx_rand($seed) * 2.5, bx_rgba('#ffffff', 0.2 + bx_rand($seed) * 0.6));
            $logoAt($W / 2 - $W * 0.07, $pad, $W * 0.14);
            bx_one($c, $badge !== '' ? $badge : 'به‌زودی', $pad, $H * 0.3, $W - $pad * 2, ['size' => $W * 0.04, 'font' => 'b', 'color' => $col2, 'align' => 'center']);
            [$th] = bx_title($c, $title, $pad, $H * 0.34, $W - $pad * 2, $H * 0.2, ['size' => $W * 0.12, 'color' => '#ffffff', 'align' => 'center']);
            $y = $H * 0.34 + $th + $W * 0.02;
            if ($subt !== '') { bx_one($c, $subt, $pad, $y + $W * 0.03, $W - $pad * 2, ['size' => $W * 0.042, 'font' => 'm', 'color' => '#cbd5e1', 'align' => 'center']); $y += $W * 0.09; }
            if ($date !== '') {
                $dw = min($W - $pad * 2, $c->textWidth($date, 'k', $W * 0.045) + $W * 0.16);
                $c->stroke('round', ($W - $dw) / 2, $y + $W * 0.02, $dw, $W * 0.1, $col2, 3, $W * 0.05);
                bx_one($c, $date, ($W - $dw) / 2 + 20, $y + $W * 0.07, $dw - 40, ['size' => $W * 0.045, 'font' => 'k', 'color' => '#ffffff', 'align' => 'center']);
            }
            $ctaBtn($H - $pad - $W * 0.15, $col, '#ffffff');
            $foot('#94a3b8');
            break;

        case 'photo':
        default:
            $c->rect(0, 0, $W, $H, '#ffffff');
            $ph = $H - $W * 0.36;
            if ($photo) $c->image($photo, $pad * 0.5, $pad * 0.5, $W - $pad, $ph - $pad * 0.5, 'round', $W * 0.035);
            else $c->rect($pad * 0.5, $pad * 0.5, $W - $pad, $ph - $pad * 0.5, bx_grad(0, 0, $W, $ph, $col, $col2), $W * 0.035);
            if ($badge !== '') { $bw = $c->textWidth($badge, 'k', $W * 0.034) + $W * 0.07; $c->rect($W - $pad - $bw, $pad, $bw, $W * 0.075, bx_rgba('#ffffff', 0.92), $W * 0.0375); bx_one($c, $badge, $W - $pad - $bw + 10, $pad + $W * 0.0375, $bw - 20, ['size' => $W * 0.034, 'font' => 'k', 'color' => $col, 'align' => 'center']); }
            $logoAt($pad, $ph + $W * 0.06, $W * 0.12);
            [$th] = bx_title($c, $title, $pad * 0.5 + $W * 0.16, $ph + $W * 0.05, $W - $pad - $W * 0.16, $W * 0.13, ['size' => $W * 0.065, 'color' => '#111827']);
            if ($subt !== '') bx_one($c, $subt, $pad * 0.5 + $W * 0.16, $ph + $W * 0.07 + $th, $W - $pad - $W * 0.16, ['size' => $W * 0.034, 'font' => 'm', 'color' => $col, 'align' => 'right']);
            $foot('#6b7280');
            break;
    }
    return $c;
}
