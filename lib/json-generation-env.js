var server = require('sbis3-genie-server'),
    wsPath = process.env.WS,
    cloudPath = process.env.CLOUD,
    outputDir = process.env.OUTPUT,
    mkdirp = require('mkdirp'),
    generator = server({i18nGeneration: true}),
    index = generator(wsPath, cloudPath),
    path = require('path'),
    fs = require('fs');

index.onGenerated(function(){
   var storeFunc = function(control){
         if (!control){
            return;
         }
         var name = control.fullname || control.name;
         index.getJSON(name, function(err, json){
            if (!err){
               var jsonDir = path.join(outputDir, path.dirname(name));
               mkdirp(jsonDir, function() {
                  fs.writeFile(path.join(jsonDir, path.basename(name) + '.json'), JSON.stringify(json, null, 3));
               });
            }
            else {
               console.log('JSON MISSING', control);
            }
         });
      },
      i;
   for (i in index.cloudIndex.classes){
      if (index.cloudIndex.classes.hasOwnProperty(i)){
         storeFunc(index.cloudIndex.classes[i])
      }
   }

   for (i in index.wsIndex.classes){
      if (index.wsIndex.classes.hasOwnProperty(i)){
         storeFunc(index.wsIndex.classes[i])
      }
   }
});
