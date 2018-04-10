'use strict';

const esprima = require('esprima');
const traverse = require('estraverse').traverse;
const stripBOM = require('strip-bom');
const path = require('path');
const fs = require('fs-extra');
const rebaseUrlsToAbsolutePath = require('./cssHelpers').rebaseUrls;

const dblSlashes = /\\/g;
let availableLangs;
const langRegExp = /.*\/(..-..)\/(..-..)\.(?:json)?/;
const jsExtReg = /\.js$/;
const DEPENDENCY_REPLACER = '_DEPENDENCY_REPLACER';

const pluginList = ['css', 'js', 'html', 'cdn', 'browser', 'datasource', 'i18n', 'is', 'is-api', 'json', 'native-css', 'normalize', 'optional', 'order', 'preload', 'remote', 'template', 'text', 'tmpl', 'xml'];

const loaders = {
   js: jsLoader,
   html: xhtmlLoader,
   xhtml: xhtmlLoader,
   css: cssLoader,
   'native-css': cssLoader,
   json: jsonLoader,
   xml: xmlLoader,
   is: isLoader,
   text: textLoader,
   browser: browserLoader,
   optional: optionalLoader,
   i18n: i18nLoader,
   tmpl: tmplLoader,
   default: baseTextLoader
};

// FIXME: сделать бы по хорошему, чтобы не через костыль
let not404error = false;

let currentFile;

/**
 * @callback loaders~callback
 * @param {Error} error
 * @param {string} [result]
 */

/**
 * Удаляет из модуля sourcemap, если она есть. При паковке они не имеют смысла
 * и могут закомментировать закрывающую скобку. Также source map ссылается на js-ку,
 * которая лежит с ней в одной директории, а при паковке хозяева могут указать другое
 * место для хранения своего пакет. В таком случае мапы ещё и не будут работать
 * @param res - модуль в виде строки
 */
function removeSourceMap(res) {
   const sourceMapIndex = res.indexOf('\n//# sourceMappingURL');
   return sourceMapIndex !== -1 ? res.slice(0, sourceMapIndex) : res;
}

/**
 * Get AST
 *
 * @param {Object} module - module
 * @param {String} module.fullName - module name with plugin
 * @param {String} module.fullPath - module full path
 * @param {String} module.plugin - plugin name
 * @param {String} module.module - module name
 * @param {Object} [module.moduleYes] - is plugin, module yes
 * @param {Object} [module.moduleNo] - is plugin, module no
 * @param {String} [module.moduleFeature] - is plugin, module feature
 */
function parseModule(module) {
   let res;
   try {
      res = esprima.parse(module);
   } catch (e) {
      e.message = 'While parsing ' + module.fullName + ' from ' + module.fullPath + ': ' + e.message;
      res = e;
   }
   return res;
}

function standartJSPack(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(function addNamesToAnonymousModules(err, res) {
      let anonymous = false,
         amd = module.amd;

      if (err) {
         done(err);
      } else if (!res) {
         done(null, '');
      } else if (amd) {
         done(null, res);
      } else {
         const ast = parseModule(res);
         let result;
         if (ast instanceof Error) {
            return done(ast);
         }

         traverse(ast, {
            enter: function detectAnonymnousModules(node) {
               if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
                  if (node.arguments.length < 3) {
                     if (node.arguments.length == 2 &&
                        node.arguments[0].type == 'Literal' && typeof node.arguments[0].value === 'string') {
                        // define('somestring', /* whatever */);
                     } else {
                        anonymous = true;
                     }
                  }
                  if (node.arguments[0] &&
                     node.arguments[0].type == 'Literal' && typeof node.arguments[0].value === 'string' &&
                     node.arguments[0].value == module.fullName) {
                     amd = true;
                  }
               }
            }
         });
         if (anonymous) {
            result = '';
         } else {
            if (amd) {
               result = res;
            } else {
               packStorage.addToResolvedNodes(module.fullName);
               result = 'defineStorage["' + module.fullName + '"] = "";\n' + 'define("' + module.fullName + '", defineStorage["' + module.fullName + '"]);\n' + res;
            }
         }
         done(null, result);
      }
   }, 'jsLoader'));
}

