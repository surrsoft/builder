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
      const cdnSource = 'src="/cdn/jquery/3.3.1/jquery-min.js">';

      // проверим, чтобы игнорировался cdn
      result = versionizeContent.versionizeTemplates(cdnSource);
      result.should.equal(cdnSource);

      // проверим, чтобы не добавлялся лишний суффикс min
      result = versionizeContent.versionizeTemplates('src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.min.js">');
      result.should.equal(versionedMinLink);

      // проверим, чтобы добавлялся суффикс min, если он отсутствует
      result = versionizeContent.versionizeTemplates('src="{{ _options.resourceRoot }}View/Runner/Vdom/third-party/boomerang-1.568.0.js">');
      result.should.equal(versionedMinLink);
   });
});
