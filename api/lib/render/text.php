<?php
// BEHIX — Persian/Arabic shaping (contextual presentation forms, lam-alef) and a
// compact bidi reorder for mixed Persian/English/number lines. Output strings are
// in visual (left-to-right drawing) order, ready for GD and the PDF writer.
if (!defined('BX')) { http_response_code(403); exit; }

const BX_FORMS = [0x621=>[0xFE80,0x0,0x0,0x0],0x622=>[0xFE81,0xFE82,0x0,0x0],0x623=>[0xFE83,0xFE84,0x0,0x0],0x624=>[0xFE85,0xFE86,0x0,0x0],0x625=>[0xFE87,0xFE88,0x0,0x0],0x626=>[0xFE89,0xFE8A,0xFE8B,0xFE8C],0x627=>[0xFE8D,0xFE8E,0x0,0x0],0x628=>[0xFE8F,0xFE90,0xFE91,0xFE92],0x629=>[0xFE93,0xFE94,0x0,0x0],0x62A=>[0xFE95,0xFE96,0xFE97,0xFE98],0x62B=>[0xFE99,0xFE9A,0xFE9B,0xFE9C],0x62C=>[0xFE9D,0xFE9E,0xFE9F,0xFEA0],0x62D=>[0xFEA1,0xFEA2,0xFEA3,0xFEA4],0x62E=>[0xFEA5,0xFEA6,0xFEA7,0xFEA8],0x62F=>[0xFEA9,0xFEAA,0x0,0x0],0x630=>[0xFEAB,0xFEAC,0x0,0x0],0x631=>[0xFEAD,0xFEAE,0x0,0x0],0x632=>[0xFEAF,0xFEB0,0x0,0x0],0x633=>[0xFEB1,0xFEB2,0xFEB3,0xFEB4],0x634=>[0xFEB5,0xFEB6,0xFEB7,0xFEB8],0x635=>[0xFEB9,0xFEBA,0xFEBB,0xFEBC],0x636=>[0xFEBD,0xFEBE,0xFEBF,0xFEC0],0x637=>[0xFEC1,0xFEC2,0xFEC3,0xFEC4],0x638=>[0xFEC5,0xFEC6,0xFEC7,0xFEC8],0x639=>[0xFEC9,0xFECA,0xFECB,0xFECC],0x63A=>[0xFECD,0xFECE,0xFECF,0xFED0],0x641=>[0xFED1,0xFED2,0xFED3,0xFED4],0x642=>[0xFED5,0xFED6,0xFED7,0xFED8],0x643=>[0xFED9,0xFEDA,0xFEDB,0xFEDC],0x644=>[0xFEDD,0xFEDE,0xFEDF,0xFEE0],0x645=>[0xFEE1,0xFEE2,0xFEE3,0xFEE4],0x646=>[0xFEE5,0xFEE6,0xFEE7,0xFEE8],0x647=>[0xFEE9,0xFEEA,0xFEEB,0xFEEC],0x648=>[0xFEED,0xFEEE,0x0,0x0],0x649=>[0xFEEF,0xFEF0,0xFBE8,0xFBE9],0x64A=>[0xFEF1,0xFEF2,0xFEF3,0xFEF4],0x671=>[0xFB50,0xFB51,0x0,0x0],0x677=>[0xFBDD,0x0,0x0,0x0],0x679=>[0xFB66,0xFB67,0xFB68,0xFB69],0x67A=>[0xFB5E,0xFB5F,0xFB60,0xFB61],0x67B=>[0xFB52,0xFB53,0xFB54,0xFB55],0x67E=>[0xFB56,0xFB57,0xFB58,0xFB59],0x67F=>[0xFB62,0xFB63,0xFB64,0xFB65],0x680=>[0xFB5A,0xFB5B,0xFB5C,0xFB5D],0x683=>[0xFB76,0xFB77,0xFB78,0xFB79],0x684=>[0xFB72,0xFB73,0xFB74,0xFB75],0x686=>[0xFB7A,0xFB7B,0xFB7C,0xFB7D],0x687=>[0xFB7E,0xFB7F,0xFB80,0xFB81],0x688=>[0xFB88,0xFB89,0x0,0x0],0x68C=>[0xFB84,0xFB85,0x0,0x0],0x68D=>[0xFB82,0xFB83,0x0,0x0],0x68E=>[0xFB86,0xFB87,0x0,0x0],0x691=>[0xFB8C,0xFB8D,0x0,0x0],0x698=>[0xFB8A,0xFB8B,0x0,0x0],0x6A4=>[0xFB6A,0xFB6B,0xFB6C,0xFB6D],0x6A6=>[0xFB6E,0xFB6F,0xFB70,0xFB71],0x6A9=>[0xFB8E,0xFB8F,0xFB90,0xFB91],0x6AD=>[0xFBD3,0xFBD4,0xFBD5,0xFBD6],0x6AF=>[0xFB92,0xFB93,0xFB94,0xFB95],0x6B1=>[0xFB9A,0xFB9B,0xFB9C,0xFB9D],0x6B3=>[0xFB96,0xFB97,0xFB98,0xFB99],0x6BA=>[0xFB9E,0xFB9F,0x0,0x0],0x6BB=>[0xFBA0,0xFBA1,0xFBA2,0xFBA3],0x6BE=>[0xFBAA,0xFBAB,0xFBAC,0xFBAD],0x6C0=>[0xFBA4,0xFBA5,0x0,0x0],0x6C1=>[0xFBA6,0xFBA7,0xFBA8,0xFBA9],0x6C5=>[0xFBE0,0xFBE1,0x0,0x0],0x6C6=>[0xFBD9,0xFBDA,0x0,0x0],0x6C7=>[0xFBD7,0xFBD8,0x0,0x0],0x6C8=>[0xFBDB,0xFBDC,0x0,0x0],0x6C9=>[0xFBE2,0xFBE3,0x0,0x0],0x6CB=>[0xFBDE,0xFBDF,0x0,0x0],0x6CC=>[0xFBFC,0xFBFD,0xFBFE,0xFBFF],0x6D0=>[0xFBE4,0xFBE5,0xFBE6,0xFBE7],0x6D2=>[0xFBAE,0xFBAF,0x0,0x0],0x6D3=>[0xFBB0,0xFBB1,0x0,0x0]];
const BX_LAMALEF = [0x622 => [0xFEF5, 0xFEF6], 0x623 => [0xFEF7, 0xFEF8], 0x625 => [0xFEF9, 0xFEFA], 0x627 => [0xFEFB, 0xFEFC]];
const BX_MIRROR = ['(' => ')', ')' => '(', '[' => ']', ']' => '[', '{' => '}', '}' => '{', '<' => '>', '>' => '<', '«' => '»', '»' => '«'];

