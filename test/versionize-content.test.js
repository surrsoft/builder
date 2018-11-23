'use strict';

const initTest = require('./init-test');
const versionizeContent = require('../lib/versionize-content');

describe('versionize-content', () => {
   before(async() => {
      await initTest();
   });

   it('versionize style content', () => {
      let result;
      let currentFile = {
         contents: 'background-image:url(/resources/SBIS3.CONTROLS/default-theme/img/ajax-loader-16x16-wheel.gif)'
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal('background-image:url(/resources/SBIS3.CONTROLS/default-theme/img/ajax-loader-16x16-wheel.gif?x_version=%{BUILDER_VERSION_STUB})');

      // проверим, что информация о версионировании прокидывается в файл
      currentFile.versioned.should.equal(true);

      // woff и woff2 должны правильно зарезолвиться
      currentFile = {
         contents: 'url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff\')'
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff?x_version=%{BUILDER_VERSION_STUB}\')');
      currentFile.versioned.should.equal(true);

      currentFile = {
         contents: 'url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff2\')'
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal('url(\'../../default-theme/fonts/cbuc-icons/cbuc-icons.woff2?x_version=%{BUILDER_VERSION_STUB}\')');
      currentFile.versioned.should.equal(true);

      // Проверим, чтобы игнорировался cdn
      const cdnData = 'src: url(\'/cdn/fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?#iefix\') format(\'embedded-opentype\')';
      currentFile = {
         contents: cdnData
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal(cdnData);

      // Проверим, чтобы проигнорированный версионированием файл содержал правильную инфу о версии
      false.should.equal(!!currentFile.versioned);
   });

   it('versionize templates content', () => {
      let result;

      const versionedMinLink = 'src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.min.js?x_version=%{BUILDER_VERSION_STUB}">';
      let cdnSource = 'src="/cdn/jquery/3.3.1/jquery-min.js">';
      let currentFile = {
         contents: cdnSource
      };

      // проверим, чтобы игнорировался cdn для js
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal(cdnSource);

      // проверим, чтобы не было информации о версионировании в объекте-файле
      false.should.equal(!!currentFile.versioned);

      cdnSource = '<link rel="preload" as="font" href="/cdn/fonts/TensorFont/1.0.3/TensorFontBold/TensorFontBold.woff2" type="font/woff2"/>';
      currentFile = {
         contents: cdnSource
      };

      // проверим, чтобы игнорировался cdn для шрифтов
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal(cdnSource);
      false.should.equal(!!currentFile.versioned);

      // проверим, чтобы не добавлялся лишний суффикс min
      currentFile = {
         contents: 'src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.min.js">'
      };
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal(versionedMinLink);

      // в данном случае в объекте-файле должна записаться информация о версионировании
      currentFile.versioned.should.equal(true);

      // проверим, чтобы добавлялся суффикс min, если он отсутствует
      currentFile = {
         contents: 'src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.js">'
      };
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal(versionedMinLink);
      currentFile.versioned.should.equal(true);

      // проверим версионирование рядовых шрифтов
      currentFile = {
         contents: '<link href="{{resourceRoot}}Controls-theme/themes/default/fonts/cbuc-icons/cbuc-icons.woff2"/>'
      };
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal('<link href="{{resourceRoot}}Controls-theme/themes/default/fonts/cbuc-icons/cbuc-icons.woff2?x_version=%{BUILDER_VERSION_STUB}"/>');
      currentFile.versioned.should.equal(true);

      // проверим что под регулярку не попадают свойства обьектов
      const testSpanFromTemplate = '<span class="edo-TaskCol-date-number-mark-dot icon-16 icon-{{item[\'colorMarkState\'].icon}}"';
      currentFile = {
         contents: testSpanFromTemplate
      };
      result = versionizeContent.versionizeTemplates(currentFile);
      result.should.equal(testSpanFromTemplate);
      false.should.equal(!!currentFile.versioned);
   });
});
