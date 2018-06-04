'use strict';

// TODO: разобраться почему объявление gulp после WS не работает
require('gulp');

// логгер - глобальный, должен быть определён до инициализации WS
require('../lib/logger').setGulpLogger();
require('../gulp/helpers/node-ws').init();

const chai = require('chai'),
   chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();
