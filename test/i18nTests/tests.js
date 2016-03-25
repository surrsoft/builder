var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

function readJSON(jPath) {
   return JSON.parse(fs.readFileSync(path.join(__dirname, jPath)).toString())
}

describe('i18n Indexing Test', function() {

   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture --index-dict=en-US', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('index-dict', function(){
      var Contents = readJSON('./../fixture/resources/contents.json'),
         field,
         expect;

      field = 'availableLanguage';
      expect = 'English';
      assert.equal(Contents.availableLanguage['en-US'], expect, 'Indexing dictionary error. Field ' + field + ' in contents.json has wrong value. ');

      field = "SBIS3.MySite.Head.en-US.json";
      expect = "resources/Shop/Head/resources/lang/en-US/en-US.json";
      assert.equal(Contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      field = "SBIS3.MySite.Index.en-US.json";
      expect = "resources/Shop/Index/resources/lang/en-US/en-US.json";
      assert.equal(Contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

   });

});

describe('i18n Packing Test ', function() {

   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture --package', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('package', function(){
      var IndexDict = readJSON('./../fixture/resources/Shop/Index/resources/lang/en-US/en-US.json'),
         HeadDict = readJSON('./../fixture/resources/Shop/Head/resources/lang/en-US/en-US.json'),
         Contents = readJSON('./../fixture/resources/contents.json'),
         packedDict = readJSON('./../fixture/resources/packer/i18n/en-US.json'),
         field,
         expect;

      field = "SBIS3.MySite.Head.en-US.json";
      expect = "resources/packer/i18n/en-US.json";
      assert.equal(Contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      field = "SBIS3.MySite.Index.en-US.json";
      assert.equal(Contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      for (var word in IndexDict) {
         if (!IndexDict.hasOwnProperty(word)) continue;

         assert.equal(IndexDict[word], packedDict[word], 'Packing dictionary error. ' + word + ' in Index dictionary is: ' + IndexDict[word] + ', but in packed dictionary: ' + packedDict[word]);
      }

      for (word in HeadDict) {
       if (!HeadDict.hasOwnProperty(word)) continue;

       assert.equal(HeadDict[word], packedDict[word], 'Packing dictionary error. ' + word + ' in Head dictionary is: ' + HeadDict[word] + ', but in packed dictionary: ' + packedDict[word]);
       }

   });

});

describe('i18n prepareXHTML Test ', function() {

   var modules = "C:/Users/ai.esin/Repo/builder/sbis3-builder/test/i18nTests/res/modules.json",
      cache = 'C:/Users/ai.esin/Repo/builder/sbis3-builder/test/i18nTests/res';
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture --modules='+modules + ' --json-cache=' + cache + ' --prepare-xhtml', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('prepare-xhtml', function(){
      var xhtmlContent = fs.readFileSync(path.join(__dirname, './../fixture/resources/Shop/Head/Head.xhtml')).toString();
      assert(xhtmlContent.indexOf('{[Перейти на главную страницу]}') > -1, 'Phrase "Перейти на главную страницу" is not covered');
   });

});

describe('i18n resultDictionary Test ', function() {

   var modules = "C:/Users/ai.esin/Repo/builder/sbis3-builder/test/i18nTests/res/modules.json",
      cache = 'C:/Users/ai.esin/Repo/builder/sbis3-builder/test/i18nTests/res',
      out = cache + '/out.json';
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture --out=' + out + ' --modules='+modules + ' --json-cache=' + cache + ' --make-dict', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('make-dict', function(){
      var outJsonContent = readJSON('./res/out.json'),
         expectKey = 'Перейти на главную страницу',
         expectModule = 'resources\\Shop\\Head\\Head.xhtml';

      assert.equal(outJsonContent[0].key, expectKey, 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[0].module, expectModule, 'Field module in the result dictionary has wrong value');
   });

});