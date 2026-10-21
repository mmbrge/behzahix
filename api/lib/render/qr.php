<?php
// BEHIX — small QR code encoder (byte mode, error correction level M,
// versions 1–40). Replaces the bacon/bacon-qr-code package, which needs
// PHP 8.1 and Composer's platform check; this works on PHP 7.4+.
// Follows the structure of Project Nayuki's reference QR generator (MIT).
if (!defined('BX')) { http_response_code(403); exit; }

// Level M: error-correction codewords per block, and number of blocks, per version
const QR_ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function qr_raw_modules(int $ver): int
{
    $r = (16 * $ver + 128) * $ver + 64;
    if ($ver >= 2) {
        $n = intdiv($ver, 7) + 2;
        $r -= (25 * $n - 10) * $n - 55;
        if ($ver >= 7) $r -= 36;
    }
    return $r;
}
function qr_data_codewords(int $ver): int
{
    return intdiv(qr_raw_modules($ver), 8) - QR_ECC_M[$ver] * QR_BLOCKS_M[$ver];
}
function qr_gf_mul(int $x, int $y): int
{
    $z = 0;
    for ($i = 7; $i >= 0; $i--) {
        $z = (($z << 1) ^ (($z >> 7) * 0x11D)) & 0xFF;
        $z ^= (($y >> $i) & 1) * $x;
    }
    return $z;
}
function qr_rs_divisor(int $degree): array
{
    $res = array_fill(0, $degree, 0);
    $res[$degree - 1] = 1;
    $root = 1;
    for ($i = 0; $i < $degree; $i++) {
        for ($j = 0; $j < $degree; $j++) {
            $res[$j] = qr_gf_mul($res[$j], $root);
            if ($j + 1 < $degree) $res[$j] ^= $res[$j + 1];
        }
        $root = qr_gf_mul($root, 0x02);
    }
    return $res;
}
function qr_rs_remainder(array $data, array $div): array
{
    $res = array_fill(0, count($div), 0);
    foreach ($data as $b) {
        $f = $b ^ array_shift($res);
        $res[] = 0;
        foreach ($div as $i => $d) $res[$i] ^= qr_gf_mul($d, $f);
    }
    return $res;
}
function qr_align_positions(int $ver, int $size): array
{
    if ($ver === 1) return [];
    $n = intdiv($ver, 7) + 2;
    $step = $ver === 32 ? 26 : (int) ceil(($ver * 4 + 4) / ($n * 2 - 2)) * 2;
    $res = [6];
    for ($pos = $size - 7; count($res) < $n; $pos -= $step) array_splice($res, 1, 0, [$pos]);
    return $res;
}

