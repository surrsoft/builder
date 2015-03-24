// Скопируем все файлы из assets в нужные папки vendor
var fs = require('fs'),
    path = require('path'),
    curDir = path.join(__dirname, '../assets/'),
    imageminDir = path.join(__dirname, '..', 'node_modules/grunt-contrib-imagemin/node_modules/imagemin/node_modules/'),
    files = {
       'gifsicle.exe'  : 'imagemin-gifsicle/node_modules/gifsicle/vendor/',
       'jpegtran.exe'  : 'imagemin-jpegtran/node_modules/jpegtran-bin/vendor/',
       'libjpeg-62.dll': 'imagemin-jpegtran/node_modules/jpegtran-bin/vendor/',
       'optipng.exe'   : 'imagemin-optipng/node_modules/optipng-bin/vendor/',
       'pngquant.exe'  : 'imagemin-pngquant/node_modules/pngquant-bin/vendor/'
    },
    dir, file;

Object.keys(files).forEach(function(key) {
   dir = path.join(imageminDir, files[key]);
   file = path.join(dir, key);
   console.log(dir);
   console.log(file);
   if (!fs.existsSync(file)) {
      copyFile(path.join(curDir, key), file, function(err) {
         if (err) {
            console.log(err);
         }
      });
   }
});

function copyFile(source, target, cb) {
   var cbCalled = false;

   var rd = fs.createReadStream(source);
   rd.on("error", function(err) {
      done(err);
   });
   var wr = fs.createWriteStream(target);
   wr.on("error", function(err) {
      done(err);
   });
   wr.on("close", function() {
      done();
   });
   rd.pipe(wr);

   function done(err) {
      if (!cbCalled) {
         cb(err);
         cbCalled = true;
      }
   }
}