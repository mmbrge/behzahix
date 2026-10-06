<?php
// BEHIX — resume templates on A4 (points). Content flows to more pages when long.
if (!defined('BX')) { http_response_code(403); exit; }

const A4_W = 595.28;
const A4_H = 841.89;
const RESUME_TPLS = ['modern', 'classic', 'minimal', 'creative', 'executive', 'timeline', 'elegant', 'bold'];

// A column that flows down the page and continues on a new page when full
final class BxFlow
{
    public float $y;
    public function __construct(public BxCanvas $c, public float $x, public float $w, float $top, public float $bottom, private $onPage, public float $nextTop = 40)
    {
        $this->y = $top;
    }
    public function need(float $h): void
    {
        if ($this->y + $h <= $this->bottom) return;
        ($this->onPage)();
        $this->y = $this->nextTop;
    }
    public function text($t, array $o, float $after = 0): void
    {
        $lineH = ($o['size'] ?? 11) * ($o['lh'] ?? 1.75);
        $n = $this->c->lineCount($t, $this->w, $o);
        if (!empty($o['max'])) $n = min($n, (int) $o['max']);
        // short blocks move whole; long ones split line by line across pages
        $this->need(min($n, 3) * $lineH);
        $done = 0;
        while ($done < $n) {
            $fit = max(1, (int) floor(($this->bottom - $this->y) / $lineH));
            $take = min($fit, $n - $done);
            $this->y += $this->c->text($this->x, $this->y, $this->w, $t, ['skip' => $done, 'take' => $take] + $o);
            $done += $take;
            if ($done < $n) $this->need($this->bottom);
        }
        $this->y += $after;
    }
}

