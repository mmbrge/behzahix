<?php
// BEHIX — default settings, catalog seed and optional demo data.
if (!defined('BX')) { http_response_code(403); exit; }

function default_settings(): array
{
    $cat = json_decode(file_get_contents(__DIR__ . '/catalog.json'), true);
    return [
        'general' => [
            'siteName' => 'BEHIX', 'siteNameFa' => 'بهیکس', 'tagline' => 'استودیو خلاقیت دیجیتال با هوش مصنوعی',
            'announcement' => '', 'announcementLink' => '', 'maintenance' => false,
            'maintenanceText' => 'در حال به‌روزرسانی سایت هستیم؛ به‌زودی برمی‌گردیم.', 'demoMode' => false,
        ],
        'contact' => [
            'phone' => '', 'phone2' => '', 'email' => '', 'address' => '',
            'hours' => 'شنبه تا پنجشنبه، ۹ تا ۱۹', 'whatsapp' => '', 'telegramId' => '',
        ],
        'socials' => [
            'instagram' => '', 'telegram' => '', 'whatsapp' => '', 'bale' => '',
            'linkedin' => '', 'youtube' => '', 'aparat' => '', 'x' => '',
        ],
        'home' => [
            'badge' => 'نسل جدید خلق ارزش دیجیتال با هوش مصنوعی',
            'title1' => 'تحول دیجیتال کسب‌وکار شما؛', 'title2' => 'از ایده تا اتوماسیون با',
            'lead' => 'ما در بهیکس، با ترکیب خلاقیت، فناوری و هوش مصنوعی به کسب‌وکار شما قدرت می‌دهیم تا سریع‌تر، هوشمندتر و حرفه‌ای‌تر رشد کند.',
            'cta' => 'شروع همکاری',
            'morphItems' => [
                ['word' => 'ایده', 'caption' => 'همه‌چیز از یک ایده شروع می‌شود'],
                ['word' => 'طراحی', 'caption' => 'ایده را به طراحی دیدنی و ماندگار تبدیل می‌کنیم'],
                ['word' => 'هوش مصنوعی', 'caption' => 'با هوش مصنوعی، سریع‌تر و هوشمندتر می‌سازیم'],
                ['word' => 'اتوماسیون', 'caption' => 'کارهای تکراری را به کد می‌سپاریم'],
                ['word' => 'BEHIX', 'caption' => 'از ایده تا اتوماسیون، کنار کسب‌وکار شما'],
            ],
            'morphIntro' => 'به بهیکس خوش آمدید؛ جایی که ایده‌ها جان می‌گیرند',
            'morphInterval' => 3.5,
            'packages' => [
                ['id' => 'site', 'title' => 'طراحی وب‌سایت شرکتی / فروشگاهی', 'price' => 18000000, 'days' => 14, 'selected' => true],
                ['id' => 'ai-pack', 'title' => 'بسته ۴ عددی تیزر هوش مصنوعی + لوگوموشن', 'price' => 9500000, 'days' => 7, 'selected' => true],
                ['id' => 'seo', 'title' => 'سئو و محتوای وبلاگ ماهانه', 'price' => 6000000, 'days' => 30, 'selected' => false],
                ['id' => 'infra', 'title' => 'ساخت سیستم ویندوزی و اتوماسیون دفتری', 'price' => 8000000, 'days' => 10, 'selected' => false],
            ],
            'bundle' => ['2' => 10, '3' => 15, '4' => 20],
        ],
        'seo' => [
            'title' => 'بهیکس | خلق ارزش دیجیتال با هوش مصنوعی',
            'description' => 'طراحی سایت، استودیو برندینگ، تولید محتوای هوش مصنوعی و اتوماسیون کسب‌وکار.',
            // Per page: one line each «page | title | description» (page = services, shop, portfolio, designers, about, tools, blog, order, terms)
            'pages' => [],
            'ogImage' => '', 'googleVerify' => '', 'bingVerify' => '', 'gaId' => '', 'headCode' => '',
            'orgType' => 'ProfessionalService', 'city' => 'تهران', 'priceRange' => '$$', 'noindex' => false,
        ],
        'legal' => [
            'terms' => default_terms(), 'privacy' => default_privacy(),
            'enamadCode' => '', 'samandehiCode' => '', 'extraBadgesCode' => '',
        ],
        'commission' => [
            'percent' => 20, 'newcomerEnabled' => true, 'newcomerPercent' => 10, 'newcomerUntil' => 5, 'minPayout' => 1000000,
        ],
        'orders' => [
            'deadlines' => $cat['deadlines'], 'addons' => $cat['addons'], 'styles' => $cat['styles'],
            'budgets' => ['هنوز مشخص نیست', 'کمتر از ۵ میلیون', '۵ تا ۱۵ میلیون', '۱۵ تا ۴۰ میلیون', 'بیش از ۴۰ میلیون'],
            'revisions' => 2, 'guestOrders' => true,
            // Staged payment: orders at or above stagedMin can start with a deposit
            'stagedEnabled' => true, 'stagedMin' => 5000000, 'stagedPercent' => 50,
        ],
        'payment' => ['driver' => 'test', 'merchant' => '', 'sandbox' => false, 'description' => 'پرداخت در بهیکس'],
        'sms' => ['driver' => 'none', 'apiKey' => '', 'template' => 'verify', 'templateId' => '', 'paramName' => 'CODE', 'adminPhone' => ''],
        // Event SMS: per event on/off and the provider template name (Kavenegar) or id (SMS.ir)
        'sms_events' => array_fill_keys(['order_new', 'order_quote', 'order_paid', 'order_review', 'order_due', 'order_done', 'shop_paid', 'cart_reminder', 'ticket_reply', 'referral_reward', 'designer_assigned', 'revision_requested', 'product_sold', 'payout_paid', 'admin_new_order', 'admin_support'], ['on' => false, 'template' => '']),
        'theme' => ['brand' => '#ff7a1a', 'brand2' => '#ffa24a', 'defaultTheme' => 'dark', 'cursor' => true],
        'uploads' => ['maxMB' => 50, 'ext' => 'jpg,jpeg,png,webp,gif,svg,pdf,zip,rar,7z,psd,ai,eps,pptx,ppt,docx,doc,xlsx,xls,mp4,mov,mp3,wav,aep,prproj,fig,txt'],
        'shop' => ['enabled' => true],
        // Invite-a-friend: both get wallet credit after the friend's first payment of at least minPurchase
        'referral' => ['enabled' => true, 'rewardInviter' => 50000, 'rewardFriend' => 30000, 'minPurchase' => 200000],
        // Abandoned cart: remind logged-in users by SMS after N hours
        'cart' => ['reminder' => true, 'hours' => 3],
        // Numbers shown on «about» and «designers»; one per line: value | label ({services} = live count)
        'about' => [
            'stats' => ['{services} | خدمت تخصصی', '۲ ساعت | پاسخ‌گویی در ساعات کاری', '۲ مرحله | اصلاح رایگان در هر سفارش', '۱۰۰٪ | پرداخت امن و شفاف'],
            'designerStats' => ['{share}٪ | سهم طراح از هر پروژه', 'هفتگی | تسویه درآمد', '{services} | نوع خدمت', 'اختصاصی | پنل مدیریت پروژه'],
        ],
        // Seller details printed on invoices (empty = taken from site name / contact)
        'invoice' => ['sellerName' => '', 'economicCode' => '', 'nationalId' => '', 'regNo' => '', 'address' => '', 'postalCode' => '', 'phone' => '', 'vatPercent' => 0, 'note' => ''],
        // Floating support: smart bot + live chat. faq: one per line «keyword, keyword | answer»
        'chat' => [
            'enabled' => true, 'botName' => 'دستیار بهیکس',
            'greeting' => 'سلام! من دستیار هوشمند بهیکس هستم 👋 درباره خدمات، قیمت، پیگیری سفارش، پرداخت و اقساط هر سؤالی دارید بپرسید.',
            'offline' => 'پیام شما به پشتیبانی رسید. در ساعات کاری معمولاً ظرف چند دقیقه پاسخ می‌دهیم و نتیجه را همین‌جا می‌بینید.',
            'faq' => [],
            'quickReplies' => ['سلام، وقت بخیر 🌹 چطور می‌تونم کمکتون کنم؟', 'چند لحظه صبر کنید، در حال بررسی هستم.', 'مشکل برطرف شد؟ اگر سؤال دیگری دارید در خدمتم.', 'ممنون از صبوری شما 🙏'],
            'smsAdmin' => true,
        ],
        'tools' => ['enabled' => true, 'disabled' => [], 'shortRequireLogin' => false, 'shortGuestDaily' => 10, 'blockedDomains' => []],
        // Installment (BNPL) gateways — each enabled after signing a merchant contract
        'bnpl_snapppay' => ['enabled' => false, 'label' => 'اسنپ‌پی', 'note' => '۴ قسط ماهانه، بدون کارمزد', 'installments' => 4, 'min' => 0, 'max' => 0,
            'apiUrl' => '', 'clientId' => '', 'clientSecret' => '', 'username' => '', 'password' => ''],
        'bnpl_digipay' => ['enabled' => false, 'label' => 'دیجی‌پی', 'note' => 'خرید اعتباری و اقساطی', 'installments' => 0, 'min' => 0, 'max' => 0,
            'apiUrl' => '', 'clientId' => '', 'clientSecret' => '', 'username' => '', 'password' => ''],
        'bnpl_azki' => ['enabled' => false, 'label' => 'ازکی وام', 'note' => 'خرید اقساطی با اعتبار ازکی', 'installments' => 0, 'min' => 0, 'max' => 0,
            'apiUrl' => '', 'merchantId' => '', 'key' => ''],
        'bnpl_torobpay' => ['enabled' => false, 'label' => 'ترب‌پی', 'note' => 'خرید اعتباری، پرداخت در اقساط', 'installments' => 4, 'min' => 0, 'max' => 0,
            'apiUrl' => '', 'clientId' => '', 'clientSecret' => '', 'username' => '', 'password' => ''],
    ];
}

