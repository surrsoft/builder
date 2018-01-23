'use strict';

var path = require('path');

process.env.APPROOT = process.env.APPROOT || '/';
process.env.ROOT = path.resolve(process.env.ROOT || __dirname);
require('grunt-wsmod-packer/lib/node-ws')();

const htmlTmpl = require('./../lib/htmlTmpl/htmlTmpl');
const chai = require('chai');

chai.should();

describe('htmlTmpl', function() {
    describe('convert', function() {
        it('convert', function() {
            htmlTmpl.convertHtmlTmpl('<div>{{1+1}}</div>', '', function (result) {
                result.should.equal('<div>2</div>');
            });
        });
    });
});