function bx_is_transparent(int $c): bool { return ($c >= 0x64B && $c <= 0x65F) || $c === 0x670 || ($c >= 0x6D6 && $c <= 0x6ED); }
// Joins to the following letter (dual-joining, tatweel, ZWJ)
function bx_joins_next(int $c): bool { return $c === 0x640 || $c === 0x200D || (isset(BX_FORMS[$c]) && BX_FORMS[$c][2]); }
// Accepts a join from the preceding letter
function bx_joins_prev(int $c): bool { return $c === 0x640 || $c === 0x200D || (isset(BX_FORMS[$c]) && BX_FORMS[$c][1]); }

// Logical code points → shaped code points (same length; ligature tails become -1)
function bx_shape(array $cps): array
{
    $n = count($cps);
    $out = $cps;
    $prevOf = function ($i) use ($cps) { for ($j = $i - 1; $j >= 0; $j--) if (!bx_is_transparent($cps[$j])) return $cps[$j]; return 0; };
    $nextOf = function ($i) use ($cps, $n) { for ($j = $i + 1; $j < $n; $j++) if (!bx_is_transparent($cps[$j])) return [$cps[$j], $j]; return [0, -1]; };
    for ($i = 0; $i < $n; $i++) {
        $c = $cps[$i];
        if ($out[$i] === -1 || !isset(BX_FORMS[$c])) continue;
        $p = $prevOf($i);
        $pj = $p && bx_joins_next($p);
        [$nx, $ni] = $nextOf($i);
        if ($c === 0x644 && isset(BX_LAMALEF[$nx])) {
            $out[$i] = BX_LAMALEF[$nx][$pj ? 1 : 0];
            $out[$ni] = -1;
            continue;
        }
        $nj = $nx && bx_joins_prev($nx);
        [$iso, $fin, $ini, $med] = BX_FORMS[$c];
        if ($pj && $nj && $med) $out[$i] = $med;
        elseif ($pj && $fin) $out[$i] = $fin;
        elseif ($nj && $ini) $out[$i] = $ini;
        else $out[$i] = $iso;
    }
    return $out;
}

