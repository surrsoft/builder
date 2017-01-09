const spawn = require('child_process').spawn;
	
// Если вдруг надо modules
//const modulesStr = JSON.stringify(require('./modules.json')).replace('[', '').replace(']', '');


// Аргументы командной строки
let args = new Set([
	'less1by1',
	'--root=/home/local/TENSOR-CORP/ns.kochnev/test/',
    '--application=online/',
    '--theme=online'
]);

const grunt = spawn('grunt',[...args]);
	
grunt.stdout.pipe(process.stdout);

 grunt.stderr.pipe(process.stderr);

 grunt.on('close', (code) => {
   console.log(`child process exited with code ${code}`);
});