function resume_render(array $d): BxCanvas
{
    $W = A4_W; $H = A4_H;
    $t = in_array($d['tpl'] ?? '', RESUME_TPLS, true) ? $d['tpl'] : 'modern';
    $col = bx_hex($d['color'] ?? '', '#2563eb');
    $dark = '#1f2430'; $muted = '#6b7080';
    $c = new BxCanvas($W, $H);
    $c->title = 'رزومه ' . ($d['name'] ?? '');
    $c->defaultDir = 'rtl';
    $photo = bx_image_load($d['photo'] ?? '');
    $name = trim((string) ($d['name'] ?? '')) ?: 'نام و نام خانوادگی';
    $role = trim((string) ($d['role'] ?? '')) ?: 'عنوان شغلی';
    $nonEmpty = fn ($arr) => array_values(array_filter(is_array($arr) ? $arr : [], fn ($x) => is_array($x) && implode('', array_map('strval', array_filter($x, 'is_scalar'))) !== ''));
    $jobs = $nonEmpty($d['jobs'] ?? []); $edu = $nonEmpty($d['edu'] ?? []);
    $skills = $nonEmpty($d['skills'] ?? []); $langs = $nonEmpty($d['langs'] ?? []); $courses = $nonEmpty($d['courses'] ?? []);
    $contact = [];
    if (!empty($d['phone'])) $contact[] = ['phone', bx_fa($d['phone'])];
    if (!empty($d['email'])) $contact[] = ['mail', $d['email']];
    if (!empty($d['city'])) $contact[] = ['map', $d['city']];
    if (!empty($d['link'])) $contact[] = ['web', $d['link']];
    if (!empty($d['birth'])) $contact[] = ['star', 'متولد ' . bx_fa($d['birth'])];
    if (!empty($d['military'])) $contact[] = ['check', $d['military']];
    $soft = bx_shade($col, 0.92);
    $B = 10; // body size

    // ---------- section heading styles
    $heading = function (BxFlow $f, string $title, string $style = 'line', $onDark = false) use ($c, $col, $dark, $soft) {
        $f->need(62); // keep a heading with at least its first line
        $fg = $onDark ? '#ffffff' : $dark;
        switch ($style) {
            case 'bar':
                $c->rect($f->x + $f->w - 4, $f->y + 4, 4, 15, $col, 2);
                $c->text($f->x, $f->y, $f->w - 10, $title, ['size' => 12, 'font' => 'k', 'color' => $fg, 'lh' => 1.9]);
                $f->y += 28; break;
            case 'pill':
                $tw = $c->textWidth($title, 'k', 11) + 22;
                $c->rect($f->x + $f->w - $tw, $f->y + 1, $tw, 21, $soft, 10.5);
                $c->text($f->x + $f->w - $tw, $f->y + 1, $tw, $title, ['size' => 11, 'font' => 'k', 'color' => $col, 'align' => 'center', 'lh' => 1.9]);
                $f->y += 30; break;
            case 'dash':
                $c->rect($f->x + $f->w - 16, $f->y + 11, 16, 3, $col, 1.5);
                $c->text($f->x, $f->y, $f->w - 24, $title, ['size' => 11.5, 'font' => 'k', 'color' => $fg, 'lh' => 1.9]);
                $f->y += 28; break;
            case 'block':
                $c->rect($f->x, $f->y, $f->w, 22, $col, 4);
                $c->text($f->x + 8, $f->y, $f->w - 16, $title, ['size' => 11, 'font' => 'k', 'color' => bx_on($col), 'lh' => 2]);
                $f->y += 30; break;
            case 'center':
                $c->text($f->x, $f->y, $f->w, $title, ['size' => 11.5, 'font' => 'k', 'color' => $col, 'align' => 'center', 'lh' => 1.9]);
                $tw = $c->textWidth($title, 'k', 11.5);
                $c->rect($f->x, $f->y + 11, ($f->w - $tw) / 2 - 10, 0.8, bx_alpha($col, 0.4));
                $c->rect($f->x + ($f->w + $tw) / 2 + 10, $f->y + 11, ($f->w - $tw) / 2 - 10, 0.8, bx_alpha($col, 0.4));
                $f->y += 28; break;
            default: // line
                $c->text($f->x, $f->y, $f->w, $title, ['size' => 12, 'font' => 'k', 'color' => $onDark ? '#ffffff' : $col, 'lh' => 1.8]);
                $c->rect($f->x, $f->y + 22, $f->w, 1.2, $onDark ? bx_rgba('#ffffff', 0.3) : bx_alpha($col, 0.3));
                $c->rect($f->x + $f->w - 34, $f->y + 21.4, 34, 2.4, $onDark ? '#ffffff' : $col, 1.2);
                $f->y += 32;
        }
    };
    // ---------- entries
    $entry = function (BxFlow $f, string $title, string $sub, string $dates, string $desc, array $o = []) use ($c, $dark, $muted, $col, $B) {
        $f->need(44);
        $dw = $dates !== '' ? min(120, $c->textWidth($dates, 'r', 8.5) + 6) : 0;
        if (!empty($o['dot'])) { $c->circle($f->x + $f->w + 13, $f->y + 9, 4.2, '#ffffff'); $c->stroke('ellipse', $f->x + $f->w + 8.8, $f->y + 4.8, 8.4, 8.4, $col, 2); }
        $th = $c->text($f->x + $dw, $f->y, $f->w - $dw, $title, ['size' => $B + 1, 'font' => 'b', 'color' => $o['fg'] ?? $dark, 'lh' => 1.6]);
        if ($dates !== '') $c->text($f->x, $f->y + 2, $dw, $dates, ['size' => 8.5, 'color' => $o['muted'] ?? $muted, 'align' => 'left', 'lh' => 1.8]);
        $f->y += $th;
        if ($sub !== '') $f->text($sub, ['size' => $B - 0.5, 'font' => 'm', 'color' => $o['sub'] ?? $col, 'lh' => 1.6]);
        foreach (bx_lines($desc) as $ln) {
            $f->need(16);
            $c->circle($f->x + $f->w - 3, $f->y + $B * 0.95, 1.8, $o['bullet'] ?? bx_alpha($col, 0.8));
            $hh = $c->text($f->x, $f->y, $f->w - 11, $ln, ['size' => $B - 0.5, 'color' => $o['fg2'] ?? '#3a3f4b', 'lh' => 1.7]);
            $f->y += $hh;
        }
        $f->y += 8;
    };
    $dates = fn ($x) => bx_fa(implode(' — ', array_filter([trim((string) ($x['from'] ?? '')), trim((string) ($x['to'] ?? ''))])));
    $level = function (BxFlow $f, string $label, $lv, array $o = []) use ($c, $col, $dark) {
        $f->need(20);
        $lv = max(1, min(5, (int) $lv ?: 3));
        $bw = 64;
        $c->text($f->x + $bw + 8, $f->y, $f->w - $bw - 8, $label, ['size' => 9.5, 'font' => 'm', 'color' => $o['fg'] ?? $dark, 'lh' => 1.7, 'max' => 1]);
        $style = $o['style'] ?? 'dots';
        if ($style === 'bar') {
            $c->rect($f->x, $f->y + 7, $bw, 4.5, $o['track'] ?? '#e5e7eb', 2.25);
            $c->rect($f->x + $bw * (1 - $lv / 5), $f->y + 7, $bw * $lv / 5, 4.5, $o['on'] ?? $col, 2.25);
        } else for ($i = 0; $i < 5; $i++) $c->circle($f->x + $bw - 5 - $i * 12.5, $f->y + 9.2, 3.7, $i < $lv ? ($o['on'] ?? $col) : ($o['track'] ?? '#e2e5ec'));
        $f->y += 17;
    };
    $contactList = function (BxFlow $f, array $o = []) use ($c, $contact, $col, $dark) {
        foreach ($contact as [$ic, $v]) {
            $f->need(18);
            bx_icon($c, $ic, $f->x + $f->w - 12, $f->y + 3.5, 11, $o['icon'] ?? $col);
            $hh = $c->text($f->x, $f->y, $f->w - 18, $v, ['size' => 9, 'color' => $o['fg'] ?? $dark, 'lh' => 1.75]);
            $f->y += max(17, $hh);
        }
        $f->y += 6;
    };
    $tags = function (BxFlow $f, array $items, array $o = []) use ($c, $col, $soft) {
        $x = $f->x + $f->w; $f->need(22);
        foreach ($items as $s) {
            $tw = $c->textWidth($s, 'm', 8.8) + 16;
            if ($x - $tw < $f->x) { $x = $f->x + $f->w; $f->y += 22; $f->need(22); }
            $c->rect($x - $tw, $f->y, $tw, 17, $o['bg'] ?? $soft, 8.5);
            $c->text($x - $tw, $f->y + 0.5, $tw, $s, ['size' => 8.8, 'font' => 'm', 'color' => $o['fg'] ?? $col, 'align' => 'center', 'lh' => 1.8]);
            $x -= $tw + 6;
        }
        $f->y += 28;
    };
    // main sections in order
    $mainSections = function (BxFlow $f, string $hs, array $o = []) use ($d, $jobs, $edu, $courses, $heading, $entry, $dates, $B, $dark) {
        if (!empty($d['summary'])) { $heading($f, 'درباره من', $hs); $f->text($d['summary'], ['size' => $B, 'color' => '#3a3f4b', 'lh' => 1.85], 12); }
        if ($jobs) { $heading($f, 'سوابق کاری', $hs); foreach ($jobs as $j) $entry($f, (string) ($j['role'] ?? ''), (string) ($j['company'] ?? ''), $dates($j), (string) ($j['desc'] ?? ''), $o); $f->y += 4; }
        if ($edu) { $heading($f, 'تحصیلات', $hs); foreach ($edu as $x) $entry($f, (string) ($x['degree'] ?? ''), (string) ($x['school'] ?? ''), $dates($x), '', $o); $f->y += 4; }
        if ($courses) { $heading($f, 'دوره‌ها و گواهی‌ها', $hs); foreach ($courses as $x) $entry($f, (string) ($x['title'] ?? ''), bx_fa($x['org'] ?? ''), '', '', $o); }
    };
    $sideSections = function (BxFlow $f, string $hs, array $o = []) use ($d, $skills, $langs, $heading, $level, $contactList, $contact) {
        $onDark = !empty($o['dark']);
        if ($contact) { $heading($f, 'اطلاعات تماس', $hs, $onDark); $contactList($f, $o); }
        if ($skills) { $heading($f, 'مهارت‌ها', $hs, $onDark); foreach ($skills as $s) $level($f, (string) ($s['name'] ?? ''), $s['level'] ?? 4, $o); $f->y += 10; }
        if ($langs) { $heading($f, 'زبان‌ها', $hs, $onDark); foreach ($langs as $s) $level($f, (string) ($s['name'] ?? ''), $s['level'] ?? 3, $o); $f->y += 10; }
        if (!empty($d['interests'])) { $heading($f, 'علایق', $hs, $onDark); $f->text($d['interests'], ['size' => 9.5, 'color' => $o['fg'] ?? '#3a3f4b', 'lh' => 1.8]); }
    };
    $photoAt = function ($x, $y, $s, $ring = null) use ($c, $photo) {
        if (!$photo) return;
        if ($ring) $c->circle($x + $s / 2, $y + $s / 2, $s / 2 + 3.5, $ring);
        $c->image($photo, $x, $y, $s, $s, 'circle');
    };
    $M = 40;

    switch ($t) {
        case 'modern':
        case 'executive':
            $sideW = 190; $ex = $t === 'executive';
            $sideBg = $ex ? bx_grad(0, 0, 0, $H, bx_shade($col, -0.55), bx_shade($col, -0.75)) : $soft;
            $pageBg = function () use ($c, $W, $H, $sideW, $sideBg) { $c->rect(0, 0, $sideW, $H, $sideBg); };
            $pageBg();
            if (!$ex) {
                $c->rect($sideW, 0, $W - $sideW, 128, bx_grad($sideW, 0, $W, 128, $col, bx_shade($col, -0.3)));
                $c->text($sideW + 30, 34, $W - $sideW - 60, $name, ['size' => 24, 'font' => 'k', 'color' => '#ffffff', 'lh' => 1.4, 'max' => 1]);
                $c->text($sideW + 30, 72, $W - $sideW - 60, $role, ['size' => 12.5, 'font' => 'm', 'color' => bx_rgba('#ffffff', 0.88), 'lh' => 1.5, 'max' => 1]);
                $photoAt(($sideW - 104) / 2, 24, 104, '#ffffff');
                $top = 150; $sideTop = $photo ? 150 : 40;
            } else {
                $photoAt(($sideW - 112) / 2, 34, 112, $col);
                $c->text($sideW + 30, 40, $W - $sideW - 60, $name, ['size' => 26, 'font' => 'k', 'color' => $dark, 'lh' => 1.4, 'max' => 1]);
                $c->text($sideW + 30, 82, $W - $sideW - 60, $role, ['size' => 13, 'font' => 'b', 'color' => $col, 'lh' => 1.5, 'max' => 1]);
                $c->rect($W - 30 - 50, 116, 50, 3, $col, 1.5);
                $top = 140; $sideTop = $photo ? 172 : 40;
            }
            $side = new BxFlow($c, 18, $sideW - 36, $sideTop, $H - 30, fn () => null);
            $main = new BxFlow($c, $sideW + 26, $W - $sideW - 52, $top, $H - 40, function () use ($c, $W, $H, $pageBg) { $c->page($W, $H); $pageBg(); });
            $sideSections($side, $ex ? 'line' : 'dash', $ex ? ['dark' => true, 'fg' => '#e5e7eb', 'icon' => bx_shade($col, 0.5), 'on' => bx_shade($col, 0.45), 'track' => bx_rgba('#ffffff', 0.18), 'style' => 'bar'] : ['style' => 'dots']);
            // side sections are drawn on page 1 only, so draw them before main flows
            $mainSections($main, $ex ? 'pill' : 'line');
            break;

        case 'creative':
            $c->rect(0, 0, $W, 170, bx_grad(0, 0, $W, 170, $col, bx_shade($col, -0.45)));
            $c->circle($W - 30, 10, 110, bx_rgba('#ffffff', 0.1));
            $c->circle(120, 170, 70, bx_rgba('#ffffff', 0.07));
            $c->poly([[0, 170], [$W, 130], [$W, 172], [0, 172]], '#ffffff');
            $photoAt($W - 40 - 100, 28, 100, bx_rgba('#ffffff', 0.7));
            $tx = $photo ? $W - 40 - 120 : $W - $M;
            $c->text($M, 40, $tx - $M, $name, ['size' => 25, 'font' => 'k', 'color' => '#ffffff', 'lh' => 1.4, 'max' => 1]);
            $c->text($M, 80, $tx - $M, $role, ['size' => 13, 'font' => 'm', 'color' => bx_rgba('#ffffff', 0.9), 'lh' => 1.5, 'max' => 1]);
            $sideW = 175;
            $side = new BxFlow($c, $M - 10, $sideW - 20, 190, $H - 30, fn () => null);
            $c->line($M + $sideW, 190, $M + $sideW, $H - 40, bx_alpha($col, 0.25), 1);
            $main = new BxFlow($c, $M + $sideW + 20, $W - $M * 2 - $sideW - 20, 190, $H - 40, function () use ($c, $W, $H, $col) { $c->page($W, $H); $c->rect(0, 0, $W, 10, $col); });
            $sideSections($side, 'pill', ['style' => 'bar']);
            $mainSections($main, 'pill');
            break;

        case 'timeline':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $photoAt($W - $M - 84, 36, 84, $soft);
            $tx = $photo ? $W - $M - 100 : $W - $M;
            $c->text($M, 40, $tx - $M, $name, ['size' => 25, 'font' => 'k', 'color' => $dark, 'lh' => 1.4, 'max' => 1]);
            $c->text($M, 80, $tx - $M, $role, ['size' => 12.5, 'font' => 'b', 'color' => $col, 'lh' => 1.5, 'max' => 1]);
            $f = new BxFlow($c, $M, $W - 2 * $M, 132, $H - 40, function () use ($c, $W, $H) { $c->page($W, $H); });
            if ($contact) {
                $cw = ($W - 2 * $M) / 3; $i = 0;
                foreach ($contact as [$ic, $v]) {
                    $cx = $W - $M - ($i % 3) * $cw; $cy = 132 + intdiv($i, 3) * 20;
                    bx_icon($c, $ic, $cx - 11, $cy + 3, 10, $col);
                    $c->text($cx - $cw + 4, $cy, $cw - 20, $v, ['size' => 8.8, 'color' => $dark, 'max' => 1, 'lh' => 1.8]);
                    $i++;
                }
                $f->y = 132 + ceil(count($contact) / 3) * 20 + 14;
            }
            $c->rect($M, $f->y - 6, $W - 2 * $M, 1, '#e5e7eb');
            $f->y += 10;
            $mf = new BxFlow($c, $M, $W - 2 * $M - 30, $f->y, $H - 40, function () use ($c, $W, $H) { $c->page($W, $H); }, 40);
            if (!empty($d['summary'])) { $heading($mf, 'درباره من', 'bar'); $mf->text($d['summary'], ['size' => $B, 'color' => '#3a3f4b', 'lh' => 1.85], 10); }
            $tl = function (string $title, array $list, callable $fn) use ($mf, $heading, $entry, $c, $col, $W, $M) {
                if (!$list) return;
                $heading($mf, $title, 'bar');
                $y0 = $mf->y; $p0 = count($c->pages);
                foreach ($list as $x) { [$a, $b, $dt, $ds] = $fn($x); $entry($mf, $a, $b, $dt, $ds, ['dot' => true]); }
                // the rail goes under the dots: insert it right after the page background
                if (count($c->pages) === $p0) array_splice($c->pages[$p0 - 1]['ops'], 1, 0, [['rect', $W - $M - 17.6, $y0 + 6, 1.2, max(0, $mf->y - $y0 - 18), bx_alpha($col, 0.3), 0]]);
            };
            $tl('سوابق کاری', $jobs, fn ($j) => [(string) ($j['role'] ?? ''), (string) ($j['company'] ?? ''), $dates($j), (string) ($j['desc'] ?? '')]);
            $tl('تحصیلات', $edu, fn ($x) => [(string) ($x['degree'] ?? ''), (string) ($x['school'] ?? ''), $dates($x), '']);
            $mf->x = $M; $mf->w = $W - 2 * $M;
            if ($skills) { $heading($mf, 'مهارت‌ها', 'bar'); $tags($mf, array_map(fn ($s) => (string) ($s['name'] ?? ''), $skills)); }
            if ($langs) { $heading($mf, 'زبان‌ها', 'bar'); $tags($mf, array_map(fn ($s) => trim(($s['name'] ?? '') . ' · ' . (['', 'آشنایی', 'متوسط', 'خوب', 'خیلی خوب', 'عالی'][(int) ($s['level'] ?? 3)] ?? '')), $langs), ['bg' => '#f3f4f6', 'fg' => $dark]); }
            if ($courses) { $heading($mf, 'دوره‌ها و گواهی‌ها', 'bar'); foreach ($courses as $x) $entry($mf, (string) ($x['title'] ?? ''), bx_fa($x['org'] ?? ''), '', ''); }
            if (!empty($d['interests'])) { $heading($mf, 'علایق', 'bar'); $mf->text($d['interests'], ['size' => 9.5, 'color' => '#3a3f4b']); }
            break;

        case 'elegant':
            $c->rect(0, 0, $W, $H, '#fffdf9');
            $c->stroke('rect', 18, 18, $W - 36, $H - 36, bx_alpha($col, 0.35), 0.8);
            $y = 44;
            if ($photo) { $photoAt($W / 2 - 42, $y, 84, bx_alpha($col, 0.35)); $y += 96; }
            $c->text($M, $y, $W - 2 * $M, $name, ['size' => 25, 'font' => 'k', 'color' => $dark, 'align' => 'center', 'lh' => 1.4, 'max' => 1]); $y += 38;
            $c->text($M, $y, $W - 2 * $M, $role, ['size' => 12, 'font' => 'm', 'color' => $col, 'align' => 'center', 'lh' => 1.5, 'max' => 1]); $y += 26;
            if ($contact) { $c->text($M, $y, $W - 2 * $M, implode('   ◦   ', array_column($contact, 1)), ['size' => 8.8, 'color' => $muted, 'align' => 'center', 'lh' => 1.8, 'max' => 2]); $y += 34; }
            $f = new BxFlow($c, $M + 10, $W - 2 * $M - 20, $y, $H - 44, function () use ($c, $W, $H, $col) { $c->page($W, $H); $c->rect(0, 0, $W, $H, '#fffdf9'); $c->stroke('rect', 18, 18, $W - 36, $H - 36, bx_alpha($col, 0.35), 0.8); }, 44);
            $mainSections($f, 'center');
            if ($skills || $langs) {
                $heading($f, 'مهارت‌ها و زبان‌ها', 'center');
                $f->need(40);
                $half = ($f->w - 30) / 2; $y0 = $f->y;
                $l = new BxFlow($c, $f->x + $half + 30, $half, $y0, $H - 44, fn () => null);
                foreach ($skills as $s) $level($l, (string) ($s['name'] ?? ''), $s['level'] ?? 4);
                $r = new BxFlow($c, $f->x, $half, $y0, $H - 44, fn () => null);
                foreach ($langs as $s) $level($r, (string) ($s['name'] ?? ''), $s['level'] ?? 3);
                $f->y = max($l->y, $r->y) + 10;
            }
            if (!empty($d['interests'])) { $heading($f, 'علایق', 'center'); $f->text($d['interests'], ['size' => 9.5, 'color' => '#3a3f4b', 'align' => 'center']); }
            break;

        case 'bold':
            $c->rect(0, 0, $W, $H, '#ffffff');
            $c->rect(0, 0, $W, 150, '#111318');
            $c->rect($W - 230, 0, 230, 150, bx_grad($W - 230, 0, $W, 150, $col, bx_shade($col, -0.3)));
            $c->poly([[$W - 230, 0], [$W - 190, 0], [$W - 230, 150], [$W - 270, 150]], '#111318');
            if ($photo) $c->image($photo, $W - 200, 24, 170, 102, 'round', 10);
            $c->text($M, 36, $W - 330, $name, ['size' => 26, 'font' => 'k', 'color' => '#ffffff', 'lh' => 1.4, 'max' => 1]);
            $c->text($M, 78, $W - 330, $role, ['size' => 12.5, 'font' => 'b', 'color' => bx_shade($col, 0.25), 'lh' => 1.5, 'max' => 1]);
            $f = new BxFlow($c, $M, $W - 2 * $M, 168, $H - 40, function () use ($c, $W, $H) { $c->page($W, $H); });
            if ($contact) {
                $cw = ($W - 2 * $M) / 3; $i = 0;
                foreach ($contact as [$ic, $v]) { $cx = $W - $M - ($i % 3) * $cw; $cy = 166 + intdiv($i, 3) * 20; bx_icon($c, $ic, $cx - 11, $cy + 3, 10, $col); $c->text($cx - $cw + 4, $cy, $cw - 20, $v, ['size' => 8.8, 'color' => $dark, 'max' => 1, 'lh' => 1.8]); $i++; }
                $f->y = 166 + ceil(count($contact) / 3) * 20 + 14;
            }
            $mainSections($f, 'block');
            if ($skills) { $heading($f, 'مهارت‌ها', 'block'); $tags($f, array_map(fn ($s) => (string) ($s['name'] ?? ''), $skills), ['bg' => '#111318', 'fg' => '#ffffff']); }
            if ($langs) { $heading($f, 'زبان‌ها', 'block'); $tags($f, array_map(fn ($s) => trim(($s['name'] ?? '') . ' · ' . (['', 'آشنایی', 'متوسط', 'خوب', 'خیلی خوب', 'عالی'][(int) ($s['level'] ?? 3)] ?? '')), $langs)); }
            if (!empty($d['interests'])) { $heading($f, 'علایق', 'block'); $f->text($d['interests'], ['size' => 9.5, 'color' => '#3a3f4b']); }
            break;

        case 'classic':
        case 'minimal':
        default:
            $min = $t === 'minimal';
            $c->rect(0, 0, $W, $H, '#ffffff');
            $mx = $min ? 56 : 48;
            $y = $min ? 56 : 44;
            if ($photo) $photoAt($mx, $y - 4, 78, $min ? null : bx_alpha($col, 0.3));
            $tx = $photo ? $mx + 92 : $mx;
            $c->text($tx, $y, $W - $mx - $tx, $name, ['size' => $min ? 23 : 25, 'font' => 'k', 'color' => $dark, 'lh' => 1.4, 'max' => 1]);
            $c->text($tx, $y + 38, $W - $mx - $tx, $role, ['size' => 12, 'font' => $min ? 'r' : 'b', 'color' => $min ? $muted : $col, 'lh' => 1.5, 'max' => 1]);
            $y += $photo ? 92 : 70;
            if (!$min) { $c->rect($mx, $y, $W - 2 * $mx, 2.5, $col); $y += 12; }
            if ($contact) { $c->text($mx, $y, $W - 2 * $mx, implode('    ', array_column($contact, 1)), ['size' => 8.8, 'color' => $min ? $dark : $muted, 'lh' => 1.85, 'max' => 2]); $y += 34; }
            $f = new BxFlow($c, $mx, $W - 2 * $mx, $y, $H - 44, function () use ($c, $W, $H) { $c->page($W, $H); }, 48);
            $mainSections($f, $min ? 'dash' : 'line');
            if ($skills || $langs) {
                $f->need(60);
                $half = ($f->w - 30) / 2; $y0 = $f->y;
                $r = new BxFlow($c, $f->x + $half + 30, $half, $y0, $H - 44, fn () => null);
                if ($skills) { $heading($r, 'مهارت‌ها', $min ? 'dash' : 'line'); foreach ($skills as $s) $level($r, (string) ($s['name'] ?? ''), $s['level'] ?? 4); }
                $l = new BxFlow($c, $f->x, $half, $y0, $H - 44, fn () => null);
                if ($langs) { $heading($l, 'زبان‌ها', $min ? 'dash' : 'line'); foreach ($langs as $s) $level($l, (string) ($s['name'] ?? ''), $s['level'] ?? 3); }
                $f->y = max($l->y, $r->y) + 12;
            }
            if (!empty($d['interests'])) { $heading($f, 'علایق', $min ? 'dash' : 'line'); $f->text($d['interests'], ['size' => 9.5, 'color' => '#3a3f4b']); }
            break;
    }
    return $c;
}
