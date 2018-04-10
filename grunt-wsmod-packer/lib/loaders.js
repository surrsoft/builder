var esprima = require('esprima');
var traverse = require('estraverse').traverse;
var codegen = require('escodegen');
var stripBOM = require('strip-bom');
var path = require('path');
var fs = require('fs');
var async = require('async');
var rebaseUrlsToAbsolutePath = require('./cssHelpers').rebaseUrls;

var dblSlashes = /\\/g;
var availableLangs;
var langRegExp = /lang\/([a-z]{2}-[A-Z]{2})/;

// FIXME: сделать бы по хорошему, чтобы не через костыль
var not404error = false;

var currentFile;

/**
 * @callback loaders~callback
 * @param {Error} error
 * @param {string} [result]
 */

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
    var res;
    try {
        res = esprima.parse(module);
    } catch (e) {
        e.message = 'While parsing ' + module.fullName + ' from ' + module.fullPath + ': ' + e.message;
        res = e;
    }
    return res;
}

function resolverControls(path) {
    return 'tmpl!' + path;
}

/**
 * Read js and inserts a module name into "define" function if name not specified
 * Use AST
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
function jsLoader(module, base, done) {
    readFile(module.fullPath, ignoreIfNoFile(function addNamesToAnonymousModules(err, res) {
        var anonymous = false,
            rebuild = false,
            amd = module.amd;

        if (err) {
            done(err);
        } else if (!res) {
            done(null, '');
        } else if (amd && !module.addDeps) {
            done(null, res);
        } else {
            var ast = parseModule(res);
            if (ast instanceof Error) {
                return done(ast);
            }

            traverse(ast, {
                enter: function detectAnonymnousModules(node) {
                    if (node.type == 'CallExpression' && node.callee.type == 'Identifier' && node.callee.name == 'define') {
                        //Check anonnimous define
                        if (node.arguments.length < 3) {
                            if (node.arguments.length == 2 &&
                                node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string') {
                                // define('somestring', /* whatever */);
                            } else {
                                anonymous = true;
                            }
                        }
                        if (node.arguments[0] &&
                            node.arguments[0].type == 'Literal' && typeof node.arguments[0].value == 'string' &&
                            node.arguments[0].value == module.fullName) {
                            amd = true;
                        }

                       //Check additional dependenccies
                       if (!String(module.fullName).startsWith('Core/') && module.addDeps) {
                          if (!node.arguments[1].elements) {
                             node.arguments.splice(1, 0, {
                                elements:[],
                                type: 'ArrayExpression'
                             });
                          }
                          node.arguments[1].elements.push({
                             raw: module.addDeps,
                             type: 'Literal',
                             value: module.addDeps
                          });
                          rebuild = true;
                       }
                    }
                }
            });
            if (anonymous) {
                done(null, '');
            } else {
                /**
                 * временный костыль для плагинов requirejs, спилю как будет решение ошибки
                 * https://online.sbis.ru/opendoc.html?guid=04191b13-e919-498d-b2e5-135e85f06f74
                 */
                if (amd || module.fullPath.indexOf('ext/requirejs/plugins') !== -1) {
                   if (rebuild) {
                      done(null, codegen.generate(ast, {
                          format: {
                              compact: true
                          }
                      }));
                   } else {
                      done(null, res);
                   }
                } else {
                   done(null, 'define("' + module.fullName + '", ""); ' + res);
                }
            }
        }
    }, 'jsLoader'));
}

/**
 * Read *html and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
function xhtmlLoader(module, base, done) {
   readFile(module.fullPath, ignoreIfNoFile(function (err, res) {
      if (err) {
         done(err);
      } else {
         if (module.amd && res) {
            done(null, res);
         } else {
            /**
             * сгенеренного шаблона нету, это означает что произошла ранее ошибка при его генерации
             * и пытаться здесь сгенерировать его снова нет смысла, всё равно будет ошибка.
             */
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
 * @param {loaders~callback} done
 */
