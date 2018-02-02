'use strict';

const path = require('path');
const fs = require('fs');
const humanize = require('humanize');
const async = require('async');
const DoT = global.requirejs('Core/js-template-doT');
const tmplLocalizator = require('./../lib/i18n/tmplLocalizator');
const oldToNew = require('../resources/old_to_new.json');
const dblSlashes = /\\/g;
const extFile = /(\.tmpl|\.x?html)$/;

function warnTmplBuild(err, fullPath) {
   global.grunt.log.warn(`resources error. An ERROR occurred while building template! ${err.message}, in file: ${fullPath}`);
}

function errorTmplBuild(err, fullName, fullPath) {
   global.grunt.log.error(`Resources error. An ERROR occurred while building template!
    ---------File name: ${fullName}
    ---------File path: ${fullPath}`);
   global.grunt.fail.fatal(err);
}

function stripBOM(x) {
   if (x.charCodeAt(0) === 0xFEFF) {
      return x.slice(1);
   }

   return x;
}

/**
 * Создаёт шаблон в зависимости от типа шаблона (tmpl, xhtml, html)
 * @param {String} nameModule - имя шаблона
 * @param {String} contents - конент для вствки в тело define
 * @param {String} original - оригинальный файл
 * @param {Object} nodes - список всех узлов из module-dependencies.json
 * @param {String} applicationRoot - путь до сревиса
 * @param {Function} callback - функция коллбэк
 * @param {Object} deps - список зависмостей для вставки в зависимости define
 */
function creatTemplate(nameModule, contents, original, nodes, applicationRoot, callback, deps) {
   let
      fullPath = path.join(applicationRoot, nodes[nameModule].path).replace(dblSlashes, '/'),
      nameNotPlugin = nameModule.substr(nameModule.lastIndexOf('!') + 1),
      plugin = nameModule.substr(0, nameModule.lastIndexOf('!') + 1),
      needPushJs = false,
      data,
      jsPath,
      jsModule,
      secondName;


   //TODO на время переходного периода при отказе от contents.json
   /* При компиляции из xhtml в js у нас билдяться со старыми именами и в результате по новому имени
    шаблон уже не доступен. Поэтому здесь проверяем, чтобы старые имена не были заюзаны. Для этого
    создали список модулей которые подверглись переименованию и проверяем есть ли данный шаблон в списке.
    https://online.sbis.ru/opendoc.html?guid=f11afc8b-d8d2-462f-a836-a3172c7839a3
    */
   for (var name in oldToNew) {
      if (oldToNew.hasOwnProperty(name)) {
         if (name === nameNotPlugin && oldToNew[name] !== nameNotPlugin) {
            secondName = nameModule;
            nameNotPlugin = oldToNew[name];
            nameModule = plugin + oldToNew[name];
            break;
         }
         if (oldToNew[name] === nameNotPlugin && nameNotPlugin !== name) {
            secondName = plugin + name;
            break;
         }
      }
   }

   if (nodes.hasOwnProperty(nameNotPlugin)) {
      needPushJs = true;
      jsPath = path.join(applicationRoot, nodes[nameNotPlugin].path).replace(dblSlashes, '/');
      jsModule = fs.readFileSync(jsPath);
   }

   if (plugin.indexOf('html!') > -1) {
      data = `define("${nameModule}",function(){var f=${contents};f.toJSON=function(){return {$serialized$:"func", module:"${nameModule}"}};return f;});`;
   } else if (plugin.indexOf('tmpl!') > -1) {
      data = `define("${nameModule}",${JSON.stringify(deps)},function(){var deps=Array.prototype.slice.call(arguments);${contents}});`;
   }

   if (secondName) {
      data += `define("${secondName}",["require"],function(require){require("${nameModule}");});`;
   }


   //TODO костыль на время переходного периода при отказе от contents.json
   /*
    В резудьтате отказа от плагина js! и переименования модулей возникла гонка,
    require дефайнит и модуль, и шаблон под одним именем, но так как в шаблоне нет js модуля он
    считает, что модуля по данному имени нет. Временным решением принято дефайнить js в шаблоне,
    чтобы если первым прелетит шаблон, модуль был найден.
    https://online.sbis.ru/opendoc.html?guid=bcedfcf8-494d-451e-92f9-d9144e11ecac
    */
   if (needPushJs) {
      data += jsModule;
   }

   fs.writeFile(fullPath.replace(extFile, '.original$1'), original, function() {
      fs.writeFile(fullPath, data, function(err) {
         if (!err) {
            nodes[nameModule].amd = true;
            if (nodes[secondName]) {
               nodes[secondName].amd = true;
            }
         }
         setImmediate(callback.bind(null, err, nameModule, fullPath));
      });
   });
}

