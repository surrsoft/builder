'use strict';

const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const packInOrder = require('./packInOrder');
const domHelpers = require('./../../lib/domHelpers');
const indexer = require('./../../lib/index-project');

const ERROR_INDEX_FAILED = 100;
const ERROR_PACKING_FAILED = 101;

function insertAllDependenciesToDocument(filesToPack, type, insertAfter) {
   let type2attr = {
         'js': 'src',
         'css': 'href'
      }, type2node = {
         'js': 'script',
         'css': 'link'
      }, type2type = {
         'js': 'text/javascript',
         'css': 'text/css'
      }, options = {
         'data-pack-name': 'ws-mods-' + type,
         'type': type2type[type]
      };

   if (insertAfter && filesToPack && filesToPack[type]) {
      filesToPack = filesToPack[type];

      if (filesToPack.length && type in type2attr) {
         if (type == 'css') {
            options.rel = 'stylesheet';
         }
         let newTarget = domHelpers.mkCommentNode(insertAfter.ownerDocument, '[/packedScripts]');
         insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
         filesToPack.reverse().filter(function(file) {
            return file.name;
         }).forEach(function(file) {

            options['data-pack-name'] = file.skip ? 'skip' : 'ws-mods-' + type;

            options[type2attr[type]] = file.name.replace(/\\/g, '/');
            newTarget = domHelpers.mkDomNode(insertAfter.ownerDocument, type2node[type], options);
            insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
         });
         newTarget = domHelpers.mkCommentNode(insertAfter.ownerDocument, '[packedScripts]');
         insertAfter.parentNode.insertBefore(newTarget, insertAfter.nextSibling);
      }
   }
}

function generatePackage(extWithoutVersion, grunt, filesToPack, ext, packageTarget, applicationRoot, siteRoot, namePrefix) {
   // filesToPack = filesToPack[ext];
   if (namePrefix === undefined) {
      namePrefix = '';
   }

   if (filesToPack) {
      if (typeof filesToPack === 'string') {
         filesToPack = [filesToPack];
      }

      return filesToPack.map(function(file) {
         let
            urlServicePath = grunt.option('url-service-path') ? path.join(siteRoot, grunt.option('url-service-path')) : applicationRoot,
            packageName = namePrefix + domHelpers.uniqname(file, ext),
            packedFileName = path.join(packageTarget, packageName),
            packedFilePath = path.normalize(path.join(applicationRoot, packedFileName)),

            /*
               Даннный флаг определяет надо вставить в статическую страничку путь до пакета с констркуией %{RESOURCE_ROOT} или абсолютный путь.
                  false - если у нас разделённое ядро и несколько сервисов.
                  true - если у нас монолитное ядро или один сервис.
               */
            replacePath = !(grunt.option('splitted-core') && grunt.option('multi-service'));

         grunt.file.write(packedFilePath.replace(ext, extWithoutVersion), file);

         packedFilePath = path.normalize(path.join(urlServicePath, packedFileName));

         if (replacePath) {
            return {'name': '/' +  path.relative(siteRoot, packedFilePath), 'skip': !!namePrefix};
         } else {
            return {'name': '%{RESOURCE_ROOT}' +  packedFileName.replace(/resources(?:\/|\\)/, ''), 'skip': !!namePrefix};
         }
      });
   } else {
      return {};
   }
}

function getStartNodeByTemplate(templateName, application) {
   let startNodes = [],
      deps;

   // Если шаблон - новый компонент, ...
   if (templateName.indexOf('js!') === 0 || !templateName.includes('!')) {
      // ... просто добавим его как стартовую ноду
      startNodes.push(templateName);
   } else {
      // Иначе получим зависимости для данного шаблона
      deps = indexer.getDeps(application, templateName);

      // дополним ранее собранные
      startNodes = startNodes.concat(deps
         .map(function(dep) {
            // старый или новый формат описания класса
            const clsPos = dep.indexOf(':');
            if (clsPos !== -1) {
               // Control/Area:AreaAbstract например, возьмем указанное имя класса
               return dep.substr(clsPos + 1);
            } else {
               // Control/Grid например, возьмем последний компонент пути
               return dep.split('/').pop();
            }
         })
         .map(function addNamespace(dep) {
            if (dep.indexOf('.') === -1) {
               return 'js!SBIS3.CORE.' + dep;
            } else {
               return 'js!' + dep;
            }
         }));
   }

   return startNodes;
}