// Settings safe to expose to every visitor
function public_settings(): array
{
    $s = settings();
    return [
        'general' => array_diff_key($s['general'], []),
        'contact' => $s['contact'],
        'socials' => $s['socials'],
        'home' => $s['home'],
        'about' => $s['about'],
        'referral' => $s['referral'],
        'seo' => ['title' => $s['seo']['title'], 'description' => $s['seo']['description']],
        'legal' => ['enamadCode' => $s['legal']['enamadCode'], 'samandehiCode' => $s['legal']['samandehiCode'], 'extraBadgesCode' => $s['legal']['extraBadgesCode']],
        'commission' => $s['commission'],
        'orders' => $s['orders'],
        'theme' => $s['theme'],
        'uploads' => ['maxMB' => (int) $s['uploads']['maxMB'], 'ext' => $s['uploads']['ext']],
        'shop' => $s['shop'],
        'chat' => ['enabled' => (bool) $s['chat']['enabled'], 'botName' => (string) $s['chat']['botName'], 'greeting' => (string) $s['chat']['greeting']],
        'tools' => ['enabled' => (bool) $s['tools']['enabled'], 'disabled' => array_values((array) $s['tools']['disabled']), 'shortRequireLogin' => (bool) $s['tools']['shortRequireLogin']],
        'sms' => ['enabled' => $s['sms']['driver'] !== 'none'],
        'payment' => ['driver' => $s['payment']['driver']],
        'bnpl' => array_values(array_filter(array_map(function ($id) use ($s) {
            $c = $s['bnpl_' . $id] ?? [];
            return empty($c['enabled']) ? null : ['id' => $id, 'label' => (string) $c['label'], 'note' => (string) $c['note'],
                'installments' => (int) $c['installments'], 'min' => (int) $c['min'], 'max' => (int) $c['max']];
        }, ['snapppay', 'digipay', 'azki', 'torobpay']))),
    ];
}