// Bidi class (simplified): R, L, N (number), W (space), O (other neutral)
function bx_bidi_class(int $c): string
{
    if (($c >= 0x30 && $c <= 0x39) || ($c >= 0x6F0 && $c <= 0x6F9) || ($c >= 0x660 && $c <= 0x669)) return 'N';
    if (($c >= 0x590 && $c <= 0x8FF) || ($c >= 0xFB1D && $c <= 0xFDFF) || ($c >= 0xFE70 && $c <= 0xFEFF)) return in_array($c, [0x60C, 0x61B, 0x61F, 0x66A, 0x66B, 0x66C, 0x6D4], true) ? 'O' : 'R';
    if ($c === 0x20 || $c === 0x200C || $c === 0x200D || $c === 0xA0) return 'W';
    if (($c >= 0x41 && $c <= 0x5A) || ($c >= 0x61 && $c <= 0x7A) || ($c >= 0xC0 && $c <= 0x24F) || ($c >= 0x370 && $c <= 0x52F)) return 'L';
    return 'O';
}
function bx_base_dir(array $cps, string $default = 'rtl'): string
{
    foreach ($cps as $c) { $k = bx_bidi_class($c); if ($k === 'R') return 'rtl'; if ($k === 'L') return 'ltr'; }
    return $default;
}
// Visual order of indices for one line. Numbers and Latin runs keep their own LTR
// order inside RTL text; neutrals take the surrounding direction.
function bx_bidi_order(array $cps, string $dir): array
{
    $n = count($cps);
    if (!$n) return [];
    $cls = array_map('bx_bidi_class', $cps);
    // number glue: separators between digits, % and currency next to numbers
    for ($i = 0; $i < $n; $i++) {
        if ($cls[$i] !== 'O') continue;
        $ch = $cps[$i];
        $prevN = $i > 0 && $cls[$i - 1] === 'N';
        $nextN = $i + 1 < $n && $cls[$i + 1] === 'N';
        if ($prevN && $nextN && in_array($ch, [0x2C, 0x2E, 0x3A, 0x2F, 0x66B, 0x66C, 0x2D], true)) $cls[$i] = 'N';
        elseif (($prevN || $nextN) && in_array($ch, [0x25, 0x66A, 0x24, 0x2B, 0x23], true)) $cls[$i] = 'N';
    }
    // strong direction of each char: R=1, L/N=2 (relative to RTL); numbers after Latin become Latin
    $lvl = array_fill(0, $n, 0);
    $lastStrong = $dir === 'rtl' ? 'R' : 'L';
    for ($i = 0; $i < $n; $i++) {
        $k = $cls[$i];
        if ($k === 'R' || $k === 'L') $lastStrong = $k;
        if ($k === 'N') $k = $lastStrong === 'L' ? 'L' : 'N';
        $cls[$i] = $k;
    }
    $isRtl = $dir === 'rtl';
    $strongAt = function ($i, $step) use ($cls, $n, $isRtl) {
        for ($j = $i; $j >= 0 && $j < $n; $j += $step) {
            $k = $cls[$j];
            if ($k === 'R') return 'R';
            if ($k === 'L' || $k === 'N') return 'L';
        }
        return $isRtl ? 'R' : 'L';
    };
    for ($i = 0; $i < $n; $i++) {
        $k = $cls[$i];
        if ($k === 'R') $d = 'R';
        elseif ($k === 'L' || $k === 'N') $d = 'L';
        else {
            $a = $strongAt($i - 1, -1); $b = $strongAt($i + 1, 1);
            // a neutral between a number and Persian text belongs to the Persian side
            $d = $a === $b ? $a : ($isRtl ? 'R' : 'L');
            if ($a === 'L' && $b === 'L' && $isRtl) {
                // only Latin-to-Latin bridges stay LTR; Latin/number pairs split
                $pa = null; for ($j = $i - 1; $j >= 0; $j--) if ($cls[$j] !== 'O' && $cls[$j] !== 'W') { $pa = $cls[$j]; break; }
                $pb = null; for ($j = $i + 1; $j < $n; $j++) if ($cls[$j] !== 'O' && $cls[$j] !== 'W') { $pb = $cls[$j]; break; }
                if ($pa === 'N' || $pb === 'N') $d = 'R';
            }
        }
        $lvl[$i] = $isRtl ? ($d === 'R' ? 1 : 2) : ($d === 'R' ? 1 : 0);
    }
    // trailing/leading spaces take the paragraph level
    $base = $isRtl ? 1 : 0;
    for ($i = $n - 1; $i >= 0 && $cls[$i] === 'W'; $i--) $lvl[$i] = $base;
    // reverse runs from the highest level down (UAX#9 L2)
    $order = range(0, $n - 1);
    $max = max($lvl);
    $minOdd = $base === 1 ? 1 : 1;
    for ($L = $max; $L >= $minOdd; $L--) {
        $i = 0;
        while ($i < $n) {
            if ($lvl[$order[$i]] >= $L) {
                $j = $i;
                while ($j + 1 < $n && $lvl[$order[$j + 1]] >= $L) $j++;
                $seg = array_reverse(array_slice($order, $i, $j - $i + 1));
                array_splice($order, $i, $j - $i + 1, $seg);
                $i = $j + 1;
            } else $i++;
        }
    }
    return [$order, $lvl];
}
function bx_cps(string $s): array { return $s === '' ? [] : array_map('mb_ord', mb_str_split($s)); }
function bx_chr(int $c): string { return mb_chr($c); }

// One logical line → visual shaped string (single style)
function bx_visual(string $s, string $dir = 'auto'): string
{
    $cps = bx_cps($s);
    if ($dir === 'auto') $dir = bx_base_dir($cps);
    $shaped = bx_shape($cps);
    [$order, $lvl] = bx_bidi_order($cps, $dir);
    $o = '';
    foreach ($order as $i) {
        $c = $shaped[$i];
        if ($c === -1 || $c === 0x200C || $c === 0x200D) continue;
        $ch = mb_chr($c);
        if ($lvl[$i] % 2 === 1 && isset(BX_MIRROR[$ch])) $ch = BX_MIRROR[$ch];
        $o .= $ch;
    }
    return $o;
}
