'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Вычитывает ключи из словаря в формате json по указаному пути.
 * @param resourceRoot
 * @param nameDir - имя папки
 * @param lang - язык словаря
 * @returns {Object}
 */
function readDict(resourceRoot, nameDir, lang) {
   let dictPath = path.normalize(path.join(resourceRoot, nameDir, 'lang/' + lang + '/' + lang + '.json'));

   if (fs.existsSync(dictPath)) {
      try {
         return JSON.parse(fs.readFileSync(dictPath));
      } catch (e) {
         global.grunt.log.error(`Ошибка чтения словаря по пути ${dictPath}.`);
         global.grunt.log.ok(e);
         return '';
      }
   } else {
      return '';
   }
}

/**
 * Записывает словарь по указаному пути в формате json.
 * @param resourceRoot
 * @param nameDir - имя папки
 * @param data - контент словаря
 * @param lang - язык словаря
 */
function writeDict(resourceRoot, nameDir, data, lang) {
   let dictPath = path.normalize(path.join(resourceRoot, nameDir, 'lang/' + lang + '/' + lang + '.json'));

   if (fs.existsSync(dictPath)) {
      fs.writeFileSync(dictPath, JSON.stringify(data, undefined, 3));
   }
}

/**
 * Получает список языков, которые будут доступны
 * @param languages
 * @returns {Array}
 */
function getAvailableLang(languages) {
   const availableLang = [];
   let lang,
      parts,
      local,
      country;

   if (typeof languages === 'string') {
      languages = languages.replace(/"/g, '').split(';');
      for (let i = 0; i < languages.length; i++) {

         lang = languages[i];
         if (lang.length === 6 && lang[0] === '*') {
            lang = lang.substring(1, 6);
         }

         if (lang.length === 5) {
            parts = lang.split('-');
            local = parts[0].toLowerCase();
            country = parts[1].toUpperCase();
            lang = local + '-' + country;
            availableLang.push(lang);
         }
      }
   }

   return availableLang;
}


/**
 * Находит все словари, формирует общий словарь исключая повторяющиеся ключи.
 * После чего приводит все повторяющиеся ключи к единому значению.
 * Значение ключа в общем словаре определяется первым найденым ключом.
 * Обход модулей происходит по алфавиту.
 * @param grunt
 * @param data
 * @param availableLang - доступные языки локализации
 */
function normalize(grunt, data, availableLang) {
   let
      langs = getAvailableLang(availableLang),
      applicationRoot = path.join(data.root, data.application),
      resourceRoot = path.join(applicationRoot, 'resources'),
      namesDir = fs.readdirSync(resourceRoot).sort(),
      allDict = {},
      unitDict = {},
      needWrite;

   //Найдём все словари и для каждого языка локализации составим единный словарь.
   langs.forEach(function(lang) {
      unitDict[lang] = {};
      namesDir.forEach(function(dir) {
         let dict = readDict(resourceRoot, dir, lang);

         if (dict) {
            if (!allDict[dir]) {
               allDict[dir] = {};
            }
            allDict[dir][lang] = dict;
         } else {
            return;
         }

         Object.keys(dict).forEach(function(key) {
            if (!unitDict[lang][key]) {
               unitDict[lang][key] = dict[key];
            }
         });
      });
   });

   //Проверим ключи в словарях на валидность.
   Object.keys(allDict).forEach(function(dir) {
      Object.keys(allDict[dir]).forEach(function(lang) {
         needWrite = false;
         Object.keys(allDict[dir][lang]).forEach(function(key) {
            if (unitDict[lang][key] && (allDict[dir][lang][key] !== unitDict[lang][key])) {
               needWrite = true;
               allDict[dir][lang][key] = unitDict[lang][key];
            }
         });

         //Если в словарь не вносилось правок, то и перезаписовать его не следует.
         if (needWrite) {
            writeDict(resourceRoot, dir, allDict[dir][lang], lang);
         }
      });
   });

}

module.exports = normalize;
