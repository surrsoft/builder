/**
 * Created by ShilovDA on 11.10.13.
 */

"use strict";
var path = require('path');
var genJsDoc = require('./../jsDoc/generateJsDoc');
var grunt;

(function () {

    module.exports = {
        jsonGenerator: function (g, done) {
            if (!g) {
                return;
            } else {
                grunt = g;
            }

            var modules = grunt.option('modules').replace(/"/g, '');
            var cache = grunt.option('json-cache').replace(/"/g, '');


            var jsonOutput = cache || path.join(__dirname, '../../../../jsDoc-json-cache');

            genJsDoc(grunt, modules, jsonOutput, function (error) {
                if (error) {
                    grunt.fail.fatal(error);
                }

                done(error);
            });
        }
    }
})();