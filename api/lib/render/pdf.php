<?php
// BEHIX — vector PDF writer for BxCanvas pages: embedded TrueType fonts
// (Identity-H with ToUnicode), filled/gradient shapes, alpha, images and QR.
if (!defined('BX')) { http_response_code(403); exit; }

final class BxPdfWriter
{
    private array $objs = [];
    private array $fonts = [];   // key => ['id' => objId, 'used' => [gid => cp]]
    private array $alphas = [];  // 'a50' => objId
    private array $shadings = [];
    private array $images = [];
    private array $pageRes = [];

    private function obj(string $body): int { $this->objs[] = $body; return count($this->objs); }
    private function reserve(): int { $this->objs[] = null; return count($this->objs); }
    private function set(int $id, string $body): void { $this->objs[$id - 1] = $body; }
    private static function n(float $v): string { $s = rtrim(rtrim(sprintf('%.3F', $v), '0'), '.'); return $s === '-0' ? '0' : $s; }
    private static function stream(string $dict, string $data): string
    {
        $z = gzcompress($data, 6);
        return "<<{$dict} /Filter /FlateDecode /Length " . strlen($z) . ">>\nstream\n{$z}\nendstream";
    }

    public function write(BxCanvas $c): string
    {
        $pagesId = $this->reserve();
        $kids = [];
        foreach ($c->pages as $pg) {
            $this->pageRes = ['F' => [], 'G' => [], 'S' => [], 'I' => []];
            $content = $this->content($pg, $c->pdfScale);
            $res = '';
            if ($this->pageRes['F']) $res .= '/Font <<' . implode('', array_map(fn ($k) => "/F{$k} {$this->fonts[$k]['id']} 0 R", array_keys($this->pageRes['F']))) . '>>';
            if ($this->pageRes['G']) $res .= '/ExtGState <<' . implode('', array_map(fn ($k) => "/{$k} {$this->alphas[$k]} 0 R", array_keys($this->pageRes['G']))) . '>>';
            if ($this->pageRes['S']) $res .= '/Shading <<' . implode('', array_map(fn ($k) => "/{$k} {$this->shadings[$k]} 0 R", array_keys($this->pageRes['S']))) . '>>';
            if ($this->pageRes['I']) $res .= '/XObject <<' . implode('', array_map(fn ($k) => "/{$k} {$this->images[$k]} 0 R", array_keys($this->pageRes['I']))) . '>>';
            $cid = $this->obj(self::stream('', $content));
            $kids[] = $this->obj("<</Type /Page /Parent {$pagesId} 0 R /MediaBox [0 0 " . self::n($pg['w'] * $c->pdfScale) . ' ' . self::n($pg['h'] * $c->pdfScale) . "] /Resources <<{$res}>> /Contents {$cid} 0 R>>");
        }
        $this->set($pagesId, '<</Type /Pages /Kids [' . implode(' ', array_map(fn ($k) => "$k 0 R", $kids)) . '] /Count ' . count($kids) . '>>');
        foreach ($this->fonts as $key => $f) $this->writeFont($key, $f);
        $info = $this->obj('<</Producer (BEHIX Studio) /Title ' . self::utf16($c->title ?: 'BEHIX') . ' /CreationDate (D:' . gmdate('YmdHis') . "Z)>>");
        $cat = $this->obj("<</Type /Catalog /Pages {$pagesId} 0 R /ViewerPreferences <</Direction /R2L>>>>");
        $out = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n";
        $off = [];
        foreach ($this->objs as $i => $b) { $off[$i + 1] = strlen($out); $out .= ($i + 1) . " 0 obj\n{$b}\nendobj\n"; }
        $x = strlen($out);
        $out .= "xref\n0 " . (count($this->objs) + 1) . "\n0000000000 65535 f \n";
        foreach ($off as $o) $out .= sprintf("%010d 00000 n \n", $o);
        $out .= 'trailer <</Size ' . (count($this->objs) + 1) . " /Root {$cat} 0 R /Info {$info} 0 R>>\nstartxref\n{$x}\n%%EOF";
        return $out;
    }
    private static function utf16(string $s): string { return '<FEFF' . strtoupper(bin2hex(mb_convert_encoding($s, 'UTF-16BE', 'UTF-8'))) . '>'; }

