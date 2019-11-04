'use strict';

const initTest = require('./init-test');
const Cache = require('../gulp/builder/classes/cache');

describe('builder cache', () => {
   before(async() => {
      await initTest();
   });

   it('check style themes cache', () => {
      const currentCache = new Cache({});
      currentCache.currentStore = {
         styleThemes: {
            default: {
               path: '/path/to/theme/default',
               config: {
                  tags: ['ws4-default'
                  ]
               }
            }
         }
      };
      currentCache.lastStore = {
         styleThemes: {
            default: {
               path: '/path/to/theme/default',
               config: {
                  tags: ['ws4-default']
               }
            }
         }
      };
      currentCache.checkThemesForUpdate();
      currentCache.dropCacheForLess.should.equal(false);
      currentCache.currentStore = {
         styleThemes: {
            default: {
               path: '/path/to/theme/default',
               config: {
                  tags: ['ws4-default', 'ws4-another-tag']
               }
            }
         }
      };
      currentCache.checkThemesForUpdate();
      currentCache.dropCacheForLess.should.equal(true);
   });

   it('check dependencies cache for less', () => {
      const currentCache = new Cache({});
      currentCache.currentStore.dependencies = {
         dependencies: {}
      };
      const currentDependencies = currentCache.currentStore.dependencies;
      currentCache.addDependencies('myModule/style', ['firstTheme/styles']);
      currentDependencies.hasOwnProperty('myModule/style').should.equal(true);
      currentDependencies['myModule/style'].should.have.members(['firstTheme/styles']);
      currentCache.addDependencies('myModule/style', ['secondTheme/styles']);
      currentDependencies.hasOwnProperty('myModule/style').should.equal(true);
      currentDependencies['myModule/style'].should.have.members(['firstTheme/styles', 'secondTheme/styles']);
   });
});
