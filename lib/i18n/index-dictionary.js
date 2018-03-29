'use strict';

const path = require('path');
const fs = require('fs-extra');
const logger = require('../logger').logger();
const getLanguageByLocale = require('../get-language-by-locale');
const helpers = require('../helpers');
const cssHelpers = require(path.join(path.resolve('node_modules'), 'grunt-wsmod-packer/lib/cssHelpers.js'));
const resolveUrl = cssHelpers.rebaseUrls;
const bumpImportsUp = cssHelpers.bumpImportsUp;
const dblSlashes = /\\/g;
const isWS = /^\.\.\/ws/;

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
      let content = getContents(grunt, absolutePath);
      if (content) {
         Object.keys(keys).forEach(function(key) {
            content[key] = keys[key];
         });
         content = helpers.sortObject(content);
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
      languageCulture,
      parts,
      language,
      country;

   if (typeof languages === 'string') {
      languages = languages.replace(/"/g, '').split(';');
      for (let i = 0; i < languages.length; i++) {
         let isDef = false;

         languageCulture = languages[i];
         if (languageCulture.length === 6 && languageCulture[0] === '*') {
            languageCulture = languageCulture.substring(1, 6);
            isDef = true;
         }

         if (languageCulture.length === 5) {
            parts = languageCulture.split('-');
            language = parts[0].toLowerCase();
            country = parts[1].toUpperCase();
            languageCulture = language + '-' + country;
            defLang = isDef ? languageCulture : defLang;
            availableLang[languageCulture] = getLanguageByLocale(languageCulture);
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

/**
 * Индексирует словари и записывает информацию о них в contents.json
 * @param {Object} grunt
 * @param {String} languages - Языки для индексации
 * @param {Object} data - Конфигурация таски
 * @param done
 */
function indexDict(grunt, languages, data, done) {
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

               let mergedDicts = {};


               if (fs.existsSync(dictPath)) {
                  try {
                     mergedDicts = JSON.parse(fs.readFileSync(dictPath));
                  } catch (e) {
                     logger.error({
                        message: 'Ошибка чтения словаря по пути',
                        error: e,
                        filePath: dictPath
                     });
                  }
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
                  fs.writeFileSync(dictPath.replace('.json', '.js'), moduleStart + 'global.requirejs(["Core/core-ready"],function(){global.requirejs([' + dictModuleDeps.join() + '],function(' + dictModuleArgs.join() + '){' + dictModuleContent + '});});})();');
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

module.exports = indexDict;
