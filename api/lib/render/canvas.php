<?php
// BEHIX — server-side drawing surface. Templates draw shapes, text and images
// onto pages (units: points, origin top-left); the same pages are rendered to a
// PNG/JPEG with GD (previews carry a baked-in watermark) or to a vector PDF.
// Final files are only ever produced on the server after the purchase check.
if (!defined('BX')) { http_response_code(403); exit; }

require_once __DIR__ . '/font.php';
require_once __DIR__ . '/text.php';

const BX_FONT_FILES = ['r' => 'Vazirmatn-Regular.ttf', 'm' => 'Vazirmatn-Medium.ttf', 'b' => 'Vazirmatn-Bold.ttf', 'k' => 'Vazirmatn-Black.ttf'];

function bx_font(string $k): BxFont { return BxFont::get(dirname(__DIR__, 2) . '/fonts/' . (BX_FONT_FILES[$k] ?? BX_FONT_FILES['r'])); }
function bx_font_path(string $k): string { return dirname(__DIR__, 2) . '/fonts/' . (BX_FONT_FILES[$k] ?? BX_FONT_FILES['r']); }

// '#rrggbb' (+ alpha 0..1) → [r, g, b, a]
function bx_rgba($c, float $a = 1.0): array
{
    if (is_array($c)) return $c;
    $c = ltrim((string) $c, '#');
    if (strlen($c) === 3) $c = $c[0] . $c[0] . $c[1] . $c[1] . $c[2] . $c[2];
    if (!preg_match('/^[0-9a-f]{6}$/i', $c)) $c = '000000';
    return [hexdec(substr($c, 0, 2)), hexdec(substr($c, 2, 2)), hexdec(substr($c, 4, 2)), max(0, min(1, $a))];
}
// Mix two colors: t=0 → a, t=1 → b
function bx_mix($a, $b, float $t): array
{
    $a = bx_rgba($a); $b = bx_rgba($b);
    return [(int) round($a[0] + ($b[0] - $a[0]) * $t), (int) round($a[1] + ($b[1] - $a[1]) * $t), (int) round($a[2] + ($b[2] - $a[2]) * $t), $a[3] + ($b[3] - $a[3]) * $t];
}
function bx_alpha($c, float $a): array { $c = bx_rgba($c); $c[3] = $a; return $c; }
// Relative luminance → pick readable text color on a background
function bx_on($bg, $dark = '#151821', $light = '#ffffff'): array
{
    [$r, $g, $b] = bx_rgba($bg);
    return (0.299 * $r + 0.587 * $g + 0.114 * $b) > 160 ? bx_rgba($dark) : bx_rgba($light);
}
// Linear gradient fill between two points
function bx_grad(float $x1, float $y1, float $x2, float $y2, $c1, $c2): array { return ['g', $x1, $y1, $x2, $y2, bx_rgba($c1), bx_rgba($c2)]; }

// Image source → GD image. Only inline data URLs are accepted: designs never
// reference server files, so a crafted request cannot pull private uploads.
function bx_image_load(?string $src)
{
    if (!$src || !is_string($src) || !str_starts_with($src, 'data:image/')) return null;
    $p = strpos($src, ',');
    if ($p === false || strlen($src) > 6 * 1024 * 1024) return null;
    $bin = base64_decode(substr($src, $p + 1), true);
    if (!$bin) return null;
    $info = @getimagesizefromstring($bin);
    if (!$info || $info[0] * $info[1] > 16000000 || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP], true)) return null;
    $im = @imagecreatefromstring($bin);
    if (!$im) return null;
    if (!imageistruecolor($im)) imagepalettetotruecolor($im);
    imagealphablending($im, false);
    imagesavealpha($im, true);
    return $im;
}

final class BxCanvas
{
    public array $pages = [];
    private int $cur = -1;
    public string $title = '';
    public float $pdfScale = 1.0; // design units → PDF points
    public string $defaultDir = 'auto'; // base direction when a text call gives none

