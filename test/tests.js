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
         cwd: path.join(__dirname, '../')
      }, function() {
         done();
      });
   });

   it('index-dict', function(){
      var
         contents = readJSON('./fixture/resources/contents.json'),
         field,
         expect;

      field = 'availableLanguage';
      expect = 'English';
      assert.equal(contents.availableLanguage['en-US'], expect, 'Indexing dictionary error. Field ' + field + ' in contents.json has wrong value. ');

      field = "SBIS3.MySite.Head.en-US.json";
      expect = "resources/Shop/Head/resources/lang/en-US/en-US.json";
      assert.equal(contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      field = "SBIS3.MySite.Index.en-US.json";
      expect = "resources/Shop/Index/resources/lang/en-US/en-US.json";
      assert.equal(contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

   });

});

describe('i18n Packing Test ', function() {

   before(function(done){
      this.timeout(15000);
      exec('grunt i18n --root=./test/fixture --package', {
         cwd: path.join(__dirname, '../')
      }, function() {
         done();
      });
   });

   it('package', function(){

      var
         indexDict = readJSON('./fixture/resources/Shop/Index/resources/lang/en-US/en-US.json'),
         headDict = readJSON('./fixture/resources/Shop/Head/resources/lang/en-US/en-US.json'),
         contents = readJSON('./fixture/resources/contents.json'),
         packedDict = readJSON('./fixture/resources/packer/i18n/en-US.json'),
         field,
         expect;

      field = "SBIS3.MySite.Head.en-US.json";
      expect = "resources/packer/i18n/en-US.json";
      assert.equal(contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      field = "SBIS3.MySite.Index.en-US.json";
      assert.equal(contents.dictionary[field], expect, 'Packing dictionary error. Field ' + field + ' in contents.json has wrong value.');

      for (var word in indexDict) {
         if (!indexDict.hasOwnProperty(word)) continue;

         assert.equal(indexDict[word], packedDict[word], 'Packing dictionary error. ' + word + ' in Index dictionary is: ' + indexDict[word] + ', but in packed dictionary: ' + packedDict[word]);
      }

      for (word in headDict) {
         if (!headDict.hasOwnProperty(word)) continue;

         assert.equal(headDict[word], packedDict[word], 'Packing dictionary error. ' + word + ' in Head dictionary is: ' + headDict[word] + ', but in packed dictionary: ' + packedDict[word]);
      }

   });
});

describe('i18n prepareXHTML Test ', function() {

   var
      modules = path.join(__dirname, 'results/modules.json'),
      cache = path.join(__dirname, 'results/cache');

   before(function(done){
      this.timeout(15000);
      var globalPaths = [
         path.join(__dirname, './fixture/resources/Shop/Head'),
         path.join(__dirname, './fixture/resources/Shop/Index')
      ];
      fs.writeFileSync(modules, JSON.stringify(globalPaths, null, 3));
      exec('grunt --root=./test/fixture --modules='+modules + ' --json-cache=' + cache + ' --prepare-xhtml', {
         cwd: path.join(__dirname, '../')
      }, function() {
         done();
      });
   });

   it('prepare-xhtml', function(){
      var
         headXhtmlContent = fs.readFileSync(path.join(__dirname, './fixture/resources/Shop/Head/Head.xhtml')).toString(),
         indexXhtmlContent = fs.readFileSync(path.join(__dirname, './fixture/resources/Shop/Index/Index.xhtml')).toString();

      assert(headXhtmlContent.indexOf('{[Перейти на главную страницу]}') > -1, 'Head.xhtml: Phrase "Перейти на главную страницу" is not covered');
      assert(indexXhtmlContent.indexOf('{[Добро пожаловать в интернет-магазин "Тензор"!]}') > -1, 'Index.xhtml: Phrase "Добро пожаловать в интернет-магазин "Тензор"!" is not covered');
      assert(indexXhtmlContent.indexOf('{[Заголовок]}') > -1, 'Index.xhtml: option "Заголовок" is not covered')
   });

});

describe('i18n resultDictionary Test ', function() {

   var
      modules = path.join(__dirname, 'results/modules.json'),
      cache = path.join(__dirname, 'results/cache'),
      out = path.join(cache, 'out.json'),
      modulesPaths;

   before(function(done){
      this.timeout(15000);
      modulesPaths = JSON.parse(fs.readFileSync(modules, 'utf-8'));
      exec('grunt --root=./test/fixture --out=' + out + ' --modules='+modules + ' --json-cache=' + cache + ' --make-dict', {
         cwd: path.join(__dirname, '../')
      }, function() {
         done();
      });
   });

   it('make-dict', function(){
      var outJsonContent = readJSON('./results/cache/out.json');

      assert.equal(outJsonContent[0].key, 'Перейти на главную страницу', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[0].module, modulesPaths[0] + '\\Head.xhtml', 'Field module in the result dictionary has wrong value');
      assert.equal(outJsonContent[1].key, 'Заголовок', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[1].module, modulesPaths[1] + '\\Index.xhtml', 'Field module in the result dictionary has wrong value');
      assert.equal(outJsonContent[2].key, 'Добро пожаловать в интернет-магазин "Тензор"!', 'Field key in the result dictionary has wrong value');
      assert.equal(outJsonContent[2].module, modulesPaths[1] + '\\Index.xhtml', 'Field module in the result dictionary has wrong value');
   });

});

describe('deanonymize', function(){
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture deanonymize', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
         console.log(error);
         assert.equal(error, null, "No errors");
         done();
      });
   });

   it('deanonimyze', function(){
      var result = fs.readFileSync(path.join(__dirname, './fixture/resources/Shop/Head/resources/SubHead.js')).toString();

      assert.notEqual(result.indexOf('js!SBIS3.MySite.Head/resources/SubHead'), -1, "deanonimyze failed");
   });
});

