var path = require('path');
var postcss = require('postcss');
var postcssUrl = require('postcss-url');
var safe = require('postcss-safe-parser');

var invalidUrl = /^(\/|#|data:|[a-z]+:\/\/)(?=.*)/i;
var importCss = /@import[^;]+;/ig;
var dblSlashes = /\\/g;

function rebaseUrlsToAbsolutePath(root, sourceFile, css) {
    var result;
    try {
        result = postcss().use(postcssUrl({
            url: function (url, decl, from, dirname, to) {
                // ignore absolute urls, hashes or data uris
                if (invalidUrl.test(url)) {
                    return url;
                }

                return '/' + path.relative(to, path.join(from, url)).replace(dblSlashes, '/');
            }
        })).process(css, {
            parser: safe,
            from: sourceFile,
            // internally it uses path.dirname so we need to supply a filename
            to: path.join(root, 'someFakeInline.css')
        }).css;
    } catch (e) {
        console.log('Failed to parse CSS file. ' + e);
        result = '';
    }

    return result;
}

/**
 * Собирает все @import из склееных css, и перемещает их вверх,
 * т.к. все @import должны быть вверху css
 * @param {String} packedCss - пакованная css
 * @return {String}
 */
function bumpImportsUp(packedCss) {
    var imports = packedCss.match(importCss);
    if (imports) {
        imports.forEach(function (anImport) {
            packedCss = packedCss.replace(anImport, '');
        });
        packedCss = imports.join("\n") + packedCss;
    }

    return packedCss;
}

function splitIntoBatches(numSelectorsPerBatch, content) {

    var batches = [],
        numSelectorsInCurrentBatch = 0;

    function mkBatch() {
        var batch = postcss.root();
        batches.push(batch);
        numSelectorsInCurrentBatch = 0;
        return batch;
    }

    function serializeChildren(node) {
        return node.nodes ? node.nodes.reduce(fastSerialize, '{') + '}' : '';
    }

    function fastSerialize(memo, node) {
        if (node.type == 'decl') {
            return memo + node.prop + ':' + node.value + (node.important ? '!important' : '') + ';';
        }
        else if (node.type == 'rule') {
            return memo + node.selector + serializeChildren(node);
        }
        else if (node.type == 'atrule') {
            return memo + '@' + node.name + ' ' + node.params + (node.nodes ? serializeChildren(node) : ';');
        }
        return memo
    }

    function toCSSString(root) {
        return root.nodes.reduce(fastSerialize, '');
    }

    postcss().process(content, {parser: safe}).root.nodes.reduce(function splitRulesToBatches(batch, node) {
        // Считать селекторы будем только для CSS-правил (AtRules и т.п. - игнорируем)
        if (node.type == 'rule') {
            var numSelectorsInThisRule = node.selectors.length;
            // Если в пачке уже что-то есть и текущий селектор в нее не влезает - переносим в другую пачку
            // но в пустую пачку можно добавить блок, превышающий ограничения
            if (numSelectorsInCurrentBatch > 0) {
                if (numSelectorsInCurrentBatch + numSelectorsInThisRule > numSelectorsPerBatch) {
                    batch = mkBatch();
                }
            }
            numSelectorsInCurrentBatch += numSelectorsInThisRule;
        }

        batch.append(node);

        return batch;

    }, mkBatch());

    batches = batches.map(toCSSString);

    return batches;
}

module.exports = {
    rebaseUrls: rebaseUrlsToAbsolutePath,
    bumpImportsUp: bumpImportsUp,
    splitIntoBatches: splitIntoBatches
};