    public function __construct(float $w, float $h) { $this->page($w, $h); }
    public function page(float $w, float $h): self { $this->pages[] = ['w' => $w, 'h' => $h, 'ops' => []]; $this->cur = count($this->pages) - 1; return $this; }
    public function w(): float { return $this->pages[$this->cur]['w']; }
    public function h(): float { return $this->pages[$this->cur]['h']; }
    private function op(array $o): self { $this->pages[$this->cur]['ops'][] = $o; return $this; }

    // ---------------------------------------------------------- shapes
    public function rect(float $x, float $y, float $w, float $h, $fill, float $r = 0): self
    {
        if ($w <= 0 || $h <= 0) return $this;
        return $this->op(['rect', $x, $y, $w, $h, is_array($fill) && ($fill[0] ?? null) === 'g' ? $fill : bx_rgba($fill), min($r, $w / 2, $h / 2)]);
    }
    public function ellipse(float $cx, float $cy, float $rx, float $ry, $fill): self { return $this->op(['ellipse', $cx, $cy, $rx, $ry, is_array($fill) && ($fill[0] ?? null) === 'g' ? $fill : bx_rgba($fill)]); }
    public function circle(float $cx, float $cy, float $r, $fill): self { return $this->ellipse($cx, $cy, $r, $r, $fill); }
    public function poly(array $pts, $fill): self { return $this->op(['poly', $pts, bx_rgba($fill)]); }
    public function line(float $x1, float $y1, float $x2, float $y2, $color, float $w = 1): self
    {
        $dx = $x2 - $x1; $dy = $y2 - $y1; $l = sqrt($dx * $dx + $dy * $dy) ?: 1;
        $nx = -$dy / $l * $w / 2; $ny = $dx / $l * $w / 2;
        return $this->poly([[$x1 + $nx, $y1 + $ny], [$x2 + $nx, $y2 + $ny], [$x2 - $nx, $y2 - $ny], [$x1 - $nx, $y1 - $ny]], $color);
    }
    // Outline of a (rounded) rectangle or ellipse
    public function stroke(string $shape, float $x, float $y, float $w, float $h, $color, float $lw = 1, float $r = 0): self
    {
        return $this->op(['ring', $shape, $x, $y, $w, $h, bx_rgba($color), $lw, min($r, $w / 2, $h / 2)]);
    }
    public function image($im, float $x, float $y, float $w, float $h, string $clip = 'rect', float $r = 0, string $fit = 'cover'): self
    {
        if (!$im) return $this;
        return $this->op(['image', $im, $x, $y, $w, $h, $clip, $r, $fit]);
    }
    public function qr(string $text, float $x, float $y, float $size, $color = '#000000', $bg = null): self
    {
        if ($text === '') return $this;
        try {
            $q = \BaconQrCode\Encoder\Encoder::encode($text, \BaconQrCode\Common\ErrorCorrectionLevel::M(), 'UTF-8');
        } catch (Throwable $e) { return $this; }
        $m = $q->getMatrix(); $n = $m->getWidth();
        $grid = [];
        for ($j = 0; $j < $n; $j++) for ($i = 0; $i < $n; $i++) $grid[$j][$i] = $m->get($i, $j) === 1;
        if ($bg !== null) $this->rect($x - $size * 0.06, $y - $size * 0.06, $size * 1.12, $size * 1.12, $bg, $size * 0.06);
        return $this->op(['qr', $x, $y, $size, $grid, bx_rgba($color)]);
    }
    public function watermark(string $text): self { return $this->op(['wm', $text]); }

