/**
 * Created by shilovda on 11.10.13.
 */

var path = require('path');
var fs = require('fs');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var getMeta = require(path.join(path.resolve('node_modules'), 'grunt-wsmod-packer/lib/getDependencyMeta.js'));
var cssHelpers = require(path.join(path.resolve('node_modules'), 'grunt-wsmod-packer/lib/cssHelpers.js'));
var resolveUrl = cssHelpers.rebaseUrls;
var bumpImportsUp = cssHelpers.bumpImportsUp;
var dblSlashes = /\\/g;
var isWS = /^\.\.\/ws/;

(function () {

    "use strict";

    var ISO639 = {
        aa: "Afaraf",                //Афарский
        ab: "аҧсшәа",                //Абхазский
        ae: "avesta",                //Авестийский
        af: "Afrikaans",             //Африкаанс
        ak: "Akan",                  //Акан
        am: "አማርኛ",                  //Амхарский
        an: "aragonés",              //Арагонский
        ar: "ةيبرعلا",               //Арабский
        as: "অসমীয়া",                 //Ассамский
        av: "авар мацӀ",             //Аварский
        ay: "aymar aru",             //Аймара
        az: "azərbaycan dili",       //Азербайджанский
        ba: "башҡорт теле",          //Башкирский
        be: "беларуская мова",       //Белорусский
        bg: "български език",        //Болгарский
        bh: "भोजपुरी",                 //Бихари
        bi: "Bislama",               //Бислама
        bm: "bamanankan",            //Бамбара
        bn: "বাংলা",                  //Бенгальский
        bo: "བོད་ཡིག",               //Тибетский
        br: "brezhoneg",             //Breton
        bs: "bosanski jezik",        //Боснийский
        ca: "català",                //Каталанский
        ce: "нохчийн мотт",          //Чеченский
        ch: "Chamoru",               //Чаморро
        co: "corsu",                 //Корсиканский
        cr: "ᓀᐦᐃᔭᐍᐏᐣ",               //Крик
        cs: "český jazyk",           //Чешский
        cv: "чӑваш чӗлхи",           //Чувашский
        cy: "Cymraeg",               //Валлийский
        da: "dansk",                 //Датский
        de: "Deutsch",               //Немецкий
        dv: "ދިވެހި",                   //Дивехи
        dz: "རྫོང་ཁ",                //Дзонг-кэ
        ee: "Eʋegbe",                //Эве
        el: "ελληνικά",              //Греческий
        en: "English",               //Английский
        eo: "Esperanto",             //Эсперанто
        es: "español",               //Испанский
        et: "eesti keel",            //Эстонский
        eu: "euskara",               //Баскский
        fa: "فارسی",                 //Персидский
        ff: "Fulfulde",              //Фулах
        fi: "suomen kieli",          //Финский
        fj: "vosa Vakaviti",         //Фиджи
        fo: "føroyskt",              //Фарерский
        fr: "français",              //Французский
        fy: "Frysk",                 //Фризский
        ga: "Gaeilge",               //Ирландский
        gd: "Gàidhlig",              //Гэльский
        gl: "galego",                //Галисийский
        gn: "Avañe'ẽ",               //Гуарани
        gu: "ગુજરાતી",                 //Гуджарати
        gv: "Gaelg",                 //Мэнский
        ha: "هَوُسَ",                //Хауса
        he: "עברית",                 //Иврит
        hi: "हिन्दी",                  //Хинди
        ho: "Hiri Motu",             //Хиримоту
        hr: "hrvatski jezik",        //Хорватский
        ht: "Kreyòl ayisyen",        //Haitian
        hu: "magyar",                //Венгерский
        hy: "Հայերեն",                //Армянский
        hz: "Otjiherero",            //Гереро
        ia: "Interlingua",           //Интерлингва
        id: "Bahasa Indonesia",      //Индонезийский
        ie: "Interlingue",           //Интерлингве
        ig: "Asụsụ Igbo",            //Игбо
        ii: "Nuosuhxop",             //Сычуань
        ik: "Iñupiaq",               //Инупиак
        io: "Ido",                   //Идо
        is: "Íslenska",              //Исландский
        it: "italiano",              //Итальянский
        iu: "ᐃᓄᒃᑎᑐᑦ",               //Инуктитут
        ja: "日本語",                 //Японский
        jv: "basa Jawa",             //Яванский
        ka: "ქართული",              //Грузинский
        kg: "KiKongo",               //Конго
        ki: "Gĩkũyũ",                //Кикуйю
        kj: "Kuanyama",              //Киньяма
        kk: "қазақ тілі",            //Казахский
        kl: "kalaallisut",           //Гренландский
        km: "ខ្មែរ",                    //Кхмерский
        kn: "ಕನ್ನಡ",                 //Каннада
        ko: "한국어",                 //Корейский
        kr: "Kanuri",                //Канури
        ks: "कश्मीरी",                 //Кашмири
        ku: "Kurdî",                 //Курдский
        kv: "коми кыв",              //Коми
        kw: "Kernewek",              //Корнский
        ky: "Кыргыз тили",           //Киргизский
        la: "latine",                //Латинский
        lb: "Lëtzebuergesch",        //Люксембургский
        lg: "Luganda",               //Ганда
        li: "Limburgs",              //Limburgan
        ln: "Lingála",               //Лингала
        lo: "ພາສາລາວ",              //Лаосский
        lt: "lietuvių kalba",        //Литовский
        lu: "Tshiluba",              //Луба-катанга
        lv: "latviešu valoda",       //Латышский
        mg: "fiteny malagasy",       //Малагасийский
        mh: "Kajin M̧ajeļ",          //Маршалльский
        mi: "te reo Māori",          //Маори
        mk: "македонски јазик",      //Македонский
        ml: "മലയാളം",               //Малаялам
        mn: "монгол",                //Монгольский
        mr: "मराठी",                  //Маратхи
        ms: "bahasa Melayu",         //Малайский
        mt: "Malti",                 //Мальтийский
        my: "ဗမာစာ",                 //Бирманский
        na: "Ekakairũ Naoero",       //Науру
        nb: "Norsk bokmål",          //Норвежский‬ книжный
        nd: "isiNdebele",            //Ндебеле северный
        ne: "नेपाली",                  //Непальский
        ng: "Owambo",                //Ндунга
        nl: "Nederlands",            //Нидерландский
        nn: "Norsk nynorsk",         //Нюнорск (Норвежский новый)
        no: "Norsk",                 //Норвежский‬
        nr: "isiNdebele",            //Ндебеле южный
        nv: "Diné bizaad",           //Навахо
        ny: "chiCheŵa",              //Ньянджа
        oc: "occitan",               //Окситанский
        oj: "ᐊᓂᔑᓈᐯᒧᐎᓐ",              //Оджибве
        om: "Afaan Oromoo",          //Оромо
        or: "ଓଡ଼ିଆ",                   //Ория
        os: "ирон æвзаг",            //Осетинский
        pa: "ਪੰਜਾਬੀ",                  //Пенджабский
        pi: "पाऴि",                   //Пали
        pl: "język polski",          //Польский
        ps: "پښتو",                  //Пушту
        pt: "português",             //Португальский
        qu: "Runa Simi",             //Кечуа
        rm: "rumantsch grischun",    //Ретороманский
        rn: "Ikirundi",              //Рунди
        ro: "limba română",          //Румынский
        ru: "Русский",               //Русский язык
        rw: "Ikinyarwanda",          //Руанда
        sa: "संस्कृतम्",                //Санскрит
        sc: "sardu",                 //Сардинский
        sd: "सिन्धी",                  //Синдхи
        se: "Davvisámegiella",       //Северносаамский язык
        sg: "yângâ tî sängö",        //Санго
        si: "සිංහල",                  //Сингальский
        sk: "slovenčina",            //Словацкий
        sl: "slovenski jezik",       //Словенский
        sm: "gagana fa'a Samoa",     //Самоанский
        sn: "chiShona",              //Шона
        so: "Soomaaliga",            //Сомали
        sq: "gjuha shqipe",          //Албанский
        sr: "српски језик",          //Сербский
        ss: "SiSwati",               //Свази
        st: "Sesotho",               //Сото южный
        su: "Basa Sunda",            //Сунданский
        sv: "Svenska",               //Шведский
        sw: "Kiswahili",             //Суахили
        ta: "தமிழ்",                  //Тамильский
        te: "తెలుగు",                 //Телугу
        tg: "тоҷикӣ",                //Таджикский
        th: "ไทย",                   //Тайский
        ti: "ትግርኛ",                  //Тигринья
        tk: "Түркмен",               //Туркменский
        tl: "Wikang Tagalog",        //Тагальский
        tn: "Setswana",              //Тсвана
        to: "faka Tonga",            //Тонганский
        tr: "Türkçe",                //Турецкий
        ts: "Xitsonga",              //Тсонга
        tt: "татар теле",            //Татарский
        tw: "Twi",                   //Тви
        ty: "Reo Tahiti",            //Таитянский
        ug: "Uyƣurqə",               //Уйгурский
        uk: "Українська",            //Украинский Українська мова
        ur: "اردو",                  //Урду
        uz: "Ўзбек",                 //Узбекский
        ve: "Tshivenḓa",             //Венда
        vi: "Tiếng Việt",            //Вьетнамский
        vo: "Volapük",               //Волапюк
        wa: "walon",                 //Walloon
        wo: "Wollof",                //Волоф
        xh: "isiXhosa",              //Коса
        yi: "ייִדיש",                //Идиш
        yo: "Yorùbá",                //Йоруба
        za: "Saɯ cueŋƅ",             //Чжуанский
        zh: "中文",                   //Китайский
        zu: "isiZulu"                //Зулу
    };

    var ISO3166 = {
        AD: {ru: "Андорра"},
        AE: {ru: "Объединённые Арабские Эмираты"},
        AF: {ru: "Афганистан"},
        AG: {ru: "Антигуа и Барбуда"},
        AI: {ru: "Ангилья"},
        AL: {ru: "Албания"},
        AM: {ru: "Армения"},
        AO: {ru: "Ангола"},
        AQ: {ru: "Антарктида"},
        AR: {ru: "Аргентина"},
        AS: {ru: "Американское Самоа"},
        AT: {ru: "Австрия"},
        AU: {ru: "Австралия"},
        AW: {ru: "Аруба"},
        AX: {ru: "Аландские острова"},
        AZ: {ru: "Азербайджан"},
        BA: {ru: "Босния и Герцеговина"},
        BB: {ru: "Барбадос"},
        BD: {ru: "Бангладеш"},
        BE: {ru: "Бельгия"},
        BF: {ru: "Буркина-Фасо"},
        BG: {ru: "Болгария"},
        BH: {ru: "Бахрейн"},
        BI: {ru: "Бурунди"},
        BJ: {ru: "Бенин"},
        BL: {ru: "Сен-Бартелеми"},
        BM: {ru: "Бермуды"},
        BN: {ru: "Бруней"},
        BO: {ru: "Боливия"},
        BQ: {ru: "Бонэйр, Синт-Эстатиус и Саба"},
        BR: {ru: "Бразилия"},
        BS: {ru: "Багамы"},
        BT: {ru: "Бутан"},
        BV: {ru: "Остров Буве"},
        BW: {ru: "Ботсвана"},
        BY: {ru: "Белоруссия"},
        BZ: {ru: "Белиз"},
        CA: {ru: "Канада"},
        CC: {ru: "Кокосовые острова"},
        CD: {ru: "Демократическая Республика Конго"},
        CF: {ru: "Центральноафриканская Республика"},
        CG: {ru: "Республика Конго"},
        CH: {ru: "Швейцария"},
        CI: {ru: "Кот-д’Ивуар"},
        CK: {ru: "Острова Кука"},
        CL: {ru: "Чили"},
        CM: {ru: "Камерун"},
        CN: {ru: "КНР"},
        CO: {ru: "Колумбия"},
        CR: {ru: "Коста-Рика"},
        CU: {ru: "Куба"},
        CV: {ru: "Кабо-Верде"},
        CW: {ru: "Кюрасао"},
        CX: {ru: "Остров Рождества"},
        CY: {ru: "Кипр"},
        CZ: {ru: "Чехия"},
        DE: {ru: "Германия"},
        DJ: {ru: "Джибути"},
        DK: {ru: "Дания"},
        DM: {ru: "Доминика"},
        DO: {ru: "Доминиканская Республика"},
        DZ: {ru: "Алжир"},
        EC: {ru: "Эквадор"},
        EE: {ru: "Эстония"},
        EG: {ru: "Египет"},
        EH: {ru: "Западная Сахара"},
        ER: {ru: "Эритрея"},
        ES: {ru: "Испания"},
        ET: {ru: "Эфиопия"},
        FI: {ru: "Финляндия"},
        FJ: {ru: "Фиджи"},
        FK: {ru: "Фолклендские острова"},
        FM: {ru: "Микронезия"},
        FO: {ru: "Фарерские острова"},
        FR: {ru: "Франция"},
        GA: {ru: "Габон"},
        GB: {ru: "Великобритания"},
        GD: {ru: "Гренада"},
        GE: {ru: "Грузия"},
        GF: {ru: "Гвиана"},
        GG: {ru: "Гернси"},
        GH: {ru: "Гана"},
        GI: {ru: "Гибралтар"},
        GL: {ru: "Гренландия"},
        GM: {ru: "Гамбия"},
        GN: {ru: "Гвинея"},
        GP: {ru: "Гваделупа"},
        GQ: {ru: "Экваториальная Гвинея"},
        GR: {ru: "Греция"},
        GS: {ru: "Южная Георгия и Южные Сандвичевы острова"},
        GT: {ru: "Гватемала"},
        GU: {ru: "Гуам"},
        GW: {ru: "Гвинея-Бисау"},
        GY: {ru: "Гайана"},
        HK: {ru: "Гонконг"},
        HM: {ru: "Херд и Макдональд"},
        HN: {ru: "Гондурас"},
        HR: {ru: "Хорватия"},
        HT: {ru: "Гаити"},
        HU: {ru: "Венгрия"},
        ID: {ru: "Индонезия"},
        IE: {ru: "Ирландия"},
        IL: {ru: "Израиль"},
        IM: {ru: "Остров Мэн"},
        IN: {ru: "Индия"},
        IO: {ru: "Британская территория в Индийском океане"},
        IQ: {ru: "Ирак"},
        IR: {ru: "Иран"},
        IS: {ru: "Исландия"},
        IT: {ru: "Италия"},
        JE: {ru: "Джерси"},
        JM: {ru: "Ямайка"},
        JO: {ru: "Иордания"},
        JP: {ru: "Япония"},
        KE: {ru: "Кения"},
        KG: {ru: "Киргизия"},
        KH: {ru: "Камбоджа"},
        KI: {ru: "Кирибати"},
        KM: {ru: "Коморы"},
        KN: {ru: "Сент-Китс и Невис"},
        KP: {ru: "КНДР"},
        KR: {ru: "Республика Корея"},
        KW: {ru: "Кувейт"},
        KY: {ru: "Каймановы острова"},
        KZ: {ru: "Казахстан"},
        LA: {ru: "Лаос"},
        LB: {ru: "Ливан"},
        LC: {ru: "Сент-Люсия"},
        LI: {ru: "Лихтенштейн"},
        LK: {ru: "Шри-Ланка"},
        LR: {ru: "Либерия"},
        LS: {ru: "Лесото"},
        LT: {ru: "Литва"},
        LU: {ru: "Люксембург"},
        LV: {ru: "Латвия"},
        LY: {ru: "Ливия"},
        MA: {ru: "Марокко"},
        MC: {ru: "Монако"},
        MD: {ru: "Молдавия"},
        ME: {ru: "Черногория"},
        MF: {ru: "Сен-Мартен"},
        MG: {ru: "Мадагаскар"},
        MH: {ru: "Маршалловы Острова"},
        MK: {ru: "Македония"},
        ML: {ru: "Мали"},
        MM: {ru: "Мьянма"},
        MN: {ru: "Монголия"},
        MO: {ru: "Макао"},
        MP: {ru: "Северные Марианские острова"},
        MQ: {ru: "Мартиника"},
        MR: {ru: "Мавритания"},
        MS: {ru: "Монтсеррат"},
        MT: {ru: "Мальта"},
        MU: {ru: "Маврикий"},
        MV: {ru: "Мальдивы"},
        MW: {ru: "Малави"},
        MX: {ru: "Мексика"},
        MY: {ru: "Малайзия"},
        MZ: {ru: "Мозамбик"},
        NA: {ru: "Намибия"},
        NC: {ru: "Новая Каледония"},
        NE: {ru: "Нигер"},
        NF: {ru: "Остров Норфолк"},
        NG: {ru: "Нигерия"},
        NI: {ru: "Никарагуа"},
        NL: {ru: "Нидерланды"},
        NO: {ru: "Норвегия"},
        NP: {ru: "Непал"},
        NR: {ru: "Науру"},
        NU: {ru: "Ниуэ"},
        NZ: {ru: "Новая Зеландия"},
        OM: {ru: "Оман"},
        PA: {ru: "Панама"},
        PE: {ru: "Перу"},
        PF: {ru: "Французская Полинезия"},
        PG: {ru: "Папуа — Новая Гвинея"},
        PH: {ru: "Филиппины"},
        PK: {ru: "Пакистан"},
        PL: {ru: "Польша"},
        PM: {ru: "Сен-Пьер и Микелон"},
        PN: {ru: "Острова Питкэрн"},
        PR: {ru: "Пуэрто-Рико"},
        PS: {ru: "Государство Палестина"},
        PT: {ru: "Португалия"},
        PW: {ru: "Палау"},
        PY: {ru: "Парагвай"},
        QA: {ru: "Катар"},
        RE: {ru: "Реюньон"},
        RO: {ru: "Румыния"},
        RS: {ru: "Сербия"},
        RU: {ru: "Россия"},
        RW: {ru: "Руанда"},
        SA: {ru: "Саудовская Аравия"},
        SB: {ru: "Соломоновы Острова"},
        SC: {ru: "Сейшельские Острова"},
        SD: {ru: "Судан"},
        SE: {ru: "Швеция"},
        SG: {ru: "Сингапур"},
        SH: {ru: "Острова Святой Елены, Вознесения и Тристан-да-Кунья"},
        SI: {ru: "Словения"},
        SJ: {ru: "Шпицберген и Ян-Майен"},
        SK: {ru: "Словакия"},
        SL: {ru: "Сьерра-Леоне"},
        SM: {ru: "Сан-Марино"},
        SN: {ru: "Сенегал"},
        SO: {ru: "Сомали"},
        SR: {ru: "Суринам"},
        SS: {ru: "Южный Судан"},
        ST: {ru: "Сан-Томе и Принсипи"},
        SV: {ru: "Сальвадор"},
        SX: {ru: "Синт-Мартен"},
        SY: {ru: "Сирия"},
        SZ: {ru: "Свазиленд"},
        TC: {ru: "Тёркс и Кайкос"},
        TD: {ru: "Чад"},
        TF: {ru: "Французские Южные и Антарктические Территории"},
        TG: {ru: "Того"},
        TH: {ru: "Таиланд"},
        TJ: {ru: "Таджикистан"},
        TK: {ru: "Токелау"},
        TL: {ru: "Восточный Тимор"},
        TM: {ru: "Туркмения"},
        TN: {ru: "Тунис"},
        TO: {ru: "Тонга"},
        TR: {ru: "Турция"},
        TT: {ru: "Тринидад и Тобаго"},
        TV: {ru: "Тувалу"},
        TW: {ru: "Китайская Республика"},
        TZ: {ru: "Танзания"},
        UA: {ru: "Украина", uk: "Україна"},
        UG: {ru: "Уганда"},
        UM: {ru: "Внешние малые острова (США)"},
        US: {ru: "США"},
        UY: {ru: "Уругвай"},
        UZ: {ru: "Узбекистан"},
        VA: {ru: "Ватикан"},
        VC: {ru: "Сент-Винсент и Гренадины"},
        VE: {ru: "Венесуэла"},
        VG: {ru: "Британские Виргинские острова"},
        VI: {ru: "Американские Виргинские острова"},
        VN: {ru: "Вьетнам"},
        VU: {ru: "Вануату"},
        WF: {ru: "Уоллис и Футуна"},
        WS: {ru: "Самоа"},
        YE: {ru: "Йемен"},
        YT: {ru: "Майотта"},
        ZA: {ru: "ЮАР"},
        ZM: {ru: "Замбия"},
        ZW: {ru: "Зимбабве"}
    };

    var cache = {};

    function getContents(grunt, path) {
        return cache[path] = cache[path] || grunt.file.readJSON(path);
    }

    /**
     * Записывает ключ в contents.json
     * @param grunt
     * @param {Object} keys
     * @param {String} applicationRoot - полный путь до корня сервиса
     */
    function replaceContents(grunt, keys, applicationRoot) {
        var absolutePath = path.join(applicationRoot, 'resources/contents.json');
        try {
            var content = getContents(grunt, absolutePath);
            if (content) {
                Object.keys(keys).forEach(function (key) {
                    content[key] = keys[key];
                });
                grunt.file.write(absolutePath, JSON.stringify(content, null, 2));
                grunt.file.write(absolutePath.replace('.json', '.js'), 'contents = ' + JSON.stringify(content, null, 2));
            }
        } catch (e) {
            grunt.fail.fatal('Can\'t read contents.json file - ' + e);
        }
    }

    /**
     * Ищет с помощью esprima функцию define, и берет ее параметры
     * @param {String} script
     * @param {Function} callback
     * @return
     */
    function getModuleName(script, callback) {
        var ast, modName = '', name;
        try {
            ast = esprima.parse(script);
            traverse(ast, {
                enter: function (node) {
                    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define' &&
                        node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                        modName = node.arguments[0].value;
                        this.break();
                    }
                }
            });
        } catch (err) {
            //ignore
        }

        if (modName) {
            var meta = getMeta(modName);
            if (meta.plugin == 'is') {
                if (meta.moduleNo) {
                    grunt.log.warn('Ambiguous module name: %s', modName);
                    return;
                } else {
                    name = meta.moduleYes.module;
                }
            } else if (meta.plugin == 'browser' || meta.plugin == 'optional') {
                name = meta.moduleIn.module;
            } else {
                name = meta.module;
            }
        }

        callback(name);
    }

    /**
     * Получает список языков, которые будут доступны
     * @param languages
     * @returns {{availableLanguage: {}, defaultLanguage: string}}
     */
    function getAvailableLang(languages) {
        var availableLang = {},
            defLang = '',
            i, len, lang, parts, local, country;

        if (typeof languages === 'string') {
            languages = languages.replace(/"/g, '').split(';');
            for (i = 0, len = languages.length; i < len; i++) {
                var isDef = false;

                lang = languages[i];
                if (lang.length === 6 && lang[0] === '*') {
                    lang = lang.substring(1, 6);
                    isDef = true;
                }

                if (lang.length === 5) {
                    parts = lang.split('-');
                    local = parts[0].toLowerCase();
                    country = parts[1].toUpperCase();
                    lang = local + '-' + country;
                    defLang = isDef ? lang : defLang;
                    availableLang[lang] = ISO639[local];// + ' (' + ISO3166[country][local] + ')';
                }
            }
        }

        return {availableLanguage: availableLang, defaultLanguage: defLang};
    }

    /**
     * Возвращает массив путей до ws и папок первого уровня вложенности в resources
     */
    function getFirstLevelDirs(app) {
        var
            resources = path.join(app, 'resources'),
            ws = path.join(app, 'ws'),
            dirs;

        dirs = fs.readdirSync(resources).map(function (e) {
            return path.join(resources, e);
        });

        dirs.push(ws);

        return dirs.filter(function (e) {
            return fs.statSync(e).isDirectory();
        });
    }

    function mergeJSDicts(grunt, packageRoot, levelDicts) {
        var allWords = {};

        levelDicts.forEach(function (dictPath) {
            var dictContent = grunt.file.readJSON(dictPath);
            for (var key in dictContent) {
                if (!dictContent.hasOwnProperty(key)) continue;
                allWords[key] = dictContent[key];
            }
        });

        return allWords;
    }

    function mergeCss(grunt, packageRoot, levelCss) {
        return bumpImportsUp(levelCss.map(function(cssPath){
            return resolveUrl(packageRoot, cssPath, grunt.file.read(cssPath));
        }).join('\n'));
    }

    function mergeCountryCss(grunt, packageRoot, levelCountryCss) {
        return bumpImportsUp(levelCountryCss.map(function(cssPath){
            return resolveUrl(packageRoot, cssPath, grunt.file.read(cssPath));
        }).join('\n'));
    }

    /**
     * Создает структуру папок lang в коневой директории
     */
    function createLangHierarchy(dir, lang, withCountry) {
        var
            globalLevel = path.join(dir, 'lang'),
            langLevel = path.join(globalLevel, lang),
            countryLevel = path.join(globalLevel, lang.substr(3, 2));

        if (!fs.existsSync(globalLevel)) {
            fs.mkdirSync(globalLevel);
        }

        if (!fs.existsSync(langLevel)) {
            fs.mkdirSync(langLevel);
        }

        if (withCountry && !fs.existsSync(countryLevel)) {
            fs.mkdirSync(countryLevel);
        }
    }

    /**
     * Формирует ключ вида Папка.язык.расширение
     */
    function getDirectoryKey(levelDirPath, lang, ext) {
        var dblSlashes = /\\/g;

        levelDirPath = levelDirPath.replace(dblSlashes, '/').split('/').pop();
        return levelDirPath + '.' + lang + '.' + ext;
    }

    function checkInAvailableLang(language, availableLang) {
        if (language && language in availableLang) {
            return language;
        } else if (language) {
            for (var key in availableLang) {
                if (!availableLang.hasOwnProperty(key)) continue;
                if (key.split('-').pop() == language) {
                    return key;
                }
            }
        }

    }
    function fillLocalDicts(levelLocalDict, availableLang, absPath, JS, CSS, Country) {
        var language = JS && JS[1] || CSS && CSS[1] || Country && Country[1];
        language = checkInAvailableLang(language, availableLang);

        if (language) {
            if (!levelLocalDict[language]) {
                levelLocalDict[language] = {
                    levelDicts: [],
                    levelCss: [],
                    levelCountryCss: []
                }
            }

            if (JS) {
                levelLocalDict[language].levelDicts.push(absPath);
            } else if (CSS) {
                levelLocalDict[language].levelCss.push(absPath);
            } else if (Country) {
                levelLocalDict[language].levelCountryCss.push(absPath);
            }


        }
    }

    /*TODO Временная функция костыль для проверки существует ли уже объединённый словарь или нет.
     Сейчас если объединённый словарь уже есть, билдер пытается его переписать, а файл со словарём только для чтения из-за чего падает сборка.
     Необходима до тех пора пока мы полностью не перейдём на новый стандарт словарей локализации.
     Как только это произойдёт, то можно смело сносить вместе с функцией объединения словарей.
     https://online.sbis.ru/opendoc.html?guid=0987439c-f32e-4c6a-b3f6-78244c2e7a1b
    */
    /**
     * Функция проверяет, существует ли объединённый словарь или нет. Выводит предупреждения, если
     * расположение словарей локализации в директории модуля не приведена к стандарту.
     * @param mergeDictPath - путь до объединённого словаря
     * @param allDictPath - пути до всех словарей в директории модуля
     * @param moduleName - путь до директории модуля
     * @returns {boolean}
     */
    function checkExistMergeDict(mergeDictPath, allDictPath, modulePath) {

        let flag,
            mergeDictPathes = mergeDictPath.replace(dblSlashes,'/');

        flag = allDictPath.some(function (pathDict) {
            return ~pathDict.indexOf(mergeDictPathes)
        });

        if (flag) {
            if (allDictPath.length > 1) {
                grunt.log.warn(`In the directory ${modulePath} exists the merged dictionary. Remove all the not needed dictionaries in the directory.`);
            }
            return true;
        }

        if (allDictPath.length > 0) {
            grunt.log.warn(`In the directory ${modulePath} not exists the merged dictionary. Merge all dictionaries into one dictionary and add it to ${mergeDictPath}.`);
            return false;
        } else {
            return true;
        }
    }

    module.exports = {
        /**
         * Индексирует словари и записывает информацию о них в contents.json
         * @param {Object} grunt
         * @param {String} languages - Языки для индексации
         * @param {Object} data - Конфигурация таски
         * @param done
         */
        indexDict: function (grunt, languages, data, done) {
            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Начато индексирование словарей для локализации.');

            var
                temp = getAvailableLang(languages),
                availableLang = temp.availableLanguage,
                defLang = temp.defaultLanguage,
                jsDict = {},
                firstLevelDirs = getFirstLevelDirs(data.cwd),
                applicationRoot = path.join(data.root, data.application),
                resourceRoot = path.join(applicationRoot, 'resources'),
               _const = global.requirejs('Core/constants');

            if (Object.keys(availableLang).length) {
                firstLevelDirs.forEach(function (fstLvlD) {
                    var
                        levelLocalDict = {};

                    grunt.file.recurse(fstLvlD, function (absPath) {
                        var JS = absPath.match(data.dict),
                           CSS = absPath.match(data.css),
                           Country = absPath.match(data.country);

                        fillLocalDicts(levelLocalDict, availableLang, absPath, JS, CSS, Country);
                    });

                    for (var langKey in levelLocalDict) {
                        if (!levelLocalDict.hasOwnProperty(langKey)) continue;

                        if (levelLocalDict[langKey].levelDicts.length || levelLocalDict[langKey].levelCss.length || levelLocalDict[langKey].levelCountryCss.length) {
                            var country = langKey.substr(3, 2),
                                dictPath = path.join(fstLvlD, 'lang', langKey, langKey + '.json'),
                                cssPath = path.join(fstLvlD, 'lang', langKey, langKey + '.css'),
                                countryCssPath = path.join(fstLvlD, 'lang', country, country + '.css'),
                                mergedDicts = mergeJSDicts(grunt, dictPath, levelLocalDict[langKey].levelDicts),
                                mergedCss = mergeCss(grunt, cssPath, levelLocalDict[langKey].levelCss),
                                mergedCountryCss = mergeCountryCss(grunt, countryCssPath, levelLocalDict[langKey].levelCountryCss);

                            createLangHierarchy(fstLvlD, langKey, mergedCountryCss.length);

                            var relativeDictPath = path.relative(resourceRoot, dictPath).replace(dblSlashes, '/'),
                               relativeCssPath,
                               relativeCounryPath,
                               dictMouduleName = relativeDictPath.replace(isWS, 'WS').replace('.json', ''),
                               dictModuleDeps = [],
                               dictModuleArgs = [],
                               dictModuleContent = '',
                               moduleStart = '(function() {var global = (function(){ return this || (0,eval)("this"); }()),';
                            moduleStart += 'define = global.define || (global.requirejs && global.requirejs.define) || (requirejsVars && requirejsVars.define);';

                            if (Object.keys(mergedDicts).length) {
                                dictModuleDeps.push('"text!' + relativeDictPath.replace(isWS, 'WS') + '"');
                                dictModuleArgs.push('dict');
                                dictModuleContent += 'i18n.setDict(JSON.parse(dict), "text!' + relativeDictPath.replace(isWS, 'WS') + '", "' + langKey + '");';

                                if (!checkExistMergeDict(dictPath, levelLocalDict[langKey].levelDicts, fstLvlD)) {
                                    fs.writeFileSync(dictPath, JSON.stringify(mergedDicts, null, 3));
                                }

                                jsDict[getDirectoryKey(fstLvlD, langKey, 'json')] = true;
                            }
                            if (mergedCss) {
                                relativeCssPath = path.relative(resourceRoot, cssPath).replace(dblSlashes, '/').replace('.css', '');
                                dictModuleContent += 'if(i18n.getLang()=="' + langKey + '"){global.requirejs(["native-css!' + relativeCssPath + '"]);}';
                                fs.writeFileSync(cssPath, mergedCss);
                                jsDict[getDirectoryKey(fstLvlD, langKey, 'css')] = true;
                            }

                            if (mergedCountryCss) {
                                relativeCounryPath = path.relative(resourceRoot, countryCssPath).replace(dblSlashes, '/').replace('.css', '');
                                dictModuleContent += 'if(i18n.getLang().indexOf("' + langKey + '")>-1){global.requirejs(["native-css!' + relativeCounryPath + '"]);}';
                                fs.writeFileSync(countryCssPath, mergedCountryCss);
                                jsDict[getDirectoryKey(fstLvlD, country, 'css')] = true;
                            }

                            if(dictModuleDeps.length) {
                                dictModuleDeps.unshift('"Core/i18n"');
                                dictModuleArgs.unshift('i18n');
                                fs.writeFileSync(dictPath.replace('.json', '.js'), moduleStart + 'define("' + dictMouduleName + '", [' + dictModuleDeps.join() + '], ' +
                                   'function(' + dictModuleArgs.join() + ') {' + dictModuleContent + '}); global.requirejs(["Core/core-init-min"], function() {global.requirejs(["' + dictMouduleName + '"])});})();');
                            }

                        }
                    }
                });
            }

            replaceContents(grunt, {
                availableLanguage: availableLang,
                defaultLanguage: defLang,
                dictionary: jsDict
            }, data.cwd);

            //Нужно для заполенения констант локализации на время сборки.
            _const.availableLanguage = availableLang;
            _const.defaultLanguage = defLang;
            _const.dictionary = jsDict;

            grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Индексирование словарей для локализации выполнено.');

            done();
        }
    }
})();