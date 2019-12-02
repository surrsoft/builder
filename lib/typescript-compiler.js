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

const TRUSTED_ERRORS = [
   'Booking/Pages/Wasaby/Employees/BeautyCfg/BeautyCfg.ts(80,6): error TS1068:',
   'Browser/_Event/Server/_class/deliver/IndexedDB.ts',
   'AuthFramework/',
   'BillingExt/',
   'CloudControl/',
   'Browser/_Event/Server/_class/transport/ExclusiveProxy.ts',
   'Browser/_Event/Server/_class/transport/LocalPageTransport.ts',
   'Browser/_Event/Server/_class/transport/TransportChooser.ts',
   'Browser/_Event/Server/native/_IndexedDB/Connector.ts',
   'Browser/_Event/Server/worker/define.worker.ts(32,1): error TS2741:',
   'Browser/_Event/Server/worker/define.worker.ts(36,9): error TS2322:',
   'Browser/_Event/Server/worker/define.worker.ts(60,1): error TS2740:',
   'Browser/_Transport/RPC/fallback.ts',
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
   '../../../../distrib/builder/node_modules/',
   'CommonSMS',
   'DOCVIEW3/',
   'GeoCommon/',
   'PTComponents/',
   'RichEditor/',
   'SiteEditor/',
   'Widget/',
   'Controls/',
   'ControlsUnit/',
   'Controls-demo/',
   'EngineLink/',
   'EngineUser/',
   'Graphs/',
   'Hint/',
   'HistoryChanges/',
   'Layout/',
   'NavigationPanels/',
   'Page/',
   'ParametersWebAPI/',
   'PopupNotifications/',
   'Rights/',
   'SbisFile/',
   'Summation/',
   'WS.Core/',
   'Person/',
   'ServiceUpdateNotifier/',
   'UserActivity/',
   'SchemeEditor-demo/',
   'Browser/',
   'File/',
   'Photo/',
   'SBIS.VC/',
   'UI/',
   'Vdom/',
   'View/',
   'RetailAuth/',
   'SchemeEditor/',
   'DevicesTrusted/_whoActive/ModelOld.ts(8,16): error TS1005:',
   'DevicesTrusted/_whoActive/ModelOld.ts(66,2): error TS1005:',
   'DevicesTrusted/_whoActive/ModelOld.ts(66,3): error TS1109:',
   'DevicesTrusted/_whoActive/ModelOld.ts(67,1): error TS1109:',
   'Engine-demo/MasterDetail/MasterDetail.ts(9,10): error TS1005:',
   'Engine-demo/MasterDetail/MasterDetail.ts(9,15): error TS1005:',
   'Env/_Config/_ConfigMock.ts(55,10): error TS2345:',
   'Env/_Config/_ConfigMock.ts(177,7): error TS2345:',
   'Env/_Config/AbstractConfigOld.ts(88,26): error TS2554:',
   'Env/_Config/ClientsGlobalConfig.ts(9,20): error TS2339:',
   'Env/_Config/ClientsGlobalConfig.ts(10,19): error TS2339:',
   'Env/_Config/UserConfig.ts(9,20): error TS2339:',
   'Env/_Config/UserConfig.ts(10,19): error TS2339:',
   'Events/MeetingCard/Participants/Model.ts(78,5): error TS1068:',
   'FED2Srv/_core/RunHandler.ts(357,9): error TS1005:',
   'File/Attach.ts(181,9): error TS2322:',
   'File/Attach/Abstract.ts',
   'File/Attach/Base.ts',
   'File/Attach/Container/Getter.ts',
   'File/Attach/Container/Source.ts',
   'File/Attach/Container/SourceLazy.ts',
   'File/Attach/Lazy.ts',
   'File/Attach/Option/Getters/DropArea.ts',
   'File/Attach/Option/Getters/FileSystem.ts(25,16): error TS2345:',
   'File/Attach/Uploader.ts',
   'File/ResourceGetter/Base.ts',
   'File/ResourceGetter/DropArea.ts',
   'File/ResourceGetter/FileSystem.ts',
   'File/ResourceGetter/PhotoCam.ts',
   'File/ResourceGetter/PhotoCam/Dialog.ts',
   'File/ResourceGetter/PhotoCam/DialogAbstract.ts',
   'File/ResourceGetter/PhotoCam/DialogPlugin.ts',
   'HistoryChanges/_actions/ClientFilter/_filterButtonSource.ts(98,5): error TS1005:',
   'I18n/_i18n/Loader.ts(61,73): error TS2580:',
   'I18n/_i18n/Loader.ts(81,7): error TS2322:',
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
   'ParametersWebAPI/_Loader.ts(85,22): error TS2558:',
   'ParametersWebAPI/_Loader.ts(96,36): error TS2558:',
   'ParametersWebAPI/_Loader.ts(123,13): error TS2322:',
   'ParametersWebAPI/_RawLoader.ts(62,60): error TS2558:',
   'Permission/_access/Config.ts(27,5): error TS2416:',
   'Permission/_access/Config.ts(53,30): error TS2345:',
   'Permission/_access/Config.ts(65,33): error TS2345:',
   'Permission/_access/CutOptions.ts(18,17): error TS2314:',
   'Permission/_access/CutOptions.ts(33,13): error TS2322:',
   'Permission/_access/CutOptions.ts(41,32): error TS2339:',
   'Permission/_access/CutOptions.ts(69,13): error TS2740:',
   'Permission/_access/Loader.ts(53,27): error TS2345:',
   'Permission/_access/LoadParams/Getter.ts(14,25): error TS6138:',
   'Permission/_access/LoadParams/Model.ts(4,28): error TS2307:',
   'Permission/_access/LoadParams/Model.ts(15,5): error TS2416:',
   'Permission/_access/RawLoader.ts(13,25): error TS6138:',
   'Permission/_access/RawLoader.ts(13,45): error TS6138:',
   'Permission/_access/RawLoader.ts(28,41): error TS2339:',
   'Permission/_access/RawLoader.ts(29,32): error TS2339:',
   'Permission/_access/RawLoader.ts(38,33): error TS2339:',
   'Permission/_access/RawLoader.ts(68,5): error TS2416:',
   'Permission/_access/Request.ts(8,7): error TS2420:',
   'Permission/_access/Request.ts(29,53): error TS2345:',
   'Permission/_access/Request.ts(35,9): error TS2322:',
   'Permission/_access/Request.ts(40,84): error TS2345:',
   'Permission/_access/State.ts(1,10): error TS6133:',
   'Permission/_access/State.ts(4,33): error TS2307:',
   'Router/_private/Controller.ts',
   'Router/_private/Data.ts',
   'Router/_private/List.ts(195,13): error TS6133:',
   'Router/_private/List.ts(206,18): error TS2339:',
   'Router/_private/MaskResolver.ts',
   'Router/_private/Popup.ts',
   'Router/_private/Reference.ts',
   'Router/_private/Route.ts',
   'Router/_private/StoreManager.ts(32,20): error TS2352:',
   'Router/_private/StoreManager.ts(51,29): error TS2352:',
   'Router/_private/UrlRewriter.ts(12,11): error TS2304:',
   'Router/_private/UrlRewriter.ts(28,48): error TS2304:',
   'Router/_private/UrlRewriter.ts(149,38): error TS2304:',
   'Router/_private/UrlRewriter.ts(192,27): error TS2304:',
   'SbisEnvUI/_Maintains/Parking/_handlers/accessDenied.ts(16,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/accessDenied.ts(27,5): error TS2322:',
   'SbisEnvUI/_Maintains/Parking/_handlers/accessDenied.ts(28,66): error TS2339:',
   'SbisEnvUI/_Maintains/Parking/_handlers/connection.ts(16,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/connection.ts(27,5): error TS2322:',
   'SbisEnvUI/_Maintains/Parking/_handlers/internal.ts(21,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/internal.ts(40,5): error TS2322:',
   'SbisEnvUI/_Maintains/Parking/_handlers/maintenance.ts(9,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/maintenance.ts(27,5): error TS2322:',
   'SbisEnvUI/_Maintains/Parking/_handlers/maintenance.ts(30,45): error TS2339:',
   'SbisEnvUI/_Maintains/Parking/_handlers/maintenance.ts(31,45): error TS2339:',
   'SbisEnvUI/_Maintains/Parking/_handlers/maintenance.ts(32,45): error TS2339:',
   'SbisEnvUI/_Maintains/Parking/_handlers/notFound.ts(16,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/notFound.ts(27,5): error TS2322:',
   'SbisEnvUI/_Maintains/Parking/_handlers/notFound.ts(28,66): error TS2339:',
   'SbisEnvUI/_Maintains/Parking/_handlers/rpc.ts(15,57): error TS2344:',
   'SbisEnvUI/_Maintains/Parking/_handlers/rpc.ts(26,5): error TS2322:',
   'Types/_formatter/jsonReviver.ts(20,26): error TS2580:',
   'Types/_source/HierarchicalMemory.ts(159,9): error TS2580:',
   'Types/_source/LazyMixin.ts(29,64): error TS2580:',
   'Types/_source/LazyMixin.ts(40,13): error TS2580:',
   'Types/_source/Remote.ts(88,32): error TS2580:',
   'Types/_source/Remote.ts(95,39): error TS2580:',
   'Types/_util/deprecateExtend.ts(23,10): error TS2580:',
   'Types/_util/deprecateExtend.ts(28,24): error TS2580:',
   'UI/_base/Control.ts',
   'UI/_base/Creator.ts(75,33): error TS2445:',
   'UI/_base/DepsCollector.ts(249,11): error TS6196:',
   'UI/_base/Document.ts',
   'UI/_base/HeadData.ts',
   'UI/_base/HTML.ts',
   'UI/_base/HTML/Head.ts',
   'UI/_base/HTML/JsLinks.ts',
   'UI/_base/HTML/StartApplicationScript.ts(11,4): error TS2416:',
   'UI/_base/HTML/StartApplicationScript.ts(26,47): error TS2339:',
   'UI/_base/HTML/Wait.ts(23,33): error TS2339:',
   'UI/_base/HTML/Wait.ts(26,4): error TS2416:',
   'UI/_base/HTML/Wait.ts(45,35): error TS2339:',
   'UI/_base/Start.ts',
   'UI/_focus/_ResetScrolling.ts(65,22): error TS2525:',
   'UI/_focus/BoundaryElements.ts(79,33): error TS2551:',
   'UI/_focus/ElementFinder.ts(233,7): error TS6133:',
   'UI/_focus/Focus.ts',
   'UI/_focus/PreventFocus.ts(10,10): error TS2740:',
   'UI/_focus/PreventFocus.ts(16,19): error TS2345:',
   'UI/_hotKeys/Dispatcher.ts(13,33): error TS2339:',
   'UI/_hotKeys/Dispatcher.ts(31,17): error TS2339:',
   'UI/_hotKeys/Dispatcher.ts(57,28): error TS2339:',
   'UI/_hotKeys/Dispatcher.ts(57,76): error TS2339:',
   'UI/_hotKeys/KeyHook.ts',
   'UI/_hotKeys/KeyStop.ts(23,12): error TS6133:',
   'UI/_hotKeys/KeyStop.ts(27,16): error TS2341:',
   'Vdom/_private/Synchronizer/resources/DirtyChecking.ts',
   'Vdom/_private/Synchronizer/resources/DOMEnvironment.ts(58,4): error TS6133:',
   'Vdom/_private/Synchronizer/resources/DOMEnvironment.ts(396,16): error TS6133:',
   'Vdom/_private/Synchronizer/resources/DOMEnvironment.ts(396,24): error TS2351:',
   'Vdom/_private/Synchronizer/resources/DOMEnvironment.ts(401,8): error TS2304:',
   'Vdom/_private/Synchronizer/resources/DOMEnvironment.ts(402,38): error TS2304:',
   'Vdom/_private/Synchronizer/resources/Hooks.ts',
   'Vdom/_private/Synchronizer/resources/OptionsGetter.ts(19,9): error TS6133:',
   'Vdom/_private/Synchronizer/resources/VdomMarkup.ts(82,10): error TS6133:',
   'Vdom/_private/Synchronizer/Synchronizer.ts(129,4): error TS6133:',
   'Vdom/_private/Synchronizer/Synchronizer.ts(152,91): error TS2554:',
   'Vdom/_private/Synchronizer/Synchronizer.ts(309,20): error TS2554:',
   'Vdom/_private/Synchronizer/Synchronizer.ts(520,10): error TS6133:',
   'Vdom/_private/Utils/ResetScrolling.ts(65,22): error TS2525:',
   'Vdom/DevtoolsHook.ts',
   'View/Executor/_Expressions/Rights.ts(49,35): error TS2580:',
   'View/Executor/_Expressions/Rights.ts(189,26): error TS2580:',
   'View/Executor/_Markup/Vdom/Generator.ts(25,1): error TS6199:',
   'View/Executor/_Markup/Vdom/Generator.ts(189,7): error TS6133:',
   'View/Executor/_Utils/Common.ts(23,4): error TS6133:',
   'View/Executor/_Utils/Common.ts(150,20): error TS6133:',
   'View/Executor/_Utils/Common.ts(304,4): error TS6199:',
   'View/Executor/_Utils/Common.ts(316,8): error TS6133:',
   'View/Executor/_Utils/Compatible.ts(92,39): error TS2580:',
   'View/Executor/_Utils/ConfigResolver.ts(79,8): error TS6133:',
   'View/Executor/_Utils/Vdom.ts(19,4): error TS6133:',
   'View/Executor/GeneratorCompatible.ts(226,11): error TS6133:',
   'View/Executor/GeneratorCompatible.ts(260,11): error TS6133:',
   'View/Executor/TClosure.ts(88,4): error TS6133:',
   'WHD/Controls/_input/PackingSelector/PackingCard.ts(14,44): error TS1005:',
   'WHD/Controls/_nomList/NomScanner.ts(72,5): error TS1005:',
   'WHD/Controls/_nomList/NomScanner.ts(200,55): error TS1005:',
   'WHD/Controls/_serialNumber/Model.ts(442,88): error TS1005:',
   'WorkTimeDocuments/TimeOff/Dialog.ts(36,19): error TS1005:',
   'WorkTimeDocuments/Truancy/Dialog.ts(37,19): error TS1005:',
   'WS.Core/_declarations.ts(2,15): error TS2304:',
   'WS.Core/core/Deferred.ts(52,42): error TS2709:',
   'WS.Core/core/helpers/Function/memoize.ts(12,11):',
   'WS.Core/core/helpers/Object/isEmpty.ts(10,18):',
   'WS.Core/core/i18n.ts(180,35): error TS2339:',
   'WS.Core/core/i18n.ts(180,76): error TS2339:',
   'WS.Core/core/i18n.ts(180,96): error TS2339:',
   'WS.Core/core/i18n.ts(181,23): error TS2307:',
   'WS.Core/core/library.ts(28,39): error TS2580:',
   'WS.Core/core/LinkResolver/LinkResolver.ts(17,10): error TS6133:',
   'WS.Core/core/pathResolver.ts(5,7): error TS6133:',
   'WS.Core/core/pathResolver.ts(55,16): error TS2580:',
   'WS.Core/core/pathResolver.ts(80,13): error TS6133:',
   'WS.Core/ext/requirejs/extras/dynamic-config.ts(31,39): error TS2352:',
   'WS.Core/ext/requirejs/extras/dynamic-config.ts(31,79): error TS2352:',
   'WS.Core/ext/requirejs/extras/dynamic-config.ts(32,26): error TS2352:',
   'WS.Core/lib/Control/LayerCompatible/RightsCompatible.ts(3,10): error TS2305:'
];

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

   /**
    * symlink also node_modules from builder to current project.
    * tsconfig requires types definition module(node_modules/@types) to be defined in current project node_modules.
    */
   await fs.ensureSymlink(path.join(process.cwd(), 'node_modules'), path.join(sourceDirectory, 'node_modules'));

   let result;
   try {
      await exec(`node ${sabyTypescriptDirectory}/cli.js --compiler --noEmit`, processOptions);
      logger.info('TypeScript compilation was completed successfully!');
      result = [];
   } catch (error) {
      result = error.stdout.split('\n').filter(currentError => !!currentError && !String(currentError).startsWith('  '));
   }
   await clearWorkspaceFromTsConfig(sourceDirectory);
   return result.map(currentError => currentError.replace(/\r/g, ''));
}

async function clearWorkspaceFromTsConfig(sourceDirectory) {
   await fs.remove(path.join(sourceDirectory, 'tsconfig.json'));
   await fs.remove(path.join(sourceDirectory, 'tslib.js'));
   await fs.remove(path.join(sourceDirectory, 'tslint.json'));
   await fs.remove(path.join(sourceDirectory, 'node_modules'));
}

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
      const tsCompletedMessage = 'TypeScript compilation was completed with errors. Check logs for details.';
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
