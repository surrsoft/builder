'use strict';

const
   fs = require('fs'),
   path = require('path'),
   logger = require('../logger').logger(),
   childProcess = require('child_process'),
   mkdirp = require('mkdirp'),
   helpers = require('../../lib/helpers');

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
            'modules=' + modules,
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
   return new Promise(function(resolve, reject) {
      try {
         const componentsProperties = {};

         helpers.recurse(directory, function(fullPath, callback) {
            fs.readFile(fullPath, function(err, jsonText) {
               if (err) {
                  logger.debug('jsonGenerator. readAllJSON: Can\'t read ' + fullPath);
                  setImmediate(callback);
                  return;
               }
               if (!fullPath.endsWith('.json')) {
                  setImmediate(callback);
                  return;
               }

               let tmpProperties;
               try {
                  tmpProperties = JSON.parse(jsonText.toString());
               } catch (e) {
                  logger.debug('jsonGenerator. readAllJSON: Can\'t parse ' + fullPath);
               }
               if (tmpProperties && tmpProperties.properties &&
                  tmpProperties.properties['ws-config'] &&
                  tmpProperties.properties['ws-config'].options) {

                  const componentName = helpers.prettifyPath(path.relative(directory, fullPath).replace(/\.json$/g, ''));

                  //TODO: сейчас json дублируются и в componentsProperties попадает лишняя информация
                  componentsProperties[componentName] = tmpProperties;
               }
               setImmediate(callback);
            });
         }, function(err) {
            if (err) {
               reject(err);
            } else {
               resolve(componentsProperties);
            }
         });
      } catch (err) {
         reject(err);
      }
   });
}

module.exports = function(modules, jsonOutput) {
   return new Promise(function(resolve, reject) {
      generateJsDoc(modules, jsonOutput, async function(error) {
         if (error) {
            reject(error);
            return;
         }
         try {
            resolve(await readAllJSON(jsonOutput));
         } catch (err) {
            reject(err);
         }

      });
   });
};