function default_terms(): string
{
    return <<<'HTML'
<h2>۱. کلیات</h2>
<p>استفاده از خدمات بهیکس به معنای پذیرش این قوانین است. بهیکس می‌تواند این قوانین را به‌روزرسانی کند و نسخه جدید از زمان انتشار معتبر است.</p>
<h2>۲. ثبت سفارش و پیش‌فاکتور</h2>
<p>قیمت نمایش‌داده‌شده هنگام ثبت سفارش تقریبی است. پیش‌فاکتور نهایی پس از بررسی بریف صادر می‌شود و کار پس از پرداخت آن آغاز می‌شود.</p>
<h2>۳. اصلاحات و تحویل</h2>
<p>هر سفارش شامل ۲ مرحله اصلاح رایگان است. پس از تأیید نهایی مشتری، سفارش تحویل‌شده محسوب می‌شود و فایل‌ها در پنل کاربری قابل دانلود است.</p>
<h2>۴. لغو و بازگشت وجه</h2>
<p>پیش از شروع کار، لغو سفارش با بازگشت کامل وجه امکان‌پذیر است. پس از شروع کار، مبلغ متناسب با پیشرفت پروژه کسر می‌شود.</p>
<h2>۵. مالکیت و حق استفاده</h2>
<p>پس از تسویه کامل، حق استفاده تجاری از طرح نهایی متعلق به مشتری است. نمونه‌کار ممکن است بدون اطلاعات محرمانه در سبد کاری بهیکس نمایش داده شود، مگر اینکه مشتری مخالفت کند.</p>
<h2>۶. طراحان و فروشندگان</h2>
<p>طراحان و فروشندگان متعهد به ارائه آثار اصیل و رعایت حقوق مالکیت فکری هستند. کارمزد پلتفرم مطابق تنظیمات اعلام‌شده در پنل از هر پروژه یا فروش کسر می‌شود.</p>
<h2>۷. فروشگاه فایل</h2>
<p>فایل‌های خریداری‌شده برای استفاده در پروژه‌های خریدار مجاز است و بازفروش یا انتشار عمومی آن‌ها ممنوع است.</p>
HTML;
}

