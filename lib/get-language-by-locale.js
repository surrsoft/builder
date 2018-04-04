'use strict';

const ISO639 = {
   aa: 'Afaraf',                //Афарский
   ab: 'аҧсшәа',                //Абхазский
   ae: 'avesta',                //Авестийский
   af: 'Afrikaans',             //Африкаанс
   ak: 'Akan',                  //Акан
   am: 'አማርኛ',                  //Амхарский
   an: 'aragonés',              //Арагонский
   ar: 'ةيبرعلا',               //Арабский
   as: 'অসমীয়া',                 //Ассамский
   av: 'авар мацӀ',             //Аварский
   ay: 'aymar aru',             //Аймара
   az: 'azərbaycan dili',       //Азербайджанский
   ba: 'башҡорт теле',          //Башкирский
   be: 'беларуская мова',       //Белорусский
   bg: 'български език',        //Болгарский
   bh: 'भोजपुरी',                 //Бихари
   bi: 'Bislama',               //Бислама
   bm: 'bamanankan',            //Бамбара
   bn: 'বাংলা',                  //Бенгальский
   bo: 'བོད་ཡིག',               //Тибетский
   br: 'brezhoneg',             //Breton
   bs: 'bosanski jezik',        //Боснийский
   ca: 'català',                //Каталанский
   ce: 'нохчийн мотт',          //Чеченский
   ch: 'Chamoru',               //Чаморро
   co: 'corsu',                 //Корсиканский
   cr: 'ᓀᐦᐃᔭᐍᐏᐣ',               //Крик
   cs: 'český jazyk',           //Чешский
   cv: 'чӑваш чӗлхи',           //Чувашский
   cy: 'Cymraeg',               //Валлийский
   da: 'dansk',                 //Датский
   de: 'Deutsch',               //Немецкий
   dv: 'ދިވެހި',                   //Дивехи
   dz: 'རྫོང་ཁ',                //Дзонг-кэ
   ee: 'Eʋegbe',                //Эве
   el: 'ελληνικά',              //Греческий
   en: 'English',               //Английский
   eo: 'Esperanto',             //Эсперанто
   es: 'español',               //Испанский
   et: 'eesti keel',            //Эстонский
   eu: 'euskara',               //Баскский
   fa: 'فارسی',                 //Персидский
   ff: 'Fulfulde',              //Фулах
   fi: 'suomen kieli',          //Финский
   fj: 'vosa Vakaviti',         //Фиджи
   fo: 'føroyskt',              //Фарерский
   fr: 'français',              //Французский
   fy: 'Frysk',                 //Фризский
   ga: 'Gaeilge',               //Ирландский
   gd: 'Gàidhlig',              //Гэльский
   gl: 'galego',                //Галисийский
   gn: 'Avañe\'ẽ',               //Гуарани
   gu: 'ગુજરાતી',                 //Гуджарати
   gv: 'Gaelg',                 //Мэнский
   ha: 'هَوُسَ',                //Хауса
   he: 'עברית',                 //Иврит
   hi: 'हिन्दी',                  //Хинди
   ho: 'Hiri Motu',             //Хиримоту
   hr: 'hrvatski jezik',        //Хорватский
   ht: 'Kreyòl ayisyen',        //Haitian
   hu: 'magyar',                //Венгерский
   hy: 'Հայերեն',                //Армянский
   hz: 'Otjiherero',            //Гереро
   ia: 'Interlingua',           //Интерлингва
   id: 'Bahasa Indonesia',      //Индонезийский
   ie: 'Interlingue',           //Интерлингве
   ig: 'Asụsụ Igbo',            //Игбо
   ii: 'Nuosuhxop',             //Сычуань
   ik: 'Iñupiaq',               //Инупиак
   io: 'Ido',                   //Идо
   is: 'Íslenska',              //Исландский
   it: 'italiano',              //Итальянский
   iu: 'ᐃᓄᒃᑎᑐᑦ',               //Инуктитут
   ja: '日本語',                 //Японский
   jv: 'basa Jawa',             //Яванский
   ka: 'ქართული',              //Грузинский
   kg: 'KiKongo',               //Конго
   ki: 'Gĩkũyũ',                //Кикуйю
   kj: 'Kuanyama',              //Киньяма
   kk: 'қазақ тілі',            //Казахский
   kl: 'kalaallisut',           //Гренландский
   km: 'ខ្មែរ',                    //Кхмерский
   kn: 'ಕನ್ನಡ',                 //Каннада
   ko: '한국어',                 //Корейский
   kr: 'Kanuri',                //Канури
   ks: 'कश्मीरी',                 //Кашмири
   ku: 'Kurdî',                 //Курдский
   kv: 'коми кыв',              //Коми
   kw: 'Kernewek',              //Корнский
   ky: 'Кыргыз тили',           //Киргизский
   la: 'latine',                //Латинский
   lb: 'Lëtzebuergesch',        //Люксембургский
   lg: 'Luganda',               //Ганда
   li: 'Limburgs',              //Limburgan
   ln: 'Lingála',               //Лингала
   lo: 'ພາສາລາວ',              //Лаосский
   lt: 'lietuvių kalba',        //Литовский
   lu: 'Tshiluba',              //Луба-катанга
   lv: 'latviešu valoda',       //Латышский
   mg: 'fiteny malagasy',       //Малагасийский
   mh: 'Kajin M̧ajeļ',          //Маршалльский
   mi: 'te reo Māori',          //Маори
   mk: 'македонски јазик',      //Македонский
   ml: 'മലയാളം',               //Малаялам
   mn: 'монгол',                //Монгольский
   mr: 'मराठी',                  //Маратхи
   ms: 'bahasa Melayu',         //Малайский
   mt: 'Malti',                 //Мальтийский
   my: 'ဗမာစာ',                 //Бирманский
   na: 'Ekakairũ Naoero',       //Науру
   nb: 'Norsk bokmål',          //Норвежский‬ книжный
   nd: 'isiNdebele',            //Ндебеле северный
   ne: 'नेपाली',                  //Непальский
   ng: 'Owambo',                //Ндунга
   nl: 'Nederlands',            //Нидерландский
   nn: 'Norsk nynorsk',         //Нюнорск (Норвежский новый)
   no: 'Norsk',                 //Норвежский‬
   nr: 'isiNdebele',            //Ндебеле южный
   nv: 'Diné bizaad',           //Навахо
   ny: 'chiCheŵa',              //Ньянджа
   oc: 'occitan',               //Окситанский
   oj: 'ᐊᓂᔑᓈᐯᒧᐎᓐ',              //Оджибве
   om: 'Afaan Oromoo',          //Оромо
   or: 'ଓଡ଼ିଆ',                   //Ория
   os: 'ирон æвзаг',            //Осетинский
   pa: 'ਪੰਜਾਬੀ',                  //Пенджабский
   pi: 'पाऴि',                   //Пали
   pl: 'język polski',          //Польский
   ps: 'پښتو',                  //Пушту
   pt: 'português',             //Португальский
   qu: 'Runa Simi',             //Кечуа
   rm: 'rumantsch grischun',    //Ретороманский
   rn: 'Ikirundi',              //Рунди
   ro: 'limba română',          //Румынский
   ru: 'Русский',               //Русский язык
   rw: 'Ikinyarwanda',          //Руанда
   sa: 'संस्कृतम्',                //Санскрит
   sc: 'sardu',                 //Сардинский
   sd: 'सिन्धी',                  //Синдхи
   se: 'Davvisámegiella',       //Северносаамский язык
   sg: 'yângâ tî sängö',        //Санго
   si: 'සිංහල',                  //Сингальский
   sk: 'slovenčina',            //Словацкий
   sl: 'slovenski jezik',       //Словенский
   sm: 'gagana fa\'a Samoa',     //Самоанский
   sn: 'chiShona',              //Шона
   so: 'Soomaaliga',            //Сомали
   sq: 'gjuha shqipe',          //Албанский
   sr: 'српски језик',          //Сербский
   ss: 'SiSwati',               //Свази
   st: 'Sesotho',               //Сото южный
   su: 'Basa Sunda',            //Сунданский
   sv: 'Svenska',               //Шведский
   sw: 'Kiswahili',             //Суахили
   ta: 'தமிழ்',                  //Тамильский
   te: 'తెలుగు',                 //Телугу
   tg: 'тоҷикӣ',                //Таджикский
   th: 'ไทย',                   //Тайский
   ti: 'ትግርኛ',                  //Тигринья
   tk: 'Түркмен',               //Туркменский
   tl: 'Wikang Tagalog',        //Тагальский
   tn: 'Setswana',              //Тсвана
   to: 'faka Tonga',            //Тонганский
   tr: 'Türkçe',                //Турецкий
   ts: 'Xitsonga',              //Тсонга
   tt: 'татар теле',            //Татарский
   tw: 'Twi',                   //Тви
   ty: 'Reo Tahiti',            //Таитянский
   ug: 'Uyƣurqə',               //Уйгурский
   uk: 'Українська',            //Украинский Українська мова
   ur: 'اردو',                  //Урду
   uz: 'Ўзбек',                 //Узбекский
   ve: 'Tshivenḓa',             //Венда
   vi: 'Tiếng Việt',            //Вьетнамский
   vo: 'Volapük',               //Волапюк
   wa: 'walon',                 //Walloon
   wo: 'Wollof',                //Волоф
   xh: 'isiXhosa',              //Коса
   yi: 'ייִדיש',                //Идиш
   yo: 'Yorùbá',                //Йоруба
   za: 'Saɯ cueŋƅ',             //Чжуанский
   zh: '中文',                   //Китайский
   zu: 'isiZulu'                //Зулу
};

//languageCulture - идентификатор состоящий из языка и страны, разделённые дефисом
//язык должен быть указан строчными буквами
//страна - заглавными
function getLanguageByLocale(languageCulture) {
   return ISO639[languageCulture.split('-')[0]];
}

module.exports = getLanguageByLocale;