    private function color(array $c, bool $fill = true): string
    {
        return self::n($c[0] / 255) . ' ' . self::n($c[1] / 255) . ' ' . self::n($c[2] / 255) . ($fill ? ' rg' : ' RG');
    }
    private function alpha(float $a): string
    {
        if ($a >= 0.999) return '';
        $k = 'a' . (int) round($a * 100);
        if (!isset($this->alphas[$k])) $this->alphas[$k] = $this->obj('<</Type /ExtGState /ca ' . self::n($a) . ' /CA ' . self::n($a) . '>>');
        $this->pageRes['G'][$k] = 1;
        return "/{$k} gs ";
    }
    private function pathRound(float $x, float $y, float $w, float $h, float $r): string
    {
        if ($r <= 0) return self::n($x) . ' ' . self::n($y) . ' ' . self::n($w) . ' ' . self::n($h) . " re\n";
        $k = 0.5523 * $r; $n = fn ($v) => self::n($v);
        return "{$n($x + $r)} {$n($y)} m {$n($x + $w - $r)} {$n($y)} l {$n($x + $w - $r + $k)} {$n($y)} {$n($x + $w)} {$n($y + $r - $k)} {$n($x + $w)} {$n($y + $r)} c "
            . "{$n($x + $w)} {$n($y + $h - $r)} l {$n($x + $w)} {$n($y + $h - $r + $k)} {$n($x + $w - $r + $k)} {$n($y + $h)} {$n($x + $w - $r)} {$n($y + $h)} c "
            . "{$n($x + $r)} {$n($y + $h)} l {$n($x + $r - $k)} {$n($y + $h)} {$n($x)} {$n($y + $h - $r + $k)} {$n($x)} {$n($y + $h - $r)} c "
            . "{$n($x)} {$n($y + $r)} l {$n($x)} {$n($y + $r - $k)} {$n($x + $r - $k)} {$n($y)} {$n($x + $r)} {$n($y)} c h\n";
    }
    private function pathEllipse(float $cx, float $cy, float $rx, float $ry): string
    {
        $kx = 0.5523 * $rx; $ky = 0.5523 * $ry; $n = fn ($v) => self::n($v);
        return "{$n($cx + $rx)} {$n($cy)} m {$n($cx + $rx)} {$n($cy + $ky)} {$n($cx + $kx)} {$n($cy + $ry)} {$n($cx)} {$n($cy + $ry)} c "
            . "{$n($cx - $kx)} {$n($cy + $ry)} {$n($cx - $rx)} {$n($cy + $ky)} {$n($cx - $rx)} {$n($cy)} c "
            . "{$n($cx - $rx)} {$n($cy - $ky)} {$n($cx - $kx)} {$n($cy - $ry)} {$n($cx)} {$n($cy - $ry)} c "
            . "{$n($cx + $kx)} {$n($cy - $ry)} {$n($cx + $rx)} {$n($cy - $ky)} {$n($cx + $rx)} {$n($cy)} c h\n";
    }
    // Fill a path with a solid color or an axial gradient
    private function fill(string $path, array $fill): string
    {
        if (($fill[0] ?? null) === 'g') {
            [, $x1, $y1, $x2, $y2, $c1, $c2] = $fill;
            $key = 'Sh' . count($this->shadings);
            $f = '<</FunctionType 2 /Domain [0 1] /C0 [' . self::n($c1[0] / 255) . ' ' . self::n($c1[1] / 255) . ' ' . self::n($c1[2] / 255) . '] /C1 [' . self::n($c2[0] / 255) . ' ' . self::n($c2[1] / 255) . ' ' . self::n($c2[2] / 255) . '] /N 1>>';
            $this->shadings[$key] = $this->obj('<</ShadingType 2 /ColorSpace /DeviceRGB /Coords [' . self::n($x1) . ' ' . self::n($y1) . ' ' . self::n($x2) . ' ' . self::n($y2) . "] /Function {$f} /Extend [true true]>>");
            $this->pageRes['S'][$key] = 1;
            $a = min($c1[3], $c2[3]);
            return 'q ' . $this->alpha($a) . $path . "W n /{$key} sh Q\n";
        }
        return 'q ' . $this->alpha($fill[3]) . $this->color($fill) . ' ' . $path . "f Q\n";
    }
    private function content(array $pg, float $k = 1.0): string
    {
        $H = $pg['h'] * $k;
        $s = self::n($k) . ' 0 0 ' . self::n(-$k) . ' 0 ' . self::n($H) . " cm\n";
        foreach ($pg['ops'] as $o) {
            switch ($o[0]) {
                case 'rect': $s .= $this->fill($this->pathRound($o[1], $o[2], $o[3], $o[4], $o[6]), $o[5]); break;
                case 'ellipse': $s .= $this->fill($this->pathEllipse($o[1], $o[2], $o[3], $o[4]), $o[5]); break;
                case 'ring':
                    [, $shape, $x, $y, $w, $h, $c, $lw, $r] = $o;
                    $p = $shape === 'ellipse' ? $this->pathEllipse($x + $w / 2, $y + $h / 2, $w / 2 - $lw / 2, $h / 2 - $lw / 2) : $this->pathRound($x + $lw / 2, $y + $lw / 2, $w - $lw, $h - $lw, max(0, $r - $lw / 2));
                    $s .= 'q ' . $this->alpha($c[3]) . $this->color($c, false) . ' ' . self::n($lw) . " w {$p}S Q\n";
                    break;
                case 'poly':
                    $p = '';
                    foreach ($o[1] as $i => [$x, $y]) $p .= self::n($x) . ' ' . self::n($y) . ($i ? ' l ' : ' m ');
                    $s .= $this->fill($p . "h\n", $o[2]);
                    break;
                case 'text': $s .= $this->text($o); break;
                case 'image': $s .= $this->image($o); break;
                case 'qr':
                    [, $x, $y, $size, $grid, $c] = $o;
                    $n = count($grid); $m = $size / $n; $p = '';
                    foreach ($grid as $j => $row) foreach ($row as $i => $on) if ($on) $p .= self::n($x + $i * $m) . ' ' . self::n($y + $j * $m) . ' ' . self::n($m + 0.02) . ' ' . self::n($m + 0.02) . " re\n";
                    $s .= 'q ' . $this->color($c) . "\n{$p}f Q\n";
                    break;
            }
        }
        return $s;
    }
    private function text(array $o): string
    {
        [, $x, $y, $str, $fk, $size, $c] = $o;
        $f = bx_font($fk);
        if (!isset($this->fonts[$fk])) $this->fonts[$fk] = ['id' => $this->reserve(), 'used' => []];
        $this->pageRes['F'][$fk] = 1;
        $hex = '';
        foreach (bx_cps($str) as $cp) {
            $g = $f->cmap[$cp] ?? 0;
            if (!$g) continue;
            $this->fonts[$fk]['used'][$g] ??= $cp;
            $hex .= sprintf('%04X', $g);
        }
        if ($hex === '') return '';
        return 'q ' . $this->alpha($c[3]) . $this->color($c) . " BT /F{$fk} " . self::n($size) . ' Tf 1 0 0 -1 ' . self::n($x) . ' ' . self::n($y) . " Tm <{$hex}> Tj ET Q\n";
    }
    private function image(array $o): string
    {
        [, $im, $x, $y, $w, $h, $clip, $r, $fit] = $o;
        $key = 'Im' . spl_object_id($im);
        if (!isset($this->images[$key])) $this->images[$key] = $this->imageObj($im);
        $this->pageRes['I'][$key] = 1;
        $sw = imagesx($im); $sh = imagesy($im);
        // place the whole image so the visible window matches cover/contain
        if ($fit === 'contain') { $s = min($w / $sw, $h / $sh); $dw = $sw * $s; $dh = $sh * $s; }
        else { $s = max($w / $sw, $h / $sh); $dw = $sw * $s; $dh = $sh * $s; }
        $dx = $x + ($w - $dw) / 2; $dy = $y + ($h - $dh) / 2;
        $clipPath = $clip === 'circle' ? $this->pathEllipse($x + $w / 2, $y + $h / 2, $w / 2, $h / 2) : $this->pathRound($x, $y, $w, $h, $clip === 'round' ? $r : 0);
        return "q {$clipPath}W n " . self::n($dw) . ' 0 0 ' . self::n(-$dh) . ' ' . self::n($dx) . ' ' . self::n($dy + $dh) . " cm /{$key} Do Q\n";
    }
    private function imageObj($im): int
    {
        $w = imagesx($im); $h = imagesy($im);
        // flatten onto white for the color data; keep alpha as a soft mask
        $bg = imagecreatetruecolor($w, $h);
        imagefill($bg, 0, 0, imagecolorallocate($bg, 255, 255, 255));
        imagealphablending($bg, true);
        imagecopy($bg, $im, 0, 0, 0, 0, $w, $h);
        ob_start(); imagejpeg($bg, null, 90); $jpg = (string) ob_get_clean();
        imagedestroy($bg);
        $mask = '';
        $hasAlpha = false;
        $alpha = '';
        for ($y = 0; $y < $h; $y++) for ($x = 0; $x < $w; $x++) {
            $a = (imagecolorat($im, $x, $y) >> 24) & 0x7F;
            if ($a) $hasAlpha = true;
            $alpha .= chr(255 - (int) round($a * 255 / 127));
        }
        if ($hasAlpha) {
            $sid = $this->obj(self::stream("/Type /XObject /Subtype /Image /Width {$w} /Height {$h} /ColorSpace /DeviceGray /BitsPerComponent 8", $alpha));
            $mask = " /SMask {$sid} 0 R";
        }
        return $this->obj("<</Type /XObject /Subtype /Image /Width {$w} /Height {$h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode{$mask} /Length " . strlen($jpg) . ">>\nstream\n{$jpg}\nendstream");
    }
    private function writeFont(string $key, array $f): void
    {
        $font = bx_font($key);
        $k = 1000 / $font->upm;
        $file = $this->obj(self::stream('/Length1 ' . strlen($font->data), $font->data));
        $bb = array_map(fn ($v) => (int) round($v * $k), $font->bbox);
        $name = 'BXAAAA+' . preg_replace('/[^A-Za-z-]/', '', pathinfo($font->file, PATHINFO_FILENAME));
        $desc = $this->obj("<</Type /FontDescriptor /FontName /{$name} /Flags 32 /FontBBox [" . implode(' ', $bb) . '] /ItalicAngle 0 /Ascent ' . (int) round($font->ascent * $k) . ' /Descent ' . (int) round($font->descent * $k) . ' /CapHeight ' . (int) round($font->capHeight * $k) . " /StemV 80 /FontFile2 {$file} 0 R>>");
        ksort($f['used']);
        $w = '';
        foreach ($f['used'] as $g => $cp) $w .= "{$g} [" . (int) round(($font->adv[$g] ?? 0) * $k) . '] ';
        $cid = $this->obj("<</Type /Font /Subtype /CIDFontType2 /BaseFont /{$name} /CIDSystemInfo <</Registry (Adobe) /Ordering (Identity) /Supplement 0>> /FontDescriptor {$desc} 0 R /DW 500 /W [{$w}] /CIDToGIDMap /Identity>>");
        $tu = $this->obj(self::stream('', $this->toUnicode($f['used'])));
        $this->set($f['id'], "<</Type /Font /Subtype /Type0 /BaseFont /{$name} /Encoding /Identity-H /DescendantFonts [{$cid} 0 R] /ToUnicode {$tu} 0 R>>");
    }
    // Glyph → base letters, so copied text is real Persian, not presentation forms
    private function toUnicode(array $used): string
    {
        static $rev = null;
        if ($rev === null) {
            $rev = [];
            foreach (BX_FORMS as $base => $forms) foreach ($forms as $fcp) if ($fcp) $rev[$fcp] = [$base];
            foreach (BX_LAMALEF as $alef => [$iso, $fin]) { $rev[$iso] = [0x644, $alef]; $rev[$fin] = [0x644, $alef]; }
        }
        $m = '';
        $n = 0;
        $chunks = [];
        foreach ($used as $g => $cp) {
            $u = $rev[$cp] ?? [$cp];
            $hex = '';
            foreach ($u as $c) $hex .= strtoupper(bin2hex(mb_convert_encoding(mb_chr($c), 'UTF-16BE', 'UTF-8')));
            $chunks[] = sprintf('<%04X> <%s>', $g, $hex);
        }
        foreach (array_chunk($chunks, 100) as $ch) $m .= count($ch) . " beginbfchar\n" . implode("\n", $ch) . "\nendbfchar\n";
        return "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo <</Registry (Adobe) /Ordering (UCS) /Supplement 0>> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n{$m}endcmap\nCMapName currentdict /CMapResource defineresource pop\nend\nend";
    }
}