/**
 * Read js and inserts a module name into "define" function if name not specified
 * Use AST
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function jsLoader(module, base, packStorage, done) {
   const espPath = module.fullPath.replace(jsExtReg, '.esp.json');
   if (fs.existsSync(espPath) && pluginList.indexOf(module.fullName) < 0) {
      readFile(espPath, ignoreIfNoFile(function addNamesToAnonymousModules(err, res) {
         if (err) {
            done(err);
         } else if (!res) {
            done(null, '');
         } else {

            let
               espJSON = JSON.parse(res),
               espModules = espJSON.modules,
               espContent = espJSON.content,
               espModulesNames = Object.keys(espModules);

            for (const mod in espModules) {
               if (!espModules.hasOwnProperty(mod)) {
                  continue;
               }

               if (espModules[mod].lazyDepsResolve) {
                  const argumentsString = packStorage.generateArgumentsString(espModules[mod].deps);
                  if (argumentsString instanceof Error) {
                     standartJSPack(module, base, packStorage, done);
                     return;
                  } else {
                     espContent = espContent.replace(mod + DEPENDENCY_REPLACER, argumentsString);
                  }
               } else if (!packStorage.isNodesResolved(espModules[mod].deps)) {
                  standartJSPack(module, base, packStorage, done);
                  return;
               }
            }

            espModulesNames.forEach(function(moduleName) {
               packStorage.addToResolvedNodes(moduleName);
            });

            done(null, espContent);
         }
      }, 'jsLoader'));
   } else {
      standartJSPack(module, base, packStorage, done);
   }
}

/**
 * Read *html and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function xhtmlLoader(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(function(err, res) {
      if (err) {
         done(err);
      } else {
         try {
            let
               defineName = module.fullName,
               withoutDefine,
               withDefine,
               doT = global.requirejs('Core/js-template-doT'),
               config,
               template;

            config = doT.getSettings();

            if (module.encode) {
               config.encode = config.interpolate;
            }

            template = doT.template(res, config);
            packStorage.addToResolvedNodes(defineName);

            withoutDefine = 'defineStorage["' + defineName + '"] = (function() {var f=' + template.toString().replace(/[\n\r]/g, '') +
               ';f.toJSON=function(){return  {$serialized$: "func", module: "' + module.fullName + '"}};return f;})();';
            withDefine = 'define("' + defineName + '", function() {return defineStorage["' + defineName + '"]});';

            done(null, withoutDefine + '\n' + withDefine);
         } catch (err) {
            console.log(err, module.fullName, module.fullPath);
            done(null, '');
         }
      }
   }, 'xhtmlLoader'));
}

/**
 * Read css and Rebase urls and Wrap as module that inserts the tag style
 * Ignore IE8-9
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function cssLoader(module, base, packStorage, done) {
   readFile(module.fullPath,
      rebaseUrls(base, module.fullPath,
         styleTagLoader(
            asModuleWithContent(
               onlyForIE10AndAbove(
                  ignoreIfNoFile(done, 'cssLoader')
               ),
               module.fullName,
               packStorage
            )
         )
      )
   );
}

/**
 * Read *json and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function jsonLoader(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(function(err, res) {
      if (err) {
         done(err);
      } else {
         let
            defineName = module.fullName,
            withoutDefine,
            withDefine;

         try {
            res = JSON.stringify(JSON.parse(res));
         } catch (err) {
            //ignore
            console.log(err);
         }
         packStorage.addToResolvedNodes(defineName);

         // packWithoutDefines.registerAsResolvedDefine(defineName, resolvedNodes);
         withoutDefine = 'defineStorage["' + defineName + '"] = (function() {return ' + res + ';})()';
         withDefine = 'define("' + defineName + '", function() {return defineStorage["' + defineName + '"];});';
         done(null, withoutDefine + '\n' + withDefine);
      }
   }, 'jsonLoader'));
}

/**
 * Read *xml and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function xmlLoader(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(function(err, res) {
      if (err) {
         done(err);
      } else {
         let
            defineName = module.fullName,
            withoutDefine,
            withDefine;

         packStorage.addToResolvedNodes(defineName);

         // packWithoutDefines.registerAsResolvedDefine(defineName, resolvedNodes);
         withoutDefine = 'defineStorage["' + defineName + '"] = (function() {return ' + JSON.stringify(res) + ';})();';
         withDefine = 'define("' + defineName + '", function() {return defineStorage["' + defineName + '"];});';
         done(null, withoutDefine + '\n' + withDefine);
      }
   }, 'xmlLoader'));
}

/**
 * Read *xml and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function isLoader(module, base, packStorage, done) {
   let if_condition = 'if(%c)';
   let else_condition = 'else';
   if (module.moduleFeature === 'browser') {
      if_condition = if_condition.replace('%c', 'typeof window !== "undefined"');
   }
   if (module.moduleFeature === 'msIe') {
      if_condition = if_condition.replace('%c', 'typeof window !== "undefined" && navigator && navigator.appVersion.match(/MSIE\\s+(\\d+)/)');
   }
   if (module.moduleYes) {
      loaders[module.moduleYes.plugin](module.moduleYes, base, packStorage, function(err, res) {
         if (err) {
            done(err);
         } else {
            if (!res) {
               done(null, '');
            } else {
               if_condition = if_condition + '{' + removeSourceMap(res) + '}';
               if (module.moduleNo) {
                  loaders[module.moduleNo.plugin](module.moduleNo, base, packStorage, function(err, res) {
                     if (err) {
                        done(err);
                     } else {
                        if (!res) {
                           done(null, '');
                        } else {
                           else_condition = else_condition + '{' + removeSourceMap(res) + '}';
                           done(null, if_condition + else_condition);
                        }
                     }
                  });
               } else {
                  done(null, if_condition);
               }
            }
         }
      });
   }
}

/**
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
const if_condition = 'if(typeof window !== "undefined")';

function browserLoader(module, base, packStorage, done) {
   loaders[module.moduleIn.plugin](module.moduleIn, base, packStorage, function(err, res) {
      if (err) {
         done(err);
      } else {
         if (!res) {
            done(null, '');
         } else {
            done(null, if_condition + '{' + removeSourceMap(res) + '}');
         }
      }
   });
}

/**
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function optionalLoader(module, base, packStorage, done) {
   not404error = true;
   loaders[module.moduleIn.plugin](module.moduleIn, base, packStorage, function(err, res) {
      not404error = false;
      if (err || !res) {
         done(null, '');
      } else {
         done(null, removeSourceMap(res));
      }
   });
}

/**
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function textLoader(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(function(err, res) {
      if (err) {
         done(err);
      } else {
         let
            defineName = module.fullName,
            withoutDefine,
            withDefine;

         packStorage.addToResolvedNodes(defineName);

         // packWithoutDefines.registerAsResolvedDefine(defineName, resolvedNodes);
         withoutDefine = 'defineStorage["' + defineName + '"] = (function() {return ' + JSON.stringify(res) + ';})();';
         withDefine = 'define("' + module.fullName + '", function() {return defineStorage["' + defineName + '"];});';
         done(null, withoutDefine + '\n' + withDefine);
      }
   }, 'textLoader'));
}

/**
 * Read file and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function baseTextLoader(module, base, packStorage, done) {
   readFile(module.fullPath, ignoreIfNoFile(asText(done, path.relative(base, module.fullPath)), 'baseTextLoader'));
}

function readFile(fullPath, done) {
   fs.readFile(fullPath, 'utf8', function(err, file) {
      currentFile = fullPath;
      if (err) {
         done(err);
      } else {
         done(null, stripBOM(file));
      }
   });
}

/**
 * Read file and wrap as tmpl module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {Array} resolvedNodes
 * @param {loaders~callback} done
 */
