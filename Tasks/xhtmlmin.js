module.exports = function(grunt) {
    function minifyFile(data) {
       var scriptWord = '<script',
          endScriptWord = '/script>',
          startScr = data.indexOf(scriptWord),
          endScr,
          out = '',
          allowSlahes = [];
          while(startScr != -1) {
             out += min(data.substr(0, startScr));
             data = data.substr(startScr, data.length);
             endScr = data.indexOf(endScriptWord);
             allowSlahes = saveSlahes(data.substr(0, endScr));
             out += miniScript(data.substr(0, endScr), allowSlahes);
             data = data.substr(endScr, data.length);
             startScr = data.indexOf(scriptWord);
          }
          out += min(data.substr(0, data.length));
          return out;
    }

    function saveSlahes(data) {
       //Пройдет по скрипту и сохранит все вхождения двойных слешей, заключенных в кавычки
       var correctDoubleSlashes = /".*(\/{2}.*?".*?[\r\n])/g,
          correctSlashes = /'.*(\/{2}.*?'.*?[\r\n])/g,
          savedSlahes = [];
       data.replace(correctDoubleSlashes, function(str, p1) {
          savedSlahes.push(p1);
          return str;
       });
       data.replace(correctSlashes, function(str, p1) {
          savedSlahes.push(p1);
          return str;
       });
       return savedSlahes;
    }

    function miniScript(data, slahes) {
        /* Найдет все вхождения двойных слешей и сравнит с сохраненным массивом
        * Если найденное вхождение совпадет с одним из сохраненных, то пропустим его.
        * Остальные вхождения примем за комментарий и удалим. Так же удалим многострочные комментарии и переводы строк*/
       var possibleComments = /\/\/.*[\r\n]*/g,
          mnComments = /\s?\/\*[\s\S]*?\*+\/+?\s?/g,
          compressSymbols = / {|{ | }|} | =|= | ;|; |, | ,| \)|\) |\( | \(/g;
       data = data.replace(possibleComments, function(str) {
          var isNotComment;
          slahes.forEach(function(item) {
             if(str.indexOf(item) != -1) {
                isNotComment = true;
             }
          });
          if(isNotComment) {
             return str;
          } else {
             return '';
          }
       });
       data = data.replace(mnComments, '');
       data = data.replace(/\s{2,}/g,' ');
       data = data.replace(compressSymbols, function(str) {
          str = str.replace(/ /, '');
          return str;
       });
       return data;
    }

    function min(data) {
       data = data.replace(/<!--[\s\S]*?-->/g, function(str) {
          var specComment = /WS-EXPERT|\[if|\[\s*if/;
          if(specComment.test(str)) {
             return str;
          } else {
             return ''
          }
       });
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