'use strict';

function getFunChangeTheme(themeNames, packageCss) {
   let fun,
      filesNameCss = '{';

   for (const key in packageCss) {
      filesNameCss += `
            ${key}: '/${packageCss[key][0].name.replace(/\\/g, '/')}',`;
   }
   filesNameCss += '}';
   filesNameCss = filesNameCss.replace(/\,\}/g, '}');

   fun = `
    window.onload = function setTheme() {
                if (localStorage['themePackage']) {
                    var targetCss = document.getElementById('theme'),
                        newNode = document.createElement('link');

                    newNode.setAttribute('rel', 'stylesheet');
                    newNode.setAttribute('href', localStorage['themePackage']);
                    targetCss.parentNode.replaceChild(newNode, targetCss.nextSibling);
                } else {
                    return;
                }
            }

    define('js!SBIS3.CONTROLS.ThemeManager', ['Core/EventBus'], function(EB) {
            var themes = '${themeNames}',
                filesCSS = ${filesNameCss};

            var channel = EB.channel('onThemeChange');
            return {
                changeTheme: function changeTheme(theme) {
                    channel.publish('onChangeTheme');
                    var targetCss = document.getElementById('theme'),
                        newNode = document.createElement('link');
                    newNode.setAttribute('rel', 'stylesheet');

                    if (~themes.indexOf(theme)) {
                        localStorage['theme'] = theme;
                        localStorage['themePackage'] = filesCSS[theme];
                        newNode.setAttribute('href', filesCSS[theme]);
                        targetCss.parentNode.replaceChild(newNode, targetCss.nextSibling);
                    } else {
                        console.log('Theme is not defined');
                    }
                    channel.notify('onChangeTheme', {
                        theme: theme
                    });


                },
                getSubscriber: function getSubscriber() {
                    return channel;
                }
            }});`;

   return fun;
}

module.exports = {
   getFunChangeTheme: getFunChangeTheme
};