function cssLoader(module, base, done, themeName) {
  var suffix = themeName ? '__' + themeName : '';
  var modulePath = module.fullPath;
  if (suffix && ~module.fullName.indexOf('SBIS3.CONTROLS')) {
    modulePath = modulePath.slice(0, -4) + suffix + '.css';
  }
    readFile(modulePath,
        rebaseUrls(base, modulePath,
            styleTagLoader(
                asModuleWithContent(
                    onlyForIE10AndAbove(
                        ignoreIfNoFile(done, 'cssLoader'),
                        module.fullName
                    ),
                    module.fullName
                )
            )
        )
    );
}

/**
 * Read *json and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {loaders~callback} done
 */
function jsonLoader(module, base, done) {
    readFile(module.fullPath, ignoreIfNoFile(function (err, res) {
        if (err) {
            done(err);
        } else {
            try {
                res = JSON.stringify(JSON.parse(res));
            } catch (err) {
                //ignore
                console.log(err);
            }
            done(null, 'define("' + module.fullName + '", function() {return ' + res + ';});');
        }
    }, 'jsonLoader'));
}

/**
 * Read *xml and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
function xmlLoader(module, base, done) {
    readFile(module.fullPath, ignoreIfNoFile(function (err, res) {
        if (err) {
            done(err);
        } else {
            done(null, 'define("' + module.fullName + '", function() {return ' + JSON.stringify(res) + ';});');
        }
    }, 'xmlLoader'));
}

/**
 * Read *xml and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
function isLoader(module, base, done) {
    var if_condition = 'if(%c)';
    var else_condition = 'else';
    if (module.moduleFeature === 'browser') {
        if_condition = if_condition.replace('%c', 'typeof window !== "undefined"');
    }
    if (module.moduleFeature === 'msIe') {
        if_condition = if_condition.replace('%c', 'typeof window !== "undefined" && navigator && navigator.appVersion.match(/MSIE\\s+(\\d+)/)');
    }
    if (module.moduleFeature === 'compatibleLayer') {
      if_condition = if_condition.replace('%c', 'typeof window === "undefined" || window && window.location.href.indexOf("withoutLayout")===-1');
   }
    if (module.moduleYes) {
        loaders[module.moduleYes.plugin](module.moduleYes, base, function (err, res) {
            if (err) {
                done(err);
            } else {
                if (!res) {
                    done(null, '');
                } else {
                    if_condition = if_condition + '{' + removeSourceMap(res) + '}';
                    if (module.moduleNo) {
                        loaders[module.moduleNo.plugin](module.moduleNo, base, function (err, res) {
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
 * Удаляет из модуля sourcemap, если она есть. При паковке они не имеют смысла
 * и могут закомментировать закрывающую скобку. Также source map ссылается на js-ку,
 * которая лежит с ней в одной директории, а при паковке хозяева могут указать другое
 * место для хранения своего пакет. В таком случае мапы ещё и не будут работать
 * @param res - модуль в виде строки
 */
function removeSourceMap(res) {
    var sourceMapIndex = res.indexOf('\n//# sourceMappingURL');
    return sourceMapIndex !== -1 ? res.slice(0, sourceMapIndex) : res;
}

/**
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
var if_condition = 'if(typeof window !== "undefined")';
function browserLoader(module, base, done) {
    loaders[module.moduleIn.plugin](module.moduleIn, base, function (err, res) {
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
 * @param {loaders~callback} done
 */
