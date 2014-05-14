/**
 * Created by elifantievon on 22.04.14.
 */

var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

describe('versionize', function(){

   before(function(done){
      exec('grunt --root=./test/fixture/replace --versionize=10 --force replace', {
         cwd: path.join(__dirname, '../')
      }, function(error) {
         assert.equal(error, null, "No errors");
         done();
      });
   });

   it('Can versionize images in xml templates', function(){
      var result = fs.readFileSync(path.join(__dirname, './fixture/replace/test1.xml')).toString();

      assert.notEqual(result.indexOf('/img/file1.v10.jpg'), -1, "Direct file path replaced");
      assert.equal(result.indexOf('/img/file2.v10.jpg'), -1, "ws:/ path is not replaced");
   });

   it('Can versionize .js in .html files', function(){

      var result = fs.readFileSync(path.join(__dirname, './fixture/replace/test2.html')).toString();

      assert.notEqual(result.indexOf('"internal/file3.v10.js'), -1, "Direct relative file path replaced");
      assert.notEqual(result.indexOf('"/internal/file4.v10.js'), -1, "Direct absolute file path replaced");
      assert.equal(result.indexOf('"http://external/file1.v10.js'), -1, "External path is not replaced");
      assert.equal(result.indexOf('"//external/file2.v10.js'), -1, "External path is not replaced");

   });

});