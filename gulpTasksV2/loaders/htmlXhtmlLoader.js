'use strict';

const fs = require('fs');

module.exports = function (module, base) {
    let deps    = ['Core/helpers/random-helpers'];
    let res;
    try {
        res = fs.readFileSync(module.fullPath);
    } catch (err) {
        console.error(err);
    }
    return new Promise((resolve, reject) => {
        if (module.amd && res) {
            return resolve(res);
        } else {
            try {
                let config   = global.$ws.doT.getSettings();
                let template = global.$ws.doT.template(res, config);

                if (module.encode) config.encode = config.interpolate;

                if (!global.$ws.helpers.md5 /*TODO: выпилить после 200*/) {
                    return resolve('define("' + module.fullName + '", function() {var f=' + template.toString().replace(/[\n\r]/g, '') +
                    ';f.toJSON=function(){return  {$serialized$: "func", module: "' + module.fullName + '"}};return f;});');
                } else {
                    return resolve(`define("${module.fullName}", ${JSON.stringify(deps)},function(_randomHelpers) {
                    var f=${template.toString().replace(/[\n\r]/g, '')};f.toJSON=function(){
                    return {$serialized$: "func", module: "${module.fullName}"}};return f;});`);
                    // return ('define("' + module.fullName + '", ' + JSON.stringify(deps) + ', function(_randomHelpers) {var f=' + template.toString().replace(/[\n\r]/g, '') +
                    //     ';f.toJSON=function(){return  {$serialized$: "func", module: "' + module.fullName + '"}};return f;});');
                }
            } catch (err) {
                console.error(err, module.fullName, module.fullPath);
                return resolve('');
            }
        }
    });
};