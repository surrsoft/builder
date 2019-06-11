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
});
