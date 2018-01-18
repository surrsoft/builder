var path = require('path');
var fs = require('fs');
const ParallelDeferred = global.requirejs('Core/ParallelDeferred');

var extRe = /\.html\.tmpl$/;

function walkFolder(directory, callback) {
    function readFile(fileObj) {
        var file = '';
        var modPath = path.join(fileObj.dir, fileObj.file);

        if (fs.existsSync(modPath)) {
            try {
                file = fs.readFileSync(modPath, 'utf8');
            } catch (e) {
                console.error('Can\'t read ' + modPath);
            }
        }
        return file;
    }

    var walkSync = function (dir, filelist) {
        var files = fs.readdirSync(dir);
        filelist = filelist || [];
        files.forEach(function (file) {
            if (fs.statSync(path.join(dir, file)).isDirectory()) {
                filelist = walkSync(path.join(dir, file), filelist);
            }
            else if (extRe.test(file)) {
                filelist.push({dir: dir, file: file});
                filesCount++;
                fileCount++;
            } else {
                filesCount++;
            }
        });
        return filelist;
    };

    var filesCount = 0,
        fileCount = 0,
        goodFileCount = 0,
        failFileCount = 0,
        files = walkSync(directory),
        data;

    var dMultiResult = new ParallelDeferred();
    files.forEach(function (fileObj) {
        data = readFile(fileObj);
        var def = callback(fileObj.dir, fileObj.file, data).addCallback(function () {
            goodFileCount++;
        }).addErrback(function (e) {
            failFileCount++;
        });
        dMultiResult.push(def);
    });
    dMultiResult.done();

    console.log('\n-------------------\nСреди ' + filesCount + ' файлов найдено ' + fileCount + ' .html.tmpl файлов,\nобработано без ошибок: ' + goodFileCount + ' файлов, обработано с ошибками: ' + failFileCount + ' \n');
    if (goodFileCount + failFileCount !== fileCount) {
        console.log('Во время работы программы произошло непредвиденное: количество обрабатываемых файлов не равно количеству обработанных файлов!');
    }

    return dMultiResult.getResult();
}

module.exports = walkFolder;