describe('collect-dependencies', function(){
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture collect-dependencies', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
         console.log(error);
         assert.equal(error, null, "No errors");
         done();
      });
   });

   it('module-dependencies.json is correct', function(){
      var expect = require(path.join(__dirname, './results/module-dependencies.json'));
      var result = require(path.join(__dirname, './fixture/resources/module-dependencies.json'));

      assert.equal(JSON.stringify(result), JSON.stringify(expect), "module-dependensies.json isn't correct");
   });
});

describe('packwsmod', function(){
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture packwsmod', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
         console.log(error);
         assert.equal(error, null, "No errors");
         done();
      });
   });

   it('.html modify', function(){
      var result = fs.readFileSync(path.join(__dirname, './fixture/index.html')).toString();

      assert.notEqual(result.indexOf('/resources/packer/modules/'), -1, ".html correct");
   });

   it('package created', function(){
      var result = fs.readdirSync(path.join(__dirname, './fixture/resources/packer/modules'));

      assert.equal(result.length, 2, "package created");
   });
});

describe('owndepspack', function(){
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture owndepspack', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
         console.log(error);
         assert.equal(error, null, "No errors");
         done();
      });
   });

   it('Own deps collect', function(){
      var Index = fs.readFileSync(path.join(__dirname, './fixture/resources/Shop/Index/Index.module.js')).toString();
      var Head = fs.readFileSync(path.join(__dirname, './fixture/resources/Shop/Head/Head.module.js')).toString();

      assert.notEqual(Index.indexOf('define("html!SBIS3.MySite.Index"'), -1, "Index html dep isn't correct");
      assert.notEqual(Index.indexOf('define("css!SBIS3.MySite.Index"'), -1, "Index css dep isn't correct");
      assert.notEqual(Head.indexOf('define("html!SBIS3.MySite.Head"'), -1, "Head html dep isn't correct");
      assert.notEqual(Head.indexOf('define("css!SBIS3.MySite.Head"'), -1, "Head css dep isn't correct");
   });
});