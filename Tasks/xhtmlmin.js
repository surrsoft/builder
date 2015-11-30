module.exports = function(grunt) {
    function minifyFile(data) {
        var scriptWord = '<script',
            endScriptWord = '/script>',
            startScr = data.indexOf(scriptWord),
            endScr,
            out = '';
        while(startScr != -1) {
            startScr += scriptWord.length;
            out += min(data.substr(0, startScr));
            data = data.substr(startScr, data.length);
            endScr = data.indexOf(endScriptWord);
            endScr += endScriptWord.length;
            out += data.substr(0, endScr);
            data = data.substr(endScr, data.length);
            startScr = data.indexOf(scriptWord);
        }
        out += (data.substr(0, data.length));
        return out;
    }

    function min(data) {
        data = data.replace(/<!--[\s\S]*?-->/g, '');
        data = data.replace(/\s{2,}/g,' ');
        data = data.replace(/ </g,'<');
        return data;

    }

    grunt.registerMultiTask('xhtmlmin', 'minify xhtml and html', function () {
        grunt.log.ok(grunt.template.today('hh:MM:ss') + ': Запускается задача xhtmlmin.');
        var   files = grunt.file.expand({cwd: process.cwd()}, this.data);
        files.forEach(function(file) {
            var data = grunt.file.read(file, {encoding: 'utf8'});
            data = minifyFile(data);
            grunt.file.write(file, data);
        });
        grunt.log.ok(grunt.template.today('hh:MM:ss')+ ': Задача xhtmlmin выполнена.');
    });
};