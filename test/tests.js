var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

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