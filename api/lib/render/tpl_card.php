<?php
// BEHIX — business card templates (front + back, 90×50 mm). Design units are
// 1063×591 (300 dpi); the PDF is scaled to the real print size.
if (!defined('BX')) { http_response_code(403); exit; }

const CARD_W = 1063;
const CARD_H = 591;
const CARD_TPLS = ['band', 'dark', 'gradient', 'minimal', 'corner', 'wave', 'split', 'luxe', 'circle', 'frame', 'stripes', 'glass'];

function card_rows(BxCanvas $c, array $list, float $x, float $y0, float $gap, array $o): void
{
    $s = $o['icon'] ?? 34; $size = $o['size'] ?? 27; $maxW = $o['maxW'] ?? 520;
    $left = ($o['align'] ?? 'right') === 'left';
    foreach (array_slice($list, 0, $o['max'] ?? 5) as $i => [$ic, $v]) {
        $y = $y0 + $i * $gap;
        $ix = $left ? $x : $x - $s;
        if (!empty($o['iconBg'])) { $c->circle($ix + $s / 2, $y, $s / 2, $o['iconBg']); bx_icon($c, $ic, $ix + $s * 0.2, $y - $s * 0.3, $s * 0.6, $o['iconFg'] ?? '#fff'); }
        else bx_icon($c, $ic, $ix, $y - $s / 2, $s, $o['iconFg'] ?? '#111');
        $tx = $left ? $x + $s + 16 : $x - $s - 16 - $maxW;
        bx_one($c, $v, $tx, $y, $maxW, ['size' => $size, 'color' => $o['color'] ?? '#222', 'align' => $left ? 'left' : 'right', 'font' => $o['font'] ?? 'm']);
    }
}
function card_logo(BxCanvas $c, $logo, array $d, float $x, float $y, float $w, float $h, $fg, string $font = 'k'): void
{
    if ($logo) { $c->image($logo, $x, $y, $w, $h, 'rect', 0, 'contain'); return; }
    $t = trim((string) ($d['company'] ?: $d['name']));
    if ($t === '') return;
    bx_one($c, $t, $x, $y + $h / 2, $w, ['size' => min(64, $h * 0.42), 'font' => $font, 'color' => $fg, 'align' => 'center']);
}
function card_wave(float $y, float $amp, float $phase, int $W, int $H): array
{
    $pts = [];
    for ($i = 0; $i <= 48; $i++) { $x = $W * $i / 48; $pts[] = [$x, $y + sin($i / 48 * M_PI * 2 + $phase) * $amp]; }
    $pts[] = [$W, $H]; $pts[] = [0, $H];
    return $pts;
}

