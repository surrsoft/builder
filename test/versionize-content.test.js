'use strict';

const initTest = require('./init-test');
const versionizeContent = require('../lib/versionize-content');

describe('versionize-content', () => {
   before(async() => {
      await initTest();
   });

   it('versionize style content', () => {
      let result;
      result = versionizeContent.versionizeStyles('background-image:url(/resources/SBIS3.CONTROLS/default-theme/img/ajax-loader-16x16-wheel.gif)');
      result.should.equal('background-image:url(/resources/SBIS3.CONTROLS/default-theme/img/ajax-loader-16x16-wheel.gif?x_version=BUILDER_VERSION_STUB)');

      // woff и woff2 должны правильно зарезолвиться
      result = versionizeContent.versionizeStyles('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff\')');
      result.should.equal('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff?x_version=BUILDER_VERSION_STUB\')');
      result = versionizeContent.versionizeStyles('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff2\')');
      result.should.equal('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff2?x_version=BUILDER_VERSION_STUB\')');

      // Проверим, чтобы игнорировался cdn
      const cdnData = 'src: url(\'/cdn/fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?#iefix\') format(\'embedded-opentype\')';
      result = versionizeContent.versionizeStyles(cdnData);
      result.should.equal(cdnData);
   });

   it('versionize javascript content', () => {
      const result = versionizeContent.versionizeJs('message:rk("Загрузка"),loadingPicture:"/cdn/img/common/1.0.0/ajax-loader-indicator.gif');
      result.should.equal('message:rk("Загрузка"),loadingPicture:"/cdn/img/common/1.0.0/ajax-loader-indicator.gif?x_version=BUILDER_VERSION_STUB');
   });

   it('versionize templates content', () => {
      let result;

      const versionedMinLink = 'src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.min.js?x_version=BUILDER_VERSION_STUB">';
      let cdnSource = 'src="/cdn/jquery/3.3.1/jquery-min.js">';

      // проверим, чтобы игнорировался cdn для js
      result = versionizeContent.versionizeTemplates(cdnSource);
      result.should.equal(cdnSource);

      cdnSource = '<link rel="preload" as="font" href="/cdn/fonts/TensorFont/1.0.3/TensorFontBold/TensorFontBold.woff2" type="font/woff2"/>';

      // проверим, чтобы игнорировался cdn для шрифтов
      result = versionizeContent.versionizeTemplates(cdnSource);
      result.should.equal(cdnSource);

      // проверим, чтобы не добавлялся лишний суффикс min
      result = versionizeContent.versionizeTemplates('src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.min.js">');
      result.should.equal(versionedMinLink);

      // проверим, чтобы добавлялся суффикс min, если он отсутствует
      result = versionizeContent.versionizeTemplates('src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.js">');
      result.should.equal(versionedMinLink);

      // проверим версионирование рядовых шрифтов
      result = versionizeContent.versionizeTemplates('<link href="{{resourceRoot}}Controls-theme/themes/default/fonts/cbuc-icons/cbuc-icons.woff2"/>');
      result.should.equal('<link href="{{resourceRoot}}Controls-theme/themes/default/fonts/cbuc-icons/cbuc-icons.woff2?x_version=BUILDER_VERSION_STUB"/>');

      // проверим что под регулярку не попадают свойства обьектов
      const testSpanFromTemplate = '<span class="edo-TaskCol-date-number-mark-dot icon-16 icon-{{item[\'colorMarkState\'].icon}}"';
      result = versionizeContent.versionizeTemplates(testSpanFromTemplate);
      result.should.equal(testSpanFromTemplate);
   });
});