function tmplLoader(module, base, packStorage, done) {
   let
      depsForWithoutDefines = ['Core/tmpl/tmplstr', 'Core/tmpl/config'],
      result = ['var templateFunction = function loadTemplateData(data, attributes) {'],
      defineName = module.fullName,
      withDefine,
      withoutDefine;

   function resolverControls(path) {
      return 'tmpl!' + path;
   }

   global.requirejs(depsForWithoutDefines, function(tmpl, config) {
      const conf = {config: config, filename: path.relative(base, module.fullPath)};
      readFile(module.fullPath, ignoreIfNoFile(function(err, html) {
         tmpl.getComponents(html).forEach(function(dep) {
            depsForWithoutDefines.push(dep);
         });

         const depsNotResolved = depsForWithoutDefines.filter(function(dep) {
            return !packStorage.isNodeResolved(dep);

            // return !packWithoutDefines.isNodeResolved(dep, resolvedNodes);
         }).length;

         tmpl.template(html, resolverControls, conf).handle(function(traversed) {
            try {
               result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' +
                  module.fullName + '"}, attributes);};');
               result.push('templateFunction.stable = true;');
               result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + module.fullName + '"}};');
               result.push('return templateFunction;');

               if (depsNotResolved) {
                  done(null, 'define("' + module.fullName + '", ' + JSON.stringify(depsForWithoutDefines) +
                     ', function(tmpl, config) {' + result.join('') + '});');
               } else {
                  packStorage.addToResolvedNodes(defineName);

                  // packWithoutDefines.registerAsResolvedDefine(defineName, resolvedNodes);
                  withoutDefine = 'defineStorage["' + defineName + '"] = (function(tmpl, config) {' +
                     result.join('') + '})(' +
                     depsForWithoutDefines.map(function(i) {
                        return 'defineStorage["' + i + '"]';
                     }).join(', ') + ')';
                  withDefine = 'define("' + defineName + '", function() { return defineStorage["' + defineName + '"]});';
                  done(null, withoutDefine + '\n' + withDefine);
               }
            } catch (err) {
               console.log(err, module.fullName, module.fullPath);
               done(err);
            }
         }, function(err) {
            console.log(err, module.fullName, module.fullPath);
            done(err);
         });
      }, 'tmplLoader'));
   });
}

