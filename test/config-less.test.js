'use strict';

const initTest = require('./init-test');
const configLessChecker = require('../lib/config-less-checker');

describe('less configuration checker', () => {
   before(async() => {
      await initTest();
   });

   it('should set false for "multi" option as default', () => {
      const config = {
         old: true
      };
      configLessChecker.checkOptions(config);
      config.hasOwnProperty('multi').should.equal(true);
      config.multi.should.equal(false);
   });

   it('should set true for "old" option as default', () => {
      const config = {
         multi: true
      };
      configLessChecker.checkOptions(config);
      config.hasOwnProperty('old').should.equal(true);
      config.old.should.equal(true);
   });

   it('should set true for "compatible" option as default', () => {
      const config = {
         multi: true,
         old: true
      };
      configLessChecker.checkOptions(config);
      config.hasOwnProperty('compatibility').should.equal(true);
      config.compatibility.should.equal(true);
   });

   it('empty user config.should set default values for "old", "multi" and "compatibility', () => {
      const config = {};
      configLessChecker.checkOptions(config);
      config.hasOwnProperty('old').should.equal(true);
      config.old.should.equal(true);
      config.hasOwnProperty('multi').should.equal(true);
      config.multi.should.equal(false);
      config.hasOwnProperty('compatibility').should.equal(true);
      config.compatibility.should.equal(true);
   });

   it('single pattern value: should reject error for bad pattern', () => {
      const checkConfig = (config) => {
         let result;
         try {
            configLessChecker.checkOptions(config);
         } catch (err) {
            result = err;
         }
         (result instanceof Error).should.equal(true);
         result.message.should.equal('паттерн для опции old в конфигурации по темизации задан не по стандартам glob-паттернов.' +
            ' Проверьте правильность описания паттерна: "bad pattern".');
      };
      let config = {
         old: 'bad pattern'
      };
      checkConfig(config);
      config = {
         multi: 'bad pattern'
      };
      checkConfig(config);
   });

   it('pattern\'s array value: should reject error for bad pattern in array', () => {
      const checkConfig = (config) => {
         let result;
         try {
            configLessChecker.checkOptions(config);
         } catch (err) {
            result = err;
         }
         (result instanceof Error).should.equal(true);
         result.message.should.equal('один из паттернов для опции old в конфигурации по темизации задан ' +
            'не по стандартам glob-паттернов. Проверьте правильность описания паттерна: "bad pattern".');
      };

      let config = {
         old: {
            exclude: [
               'Module1/**/*.less',
               'Module2/**/*.less',
               'bad pattern'
            ]
         }
      };

      // проверим, что плохой паттерн теперь роняет исключение для exclude
      checkConfig(config);
      config = {
         old: {
            include: [
               'Module1/**/*.less',
               'Module2/**/*.less',
               'bad pattern'
            ]
         }
      };

      // проверим, что плохой паттерн также роняет исключение для include
      checkConfig(config);
   });

   it('non array value: should reject error for exclude/include options', () => {
      let config = {
         old: {
            exclude: 'bad value for exclude'
         }
      };
      let result;
      try {
         configLessChecker.checkOptions(config);
      } catch (err) {
         result = err;
      }
      (result instanceof Error).should.equal(true);
      result.message.should.equal('theme type - old - exclude option: должен быть задан массив паттернов!');
      config = {
         old: {
            include: 'bad value for include'
         }
      };
      try {
         configLessChecker.checkOptions(config);
      } catch (err) {
         result = err;
      }
      (result instanceof Error).should.equal(true);
      result.message.should.equal('theme type - old - include option: должен быть задан массив паттернов!');
   });

   it('pattern\'s array value: should reject error for empty pattern array', () => {
      let config = {
         old: {
            exclude: []
         }
      };
      let result;
      try {
         configLessChecker.checkOptions(config);
      } catch (err) {
         result = err;
      }
      (result instanceof Error).should.equal(true);
      result.message.should.equal('theme type - old - exclude option: массив паттернов не может быть пустым!');
      true.should.equal(true);
      config = {
         old: {
            include: []
         }
      };

      try {
         configLessChecker.checkOptions(config);
      } catch (err) {
         result = err;
      }
      (result instanceof Error).should.equal(true);
      result.message.should.equal('theme type - old - include option: массив паттернов не может быть пустым!');
   });
});
