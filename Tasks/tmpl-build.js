'use strict';

const path = require('path'),
   fs = require('fs-extra'),
   stripBOM = require('strip-bom'),
   pMap = require('p-map');

const logger = require('../lib/logger').logger(),
   tmplLocalizator = require('../lib/i18n/tmpl-localizator'),
   runJsonGenerator = require('../lib/i18n/run-json-generator'),
   helpers = require('../lib/helpers');

const DoT = global.requirejs('Core/js-template-doT');

const extFile = /(\.tmpl|\.x?html)$/;
const WSCoreReg = /(^ws\/)(deprecated)?/;
const requirejsPaths = global.requirejs.s.contexts._.config.paths;

function getModulenamesForPaths(mDeps, templateMask) {
   const namesForPaths = {};
   Object.keys(mDeps.nodes).forEach(function(node) {
      if (node.includes(templateMask)) {
         const prettyFilePath = helpers.prettifyPath(mDeps.nodes[node].path);
         if (!namesForPaths[prettyFilePath]) {
            namesForPaths[prettyFilePath] = [];
         }
         namesForPaths[prettyFilePath].push(node);
      }
   });
   return namesForPaths;
}

function removeLastSymbolIfSlash(filePath) {
   const lastSymbol = filePath[filePath.length - 1];

   if (lastSymbol === '/' || lastSymbol === '\\') {
      return filePath.slice(0, filePath.length - 1);
   }
   return filePath;
}

function checkPathForInterfaceModule(currentPath, application) {
   let resultPath = '',
      resultNode = '';

   //Учитываем возможность наличия application
   const prettyCurrentPath = helpers.removeLeadingSlash(helpers.prettifyPath(path.join(application, currentPath)));
   Object.keys(requirejsPaths).forEach(function(node) {
      const nodePath = helpers.prettifyPath(requirejsPaths[node]);
      if (prettyCurrentPath.indexOf(nodePath) === 0 && nodePath.length > resultPath.length) {
         resultPath = nodePath;
         resultNode = node;
      }
   });
   return helpers.prettifyPath(resultPath ? prettyCurrentPath.replace(resultPath, resultNode) : prettyCurrentPath);
}

/**
 * Создаёт шаблон в зависимости от типа шаблона (tmpl, xhtml, html)
 */
function createTemplate(templateOptions, namesForCurrentTemplate) {
   const contents = templateOptions.contents,
      deps = templateOptions.deps,
      nameModule = templateOptions.currentNode,
      plugin = nameModule.substr(0, nameModule.lastIndexOf('!') + 1);
   let data;

   if (plugin.indexOf('html!') > -1) {
      data = `define("${nameModule}",function(){var f=${contents};f.toJSON=function(){return {$serialized$:"func", module:"${nameModule}"}};return f;});`;
   } else if (plugin.indexOf('tmpl!') > -1) {
      data = `define("${nameModule}",${JSON.stringify(
         deps
      )},function(){var deps=Array.prototype.slice.call(arguments);${contents}});`;
   }

   if (namesForCurrentTemplate && namesForCurrentTemplate.length > 1) {
      const firstName = namesForCurrentTemplate.shift();
      namesForCurrentTemplate.forEach(function(moduleName) {
         data += `\ndefine("${moduleName}",["${firstName}"],function(template){return template;});`;
      });
   }
   return data;
}

async function writeTemplate(templateOptions, namesForCurrentTemplate, nodes, splittedCore) {
   /**
    * Позорный костыль для обратной поддержки препроцессора
    */
   const fullPath = templateOptions.fullPath,
      nameModule = templateOptions.currentNode,
      original = templateOptions.original,
      data = templateOptions.data;

   if (splittedCore) {
      await fs.writeFile(fullPath.replace(extFile, '.min$1'), data);
      if (nodes.hasOwnProperty(nameModule)) {
         nodes[nameModule].amd = true;
         nodes[nameModule].path = nodes[nameModule].path.replace(extFile, '.min$1');

         //Если имеются дополнительные дефайны для шаблонов, меняем пути и для них
         if (namesForCurrentTemplate && namesForCurrentTemplate[0] !== nameModule) {
            namesForCurrentTemplate.forEach(function(moduleName) {
               nodes[moduleName].amd = true;
               nodes[moduleName].path = nodes[moduleName].path.replace(extFile, '.min$1');
            });
         }
      }
   } else {
      await Promise.all([
         fs.writeFile(fullPath.replace(extFile, '.original$1'), original),
         fs.writeFile(fullPath, data)
      ]);
      if (nodes.hasOwnProperty(nameModule)) {
         nodes[nameModule].amd = true;
      }
   }
}

