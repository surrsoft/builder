(function(){var availableDict={},langMatch=String(typeof document==='undefined'?'':document.cookie).match(/lang=([A-z-]+)/),langName=langMatch?langMatch[1]:'ru-RU',langModule='Module/lang/'+langName+'/'+langName+'.json';if(langName in availableDict){define('Module_localization',['Core/i18n',langModule],function(i18n,data){if(data){i18n.setDict(data,langModule,langName);}});}else{define('Module_localization',function(){});}}());