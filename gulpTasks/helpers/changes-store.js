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

      //this.store ещё может быть в работе. и нам не нужна информация о несуществующих сущностях
      let tmpStore = {};
      for (let modulePath in this.store) {
         if (!this.store.hasOwnProperty(modulePath)) {
            continue;
         }
         if (this.store[modulePath]['exist']) {
            tmpStore[modulePath] = {files: {}};
            const files = this.store[modulePath]['files'];
            for (let filePath in files) {
               if (!files.hasOwnProperty(filePath)) {
                  continue;
               }
               if (files[filePath]['exist']) {
                  tmpStore[modulePath]['files'][filePath] = {
                     time: files[filePath]['time']
                  };
               }

            }
         }
      }
      fs.writeFileSync(this.filePath, JSON.stringify(tmpStore));
   }
}

module.exports = ChangesStore;
