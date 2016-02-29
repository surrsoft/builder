var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

describe('deanonimyze', function(){
   before(function(done){
      this.timeout(15000);
      exec('grunt --root=./test/fixture collect-dependencies', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
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