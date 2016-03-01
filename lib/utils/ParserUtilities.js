'use strict';

var
   rawTextElements = /^<(script|style|textarea|title)/i,
   tagRegExp = /(<\/?[a-z]\w*(?:\s*(?:[\w\-:]+|{{[\s\S]+?}})(?:\s*=\s*(?:"[^"]*?"|'[^']*?'|[a-z0-9.:_-]+))?)*\s*\/?>)|([^<]|<(?![a-z\/]))*/gi,
   attrRegExp = /\s[a-z0-9-_:]+(?:(=(?:"[^"]*?"|'[^']*?'|[a-z0-9.:_-]+))|(?:\b(?=\s|\/|>)))/gi,
   doTbracket = /({{|}})/,
   startTag = /^<[a-z]/,
   selfClose = /\/>$/,
   closeTag = /^<\//,
   nodeName = /<\/?([a-z][a-z0-9]*)/i,
   attributeQuotes = /^('|")|('|")$/g,
   reFirstQuote = /^('|")/,
   htmlComments = /<!--(?:[^\[\/][\s\S]*?)?-->/gi,
   conditionalComments = /<!--(\[[\s\S]*?\])-->/gi,
   conditionalCommentsReplacements = /<!-#\/CC#(\d+)#->/gi,
   wsExpertComments = /<!--WS-EXPERT([\s\S]+?)WS-EXPERT-->/g,
   wsExpertCommentsReplacements = /<!-#\/WEC#(\d+)#->/gi,
   quotesEncoded = /&quot;/g,
   quotes = /"/g;

/**
 * Минимальный вариант node
 * @class
 */
function Node(cfg) {
   var self = this;
   this.startTag = cfg.startTag || '';
   this.closeTag = '';

   this.nodeType = cfg.nodeType;
   this.nodeName = cfg.nodeName;
   this.attributes = cfg.attributes || [];
   this.childNodes = cfg.childNodes;
   this.parentNode = cfg.parentNode;
   this.nodeValue = cfg.nodeValue;
   this._sequence = cfg._sequence || [];
   this._junk = cfg._junk || [];
   this._weStore = cfg._weStore || [];
   this._ccStore = cfg._ccStore || [];

   Object.defineProperty(this, 'firstChild', {
      get: function () {
         return self.childNodes[0];
      }
   });

   Object.defineProperty(this, 'nextSibling', {
      get: function () {
         var
            sublings = self.parentNode.childNodes,
            i = sublings.indexOf(self);
         return sublings.length > i ? sublings[i + 1] : null;
      }
   });
}

/**
 * Удалить условный комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function removeConditionalComments(markup, store) {
   return markup.replace(conditionalComments, function(str, commentContent) {
      store.push(commentContent);
      return '<!-#/CC#' + (store.length - 1) + '#->';
   });
}

/**
 * Восстановить условынй комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function restoreConditionalComments(markup, store) {
   return store.length ? markup.replace(conditionalCommentsReplacements, function(str, commentID) {
      return '<!--' + store[+commentID] + '-->';
   }) : markup;
}

/**
 * Удалить WS-EXPERT комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function removeWsExpertComments(markup, store) {
   return markup.replace(wsExpertComments, function(str, commentContent) {
      store.push(commentContent);
      return '<!-#/WEC#' + (store.length - 1) + '#->';
   });
}

/**
 * Восстановить WS-EXPERT комментарий
 * @param {String} markup - разметка
 * @param {Array} store - хранилище для комментариев
 * @returns {String}
 */
function restoreWsExpertComments(markup, store) {
   return store.length ? markup.replace(wsExpertCommentsReplacements, function(str, commentID) {
      return '<!--WS-EXPERT' + store[+commentID] + 'WS-EXPERT-->';
   }) : markup;
}

function removeAllComments(markup, weStore, ccStore) {
   // WS-EXPERT не трогаем, там все живет своей жизнью
   markup = removeWsExpertComments(markup, weStore);
   // Условные комментарии тоже оставим, там тоже своя жизнь
   markup = removeConditionalComments(markup, ccStore);
   // Почистим комментарии
   markup = markup.replace(htmlComments, '');
   return markup;
}

function restoreAllComments(markup, weStore, ccStore) {
   markup = restoreConditionalComments(markup, ccStore);
   markup = restoreWsExpertComments(markup, weStore);

   return markup;
}

/**
 * Проверка наличия атрибута
 * @return {Boolean}
 */
Node.prototype.hasAttribute = function (attributeName) {
   this.attributes.forEach(function (attribute) {
      if (attribute.name == attributeName) {
         return true;
      }
   });
   return false;
};

/**
 * Получить значение атрибута
 * @return {String}
 */
Node.prototype.getAttribute = function (attributeName) {
   this.attributes.forEach(function (attribute) {
      if (attribute.name == attributeName) {
         return attribute.value;
      }
   });
   return null;
};

Node.prototype.setAttribute = function (attributeName, attributeValue) {
   var attr = attributes.find(function (attr) {
      return attr.name === attributeName;
   });

   attributeValue = '' + attributeValue;

   if (attr) {
      attr.value = attributeValue;
   } else {
      this.attributes.push({
         name: attributeName,
         value: attributeValue,
         _quotes: '"'
      });
      this._sequence.push('a');
   }
};

/**
 * Получить/установить внутренний контент
 * Если есть параметр, то устанавливаем контент
 * @param {Array} [content]
 */
Node.prototype.innerHTML = function (content) {
   var
      result = '',
      cNode;

   // Это сеттер
   if (content !== undefined) {
      if (typeof(content) !== 'string') {
         throw new Error('Invalid parameter format');
      }

      if (this.nodeType !== 1) {
         throw new Error('Only element node can change the innerHTML property');
      }

      result = content;

      cNode = parse(result);
      this.childNodes = cNode.childNodes;

      return result;
   }

   // А это геттер
   if (this.nodeType === 3) {
      result += this.nodeValue;
   } else {
      this.childNodes.forEach(function (cNode) {
         result += cNode.nodeType === 3 ? cNode.nodeValue : cNode.outerHTML();
      });
   }
   return result;
};

/**
 * Получить контент ноды текстом
 */
Node.prototype.outerHTML = function () {
   var
      self = this,
      startTag = '',
      closeTag = '';

   if (this.nodeType == 1) {
      closeTag = this.closeTag ? ('</' + this.nodeName + '>') : '';
      startTag += '<' + this.nodeName;

      this._sequence.reduce(function (state, seq) {
         var attr, usedQuote;
         if (seq == 'a') {
            attr = self.attributes[++state.attrIdx];
            if (attr) {
               usedQuote = attr._quotes && attr._quotes[0] || '';
               startTag += ' ' + attr.name + (attr.value !== undefined && attr.value !== null ?
                  '=' + usedQuote + (attr.value + '').replace(quotes, '&quot;') + usedQuote : '');
            }
         } else {
            startTag += self._junk[++state.junkIdx];
         }
         return state;
      }, {attrIdx: -1, junkIdx: -1});

      startTag += this.startTag.indexOf('/>') != -1 ? '/>' : '>';
   }

   return startTag + restoreAllComments(this.innerHTML(), this._weStore, this._ccStore) + closeTag;
};

/**
 * Распарсить разметку. Получим ноду, где разметка будет дочерними элементами
 * @param {String} markup - разметка
 * @returns {Node}
 */
function parse(markup) {
   var
      weStore = [],
      ccStore = [],
      tags = markup instanceof Array ? markup : removeAllComments(markup, weStore, ccStore).match(tagRegExp),
      result = new Node({
         nodeType: 9,
         childNodes: [],
         parentNode: null,
         _weStore: weStore,
         _ccStore: ccStore
      }),
      buffer,
      currentObject = result,
      tag, firstQuote,
      attrName, attrValue,
      attrBuffer = [],
      attrStr = [],
      attributes, isSelfClosed, nodeNameParts, parseStart, sequence, junks, junk;

   for (var i = 0, l = tags.length; i < l; i++) {
      tag = tags[i];

      if (!tag) {
         continue;
      }

      // Обработка элементов, в которых может быть только текст
      if (currentObject && rawTextElements.test(currentObject.startTag)) {
         if (closeTag.test(tag) && tag.match(nodeName)[1] == currentObject.nodeName) {
            // Если это наш закрывающий тэг то идем в обычный разбор
         } else {
            currentObject.childNodes.push(new Node({
               nodeType: 3,
               nodeValue: tag,
               parentNode: currentObject
            }));
            continue;
         }
      }

      if (startTag.test(tag)) {
         attributes = [];
         isSelfClosed = tag.indexOf('/>') !== -1;
         nodeNameParts = tag.match(nodeName);
         parseStart = nodeNameParts[0].length;
         sequence = [];
         junks = [];

         attrRegExp.lastIndex = parseStart;

         while ((tag.indexOf('data-component') > -1 || !doTbracket.test(tag)) && (attrStr = attrRegExp.exec(tag)) !== null) {
            attrBuffer = attrStr[0].split('=');
            attrName = attrBuffer.shift().trim();
            attrValue = attrBuffer.join('=');

            if (!doTbracket.test(tag) || (attrName == 'data-component' && !doTbracket.test(attrValue))) {
               firstQuote = attrValue.match(reFirstQuote);
               attributes.push({
                  name: attrName,
                  value: (attrValue || '').replace(attributeQuotes, '').replace(quotesEncoded, '"'),
                  _quotes: firstQuote && firstQuote[0]
               });
               sequence.push('a');

               junk = tag.substring(parseStart, attrStr.index);
               parseStart = attrRegExp.lastIndex;
               if (junk && junk.trim()) {
                  junks.push(junk);
                  sequence.push('j');
               }
            }
         }

         junk = tag.substring(parseStart, tag.length - (isSelfClosed ? 2 : 1));
         if (junk && junk.trim()) {
            junks.push(junk);
            sequence.push('j');
         }

         currentObject.childNodes.push(buffer = new Node({
            nodeType: 1, //element node
            nodeName: nodeNameParts[1],
            attributes: attributes,
            _junk: junks,
            _sequence: sequence,
            childNodes: [],
            parentNode: currentObject,
            startTag: tag
         }));
         if (!selfClose.test(tag)) {
            currentObject = buffer;
         }
      } else if (closeTag.test(tag)) {
         currentObject.closeTag = tag;
         currentObject = currentObject.parentNode;
      } else {
         currentObject.childNodes.push(new Node({
            nodeType: 3,
            nodeValue: tag,
            parentNode: currentObject
         }));
      }
   }
   return result;
}

module.exports = {
   parse: parse
};