function default_privacy(): string
{
    return <<<'HTML'
<h2>حریم خصوصی کاربران</h2>
<p>بهیکس اطلاعات شما (نام، شماره موبایل، ایمیل و فایل‌های پروژه) را فقط برای ارائه خدمات، پشتیبانی و ارسال اطلاع‌رسانی‌های ضروری استفاده می‌کند و آن را در اختیار شخص ثالث قرار نمی‌دهد، مگر به حکم قانون.</p>
<p>فایل‌های پروژه فقط برای شما، طراح مسئول و مدیران بهیکس قابل دسترسی است. پرداخت‌ها از طریق درگاه‌های بانکی دارای مجوز انجام می‌شود و اطلاعات کارت شما نزد بهیکس ذخیره نمی‌شود.</p>
HTML;
}

// ------------------------------------------------------------------ seeding
function seed_catalog(): void
{
    $cat = json_decode(file_get_contents(__DIR__ . '/catalog.json'), true);
    foreach ($cat['catalog'] as $c) {
        q('REPLACE INTO categories (id, title, en, icon, hue, descr, sort, active) VALUES (?,?,?,?,?,?,?,1)',
            [$c['id'], $c['title'], $c['en'], $c['icon'], $c['hue'], $c['desc'], $c['sort']]);
        foreach ($c['services'] as $s) {
            q('REPLACE INTO services (id, category_id, title, icon, base, days, descr, fields, sort, active) VALUES (?,?,?,?,?,?,?,?,?,1)',
                [$s['id'], $c['id'], $s['title'], $s['icon'], $s['base'], $s['days'], $s['desc'], jenc($s['fields']), $s['sort']]);
        }
    }
    foreach ($cat['productCategories'] as $i => $pc) {
        q('REPLACE INTO product_categories (id, title, icon, sort) VALUES (?,?,?,?)', [$pc['id'], $pc['title'], $pc['icon'], $i]);
    }
}

