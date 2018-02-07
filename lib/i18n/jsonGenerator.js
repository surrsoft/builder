'use strict';
const
   fs = require('fs'),
   path = require('path'),
   logger = require('../logger').logger(),
   childProcess = require('child_process'),
   mkdirp = require('mkdirp');


const componentsProperties = [];

function generateJsDoc(modules, jsonOutput, cb) {
   try {
      let err = null;
      mkdirp(jsonOutput);

      logger.info('Построение метаинформации начато.');

      //TODO: переделть на fork или выполнять в текущем процессе.
      const jsDocWorker = childProcess.spawn(
         'node',
         [
            path.join(__dirname, 'json-generation-env.js'),
            'input=' + modules,
            'cache=' + jsonOutput
         ]);

      jsDocWorker.stdout.on('data', function(data) {
         logger.debug(data.toString());
      });

      jsDocWorker.stderr.on('data', function(data) {
         err = data;
         logger.warning(data.toString());
      });

      jsDocWorker.on('close', function(code) {
         logger.debug('JSON generation process exited with code ' + code);
         logger.info('Построение метаинформации выполнено.');

         cb(err);
      });
   } catch (err) {
      logger.error({
         error: err
      });
   }
}

function readAllJSON(directory) {
   /**
    * Вычитывает файл со свойствами контрола
    * @param {String} fileObj - название контрола
    */
   function readPropertiesJSON(fileObj) {
      const modPath = path.join(fileObj.path, fileObj.file);
      if (fs.existsSync(modPath)) {
         try {
            return JSON.parse(fs.readFileSync(modPath).toString());
         } catch (e) {
            logger.debug('jsonGenerator. readAllJSON: Can\'t read ' + modPath);
         }
      }
      return {};
   }

   const walkSync = function(dir, filelist) {
      const files = fs.readdirSync(dir);
      filelist = filelist || [];
      files.forEach(function(file) {
         if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = walkSync(path.join(dir, file), filelist);
         } else {
            filelist.push({path: dir, file: file});
         }
      });
      return filelist;
   };

   const files = walkSync(directory);
   files.forEach(function(fileObj) {
      const fileName = fileObj.file.replace(/\.json$/g, '');
      const tmpProperties = readPropertiesJSON(fileObj);
      if (tmpProperties.properties &&
         tmpProperties.properties['ws-config'] &&
         tmpProperties.properties['ws-config'].options) {

         const componentName = path.relative(directory, path.join(fileObj.path, fileName));

         //TODO: сейчас json дублируются и в componentsProperties попадает лишняя информация
         componentsProperties[componentName] = tmpProperties;
      }
   });


}

module.exports = {
   run: function(modules, jsonOutput, done) {
      generateJsDoc(modules, jsonOutput, function(error) {
         if (error) {
            logger.error({
               error: error
            });
         }

         readAllJSON(jsonOutput);
         done(error);
      });
   },
   componentsProperties: function() {
      return componentsProperties;
   }
};

