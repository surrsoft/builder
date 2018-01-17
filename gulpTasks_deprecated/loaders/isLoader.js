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

const loaders = {
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

module.exports = function (module, base) {
    let if_condition    = 'if(%c)';
    let else_condition  = 'else';
    if (module.moduleFeature === 'browser') {
        if_condition = if_condition.replace('%c', 'typeof window !== "undefined"');
    }
    if (module.moduleFeature === 'msIe') {
        if_condition = if_condition.replace('%c', 'typeof window !== "undefined" && navigator && navigator.appVersion.match(/MSIE\\s+(\\d+)/)');
    }
    if (module.moduleFeature === 'compatibleLayer') {
        if_condition = if_condition.replace('%c', 'typeof window === "undefined" || window && window.location.href.indexOf("withoutLayout")===-1');
    }
    if (module.moduleYes) {
        return loaders[module.moduleYes.plugin](module.moduleYes, base)
            .then(res => {
                if_condition = if_condition + '{' + res + '}';
                if (module.moduleNo) {
                    return loaders[module.moduleNo.plugin](module.moduleNo, base)
                        .then(res => {
                            else_condition = else_condition + '{' + res + '}';
                            return (if_condition + else_condition);
                        });
                } else {
                    return if_condition;
                }
            });
    } else {
        return new Promise(() => {});
    }
};
