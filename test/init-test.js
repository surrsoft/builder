'use strict';

require('gulp'); //TODO: разобраться почему объявление gulp после WS не работает
require('../lib/logger').setGulpLogger(require('gulplog')); //логгер - глобальный, должен быть определён до инициализации WS
require('../gulp/helpers/node-ws').init();

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

