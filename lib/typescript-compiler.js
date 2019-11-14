/**
 * Основная библиотека для поиска ошибок typescript-компилятора в текущем проекте(с
 * помощью команды tsc --noEmit). Используется в основной задаче Gulp - build.
 * builder/gulp/builder/generate-workflow.js
 * @author Колбешин Ф.А.
 */

'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger').logger();

async function runCompilerAndCheckForErrors(sourceDirectory) {
   const processOptions = {
      maxBuffer: 1024 * 500,
      cwd: sourceDirectory
   };

   // process.getegid is not available on windows or android, set it only for nix systems
   if (process.getegid) {
      processOptions.gid = process.getegid();
      processOptions.uid = process.geteuid();
   }

   /**
    * Prepare project directory for tsc command execute - copy typescript config
    * files from saby-typescript for proper "tsc" command execute. Get saby-typescript
    * workspace properly:
    * 1)saby-typescript as npm package of builder
    * 2)saby-typescript and builder has the same directory
    */
   let sabyTypescriptDirectory;
   if (await fs.pathExists(path.join(process.cwd(), '../saby-typescript'))) {
      sabyTypescriptDirectory = path.join(process.cwd(), '../saby-typescript');
   } else {
      sabyTypescriptDirectory = path.join(process.cwd(), 'node_modules/saby-typescript');
   }

   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'configs/es5.json'), path.join(sourceDirectory, 'tsconfig.json'));
   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'tslib.js'), path.join(sourceDirectory, 'tslib.js'));
   await fs.ensureSymlink(path.join(sabyTypescriptDirectory, 'tslint/index.json'), path.join(sourceDirectory, 'tslint.json'));

   let result;
   try {
      await exec(`node ${sabyTypescriptDirectory}/cli.js --compiler --noEmit`, processOptions);
      logger.info('tsc command for current project was completed successfully!');
      result = [];
   } catch (error) {
      result = error.stdout.split('\n').filter(currentError => !!currentError);
   }
   await clearWorkspaceFromTsConfig(sourceDirectory);
   return result.map(currentError => currentError.replace(/\r/g, ''));
}

async function clearWorkspaceFromTsConfig(sourceDirectory) {
   await fs.remove(path.join(sourceDirectory, 'tsconfig.json'));
   await fs.remove(path.join(sourceDirectory, 'tslib.js'));
   await fs.remove(path.join(sourceDirectory, 'tslint.json'));
}


