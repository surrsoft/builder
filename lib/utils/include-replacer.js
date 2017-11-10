var fs = require('fs');
var path = require('path');

var
    transliterate = require('./transliterate'),
    INCLUDE = /%\{INCLUDE\s(?:"|')([^'"]*)(?:"|')\s?}/g,
    WINDOW_TITLE = /%\{WINDOW_TITLE}/g,
    APPEND_STYLE = /%\{APPEND_STYLE}/g,
    APPEND_JAVASCRIPT = /%\{APPEND_JAVASCRIPT}/g,
    ACCESS_LIST = /%\{ACCESS_LIST}/g,
    APPLICATION_ROOT = /%\{APPLICATION_ROOT}/g,
    SBIS_ROOT = /%\{WI\.SBIS_ROOT}/g,
    RESOURCE_ROOT = /%\{RESOURCE_ROOT}/g,
    SERVICES_PATH = /%\{SERVICES_PATH}/g,
    USER_PARAMS = /%\{CONFIG\.USER_PARAMS}/g,
    GLOBAL_PARAMS = /%\{CONFIG\.GLOBAL_PARAMS}/g,
    SAVE_LAST_STATE = /%\{SAVE_LAST_STATE}/g,
    START_DIALOG = /%\{START_DIALOG(.*)}/g;

var includeCache = {};

function replaceIncludes(text, opts) {
    while (INCLUDE.test(text)) {
        text = text.replace(INCLUDE, function (m, include) {
            try {
                var file = path.join(opts.ROOT, opts.RESOURCE_ROOT, transliterate(include));
                return includeCache[file] || (includeCache[file] = fs.readFileSync(file).toString());
            } catch (err) {
                console.error(err);
            }
        });
    }

    text = text.replace(WINDOW_TITLE, opts.WINDOW_TITLE);
    text = text.replace(APPEND_STYLE, opts.APPEND_STYLE);
    text = text.replace(APPEND_JAVASCRIPT, opts.APPEND_JAVASCRIPT);
    text = text.replace(ACCESS_LIST, opts.ACCESS_LIST);
   // text = text.replace(APPLICATION_ROOT, opts.APPLICATION_ROOT);
   // text = text.replace(SBIS_ROOT, opts.SBIS_ROOT);
   // text = text.replace(RESOURCE_ROOT, opts.RESOURCE_ROOT);
   // text = text.replace(SERVICES_PATH, opts.SERVICES_PATH);
    text = text.replace(USER_PARAMS, opts.USER_PARAMS);
    text = text.replace(GLOBAL_PARAMS, opts.GLOBAL_PARAMS);
    text = text.replace(SAVE_LAST_STATE, opts.SAVE_LAST_STATE);
    text = text.replace(START_DIALOG, opts.START_DIALOG);

    return text;
}

module.exports = replaceIncludes;