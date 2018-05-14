'use strict';

require('./init-test');

const path = require('path'),
   fs = require('fs-extra'),
   normalizeKey = require('../lib/i18n/normalize-key');

const workspaceFolder = path.join(__dirname, 'workspace'),
   fixtureFolder = path.join(__dirname, 'fixture/normalize-key');

const languages = ['en-US', 'ru-RU'];

describe('lib/i18n/normalize-key.js', function() {
   before(async function() {
      await fs.remove(workspaceFolder);
      await fs.copy(fixtureFolder, workspaceFolder);
   });
   after(async function() {
      await fs.remove(workspaceFolder);
   });
   it('main', async() => {
      await normalizeKey(workspaceFolder, languages);
      const dictModule1 = await fs.readJSON(path.join(workspaceFolder, 'Module1/lang/en-US/en-US.json'));
      dictModule1.should.deep.equal({
         'test': 'Значение, которое должно перезатереть всех',
         'simple1': 'simple1'
      });

      const dictModule2 = await fs.readJSON(path.join(workspaceFolder, 'Module2/lang/en-US/en-US.json'));
      dictModule2.should.deep.equal({
         'test': 'Значение, которое должно перезатереть всех',
         'simple2': 'simple2'
      });

      const dictModule3 = await fs.readJSON(path.join(workspaceFolder, 'Module3/lang/en-US/en-US.json'));
      dictModule3.should.deep.equal({
         'test': 'Значение, которое должно перезатереть всех',
         'simple3': 'simple3'
      });
   });
});
