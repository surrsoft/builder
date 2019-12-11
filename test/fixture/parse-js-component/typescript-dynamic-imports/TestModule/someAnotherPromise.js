define("TestModule/someAnotherPromise", ["require", "exports"], function (require, exports) {
    "use strict";
    new Promise(function (resolve_1, reject_1) {
    console.log('some dich is going on there');
}).then(function () {
}).then(function () {
    console.log('дичь');
})
});
