'use strict';

const path = require('path');
const initTest = require('./init-test');
const versionizeContent = require('../lib/versionize-content');
const fs = require('fs-extra');
const workspaceFolder = path.join(__dirname, 'workspace');
const cacheFolder = path.join(workspaceFolder, 'cache');
const outputFolder = path.join(workspaceFolder, 'output');
const sourceFolder = path.join(workspaceFolder, 'source');
const configPath = path.join(workspaceFolder, 'config.json');
const generateWorkflow = require('../gulp/builder/generate-workflow.js');
const {
   isRegularFile, linkPlatform
} = require('./lib');

const clearWorkspace = function() {
   return fs.remove(workspaceFolder);
};
const prepareTest = async function(fixtureFolder) {
   await clearWorkspace();
   await fs.ensureDir(sourceFolder);
   await fs.copy(fixtureFolder, sourceFolder);
};

const runWorkflow = function() {
   return new Promise((resolve, reject) => {
      generateWorkflow([`--config="${configPath}"`])((error) => {
         if (error) {
            reject(error);
         } else {
            resolve();
         }
      });
   });
};

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

      currentFile = {
         contents: 'url(\'fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?#iefix\')'
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal('url(\'fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?x_version=%{BUILDER_VERSION_STUB}#iefix\')');
      currentFile.versioned.should.equal(true);

      currentFile = {
         contents: 'url(\'fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?test123\')'
      };
      result = versionizeContent.versionizeStyles(currentFile);
      result.should.equal('url(\'fonts/TensorFont/1.0.3/TensorFont/TensorFont.eot?x_version=%{BUILDER_VERSION_STUB}#test123\')');
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

   it('should versionize only compiled and minified files', async() => {
      const fixtureFolder = path.join(__dirname, 'fixture/versionize-finish');
      await prepareTest(fixtureFolder);
      await linkPlatform(sourceFolder);
      const config = {
         cache: cacheFolder,
         output: outputFolder,
         wml: true,
         minimize: true,
         version: 'test',
         modules: [
            {
               name: 'Модуль',
               path: path.join(sourceFolder, 'Модуль')
            },
            {
               name: 'WS.Core',
               path: path.join(sourceFolder, 'WS.Core')
            },
            {
               name: 'View',
               path: path.join(sourceFolder, 'View')
            },
            {
               name: 'Vdom',
               path: path.join(sourceFolder, 'Vdom')
            },
            {
               name: 'Router',
               path: path.join(sourceFolder, 'Router')
            },
            {
               name: 'WS.Data',
               path: path.join(sourceFolder, 'WS.Data')
            }
         ]
      };
      await fs.writeJSON(configPath, config);

      // запустим таску
      await runWorkflow();
      (await isRegularFile(outputFolder, 'Modul/Page.wml')).should.equal(true);
      (await isRegularFile(outputFolder, 'Modul/Page.min.wml')).should.equal(true);
      const sourceContent = (await fs.readFile(path.join(outputFolder, 'Modul/Page.wml'))).toString();
      const compiledContent = (await fs.readFile(path.join(outputFolder, 'Modul/Page.min.wml'))).toString();

      // проверим, что в исходниках ссылки остались прежними, а в скомпилированном появилась версия и суффикс min
      const sourceNotChanged = sourceContent.includes('contents.js') &&
         sourceContent.includes('require-min.js') &&
         sourceContent.includes('bundles.js');
      sourceNotChanged.should.equal(true);
      const compiledChanged = compiledContent.includes('contents.min.js?x_version=%{BUILDER_VERSION_STUB}') &&
         compiledContent.includes('bundles.min.js?x_version=%{BUILDER_VERSION_STUB}') &&
         compiledContent.includes('require-min.js') &&
         !compiledContent.includes('require-min.js?x_version=%{BUILDER_VERSION_STUB}');
      compiledChanged.should.equal(true);
   });
});
