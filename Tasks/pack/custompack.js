/* eslint-disable no-invalid-this */
/* eslint-disable no-restricted-properties */
'use strict';

const
   logger = require('../../lib/logger').logger(),
   modDeps = require('../../packer/lib/moduleDependencies'),
   path = require('path'),
   fs = require('fs-extra'),
   customPacker = require('../../lib/pack/custom-packer');

module.exports = function gruntCustomPack(grunt) {
   grunt.registerMultiTask('custompack', 'Задача кастомной паковки', async function() {
      let time = new Date();
      logger.info(`Запускается задача создания кастомных пакетов. time: ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`);
      try {
         const
            self = this,
            bundlesOptions = {
               bundles: {},
               modulesInBundles: {},
               outputs: {},
               splittedCore: self.data.splittedCore
            },
            applicationRoot = path.join(self.data.root, self.data.application),
            done = self.async(),
            wsRoot = await fs.pathExists(path.join(applicationRoot, 'resources/WS.Core')) ? 'resources/WS.Core' : 'ws',
            depsTree = await modDeps.getDependencyGraph(applicationRoot, bundlesOptions.splittedCore);

         let sourceFiles = grunt.file.expand({cwd: applicationRoot}, this.data.src);

         /**
          * Не рассматриваем конфигурации, которые расположены в директории ws, если сборка
          * для Сервиса Представлений, поскольку конфигурации из ws являются дублями конфигураций
          * из WS.Core и один и тот же код парсится дважды.
          */
         if (wsRoot !== 'ws') {
            sourceFiles = sourceFiles.filter(function(pathToSource) {
               return !/^ws/.test(pathToSource);
            });
         }

         const configsArray = await customPacker.getAllConfigs(sourceFiles, applicationRoot);
         if (configsArray.length === 0) {
            logger.info('Конфигураций не обнаружено.');
         }
         await customPacker.generatePackageJsonConfigs(depsTree, configsArray, applicationRoot, bundlesOptions);
         time = new Date();
         logger.info(`Задача создания кастомных пакетов завершена. ${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`);
         done();
      } catch (err) {
         logger.error({
            message: 'Ошибка выполнения кастомной паковки',
            error: err
         });
      }
   });
};
