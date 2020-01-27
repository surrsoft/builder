'use strict';

const esprima = require('esprima');
const { traverse } = require('estraverse');
const escodegen = require('escodegen');
const path = require('path');
const fs = require('fs-extra');
const rebaseUrlsToAbsolutePath = require('./css-helpers').rebaseUrls;
const helpers = require('../../lib/helpers');

const loaders = {
   default: baseTextLoader,
   js: jsLoader,
   html: wmlLoader,
   xhtml: wmlLoader,
   tmpl: wmlLoader,
   wml: wmlLoader,
   json: jsonLoader,
   text: textLoader,
   browser: browserLoader,
   optional: optionalLoader,
   is: isLoader,

   css: cssLoader,
   'native-css': cssLoader
};

/**
 * Read file and wrap as text module.
 * @param {Meta} module - current module meta for packer
 */
async function baseTextLoader(module, base) {
   const content = await fs.readFile(module.fullPath, 'utf8');
   const relativePath = helpers.unixifyPath(path.relative(base, module.fullPath));
   return `define("${relativePath}", ${JSON.stringify(content)});`;
}

/**
 * Read js and inserts a module name into "define" function if name not specified
 * Use AST
 * @param {Meta} module - current module meta for packer
 */
async function jsLoader(module) {
   const content = await fs.readFile(module.fullPath, 'utf8');
   if (!content || !module.amd) {
      return '';
   }

   const ast = esprima.parse(content);
   traverse(ast, {
      enter: function detectAnonymousModules(node) {
         if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'define'
         ) {
            // Check anonnimous define
            if (node.arguments.length < 3) {
               if (
                  node.arguments.length === 2 &&
                  node.arguments[0].type === 'Literal' &&
                  typeof node.arguments[0].value === 'string'
               ) {
                  // define('somestring', /* whatever */);
               } else {
                  module.anonymous = true;
               }
            }

            // Check additional dependencies
            if (!String(module.fullName).startsWith('Core/') && module.defaultLocalization) {
               if (!node.arguments[1].elements) {
                  node.arguments.splice(1, 0, {
                     elements: [],
                     type: 'ArrayExpression'
                  });
               }
               node.arguments[1].elements.push({
                  raw: module.defaultLocalization,
                  type: 'Literal',
                  value: module.defaultLocalization
               });
               module.rebuild = true;
            }
         }
      }
   });

   /**
    * dont pack anonymous components
    */
   if (module.anonymous) {
      return '';
   }

   /**
    * if localization dependencies was added
    * rebuild module content and return as result
    */
   if (module.rebuild) {
      return escodegen.generate(ast, {
         format: {
            compact: true
         }
      });
   }
   return content;
}

/**
 * Read *html and wrap as text module.
 *
 * @param {Meta} module - current module meta for packer
 */
async function wmlLoader(module) {
   const content = await fs.readFile(module.fullPath, 'utf8');
   return content;
}

/**
 * Read json and wrap as text module.
 * @param {Meta} module - current module meta for packer
 */
async function jsonLoader(module) {
   const content = await fs.readJson(module.fullPath);
   return `define('${module.fullName}',function(){return ${JSON.stringify(content)};});`;
}

/**
 * Read file and wrap as text module
 * @param {Meta} module - current module meta for packer
 */
async function textLoader(module) {
   const content = await fs.readFile(module.fullPath, 'utf8');
   return `define('${module.fullName}',function(){return ${JSON.stringify(content)};});`;
}

/**
 * Returns module's content with condition to be used only in browser environment
 * @param{Object} module - current module meta for packer
 * @returns {Promise<string>}
 */
async function browserLoader(module) {
   const ifCondition = "if(typeof window !== 'undefined')";
   const content = await loaders[module.moduleIn.plugin](module.moduleIn);
   if (!content) {
      return '';
   }
   return `${ifCondition}{${content}}`;
}

/**
 * Loads module as usual with usage of current module plugin loader.
 * Otherwise in case of error returns empty string(only for ENOENT and EISDIR
 * error codes)
 * @param {Meta} module - current module meta for packer
 */
async function optionalLoader(module) {
   let content;
   try {
      content = await loaders[module.moduleIn.plugin](module.moduleIn);
   } catch (error) {
      /**
       * return empty string if current file not exists
       */
      if (error.code === 'ENOENT' || error.code === 'EISDIR') {
         return '';
      }
      throw error;
   }
   return content;
}

