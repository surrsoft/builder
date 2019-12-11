define("TestModule/returnedPromise", ["require", "exports"], function (require, exports) {
    "use strict";
    return new Promise(function (resolve_1, reject_1) {
    require(['module'], resolve_1, reject_1);
}).then(function () {
}).then(function () {
    console.log('дичь');
})
});
