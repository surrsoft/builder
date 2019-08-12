/* /InterfaceModule1/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule1/moduleStyle',['css!InterfaceModule1/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule1/amdModule",["css!InterfaceModule1/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule2/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule2/moduleStyle',['css!InterfaceModule2/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule2/amdModule",["css!InterfaceModule2/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});
/* /InterfaceModule3/extend.package.json:superbundle-for-builder-tests.package.js */
(function(){define('css!InterfaceModule3/amdModule',['css!InterfaceModule3/superbundle-for-builder-tests.package'],'');})();
define("InterfaceModule3/amdModule",["css!InterfaceModule3/amdModule"],function(){return{_moduleName:"InterfaceModule1/amdModule"}});