/**
 * get current "if" condition for current
 * plugin prefix(e.g. browser, msIe, compatibleLayer)
 */
function getModuleConditionByPrefix(modulePrefix) {
   switch (modulePrefix) {
      case 'compatibleLayer':
         return "if(typeof window === 'undefined' || window && window.location.href.indexOf('withoutLayout')===-1)";
      case 'msIe':
         return "if(typeof window !== 'undefined' && navigator && navigator.appVersion.match(/MSIE\\s+(\\d+)/))";

      // browser
      default:
         return "if(typeof window !== 'undefined')";
   }
}

/**
 *
 * @param {Meta} module - current module meta for packer
 * @param {String} base - site root
 */
async function isLoader(module, base) {
   if (!module.moduleYes) {
      return '';
   }
   let ifCondition = getModuleConditionByPrefix(module.moduleFeature);
   const moduleYesContent = await loaders[module.moduleYes.plugin](module.moduleYes, base);
   if (!moduleYesContent) {
      return '';
   }
   ifCondition = `${ifCondition}{${moduleYesContent}}`;
   if (module.moduleNo) {
      const moduleNoContent = await loaders[module.moduleNo.plugin](module.moduleNo, base);
      if (!moduleNoContent) {
         return '';
      }
      return `${ifCondition}else{${moduleNoContent}}`;
   }
   return ifCondition;
}

/**
 * Text wraps an 'if' that does not work in IE8-9
 * @param {Function} f - callback
 * @return {Function}
 */
function onlyForIE10AndAbove(content, modName) {
   let ifConditionThemes;
   const ifCondition = 'if(typeof window !== "undefined" && window.atob){';

   if (
      modName.startsWith('css!SBIS3.CONTROLS') ||
      modName.startsWith('css!Controls') ||
      modName.startsWith('css!Deprecated/Controls')
   ) {
      ifConditionThemes =
         'var global=(function(){return this || (0,eval)(this);})();if(global.wsConfig && global.wsConfig.themeName){return;}';
   }
   if (ifConditionThemes) {
      const indexVar = content.indexOf('var style = document.createElement(');
      return `${ifCondition + content.slice(0, indexVar) + ifConditionThemes + content.slice(indexVar)}}`;
   }
   return `${ifCondition + content}}`;
}

/**
 * Wrap text (function) as module with name
 * @param {Function} f - callback
 * @param {String} modName - module name
 * @return {Function}
 */
function asModuleWithContent(content, modName) {
   return `define('${modName}', ${content});`;
}

/**
 * Wrap css to inserts code
 * @param {Function} f - callback
 * @return {Function}
 */
function styleTagLoader(content) {
   return `function() {\
var style = document.createElement("style"),\
head = document.head || document.getElementsByTagName("head")[0];\
style.type = "text/css";\
style.setAttribute("data-vdomignore", "true");\
style.appendChild(document.createTextNode(${JSON.stringify(content)}));\
head.appendChild(style);\
}`;
}

/**
 * Rebase urls to absolute path in css
 * @param {String} root - absolute path root
 * @param {String} sourceFile - path to css
 * @param {Function} f - callback
 * @return {Function}
 */
function rebaseUrls(root, sourceFile, content, resourceRoot, relativePackagePath) {
   return rebaseUrlsToAbsolutePath(root, sourceFile, content, resourceRoot, relativePackagePath);
}


/**
 * Read css and Rebase urls and Wrap as module that inserts the tag style
 * Ignore IE8-9
 * @param {Meta} module - current module meta for packer
 * @param {String} base - site root
 */
async function cssLoader(
   module,
   base,
   themeName,
   languageConfig,
   relativePackagePath
) {
   const suffix = themeName ? `__${themeName}` : '';
   let modulePath = module.fullPath;
   if (suffix && module.fullName.includes('SBIS3.CONTROLS')) {
      modulePath = `${modulePath.slice(0, -4) + suffix}.css`;
   }
   let cssContent = await fs.readFile(modulePath, 'utf8');
   cssContent = rebaseUrls({
      root: base,
      sourceFile: modulePath,
      css: cssContent,
      relativePackagePath
   });
   cssContent = styleTagLoader(cssContent);
   cssContent = asModuleWithContent(cssContent, module.fullName);
   cssContent = onlyForIE10AndAbove(cssContent, module.fullName);
   return cssContent;
}

module.exports = loaders;