    // ---------------------------------------------------------- text
    // A run list: [[text, fontKey, color], ...]. Options: size, lh (line height ×size),
    // align (start|end|center|left|right), dir (auto|rtl|ltr), max (lines), font, color.
    public function text(float $x, float $y, float $w, $text, array $o = []): float
    {
        $runs = is_array($text) ? $text : [[(string) $text, $o['font'] ?? 'r', $o['color'] ?? '#151821']];
        $size = (float) ($o['size'] ?? 11);
        $lh = (float) ($o['lh'] ?? 1.75);
        $lines = $this->layout($runs, $w, $size, $o);
        if (isset($o['skip']) || isset($o['take'])) $lines = array_slice($lines, (int) ($o['skip'] ?? 0), isset($o['take']) ? (int) $o['take'] : null);
        $max = (int) ($o['max'] ?? 0);
        if ($max && count($lines) > $max) {
            $lines = array_slice($lines, 0, $max);
            $last = &$lines[$max - 1];
            $last['ell'] = true;
            unset($last);
        }
        $lineH = $size * $lh;
        foreach ($lines as $i => $ln) $this->drawLine($ln, $x, $y + $i * $lineH, $w, $size, $lineH, $o);
        return count($lines) * $lineH;
    }
    // Number of wrapped lines
    public function lineCount($text, float $w, array $o = []): int
    {
        $runs = is_array($text) ? $text : [[(string) $text, $o['font'] ?? 'r', $o['color'] ?? '#000']];
        return count($this->layout($runs, $w, (float) ($o['size'] ?? 11), $o));
    }
    // Height a text block would take (no drawing)
    public function measure($text, float $w, array $o = []): float
    {
        $runs = is_array($text) ? $text : [[(string) $text, $o['font'] ?? 'r', $o['color'] ?? '#000']];
        $size = (float) ($o['size'] ?? 11);
        $n = count($this->layout($runs, $w, $size, $o));
        if (!empty($o['max'])) $n = min($n, (int) $o['max']);
        return $n * $size * (float) ($o['lh'] ?? 1.75);
    }
    // Width of a single-line string
    public function textWidth(string $s, string $font, float $size): float { return bx_font($font)->width(bx_visual($s), $size); }
    // Largest size ≤ $size at which text fits $w×$h
    public function fit($text, float $w, float $h, float $size, array $o = [], float $min = 6): float
    {
        while ($size > $min && ($this->measure($text, $w, ['size' => $size] + $o) > $h || $this->longestWord($text, $size, $o) > $w)) $size *= 0.93;
        return $size;
    }
    private function longestWord($text, float $size, array $o): float
    {
        $runs = is_array($text) ? $text : [[(string) $text, $o['font'] ?? 'r', null]];
        $m = 0;
        foreach ($runs as [$t, $f]) foreach (preg_split('/\s+/u', (string) $t) as $wd) if ($wd !== '') $m = max($m, bx_font($f)->width(bx_visual($wd), $size));
        return $m;
    }

