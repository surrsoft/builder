function prepareMessage(timestamp, argsObj) {
    var args = [];

    for (var i = 0; i < argsObj.length; i++) {
        args[i] = argsObj[i];
    }

    if (args.length) {
        args[0] = timestamp + args[0];
    }

    return args;

}

module.exports = {
    enable: function (grunt) {
        grunt.log.ok = function () {
            var prefixMode = '[INFO]: ';
            console.log.apply(console, prepareMessage(prefixMode, arguments));
        };
        grunt.log.debug = function () {
            if (!grunt.option('debug')) return;
            var prefixMode = '[DEBUG]: ';
            console.log.apply(console, prepareMessage(prefixMode, arguments));
        };
        grunt.log.warn = function () {
            var prefixMode = '[WARNING]: ';
            console.log.apply(console, prepareMessage(prefixMode, arguments));
        };
        grunt.log.error = function () {
            var prefixMode = '[WARNING]: ';
            console.log.apply(console, prepareMessage(prefixMode, arguments));
        };
    }
};