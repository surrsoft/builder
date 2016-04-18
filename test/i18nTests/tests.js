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
      exec('grunt i18n --root=./test/fixture --package', {
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

   var modules = path.join(__dirname, 'res/modules.json'),
      cache = path.join(__dirname, 'res/cache');
   before(function(done){
      var globalPaths = [
         path.join(__dirname, './../fixture/resources/Shop/Head'),
         path.join(__dirname, './../fixture/resources/Shop/Index')
      ];
      fs.writeFileSync(modules, JSON.stringify(globalPaths, null, 3));
      exec('grunt --root=./test/fixture --modules='+modules + ' --json-cache=' + cache + ' --prepare-xhtml', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('prepare-xhtml', function(){
      var HeadXhtmlContent = fs.readFileSync(path.join(__dirname, './../fixture/resources/Shop/Head/Head.xhtml')).toString(),
         IndexXhtmlContent = fs.readFileSync(path.join(__dirname, './../fixture/resources/Shop/Index/Index.xhtml')).toString();
      assert(HeadXhtmlContent.indexOf('{[Перейти на главную страницу]}') > -1, 'Head.xhtml: Phrase "Перейти на главную страницу" is not covered');
      assert(IndexXhtmlContent.indexOf('{[Добро пожаловать в интернет-магазин "Тензор"!]}') > -1, 'Index.xhtml: Phrase "Добро пожаловать в интернет-магазин "Тензор"!" is not covered');
      assert(IndexXhtmlContent.indexOf('{[Заголовок]}') > -1, 'Index.xhtml: option "Заголовок" is not covered')
   });

});

describe('i18n resultDictionary Test ', function() {

   var modules = path.join(__dirname, 'res/modules.json'),
      cache = path.join(__dirname, 'res/cache'),
      out = path.join(cache, 'out.json'),
      modulesPaths;
   before(function(done){
      modulesPaths = JSON.parse(fs.readFileSync(modules, 'utf-8'));
      exec('grunt --root=./test/fixture --out=' + out + ' --modules='+modules + ' --json-cache=' + cache + ' --make-dict', {
         cwd: path.join(__dirname, '../../')
      }, function() {
         done();
      });
   });

   it('make-dict', function(){
      var outJsonContent = readJSON('./res/cache/out.json');

      assert.equal(outJsonContent[0].key, 'Перейти на главную страницу', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[0].module, modulesPaths[0] + '\\Head.xhtml', 'Field module in the result dictionary has wrong value');
      assert.equal(outJsonContent[1].key, 'Заголовок', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[1].module, modulesPaths[1] + '\\Index.xhtml', 'Field module in the result dictionary has wrong value');
      assert.equal(outJsonContent[2].key, 'Добро пожаловать в интернет-магазин "Тензор"!', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[2].module, modulesPaths[1] + '\\Index.xhtml', 'Field module in the result dictionary has wrong value');
   });

});