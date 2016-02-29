var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

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