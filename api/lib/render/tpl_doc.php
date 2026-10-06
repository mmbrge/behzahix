<?php
// BEHIX — document templates: the admin's simple HTML (h2/h3/p/b/ul/table…)
// with {{field}} blanks → a block list → A4 PDF pages or a Word .docx.
if (!defined('BX')) { http_response_code(403); exit; }

// Template HTML + values → blocks. $preview keeps unfilled blanks visible.
function doc_blocks(string $body, array $vals, bool $preview): array
{
    $html = preg_replace_callback('/\{\{\s*([^}]+?)\s*\}\}/u', function ($m) use ($vals, $preview) {
        $k = $m[1];
        $v = trim((string) ($vals[$k] ?? ''));
        if ($v !== '') return '<b data-v="1">' . nl2br(htmlspecialchars($v, ENT_QUOTES, 'UTF-8')) . '</b>';
        return $preview ? '<span data-blank="1">' . htmlspecialchars($k, ENT_QUOTES, 'UTF-8') . '</span>' : '<span data-gap="1">……………</span>';
    }, $body);
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8"?><div id="root">' . $html . '</div>', LIBXML_NONET);
    libxml_clear_errors();
    $root = $dom->getElementById('root');
    $blocks = [];
    $runs = [];
    $flush = function (string $type = 'p', array $extra = []) use (&$runs, &$blocks) {
        // trim edge spaces
        while ($runs && trim($runs[0][0]) === '' && $runs[0][0] !== "\n") array_shift($runs);
        if ($runs) $blocks[] = ['type' => $type, 'runs' => $runs] + $extra;
        $runs = [];
    };
    $align = function (DOMElement $el): string {
        $st = strtolower($el->getAttribute('style'));
        if (preg_match('/text-align\s*:\s*(left|right|center|justify)/', $st, $m)) return ['left' => 'end', 'right' => 'start', 'center' => 'center', 'justify' => 'start'][$m[1]];
        return 'start';
    };
    $inline = function (DOMNode $n, bool $bold, string $color) use (&$inline, &$runs) {
        foreach ($n->childNodes as $ch) {
            if ($ch instanceof DOMText) { $t = preg_replace('/\s+/u', ' ', $ch->nodeValue); if ($t !== '') $runs[] = [$t, $bold, $color]; continue; }
            if (!$ch instanceof DOMElement) continue;
            $tag = strtolower($ch->tagName);
            if ($tag === 'br') { $runs[] = ["\n", $bold, $color]; continue; }
            $b = $bold || in_array($tag, ['b', 'strong', 'th'], true);
            $c = $ch->hasAttribute('data-blank') ? '#a0a6b4' : ($ch->hasAttribute('data-v') ? '#111827' : $color);
            $inline($ch, $b, $c);
        }
    };
    $walk = function (DOMNode $n) use (&$walk, &$runs, $flush, $inline, $align, &$blocks) {
        foreach ($n->childNodes as $ch) {
            if ($ch instanceof DOMText) { $t = preg_replace('/\s+/u', ' ', $ch->nodeValue); if (trim($t) !== '') $runs[] = [$t, false, '#1f2430']; continue; }
            if (!$ch instanceof DOMElement) continue;
            $tag = strtolower($ch->tagName);
            $mt = preg_match('/margin-top\s*:\s*(\d+)/', $ch->getAttribute('style'), $m) ? (int) $m[1] : 0;
            switch ($tag) {
                case 'h1': case 'h2': case 'h3': case 'h4':
                    $flush(); $inline($ch, true, '#111827'); $flush('h', ['level' => (int) $tag[1], 'align' => $align($ch), 'mt' => $mt]); break;
                case 'p': case 'div':
                    $flush(); $inline($ch, false, '#1f2430'); $flush('p', ['align' => $align($ch), 'mt' => $mt]); break;
                case 'ul': case 'ol':
                    $flush(); $i = 0;
                    foreach ($ch->childNodes as $li) if ($li instanceof DOMElement && strtolower($li->tagName) === 'li') { $i++; $inline($li, false, '#1f2430'); $flush('li', ['n' => $tag === 'ol' ? $i : 0]); }
                    break;
                case 'table':
                    $flush(); $rows = [];
                    foreach ($ch->getElementsByTagName('tr') as $tr) {
                        $cells = [];
                        foreach ($tr->childNodes as $td) if ($td instanceof DOMElement && in_array(strtolower($td->tagName), ['td', 'th'], true)) {
                            $runs = []; $inline($td, strtolower($td->tagName) === 'th', '#1f2430');
                            $cells[] = ['runs' => $runs, 'head' => strtolower($td->tagName) === 'th', 'span' => max(1, (int) $td->getAttribute('colspan')), 'align' => $align($td)];
                            $runs = [];
                        }
                        if ($cells) $rows[] = $cells;
                    }
                    $border = $ch->getAttribute('border') !== '' && $ch->getAttribute('border') !== '0';
                    if ($rows) $blocks[] = ['type' => 'table', 'rows' => $rows, 'border' => $border, 'mt' => $mt];
                    break;
                case 'hr': $flush(); $blocks[] = ['type' => 'hr']; break;
                case 'br': $runs[] = ["\n", false, '#1f2430']; break;
                default: $inline($ch, in_array($tag, ['b', 'strong'], true), '#1f2430');
            }
        }
    };
    $walk($root);
    $flush();
    return $blocks;
}

