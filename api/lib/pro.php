<?php
// BEHIX — «X PRO» membership: plans, purchase (wallet or gateway), the PRO badge
// data, monthly studio-file allowance and weekly limits of the premium tools.
if (!defined('BX')) { http_response_code(403); exit; }

const PRO_TOOLS = ['seo' => 'بررسی سئوی سایت', 'short' => 'کوتاه‌کننده لینک', 'names' => 'ایده نام برند', 'favicon' => 'ساخت فاوآیکن'];

function pro_cfg(): array { return setting('pro'); }
function pro_plans(): array
{
    return array_values(array_filter(array_map(function ($p) {
        if (!is_array($p) || empty($p['id'])) return null;
        return ['id' => (string) $p['id'], 'title' => (string) ($p['title'] ?? ''), 'months' => max(1, (int) ($p['months'] ?? 1)), 'price' => max(0, (int) ($p['price'] ?? 0)),
            'business' => !empty($p['business']), 'old' => max(0, (int) ($p['old'] ?? 0)), 'note' => (string) ($p['note'] ?? '')];
    }, (array) (pro_cfg()['plans'] ?? []))));
}
// Membership state of a user row
function pro_info(?array $u): array
{
    if (!$u || empty($u['pro_until'])) return ['active' => false];
    $until = strtotime($u['pro_until'] . ' UTC');
    if ($until <= time()) return ['active' => false, 'expired' => ms($u['pro_until'])];
    return ['active' => true, 'until' => ms($u['pro_until']), 'business' => (bool) ($u['pro_biz'] ?? 0), 'name' => (string) (pro_cfg()['name'] ?? 'X PRO'),
        'days' => (int) ceil(($until - time()) / 86400)];
}
function pro_active(?array $u, bool $business = false): bool
{
    if ($u && $u['role'] === 'admin') return true;
    $p = pro_info($u);
    return $p['active'] && (!$business || $p['business']);
}
// Extend (or start) a membership by $months
function pro_extend(int $uid, int $months, bool $business): void
{
    $u = row('SELECT pro_until, pro_biz FROM users WHERE id = ?', [$uid]);
    $from = ($u && $u['pro_until'] && strtotime($u['pro_until'] . ' UTC') > time()) ? strtotime($u['pro_until'] . ' UTC') : time();
    $until = gmdate('Y-m-d H:i:s', strtotime("+{$months} month", $from));
    update('users', ['pro_until' => $until, 'pro_biz' => ($business || !empty($u['pro_biz']) && $from > time()) ? 1 : 0], 'id = ?', [$uid]);
    notify($uid, 'اشتراک ' . (pro_cfg()['name'] ?? 'X PRO') . ($business ? ' Business' : '') . ' شما فعال شد؛ از امکانات ویژه لذت ببرید.', 'dashboard.html#pro');
}

// ------------------------------------------------------------------ usage & quotas
function usage_add(string $k, ?int $uid): void
{
    insert('usage_log', ['user_id' => $uid, 'ip' => function_exists('client_ip') ? client_ip() : ($_SERVER['REMOTE_ADDR'] ?? ''), 'k' => $k, 'at' => now()]);
}
function usage_count(string $k, ?int $uid, int $days): int
{
    $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);
    if ($uid) return (int) val('SELECT COUNT(*) FROM usage_log WHERE k = ? AND user_id = ? AND at > ?', [$k, $uid, $since]);
    $ip = function_exists('client_ip') ? client_ip() : ($_SERVER['REMOTE_ADDR'] ?? '');
    return (int) val('SELECT COUNT(*) FROM usage_log WHERE k = ? AND ip = ? AND at > ?', [$k, $ip, $since]);
}
// Weekly limit of a premium tool: free users get a few uses, PRO members many more
function tool_quota(string $tool): array
{
    $c = pro_cfg();
    $u = me();
    $pro = pro_active($u);
    $limit = (int) (($pro ? $c['proQuota'] : $c['freeQuota'])[$tool] ?? 0);
    $used = usage_count('tool:' . $tool, $u ? (int) $u['id'] : null, 7);
    return ['tool' => $tool, 'limit' => $limit, 'used' => $used, 'left' => $limit > 0 ? max(0, $limit - $used) : -1, 'pro' => $pro];
}
function tool_use(string $tool): void
{
    if (empty(pro_cfg()['enabled'])) return;
    $q = tool_quota($tool);
    if ($q['limit'] > 0 && $q['used'] >= $q['limit']) {
        $name = pro_cfg()['name'] ?? 'X PRO';
        fail($q['pro'] ? 'سقف استفاده هفتگی شما از این ابزار پر شده است؛ هفته بعد دوباره تلاش کنید.'
            : 'سهمیه رایگان این هفته شما از «' . (PRO_TOOLS[$tool] ?? $tool) . '» تمام شد. با اشتراک ' . $name . ' استفاده تقریباً نامحدود دارید.', 402, 'quota');
    }
    $u = me();
    usage_add('tool:' . $tool, $u ? (int) $u['id'] : null);
}
// Studio files left this month for a PRO member
function pro_studio_left(array $u): int
{
    $c = pro_cfg();
    $lim = (int) (pro_info($u)['business'] ?? false ? $c['studioFilesBiz'] : $c['studioFiles']);
    return max(0, $lim - usage_count('studio-file', (int) $u['id'], 30));
}