module.exports = function(grunt) {
   const splittedCore = grunt.option('splitted-core');

   if (splittedCore) {
      Object.keys(requirejsPaths).forEach(function(currentPath) {
         const result = requirejsPaths[currentPath].match(WSCoreReg);
         if (result && result[2]) {
            requirejsPaths[currentPath] = removeLastSymbolIfSlash(
               requirejsPaths[currentPath].replace(WSCoreReg, 'resources/WS.Deprecated/')
            );
         }
         requirejsPaths[currentPath] = removeLastSymbolIfSlash(
            requirejsPaths[currentPath].replace(WSCoreReg, 'resources/WS.Core/')
         );
      });
   }

   grunt.registerMultiTask('tmpl-build', 'Generate static html from modules', async function() {
      //eslint-disable-next-line no-invalid-this
      const self = this,
         done = self.async();

      try {
         logger.debug('Запускается задача tmpl-build.');
         const start = Date.now(),
            root = self.data.root,
            application = self.data.application,
            applicationRoot = path.join(root, application),
            mDeps = await fs.readJSON(path.join(applicationRoot, 'resources', 'module-dependencies.json')),
            nodes = mDeps.nodes,
            namesForPaths = getModulenamesForPaths(mDeps, 'tmpl!');

         let componentsProperties = {};

         //запускаем только при наличии задач локализации
         if (grunt.option('prepare-xhtml' || grunt.option('make-dict') || grunt.option('index-dict'))) {
            const optModules = grunt.option('modules').replace(/"/g, '');
            const optJsonCache = grunt.option('json-cache').replace(/"/g, '');
            const folders = await fs.readJSON(optModules);
            const resultJsonGenerator = await runJsonGenerator(folders, optJsonCache);
            for (const error of resultJsonGenerator.errors) {
               logger.warning({
                  message: 'Ошибка при разборе JSDoc комментариев',
                  filePath: error.filePath,
                  error: error.error
               });
            }
            componentsProperties = resultJsonGenerator.index;
         }

         const tmpl = global.requirejs('View/Builder/Tmpl'),
            config = global.requirejs('View/config');

         const tclosureStr = 'var tclosure=deps[0];';

         await pMap(
            self.files,
            async value => {
               const fullPath = helpers.prettifyPath(value.dest);
               try {
                  const html = stripBOM((await fs.readFile(fullPath)).toString()),
                     original = html;

                  if (splittedCore) {
                     /**
                      * пишем сразу оригинал в .min файл. В случае успешной генерации .min будет перебит сгенеренным шаблоном. В случае
                      * ошибки мы на клиенте не будем получать 404х ошибок на плохие шаблоны, а разрабам сразу прилетит в консоль ошибка,
                      * когда шаблон будет генерироваться находу, как в дебаге.
                      */
                     await fs.writeFile(fullPath.replace(extFile, '.min$1'), html);
                  }

                  if (html.indexOf('define') === 0) {
                     return;
                  }

                  const templateRender = Object.create(tmpl);
                  const filename = helpers.removeLeadingSlash(
                     fullPath.replace(helpers.prettifyPath(applicationRoot), '')
                  );
                  const traversedObj = await tmplLocalizator.parseTmpl(html, filename, componentsProperties);
                  const tmplFunc = templateRender.func(traversedObj.astResult, {
                     config: config,
                     filename: filename,
                     fromBuilderTmpl: true
                  });

                  const result = ['var templateFunction = '];
                  result.push(tmplFunc.toString() + ';');

                  if (tmplFunc.includedFunctions) {
                     result.push('templateFunction.includedFunctions = {');
                     result.push('};');
                  }

                  result.push('templateFunction.stable = true;');

                  /**
                   * Если имени узла для шаблона в module-dependencies не определено, генерим его автоматически
                   * с учётом путей до интерфейсных модулей, заданных в path в конфигурации для requirejs
                   */
                  let currentNode = namesForPaths[filename] ? namesForPaths[filename][0] : null;
                  if (!currentNode) {
                     currentNode = `tmpl!${checkPathForInterfaceModule(filename, application).replace(
                        /(\.min)?\.tmpl$/g,
                        ''
                     )}`;
                  }
                  result.push(
                     `templateFunction.toJSON = function() {return {$serialized$: "func", module: "${currentNode}"}};`
                  );
                  result.push('return templateFunction;');

                  let depsStr = 'var deps = {};';

                  const deps = [...templateRender.getComponents(html)];
                  depsStr += deps.reduce((accumulator, currentValue, index) => {
                     const indexStr = (index + 1).toString();
                     return `${accumulator}_deps["${currentValue}"] = deps[${indexStr}];`;
                  }, '');

                  const contents = tclosureStr + depsStr + result.join('');

                  const templateOptions = {
                     fullPath: fullPath,
                     currentNode: currentNode,
                     contents: contents,
                     original: original,
                     deps: deps
                  };
                  templateOptions.data = createTemplate(templateOptions, namesForPaths[filename]);
                  await writeTemplate(templateOptions, namesForPaths[filename], nodes, splittedCore);
               } catch (error) {
                  logger.error({
                     message: 'An ERROR occurred while building template',
                     filePath: fullPath,
                     error: error
                  });
               }
            },
            {
               concurrency: 20
            }
         );

         mDeps.nodes = nodes;
         await fs.outputJSON(path.join(applicationRoot, 'resources', 'module-dependencies.json'), mDeps, {
            spaces: 2
         });
         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);
      } catch (error) {
         logger.error({error: error});
      }
      done();
   });

   grunt.registerMultiTask('xhtml-build', 'Generate static html from modules', async function() {
      //eslint-disable-next-line no-invalid-this
      const self = this,
         done = self.async();
      try {
         logger.debug('Запускается задача xhtml-build.');
         const start = Date.now();
         const root = self.data.root,
            application = self.data.application,
            applicationRoot = path.join(root, application),
            mDeps = await fs.readJSON(path.join(applicationRoot, 'resources', 'module-dependencies.json')),
            nodes = mDeps.nodes,
            namesForPaths = getModulenamesForPaths(mDeps, 'html!');

         await pMap(
            self.files,
            async value => {
               const fullPath = helpers.prettifyPath(value.dest);
               try {
                  const filename = helpers.removeLeadingSlash(
                     fullPath.replace(helpers.prettifyPath(applicationRoot), '')
                  );
                  let currentNode = namesForPaths[filename] ? namesForPaths[filename][0] : null;

                  /**
                   * Если имени узла для шаблона в module-dependencies не определено, генерим его автоматически
                   * с учётом путей до интерфейсных модулей, заданных в path в конфигурации для requirejs
                   */
                  if (!currentNode) {
                     currentNode = `html!${checkPathForInterfaceModule(filename, application).replace(
                        /(\.min)?\.xhtml$/g,
                        ''
                     )}`;
                  }

                  let html = await fs.readFile(fullPath, 'utf8');

                  if (splittedCore) {
                     /**
                      * пишем сразу оригинал в .min файл. В случае успешной генерации .min будет перебит сгенеренным шаблоном. В случае
                      * ошибки мы на клиенте не будем получать 404х ошибок на плохие шаблоны, а разрабам сразу прилетит в консоль ошибка,
                      * когда шаблон будет генерироваться находу, как в дебаге.
                      */
                     await fs.writeFile(fullPath.replace(extFile, '.min$1'), html);
                  }
                  const original = html;
                  html = stripBOM(html);

                  if (html.indexOf('define') === 0) {
                     return;
                  }

                  const config = DoT.getSettings();

                  if (module.encode) {
                     config.encode = config.interpolate;
                  }
                  const template = DoT.template(html, config);
                  const contents = template.toString().replace(/[\n\r]/g, '');
                  const templateOptions = {
                     fullPath: fullPath,
                     currentNode: currentNode,
                     contents: contents,
                     original: original
                  };
                  templateOptions.data = createTemplate(templateOptions, namesForPaths[filename]);
                  await writeTemplate(templateOptions, namesForPaths[filename], nodes, splittedCore);
               } catch (error) {
                  logger.error({
                     message: 'An ERROR occurred while building template',
                     filePath: fullPath,
                     error: error
                  });
               }
            },
            {
               concurrency: 20
            }
         );

         mDeps.nodes = nodes;
         await fs.outputJSON(path.join(applicationRoot, 'resources', 'module-dependencies.json'), mDeps, {spaces: 2});

         logger.debug(`Duration: ${(Date.now() - start) / 1000} sec`);
      } catch (error) {
         logger.error({error: error});
      }
      done();
   });
};
