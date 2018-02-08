'use strict';

const path = require('path');
const fs = require('fs');
const cssHelpers = require(path.join(path.resolve('node_modules'), 'grunt-wsmod-packer/lib/cssHelpers.js'));
const resolveUrl = cssHelpers.rebaseUrls;
const bumpImportsUp = cssHelpers.bumpImportsUp;
const dblSlashes = /\\/g;
const isWS = /^\.\.\/ws/;


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

const cache = {};

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
   const absolutePath = path.join(applicationRoot, 'resources/contents.json');
   try {
      const content = getContents(grunt, absolutePath);
      if (content) {
         Object.keys(keys).forEach(function(key) {
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
 * Получает список языков, которые будут доступны
 * @param languages
 * @returns {{availableLanguage: {}, defaultLanguage: string}}
 */
function getAvailableLang(languages) {
   const availableLang = {};

   let defLang = '',
      lang,
      parts,
      local,
      country;

   if (typeof languages === 'string') {
      languages = languages.replace(/"/g, '').split(';');
      for (let i = 0; i < languages.length; i++) {
         let isDef = false;

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
            availableLang[lang] = ISO639[local];
         }
      }
   }

   return {availableLanguage: availableLang, defaultLanguage: defLang};
}

/**
 * Возвращает массив путей до ws и папок первого уровня вложенности в resources
 */
function getFirstLevelDirs(app) {
   const
      resources = path.join(app, 'resources'),
      ws = path.join(app, 'ws');

   const dirs = fs.readdirSync(resources).map(function(e) {
      return path.join(resources, e);
   });

   dirs.push(ws);

   return dirs.filter(function(e) {
      return fs.statSync(e).isDirectory();
   });
}

function mergeCss(grunt, packageRoot, levelCss) {
   return bumpImportsUp(levelCss.map(function(cssPath) {
      return resolveUrl(packageRoot, cssPath, grunt.file.read(cssPath));
   }).join('\n'));
}

function mergeCountryCss(grunt, packageRoot, levelCountryCss) {
   return bumpImportsUp(levelCountryCss.map(function(cssPath) {
      return resolveUrl(packageRoot, cssPath, grunt.file.read(cssPath));
   }).join('\n'));
}

/**
 * Формирует ключ вида Папка.язык.расширение
 */
function getDirectoryKey(levelDirPath, lang, ext) {
   const dblSlashes = /\\/g;

   levelDirPath = levelDirPath.replace(dblSlashes, '/').split('/').pop();
   return levelDirPath + '.' + lang + '.' + ext;
}

function checkInAvailableLang(language, availableLang) {
   if (language && language in availableLang) {
      return language;
   } else if (language) {
      for (const key in availableLang) {
         if (!availableLang.hasOwnProperty(key)) {
            continue;
         }
         if (key.split('-').pop() === language) {
            return key;
         }
      }
   }

}

function fillLocalDicts(levelLocalDict, availableLang, absPath, JS, CSS, Country) {
   let language = JS && JS[1] || CSS && CSS[1] || Country && Country[1];
   language = checkInAvailableLang(language, availableLang);

   if (language) {
      if (!levelLocalDict[language]) {
         levelLocalDict[language] = {
            levelDicts: [],
            levelCss: [],
            levelCountryCss: []
         };
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

      const
         temp = getAvailableLang(languages),
         availableLang = temp.availableLanguage,
         defLang = temp.defaultLanguage,
         jsDict = {},
         firstLevelDirs = getFirstLevelDirs(data.cwd),
         applicationRoot = path.join(data.root, data.application),
         resourceRoot = path.join(applicationRoot, 'resources'),
         _const = global.requirejs('Core/constants');

      if (Object.keys(availableLang).length) {
         firstLevelDirs.forEach(function(fstLvlD) {
            const
               levelLocalDict = {};

            grunt.file.recurse(fstLvlD, function(absPath) {
               const JS = absPath.match(data.dict),
                  CSS = absPath.match(data.css),
                  Country = absPath.match(data.country);

               fillLocalDicts(levelLocalDict, availableLang, absPath, JS, CSS, Country);
            });

            for (const langKey in levelLocalDict) {
               if (!levelLocalDict.hasOwnProperty(langKey)) {
                  continue;
               }

               if (levelLocalDict[langKey].levelDicts.length || levelLocalDict[langKey].levelCss.length || levelLocalDict[langKey].levelCountryCss.length) {
                  const country = langKey.substr(3, 2),
                     dictPath = path.join(fstLvlD, 'lang', langKey, langKey + '.json'),
                     cssPath = path.join(fstLvlD, 'lang', langKey, langKey + '.css'),
                     countryCssPath = path.join(fstLvlD, 'lang', country, country + '.css'),
                     mergedCss = mergeCss(grunt, cssPath, levelLocalDict[langKey].levelCss),
                     mergedCountryCss = mergeCountryCss(grunt, countryCssPath, levelLocalDict[langKey].levelCountryCss);

                  let mergedDicts;

                  if (fs.existsSync(dictPath)) {
                     mergedDicts = JSON.parse(fs.readFileSync(dictPath));
                  } else {
                     mergedDicts = {};
                  }


                  const relativeDictPath = path.relative(resourceRoot, dictPath).replace(dblSlashes, '/'),
                     dictModuleDeps = [],
                     dictModuleArgs = [],
                     moduleStart = '(function() {var global = (function(){ return this || (0,eval)("this"); }()),' +
                        'define = global.define || (global.requirejs && global.requirejs.define) || (requirejsVars && requirejsVars.define);';

                  let relativeCssPath,
                     relativeCounryPath,
                     dictModuleContent = '';

                  if (Object.keys(mergedDicts).length) {
                     dictModuleDeps.push('"text!' + relativeDictPath.replace(isWS, 'WS') + '"');
                     dictModuleArgs.push('dict');
                     dictModuleContent += 'i18n.setDict(JSON.parse(dict), "text!' + relativeDictPath.replace(isWS, 'WS') + '", "' + langKey + '");';

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

                  if (dictModuleDeps.length) {
                     dictModuleDeps.unshift('"Core/i18n"');
                     dictModuleArgs.unshift('i18n');
                     fs.writeFileSync(dictPath.replace('.json', '.js'), moduleStart + 'global.requirejs(["Core/core-init-min"],function(){global.requirejs([' + dictModuleDeps.join() + '],function(' + dictModuleArgs.join() + '){' + dictModuleContent + '});});})();');

                     /*fs.writeFileSync(dictPath.replace('.json', '.js'), moduleStart + 'define("' + dictMouduleName + '", [' + dictModuleDeps.join() + '], ' +
                                'function(' + dictModuleArgs.join() + ') {' + dictModuleContent + '}); global.requirejs(["Core/core-init-min"], function() {global.requirejs(["' + dictMouduleName + '"])});})();');*/
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
};
