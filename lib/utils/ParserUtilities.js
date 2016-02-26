'use strict';

var
   rawTextElements = /^<(script|style|textarea|title)/i,
   tagRegExp = /(<\/?[a-z]\w*(?:\s*(?:[\w\-:]+|{{[\s\S]+?}})(?:\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[a-z0-9.:_-]+))?)*\s*\/?>)|([^<]|<(?![a-z\/]))*/gi,
   attrRegExp = /\s[a-z0-9-_:]+(?:(=(?:"[\s\S]*?"|'[\s\S]*?'|[a-z0-9.:_-]+))|(?:\b(?=\s|\/|>)))/gi,
   startTag = /^<[a-z]/,
   selfClose = /\/>$/,
   closeTag = /^<\//,
   nodeName = /<\/?([a-z][a-z0-9]*)/i,
   attributeQuotes = /^('|")|('|")$/g,
   reFirstQuote = /^('|")/,
   wsExpertComments = /<!--WS-EXPERT|WS-EXPERT-->/g,
   htmlComments = /<!--(?:[^\[\/][\s\S]*?)?-->/gi,
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
               startTag += ' ' + attr.name + (attr.value ? '=' + usedQuote + (attr.value + '').replace(quotes, '&quot;') + usedQuote : '');
            }
         } else {
            startTag += self._junk[++state.junkIdx];
         }
         return state;
      }, {attrIdx: -1, junkIdx: -1});

      startTag += this.startTag.indexOf('/>') != -1 ? '/>' : '>';
   }

   return startTag + this.innerHTML() + closeTag;
};

/**
 * Получить дочерний элемент по имени тега
 */
Node.prototype.getElementsByTagName = function (tagName) {
   var result = [];
   if (this.nodeType !== 3) {
      this.childNodes.forEach(function (cNode) {
         if (cNode.nodeName == tagName) {
            result.push(cNode);
         }
         result = result.concat(cNode.getElementsByTagName(tagName));
      });
   }
   return result;
};

/**
 * Распарсить разметку. Получим ноду, где разметка будет дочерними элементами
 * @param {String} markup - разметка
 * @returns {Node}
 */
function parse(markup) {
   var
      tags = markup instanceof Array ? markup : markup.replace(wsExpertComments, '').replace(htmlComments, '').match(tagRegExp),
      result = new Node({
         nodeType: 1,
         childNodes: [],
         parentNode: null
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

         while ((attrStr = attrRegExp.exec(tag)) !== null) {

            junk = tag.substring(parseStart, attrStr.index);
            parseStart = attrRegExp.lastIndex;
            if (junk && junk.trim()) {
               junks.push(junk);
               sequence.push('j');
            }

            attrBuffer = attrStr[0].split('=');
            attrName = attrBuffer.shift().trim();
            attrValue = attrBuffer.join('=');
            firstQuote = attrValue.match(reFirstQuote);
            attributes.push({
               name: attrName,
               value: (attrValue || '').replace(attributeQuotes, '').replace(quotesEncoded, '"'),
               _quotes: firstQuote && firstQuote[0]
            });
            sequence.push('a');
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