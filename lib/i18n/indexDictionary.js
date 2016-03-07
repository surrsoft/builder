/**
 * Created by shilovda on 11.10.13.
 */

var path = require('path');
var fs = require('fs');
var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var getMeta = require(path.join(path.resolve('node_modules'), 'grunt-wsmod-packer/lib/getDependencyMeta.js'));

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

   /**
    * Записывает ключ в contents.json
    * @param grunt
    * @param {Object} keys
    * @param {String} subDir
    */
   function replaceContents(grunt, keys, subDir) {
      var absolutePath = path.join('./', subDir || '', 'resources/contents.json');
      try {
         var content = grunt.file.readJSON(absolutePath);
         if (content) {
            Object.keys(keys).forEach(function(key){
               content[key] = keys[key];
            });
            grunt.file.write(absolutePath, JSON.stringify(content, null, 2));
            grunt.file.write(absolutePath.replace('.json', '.js'), 'contents = ' + JSON.stringify(content, null, 2));
         }
      } catch(e) {
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
      var ast = esprima.parse(script), modName = '';
      traverse(ast, {
         enter: function(node) {
            if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define' &&
                node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
               modName = node.arguments[0].value;
               this.break();
            }
         }
      });

      if (modName) {
         var meta = getMeta(modName),
            name = '';
         if (meta.plugin == 'is') {
            if (meta.moduleNo) {
               grunt.log.error('Ambiguous module name: %s', modName);
               return;
            } else {
               name = meta.moduleYes.module;
            }
         } else if (meta.plugin == 'browser') {
            name = meta.moduleIn.module;
         } else {
            name = meta.module;
         }
      }

      callback(name);
   }

   /**
    * Заполняет специальный объект, который потом попадет в contents.json c ключом dictionary
    * Он хранит пути до всех словарей
    * @param grunt
    * @param obj
    * @param lang
    * @param path
    * @returns {Object}
    */
   function getDictionaryPath(grunt, obj, lang, path) {
      if (!(lang && /..-../.test(lang))) return obj;

      // Теперь надо понять какому модулю мы принадлежим, и есть ли css
      // Надо получить имя модуля, для этого получим папку где лежит словарь
      var langDir = 'resources/lang/' + lang + '/' + lang + '.json',
          regExp = new RegExp('/(\\w+)/' + langDir),
          dirName = path.match(regExp),
          country = lang.substr(3,2),
          text, modPath, cssPath, cssCountryPath;

      dirName = dirName ? dirName[1] : false;
      if (dirName) {
         // Вычитаем файл с модулем, и найдем в нем название модуля
         try {
            modPath = path.replace(langDir, dirName + '.module.js');
            try {
               text = fs.readFileSync(modPath);
            } catch(err) {
               if (err.code == 'EACCES' || err.code == 'EISDIR') {
                  grunt.log.error(err.message);
               } else if (err.code == 'ENOENT') {
                  grunt.log.error('Directory %s has a dictionary file, but %s.module.js file is not found', dirName, dirName);
               }
            }

            if (text) {
               getModuleName(text, function(modName) {
                  if (modName) {
                     obj[modName + '.' + lang + '.json'] = path;
                     cssPath = path.replace('.json', '.css');
                     if (grunt.file.exists(cssPath)) {
                        obj[modName + '.' + lang + '.css'] = cssPath;
                     }
                     // Теперь поищем css для страны
                     cssCountryPath = path.replace(lang + '/' + lang + '.json', country + '/' + country + '.css');
                     if (grunt.file.exists(cssCountryPath)) {
                        obj[modName + '.' + country + '.css'] = cssCountryPath;
                     }
                  } else {
                     grunt.log.error('Unable to get the module name. File: %s', modPath);
                  }
               });
            }
         } catch(e) {
            grunt.log.error('Can\'t read ' + path.replace(langDir, dirName + '.module.js'));
         }
      }

      return obj;
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
               lang = lang.substring(1,6);
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

   module.exports = {
      /**
       * Индексирует словари и записывает информацию о них в contents.json
       * @param {Object} grunt
       * @param {String} languages - Языки для индексации
       * @param {Object} data - Конфигурация таски
       * @param done
       */
      indexDict: function(grunt, languages, data, done) {
         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Начато индексирование словарей для локализации.');

         var temp = getAvailableLang(languages),
             availableLang = temp.availableLanguage,
             defLang = temp.defaultLanguage,
             jsDict = {};

         if (Object.keys(availableLang).length) {
            grunt.file.recurse(path.join('./', data.application), function(absPath) {
               var language = absPath.match(data.dict);
               if (language && language[1]) {
                  var lang = language[1].substr(0,2).toLowerCase() + '-' + language[1].substr(3,2).toUpperCase();

                  if (lang in availableLang) {
                     getDictionaryPath(grunt, jsDict, lang, absPath);
                  }
               }
            });
         }

         replaceContents(grunt, {
            availableLanguage: availableLang,
            defaultLanguage: defLang,
            dictionary: jsDict
         }, data.application);

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Индексирование словарей для локализации выполнено.');

         done();
      }
   }
})();