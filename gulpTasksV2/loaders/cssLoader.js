'use strict';

const fs                        = require('fs');
const rebaseUrlsToAbsolutePath  = require('grunt-wsmod-packer/lib/cssHelpers.js').rebaseUrls;

module.exports = function (module, base, done, themeName) {
    let suffix = themeName ? '__' + themeName : '';
    let modulePath = module.fullPath;
    if (suffix && ~module.fullName.indexOf('SBIS3.CONTROLS')) modulePath = modulePath.slice(0, -4) + suffix + '.css';
    return new Promise((resolve, reject) => {
        fs.readFile(modulePath, (err, res) => {
            if (err) {
                console.log(err);
                return resolve();
            }

            rebaseUrls(base, modulePath,
                styleTagLoader(
                    asModuleWithContent(
                        onlyForIE10AndAbove(
                            ignoreIfNoFile(resolve, 'cssLoader')
                        ),
                        module.fullName
                    )
                )
            ).call(this, err, res);
        });

    });
};

function rebaseUrls(root, sourceFile, f) {
    return function(err, res) {
        if (err) {
            f(err);
        } else {
            f(null, rebaseUrlsToAbsolutePath(root, sourceFile, res));
        }
    }
}

function styleTagLoader(f) {
    return function createStyleNodeWithText (err, res) {
        if (err) {
            f(err);
        } else {
            let code = '\
                function() {\
                var style = document.createElement("style"),\
                head = document.head || document.getElementsByTagName("head")[0];\
                style.type = "text/css";\
                style.appendChild(document.createTextNode(' + JSON.stringify(res) + '));\
                head.appendChild(style);\
                }';
            f(null, code);
        }
    }
}

function asModuleWithContent (f, modName) {
    return function wrapWithModule(err, res) {
        if (err) {
            f(err);
        } else {
            f(null, 'define("' + modName + '", ' + res + ');');
        }
    };
}

function onlyForIE10AndAbove (f) {
    return function onlyRunCodeForIE10AndAbove (err, res) {
        if (err) {
            f(err);
        } else {
            f(null, 'if(typeof window !== "undefined" && window.atob && document.cookie.indexOf("thmname") === -1){' + res + '}');
        }
    }
}

function ignoreIfNoFile (f, loaderName) {
    return function log404AndIgnoreIt(err, res) {
        if (err && (err.code == 'ENOENT' || err.code == 'EISDIR') && !not404error) {
            console.log('Potential 404 error: ' + err + '. ' + currentFile, loaderName);
            f(null, '');
            return;
        }
        f(err, res);
    }
}