// ------------------------------------------------------------------ routes
function r_pro_info(): void
{
    $c = pro_cfg();
    $u = me();
    $quotas = [];
    foreach (PRO_TOOLS as $k => $t) $quotas[$k] = tool_quota($k) + ['title' => $t, 'free' => (int) ($c['freeQuota'][$k] ?? 0), 'proLimit' => (int) ($c['proQuota'][$k] ?? 0)];
    out(['enabled' => !empty($c['enabled']), 'name' => (string) $c['name'], 'plans' => pro_plans(), 'me' => pro_info($u),
        'studioFiles' => (int) $c['studioFiles'], 'studioFilesBiz' => (int) $c['studioFilesBiz'], 'discount' => (int) $c['discount'],
        'studioLeft' => $u && pro_active($u) ? pro_studio_left($u) : null, 'quotas' => $quotas]);
}
function r_tools_quota(): void
{
    $t = str_in('tool', 20);
    if (!isset(PRO_TOOLS[$t])) fail('ابزار نامعتبر است.', 422);
    out(tool_quota($t));
}
// Client-side tools with a weekly allowance register each use here
function r_tools_use(): void
{
    $t = str_in('tool', 20);
    if (!isset(PRO_TOOLS[$t]) || in_array($t, ['seo', 'short', 'names'], true)) fail('ابزار نامعتبر است.', 422);
    rate_limit('tool-use', 60, 600);
    tool_use($t);
    out(tool_quota($t));
}
function a_pro_buy(): void
{
    $u = require_user();
    if (empty(pro_cfg()['enabled'])) fail('فروش اشتراک فعلاً غیرفعال است.', 403);
    $plan = null;
    foreach (pro_plans() as $p) if ($p['id'] === str_in('plan', 16)) $plan = $p;
    if (!$plan || $plan['price'] <= 0) fail('طرح اشتراک نامعتبر است.', 422);
    $wallet = (int) val('SELECT wallet FROM users WHERE id = ?', [$u['id']]);
    if ($wallet >= $plan['price']) {
        db()->beginTransaction();
        q('UPDATE users SET wallet = wallet - ? WHERE id = ?', [$plan['price'], $u['id']]);
        tx((int) $u['id'], 'purchase', -$plan['price'], 'اشتراک ' . $plan['title']);
        pro_extend((int) $u['id'], $plan['months'], $plan['business']);
        db()->commit();
        notify_admins('اشتراک جدید: ' . $plan['title'] . ' — ' . $u['name'], 'dashboard.html#users');
        out(['done' => true, 'pro' => pro_info(row('SELECT * FROM users WHERE id = ?', [$u['id']]))]);
    }
    require_once __DIR__ . '/gateways.php';
    $url = payment_start((int) $u['id'], 'pro', ['plan' => $plan['id']], $plan['price'] - max(0, $wallet), 'اشتراک ' . $plan['title'], str_in('method', 16));
    out(['redirect' => $url]);
}
// Called by payment_apply after the gateway confirms
function pro_apply_payment(int $uid, int $amount, array $ref): string
{
    wallet_add($uid, $amount);
    tx($uid, 'charge', $amount, 'پرداخت آنلاین');
    foreach (pro_plans() as $p) if ($p['id'] === ($ref['plan'] ?? '')) {
        q('UPDATE users SET wallet = wallet - ? WHERE id = ?', [$p['price'], $uid]);
        tx($uid, 'purchase', -$p['price'], 'اشتراک ' . $p['title']);
        pro_extend($uid, $p['months'], $p['business']);
        notify_admins('اشتراک جدید: ' . $p['title'], 'dashboard.html#users');
        return 'اشتراک ' . $p['title'] . ' فعال شد.';
    }
    return 'پرداخت انجام شد و مبلغ به کیف پول شما اضافه شد.';
}
// Admin: grant / extend / cancel a membership by hand
function a_pro_grant(): void
{
    require_user('admin');
    $id = int_in('userId');
    if (!$id && str_in('phone', 20) !== '') $id = (int) val('SELECT id FROM users WHERE phone = ?', [phone_in('phone')]);
    if (!$id || !row('SELECT id FROM users WHERE id = ?', [$id])) fail('کاربری با این مشخصات پیدا نشد.', 404);
    $months = int_in('months');
    if ($months <= 0) { update('users', ['pro_until' => null, 'pro_biz' => 0], 'id = ?', [$id]); done('اشتراک کاربر لغو شد.'); }
    pro_extend($id, min(36, $months), (bool) in('business', false));
    done('اشتراک کاربر فعال شد.');
}
function a_pro_members(): void
{
    require_user('admin');
    $rows = rows('SELECT id, name, phone, pro_until, pro_biz FROM users WHERE pro_until IS NOT NULL AND pro_until > UTC_TIMESTAMP() ORDER BY pro_until DESC LIMIT 300');
    $since = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
    out(['members' => array_map(fn ($r) => ['id' => (int) $r['id'], 'name' => $r['name'], 'phone' => $r['phone'], 'until' => ms($r['pro_until']), 'business' => (bool) $r['pro_biz']], $rows),
        'revenue30' => (int) -val("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type = 'purchase' AND note IN (" . implode(',', array_fill(0, max(1, count(pro_plans())), '?')) . ") AND created_at > ?",
            array_merge(array_map(fn ($p) => 'اشتراک ' . $p['title'], pro_plans()) ?: [''], [$since])),
        'usage' => rows("SELECT k, COUNT(*) n FROM usage_log WHERE at > ? GROUP BY k ORDER BY n DESC", [$since])]);
}
