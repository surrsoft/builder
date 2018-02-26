'use strict';

//логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger(require('gulplog'));

const chai = require('chai'),
   path = require('path'),
   fs = require('fs-extra'),
   BuildConfiguration = require('../gulp/classes/build-configuration.js'),
   ChangesStore = require('../gulp/classes/changes-store');

chai.should();

const workspaceFolder = path.join(__dirname, 'workspace');

describe('gulp/classes/changes-store.js', function() {
   it('тест инициализации ChangesStore с несуществующим кешем', async function() {
      const config = new BuildConfiguration();
      config.cachePath = path.join(workspaceFolder, 'cache.json');
      const changesStore = new ChangesStore();
      await changesStore.load(config);
      changesStore.lastStore.versionOfBuilder.should.equal('unknown');
      changesStore.currentStore.versionOfBuilder.includes('-BUILD').should.equal(true);
   });

   it('тест сохранения и загрузки кеша', async function() {
      const config = new BuildConfiguration();
      config.cachePath = workspaceFolder;
      const changesStore = new ChangesStore();
      await changesStore.load(config);
      await changesStore.save();
   });

});
