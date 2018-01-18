'use strict';

const path = require('path'),
   fs = require('fs'),
   mkdirp = require('mkdirp');


/*
структура стора:
{
   modulePath: {
      exist = true; <- может не быть
      files: {
         filePath:{
            lastModified: '12:12:12';
            exist = true; <- может не быть
         }
      }
   }
}
exist не сохранаяется в файл
*/

class ChangesStore {
   constructor(dir) {
      this.filePath = path.join(dir, 'changes.json');
      this.store = {};
      if (fs.existsSync(this.filePath)) {
         this.store = JSON.parse(fs.readFileSync(this.filePath).toString('utf8'));
      }
   }

   save() {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
         mkdirp.sync(dir);
      }
      let tmpStore = JSON.parse(JSON.stringify(this.store)); //this.store ещё может быть в работе!
      for (let modulePath in tmpStore) {
         if (tmpStore.hasOwnProperty(modulePath)) {
            const files = tmpStore[modulePath]['files'];
            for (let filePath in files) {
               if (files.hasOwnProperty(filePath)) {
                  delete files[filePath]['exist'];
               }
            }
         }
      }
      fs.writeFileSync(this.filePath, JSON.stringify(tmpStore));
   }
}

module.exports = ChangesStore;
