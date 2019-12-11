define("TestModule/withCustomCatch", ["require", "exports"], function (require, exports) {
    "use strict";
    new Promise(function (resolve_1, reject_1) {
    require(['module'], resolve_1, reject_1);
}).then(function () {
}).then(function () {
    console.log('дичь');
}).catch(function (err) {
    console.log('custom catch!!!');
})
});