/**
 * If file not exist, write error.
 * Change error on empty string
 * @param {Function} f - callback
 * @param {String} loaderName
 * @return {Function}
 */
function ignoreIfNoFile(f, loaderName) {
   return function log404AndIgnoreIt(err, res) {
      if (err && (err.code == 'ENOENT' || err.code == 'EISDIR') && !not404error) {
         console.log('Potential 404 error: ' + err + '. ' + currentFile, loaderName);
         f(null, '');
         return;
      }
      f(err, removeSourceMap(res));
   };
}

/**
 * Text wraps an 'if' that does not work in IE8-9
 * @param {Function} f - callback
 * @return {Function}
 */
function onlyForIE10AndAbove(f) {
   return function onlyRunCodeForIE10AndAbove(err, res) {
      if (err) {
         f(err);
      } else {
         f(null, 'if(typeof window !== "undefined" && window.atob){' + res + '}');
      }
   };
}

/**
 * Wrap string as text module, remove BOM
 * @param {loaders~callback} done - callback
 * @param {String} relPath - module name or path to module
 * @param {String} [withPlugin=text] - requirejs plugin name
 * @return {Function}
 */
function asText(done, relPath, withPlugin) {
   withPlugin = withPlugin ? withPlugin + '!/' : '';
   return function(err, res) {
      if (err) {
         done(err);
      } else {
         done(null, 'define("' + withPlugin + relPath.replace(dblSlashes, '/') + '", ' + JSON.stringify(res) + ');');
      }
   };
}

/**
 * Wrap text (function) as module with name
 * @param {Function} f - callback
 * @param {String} modName - module name
 * @return {Function}
 */
