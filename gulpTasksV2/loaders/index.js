'use strict';

const jsLoader          = require('./jsLoader');
const htmlXhtmlLoader   = require('./htmlXhtmlLoader');
const tmplLoader        = require('./tmplLoader');
const jsonLoader        = require('./jsonLoader');
const isLoader          = require('./isLoader');
const browserLoader     = require('./browserLoader');
const cssLoader         = require('./cssLoader');
const i18nLoader        = require('./i18nLoader');
const textLoader        = require('./textLoader');

// TODO: optionalLoader, baseTextLoader, xmlLoader (хотя собралось и без них...)

module.exports = {
    js              : jsLoader,
    tmpl            : tmplLoader,
    html            : htmlXhtmlLoader,
    xhtml           : htmlXhtmlLoader,
    json            : jsonLoader,
    is              : isLoader,
    browser         : browserLoader,
    css             : cssLoader,
    'native-css'    : cssLoader,
    i18n            : i18nLoader,
    text            : textLoader
};