const TRUSTED_ERRORS = [
   'Booking/Pages/Wasaby/Employees/BeautyCfg/BeautyCfg.ts(80,6): error TS1068:',
   'CompanyBinder2/_selector/SelectionController.ts(42,73): error TS1005:',
   'Contractor/Main/Heatmap.ts(21,6): error TS1068:',
   'Contractor/Main/Heatmap.ts(25,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(37,2): error TS1128:',
   'Contractor/Main/_category/Browser.ts(63,32): error TS1005:',
   'Contractor/Main/_category/Browser.ts(186,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(194,29): error TS1005:',
   'Contractor/Main/_category/Browser.ts(196,14): error TS1128:',
   'Contractor/Main/_category/Browser.ts(197,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(219,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(232,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(262,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(273,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(285,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(292,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(329,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(341,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(366,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(374,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(388,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(408,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(417,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(427,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(505,6): error TS1068:',
   'Contractor/Main/_category/Browser.ts(520,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(29,32): error TS1005:',
   'Contractor/Main/_category/Edit.ts(74,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(90,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(99,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(108,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(117,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(127,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(134,6): error TS1068:',
   'Contractor/Main/_category/Edit.ts(141,6): error TS1068:',
   'Contractor/Main/_category/OKVED.ts(28,6): error TS1068:',
   'Contractor/Main/_category/OKVEDSelect.ts(26,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(45,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(49,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(53,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(69,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(77,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(95,6): error TS1068:',
   'Contractor/Main/_court/Browser.ts(114,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(83,2): error TS1128:',
   'Contractor/Main/_list/Browser.ts(171,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(175,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(195,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(289,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(297,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(315,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(329,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(338,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(348,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(410,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(453,6): error TS1068:',
   'Contractor/Main/_list/Browser.ts(465,6): error TS1068:',
   'Contractor/Main/_list/HeadSelect.ts(39,6): error TS1068:',
   'Contractor/Main/_list/HeadSelect.ts(45,6): error TS1068:',
   'Contractor/Main/_list/HeadSelect.ts(49,6): error TS1068:',
   'Contractor/Main/_notification/Browser.ts(49,6): error TS1068:',
   'Contractor/Main/_notification/Browser.ts(61,6): error TS1068:',
   'Contractor/Main/_notification/Browser.ts(69,6): error TS1068:',
   'Contractor/Main/_notification/Browser.ts(86,6): error TS1068:',
   'Contractor/Main/_notification/Browser.ts(96,6): error TS1068:',
   'Contractor/Main/_notification/FilterPanel.ts(17,28): error TS1005:',
   'Contractor/Main/_notification/FilterPanel.ts(21,6): error TS1068:',
   'Contractor/Main/_notification/FilterPanel/Settings.ts(23,6): error TS1068:',
   'Contractor/Main/_notification/Tab.ts(16,26): error TS1005:',
   'Contractor/Main/_notification/Tab.ts(29,6): error TS1068:',
   'Contractor/Main/_notification/Tab.ts(39,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(41,32): error TS1005:',
   'Contractor/Main/_okved/Browser.ts(72,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(76,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(89,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(102,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(121,6): error TS1068:',
   'Contractor/Main/_okved/Browser.ts(133,6): error TS1068:',
   'Contractor/Main/_owner/Browser.ts(59,6): error TS1068:',
   'Contractor/Main/_owner/Browser.ts(63,6): error TS1068:',
   'Contractor/Main/_owner/Browser.ts(74,6): error TS1068:',
   'Contractor/Main/_owner/Browser.ts(136,17): error TS1005:',
   'Contractor/Main/_owner/Browser.ts(142,17): error TS1005:',
   'Contractor/Main/_owner/Browser.ts(173,21): error TS1005:',
   'Contractor/Main/_owner/Browser.ts(185,6): error TS1068:',
   'Contractor/Main/_region/Browser.ts(49,6): error TS1068:',
   'Contractor/Main/_region/Browser.ts(53,6): error TS1068:',
   'Contractor/Main/_region/Browser.ts(63,6): error TS1068:',
   'Contractor/Main/_region/Browser.ts(82,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(62,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(66,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(70,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(89,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(99,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(112,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(121,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(137,6): error TS1068:',
   'Contractor/Main/_search/Container.ts(146,6): error TS1068:',
   'Contractor/Main/_search/Suggest.ts(45,6): error TS1068:',
   'Contractor/Main/_search/Suggest.ts(51,6): error TS1068:',
   'Contractor/Main/_search/Suggest.ts(61,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(140,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(149,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(177,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(217,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(236,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(285,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(286,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(290,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(291,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(299,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(300,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(311,46): error TS1005:',
   'Contractor/Main/_stats/Main.ts(316,21): error TS1005:',
   'Contractor/Main/_stats/Main.ts(325,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(333,65): error TS1005:',
   'Contractor/Main/_stats/Main.ts(338,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(343,65): error TS1005:',
   'Contractor/Main/_stats/Main.ts(348,17): error TS1005:',
   'Contractor/Main/_stats/Main.ts(353,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(383,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(396,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(423,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(440,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(454,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(464,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(487,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(505,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(518,6): error TS1068:',
   'Contractor/Main/_stats/Main.ts(533,6): error TS1068:',
   'ContractorCommon/FilterCompany/Panel/Courts.ts(26,6): error TS1068:',
   'Controls/_breadcrumbs/Path.ts(63,5): error TS1005:',
   'Controls/_breadcrumbs/Path.ts(69,5): error TS1005:',
   'Controls/_grid/GridViewModel.ts(707,9): error TS1005:',
   'Controls/_grid/GridViewModel.ts(1264,9): error TS1005:',
   'Controls/_input/Mask/FormatterValue.ts(1,23): error TS1005:',
   'Controls/_input/Mask/FormatterValue.ts(2,27): error TS1005:',
   'Controls/_list/BaseControl.ts(2406,5): error TS1005:',
   'Controls/_list/ItemActions/ItemActionsControl.ts(204,4): error TS1005:',
   'Controls/operations.ts(46,4): error TS1005:',
   'Controls-demo/treeGrid/DemoHelpers/DataCatalog.ts(1244,6): error TS1005:',
   'Controls-demo/treeGrid/VirtualScroll/Default/Index.ts(16,56): error TS1005:',
   'DevicesTrusted/_whoActive/ModelOld.ts(8,16): error TS1005:',
   'DevicesTrusted/_whoActive/ModelOld.ts(66,2): error TS1005:',
   'DevicesTrusted/_whoActive/ModelOld.ts(66,3): error TS1109:',
   'DevicesTrusted/_whoActive/ModelOld.ts(67,1): error TS1109:',
   'Events/MeetingCard/Participants/Model.ts(78,5): error TS1068:',
   'FED2Srv/_core/RunHandler.ts(357,9): error TS1005:',
   'HistoryChanges/_actions/ClientFilter/_filterButtonSource.ts(98,5): error TS1005:',
   'KPICore/noticeConfig.ts(1,26): error TS1005:',
   'KPICore/noticeConfig.ts(2,30): error TS1005:',
   'KPICore/noticeConfig.ts(3,40): error TS1005:',
   'MoneyWS4/views/Index/_debts/interface/IDebts.ts(13,1): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(6,18): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(7,23): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(8,23): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(9,19): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(10,25): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(11,30): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(12,28): error TS1005:',
   'OFD/KKT/Tree/Settings.ts(13,25): error TS1005:',
   'WHD/Controls/_input/PackingSelector/PackingCard.ts(14,44): error TS1005:',
   'WHD/Controls/_nomList/NomScanner.ts(72,5): error TS1005:',
   'WHD/Controls/_nomList/NomScanner.ts(200,55): error TS1005:',
   'WHD/Controls/_serialNumber/Model.ts(442,88): error TS1005:',
   'WorkTimeDocuments/TimeOff/Dialog.ts(36,19): error TS1005:',
   'WorkTimeDocuments/Truancy/Dialog.ts(37,19): error TS1005:'
];

