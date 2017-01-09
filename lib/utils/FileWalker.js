const fs = require('fs'),
    path = require('path');

function walkByFileExt(dir, ext) {
    return new Promise(function handleFileWalk(resolve, reject) {
        walk(dir, (err, filesList) => resolve(filesList.filter((filename) => path.extname(filename) === ext)));
    });
   
}

function walk(dir, done) {
    let results = [];
    fs.readdir(dir, (err, list) => {
        if (err) {
            return done(err);
        }
        let pending = list.length;
        if (!pending) {
            return done(null, results);
        }
        list.forEach((file) => {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err, res) {
                        results = results.concat(res);
                        if (!--pending) {
                            done(null, results);
                        }
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

module.exports = {
    walkByFileExt: walkByFileExt, // рекурсивно обходит директорию. возвращает промис в который резолвится массив путей до файлов с указанным расширением
    walk: walk // рекурсивно обходит директорию. возвращает в калбек пути до файлов с указанным расширением
}