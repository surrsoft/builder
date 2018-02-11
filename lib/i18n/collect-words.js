'use strict';

const path = require('path'),
   xhtmlParser = global.requirejs('Core/markup/ParserUtilities'),
   logger = require('../logger').logger(),
   tmplLocalizator = require('./tmpl-localizator');


const
   wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
   translate = /{\[([\s\S]+?)]}/g,
   rkRegex = new RegExp('rk *\\( *(["\'][\\S\\s]*?["\']) *\\)', 'g'),
   rWComSingle = new RegExp('[\']([\\S\\s]*?)[\'](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
   rWComDouble = new RegExp('["]([\\S\\s]*?)["](?:,[ ]*["\']([\\S\\s]*?)[\'"])?'),
   isDoT2 = /{{[\S\s]*|[\S\s]*}}/,
   isComment = /^<!--?[\s\S]*?-?->$/,
   isDirective = /%{\w+ [\s\S]+}/,
   isDoctype = /!DOCTYPE/,
   isArray = /Array|array/,
   isContent = /Content|content/;


const optTags = ['option', 'opt', 'options', 'opts'];

let globalComponentsProperties = [];

function findWordsInJsComponent(words, text) {
   let matches,
      matchesWords;

   matches = rkRegex.exec(text);
   while (matches) {
      if (matches[1]) {
         const rW = matches[1][0] === '\'' ? rWComSingle : matches[1][0] === '"' ? rWComDouble : rWComSingle;
         matchesWords = rW.exec(matches[1]);
         if (matchesWords) {
            getWords(words, matchesWords[1], matchesWords[2] ? matchesWords[2] : '');
         }
      }
      matches = rkRegex.exec(text);
   }
}

function getWords(words, key, ctx) {
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
            context: tempCtx
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

      words.push({
         key: key,
         context: tempCtx
      });
   }

}

function findWordsInXHTML(words, text) {
   if (text && text.replace(/\s/g, '')) {
      findWordsInWsExpert(words, text);
      findWordsInDOM(words, text);
   }
}

function findWordsInWsExpert(words, text) {
   let posCtx = -1;
   text.replace(wsExpertComments, function(str, commentContent) {
      commentContent.replace(translate, function(str, key) {
         posCtx = key.indexOf('@@');
         if (posCtx > -1) {
            getWords(words, key.substr(posCtx + 2), key.substr(0, posCtx));
         } else {
            getWords(words, key, '');
         }
         return str;
      });
      return str;
   });
}

/**
 * Проходит по DOM дереву и набирает простые текстовые ноды и компоненты
 */
function findWordsInDOM(words, text) {
   const dom = xhtmlParser.parse(text);
   enumChildNodes(words, dom);
}


/**
 * Перебрать все дочерние узлы
 */
function enumChildNodes(words, node, considerTheCurrentNode) {
   function currentNode(node) {
      if (node.nodeType === 1 && node.nodeName.toLocaleLowerCase() !== 'script' && node.nodeName.toLocaleLowerCase() !== 'style') {
         if (node.hasAttribute('title')) {
            getWords(words, node.getAttribute('title'), '');
         }

         if (node.nodeName !== 'component') {
            enumChildNodes(words, node);
         } else {
            findWordsInComponent(words, node);
         }
      } else if (node.nodeType === 3) {
         if (node.nodeValue && /\S/.test(node.nodeValue) && optTags.indexOf(node.parentNode.nodeName) === -1) {
            getWords(words, node.nodeValue.trim(), '');
         }
      }
   }

   if (considerTheCurrentNode) {
      currentNode(node);
   }

   if (node.nodeType === 1 || node.nodeType === 9) {
      let child = node.firstChild;
      while (child) {
         currentNode(child);
         child = child.nextSibling;
      }
   }
}

/**
 * Перебирает компонент, ищет переводные свойства в аттрибуте config и набирает теги
 */
function findWordsInComponent(words, node) {
   // Для компонента надо вытащить его имя, и найти файл со свойствами
   const
      moduleName = node.getAttribute('data-component'),
      properties = globalComponentsProperties[moduleName],
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
            findWordsInComponent(words, child);
         }
         child = child.nextSibling;
      }

      // Теперь займемся опциями
      enumComponentChildNodes(words, transProp, node, '/');
   } catch (e) {
      logger.error({error: e});
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
      } else if (elem.itemType || globalComponentsProperties[elem.type]) {
         let properties = globalComponentsProperties[elem.itemType || elem.type];
         if (!properties && elem.itemType) {
            properties = globalComponentsProperties[elem.itemType] || {};
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
 */
function enumComponentChildNodes(words, transProp, node, xPath) {
   let child = node.firstChild;

   while (child) {
      // Только теги опций
      if (child.nodeType !== 1 || optTags.indexOf(child.nodeName) === -1) {
         // Делаем допущение для обычных html тегов, их тоже подготавливаем
         enumChildNodes(child, true);
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
                  getWords(words, value.trim(), '');
               } else {
                  getWords(words, child.innerHTML().trim(), '');
               }
               break;
            } else if (transProp[i] === xPath + '$' + name) {
               // Если опция контент и переводится
               if (value) {
                  findWordsInDOM(words, value);
               } else {
                  enumChildNodes(words, child);
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
                           getWords(words, childNode.getAttribute('value').trim(), '');
                        } else {
                           getWords(words, childNode.innerHTML().trim(), '');
                        }
                     } else if (isSimple === false && (childNodeName === 'options' || childNodeName === 'opts')) {
                        enumComponentChildNodes(transProp, childNode, pp + '/');
                     }
                  }
               }
            }
         } else {
            enumComponentChildNodes(transProp, child, xPath + child.getAttribute('name') + '/');
         }
      }
      child = child.nextSibling;
   }
}

async function findWordsInTMPL(words, text, filePath, componentsProperties) {
   let traversedObj = await tmplLocalizator.parseTmpl(text, filePath, componentsProperties);
   if (traversedObj && traversedObj.hasOwnProperty('words')) {
      Array.prototype.push.apply(words, traversedObj.words);
   }
}

async function collectWords(modulePath, filePath, text, componentsProperties) {
   globalComponentsProperties = componentsProperties; //TODO: не особо красиво

   const words = [],
      ext = path.extname(filePath);
   if (ext === '.js') {
      findWordsInJsComponent(words, text);
   } else if (ext === '.xhtml') {
      findWordsInXHTML(words, text);
   } else if (ext === '.tmpl') {
      await findWordsInTMPL(words, text, filePath, componentsProperties);
   }

   for (let word of words) {
      word.ui = modulePath;
      word.module = filePath;
   }
   return words;
}

module.exports = collectWords;

