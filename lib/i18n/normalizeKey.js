/**
 * Created by is.kudryavcev on 28.11.2017.
 */
const path = require('path');
const fs = require('fs');

(function () {

   function readDict(resourceRoot, nameDir) {
      let dictPath = path.normalize(path.join(resourceRoot, nameDir, 'lang/en-US/en-US.json'));

      if (fs.existsSync(dictPath)) {
         return JSON.parse(fs.readFileSync(dictPath));
      } else {
         return '';
      }
   }

   function writeDict(resourceRoot, nameDir, data) {
      let dictPath = path.normalize(path.join(resourceRoot, nameDir, 'lang/en-US/en-US.json'));

      if (fs.existsSync(dictPath)) {
         fs.writeFileSync(dictPath, JSON.stringify(data, undefined, 2));
      }
   }




   module.exports = {
      normalize: function (grunt, data){
         let
            applicationRoot = path.join(data.root, data.application),
            resourceRoot = path.join(applicationRoot, 'resources'),
            namesDir = fs.readdirSync(resourceRoot),
            allDict = {},
            unitDict;

         namesDir.forEach(function(dir) {
            let dict = readDict(resourceRoot, dir);

            if (dict) {
               allDict[dir] = dict;
            } else {
               return;
            }

            Object.keys(dict).forEach(function (key) {
               if (!unitDict[key]) {
                  unitDict[key] = dict[key];
               }
            });
         });

         Object.keys(allDict).forEach(function (dir) {
            Object.keys(allDict[dir]).forEach(function (key) {
               if (unitDict[key]) {
                  allDict[dir][key] = unitDict[key];
               }
            });
            writeDict(resourceRoot, dir, allDict[dir]);
         });

      }
   };
})();