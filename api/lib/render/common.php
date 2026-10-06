<?php
// BEHIX — helpers shared by the studio templates: digits, single-line fitted
// text, small vector icons, color shades and input clean-up.
if (!defined('BX')) { http_response_code(403); exit; }

function bx_fa($s): string { return strtr((string) $s, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']); }
function bx_en($s): string { return strtr((string) $s, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']); }
function bx_shade($c, float $amt): array { return $amt >= 0 ? bx_mix($c, '#ffffff', $amt) : bx_mix($c, '#000000', -$amt); }
function bx_hex($c, string $def = '#ff7a1a'): string { return is_string($c) && preg_match('/^#[0-9a-f]{6}$/i', $c) ? $c : $def; }
// Clean a design payload: strings trimmed and capped, nested lists kept
function bx_clean($v, int $depth = 0)
{
    if ($depth > 5) return null;
    if (is_array($v)) { $o = []; foreach (array_slice($v, 0, 80, true) as $k => $x) $o[$k] = bx_clean($x, $depth + 1); return $o; }
    if (is_string($v)) return str_starts_with($v, 'data:image/') ? $v : mb_substr(trim($v), 0, 2000);
    return is_scalar($v) || $v === null ? $v : null;
}
function bx_lines($s): array { return array_values(array_filter(array_map('trim', explode("\n", (string) $s)), 'strlen')); }

// One line of text centered vertically on $cy, shrunk to fit $w
function bx_one(BxCanvas $c, $s, float $x, float $cy, float $w, array $o = []): float
{
    $s = trim((string) $s);
    if ($s === '') return 0;
    $size = (float) ($o['size'] ?? 30);
    $font = $o['font'] ?? 'r';
    $min = (float) ($o['min'] ?? $size * 0.45);
    while ($size > $min && $c->textWidth($s, $font, $size) > $w) $size *= 0.95;
    $lh = 1.3;
    $c->text($x, $cy - $size * $lh / 2, $w, $s, ['size' => $size, 'lh' => $lh, 'max' => 1, 'font' => $font, 'color' => $o['color'] ?? '#151821', 'align' => $o['align'] ?? 'start', 'dir' => $o['dir'] ?? 'auto']);
    return min($w, $c->textWidth($s, $font, $size));
}
// Multi-line title: biggest size that fits the box; returns [height, size]
function bx_title(BxCanvas $c, $s, float $x, float $y, float $w, float $h, array $o = []): array
{
    $s = trim((string) $s);
    if ($s === '') return [0, 0];
    $o += ['font' => 'k', 'lh' => 1.3, 'align' => 'start'];
    $size = $c->fit($s, $w, $h, (float) ($o['size'] ?? 80), $o, (float) ($o['min'] ?? 14));
    $hh = $c->text($x, $y, $w, $s, ['size' => $size] + $o);
    return [$hh, $size];
}

// Tiny vector icons (24-unit grid) drawn with the canvas primitives
function bx_icon(BxCanvas $c, string $name, float $x, float $y, float $s, $col): void
{
    $u = $s / 24; $col = bx_rgba($col);
    $P = fn ($px, $py) => [$x + $px * $u, $y + $py * $u];
    switch ($name) {
        case 'phone':
            $c->poly([$P(5, 3), $P(9, 3), $P(11, 8.5), $P(8.5, 10.2), $P(13.8, 15.5), $P(15.5, 13), $P(21, 15), $P(21, 19), $P(19, 21), $P(16, 21), $P(3, 8), $P(3, 5)], $col);
            break;
        case 'mail':
            $c->stroke('round', $x + 2.5 * $u, $y + 5 * $u, 19 * $u, 14 * $u, $col, 2 * $u, 2 * $u);
            $c->line($x + 3.5 * $u, $y + 6.5 * $u, $x + 12 * $u, $y + 13 * $u, $col, 2 * $u);
            $c->line($x + 20.5 * $u, $y + 6.5 * $u, $x + 12 * $u, $y + 13 * $u, $col, 2 * $u);
            break;
        case 'web':
            $c->stroke('ellipse', $x + 3 * $u, $y + 3 * $u, 18 * $u, 18 * $u, $col, 2 * $u);
            $c->stroke('ellipse', $x + 8 * $u, $y + 3 * $u, 8 * $u, 18 * $u, $col, 1.6 * $u);
            $c->line($x + 3 * $u, $y + 12 * $u, $x + 21 * $u, $y + 12 * $u, $col, 1.6 * $u);
            break;
        case 'map':
            $c->circle($x + 12 * $u, $y + 9.5 * $u, 6.5 * $u, $col);
            $c->poly([$P(6.6, 12.5), $P(17.4, 12.5), $P(12, 21.5)], $col);
            $c->circle($x + 12 * $u, $y + 9.5 * $u, 2.6 * $u, '#ffffff');
            break;
        case 'insta':
            $c->stroke('round', $x + 3.5 * $u, $y + 3.5 * $u, 17 * $u, 17 * $u, $col, 2 * $u, 5 * $u);
            $c->stroke('ellipse', $x + 8 * $u, $y + 8 * $u, 8 * $u, 8 * $u, $col, 2 * $u);
            $c->circle($x + 17 * $u, $y + 7 * $u, 1.2 * $u, $col);
            break;
        case 'user':
            $c->circle($x + 12 * $u, $y + 8 * $u, 4.5 * $u, $col);
            $c->rect($x + 4 * $u, $y + 14 * $u, 16 * $u, 8 * $u, $col, 4 * $u);
            break;
        case 'star':
            $pts = [];
            for ($i = 0; $i < 10; $i++) { $r = $i % 2 ? 4.2 : 10; $a = -M_PI / 2 + $i * M_PI / 5; $pts[] = $P(12 + $r * cos($a), 12.5 + $r * sin($a)); }
            $c->poly($pts, $col);
            break;
        case 'check':
            $c->line($x + 5 * $u, $y + 12.5 * $u, $x + 10 * $u, $y + 17.5 * $u, $col, 2.6 * $u);
            $c->line($x + 10 * $u, $y + 17.5 * $u, $x + 19.5 * $u, $y + 6.5 * $u, $col, 2.6 * $u);
            break;
        case 'cal':
            $c->stroke('round', $x + 3 * $u, $y + 5 * $u, 18 * $u, 16 * $u, $col, 2 * $u, 2.5 * $u);
            $c->rect($x + 3 * $u, $y + 5 * $u, 18 * $u, 5 * $u, $col, 2 * $u);
            $c->rect($x + 7 * $u, $y + 2.5 * $u, 2 * $u, 5 * $u, $col, 1 * $u);
            $c->rect($x + 15 * $u, $y + 2.5 * $u, 2 * $u, 5 * $u, $col, 1 * $u);
            break;
        case 'pin':
            $c->circle($x + 12 * $u, $y + 12 * $u, 5 * $u, $col);
            break;
    }
}
// Contact list of the card/resume: [[icon, value, ltr?], ...]
function bx_contacts(array $d): array
{
    $l = [];
    if (!empty($d['phone'])) $l[] = ['phone', bx_fa($d['phone'])];
    if (!empty($d['phone2'])) $l[] = ['phone', bx_fa($d['phone2'])];
    if (!empty($d['email'])) $l[] = ['mail', $d['email']];
    if (!empty($d['web'])) $l[] = ['web', $d['web']];
    if (!empty($d['insta'])) $l[] = ['insta', '@' . ltrim($d['insta'], '@')];
    if (!empty($d['address'])) $l[] = ['map', $d['address']];
    return $l;
}
// Deterministic pseudo-random numbers for decorative patterns
function bx_rand(int &$seed): float { $seed = ($seed * 9301 + 49297) % 233280; return $seed / 233280; }
