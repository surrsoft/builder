'use script';
var crypto = require('crypto');
var xmldom = require('tensor-xmldom');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var parser = new xmldom.DOMParser();
var serializer = new xmldom.XMLSerializer();

function resolveThemeByWsConfig(dom) {
  try {
    var configText = dom.getElementById('ws-config').textContent;
    configText = configText.replace('window.', 'MyConfig.');
    return eval('var MyConfig = {};' + configText).themeName || null;
  }
  catch(e) {
    return null;
  }
}

function wrap(obj, prop, replacer) {
    (function (orig) {
        obj[prop] = replacer;
        obj[prop].restore = function () {
            obj[prop] = orig;
        }
    })(obj[prop]);
}

function uniqname(names, ext) {
    var md5 = crypto.createHash('md5');
    md5.update(names + "");
    return md5.digest('hex') + '.' + ext;
}

function domify(f, mime) {
    if (domCache[f]) {
        return domCache[f];
    }
    var errors = [];
    wrap(console, 'log', function (m) {
        errors.push(m);
    });
    wrap(console, 'error', function (m) {
        errors.push(m);
    });
    domCache[f] = parser.parseFromString(fs.readFileSync(f, 'utf-8'), mime || 'text/html');
    console.log.restore();
    console.error.restore();

    return domCache[f];
}

function stringify(dom) {
    return serializer.serializeToString(dom);
}

function mkDomNode(document, node, attributes) {
    var newNode = document.createElement(node);
    Object.keys(attributes || {}).forEach(function (attrName) {
        newNode.setAttribute(attrName, attributes[attrName]);
    });
    if (node == 'script') {
        newNode.textContent = ' ';
    }
    return newNode;
}

function mkCommentNode(document, data) {
    return document.createComment(data);
}

function removeDomCollection(col, filter) {
    var deadlist = [];
    for (var i = 0, l = col.length; i < l; i++) {
        if (!filter || filter(col[i]))
            deadlist.push(col[i]);
    }
    for (i = 0, l = deadlist.length; i < l; i++) {
        deadlist[i].parentNode.removeChild(deadlist[i]);
    }
}

function checkFiles(root, sourceFile, result) {
    var isSane = true, errors = [];
    result.files.forEach(function (packItem, i) {
        var fullPath = path.join(root, packItem);
        if (!fs.existsSync(fullPath)) {
            var l = result.nodes[i].lineNumber,
                c = result.nodes[i].columnNumber;
            errors.push(("line " + l + " col " + c + ": file not found").bold + " " + packItem);
            isSane = false;
        }
    });
    if (!isSane) {
        console.log("Warning: ".yellow.bold + path.relative(root, sourceFile) + " skipped");
        console.log(errors.join("\n"));
    }
    return isSane;
}

var helpers, domCache = {};

helpers = {
    uniqname: uniqname,
    domify: domify,
    resolveThemeByWsConfig : resolveThemeByWsConfig,
    stringify: stringify,
    mkDomNode: mkDomNode,
    mkCommentNode: mkCommentNode,

    package: function (fileset, root, packageHome, collector, packer, nodeProducer, ext) {
        fileset.map(function (f) {
            var dom = domify(f),
                results = collector(dom);

            results.forEach(function (result) {
                var packedContent, packedFiles = [];

                if (result.files.length > 1) {
                    if (checkFiles(root, f, result)) {
                        packedContent = packer(result.files.map(function (fl) {
                            return path.join(root, fl);
                        }).filter(function deleteControls(filename){
                            if (ext === 'css') {
                                return !~filename.indexOf('SBIS3.CONTROLS/components');
                            } else {
                                return true;
                            }
                        }), root);

                        // For each result content item create uniq filename and write item to it
                        packedContent.forEach(function (aSinglePackedFileContent, idx) {
                            var packedFile = path.join(packageHome, uniqname(result.files, idx + '.' + ext));
                            packedFiles.push(packedFile);
                            mkdirp.sync(path.dirname(packedFile));
                           fs.writeFileSync(packedFile, aSinglePackedFileContent);
                        });

                        // Remove initial collection from DOM
                        removeDomCollection(result.nodes);

                        // For each packed file create new DOM node and attach it to document
                        packedFiles.forEach(function (aSingleFile) {
                            var newNode = nodeProducer(dom, path.relative(root, aSingleFile));
                            result.before ? result.before.parentNode.insertBefore(newNode, result.before) : dom.getElementsByTagName('head')[0].appendChild(newNode);
                        });

                        // update HTML
                        fs.writeFileSync(f, stringify(dom));

                        console.log("OK  : ".green + f);
                    } else {
                        console.error("Skip: ".red.bold + f);
                    }
                }
            });
        });
    }
};

module.exports = helpers;