/** Matrix of booleans [row][col]; true = dark module. */
function qr_matrix(string $text): array
{
    $bytes = array_values(unpack('C*', $text) ?: []);
    $len = count($bytes);
    // smallest version that fits (byte mode: 8-bit count up to v9, 16-bit after)
    for ($ver = 1; ; $ver++) {
        if ($ver > 40) throw new RuntimeException('QR: text too long');
        $bits = 4 + ($ver < 10 ? 8 : 16) + 8 * $len;
        if ($bits <= qr_data_codewords($ver) * 8) break;
    }
    $cap = qr_data_codewords($ver) * 8;
    // bit stream: mode 0100, count, data, terminator, padding
    $bb = [];
    $put = function (int $val, int $n) use (&$bb) { for ($i = $n - 1; $i >= 0; $i--) $bb[] = ($val >> $i) & 1; };
    $put(4, 4);
    $put($len, $ver < 10 ? 8 : 16);
    foreach ($bytes as $b) $put($b, 8);
    $put(0, min(4, $cap - count($bb)));
    $put(0, (8 - count($bb) % 8) % 8);
    for ($pad = 0xEC; count($bb) < $cap; $pad ^= 0xEC ^ 0x11) $put($pad, 8);
    $data = [];
    foreach (array_chunk($bb, 8) as $ch) { $v = 0; foreach ($ch as $bit) $v = ($v << 1) | $bit; $data[] = $v; }

    // error correction per block, then interleave
    $nb = QR_BLOCKS_M[$ver]; $eccLen = QR_ECC_M[$ver];
    $raw = intdiv(qr_raw_modules($ver), 8);
    $short = $nb - $raw % $nb;
    $shortLen = intdiv($raw, $nb);
    $div = qr_rs_divisor($eccLen);
    $blocks = [];
    for ($i = 0, $k = 0; $i < $nb; $i++) {
        $n = $shortLen - $eccLen + ($i < $short ? 0 : 1);
        $dat = array_slice($data, $k, $n);
        $k += $n;
        $ecc = qr_rs_remainder($dat, $div);
        if ($i < $short) $dat[] = 0;
        $blocks[] = array_merge($dat, $ecc);
    }
    $words = [];
    for ($i = 0, $bl = count($blocks[0]); $i < $bl; $i++) {
        foreach ($blocks as $j => $b) if ($i !== $shortLen - $eccLen || $j >= $short) $words[] = $b[$i];
    }

    // function patterns
    $size = $ver * 4 + 17;
    $m = array_fill(0, $size, array_fill(0, $size, false));
    $fn = $m;
    $set = function (int $x, int $y, bool $dark) use (&$m, &$fn) { $m[$y][$x] = $dark; $fn[$y][$x] = true; };
    for ($i = 0; $i < $size; $i++) { $set(6, $i, $i % 2 === 0); $set($i, 6, $i % 2 === 0); }
    foreach ([[3, 3], [$size - 4, 3], [3, $size - 4]] as [$cx, $cy]) {
        for ($dy = -4; $dy <= 4; $dy++) for ($dx = -4; $dx <= 4; $dx++) {
            $d = max(abs($dx), abs($dy)); $x = $cx + $dx; $y = $cy + $dy;
            if ($x >= 0 && $x < $size && $y >= 0 && $y < $size) $set($x, $y, $d !== 2 && $d !== 4);
        }
    }
    $al = qr_align_positions($ver, $size);
    $na = count($al);
    for ($i = 0; $i < $na; $i++) for ($j = 0; $j < $na; $j++) {
        if (($i === 0 && $j === 0) || ($i === 0 && $j === $na - 1) || ($i === $na - 1 && $j === 0)) continue;
        for ($dy = -2; $dy <= 2; $dy++) for ($dx = -2; $dx <= 2; $dx++) $set($al[$i] + $dx, $al[$j] + $dy, max(abs($dx), abs($dy)) !== 1);
    }
    $format = function (int $mask) use ($set, $size) {
        $d = (0 << 3) | $mask; // level M = 00
        $r = $d;
        for ($i = 0; $i < 10; $i++) $r = ($r << 1) ^ (($r >> 9) * 0x537);
        $bits = (($d << 10) | $r) ^ 0x5412;
        $g = function ($i) use ($bits) { return (($bits >> $i) & 1) === 1; };
        for ($i = 0; $i <= 5; $i++) $set(8, $i, $g($i));
        $set(8, 7, $g(6)); $set(8, 8, $g(7)); $set(7, 8, $g(8));
        for ($i = 9; $i < 15; $i++) $set(14 - $i, 8, $g($i));
        for ($i = 0; $i < 8; $i++) $set($size - 1 - $i, 8, $g($i));
        for ($i = 8; $i < 15; $i++) $set(8, $size - 15 + $i, $g($i));
        $set(8, $size - 8, true);
    };
    $format(0);
    if ($ver >= 7) {
        $r = $ver;
        for ($i = 0; $i < 12; $i++) $r = ($r << 1) ^ (($r >> 11) * 0x1F25);
        $bits = ($ver << 12) | $r;
        for ($i = 0; $i < 18; $i++) {
            $bit = (($bits >> $i) & 1) === 1; $a = $size - 11 + $i % 3; $b = intdiv($i, 3);
            $set($a, $b, $bit); $set($b, $a, $bit);
        }
    }

    // data in the zigzag order
    $total = count($words) * 8;
    for ($i = 0, $right = $size - 1; $right >= 1; $right -= 2) {
        if ($right === 6) $right = 5;
        for ($v = 0; $v < $size; $v++) for ($j = 0; $j < 2; $j++) {
            $x = $right - $j;
            $y = (($right + 1) & 2) === 0 ? $size - 1 - $v : $v;
            if (!$fn[$y][$x] && $i < $total) { $m[$y][$x] = (($words[$i >> 3] >> (7 - ($i & 7))) & 1) === 1; $i++; }
        }
    }

    // pick the mask with the lowest penalty
    $masked = function (array $m, int $mask) use ($fn, $size) {
        for ($y = 0; $y < $size; $y++) for ($x = 0; $x < $size; $x++) {
            if ($fn[$y][$x]) continue;
            switch ($mask) {
                case 0: $inv = ($x + $y) % 2 === 0; break;
                case 1: $inv = $y % 2 === 0; break;
                case 2: $inv = $x % 3 === 0; break;
                case 3: $inv = ($x + $y) % 3 === 0; break;
                case 4: $inv = (intdiv($x, 3) + intdiv($y, 2)) % 2 === 0; break;
                case 5: $inv = $x * $y % 2 + $x * $y % 3 === 0; break;
                case 6: $inv = ($x * $y % 2 + $x * $y % 3) % 2 === 0; break;
                default: $inv = (($x + $y) % 2 + $x * $y % 3) % 2 === 0;
            }
            if ($inv) $m[$y][$x] = !$m[$y][$x];
        }
        return $m;
    };
    $best = null; $bestScore = PHP_INT_MAX;
    for ($mask = 0; $mask < 8; $mask++) {
        $m2 = $masked($m, $mask);
        $mm = $m; $m = $m2; $format($mask); $m2 = $m; $m = $mm; // format bits drawn on the candidate
        $s = qr_penalty($m2, $size);
        if ($s < $bestScore) { $bestScore = $s; $best = $mask; }
    }
    $m = $masked($m, $best);
    $format($best);
    return $m;
}
// Standard penalty rules (runs, 2×2 blocks, finder-like patterns, dark balance)
function qr_penalty(array $m, int $size): int
{
    $p = 0; $dark = 0;
    for ($pass = 0; $pass < 2; $pass++) {
        for ($a = 0; $a < $size; $a++) {
            $line = [];
            for ($b = 0; $b < $size; $b++) $line[] = $pass ? $m[$b][$a] : $m[$a][$b];
            $run = 1;
            for ($b = 1; $b <= $size; $b++) {
                if ($b < $size && $line[$b] === $line[$b - 1]) { $run++; continue; }
                if ($run >= 5) $p += $run - 2;
                $run = 1;
            }
            $s = implode('', array_map('intval', $line));
            $p += 40 * (substr_count($s, '00001011101') + substr_count($s, '10111010000'));
        }
    }
    for ($y = 0; $y < $size; $y++) for ($x = 0; $x < $size; $x++) {
        if ($m[$y][$x]) $dark++;
        if ($y + 1 < $size && $x + 1 < $size && $m[$y][$x] === $m[$y][$x + 1] && $m[$y][$x] === $m[$y + 1][$x] && $m[$y][$x] === $m[$y + 1][$x + 1]) $p += 3;
    }
    $p += 10 * intdiv(abs($dark * 20 - $size * $size * 10), $size * $size);
    return $p;
}
