'use strict';

const fs = require('fs');

module.exports = function (module, base) {
    return new Promise((resolve, reject) => {
        let res;
        try {
            res = JSON.stringify(JSON.parse(fs.readFileSync(module.fullPath)));
        } catch (err) {
            //ignore
            console.error(err);
        }

        // return resolve('define("' + module.fullName + '", function() {return ' + res + ';});');
        return resolve(`define("${module.fullName}", function() {return ${res};});`);
    });
};