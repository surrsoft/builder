const
   async = require('async'),
   path = require('path'),
   fs = require('fs'),
   getMeta = require('./../../lib/getDependencyMeta'),
   commonPackage = require('./../../lib/commonPackage');

/**
 * Get all js modules
 * @param {DepGraph} dg - dependencies graph file
 * @param {String} applicationRoot
 * @return {Array}
 */
function getAllModules(dg, applicationRoot) {
    return dg.getNodes()
        .map(getMeta)
        .filter(function onlyJS(node) {
            return node.plugin == 'js' && !(node.fullName.includes('tmpl!') || node.fullName.includes('html!'));
        })
        .map(function setFullPath(node) {
            node.fullPath = path.join(applicationRoot, dg.getNodeMeta(node.fullName).path);
            node.amd = dg.getNodeMeta(node.fullName).amd;
            return node;
        })
        .map(function setTempPath(node) {
            node.tempPath = node.fullPath.replace(/\.js$/, '.modulepack.js');
            return node;
        })
        //не включаем несуществующие пути(например в WS.Core не копируется папка test)
        .filter(function excludeNotExistingModules(node) {
            return fs.existsSync(node.fullPath);
        })
        .filter(function excludePacked(node) {
            return !fs.existsSync(node.tempPath);
        })
        .map(function getDependencies(node) {
            node.deps = dg.getDependenciesFor(node.fullName)
                .map(getMeta)
                .filter(function excludeEmptyDependencies(dep) {
                    var res = false;
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            res = dg.getNodeMeta(dep.moduleYes.fullName);
                        }
                        if (res && dep.moduleNo) {
                            res = dg.getNodeMeta(dep.moduleNo.fullName);
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        res = dg.getNodeMeta(dep.moduleIn.fullName);
                    } else {
                        res = dg.getNodeMeta(dep.fullName);
                    }
                    return res && res.path;
                })
                .filter(function excludeI18N(dep) {
                    return dep.plugin != 'i18n' && dep.plugin != 'css';
                })
                .filter(function excludeNonOwnDependencies(dep) {
                    var ownDeps = false;
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleYes.fullName);
                        }
                        if (dep.moduleNo) {
                            ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleNo.fullName);
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.moduleIn.fullName);
                    } else {
                        ownDeps = (new RegExp('(.+!)?' + node.module + '($|\\\\|\\/)')).test(dep.fullName);
                    }
                    return ownDeps;
                })
                .map(function setFullPath(dep) {
                    if (dep.plugin == 'is') {
                        if (dep.moduleYes) {
                            dep.moduleYes.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleYes.fullName).path);
                            dep.moduleYes.amd = dg.getNodeMeta(dep.moduleYes.fullName).amd;
                        }
                        if (dep.moduleNo) {
                            dep.moduleNo.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleNo.fullName).path);
                            dep.moduleNo.amd = dg.getNodeMeta(dep.moduleNo.fullName).amd;
                        }
                    } else if ((dep.plugin == 'browser' || dep.plugin == 'optional') && dep.moduleIn) {
                        dep.moduleIn.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.moduleIn.fullName).path);
                        dep.moduleIn.amd = dg.getNodeMeta(dep.moduleIn.fullName).amd;
                    } else {
                        dep.fullPath = path.join(applicationRoot, dg.getNodeMeta(dep.fullName).path);
                        dep.amd = dg.getNodeMeta(dep.fullName).amd;
                    }
                    return dep;
                })
                //пакуем вместе с модулями исключительно шаблоны.
                .filter(function includeOnlyTemplates(dep) {
                    return dep.plugin == 'tmpl' || dep.plugin == 'html';
                })
                // Add self
                .concat(node);
            return node;
        })
        .filter(function withDependencies(node) {
            return node.deps.length > 1;
        });
}

/**
 * @callback packOwnDependencies~callback
 * @param {Error} [error]
 */

/**
 *
 * @param {Boolean} dryRun
 * @param {DepGraph} dg
 * @param {String} root - полный путь до корня приложения
 * @param {String} applicationRoot - полный путь до корня сервиса
 * @param {packOwnDependencies~callback} taskDone - callback
 */
function packOwnDependencies(dryRun, dg, root, applicationRoot, splittedCore, taskDone) {
    var allModules = getAllModules(dg, applicationRoot);
    async.eachLimit(allModules, 5, function createTempFileForEachModule(item, done) {
        async.mapLimit(item.deps, 5, function packShortDepsAndSelf(dep, done) {
            commonPackage.getLoader(dep.plugin)(dep, root, done);
        }, function shortDepsDone(err, loadedDependencies) {
            if (err) {
                done(err);
            } else {
               fs.writeFile(
                  item.tempPath,
                  loadedDependencies.reduce(function concatDependencies(res, modContent) {
                     return res + (res ? '\n' : '') + modContent;
                  }, ''),
                  done
               );
            }
        });
    }, function renameTempFiles(err) {
        if (err) {
            taskDone(err);
        } else {
           /**
            * Для Сервиса Представлений не трогаем оригиналы и оставляем .modulepack.js файлы, они в дальнейшем
            * в таске минификации будут минифицированы и сохранены в .min.js, а
            * .modulepack.js удалены.
            */
           if (splittedCore) {
              taskDone();
           } else {
              async.eachLimit(allModules, 10, function renameTempFiles(item, done) {
                 if (dryRun) {
                    setImmediate(done);
                 } else {
                    /**
                     * для начала удостоверимся, что временный файл существует, поскольку один и тот же путь может
                     * быть у разных модулей-оригинал или например через is! плагин, это совершенно отдельные узлы и они
                     * также обрабатываются отдельно, но при этом работают с одним путём.
                     */
                    if (fs.existsSync(item.tempPath)) {
                       // Старую js тоже надо сохранить
                       commonPackage.copyFile(item.fullPath, item.fullPath.replace(/(\.js)$/, '.original$1'), function (err) {
                          if (err) {
                             done(err);
                          } else {
                             commonPackage.copyFile(item.tempPath, item.fullPath, function (err) {
                                if (err) {
                                   done(err);
                                } else {
                                   fs.unlink(item.tempPath, done);
                                }
                             });
                          }
                       });
                    } else {
                       //модуль уже обработан
                       done();
                    }
                 }
              }, taskDone);
           }
        }
    });
}

module.exports = packOwnDependencies;