    // Breaks runs into lines of logical chars [cp, style] that fit $w
    private function layout(array $runs, float $w, float $size, array $o): array
    {
        $chars = [];
        foreach ($runs as $ri => $r) {
            $t = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]/u', '', str_replace(["\r\n", "\r", "\t"], ["\n", "\n", ' '], (string) $r[0]));
            foreach (bx_cps($t) as $cp) $chars[] = [$cp, $ri];
        }
        $lines = [];
        $paras = [[]];
        foreach ($chars as $c) { if ($c[0] === 10) $paras[] = []; else $paras[count($paras) - 1][] = $c; }
        $spaceW = bx_font('r')->width(' ', $size);
        foreach ($paras as $p) {
            // words: split on spaces
            $words = []; $cur = [];
            foreach ($p as $c) { if ($c[0] === 32 || $c[0] === 0xA0) { if ($cur) $words[] = $cur; $cur = []; } else $cur[] = $c; }
            if ($cur) $words[] = $cur;
            if (!$words) { $lines[] = ['chars' => [], 'runs' => $runs]; continue; }
            $line = []; $lw = 0;
            foreach ($words as $wd) {
                $ww = $this->charsWidth($wd, $runs, $size);
                $spaceW = bx_font($runs[$wd[0][1]][1] ?? 'r')->width(' ', $size);
                if ($line && $lw + $spaceW + $ww > $w + 0.01) { $lines[] = ['chars' => $line, 'runs' => $runs]; $line = []; $lw = 0; }
                // a single word wider than the box is split by characters
                if (!$line && $ww > $w && count($wd) > 1) {
                    $part = [];
                    foreach ($wd as $c) {
                        if ($part && $this->charsWidth(array_merge($part, [$c]), $runs, $size) > $w) { $lines[] = ['chars' => $part, 'runs' => $runs]; $part = []; }
                        $part[] = $c;
                    }
                    $line = $part; $lw = $this->charsWidth($part, $runs, $size);
                    continue;
                }
                if ($line) { $line[] = [32, $wd[0][1]]; $lw += $spaceW; }
                foreach ($wd as $c) $line[] = $c;
                $lw += $ww;
            }
            if ($line) $lines[] = ['chars' => $line, 'runs' => $runs];
        }
        return $lines;
    }
    private function charsWidth(array $chars, array $runs, float $size): float
    {
        $cps = array_column($chars, 0);
        $sh = bx_shape($cps);
        $w = 0;
        foreach ($sh as $i => $c) {
            if ($c === -1 || $c === 0x200C || $c === 0x200D) continue;
            $f = bx_font($runs[$chars[$i][1]][1] ?? 'r');
            $w += ($f->adv[$f->cmap[$c] ?? 0] ?? 0) * $size / $f->upm;
        }
        return $w;
    }
    // Visual segments of one line: [[str, font, color, width], ...] left→right; spaces are gaps
    private function segments(array $ln, float $size, string $dir): array
    {
        $chars = $ln['chars'];
        if (!empty($ln['ell'])) { $chars[] = [0x2026, $chars ? end($chars)[1] : 0]; }
        $cps = array_column($chars, 0);
        if (!$cps) return [];
        if ($dir === 'auto') $dir = bx_base_dir($cps);
        $sh = bx_shape($cps);
        [$order, $lvl] = bx_bidi_order($cps, $dir);
        $segs = []; $cur = null;
        foreach ($order as $i) {
            $c = $sh[$i];
            if ($c === -1 || $c === 0x200C || $c === 0x200D) continue;
            $style = $chars[$i][1];
            $ch = mb_chr($c);
            if ($lvl[$i] % 2 === 1 && isset(BX_MIRROR[$ch])) $ch = BX_MIRROR[$ch];
            if ($c === 32) { if ($cur) $segs[] = $cur; $cur = null; $segs[] = ['sp', $style]; continue; }
            if ($cur && $cur[1] === $style) $cur[0] .= $ch;
            else { if ($cur) $segs[] = $cur; $cur = [$ch, $style]; }
        }
        if ($cur) $segs[] = $cur;
        $runs = $ln['runs'];
        $out = [];
        foreach ($segs as $s) {
            $font = $runs[$s[1]][1] ?? 'r';
            if ($s[0] === 'sp') { $out[] = [' ', $font, null, bx_font($font)->width(' ', $size)]; continue; }
            $out[] = [$s[0], $font, bx_rgba($runs[$s[1]][2] ?? '#151821'), bx_font($font)->width($s[0], $size)];
        }
        return [$out, $dir];
    }
    private function drawLine(array $ln, float $x, float $top, float $w, float $size, float $lineH, array $o): void
    {
        $r = $this->segments($ln, $size, $o['dir'] ?? $this->defaultDir);
        if (!$r) return;
        [$segs, $dir] = $r;
        $total = array_sum(array_column($segs, 3));
        $align = $o['align'] ?? 'start';
        if ($align === 'start') $align = $dir === 'rtl' ? 'right' : 'left';
        if ($align === 'end') $align = $dir === 'rtl' ? 'left' : 'right';
        $cx = $align === 'right' ? $x + $w - $total : ($align === 'center' ? $x + ($w - $total) / 2 : $x);
        $f = bx_font('r');
        // baseline centered in the line box using the font's real ascent/descent
        $asc = $f->ascent / $f->upm; $desc = -$f->descent / $f->upm;
        $base = $top + ($lineH - ($asc + $desc) * $size) / 2 + $asc * $size;
        if (!empty($o['spacing'])) $cx -= 0;
        foreach ($segs as [$s, $font, $color, $sw]) {
            if ($color !== null) $this->op(['text', $cx, $base, $s, $font, $size, $color]);
            $cx += $sw;
        }
    }

    // ================================================================ GD output
    // Renders one page. $px = target width in pixels; $ss = supersampling factor.
    public function toGd(int $pageNo, int $px, int $ss = 2, bool $wm = false)
    {
        $pg = $this->pages[$pageNo];
        $k = $px / $pg['w'] * $ss;
        $W = (int) round($pg['w'] * $k); $H = (int) round($pg['h'] * $k);
        $im = imagecreatetruecolor($W, $H);
        imagealphablending($im, true);
        imagesavealpha($im, true);
        imagefill($im, 0, 0, imagecolorallocate($im, 255, 255, 255));
        $ops = $pg['ops'];
        if ($wm) { foreach ($ops as $o) if ($o[0] === 'wm') { $wmText = $o[1]; } }
        foreach ($ops as $o) $this->gdOp($im, $o, $k);
        if ($wm) $this->gdWatermark($im, $wmText ?? 'BEHIX', $k);
        if ($ss === 1) return $im;
        $out = imagecreatetruecolor((int) round($W / $ss), (int) round($H / $ss));
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagecopyresampled($out, $im, 0, 0, 0, 0, imagesx($out), imagesy($out), $W, $H);
        imagedestroy($im);
        return $out;
    }
    private static function col($im, array $c): int
    {
        return imagecolorallocatealpha($im, max(0, min(255, $c[0])), max(0, min(255, $c[1])), max(0, min(255, $c[2])), (int) round(127 - max(0, min(1, $c[3])) * 127));
    }
    private function gdOp($im, array $o, float $k): void
    {
        switch ($o[0]) {
            case 'rect':
                [, $x, $y, $w, $h, $fill, $r] = $o;
                $this->gdFill($im, 'round', $x * $k, $y * $k, $w * $k, $h * $k, $r * $k, $fill, $k);
                break;
            case 'ellipse':
                [, $cx, $cy, $rx, $ry, $fill] = $o;
                $this->gdFill($im, 'ellipse', ($cx - $rx) * $k, ($cy - $ry) * $k, 2 * $rx * $k, 2 * $ry * $k, 0, $fill, $k);
                break;
            case 'ring':
                [, $shape, $x, $y, $w, $h, $c, $lw, $r] = $o;
                $this->gdRing($im, $shape, $x * $k, $y * $k, $w * $k, $h * $k, $lw * $k, $r * $k, $c);
                break;
            case 'poly':
                $pts = [];
                foreach ($o[1] as [$px, $py]) { $pts[] = (int) round($px * $k); $pts[] = (int) round($py * $k); }
                if (count($pts) >= 6) imagefilledpolygon($im, $pts, self::col($im, $o[2]));
                break;
            case 'text':
                [, $x, $y, $s, $font, $size, $c] = $o;
                imagettftext($im, $size * $k * 0.75, 0, (int) round($x * $k), (int) round($y * $k), self::col($im, $c), bx_font_path($font), $s);
                break;
            case 'image':
                $this->gdImage($im, $o, $k);
                break;
            case 'qr':
                [, $x, $y, $size, $grid, $c] = $o;
                $n = count($grid); $m = $size / $n * $k; $col = self::col($im, $c);
                foreach ($grid as $j => $rowv) foreach ($rowv as $i => $on) if ($on) imagefilledrectangle($im, (int) round($x * $k + $i * $m), (int) round($y * $k + $j * $m), (int) round($x * $k + ($i + 1) * $m) - 1, (int) round($y * $k + ($j + 1) * $m) - 1, $col);
                break;
        }
    }
    // Horizontal extent of a shape on row $yc (pixel center)
    private static function span(string $shape, float $x, float $y, float $w, float $h, float $r, float $yc): ?array
    {
        if ($yc < $y || $yc >= $y + $h) return null;
        if ($shape === 'ellipse') {
            $ry = $h / 2; $rx = $w / 2; $d = ($yc - $y - $ry) / $ry;
            if (abs($d) >= 1) return null;
            $hw = $rx * sqrt(1 - $d * $d);
            return [$x + $rx - $hw, $x + $rx + $hw];
        }
        $in = 0;
        if ($r > 0) {
            $dy = $yc < $y + $r ? $y + $r - $yc : ($yc > $y + $h - $r ? $yc - ($y + $h - $r) : 0);
            if ($dy > 0) $in = $r - sqrt(max(0, $r * $r - $dy * $dy));
        }
        return [$x + $in, $x + $w - $in];
    }
    private function gdFill($im, string $shape, float $x, float $y, float $w, float $h, float $r, array $fill, float $k): void
    {
        $grad = ($fill[0] ?? null) === 'g';
        if (!$grad && $shape === 'round' && $r < 0.5) {
            imagefilledrectangle($im, (int) round($x), (int) round($y), (int) round($x + $w) - 1, (int) round($y + $h) - 1, self::col($im, $fill));
            return;
        }
        $col = $grad ? null : self::col($im, $fill);
        if ($grad) {
            [, $gx1, $gy1, $gx2, $gy2, $c1, $c2] = $fill;
            $gx1 *= $k; $gy1 *= $k; $gx2 *= $k; $gy2 *= $k;
            $dx = $gx2 - $gx1; $dy = $gy2 - $gy1; $L = $dx * $dx + $dy * $dy ?: 1;
            $steps = 96; $pal = [];
            for ($i = 0; $i <= $steps; $i++) $pal[$i] = self::col($im, bx_mix($c1, $c2, $i / $steps));
        }
        $y0 = (int) floor($y); $y1 = (int) ceil($y + $h);
        for ($py = $y0; $py < $y1; $py++) {
            $sp = self::span($shape, $x, $y, $w, $h, $r, $py + 0.5);
            if (!$sp) continue;
            $a = (int) round($sp[0]); $b = (int) round($sp[1]) - 1;
            if ($b < $a) continue;
            if (!$grad) { imageline($im, $a, $py, $b, $py, $col); continue; }
            // t(x) along the row is linear: split into color bands
            $t0 = (($a - $gx1) * $dx + ($py - $gy1) * $dy) / $L;
            $tb = (($b - $gx1) * $dx + ($py - $gy1) * $dy) / $L;
            $n = max(1, (int) ceil(abs($tb - $t0) * $steps));
            $seg = ($b - $a + 1) / $n;
            for ($s = 0; $s < $n; $s++) {
                $xa = (int) round($a + $s * $seg); $xb = (int) round($a + ($s + 1) * $seg) - 1;
                if ($xb < $xa) continue;
                $t = $t0 + ($tb - $t0) * (($s + 0.5) / $n);
                imageline($im, $xa, $py, $xb, $py, $pal[(int) round(max(0, min(1, $t)) * $steps)]);
            }
        }
    }
    private function gdRing($im, string $shape, float $x, float $y, float $w, float $h, float $lw, float $r, array $c): void
    {
        $col = self::col($im, $c);
        $s = $shape === 'ellipse' ? 'ellipse' : 'round';
        $ir = max(0, $r - $lw);
        for ($py = (int) floor($y); $py < (int) ceil($y + $h); $py++) {
            $o = self::span($s, $x, $y, $w, $h, $r, $py + 0.5);
            if (!$o) continue;
            $i = self::span($s, $x + $lw, $y + $lw, $w - 2 * $lw, $h - 2 * $lw, $ir, $py + 0.5);
            if (!$i) { imageline($im, (int) round($o[0]), $py, (int) round($o[1]) - 1, $py, $col); continue; }
            imageline($im, (int) round($o[0]), $py, (int) round($i[0]) - 1, $py, $col);
            imageline($im, (int) round($i[1]), $py, (int) round($o[1]) - 1, $py, $col);
        }
    }
    // Source rectangle of $src that covers (or fits) a w×h box
    private static function crop($src, float $w, float $h, string $fit): array
    {
        $sw = imagesx($src); $sh = imagesy($src);
        if ($fit === 'contain') return [0, 0, $sw, $sh];
        $ra = $w / $h; $rs = $sw / $sh;
        if ($rs > $ra) { $cw = $sh * $ra; return [($sw - $cw) / 2, 0, $cw, $sh]; }
        $ch = $sw / $ra; return [0, ($sh - $ch) / 2, $sw, $ch];
    }
    private function gdImage($im, array $o, float $k): void
    {
        [, $src, $x, $y, $w, $h, $clip, $r, $fit] = $o;
        $W = max(1, (int) round($w * $k)); $H = max(1, (int) round($h * $k));
        [$sx, $sy, $sw, $sh] = self::crop($src, $w, $h, $fit);
        $dx = 0; $dy = 0; $dw = $W; $dh = $H;
        if ($fit === 'contain') {
            $s = min($W / $sw, $H / $sh); $dw = max(1, (int) round($sw * $s)); $dh = max(1, (int) round($sh * $s));
            $dx = (int) (($W - $dw) / 2); $dy = (int) (($H - $dh) / 2);
        }
        $t = imagecreatetruecolor($W, $H);
        imagealphablending($t, false);
        imagesavealpha($t, true);
        imagefill($t, 0, 0, imagecolorallocatealpha($t, 0, 0, 0, 127));
        imagecopyresampled($t, $src, $dx, $dy, (int) $sx, (int) $sy, $dw, $dh, (int) $sw, (int) $sh);
        if ($clip === 'circle' || ($clip === 'round' && $r > 0)) {
            $rr = $r * $k;
            for ($py = 0; $py < $H; $py++) {
                $sp = self::span($clip === 'circle' ? 'ellipse' : 'round', 0, 0, $W, $H, $rr, $py + 0.5);
                $a = $sp ? $sp[0] : $W; $b = $sp ? $sp[1] : $W;
                for ($px = 0; $px < $W; $px++) {
                    if ($px + 0.5 >= $a && $px + 0.5 < $b) continue;
                    imagesetpixel($t, $px, $py, imagecolorallocatealpha($t, 0, 0, 0, 127));
                }
            }
        }
        imagealphablending($t, true);
        imagecopy($im, $t, (int) round($x * $k), (int) round($y * $k), 0, 0, $W, $H);
        imagedestroy($t);
    }
    // Tiled diagonal watermark baked into the pixels + a footer ribbon
    private function gdWatermark($im, string $text, float $k): void
    {
        $W = imagesx($im); $H = imagesy($im);
        $font = bx_font_path('k');
        $vis = bx_visual($text);
        $size = max(10, min($W, $H) / 14);
        $c1 = imagecolorallocatealpha($im, 255, 122, 26, 78);
        $c2 = imagecolorallocatealpha($im, 30, 30, 40, 96);
        $stepX = $size * 9; $stepY = $size * 4.2;
        $row = 0;
        for ($y = -$H * 0.2; $y < $H * 1.3; $y += $stepY, $row++) {
            for ($x = -$W * 0.5 + ($row % 2) * $stepX / 2; $x < $W * 1.2; $x += $stepX) {
                imagettftext($im, $size * 0.75, 24, (int) $x, (int) $y, $row % 2 ? $c2 : $c1, $font, $vis);
            }
        }
        // fine crossing lines make clean-up by retouching impractical
        $lc = imagecolorallocatealpha($im, 255, 122, 26, 112);
        imagesetthickness($im, max(1, (int) round($size / 18)));
        for ($i = -$H; $i < $W; $i += (int) max(12, $size * 1.6)) imageline($im, $i, $H, $i + $H, 0, $lc);
        imagesetthickness($im, 1);
        $bh = (int) max(18, $size * 1.3);
        imagefilledrectangle($im, 0, $H - $bh, $W, $H, imagecolorallocatealpha($im, 20, 20, 28, 40));
        $lab = bx_visual('پیش‌نمایش — فایل نهایی بدون این علامت و با کیفیت کامل');
        $ts = $bh * 0.42;
        $bb = imagettfbbox($ts * 0.75, 0, bx_font_path('b'), $lab);
        imagettftext($im, $ts * 0.75, 0, (int) (($W - ($bb[2] - $bb[0])) / 2), (int) ($H - $bh * 0.32), imagecolorallocate($im, 255, 255, 255), bx_font_path('b'), $lab);
    }
    public function png(int $page, int $px, int $ss = 2): string
    {
        $im = $this->toGd($page, $px, $ss, false);
        ob_start(); imagepng($im, null, 6); imagedestroy($im);
        return (string) ob_get_clean();
    }
    // Low-resolution watermarked JPEG for previews
    public function preview(int $page, int $px, int $ss = 2, int $q = 72): string
    {
        $im = $this->toGd($page, $px, $ss, true);
        ob_start(); imagejpeg($im, null, $q); imagedestroy($im);
        return (string) ob_get_clean();
    }

    // ================================================================ PDF output
    public function pdf(): string
    {
        require_once __DIR__ . '/pdf.php';
        return (new BxPdfWriter())->write($this);
    }
}
