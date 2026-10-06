<?php
// BEHIX — native Office files built on the server: editable right-to-left
// PowerPoint (.pptx) from the slide model and Word (.docx) from document blocks.
if (!defined('BX')) { http_response_code(403); exit; }

function ox_esc(string $s): string { return htmlspecialchars(preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', $s), ENT_XML1 | ENT_QUOTES, 'UTF-8'); }
function ox_hex($c): string { $c = bx_rgba($c); return sprintf('%02X%02X%02X', $c[0], $c[1], $c[2]); }
function ox_zip(array $files): string
{
    $tmp = tempnam(sys_get_temp_dir(), 'bxo');
    $z = new ZipArchive();
    $z->open($tmp, ZipArchive::OVERWRITE);
    foreach ($files as $name => $data) $z->addFromString($name, $data);
    $z->close();
    $out = (string) file_get_contents($tmp);
    @unlink($tmp);
    return $out;
}
const OX_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' . "\n";
const OX_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

// ================================================================ PPTX
function pptx_build(array $slides, string $font = 'Tahoma', string $title = ''): string
{
    $E = 12700; // EMU per point
    $font = ox_esc($font ?: 'Tahoma');
    $files = [];
    $media = [];
    $c = new BxCanvas(SLIDE_W, SLIDE_H); // only for text measuring
    $fill = function ($col, float $a = 1.0) { $al = $a < 0.999 ? '<a:alpha val="' . (int) round($a * 100000) . '"/>' : ''; return '<a:solidFill><a:srgbClr val="' . ox_hex($col) . '">' . $al . '</a:srgbClr></a:solidFill>'; };
    $grad = fn ($c1, $c2, $ang = 0) => '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="' . ox_hex($c1) . '"/></a:gs><a:gs pos="100000"><a:srgbClr val="' . ox_hex($c2) . '"/></a:gs></a:gsLst><a:lin ang="' . ($ang * 60000) . '" scaled="0"/></a:gradFill>';
    $xfrm = fn ($x, $y, $w, $h) => '<a:xfrm><a:off x="' . (int) round($x * $E) . '" y="' . (int) round($y * $E) . '"/><a:ext cx="' . (int) round(max(1, $w) * $E) . '" cy="' . (int) round(max(1, $h) * $E) . '"/></a:xfrm>';
    foreach ($slides as $si => $s) {
        $n = $si + 1;
        $id = 2;
        $rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'];
        $sp = '';
        foreach ($s['els'] as $el) {
            $id++;
            switch ($el[0]) {
                case 'rect': case 'ellipse': case 'grad': case 'frame':
                    [$k, $x, $y, $w, $h] = $el;
                    $geom = $k === 'ellipse' ? 'ellipse' : (($el[7] ?? 0) > 0 ? 'roundRect' : 'rect');
                    $av = $geom === 'roundRect' ? '<a:gd name="adj" fmla="val ' . (int) round(min(50000, $el[7] / max(1, min($w, $h)) * 100000)) . '"/>' : '';
                    $f = $k === 'grad' ? $grad($el[5], $el[6]) : ($k === 'frame' ? '<a:noFill/>' : $fill($el[5], (float) ($el[6] ?? 1)));
                    $ln = $k === 'frame' ? '<a:ln w="' . (int) (1.5 * $E) . '">' . $fill($el[5]) . '</a:ln>' : '<a:ln><a:noFill/></a:ln>';
                    $sp .= "<p:sp><p:nvSpPr><p:cNvPr id=\"$id\" name=\"Shape $id\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>" . $xfrm($x, $y, $w, $h) . "<a:prstGeom prst=\"$geom\"><a:avLst>$av</a:avLst></a:prstGeom>$f$ln</p:spPr></p:sp>";
                    break;
                case 'image':
                    [, $x, $y, $w, $h, $src, $fit] = $el;
                    $im = bx_image_load($src);
                    if (!$im) break;
                    $iw = imagesx($im); $ih = imagesy($im);
                    $hasAlpha = false;
                    for ($py = 0; $py < $ih && !$hasAlpha; $py += max(1, intdiv($ih, 40))) for ($px = 0; $px < $iw; $px += max(1, intdiv($iw, 40))) if ((imagecolorat($im, $px, $py) >> 24) & 0x7F) { $hasAlpha = true; break; }
                    ob_start(); $hasAlpha ? imagepng($im) : imagejpeg($im, null, 90); $bin = (string) ob_get_clean();
                    $mi = count($media) + 1; $ext = $hasAlpha ? 'png' : 'jpeg';
                    $media["ppt/media/image$mi.$ext"] = $bin;
                    $rid = 'rId' . (count($rels) + 1);
                    $rels[] = "<Relationship Id=\"$rid\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"../media/image$mi.$ext\"/>";
                    $src = '';
                    if ($fit === 'cover') {
                        $ra = $w / $h; $rs = $iw / $ih;
                        if ($rs > $ra) { $cut = (1 - $ra / $rs) / 2 * 100000; $src = '<a:srcRect l="' . (int) $cut . '" r="' . (int) $cut . '"/>'; }
                        else { $cut = (1 - $rs / $ra) / 2 * 100000; $src = '<a:srcRect t="' . (int) $cut . '" b="' . (int) $cut . '"/>'; }
                    } else {
                        $k = min($w / $iw, $h / $ih); $nw = $iw * $k; $nh = $ih * $k;
                        $x += ($w - $nw) / 2; $y += ($h - $nh) / 2; $w = $nw; $h = $nh;
                    }
                    $geom = ($el[7] ?? 0) > 0 ? '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ' . (int) round($el[7] / min($w, $h) * 100000) . '"/></a:avLst></a:prstGeom>' : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
                    $sp .= "<p:pic><p:nvPicPr><p:cNvPr id=\"$id\" name=\"Picture $id\"/><p:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed=\"$rid\"/>$src<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>" . $xfrm($x, $y, $w, $h) . "$geom</p:spPr></p:pic>";
                    break;
                case 'text':
                    [, $x, $y, $w, $h, $txt, $o] = $el;
                    $size = slide_text_size($c, $el);
                    $paras = is_array($txt) ? $txt : [$txt];
                    $anchor = ['top' => 't', 'middle' => 'ctr', 'bottom' => 'b'][$o['valign'] ?? 'top'] ?? 't';
                    $algn = ['right' => 'r', 'left' => 'l', 'center' => 'ctr'][$o['align'] ?? 'right'] ?? 'r';
                    $lh = (int) round(($o['lh'] ?? 1.35) / 1.2 * 100000);
                    $col = $o['color']; $alpha = is_array($col) && $col[3] < 1 ? '<a:alpha val="' . (int) round($col[3] * 100000) . '"/>' : '';
                    $ps = '';
                    foreach ($paras as $p) {
                        $bul = !empty($o['bullet']) ? '<a:buClr><a:srgbClr val="' . ox_hex($o['bullet']) . '"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="●"/>' : '<a:buNone/>';
                        $ind = !empty($o['bullet']) ? ' marL="' . (int) round($size * 1.2 * $E) . '" indent="-' . (int) round($size * 1.2 * $E) . '"' : '';
                        $rtl = preg_match('/[\x{0600}-\x{06FF}]/u', (string) $p) || !preg_match('/[A-Za-z]/', (string) $p) ? '1' : '0';
                        $ps .= "<a:p><a:pPr algn=\"$algn\" rtl=\"$rtl\"$ind><a:lnSpc><a:spcPct val=\"$lh\"/></a:lnSpc><a:spcAft><a:spcPts val=\"" . (int) (($o['gap'] ?? 0) * 100) . "\"/></a:spcAft>$bul</a:pPr>"
                            . '<a:r><a:rPr lang="fa-IR" sz="' . (int) round($size * 100) . '"' . (!empty($o['bold']) ? ' b="1"' : '') . ' dirty="0"><a:solidFill><a:srgbClr val="' . ox_hex($col) . "\">$alpha</a:srgbClr></a:solidFill><a:latin typeface=\"$font\"/><a:cs typeface=\"$font\"/></a:rPr><a:t>" . ox_esc((string) $p) . '</a:t></a:r></a:p>';
                    }
                    $sp .= "<p:sp><p:nvSpPr><p:cNvPr id=\"$id\" name=\"Text $id\"/><p:cNvSpPr txBox=\"1\"/><p:nvPr/></p:nvSpPr><p:spPr>" . $xfrm($x, $y, $w, $h) . "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap=\"square\" lIns=\"0\" tIns=\"0\" rIns=\"0\" bIns=\"0\" anchor=\"$anchor\" rtlCol=\"1\"><a:normAutofit/></a:bodyPr><a:lstStyle/>$ps</p:txBody></p:sp>";
                    break;
            }
        }
        $bg = is_array($s['bg']) ? $grad($s['bg'][1], $s['bg'][2], 45) : $fill($s['bg']);
        $files["ppt/slides/slide$n.xml"] = OX_XML . '<p:sld ' . OX_NS . "><p:cSld><p:bg><p:bgPr>$bg<a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>$sp</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>";
        $files["ppt/slides/_rels/slide$n.xml.rels"] = OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . implode('', $rels) . '</Relationships>';
    }
    $count = count($slides);
    $ct = '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
        . '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        . '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
        . '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
        . '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
        . '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>'
        . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
    $sldIds = ''; $prels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>';
    for ($i = 1; $i <= $count; $i++) {
        $ct .= "<Override PartName=\"/ppt/slides/slide$i.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slide+xml\"/>";
        $sldIds .= '<p:sldId id="' . (255 + $i) . '" r:id="rId' . (3 + $i) . '"/>';
        $prels .= '<Relationship Id="rId' . (3 + $i) . "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide\" Target=\"slides/slide$i.xml\"/>";
    }
    $files['[Content_Types].xml'] = OX_XML . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' . $ct . '</Types>';
    $files['_rels/.rels'] = OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    $files['docProps/core.xml'] = OX_XML . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' . ox_esc($title) . '</dc:title><dc:creator>BEHIX Studio</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' . gmdate('Y-m-d\TH:i:s\Z') . '</dcterms:created></cp:coreProperties>';
    $files['docProps/app.xml'] = OX_XML . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BEHIX Studio</Application><Slides>' . $count . '</Slides></Properties>';
    $files['ppt/presentation.xml'] = OX_XML . '<p:presentation ' . OX_NS . ' rtl="1" saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' . $sldIds . '</p:sldIdLst><p:sldSz cx="' . (SLIDE_W * $E) . '" cy="' . (SLIDE_H * $E) . '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>';
    $files['ppt/_rels/presentation.xml.rels'] = OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $prels . '</Relationships>';
    $files['ppt/presProps.xml'] = OX_XML . '<p:presentationPr ' . OX_NS . '/>';
    $files['ppt/theme/theme1.xml'] = (string) file_get_contents(__DIR__ . '/pptx-theme.xml');
    $files['ppt/slideMasters/slideMaster1.xml'] = (string) file_get_contents(__DIR__ . '/pptx-master.xml');
    $files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>';
    $files['ppt/slideLayouts/slideLayout1.xml'] = OX_XML . '<p:sldLayout ' . OX_NS . ' preserve="1"><p:cSld name="BEHIX"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
    $files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>';
    return ox_zip($files + $media);
}

// ================================================================ DOCX
function docx_build(array $blocks, string $title = '', string $font = 'Tahoma'): string
{
    $font = ox_esc($font);
    $run = function (array $r, float $size, bool $forceBold = false) use ($font) {
        [$t, $bold, $color] = $r;
        $rtl = preg_match('/[\x{0600}-\x{06FF}]/u', $t) ? '<w:rtl/>' : '';
        $b = ($bold || $forceBold) ? '<w:b/><w:bCs/>' : '';
        $sz = (int) round($size * 2);
        $props = "<w:rPr><w:rFonts w:ascii=\"$font\" w:hAnsi=\"$font\" w:cs=\"$font\"/>$b<w:color w:val=\"" . ox_hex($color === '#a0a6b4' ? '#1f2430' : $color) . "\"/><w:sz w:val=\"$sz\"/><w:szCs w:val=\"$sz\"/>$rtl</w:rPr>";
        $parts = explode("\n", $t);
        $o = '';
        foreach ($parts as $i => $p) { if ($i) $o .= "<w:r>$props<w:br/></w:r>"; if ($p !== '') $o .= "<w:r>$props<w:t xml:space=\"preserve\">" . ox_esc($p) . '</w:t></w:r>'; }
        return $o;
    };
    $jc = fn ($a) => ['center' => '<w:jc w:val="center"/>', 'end' => '<w:jc w:val="right"/>'][$a] ?? '';
    $para = fn (string $runs, string $align = 'start', int $after = 120, int $before = 0, int $line = 360) => "<w:p><w:pPr><w:bidi/><w:spacing w:before=\"$before\" w:after=\"$after\" w:line=\"$line\" w:lineRule=\"auto\"/>" . $jc($align) . "</w:pPr>$runs</w:p>";
    $body = '';
    foreach ($blocks as $b) {
        $mt = (int) (($b['mt'] ?? 0) * 15);
        switch ($b['type']) {
            case 'h':
                $size = [1 => 18, 2 => 16, 3 => 12.5, 4 => 11.5][$b['level']] ?? 12;
                $body .= $para(implode('', array_map(fn ($r) => $run($r, $size, true), $b['runs'])), $b['align'], 160, max($mt, 120));
                break;
            case 'p':
                $body .= $para(implode('', array_map(fn ($r) => $run($r, 11), $b['runs'])), $b['align'], 120, $mt);
                break;
            case 'li':
                $mark = $b['n'] ? bx_fa($b['n']) . '. ' : '• ';
                $body .= $para($run([$mark, false, '#1f2430'], 11) . implode('', array_map(fn ($r) => $run($r, 11), $b['runs'])), 'start', 60);
                break;
            case 'hr':
                $body .= '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D1D5DB"/></w:pBdr></w:pPr></w:p>';
                break;
            case 'table':
                $cols = 0;
                foreach ($b['rows'] as $r) $cols = max($cols, array_sum(array_column($r, 'span')));
                $cw = (int) floor(9638 / max(1, $cols));
                $bd = $b['border'] ? 'single' : 'nil';
                $t = '<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' . implode('', array_map(fn ($s) => "<w:$s w:val=\"$bd\" w:sz=\"4\" w:space=\"0\" w:color=\"9CA3AF\"/>", ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'])) . '</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' . str_repeat("<w:gridCol w:w=\"$cw\"/>", $cols) . '</w:tblGrid>';
                foreach ($b['rows'] as $r) {
                    $t .= '<w:tr>';
                    foreach ($r as $cell) {
                        $span = $cell['span'] > 1 ? '<w:gridSpan w:val="' . $cell['span'] . '"/>' : '';
                        $shd = $cell['head'] ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : '';
                        $t .= '<w:tc><w:tcPr><w:tcW w:w="' . ($cw * $cell['span']) . "\" w:type=\"dxa\"/>$span$shd</w:tcPr>" . $para(implode('', array_map(fn ($rr) => $run($rr, 10.5, $cell['head']), $cell['runs'])) ?: '', $cell['head'] ? 'center' : $cell['align'], 0, 0, 300) . '</w:tc>';
                    }
                    $t .= '</w:tr>';
                }
                $body .= $t . '</w:tbl>' . $para('', 'start', 120);
                break;
        }
    }
    $doc = OX_XML . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' . $body
        . '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>';
    $styles = OX_XML . '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' . $font . '" w:hAnsi="' . $font . '" w:cs="' . $font . '"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="fa-IR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
    return ox_zip([
        '[Content_Types].xml' => OX_XML . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
        '_rels/.rels' => OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
        'word/_rels/document.xml.rels' => OX_XML . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'word/document.xml' => $doc,
        'word/styles.xml' => $styles,
        'docProps/core.xml' => OX_XML . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' . ox_esc($title) . '</dc:title><dc:creator>BEHIX Studio</dc:creator></cp:coreProperties>',
    ]);
}
