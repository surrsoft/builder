'use strict';

const fs                = require('fs');
const path              = require('path');
const resolverControls  = path => 'tmpl!' + path;

module.exports = function (module, base) {
    let deps    = ['Core/tmpl/tmplstr', 'Core/tmpl/config'];
    let result  = ['var templateFunction = '];

    return new Promise((resolve, reject) => {
        global.requirejs(deps.concat(['optional!Core/tmpl/js/tclosure']), function (tmpl, config, tclosure) {
            let conf = {config: config, filename: path.relative(base, module.fullPath)};
            if (tclosure) {
                deps.push('Core/tmpl/js/tclosure');
            }
            let html;
            try {
                html = fs.readFileSync(module.fullPath);
            } catch (err) {
                console.error(err);
                return resolve();
            }

            if (module.amd && html) {
                return resolve(html);
            } else {
                tmpl.getComponents(html).forEach(dep => { deps.push(dep); });

                tmpl.template(html, resolverControls, conf).handle(function (traversed) {
                    try {
                        if (traversed.__newVersion === true) {
                            /** Новая версия рендера, для шаблонизатора. В результате функция в строке. **/
                            result.push(tmpl.func(traversed, conf).toString() + ';');
                        } else {
                            result.push('function loadTemplateData(data, attributes) {');
                            result.push('return tmpl.html(' + JSON.stringify(traversed) + ', data, {config: config, filename: "' + module.fullName + '"}, attributes);};');
                        }
                        result.push('templateFunction.stable = true;');
                        result.push('templateFunction.toJSON = function() {return {$serialized$: "func", module: "' + module.fullName + '"}};');
                        result.push('return templateFunction;');

                        let depsStr = 'var _deps = {};',
                            i = tclosure ? 3 : 2;
                        for (; i < deps.length; i++) {
                            depsStr += '_deps["' + deps[i] + '"] = deps[' + i + '];';
                        }
                        if (tclosure) {
                            return resolve('define("' + module.fullName + '", ' + JSON.stringify(deps) + ', function() { var deps = Array.prototype.slice.call(arguments); var tmpl = deps[0]; var config = deps[1]; var tclosure = deps[2]; ' + depsStr + result.join('') + '});');
                        } else {
                            return resolve('define("' + module.fullName + '", ' + JSON.stringify(deps) + ', function() { var deps = Array.prototype.slice.call(arguments); var tmpl = deps[0]; var config = deps[1]; ' + depsStr + result.join('') + '});');
                        }
                    } catch (err) {
                        console.error(err, module.fullName, module.fullPath);
                        reject(err);
                    }
                }, function (err) {
                    console.error(err, module.fullName, module.fullPath);
                    reject(err);
                });
            }
        });
    });
};
