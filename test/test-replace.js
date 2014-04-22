/**
 * Created by elifantievon on 22.04.14.
 */

var
   assert = require('assert'),
   path = require('path'),
   fs = require('fs'),
   exec = require('child_process').exec;

describe('versionize', function(){

   it('Can replace images in xml templates', function(done){

      exec('grunt --root=./test/fixture/replace --versionize=10 --force replace', {
         cwd: path.join(__dirname, '../')
      }, function(error, stdout, stderr) {
         assert.equal(error, null, "No errors");

         var result = fs.readFileSync(path.join(__dirname, './fixture/replace/test1.xml')).toString();

         assert.notEqual(result.indexOf('/img/file1.v10.jpg'), -1, "Direct file path replaced");
         assert.equal(result.indexOf('/img/file2.v10.jpg'), -1, "ws:/ path is not replaced");

         done();
      });

   })

});