module.exports = function(grunt) {
   grunt.registerMultiTask('tmpl-build', 'Generate static html from modules', function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача tmpl-build.`);
      let start = Date.now();
      const
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         nodes = mDeps.nodes;

      let deps = ['View/Builder/Tmpl', 'View/config'];

      global.requirejs(deps.concat(['optional!View/Runner/tclosure']), function(tmpl, config, tclosure) {
         let tclosureStr = '';
         if (tclosure) {
            deps.push('View/Runner/tclosure');
            tclosureStr = 'var tclosure=deps[0];';
         }

         async.eachOfLimit(nodes, 2, function(value, fullName, callback) {
            if (fullName.indexOf('tmpl!') === 0) {
               let filename = value.path.replace(dblSlashes, '/'),
                  fullPath = path.join(applicationRoot, filename).replace(dblSlashes, '/'),
                  _deps = JSON.parse(JSON.stringify(deps)),
                  result = ['var templateFunction = '];
               if (value.amd) {
                  return setImmediate(callback);
               }


               let conf = {config: config, filename: filename, fromBuilderTmpl: true};
               fs.readFile(fullPath, 'utf8', function(err, html) {
                  if (err) {
                     console.log(`Potential 404 error: ${err}`);
                     warnTmplBuild(err, fullPath);
                     return setImmediate(callback);
                  }

                  var templateRender = Object.create(tmpl);

                  let original = html;
                  html = stripBOM(html);

                  if (html.indexOf('define') === 0) {
                     return setImmediate(callback);
                  }

                  try {
                     templateRender.getComponents(html).forEach(function(dep) {
                        _deps.push(dep);
                     });

                     tmplLocalizator.parseTmpl(html, filename)
                        .then(function(traversedObj) {
                           const traversed = traversedObj.astResult;
                           try {
                              if (traversed.__newVersion === true) {
                                 /**
                                  * Новая версия рендера, для шаблонизатора. В результате функция в строке.
                                  */
                                 let tmplFunc = templateRender.func(traversed, conf);
                                 result.push(tmplFunc.toString() + ';');

                                 if (tmplFunc.includedFunctions) {
                                    result.push('templateFunction.includedFunctions = {');
                                    result.push('};');
                                 }
                              } else {
                                 result.push('function loadTemplateData(data, attributes) {');
                                 result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' + fullName + '"}, attributes);};');
                              }

                              result.push('templateFunction.stable = true;');
                              result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + fullName + '"}};');
                              result.push('return templateFunction;');

                              _deps.splice(0, 2);
                              let
                                 depsStr = 'var _deps = {};',
                                 i = tclosure ? 1 : 0;
                              for (; i < _deps.length; i++) {
                                 depsStr += '_deps["' + _deps[i] + '"] = deps[' + i + '];';
                              }

                              let contents = tclosureStr + depsStr + result.join('');

                              creatTemplate(fullName, contents, original, nodes, applicationRoot, callback, _deps);

                           } catch (error) {
                              warnTmplBuild(error, fullPath);
                              setImmediate(callback);
                           }
                        }, function(error) {
                           warnTmplBuild(error, fullPath);
                           setImmediate(callback);
                        });
                  } catch (error) {
                     errorTmplBuild(error, fullName, fullPath);
                  }
               });
            } else {
               setImmediate(callback);
            }
         }, function(err, fullName, fullPath) {
            if (err) {
               errorTmplBuild(err, fullName, fullPath);
            }

            try {
               mDeps.nodes = nodes;
               grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
            } catch (error) {
               grunt.fail.fatal(error);
            }

            console.log(`Duration: ${(Date.now() - start) / 1000} sec`);

            done();
         });
      });
   });

   grunt.registerMultiTask('xhtml-build', 'Generate static html from modules', function() {
      grunt.log.ok(`${humanize.date('H:i:s')}: Запускается задача xhtml-build.`);
      let start = Date.now();
      const
         done = this.async(),
         root = this.data.root,
         application = this.data.application,
         applicationRoot = path.join(root, application),
         mDeps = JSON.parse(fs.readFileSync(path.join(applicationRoot, 'resources', 'module-dependencies.json'))),
         nodes = mDeps.nodes;

      async.eachOfLimit(nodes, 2, function(value, fullName, callback) {
         if (fullName.indexOf('html!') === 0) {
            let filename = value.path.replace(dblSlashes, '/'),
               fullPath = path.join(applicationRoot, filename).replace(dblSlashes, '/');

            if (value.amd) {
               return setImmediate(callback);
            }

            fs.readFile(fullPath, 'utf8', function(err, html) {
               if (err) {
                  console.log(`Potential 404 error: ${err}`);
                  warnTmplBuild(err, fullPath);
                  return setImmediate(callback);
               }

               let original = html;
               html = stripBOM(html);

               if (html.indexOf('define') === 0) {
                  return setImmediate(callback);
               }

               try {
                  let config, template;

                  config = DoT.getSettings();

                  if (module.encode) {
                     config.encode = config.interpolate;
                  }

                  template = DoT.template(html, config);

                  let contents = template.toString().replace(/[\n\r]/g, '');

                  creatTemplate(fullName, contents, original, nodes, applicationRoot, callback);

               } catch (error) {
                  warnTmplBuild(error, fullPath);
                  setImmediate(callback);
               }
            });
         } else {
            setImmediate(callback);
         }
      }, function(err, fullName, fullPath) {
         if (err) {
            errorTmplBuild(err, fullName, fullPath);
         }

         try {
            mDeps.nodes = nodes;
            grunt.file.write(path.join(applicationRoot, 'resources', 'module-dependencies.json'), JSON.stringify(mDeps, null, 2));
         } catch (error) {
            grunt.fail.fatal(error);
         }

         console.log(`Duration: ${(Date.now() - start) / 1000} sec`);

         done();
      });
   });
};