function asModuleWithContent(f, modName, packStorage) {
   return function wrapWithModule(err, res) {
      if (err) {
         f(err);
      } else {
         let
            withoutDefine,
            withDefine;

         packStorage.addToResolvedNodes(modName);

         // packWithoutDefines.registerAsResolvedDefine(defineName, resolvedNodes);
         withoutDefine = 'defineStorage["' + modName + '"] = ' + res + ';';
         withDefine = 'define("' + modName + '", defineStorage["' + modName + '"]);';
         f(null, withoutDefine + '\n' + withDefine);
      }
   };
}

/**
 * Wrap css to inserts code
 * @param {Function} f - callback
 * @return {Function}
 */
function styleTagLoader(f) {
   return function createStyleNodeWithText(err, res) {
      if (err) {
         f(err);
      } else {
         const code = '\
function() {\
var style = document.createElement("style"),\
head = document.head || document.getElementsByTagName("head")[0];\
style.type = "text/css";\
style.appendChild(document.createTextNode(' + JSON.stringify(res) + '));\
head.appendChild(style);\
}';
         f(null, code);
      }
   };
}

/**
 * Rebase urls to absolute path in css
 * @param {String} root - absolute path root
 * @param {String} sourceFile - path to css
 * @param {Function} f - callback
 * @return {Function}
 */
function rebaseUrls(root, sourceFile, f) {
   return function(err, res) {
      if (err) {
         f(err);
      } else {
         f(null, rebaseUrlsToAbsolutePath(root, sourceFile, res));
      }
   };
}

/**
 * Получает список доступных языков для локализации.
 * Вычитывает словарь, css для языка, css для страны и оборачивает их как модули для каждого из доступных языков.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 * @return {Function}
 */
function i18nLoader(module, base, packStorage, done) {
   let
      _const = global.requirejs('Core/constants'),
      json = [],
      jsonLang = [],
      css = [],
      cssLang = [],
      withoutDefine,
      withDefine;

   availableLangs = availableLangs || Object.keys(global.requirejs('Core/i18n').getAvailableLang());

   packStorage.addToResolvedNodes(module.fullName);

   if (!availableLangs || _const && !_const.defaultLanguage || !module.deps.length) {
      withoutDefine = 'defineStorage["' + module.fullName + '"] = (function(i18n) {return i18n.rk.bind(i18n);})(defineStorage["Core/i18n"])';
      withDefine = 'define("' + module.fullName + '", function() {return defineStorage["' + module.fullName + '"]});';
      return done(null, withoutDefine + '\n' + withDefine);
   } else {
      module.deps.forEach(function(dep) {
         if (dep.indexOf('text!') > -1) {
            const lang = dep.match(langRegExp)[1];
            json.push(dep);
            jsonLang.push(lang);
         } else {
            css.push(dep);
            cssLang.push(dep.split('/').pop());
         }
      });

      let
         argString = '',
         setDictString = '',
         callString = '';

      json.forEach(function(mod, index) {
         argString += ', dict' + index;
         callString += ', defineStorage["' + mod + '"]';
      });

      css.forEach(function(mod, index) {
         argString += ', css' + index;
         callString += ', {lang: "' + cssLang[index] + '", fn: defineStorage["' + mod + '"]}';
      });

      json.forEach(function(mod, index) {
         const setterString = 'i18n.setDict(JSON.parse(dict' + index + '), "' + mod + '", "' + jsonLang[index] + '");';
         setDictString += 'if (i18n) {' + setterString + '} else {_i18nStorage.push(function(i18n) {' + setterString + '})}';
      });

      css.forEach(function(mod, index) {
         const setterString = 'if(css' + index + '.lang==i18n.getLang()||i18n.getLang().indexOf(css' + index + '.lang)>-1){css' + index + '.fn()}';
         setDictString += 'if(i18n){' + setterString + '}else{_i18nStorage.push(function(i18n){' + setterString + '})}';
      });

      withoutDefine = '(function(i18n' + argString + ') {' + setDictString + '})' +
         '(defineStorage["Core/i18n"]' + callString + ');';

      return done(null, withoutDefine);
   }
}

module.exports = loaders;
