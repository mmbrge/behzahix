<?php
// BEHIX — minimal TrueType reader: glyph ids (cmap), advance widths (hmtx) and
// the metrics a PDF font descriptor needs. Used by the shaper, layout and PDF writer.
if (!defined('BX')) { http_response_code(403); exit; }

final class BxFont
{
    public string $file;
    public string $data;
    public int $upm = 1000;
    public int $ascent = 0;
    public int $descent = 0;
    public int $capHeight = 0;
    public array $bbox = [0, 0, 0, 0];
    public array $cmap = [];   // codepoint => glyph id
    public array $adv = [];    // glyph id => advance (font units)
    private static array $cache = [];

    public static function get(string $file): self
    {
        return self::$cache[$file] ??= new self($file);
    }
    private function __construct(string $file)
    {
        $this->file = $file;
        $this->data = (string) file_get_contents($file);
        $d = $this->data;
        $n = $this->u16(4);
        $t = [];
        for ($i = 0; $i < $n; $i++) {
            $o = 12 + $i * 16;
            $t[substr($d, $o, 4)] = $this->u32($o + 8);
        }
        $h = $t['head'];
        $this->upm = $this->u16($h + 18);
        $this->bbox = [$this->s16($h + 36), $this->s16($h + 38), $this->s16($h + 40), $this->s16($h + 42)];
        $hh = $t['hhea'];
        $this->ascent = $this->s16($hh + 4);
        $this->descent = $this->s16($hh + 6);
        $nh = $this->u16($hh + 34);
        $ng = $this->u16($t['maxp'] + 4);
        $this->capHeight = isset($t['OS/2']) && $this->u16($t['OS/2']) >= 2 ? $this->s16($t['OS/2'] + 88) : (int) ($this->ascent * 0.7);
        $last = 0;
        for ($g = 0; $g < $ng; $g++) {
            if ($g < $nh) $last = $this->u16($t['hmtx'] + $g * 4);
            $this->adv[$g] = $last;
        }
        $this->readCmap($t['cmap']);
    }
    private function readCmap(int $c): void
    {
        $n = $this->u16($c + 2);
        $best = null; $fmt = 0;
        for ($i = 0; $i < $n; $i++) {
            $pid = $this->u16($c + 4 + $i * 8); $eid = $this->u16($c + 6 + $i * 8);
            $off = $c + $this->u32($c + 8 + $i * 8);
            $f = $this->u16($off);
            if ($pid === 3 && $eid === 10 && $f === 12) { $best = $off; $fmt = 12; break; }
            if ($pid === 3 && $eid === 1 && $f === 4) { $best = $off; $fmt = 4; }
        }
        if ($best === null) return;
        if ($fmt === 12) {
            $groups = $this->u32($best + 12);
            for ($i = 0; $i < $groups; $i++) {
                $o = $best + 16 + $i * 12;
                $s = $this->u32($o); $e = $this->u32($o + 4); $g = $this->u32($o + 8);
                for ($cp = $s; $cp <= $e; $cp++) $this->cmap[$cp] = $g + $cp - $s;
            }
            return;
        }
        $seg = $this->u16($best + 6) >> 1;
        $ends = $best + 14; $starts = $ends + $seg * 2 + 2; $deltas = $starts + $seg * 2; $ranges = $deltas + $seg * 2;
        for ($i = 0; $i < $seg; $i++) {
            $e = $this->u16($ends + $i * 2); $s = $this->u16($starts + $i * 2);
            $dl = $this->u16($deltas + $i * 2); $ro = $this->u16($ranges + $i * 2);
            for ($cp = $s; $cp <= $e && $cp !== 0xFFFF; $cp++) {
                if ($ro === 0) $g = ($cp + $dl) & 0xFFFF;
                else {
                    $g = $this->u16($ranges + $i * 2 + $ro + ($cp - $s) * 2);
                    if ($g) $g = ($g + $dl) & 0xFFFF;
                }
                if ($g) $this->cmap[$cp] = $g;
            }
        }
    }
    public function has(int $cp): bool { return isset($this->cmap[$cp]); }
    public function glyph(int $cp): int { return $this->cmap[$cp] ?? 0; }
    // Advance width of a (shaped, visual) string in points at $size
    public function width(string $s, float $size): float
    {
        $w = 0;
        foreach (mb_str_split($s) as $ch) $w += $this->adv[$this->cmap[mb_ord($ch)] ?? 0] ?? 0;
        return $w * $size / $this->upm;
    }
    private function u16(int $o): int { return unpack('n', $this->data, $o)[1]; }
    private function s16(int $o): int { $v = $this->u16($o); return $v >= 0x8000 ? $v - 0x10000 : $v; }
    private function u32(int $o): int { return unpack('N', $this->data, $o)[1]; }
}
