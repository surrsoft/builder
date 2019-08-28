/* /InterfaceModule1/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule1/moduleStyle',['css!InterfaceModule1/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule1/amdModule",["css!InterfaceModule1/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule2/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule2/moduleStyle',['css!InterfaceModule2/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule2/amdModule",["css!InterfaceModule2/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule3/extend.package.json:superbundle-for-builder-tests.package.js */
define("InterfaceModule3/amdAnotherModule",[],function(){return{_moduleName:"InterfaceModule3/amdAnotherModule"}});
define("InterfaceModule3/amdModule",["css!InterfaceModule3/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
if(typeof window !== "undefined" && window.atob){define('css!InterfaceModule3/amdModule', function() {var style = document.createElement("style"),head = document.head || document.getElementsByTagName("head")[0];style.type = "text/css";style.setAttribute("data-vdomignore", "true");style.appendChild(document.createTextNode(".interfaceModule3_logoDefault{background-image:url(/resources/InterfaceModule3/images/logo-en.svg)}"));head.appendChild(style);});}