function card_render(array $d, bool $sample = false): BxCanvas
{
    $W = CARD_W; $H = CARD_H;
    if ($sample) {
        $d['name'] = $d['name'] ?: 'نام و نام خانوادگی';
        if (!$d['role'] && !$d['company']) $d['role'] = 'سمت شما';
        $d['phone'] = $d['phone'] ?: '09120000000';
    }
    $col = bx_hex($d['color'] ?? '', '#ff7a1a'); $col2 = bx_hex($d['color2'] ?? '', '#111827');
    $t = in_array($d['tpl'] ?? '', CARD_TPLS, true) ? $d['tpl'] : 'band';
    $logo = bx_image_load($d['logo'] ?? '');
    $list = bx_contacts($d);
    $name = (string) ($d['name'] ?? ''); $role = (string) ($d['role'] ?: $d['company']);
    $sub = implode(' · ', array_filter([$d['role'] ?? '', $d['company'] ?? '']));
    $c = new BxCanvas($W, $H);
    $c->pdfScale = 255.12 / $W;
    $c->title = 'کارت ویزیت ' . $name;
    $gold = bx_mix('#d4af37', $col, 0.15);

    switch ($t) {
        case 'band':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->rect(0, 0, 370, $H, bx_grad(0, 0, 370, $H, $col, bx_shade($col, -0.45)));
            $c->circle(370, $H, 120, bx_alpha(bx_shade($col, 0.25), 0.35));
            $c->circle(40, 40, 90, bx_rgba('#ffffff', 0.08));
            card_logo($c, $logo, $d, 65, 160, 240, 240, '#ffffff');
            bx_one($c, $name, 420, 118, $W - 490, ['size' => 62, 'font' => 'k', 'color' => '#111827', 'align' => 'right']);
            bx_one($c, $role, 420, 186, $W - 490, ['size' => 32, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            $c->rect($W - 170, 228, 100, 7, $col, 3);
            card_rows($c, $list, $W - 70, 290, 56, ['iconBg' => $col, 'iconFg' => '#fff', 'color' => '#333', 'maxW' => 520]);
            break;
        case 'dark':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, '#0f1117', '#1d2130'));
            $c->rect(0, $H - 16, $W, 16, bx_grad(0, 0, $W, 0, $col, $col2 === '#111827' ? bx_shade($col, 0.35) : $col2));
            $c->circle($W - 40, -60, 220, bx_alpha($col, 0.10));
            card_logo($c, $logo, $d, 60, 50, 170, 140, '#ffffff');
            bx_one($c, $name, 250, 130, $W - 320, ['size' => 64, 'font' => 'k', 'color' => '#ffffff', 'align' => 'right']);
            bx_one($c, $role, 250, 198, $W - 320, ['size' => 31, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            card_rows($c, $list, $W - 70, 300, 54, ['iconFg' => $col, 'color' => '#e5e7eb', 'icon' => 30]);
            break;
        case 'gradient':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, $col2));
            $c->circle($W - 80, 60, 260, bx_rgba('#ffffff', 0.12));
            $c->circle(60, $H, 180, bx_rgba('#ffffff', 0.08));
            card_logo($c, $logo, $d, $W / 2 - 70, 40, 140, 110, '#ffffff');
            bx_one($c, $name, 80, 212, $W - 160, ['size' => 64, 'font' => 'k', 'color' => '#ffffff', 'align' => 'center']);
            bx_one($c, $sub, 80, 280, $W - 160, ['size' => 30, 'font' => 'm', 'color' => bx_rgba('#ffffff', 0.9), 'align' => 'center']);
            foreach (array_slice($list, 0, 4) as $i => $it) {
                $x = $i % 2 ? 520 : $W - 70;
                card_rows($c, [$it], $x, 385 + intdiv($i, 2) * 72, 0, ['iconBg' => bx_rgba('#ffffff', 0.22), 'iconFg' => '#fff', 'color' => '#ffffff', 'maxW' => 400, 'size' => 26]);
            }
            break;
        case 'minimal':
            $c->rect(0, 0, $W, $H, '#ffffff');
            card_logo($c, $logo, $d, $W / 2 - 60, 46, 120, 100, $col);
            bx_one($c, $name, 80, 205, $W - 160, ['size' => 62, 'font' => 'k', 'color' => '#111111', 'align' => 'center']);
            bx_one($c, $role, 80, 268, $W - 160, ['size' => 29, 'font' => 'm', 'color' => '#6b7280', 'align' => 'center']);
            $c->rect($W / 2 - 50, 308, 100, 5, $col, 2);
            bx_one($c, implode('   |   ', array_column(array_slice($list, 0, 3), 1)), 50, 395, $W - 100, ['size' => 25, 'color' => '#333', 'align' => 'center']);
            if (isset($list[3])) bx_one($c, $list[3][1], 50, 448, $W - 100, ['size' => 23, 'color' => '#777', 'align' => 'center']);
            break;
        case 'corner':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->poly([[0, $H], [0, $H - 330], [420, $H]], $col);
            $c->poly([[0, $H], [0, $H - 200], [260, $H]], bx_alpha(bx_shade($col, 0.35), 0.8));
            $c->poly([[$W, 0], [$W - 150, 0], [$W, 115]], $col);
            $c->poly([[$W, 0], [$W - 80, 0], [$W, 62]], bx_shade($col, -0.3));
            card_logo($c, $logo, $d, 60, 50, 170, 130, $col);
            bx_one($c, $name, 280, 140, $W - 360, ['size' => 60, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 280, 205, $W - 360, ['size' => 31, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            card_rows($c, $list, $W - 80, 300, 54, ['iconBg' => $col, 'iconFg' => '#fff', 'color' => '#333']);
            break;
        case 'wave':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->poly(card_wave($H * 0.64, 34, 0.6, $W, $H), $col);
            $c->poly(card_wave($H * 0.76, 26, 2.4, $W, $H), bx_shade($col, -0.3));
            card_logo($c, $logo, $d, 60, 40, 150, 120, $col);
            bx_one($c, $name, 250, 100, $W - 320, ['size' => 58, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 250, 162, $W - 320, ['size' => 30, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            foreach (array_slice($list, 0, 4) as $i => $it) card_rows($c, [$it], $i % 2 ? 500 : $W - 60, 448 + intdiv($i, 2) * 62, 0, ['iconFg' => '#fff', 'color' => '#ffffff', 'maxW' => 390, 'size' => 26, 'icon' => 30]);
            break;
        case 'split':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->poly([[0, 0], [430, 0], [340, $H], [0, $H]], bx_grad(0, 0, 0, $H, bx_shade($col2, 0.05), bx_shade($col2, -0.35)));
            $c->poly([[430, 0], [450, 0], [360, $H], [340, $H]], $col);
            card_logo($c, $logo, $d, 50, 170, 250, 250, '#ffffff');
            bx_one($c, $name, 470, 120, $W - 530, ['size' => 58, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 470, 182, $W - 530, ['size' => 30, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            card_rows($c, $list, $W - 60, 280, 56, ['iconFg' => $col, 'color' => '#333', 'maxW' => 470, 'icon' => 30]);
            break;
        case 'luxe':
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, 0, $H, '#121212', '#050505'));
            $c->stroke('rect', 28, 28, $W - 56, $H - 56, $gold, 3);
            $c->stroke('rect', 40, 40, $W - 80, $H - 80, bx_alpha($gold, 0.45), 1.5);
            card_logo($c, $logo, $d, $W / 2 - 60, 70, 120, 100, $gold);
            bx_one($c, $name, 100, 238, $W - 200, ['size' => 60, 'font' => 'k', 'color' => $gold, 'align' => 'center']);
            bx_one($c, $sub, 100, 300, $W - 200, ['size' => 27, 'font' => 'm', 'color' => '#d6d3cb', 'align' => 'center']);
            $c->rect($W / 2 - 120, 340, 240, 2, $gold);
            $c->poly([[$W / 2, 332], [$W / 2 + 9, 341], [$W / 2, 350], [$W / 2 - 9, 341]], $gold);
            bx_one($c, implode('   •   ', array_column(array_slice($list, 0, 3), 1)), 70, 410, $W - 140, ['size' => 24, 'color' => '#e8e2d0', 'align' => 'center']);
            if (isset($list[3])) bx_one($c, $list[3][1], 70, 462, $W - 140, ['size' => 22, 'color' => '#a8a294', 'align' => 'center']);
            break;
        case 'circle':
            $c->rect(0, 0, $W, $H, bx_shade($col, 0.93));
            $c->circle(150, $H / 2, 330, bx_grad(0, 0, 400, $H, $col, bx_shade($col, -0.4)));
            $c->circle(150, $H / 2, 190, bx_rgba('#ffffff', 0.14));
            card_logo($c, $logo, $d, 40, $H / 2 - 110, 240, 220, '#ffffff');
            bx_one($c, $name, 520, 120, $W - 580, ['size' => 56, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 520, 180, $W - 580, ['size' => 29, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            card_rows($c, $list, $W - 60, 270, 56, ['iconBg' => $col, 'iconFg' => '#fff', 'color' => '#333', 'maxW' => 420]);
            break;
        case 'frame':
            $c->rect(0, 0, $W, $H, $col);
            $c->rect(22, 22, $W - 44, $H - 44, '#ffffff', 18);
            $c->rect(22, 22, $W - 44, 150, bx_shade($col, 0.9), 18);
            $c->rect(22, 150, $W - 44, 22, bx_shade($col, 0.9));
            card_logo($c, $logo, $d, 60, 44, 130, 106, $col);
            bx_one($c, $name, 230, 78, $W - 290, ['size' => 52, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 230, 132, $W - 290, ['size' => 27, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            foreach (array_slice($list, 0, 6) as $i => $it) card_rows($c, [$it], $i % 2 ? 500 : $W - 70, 240 + intdiv($i, 2) * 92, 0, ['iconBg' => $col, 'iconFg' => '#fff', 'color' => '#333', 'maxW' => 380, 'size' => 25]);
            break;
        case 'stripes':
            $c->rect(0, 0, $W, $H, '#ffffff');
            for ($i = 0; $i < 7; $i++) {
                $x0 = -200 + $i * 70;
                $c->poly([[$x0, $H], [$x0 + 36, $H], [$x0 + 36 + 330, 0], [$x0 + 330, 0]], $i % 2 ? bx_alpha($col2, 0.85) : $col);
            }
            $c->rect(0, 0, 470, $H, bx_rgba('#ffffff', 0));
            card_logo($c, $logo, $d, 560, 40, 150, 110, $col);
            bx_one($c, $name, 520, 210, $W - 580, ['size' => 54, 'font' => 'k', 'color' => '#111', 'align' => 'right']);
            bx_one($c, $role, 520, 268, $W - 580, ['size' => 28, 'font' => 'b', 'color' => $col, 'align' => 'right']);
            card_rows($c, $list, $W - 60, 345, 52, ['iconFg' => $col, 'color' => '#333', 'maxW' => 420, 'icon' => 28, 'max' => 4, 'size' => 25]);
            break;
        case 'glass':
        default:
            $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, $col2));
            $c->circle(180, 120, 210, bx_alpha(bx_shade($col, 0.4), 0.55));
            $c->circle($W - 120, $H - 40, 240, bx_alpha(bx_shade($col2, 0.3), 0.55));
            $c->rect(70, 60, $W - 140, $H - 120, bx_rgba('#ffffff', 0.18), 34);
            $c->stroke('round', 70, 60, $W - 140, $H - 120, bx_rgba('#ffffff', 0.45), 2, 34);
            card_logo($c, $logo, $d, 110, 95, 130, 105, '#ffffff');
            bx_one($c, $name, 270, 135, $W - 380, ['size' => 54, 'font' => 'k', 'color' => '#ffffff', 'align' => 'right']);
            bx_one($c, $role, 270, 192, $W - 380, ['size' => 28, 'font' => 'b', 'color' => bx_rgba('#ffffff', 0.9), 'align' => 'right']);
            foreach (array_slice($list, 0, 4) as $i => $it) card_rows($c, [$it], $i % 2 ? 510 : $W - 110, 300 + intdiv($i, 2) * 70, 0, ['iconBg' => bx_rgba('#ffffff', 0.25), 'iconFg' => '#fff', 'color' => '#ffffff', 'maxW' => 360, 'size' => 25]);
            break;
    }

    // ---------------------------------------------------------------- back
    $c->page($W, $H);
    if ($sample && !$logo && !$d['company']) $d['company'] = 'نام برند';
    $bgMap = ['minimal' => '#ffffff', 'dark' => '#0f1117', 'luxe' => '#0a0a0a', 'circle' => bx_shade($col, 0.93), 'split' => bx_shade($col2, -0.1)];
    $bg = $bgMap[$t] ?? $col;
    if (in_array($t, ['gradient', 'glass'], true)) $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, $col2));
    elseif ($t === 'band' || $t === 'corner' || $t === 'frame') $c->rect(0, 0, $W, $H, bx_grad(0, 0, $W, $H, $col, bx_shade($col, -0.4)));
    else $c->rect(0, 0, $W, $H, $bg);
    $fg = in_array($t, ['minimal', 'circle'], true) ? '#111111' : ($t === 'luxe' ? $gold : '#ffffff');
    if ($t === 'luxe') $c->stroke('rect', 28, 28, $W - 56, $H - 56, $gold, 3);
    if ($t === 'wave') { $c->poly(card_wave($H * 0.82, 20, 1.4, $W, $H), bx_shade($col, -0.3)); }
    if ($t === 'stripes') for ($i = 0; $i < 4; $i++) { $x0 = $W - 260 + $i * 70; $c->poly([[$x0, $H], [$x0 + 36, $H], [$x0 + 336, 0], [$x0 + 300, 0]], bx_alpha('#ffffff', 0.18)); }
    if ($t === 'band' || $t === 'gradient' || $t === 'glass') { $c->circle($W - 60, 40, 200, bx_rgba('#ffffff', 0.1)); $c->circle(80, $H - 20, 150, bx_rgba('#ffffff', 0.07)); }
    $qrText = trim((string) ($d['qrText'] ?? ''));
    if ($qrText === '' && !empty($d['web'])) $qrText = preg_match('~^https?://~i', $d['web']) ? $d['web'] : 'https://' . $d['web'];
    if ($qrText === '' && !empty($d['phone'])) $qrText = 'tel:' . bx_en($d['phone']);
    $qr = !empty($d['backQr']) && $qrText !== '';
    $cx = $qr ? $W * 0.62 : $W / 2;
    $bw = $qr ? 560 : 900;
    if ($logo) $c->image($logo, $cx - 170, 110, 340, 230, 'rect', 0, 'contain');
    else bx_one($c, $d['company'] ?: $name, $cx - $bw / 2, $H / 2 - 40, $bw, ['size' => 74, 'font' => 'k', 'color' => $fg, 'align' => 'center']);
    if (!empty($d['slogan'])) bx_one($c, $d['slogan'], $cx - $bw / 2, 420, $bw, ['size' => 31, 'font' => 'm', 'color' => $fg, 'align' => 'center']);
    if ($qr) $c->qr($qrText, 100, $H / 2 - 150, 300, '#111111', '#ffffff');
    return $c;
}
