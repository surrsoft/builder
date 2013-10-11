/**
 * Created by shilovda on 11.10.13.
 */

var path = require('path');

(function () {

   "use strict";

   var helpers = module.exports = {
      dictionary : {},

      translateAll: function(grunt){
         Object.keys(helpers.dictionary).forEach(function(lang){
            helpers.createLangStatic(grunt, lang);
         });
      },

      translateOne: function(grunt, lang) {
         if (lang in helpers.dictionary) {
            helpers.createLangStatic(grunt, lang);
         }
      },

      translateDef: function(grunt) {
         helpers.recursive(grunt, function(abspath, rootdir, subdir, filename) {
            if (/\.xhtml$/.test(filename)) {
               helpers.copy(grunt, abspath, abspath, null, /\.xhtml$/.test(filename));
            }
         });

         // На статике по умолчанию нет поддердживаемых языков
         helpers.replaceContents(grunt, 'availableLanguage', {});
         helpers.replaceContents(grunt, 'dictionary', {});
      },

      indexDict: function(grunt) {
         var availableLang = {},
            jsDict = {};
         helpers.recursive(grunt, function(abspath) {
            var lang = abspath.match(/\/lang\/(.+)\.json$/);
            if (lang && (lang[1] in helpers.dictionary)) {
               helpers.getDictionaryPath(grunt, jsDict, lang[1], abspath);
            }
         });

         // Оставляем все как есть, еще попутно записав, какие языки поддерживаются, переведется на клиенте
         Object.keys(helpers.dictionary).forEach(function(lang){
            availableLang[lang] = helpers.ISO639[lang];
         });
         helpers.replaceContents(grunt, 'availableLanguage', availableLang);
         helpers.replaceContents(grunt, 'dictionary', jsDict);
      },

      findDictionary: function(grunt, dictMask) {
         var sourceFiles = grunt.file.expand(dictMask || []);
         sourceFiles.forEach(function(pathToSource) {
            var lang = path.basename(pathToSource, '.json');
            if (!(lang in helpers.dictionary)) {
               helpers.dictionary[lang] = {};
            }
            var dict = grunt.file.readJSON(pathToSource);
            if (dict) {
               Object.keys(dict).forEach(function(prop){
                  helpers.dictionary[lang][prop] = dict[prop];
               });
            }
         });
      },

      replaceContents: function(grunt, key, value, subdir) {
         var absolutePath = path.join(subdir || '', 'resources/contents.json'),
            content = grunt.file.readJSON(absolutePath);
         if (content) {
            content[key] = value;
            grunt.file.write(absolutePath, JSON.stringify(content, null, 2));
         } else {
            grunt.fail.warn('Not find content.json file');
         }
      },

      translate: function(text, lang) {
         return text.replace(/\{\[([\s\S]+?)\]\}/g, function(m, code) {
            return (lang && helpers.dictionary[lang][code]) ? helpers.dictionary[lang][code] : code;
         });
      },

      copy: function(grunt, from, to, lang, translate) {
         if (translate) {
            grunt.file.copy(from, to, {
               process: function (text) {
                  return helpers.translate(text, lang);
               }
            });
         } else {
            grunt.file.copy(from, to);
         }
      },

      isLanguageDir: function(subdir) {
         var isLangDir = subdir ? subdir.match(/^(.{2})\//) : false;
         if (isLangDir && (isLangDir[1] in helpers.dictionary)) {
            return true;
         } else if(subdir && subdir in helpers.dictionary) {
            return true;
         }

         return false;
      },

      getDictionaryPath: function(grunt, obj, lang, path) {
         // Теперь надо понять какому модулю мы принадлежим, и есть ли css
         // Надо получить имя модуля, для этого получим папку где лежит словарь
         var langDir = 'lang/' + lang + '.json',
            regExp = new RegExp('/(\\w+)/' + langDir),
            dirName = path.match(regExp),
            text, modName, cssPath;
         dirName = dirName ? dirName[1] : false;
         if (dirName) {
            // Вычитаем файл с модулем, и найдем в нем название модуля
            text = grunt.file.read(path.replace(langDir, dirName + '.module.js'));
            if (text) {
               modName = (modName = text.match(/define\(.*?["'](\S+)["']/)) ? modName[1] : false;
               if (modName) {
                  obj[modName+'.'+lang+'.json'] = path;
                  cssPath = path.replace(langDir, 'lang/' + lang + '.css');
                  if (grunt.file.exists(cssPath)) {
                     obj[modName+'.'+lang+'.css'] = cssPath;
                  }
               }
            }
         }

         return obj;
      },

      recursive: function(grunt, callback) {
         grunt.file.recurse('./', function(abspath, rootdir, subdir, filename) {
            // Игнорируем папки со статикой для конкретного языка
            if (helpers.isLanguageDir(subdir)) {
               return;
            }

            callback( abspath, rootdir, subdir, filename );
         });
      },

      createLangStatic: function(grunt, lang) {
         if (!lang) return;

         var availableLang = {},
             jsDict = {};

         grunt.file.mkdir(lang + '/');
         helpers.recursive(grunt, function(abspath, rootdir, subdir, filename) {
            // Копируем только нужные нам словари
            var isDict;
            isDict = (isDict = abspath.match(/\/lang\/(.+)\.json$/)) ? isDict[1] : null;
            if (isDict && (isDict !== lang)) {
               return;
            } else if(isDict) {
               helpers.getDictionaryPath(grunt, jsDict, lang, abspath);
            }

            helpers.copy(grunt, abspath, path.join(rootdir, lang, subdir ? subdir : '', filename), lang, /\.xhtml$/.test(filename));
         });

         availableLang[lang] = helpers.ISO639[lang];
         helpers.replaceContents(grunt, 'availableLanguage', availableLang, lang);
         helpers.replaceContents(grunt, 'dictionary', jsDict, lang);
      },

      ISO639 : {
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
         ru: "Русский язык",          //Русский
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
         uk: "Українська мова",       //Украинский
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
      }
   }
})();