function doc_render(array $tpl, array $vals, bool $preview, array $opt = []): BxCanvas
{
    $W = A4_W; $H = A4_H; $M = 56;
    $c = new BxCanvas($W, $H);
    $c->title = (string) $tpl['title'];
    $c->defaultDir = 'rtl';
    $accent = bx_hex($opt['color'] ?? '', '#1f2937');
    $head = function () use ($c, $W, $H, $accent, $opt) {
        if (!empty($opt['frame'])) $c->stroke('rect', 22, 22, $W - 44, $H - 44, bx_alpha($accent, 0.5), 0.8);
        $c->rect(0, 0, $W, 5, $accent);
    };
    $head();
    $f = new BxFlow($c, $M, $W - 2 * $M, 60, $H - 56, function () use ($c, $W, $H, $head) { $c->page($W, $H); $head(); }, 56);
    $toRuns = fn (array $runs, string $bold = 'b', string $reg = 'r') => array_map(fn ($r) => [$r[0], $r[1] ? $bold : $reg, $r[2]], $runs);
    foreach (doc_blocks((string) $tpl['body'], $vals, $preview) as $b) {
        $f->y += min(60, ($b['mt'] ?? 0) * 0.75);
        switch ($b['type']) {
            case 'h':
                $size = [1 => 18, 2 => 16, 3 => 12.5, 4 => 11.5][$b['level']] ?? 12;
                $f->need($size * 4);
                $f->y += $b['level'] <= 2 ? 4 : 8;
                $f->text($toRuns($b['runs'], 'k', 'k'), ['size' => $size, 'align' => $b['align'], 'lh' => 1.8], $b['level'] <= 2 ? 10 : 2);
                break;
            case 'p':
                $f->text($toRuns($b['runs']), ['size' => 11, 'align' => $b['align'], 'lh' => 2.05], 6);
                break;
            case 'li':
                $f->need(24);
                $mark = $b['n'] ? bx_fa($b['n']) . '.' : '•';
                $c->text($f->x + $f->w - 16, $f->y, 16, $mark, ['size' => 11, 'align' => 'right', 'lh' => 2.05]);
                $hh = $c->text($f->x, $f->y, $f->w - 20, $toRuns($b['runs']), ['size' => 11, 'lh' => 2.05]);
                $f->y += $hh + 2;
                break;
            case 'hr':
                $f->need(14); $c->rect($f->x, $f->y + 6, $f->w, 0.8, '#d1d5db'); $f->y += 14; break;
            case 'table':
                $cols = 0;
                foreach ($b['rows'] as $r) $cols = max($cols, array_sum(array_column($r, 'span')));
                $cw = $f->w / max(1, $cols); $pad = 6;
                foreach ($b['rows'] as $r) {
                    $h = 0; $x = $f->x + $f->w; $cells = [];
                    foreach ($r as $cell) {
                        $w = $cw * $cell['span'];
                        $hh = $c->measure($toRuns($cell['runs']), $w - 2 * $pad, ['size' => 10.5, 'lh' => 1.85]);
                        $cells[] = [$x - $w, $w, $cell];
                        $h = max($h, $hh + 2 * $pad);
                        $x -= $w;
                    }
                    $f->need($h);
                    foreach ($cells as [$cx, $w, $cell]) {
                        if ($cell['head']) $c->rect($cx, $f->y, $w, $h, '#f3f4f6');
                        if ($b['border']) $c->stroke('rect', $cx, $f->y, $w, $h, '#9ca3af', 0.7);
                        $c->text($cx + $pad, $f->y + $pad, $w - 2 * $pad, $toRuns($cell['runs']), ['size' => 10.5, 'lh' => 1.85, 'align' => $cell['head'] ? 'center' : $cell['align']]);
                    }
                    $f->y += $h;
                }
                $f->y += 10;
                break;
        }
    }
    // page numbers
    $n = count($c->pages);
    if ($n > 1) foreach ($c->pages as $i => $_) $c->pages[$i]['ops'][] = ['text', $W / 2 - 12, $H - 26, bx_visual(bx_fa(($i + 1) . ' / ' . $n), 'ltr'), 'r', 8.5, bx_rgba('#9ca3af')];
    return $c;
}