async function typescriptCompiler(taskParameters) {
   const sourceDirectory = path.join(taskParameters.config.cachePath, 'temp-modules');
   const tsErrors = await runCompilerAndCheckForErrors(sourceDirectory);
   if (tsErrors.length > 0) {
      let overallLevel = 'info';
      tsErrors.forEach((currentError) => {
         const moduleInfo = taskParameters.config.modules.find(
            currentModule => currentModule.name === currentError.split('/').shift()
         );
         const level = TRUSTED_ERRORS.some(message => currentError.startsWith(message)) ? 'info' : 'error';
         if (level === 'error') {
            overallLevel = 'error';
         }

         /**
          * log as debug errors in Sbis Plugin because of problem with tsc configuration
          * TODO remove it after task completion
          * https://online.sbis.ru/opendoc.html?guid=77afe3f3-e22e-46ce-8355-6f73c135f2e9
          */
         if (taskParameters.config.isSbisPlugin) {
            logger.debug({
               message: currentError,
               moduleInfo
            });
         } else {
            logger[level]({
               message: currentError,
               moduleInfo
            });
         }
      });
      const tsCompletedMessage = 'tsc command for current project was completed with errors. Check logs';
      if (taskParameters.config.isSbisPlugin) {
         logger.debug(tsCompletedMessage);
      } else {
         logger[overallLevel](tsCompletedMessage);
      }
   }
}

module.exports = {
   runCompilerAndCheckForErrors,
   typescriptCompiler
};