// Sample users, orders and products so every panel has something to show.
// All demo accounts use password 1234 and can be removed from the admin panel.
function seed_demo(int $adminId): void
{
    $ago = function ($d, $h = 0) { return gmdate('Y-m-d H:i:s', time() - $d * 86400 - $h * 3600); };
    $pass = password_hash('1234', PASSWORD_DEFAULT);
    $mk = function (array $u) use ($pass, $ago) {
        return insert('users', array_merge([
            'password_hash' => $pass, 'status' => 'active', 'is_demo' => 1, 'wallet' => 0, 'rating' => 0, 'hue' => 25,
        ], $u, ['created_at' => $ago($u['created_at'] ?? 30)]));
    };
    $U = [];
    $U['u1'] = $mk(['name' => 'سارا محمدی', 'phone' => '09121111111', 'role' => 'customer', 'email' => 'sara@example.com', 'business' => 'کافه نارنج', 'wallet' => 2500000, 'hue' => 330, 'created_at' => 60]);
    $U['u2'] = $mk(['name' => 'علی رضایی', 'phone' => '09124444444', 'role' => 'customer', 'business' => 'فروشگاه کتاب نو', 'hue' => 199, 'created_at' => 25]);
    $U['d1'] = $mk(['name' => 'نیما کریمی', 'phone' => '09122222222', 'role' => 'designer', 'skills' => jenc(['logo', 'poster', 'social', 'packaging', 'ai-art']), 'bio' => 'طراح هویت بصری با ۸ سال تجربه', 'rating' => 4.9, 'level' => 'طراح ارشد', 'wallet' => 18400000, 'hue' => 265, 'created_at' => 150]);
    $U['d2'] = $mk(['name' => 'الهام نوری', 'phone' => '09126666666', 'role' => 'designer', 'skills' => jenc(['ai-teaser', 'motion', 'edit', 'reels', 'lipsync']), 'bio' => 'موشن‌دیزاینر و متخصص ویدیوی AI', 'rating' => 4.8, 'level' => 'طراح ارشد', 'wallet' => 9600000, 'hue' => 330, 'created_at' => 120]);
    $U['d3'] = $mk(['name' => 'امیر حسینی', 'phone' => '09127777777', 'role' => 'designer', 'skills' => jenc(['landing', 'corporate', 'shop', 'uiux', 'seo', 'chatbot']), 'bio' => 'توسعه‌دهنده فرانت‌اند و طراح UI', 'rating' => 4.7, 'level' => 'طراح', 'wallet' => 22000000, 'hue' => 25, 'created_at' => 90]);
    $U['d4'] = $mk(['name' => 'پریسا مرادی', 'phone' => '09128888888', 'role' => 'designer', 'status' => 'pending', 'skills' => jenc(['pptx', 'resume', 'docs', 'excel']), 'bio' => 'طراح ارائه و اینفوگرافیک', 'level' => 'تازه‌وارد', 'portfolio_url' => 'https://behance.net/example', 'hue' => 199, 'created_at' => 1]);
    $U['s1'] = $mk(['name' => 'استودیو پیکسل', 'phone' => '09123333333', 'role' => 'seller', 'shop_name' => 'استودیو پیکسل', 'bio' => 'قالب‌های آماده پاورپوینت و رزومه', 'rating' => 4.6, 'wallet' => 7300000, 'hue' => 45, 'created_at' => 100]);
    $U['s2'] = $mk(['name' => 'موشن‌لب', 'phone' => '09129999999', 'role' => 'seller', 'shop_name' => 'موشن‌لب', 'bio' => 'پک‌های موشن و ترنزیشن', 'rating' => 4.8, 'wallet' => 4100000, 'hue' => 300, 'created_at' => 80]);
    $U['s3'] = $mk(['name' => 'فونت‌خانه', 'phone' => '09121212121', 'role' => 'seller', 'status' => 'pending', 'shop_name' => 'فونت‌خانه', 'hue' => 180, 'created_at' => 2]);

    $order = function (array $o) use ($U, $ago) {
        $events = $o['events'] ?? [['new', $o['ago']]];
        $msgs = $o['msgs'] ?? [];
        $id = insert('orders', [
            'code' => $o['code'], 'user_id' => $U[$o['user']], 'service_id' => $o['service'], 'title' => $o['title'], 'status' => $o['status'],
            'designer_id' => isset($o['designer']) ? $U[$o['designer']] : null, 'estimate' => $o['estimate'], 'quote' => $o['quote'] ?? null,
            'deadline' => $o['deadline'] ?? 'normal', 'addons' => '[]', 'budget' => 'هنوز مشخص نیست', 'details' => jenc($o['details']),
            'style' => jenc($o['style'] ?? []), 'contact' => '{}', 'paid' => $o['paid'] ?? 1, 'rating' => $o['rating'] ?? null, 'applicants' => '[]',
            'descr' => $o['desc'] ?? null, 'created_at' => $ago($o['ago']),
        ]);
        foreach ($events as $e) insert('order_events', ['order_id' => $id, 'status' => $e[0], 'created_at' => $ago($e[1], $e[2] ?? 0)]);
        foreach ($msgs as $m) insert('order_messages', ['order_id' => $id, 'user_id' => $U[$m[0]], 'body' => $m[1], 'created_at' => $ago($m[2])]);
        foreach ($o['deliver'] ?? [] as $f) insert('files', ['owner_id' => $U[$o['designer']], 'kind' => 'deliverable', 'ref_id' => $id, 'name' => $f, 'path' => '', 'size' => 0, 'created_at' => $ago(1)]);
        return $id;
    };
    $order(['code' => 'BX-1042', 'user' => 'u1', 'service' => 'logo', 'title' => 'لوگو و هویت بصری — کافه نارنج', 'status' => 'awaiting', 'designer' => 'd1', 'estimate' => 7600000, 'ago' => 9,
        'details' => ['brand' => 'کافه نارنج', 'type' => 'combo', 'concepts' => '3', 'extras' => ['guide', 'card']], 'style' => ['styles' => ['مینیمال', 'فان و شاد'], 'colors' => ['#ff7a1a', '#1e293b']],
        'events' => [['new', 9], ['review', 8, 20], ['in_progress', 8], ['awaiting', 1]], 'deliver' => ['logo-concepts-v1.pdf'],
        'msgs' => [['u1', 'سلام، رنگ نارنجی برای ما خیلی مهمه 🙏', 8], ['d1', 'حتماً، سه کانسپت با تم نارنجی آماده کردم. لطفاً بررسی کنید.', 1]]]);
    $order(['code' => 'BX-1043', 'user' => 'u1', 'service' => 'social', 'title' => 'پک پست اینستاگرام — مهر', 'status' => 'in_progress', 'designer' => 'd1', 'estimate' => 3800000, 'deadline' => 'fast', 'ago' => 4,
        'details' => ['posts' => 12, 'stories' => 10, 'extras' => ['caption'], 'page' => '@narenj.cafe'], 'events' => [['new', 4], ['review', 3, 12], ['in_progress', 3]]]);
    $order(['code' => 'BX-1038', 'user' => 'u1', 'service' => 'landing', 'title' => 'لندینگ منوی آنلاین', 'status' => 'done', 'designer' => 'd3', 'estimate' => 8900000, 'ago' => 40, 'rating' => 5,
        'details' => ['goal' => 'sell', 'sections' => 7, 'features' => ['form', 'crm']], 'events' => [['new', 40], ['review', 39], ['in_progress', 38], ['awaiting', 31], ['done', 30]], 'deliver' => ['landing-final.zip']]);
    $order(['code' => 'BX-1044', 'user' => 'u2', 'service' => 'ai-teaser', 'title' => 'تیزر AI معرفی فروشگاه کتاب', 'status' => 'review', 'estimate' => 6200000, 'quote' => 6000000, 'deadline' => 'urgent', 'ago' => 0, 'paid' => 0,
        'details' => ['duration' => '30', 'ratio' => ['916'], 'voice' => 'ai', 'script' => 'write'], 'events' => [['new', 0, 5], ['review', 0, 3]]]);
    $order(['code' => 'BX-1045', 'user' => 'u2', 'service' => 'pptx', 'title' => 'پیچ‌دک جذب سرمایه', 'status' => 'new', 'estimate' => 4100000, 'ago' => 0, 'paid' => 0,
        'details' => ['purpose' => 'pitch', 'slides' => 15, 'content' => 'edit', 'extras' => ['info']]]);
    $order(['code' => 'BX-1040', 'user' => 'u1', 'service' => 'reels', 'title' => 'ریلز ماهانه کافه', 'status' => 'revision', 'designer' => 'd2', 'estimate' => 4400000, 'ago' => 14,
        'details' => ['count' => 6, 'platform' => ['ig'], 'source' => 'client'], 'events' => [['new', 14], ['in_progress', 13], ['awaiting', 5], ['revision', 4]], 'deliver' => ['reels-v1.zip']]);

    $P = [];
    $prod = function ($seller, $title, $cat, $price, $disc, $sales, $rating, $status, $tags, $d) use ($U, $ago, &$P) {
        $P[] = insert('products', ['seller_id' => $U[$seller], 'title' => $title, 'category_id' => $cat, 'price' => $price, 'discount' => $disc, 'sales' => $sales,
            'rating' => $rating, 'status' => $status, 'tags' => jenc($tags), 'descr' => '', 'created_at' => $ago($d)]);
    };
    $prod('s1', 'قالب پاورپوینت پیچ‌دک استارتاپی', 'pptx-tpl', 490000, 20, 132, 4.8, 'active', ['پیچ‌دک', 'استارتاپ'], 70);
    $prod('s1', 'قالب رزومه مدرن دوزبانه', 'resume-tpl', 190000, 0, 340, 4.7, 'active', ['رزومه', 'ATS'], 65);
    $prod('s2', 'پک ۱۲۰ ترنزیشن پریمیر', 'motion-pack', 650000, 30, 88, 4.9, 'active', ['پریمیر', 'ترنزیشن'], 50);
    $prod('s2', 'لوگوموشن افترافکت — ۱۰ سبک', 'motion-pack', 420000, 0, 61, 4.6, 'active', ['افترافکت', 'لوگو'], 40);
    $prod('s1', 'پک ۵۰ پست اینستاگرام کافه و رستوران', 'social-pack', 350000, 15, 205, 4.8, 'active', ['اینستاگرام', 'کافه'], 35);
    $prod('s1', 'قالب لندینگ HTML محصول دیجیتال', 'web-tpl', 890000, 0, 47, 4.5, 'active', ['HTML', 'لندینگ'], 30);
    $prod('s2', '۳۰۰ آیکن خطی فارسی‌پسند', 'assets', 250000, 10, 150, 4.7, 'active', ['آیکن', 'SVG'], 20);
    $prod('s1', 'ماکاپ بسته‌بندی قهوه', 'assets', 180000, 0, 0, 0, 'pending', ['ماکاپ'], 1);

    $works = [['لوگو کافه نارنج', 'image', 'logo', 'd1'], ['هویت بصری کلینیک لبخند', 'image', 'logo', 'd1'], ['پوستر جشنواره پاییز', 'image', 'poster', 'd1'],
        ['بسته‌بندی عسل کوهستان', 'image', 'packaging', 'd1'], ['تیزر AI لوازم آرایشی', 'video', 'ai-teaser', 'd2'], ['موشن معرفی اپ پرداخت', 'video', 'motion', 'd2'],
        ['ریلز رستوران سنتی', 'video', 'reels', 'd2'], ['فروشگاه آنلاین پوشاک', 'web', 'shop', 'd3'], ['لندینگ دوره آموزشی', 'web', 'landing', 'd3'],
        ['UI اپ رزرو نوبت', 'web', 'uiux', 'd3'], ['چت‌بات پشتیبانی بیمه', 'ai', 'chatbot', 'd3'], ['تصویرسازی کتاب کودک', 'image', 'ai-art', 'd1']];
    foreach ($works as $i => $w) {
        insert('portfolio', ['designer_id' => $U[$w[3]], 'title' => $w[0], 'category_id' => $w[1], 'service_id' => $w[2], 'likes' => 20 + ($i * 37) % 180, 'created_at' => $ago(5 + $i * 6)]);
    }

    $t = function ($u, $type, $amount, $note, $d) use ($U, $ago) {
        insert('transactions', ['user_id' => $U[$u], 'type' => $type, 'amount' => $amount, 'note' => $note, 'status' => 'ok', 'created_at' => $ago($d)]);
    };
    $t('u1', 'charge', 5000000, 'شارژ کیف پول', 20);
    $t('u1', 'payment', -8900000, 'پرداخت BX-1038', 38);
    $t('u1', 'payment', -7600000, 'پرداخت BX-1042', 8);
    $t('u1', 'payment', -4400000, 'پرداخت BX-1040', 13);
    $t('d3', 'earning', 7120000, 'درآمد BX-1038', 30);
    $t('s1', 'sale', 297500, 'فروش پک پست اینستاگرام', 6);
    $t('u1', 'purchase', -297500, 'خرید پک پست اینستاگرام', 6);
    insert('purchases', ['user_id' => $U['u1'], 'product_id' => $P[4], 'price' => 297500, 'created_at' => $ago(6)]);
    insert('payouts', ['user_id' => $U['d3'], 'amount' => 10000000, 'card' => 'IR000000000000000000001234', 'status' => 'pending', 'created_at' => $ago(1)]);
    insert('tickets', ['user_id' => $U['u2'], 'name' => 'علی رضایی', 'phone' => '09124444444', 'subject' => 'سوال درباره زمان تحویل', 'message' => 'سلام، تیزر رو تا آخر هفته می‌تونید تحویل بدید؟', 'status' => 'open', 'created_at' => $ago(0, 3)]);
    insert('tickets', ['user_id' => null, 'name' => 'حسین جعفری', 'phone' => '09130000000', 'subject' => 'همکاری سازمانی', 'message' => 'برای ۲۰ دفتر نیاز به اتوماسیون داریم.', 'status' => 'open', 'created_at' => $ago(2)]);
    q("REPLACE INTO coupons (code, percent, uses, max_uses, active, owner_id) VALUES ('WELCOME10', 10, 34, 100, 1, NULL), ('MEHR25', 25, 8, 50, 1, NULL)");
    q('REPLACE INTO coupons (code, percent, uses, max_uses, active, owner_id) VALUES (?, 15, 12, 0, 1, ?)', ['PIXEL15', $U['s1']]);
    q('INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?), (?, ?)', [$U['u1'], $P[0], $U['u1'], $P[2]]);
    notify($U['u1'], 'طرح‌های اولیه لوگو آماده بررسی است.', 'orders');
    notify($U['d1'], 'سفارش جدید پک پست اینستاگرام به شما واگذار شد.', 'projects');
    notify($adminId, 'به پنل مدیریت بهیکس خوش آمدید! از «تنظیمات سایت» شروع کنید.', 'settings');
}
