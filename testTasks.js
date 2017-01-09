const spawn = require('child_process').spawn;
	
// Если вдруг надо modules
const modulesStr = JSON.stringify(require('./modules.json')).replace('[', '').replace(']', '');


// Аргументы командной строки
let args = new Set([
	'--root=/home/local/TENSOR-CORP/ns.kochnev/test/',
    '--application=online/',
    '--theme=online',`--modules=${modulesStr}`
]);

const grunt = spawn('grunt',[...args]);
	
grunt.stdout.on('data', (data) => {
   console.log(`stdout: ${data}`);
 });

 grunt.stderr.on('data', (data) => {
   console.error(`${data}`);
 });

 grunt.on('close', (code) => {
   console.log(`child process exited with code ${code}`);
});