function optionalLoader(module, base, done) {
    not404error = true;
    loaders[module.moduleIn.plugin](module.moduleIn, base, function (err, res) {
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
 * @param {loaders~callback} done
 */
function textLoader(module, base, done) {
    readFile(module.fullPath, ignoreIfNoFile(function (err, res) {
        if (err) {
            done(err);
        } else {
            done(null, 'define("' + module.fullName + '", function() {return ' + JSON.stringify(res) + ';});');
        }
    }, 'textLoader'));
}

/**
 * Read file and wrap as text module.
 *
 * @param {Meta} module - module
 * @param {String} base - site root
 * @param {loaders~callback} done
 */
function baseTextLoader(module, base, done) {
    readFile(module.fullPath, ignoreIfNoFile(asText(done, path.relative(base, module.fullPath)), 'baseTextLoader'));
}

function readFile(fullPath, done) {
    fs.readFile(fullPath, 'utf8', function (err, file) {
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
 * @param {loaders~callback} done
 */
function tmplLoader(module, base, done) {
   readFile(module.fullPath, ignoreIfNoFile(function (err, html) {
      if (err) {
         done(err);
      } else {
         if (module.amd && html) {
            done(null, html);
         } else {
            /**
             * сгенеренного шаблона нету, это означает что произошла ранее ошибка при его генерации
             * и пытаться здесь сгенерировать его снова нет смысла, всё равно будет ошибка.
             */
            done(null, '');
         }
      }
   }, 'tmplLoader'));
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
    }
}

/**
 * Text wraps an 'if' that does not work in IE8-9
 * @param {Function} f - callback
 * @return {Function}
 */
function onlyForIE10AndAbove(f, modName) {
    var ifCondition;
    if (modName.indexOf('SBIS3.CONTROLS') !== -1) {
        ifCondition = 'if(typeof window !== "undefined" && window.atob && document.cookie.indexOf("thmname") === -1){';
    } else {
        ifCondition = 'if(typeof window !== "undefined" && window.atob){';
    }

    return function onlyRunCodeForIE10AndAbove(err, res) {
        if (err) {
            f(err);
        } else {
            f(null, ifCondition + res + '}');
        }
    }
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
    return function (err, res) {
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
function asModuleWithContent(f, modName) {
    return function wrapWithModule(err, res) {
        if (err) {
            f(err);
        } else {
            f(null, 'define("' + modName + '", ' + res + ');');
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
            var code = '\
function() {\
var style = document.createElement("style"),\
head = document.head || document.getElementsByTagName("head")[0];\
style.type = "text/css";\
style.appendChild(document.createTextNode(' + JSON.stringify(res) + '));\
head.appendChild(style);\
}';
            f(null, code);
        }
    }
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
    }
}

function getTemplateI18nModule(module) {
   let
      dictName = String(module.fullName || '').replace('_localization', ''),
      availableDict = JSON.stringify(module.availableDict || {}),
      code = `(function() {
   var availableDict = ${availableDict},
      langMatch = String(typeof document === 'undefined' ? '' : document.cookie).match(/lang=([A-z-]+)/),
      langName = langMatch ? langMatch[1] : 'ru-RU',
      langModule = 'text!${dictName}/lang/' + langName + '/' + langName + '.json';
   if (langName in availableDict) {
      define('${module.fullName}', ['Core/i18n', langModule], function(i18n, data) {
         if (data){
            i18n.setDict(JSON.parse(data), langModule, langName);
         }
      });
   } else {
      define('${module.fullName}', function() {});
   }
})();
`;
   return codegen.generate(esprima.parse(code), {
      format: {
         compact: true
      }
   })
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
function i18nLoader(module, base, done) {
    var
       _const = global.requirejs('Core/constants'),
       deps = ['Core/i18n'],
       css = [];

    availableLangs = availableLangs || Object.keys(global.requirejs('Core/i18n').getAvailableLang());

    if (!availableLangs || (_const && !_const.defaultLanguage) || !module.deps ) {
        return done(null, getTemplateI18nModule(module));
    }

    var noCssDeps = module.deps.filter(function (d) {
        //не позвоялем явно загрузить css
        return d.indexOf('native-css!') == -1
    });

    var noLangDeps = [];
    var langDeps = [];
    deps.concat(noCssDeps).forEach(function (d) {
        if (d.match(langRegExp) == null) {
            noLangDeps.push(d);
        }
        else {
            langDeps.push(d);
        }
    });

    // дописываем зависимость только от необходимого языка
    var result = 'define("' + module.fullName + '", '+ JSON.stringify(noLangDeps) +', function(i18n) {var langDep = ' + JSON.stringify(langDeps) + '.filter(function(dep){var lang = dep.match(' + langRegExp + '); if (lang && lang[1] == i18n.getLang()){return dep;}}); if (langDep){global.requirejs(langDep)} return i18n.rk.bind(i18n);});';

    done(null, result);
}

//TODO выпилить после 200
function _isOldStatic() {
    return true;
}

var loaders = {
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

module.exports = loaders;
