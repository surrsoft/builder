'use strict';

const path = require('path'),
   xhtmlParser = global.requirejs('Core/markup/ParserUtilities'),
   Deferred = global.requirejs('Core/Deferred'),
   logger = require('../logger').logger(),
   jsonGenerator = require('./jsonGenerator'),
   tmplLocalizator = require('./tmplLocalizator'),
   fs = require('fs');


const
   wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
   translate = /\{\[([\s\S]+?)]}/g,
   r = new RegExp('rk *\\( *(["\'][\\S\\s]*?["\']) *\\)', 'g'),
   rWComSingle = new RegExp('[\']([\\S\\s]*?)[\'](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
   rWComDouble = new RegExp('["]([\\S\\s]*?)["](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
   isDoT2 = /{{[\S\s]*|[\S\s]*}}/,
   isComment = /^<!--?[\s\S]*?-?->$/,
   isDirective = /%{\w+ [\s\S]+}/,
   isDoctype = /!DOCTYPE/,
   isAMD = /define[\S\s]*?\([\S\s]*?["']js!([A-Za-z0-9\.]+)["']/,
   isArray = /Array|array/,
   isContent = /Content|content/;

(function() {
   const
      optTags = ['option', 'opt', 'options', 'opts'],
      components = {},
      words = [],
      wordsPromises = [];


   let
      componentsProperties = {},
      jsonOutput,
      grunt,
      cwd,
      i18nCacheContent;

   const progress = {
      count: 0,
      log: function(curCount, moduleName) {
         const percent = curCount * 100 / this.count,
            name = path.normalize(moduleName).split(path.sep).pop();
         logger.progress(percent / this.count, 'UI ' + name);
      }
   };

   /**
    *
    * @param pathToSource
    * @param text
    */
   function readWordsInModule(pathToSource, text) {
      let matches,
         matchesWords;

      // Поищем за одно и слова для перевода
      matches = r.exec(text);
      while (matches) {
         if (matches[1]) {
            const rW = matches[1][0] === '\'' ? rWComSingle : matches[1][0] === '"' ? rWComDouble : rWComSingle;
            matchesWords = rW.exec(matches[1]);
            if (matchesWords) {
               pushKey(matchesWords[1], matchesWords[2] ? matchesWords[2] : '', pathToSource);
            }
         }
         matches = r.exec(text);
      }
   }

   /**
    *
    * @param key
    * @param ctx
    * @param module
    * @param ignoreCache
    */
   function pushKey(key, ctx, module, ignoreCache) {
      let tempCtx = ctx.trim();

      if (!key || isComment.test(key) || isDirective.test(key) || isDoctype.test(key)) {
         return;
      }

      if (isDoT2.test(key)) {
         key.replace(translate, function(match, p1) {
            if (p1.indexOf('@@') > -1) {
               // Значит в ключе содержится контекст
               tempCtx = p1.substring(0, p1.indexOf('@@'));
               p1 = p1.substr(p1.indexOf('@@') + 2);
            }

            words.push({
               key: p1,
               context: tempCtx,
               module: module,
               ui: cwd
            });

            return p1;
         });
      } else {
         key = key.replace(translate, '$1');

         if (key.indexOf('@@') > -1) {
            // Значит в ключе содержится контекст
            tempCtx = key.substring(0, key.indexOf('@@'));
            key = key.substr(key.indexOf('@@') + 2);
         }

         if (!ignoreCache) {
            addToCache(module, key, tempCtx);
         }

         words.push({
            key: key,
            context: tempCtx,
            module: module,
            ui: cwd
         });
      }

   }

   /**
    * Ищет все компоненты и их свойства в папке --root + --application
    * @param cwd
    */
   function findComponentsAndProperties(cwd) {
      const sourceFiles = grunt.file.expand({cwd: cwd}, ['**/*.module.js']);
      let text,
         modName;

      sourceFiles.forEach(function(pathToSource) {
         // Вычитаем файл с модулем, и найдем в нем название модуля
         pathToSource = path.join(cwd, pathToSource);
         if (!checkCache(pathToSource)) {
            text = grunt.file.read(pathToSource);
            if (text) {
               modName = (modName = text.match(isAMD)) ? modName[1] : false;
               if (modName && !components[modName]) {
                  components[modName] = pathToSource;

                  // Здесь же получим свойства компонента
                  componentsProperties = jsonGenerator.componentsProperties();
                  readWordsInModule(pathToSource, text);
               }
            }
         }
      });
   }

   /**
    *
    * @param cwd
    */
   function findWordsInXHTML(cwd) {
      const sourceFiles = grunt.file.expand({cwd: cwd}, ['**/*.xhtml', '**/*.tmpl']);
      let absPath,
         text;

      sourceFiles.forEach(function(pathToSource) {
         absPath = path.join(cwd, pathToSource);
         if (!checkCache(absPath)) {
            text = grunt.file.read(absPath);
            if (text && text.replace(/\s/g, '')) {
               findWordsInWsExpert(text, absPath);
               findWordsInDOM(text, absPath);
            }
         }
      });
   }

   function findWordsInWsExpert(text, absPath) {
      let posCtx = -1;
      text.replace(wsExpertComments, function(str, commentContent) {
         commentContent.replace(translate, function(str, key) {
            posCtx = key.indexOf('@@');
            if (posCtx > -1) {
               pushKey(key.substr(0, posCtx), key.substr(posCtx + 2), absPath);
            } else {
               pushKey(key, '', absPath);
            }
            return str;
         });
         return str;
      });
   }

   /**
    * Проходит по DOM дереву и набирает простые текстовые ноды и компоненты
    * @param {String} text - текст из xhtml файла
    * @param currentPath
    */
   function findWordsInDOM(text, currentPath) {
      let dom;
      try {
         logger.debug(`createResultDictionary::findWordsInDOM::currentPath -> ${currentPath}`);

         if (/\.tmpl$/.test(currentPath)) {
            wordsPromises.push(tmplLocalizator.parseTmpl(text, currentPath));
         } else {
            dom = xhtmlParser.parse(text);
            enumChildNodes(dom, currentPath);
         }
      } catch (e) {
         logger.warning({
            message: 'Can\'t parse DOM ',
            error: e,
            filePath: currentPath
         });
      }
   }

   /**
    * Перебрать все дочерние узлы
    * @param node
    * @param absPath
    * @param considerTheCurrentNode
    */
   function enumChildNodes(node, absPath, considerTheCurrentNode) {
      function currentNode(node, absPath) {
         if (node.nodeType === 1 && node.nodeName.toLocaleLowerCase() !== 'script' && node.nodeName.toLocaleLowerCase() !== 'style') {
            if (node.hasAttribute('title')) {
               pushKey(node.getAttribute('title'), '', absPath);
            }

            if (node.nodeName !== 'component') {
               enumChildNodes(node, absPath);
            } else {
               findWordsInComponent(node, absPath);
            }
         } else if (node.nodeType === 3) {
            if (node.nodeValue && /\S/.test(node.nodeValue) && optTags.indexOf(node.parentNode.nodeName) === -1) {
               pushKey(node.nodeValue.trim(), '', absPath);
            }
         }
      }

      if (considerTheCurrentNode) {
         currentNode(node, absPath);
      }

      if (node.nodeType === 1 || node.nodeType === 9) {
         let child = node.firstChild;
         while (child) {
            currentNode(child, absPath);
            child = child.nextSibling;
         }
      }
   }

   /**
    * Перебирает компонент, ищет переводные свойства в аттрибуте config и набирает теги
    * @param node - элемент компонента
    * @param absPath
    */
   function findWordsInComponent(node, absPath) {
      // Для компонента надо вытащить его имя, и найти файл со свойствами
      const
         moduleName = node.getAttribute('data-component'),
         properties = componentsProperties[moduleName],
         transProp = [];

      if (properties && Object.keys(properties).length && properties.properties && properties.properties['ws-config']) {
         propertiesParser(transProp, properties.properties['ws-config'].options, '', moduleName);
      }

      // Нужно пройтись по детям компонента
      try {
         // Сначала пройдем в глубь и найдем только компоненты
         let child = node.firstChild;
         while (child) {
            if (child.nodeType === 1 && child.nodeName === 'component') {
               findWordsInComponent(child, absPath);
            }
            child = child.nextSibling;
         }

         // Теперь займемся опциями
         enumComponentChildNodes(transProp, node, '/', absPath);
      } catch (e) {
         grunt.log.error(e);
      }
   }

   /**
    * Рекурсивно проходит по свойствам компонента и находит все перводные свойства
    * Записывает их в массив transPropXPath
    * @param transPropXPath - массив с путями до переводных свойств
    * @param object - входящий объект
    * @param propPath - текущий путь до объекта
    * @param moduleName
    */
   function propertiesParser(transPropXPath, object, propPath, moduleName) {
      if (!object) {
         return;
      }

      Object.keys(object).forEach(function(key) {
         const
            elem = object[key],
            isCompType = isArray.test(elem.type) ? '@' : isContent.test(elem.type) ? '$' : '';

         if (elem.options) {
            propertiesParser(transPropXPath, elem.options, propPath + '/' + isCompType + key, moduleName);
         } else if (elem.itemType || components[elem.type]) {
            let properties = componentsProperties[elem.itemType || elem.type];
            if (!properties && elem.itemType) {
               properties = componentsProperties[elem.itemType] || {};
            }

            if (properties && Object.keys(properties).length && properties.properties && properties.properties['ws-config']) {
               propertiesParser(transPropXPath, properties.properties['ws-config'].options, propPath + '/' + isCompType + key, moduleName);
            }
         } else if (elem.translatable || isCompType === '$') {
            transPropXPath.push(propPath + '/' + isCompType + key);
         }
      });
   }

   /**
    * Перебирает все теги option и options
    * @param transProp
    * @param node
    * @param xPath
    * @param absPath
    */
   function enumComponentChildNodes(transProp, node, xPath, absPath) {
      let child = node.firstChild;

      while (child) {
         // Только теги опций
         if (child.nodeType !== 1 || optTags.indexOf(child.nodeName) === -1) {
            // Делаем допущение для обычных html тегов, их тоже подготавливаем
            enumChildNodes(child, absPath, true);
            child = child.nextSibling;
            continue;
         }

         const nodeName = child.nodeName,
            name = child.hasAttribute('name') ? child.getAttribute('name') : '',
            value = child.hasAttribute('value') ? child.getAttribute('value') : '',
            type = child.hasAttribute('type') ? child.getAttribute('type') : '';

         // Здесь либо option, либо options, либо components, остальное игнорим
         if (nodeName === 'option' || nodeName === 'opt') {
            // Переберем массив transProp и поищем эту опцию
            for (let i = 0; i < transProp.length; ++i) {
               if (transProp[i] === xPath + name) {
                  if (value) {
                     pushKey(value.trim(), '', absPath);
                  } else {
                     pushKey(child.innerHTML().trim(), '', absPath);
                  }
                  break;
               } else if (transProp[i] === xPath + '$' + name) {
                  // Если опция контент и переводится
                  if (value) {
                     findWordsInDOM(value, absPath);
                  } else {
                     enumChildNodes(child, absPath);
                  }
                  break;
               }
            }
         } else if (nodeName === 'options' || nodeName === 'opts') {
            if (isArray.test(type)) {
               const pp = xPath + '@' + name;
               let isSimple;

               // Надо понять, массив может хранить сложные типы или нет
               for (let i = 0; i < transProp.length; ++i) {
                  if (transProp[i] === pp) {
                     isSimple = true;
                     break;
                  } else if (transProp[i].indexOf(pp) !== -1) {
                     isSimple = false;
                     break;
                  }
               }

               if (isSimple !== undefined) {
                  const childNodes = child.childNodes;
                  for (let i = 0; i < childNodes.length; i++) {
                     const childNode = childNodes[i],
                        childNodeName = childNode.nodeName;
                     if (childNode.nodeType === 1) {
                        if (isSimple === true && (childNodeName === 'option' || childNodeName === 'opt')) {
                           if (childNode.hasAttribute('value')) {
                              pushKey(childNode.getAttribute('value').trim(), '', absPath);
                           } else {
                              pushKey(childNode.innerHTML().trim(), '', absPath);
                           }
                        } else if (isSimple === false && (childNodeName === 'options' || childNodeName === 'opts')) {
                           enumComponentChildNodes(transProp, childNode, pp + '/', absPath);
                        }
                     }
                  }
               }
            } else {
               enumComponentChildNodes(transProp, child, xPath + child.getAttribute('name') + '/', absPath);
            }
         }
         child = child.nextSibling;
      }
   }

   function checkCache(pathToSource) {
      let mtime,
         fromCache;

      try {
         mtime = new Date(fs.statSync(pathToSource).mtime);
      } catch (e) {
         grunt.log.error(e);
         return;
      }

      if (pathToSource in i18nCacheContent && (+mtime === +new Date(i18nCacheContent[pathToSource].mtime))) {
         i18nCacheContent[pathToSource].words.filter(function(word) {
            return !(word instanceof Deferred);
         }).forEach(function(word) {
            pushKey(word.key, word.ctx, pathToSource, true);
         });

         fromCache = true;
      } else {
         delete i18nCacheContent[pathToSource];
      }

      return fromCache;
   }

   function addToCache(pathToSource, key, ctx) {
      if (!i18nCacheContent[pathToSource]) {
         i18nCacheContent[pathToSource] = {
            mtime: fs.statSync(pathToSource).mtime,
            words: [
               {
                  key: key,
                  ctx: ctx
               }
            ]
         };
      } else {
         i18nCacheContent[pathToSource].words.push({
            key: key,
            ctx: ctx
         });
      }
   }

   module.exports = {
      createResultDict: function(g, done) {
         if (!g) {
            return;
         } else {
            grunt = g;
         }

         grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается построение результирующего словаря.');

         // Нужные еще опции --out и --modules
         const out = grunt.option('out').replace(/"/g, ''),
            modules = grunt.option('modules').replace(/"/g, ''),
            cache = grunt.option('json-cache').replace(/"/g, ''),
            i18nCache = path.join(cache, 'i18n-cache.json');

         if (!out) {
            grunt.fail.fatal('Parameter "out" is not find');
            return;
         }

         if (!modules) {
            grunt.fail.fatal('Parameter "modules" is not find');
            return;
         }

         i18nCacheContent = grunt.file.exists(i18nCache) ? grunt.file.read(i18nCache) || '{}' : '{}';

         i18nCacheContent = JSON.parse(i18nCacheContent);

         // Считаем что builder лужит в jinnee в папке distrib\builder\
         jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');

         jsonGenerator.run(modules, jsonOutput, function(error) {
            if (error) {
               grunt.log.error(error);
            }

            let paths = modules.split(';');

            // Теперь в параметре modules может быть и путь до файла json
            if (paths.length === 1 && grunt.file.isFile(modules)) {
               try {
                  paths = grunt.file.readJSON(modules);
                  if (!Array.isArray(paths)) {
                     grunt.log.error('Parameter "modules" incorrect');
                     return;
                  }
               } catch (e) {
                  grunt.log.error('Parameter "modules" incorrect. Can\'t read ' + modules);
                  return;
               }
            }

            // Выставим размер прогресс бара, два цикла будет
            progress.count = paths.length * 2;

            // Надо пройтись по всем путям, и найти компоненты
            for (let i = 0, len = paths.length; i < len; i++) {
               if (!paths[i]) {
                  continue;
               }
               cwd = paths[i];
               try {
                  progress.log(i, paths[i]);
                  findComponentsAndProperties(paths[i]);
               } catch (e) {
                  grunt.fail.fatal(e);
               }
            }

            // Теперь еще раз проходимся по модулям и ищем xhtml файлы, когда уже есть все компоненты
            for (let i = 0, len = paths.length; i < len; i++) {
               if (!paths[i]) {
                  continue;
               }
               cwd = paths[i];
               try {
                  progress.log(len + i, paths[i]);
                  findWordsInXHTML(paths[i]);
               } catch (e) {
                  grunt.log.error(e);
               }
            }

            progress.log(paths.length * 2, 'Сбор слов завершен');

            if (wordsPromises.length) {
               Promise.all(wordsPromises)
                  .then(function(results) {
                     let resultWords = words || [];
                     results.forEach(function(result) {
                        if (result.hasOwnProperty('words')) {
                           result = result.words || [];
                        }
                        result.forEach(function(newWord) {
                           newWord.ui = cwd;
                        });
                        resultWords = resultWords.concat(result);
                     });
                     writeWords(resultWords);
                  }, function(err) {
                     logger.error({
                        error: err
                     });
                  });
            } else {
               writeWords(words);
            }

            function writeWords(words) {
               // Записать в результирующий словарь
               try {
                  grunt.file.write(out, JSON.stringify(words, null, 2));
                  grunt.file.write(i18nCache, JSON.stringify(i18nCacheContent, null, 2));
               } catch (err) {
                  logger.error({
                     message: 'Could\'t create output file ',
                     filePath: out,
                     error: err
                  });
               }

               logger.info(grunt.template.today('hh:MM:ss') + ': Построение результирующего словаря выполнено.');

               done(error);
            }
         });
      }
   };
})();