function getStartNodes(grunt, divs, application) {
   let startNodes = [],
      div, tmplName;

   for (let i = 0, l = divs.length; i < l; i++) {
      div = divs[i];
      const divClass = div.getAttribute('class');
      if (divClass && divClass.indexOf('ws-root-template') > -1 && (tmplName = div.getAttribute('data-template-name'))) {
         grunt.log.debug("Packing inner template '" + tmplName + "'");

         startNodes = startNodes.concat(getStartNodeByTemplate(tmplName, application));
      }

      if (tmplName) {
         if (startNodes.length === 0) {
            grunt.log.debug("No any dependencies collected for '" + tmplName + "'");
         } else {
            grunt.log.debug('Got ' + startNodes.length + " start nodes for '" + tmplName + "': " + startNodes.join(','));
         }
      }
   }

   // сделаем список стартовых вершни уникальным
   startNodes = startNodes.filter(function(el, idx, arr) {
      return arr.indexOf(el, idx + 1) == -1;
   });

   return startNodes;
}

/**
 * Возвращает универсальный ключ, учитывая возможность наличия версии билда дистра
 * @param buildNumber
 * @param key
 */
function getKey(buildNumber, key) {
   return buildNumber ? `v${buildNumber}.${key}` : key;
}

function packFiles(grunt, dg, htmlFileset, packageHome, root, application, taskDone) {
   grunt.log.ok('Packing dependencies of ' + htmlFileset.length + ' files...');
   let
      bundlesOptions = {},
      buildNumber = grunt.option('versionize');

   /*try {
        var
           wsRoot = grunt.file.exists(path.join(root, application, 'resources/WS.Core')) ? 'resources/WS.Core' : 'ws',
           bundlesOptions = {
              jsBundles: JSON.parse(fs.readFileSync(path.join(root, application, wsRoot, 'ext/requirejs/bundlesRoute.json'))),
              bundlesScripts: {},
              customPackagesOutputs: JSON.parse(fs.readFileSync(path.join(root, application, wsRoot, 'ext/requirejs/output.json'))),
              versionize: grunt.option('versionize'),
              logs: {}
           };
    } catch(e) {
        grunt.log.error(e.stack);
        //ошибки нет. Такое может быть.
        bundlesOptions = {};
    }*/
   async.eachLimit(htmlFileset, 1, function(htmlFile, done) {
      try {
         grunt.log.ok(htmlFile);

         let dom = domHelpers.domify(htmlFile),
            divs = dom.getElementsByTagName('div'),
            jsTarget = dom.getElementById('ws-include-components'),
            cssTarget = dom.getElementById('ws-include-css'),
            htmlPath = htmlFile.split(path.sep),
            htmlName = htmlPath[htmlPath.length - 1],
            applicationRoot = path.join(root, application);

         const themeNameFromDOM = domHelpers.resolveThemeByWsConfig(dom);
         if (jsTarget || cssTarget) {
            const startNodes = getStartNodes(grunt, divs, application);

            packInOrder(dg, startNodes, root, path.join(root, application), false, {}, function(err, filesToPack) {
               if (err) {
                  grunt.log.debug(err); //Имееет ли смысл?
                  done(err);
               } else {
                  // Запишем в статическую html зависимости от ВСЕХ пакетов(основные js и css пакеты + пакеты для каждой локали).

                  // filesToPack = {"css": [], "js": "...", "dict": {"en-US": "", "ru-RU": ""}, "cssForLocale": {"en-US": []}};
                  let attr2ext = {'cssForLocale': 'css', 'dict': 'js'},
                     packages = {'css': [], 'js': []};

                  Object.keys(filesToPack).forEach(function(key) {
                     if (filesToPack[key] !== null && typeof filesToPack[key] === 'object') {
                        if (Array.isArray(filesToPack[key])) { // "css": []
                           filesToPack[key].map(function(content) {
                              packages[key] = packages[key].concat(generatePackage(key, grunt, content, getKey(buildNumber, key), packageHome, applicationRoot, root));
                           });
                        } else { // "dict": {"en-US": "", "ru-RU": ""}, "cssForLocale": {"en-US": []} lkz
                           // пакеты для локалей запакуем с data-pack = "skip" чтобы потом на ПП вырезать ненужные из html
                           Object.keys(filesToPack[key]).forEach(function(locale) {
                              packages[attr2ext[key]] = packages[attr2ext[key]].concat(generatePackage(attr2ext[key], grunt, filesToPack[key][locale], getKey(buildNumber, attr2ext[key]), packageHome, applicationRoot, root, locale));
                           });
                        }
                     } else { //"js": "..."
                        const generatedScript = generatePackage(key, grunt, filesToPack[key], getKey(buildNumber, key), packageHome, applicationRoot, root);
                        packages[key] = packages[key].concat(generatedScript);
                        if (bundlesOptions.bundlesScripts) {
                           try {
                              /**
                                       * пишем по пути статического пакета log-файл для дальнейшей отладки пакетов
                                       * прикладниками, чтобы понимать из-за каких модулей на страницу подтянулся
                                       * их пакет
                                       */
                              fs.writeFileSync(path.join(root, `${generatedScript[0].name.replace('%{RESOURCE_ROOT}', 'resources/')}.log`), JSON.stringify(bundlesOptions.logs, null, 3));
                           } catch (e) {
                              grunt.log.error(`Ошибка сохранения лога для статического пакета: ${generatedScript[0].name}\n${e.stack}`);
                           }
                        }
                     }
                  });
                  if (bundlesOptions.bundlesScripts) {
                     Object.keys(bundlesOptions.bundlesScripts).forEach(function(script) {
                        packages.js.push({
                           name: script.replace(/\.js$/, `${buildNumber ? `.v${buildNumber}` : ''}.js`),
                           skip: false
                        });
                     });
                  }

                  // пропишем в HTML
                  insertAllDependenciesToDocument(packages, 'js', jsTarget);
                  insertAllDependenciesToDocument(packages, 'css', cssTarget);

                  grunt.file.write(htmlFile, domHelpers.stringify(dom));
                  done();
               }
            }, null, htmlName, themeNameFromDOM);
         } else {
            grunt.log.debug("No any packing target in '" + htmlFile + "'");
            done();
         }
      } catch (err) {
         if (typeof err === 'string') {
            err = new Error(err);
         }
         grunt.fail.warn("ERROR! Failed to process '" + htmlFile + "'!\n" + err.message + '\n' + err.stack + '\n', ERROR_PACKING_FAILED);
         done(err);
      }
   }, function(err) {
      if (err) {
         taskDone(err);
      } else {
         taskDone();
      }
   });
}

function packHTML(grunt, dg, htmlFileset, packageHome, root, application, taskDone) {
   grunt.log.ok('Indexing resources in ' + application);
   indexer.index(root, application, grunt, dg).addCallbacks(function() {
      packFiles(grunt, dg, htmlFileset, packageHome, root, application, taskDone);
   }, function(e) {
      grunt.fail.fatal('ERROR! Indexing failed!\n' + e.message + '\n' + e.stack + '\n', ERROR_INDEX_FAILED);
      taskDone();
   });
}

module.exports = packHTML;
