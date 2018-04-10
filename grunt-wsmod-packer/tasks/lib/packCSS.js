var path = require('path');
var helpers = require('./../../lib/domHelpers');
var cssHelpers = require('./../../lib/cssHelpers');
var fs = require('fs');
var async = require('async');

var dblSlashes = /\\/g;
var nopLogger = {
    warn: function () {

    }
};

module.exports = {
    gruntPackCSS: function (htmlFiles, root, packageHome) {
        function collector(dom) {
            var links = dom.getElementsByTagName('link'),
                files = [],
                elements = [],
                before, link, href, packName, rel, media;
            for (var i = 0, l = links.length; i < l; i++) {
                link = links[i];
                packName = link.getAttribute('data-pack-name');

                // data-pack-name='skip' == skip this css from packing
                if (packName == 'skip')
                    continue;

                href = links[i].getAttribute('href');
                rel = links[i].getAttribute('rel');
                media = links[i].getAttribute('media') || 'screen';

                // stylesheet, has href ends with .css and not starts with http or //, media is screen
                if (href && rel == 'stylesheet' && media == 'screen' &&
                    href.indexOf('http') !== 0 &&
                    href.indexOf('//') !== 0 &&
                    href.indexOf('.css') !== href.length - 3) {
                    files.push(href);
                    elements.push(link);
                    before = link.nextSibling;
                }
            }

            return [{
                files: files,
                nodes: elements,
                before: before
            }];
        }

        function packer(files, root) {
            return cssHelpers.splitIntoBatches(4000, cssHelpers.bumpImportsUp(files.map(function (css) {
                return cssHelpers.rebaseUrls(root, css, fs.readFileSync(css));
            }).join('\n')));
        }

        function getTargetNode(dom, path) {
            return helpers.mkDomNode(dom, 'link', {
                rel: 'stylesheet',
                href: '/' + path.replace(dblSlashes, '/')
            });
        }

        helpers.package(htmlFiles, root, packageHome, collector, packer, getTargetNode, 'css');
    },

    /**
     * @callback packCSS~callback
     * @param {Error} error
     * @param {String} [result]
     */
    /**
     * Пакует переданные css. Делит пакет на пачки по 4000 правил (ie8-9)
     * @param {Array.<String>} files - пути до файлов
     * @param {String} root - корень сайта
     * @param {packCSS~callback} callback
     */
    packCSS: function (files, root, callback, logger, isInline, themeName) {
        if (!logger) {
            logger = nopLogger;
        }
        logger.warn('collectAndPackCSS: packCSS', 'files.length:', files.length);

        function _read(css, cb, onemore) {
            fs.readFile(css, function (err, content) {
                if (err) {
                    cb(err);
                } else {
                    var size = Buffer.byteLength(content);
                    if (!size && isInline) {
                        logger.warn('collectAndPackCSS: packCSS', 'file size:', size, 'css: ', css);
                        if (onemore) {
                            //Защита от гонок. Если при чтении css оказывается пустым, пытаемся перечитать его еще раз.
                            //Если все еще пуст, отдаем все как было.
                            logger.warn('collectAndPackCSS: packCSS', 'File is empty. Read one more time');
                            _read(css, cb, false);
                        } else {
                            cb(new Error('packCss: emptyFile'));
                        }
                    } else {
                        cb(null, cssHelpers.rebaseUrls(root, css, content.toString()));
                    }
                }
            });
        }
        files = files.filter(function(file){
           if (!fs.existsSync(file)) {
               logger.warn('collectAndPackCSS: packCSS', 'ENOENT: File ' + file + 'not found. Ignored');
               return false;
           }
           return true;
        });
        async.map(files, function (css, cb) {
            _read(css, cb, true);
        }, function (err, results) {
            if (err) {
                callback(err);
            } else {
                var res = results.join('\n');
                res = cssHelpers.bumpImportsUp(res);
                logger.warn('collectAndPackCSS: packCSS', 'result size:', Buffer.byteLength(res));
                callback(null, cssHelpers.splitIntoBatches(4000, res));
            }
        });
    }
};
