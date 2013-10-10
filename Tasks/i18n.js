//var gruntI18N = require('../lib/grunt-i18n');
var path = require('path');
var dicts = {};
var i18n = {};

module.exports = function(grunt) {

   grunt.registerMultiTask('i18n', 'Find all dictionary', function () {
      var dictMask = this.data.dict || ['**/lang/*.json'];

      i18n.findDictionary( grunt, dictMask );

      var needSplit = grunt.option('split'),
          defaultLang = grunt.option('defLang'),
          availableLang = {},
          key;
      if ( needSplit ) {
         for (key in dicts) {
            if (dicts.hasOwnProperty(key)) {
               grunt.file.mkdir( key + '/' );
               (function(lang){
                  grunt.file.recurse('./', function( abspath, rootdir, subdir, filename ){
                     // Копируем только нужные нам словари
                     var isDict = abspath.match( /\/lang\/(.+)\.json$/);
                     if( isDict && ( isDict.slice(1)[0] !== lang ) )
                        return;

                     // Игнорируем папки со статикой для конкретного языка
                     if( i18n.isLangDir( subdir ) )
                        return;

                     var dest = path.join(rootdir, lang, subdir ? subdir : '', filename );
                     i18n.copy( grunt, abspath, dest, lang, /\.xhtml$/.test( filename ) );
                  });
               })(key);

               availableLang = {};
               availableLang[key] = ISO639[key];
               i18n.replaceContents( grunt, availableLang, key );
            }
         }
         // Ну и основную статику переведем "по умолчанию"
         defaultLang = true;
      }

      if (defaultLang) {
         // Заменим только html в статике по умолчанию
         grunt.file.recurse('./', function( abspath, rootdir, subdir, filename ) {
            // Игнорируем папки со статикой для конкретного языка
            if( i18n.isLangDir( subdir ) )
               return;

            if( /\.xhtml$/.test( filename ) )
               i18n.copy( grunt, abspath, abspath, null, /\.xhtml$/.test( filename ) );
         });

         // На статике по умолчанию нет поддердживаемых языков
         i18n.replaceContents( grunt, {} );
      } else {
         // Оставляем все как есть, еще попутно записав, какие языки поддерживаются, переведется на клиенте
         availableLang = {};
         for (key in dicts) {
            if (dicts.hasOwnProperty(key)) {
               availableLang[key] = ISO639[key];
            }
         }
         i18n.replaceContents( grunt, availableLang );
      }
   });

};

i18n.merge = function merge(target) {
   var sources = [].slice.call(arguments, 1);
   sources.forEach(function (source) {
      for (var prop in source) {
         if (source.hasOwnProperty( prop )) {
            target[prop] = source[prop];
         }
      }
   });
   return target;
};

i18n.findDictionary = function findDictionary( grunt, dictMask ) {
   //grunt.log.writeln("Dictionary " + dictMask );
   var sourceFiles = grunt.file.expand(dictMask || []);
   sourceFiles.forEach(function (pathToSource) {
      var lang = path.basename( pathToSource, '.json' );
      if (!(lang in dicts)) {
         dicts[lang] = {};
      }
      var dict = grunt.file.readJSON( pathToSource );
      if( dict )
         i18n.merge(dicts[lang], dict);
   });
};

i18n.replaceContents = function replaceContents( grunt, availableLang, subdir ) {
   var abspath = path.join(subdir || '', 'resources/contents.json'),
       content = grunt.file.readJSON( abspath );
   if ( content ) {
      content.availableLanguage = availableLang;

      //TODO: В идеале здесь же надо заполнить блок dictionary

      grunt.file.write( abspath, JSON.stringify(content, null, 2) );
   } else {
      grunt.fail.warn( "Not find content.json file" );
   }
};

i18n.translate = function translate( text, lang ){
   return text.replace( /\{\[([\s\S]+?)\]\}/g, function(m, code) {
      if( lang && dicts[lang][code] )
         return dicts[lang][code];
      return code;
   });
};

i18n.copy = function copy( grunt, from, to, lang, translate ) {
   if (translate) {
      grunt.file.copy( from, to, {
         process: function (text) {
            return i18n.translate( text, lang );
         }
      });
   } else {
      grunt.file.copy( from, to);
   }
};

i18n.isLangDir = function( subdir ) {
   var isLangDir = subdir ? subdir.match(/^(.{2})\//) : false;
   if( isLangDir && ( isLangDir.slice(1)[0] in dicts ) )
      return true;
   else if( subdir && subdir in dicts )
      return true;

   return false;
};

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
   cr: "ᓀᐦᐃᔭᐍᐏᐣ",               //Cree
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
};