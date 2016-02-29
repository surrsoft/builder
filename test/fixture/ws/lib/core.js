/**
 * WI.SBIS 3.0.15
 */
/* jshint ignore:start */
var toS = Object.prototype.toString;

if(typeof(window) == 'undefined') {
   window = undefined;
}
if(typeof(document) == 'undefined') {
   document = undefined;
}
if(typeof(navigator) == 'undefined') {
   navigator = undefined;
}

var isPlainArray = (function () {
   var arrayTag = '[object Array]';
   return function (arr) {
      return !!(arr && typeof(arr) === 'object' && toS.call(arr) === arrayTag &&
      Object.getPrototypeOf(arr) === Array.prototype);
   };
})();

var nop = function(dummy){}, retTrue = function() { return true }, skip = function(p){ return p; };
/**
 * Если инструмент для сбора статистики отсутствует, заменяем его на пустышку
 */
if (typeof(window) == 'undefined' || window.BOOMR === undefined){
   var
      dummyBlock= {closeSyncBlock: nop, openSyncBlock: nop, close: nop, stop: nop},
      dummySpan = { stop: nop };
   BOOMR = {
      page_ready : nop,
      plugins : {
         WS : {
            prepareEnvironment: nop,
            startSpan : function(dummy) { return dummySpan; },
            reportError : nop,
            reportMessage : nop,
            reportEvent: nop,
            logUserActivity: nop,
            startBlock: function(n){ return dummyBlock; }
         }
      },
      version : false
   };
}
/* jshint ignore:end *//* jshint ignore:end */
/*
 * Инициализация объекта для компонентов ядра
 */
(function(){
   var global = (function(){ return this || (0,eval)('this'); }());
   global.SBIS3 = {};
   global.SBIS3.CORE = {};
}());


$ws = (function(){
   var cssTransformProperty = document && (function() {
      var element = document.createElement('div');
      return element.style.transform !== undefined && 'transform' ||        //new browsers
         element.style.msTransform !== undefined && 'msTransform' ||        //ie
         element.style.oTransform !== undefined && 'oTransform' ||          //Opera
         element.style.MozTransform !== undefined && 'MozTransform' ||      //Firefox
         element.style.webkitTransform !== undefined && 'webkitTransform';  //Chrome
   })();

   function IEVersion() {
      var ua = (navigator && navigator.userAgent.toString().toLowerCase()) || '',
          match = /(msie)\s+([\w.]+)/.exec(ua) ||
                  /(trident)(?:.*rv:([\w.]+))?/.exec(ua) ||
                  /(edge)\/([\w]+)/.exec(ua),
          rv = match && parseInt(match[2], 10);

      return rv;
   }

   function IOSVersion() {
      var match = navigator && navigator.userAgent.match(/\bCPU\s+(i?)OS\s+(\d+)/);
      return match && parseInt(match[2], 10);
   }

   var now = +new Date(), timeShift2014 = +new Date(2014, 9, 26),
       userAgent = (navigator && navigator.userAgent) || '',
       isIOSMobilePlatform = !!(/(iPod|iPhone|iPad)/.test(userAgent)),
       /**
        * На таблетках нет Mobile в UA
        * @link https://developer.chrome.com/multidevice/user-agent
        */
       isAndroidMobilePlatform = !!(/Android/.test(userAgent) && /AppleWebKit/.test(userAgent)),
       isMacOSPlatform = !!(/\bMac\s+OS\s+X\b/.test(userAgent)),
       isChromeIOS = !!(isIOSMobilePlatform && userAgent.match(/\bCriOS\b/)),
       isChromeDesktop = !!(window && window['chrome']) || isChromeIOS,
       isMobilePlatform = isIOSMobilePlatform || isAndroidMobilePlatform,
       ieVersion = IEVersion();

   return {
      /**
       * Неймспейс для всех констант
       * @namespace
       */
      _const: {
         JSONRPC_PROOTOCOL_VERSION: 4,
         fasttemplate: true,
         nostyle: false,
         moscowTimeOffset: now >= timeShift2014 ? 3*60 : 4*60, // UTC+04:00 ... 26/10/2014 UTC+03:00
         javaStartTimeout: 15000,
         styleLoadTimeout: 4000, // Поднял до 4 секунд, так как на медленном соединении не успевало отработать
         IDENTITY_SPLITTER: ',',
         userConfigSupport: false,
         globalConfigSupport: true,
         theme: '',
         appRoot: '/',
         resourceRoot: '/resources/',
         wsRoot: '/ws/',
         defaultServiceUrl: '/service/sbis-rpc-service300.dll',
         debug: window && window.location.hash.indexOf('dbg') > 0,
         saveLastState: true,
         checkSessionCookie: true,
         i18n:false,

         /***
          * Флаг показывает, что код исполняется на клиентской стороне, на браузере
          */
         isBrowserPlatform: typeof window !== 'undefined',

         /***
          * Флаг показывает, что код исполняется на серверной стороне, на nodejs
          */
         isNodePlatform: typeof process !== 'undefined',

         /**
          * Константы с поддержкой тех или иных фич
          * @namespace
          */
         compatibility: {
            dateBug: (new Date(2014, 0, 1, 0, 0, 0, 0).getHours() !== 0),
            /**
             * Поддержка placeholder'а на элементах input
             */
            placeholder: document && !!('placeholder' in document.createElement('input')),
            /**
             * Поддержка загрузки файлов с использованием стандартного инпута (её может не быть, если, к примеру, у пользователя iPad)
             */
            fileupload: document && (function() { var i = document.createElement('input'); i.setAttribute('type', 'file'); return !i.disabled }()),
            /**
             * У старых версий оперы немного другая обработка клавиатурных нажатий. В ней эта константа будет равна false
             */
            correctKeyEvents: window && (!window.opera || parseFloat(window.opera.version()) >= 12.1),
            /**
             * Поддержка css3-анимаций
             */
            cssAnimations: document && (function(){
               var style = document.createElement('div').style;
               return style.transition !== undefined ||  //Opera, IE 10+, Firefox 16+, Chrome 26+, Safari ?
                  style.mozTransition !== undefined ||   //Firefox 4-15 (?)
                  style.webkitTransition !== undefined;  //Chrome ?-25, Safari ? - ?
            })(),
            /**
             * Поддержка <b>requestFullscreen</b> и подобных на элементе (позволяет показывать в полноэкранном режиме только некоторые элементы)
             */
            fullScreen: document && (function(){
               var element = document.createElement('div');
               return element.requestFullscreen !== undefined ||  //Opera
                  element.mozRequestFullScreen !== undefined ||   //Firefox
                  element.webkitRequestFullscreen !== undefined;  //Chrome
            })(),
            /**
             * Поддержка события прокрутки колеса мыши. Есть 3 основных варианта:
             * 1) 'wheel'. DOM3 событие, поддержка есть пока только в ие 9+ и файерфоксе (17+)
             * 2) 'mousewheel'. Старое, популярное событие. Имеет большие проблемы из-за разных значений в различных браузерах и даже ос. Аналог в файерфоксе - MozMousePixelScroll или DOMMouseWheel.
             * 3) 'DOMMouseWheel'. Для файерфокса версии 0.9.7+
             */
            wheel: document && (function(){
               var element = document.createElement('div');
               return (element.onwheel !== undefined || document.documentMode >= 9) ? 'wheel' : // Firefox 17+, IE 9+
                  element.onmousewheel !== undefined ? 'mousewheel' : // Chrome, Opera, IE 8-
                     'DOMMouseScroll'; // older Firefox
            })(),
            cssTransformProperty: cssTransformProperty,
            /**
             * Поддержка css-трансформаций. Появились в Chrome (изначально), Firefox (3.5), Internet Explorer (9), Opera (10.5), Safari (3.1)
             */
            cssTransform: !!cssTransformProperty,
            /**
             * Есть ли поддержка прикосновений (touch) у браузера
             */
            touch: document && (navigator.msMaxTouchPoints || 'ontouchstart' in document.documentElement),
            /**
             * Определение поддержки стандартной работы со стилями
             */
            standartStylesheetProperty: document && (function(){
               var style = document.createElement('style');
               style.setAttribute('type', 'text/css');
               return !style.styleSheet;
            })()
         },
         /**
          * Константы, которые можно использовать для проверки браузера
          * @namespace
          */
         browser: {
            /**
             * Мобильный сафари - iPhone, iPod, iPad
             */
            isMobileSafari: isIOSMobilePlatform && !isChromeIOS &&
                            /AppleWebKit/.test(userAgent) && /Mobile\//.test(userAgent),
            /**
             * Мобильные версии браузеров на андроиде
             */
            isMobileAndroid: isAndroidMobilePlatform,

            /**
             * Мобильные версии браузеров на IOS
             */
            isMobileIOS: isIOSMobilePlatform,

            /**
             * Мобильные версии браузеров
             */
            isMobilePlatform: isMobilePlatform,

            /**
             * internet explorer
             */
            isIE: !!ieVersion,
            /**
             * internet explorer 7
             */
            isIE7: ieVersion === 7,

            /**
             * internet explorer 8
             */
            isIE8: ieVersion === 8,

            /**
             * internet explorer 9
             */
            isIE9: ieVersion === 9,

            /**
             * internet explorer 10
             */
            isIE10: ieVersion === 10,

            /**
             * internet explorer 11
             */
            isIE11: ieVersion === 11,

            /**
             * internet explorer 12 (EDGE)
             */
            isIE12: ieVersion === 12,

            IEVersion: IEVersion(),

            IOSVersion: IOSVersion(),

            /**
             * internet explorer 9+
             */
            isModernIE: ieVersion > 8,

            /**
             * Firefox
             */
            firefox: userAgent.indexOf('Firefox') > -1,

            /**
             * Chrome
             */
            chrome: isChromeDesktop || isChromeIOS,

            /**
             * Mac OS
             */
            isMacOSDesktop: isMacOSPlatform && !isIOSMobilePlatform,

            /**
             * Mac OS
             */
            isMacOSMobile: isMacOSPlatform && isIOSMobilePlatform,

            opera: /(opera)/i.test(userAgent),

            operaChrome: /OPR/.test(userAgent),

            webkit: /(webkit)/i.test(userAgent)
         },
         buildnumber:"", // jshint ignore:line
         resizeDelay: 40,
         /**
          * Пакеты XML-файлов
          * Формат:
          *    ИмяШаблона: ФайлПакета, ...
          */
         xmlPackages: {},
         /**
          * Пакеты JS-файлов
          * Формат:
          *    ОригинальноеИмяФайла: ИмяФайлаПакета, ...
          */
         jsPackages:{},
         /**
          * Оглавление. Сопоставление коротких имен полным путям
          * Формат:
          *    ИмяШаблона: ФайлШаблона, ...
          */
         xmlContents: {},
         /**
          * Альтернативные имена входного файла
          */
         htmlNames : {},
         /**
          * Декларативная привязка обработчиков на ресурс
          * Формат:
          *    ИмяШаблона: [ ФайлОбработчиков, ФайлОбработчиков, ... ], ...
          */
         hdlBindings: {},
         /**
          * Хосты, с которых запрашиваются файлы
          * Формат:
          *    Хост1, Хост2, Хост3, ...
          */
         hosts : [],
         services: {},
         modules: {},
         jsCoreModules: {
            'SBIS3.CORE.AttributeCfgParser'    : 'lib/Control/AttributeCfgParser/AttributeCfgParser.module.js',
            'SBIS3.CORE.bignumWrapper'         : 'ext/bignumWrapper.js',
            'SBIS3.CORE.Marker'                : 'lib/Marker/Marker.module.js',
            'SBIS3.CORE.NavigationController'  : 'lib/NavigationController/NavigationController.module.js',
            'SBIS3.CORE.Control'               : 'lib/Control/Control.module.js',
            'SBIS3.CORE.SelectMergeRecordDialog': 'res/wsmodules/SelectMergeRecordDialog/SelectMergeRecordDialog.module.js',
            'SBIS3.CORE.ConfirmRecordActionsDialog': 'res/wsmodules/ConfirmRecordActionsDialog/ConfirmRecordActionsDialog.module.js',
            'SBIS3.CORE.ReplaceRecordDialog': 'res/wsmodules/ReplaceRecordDialog/ReplaceRecordDialog.module.js',
            'SBIS3.CORE.SuggestShowAllDialog': 'res/wsmodules/SuggestShowAllDialog/SuggestShowAllDialog.module.js',
            'SBIS3.CORE.SumDialog': 'res/wsmodules/SumDialog/SumDialog.module.js',
            'SBIS3.CORE.ErrorsReportDialog': 'res/wsmodules/ErrorsReportDialog/ErrorsReportDialog.module.js',
            'SBIS3.CORE.ValidateCountDialog': 'res/wsmodules/ValidateCountDialog/ValidateCountDialog.module.js',
            'SBIS3.CORE.ColorizeDialog': 'res/wsmodules/ColorizeDialog/ColorizeDialog.module.js',
            'SBIS3.CORE.SelectColumnsDialog': 'res/wsmodules/SelectColumnsDialog/SelectColumnsDialog.module.js',
            'SBIS3.CORE.FileButton': 'lib/Control/FileButton/FileButton.module.js',
            'SBIS3.CORE.FileBrowse': 'lib/Control/FileBrowse/FileBrowse.module.js',
            'SBIS3.CORE.FileScaner': 'lib/Control/FileScaner/FileScaner.module.js',
            'SBIS3.CORE.FileScanLoader': 'lib/Control/FileScanLoader/FileScanLoader.module.js',
            'SBIS3.CORE.PrintDialog': 'lib/Control/PrintDialog/PrintDialog.module.js',
            "SBIS3.CORE.SelectScannerDialog": "lib/Control/FileScanLoader/resources/SelectScannerDialog/SelectScannerDialog.module.js",
            'SBIS3.CORE.FileLoader': 'lib/Control/FileLoader/FileLoader.module.js',
            'SBIS3.CORE.FileStorageLoader': 'lib/Control/FileStorageLoader/FileStorageLoader.module.js',
            'SBIS3.CORE.FileLoaderAbstract': 'lib/Control/FileLoaderAbstract/FileLoaderAbstract.module.js',
            'SBIS3.CORE.FileCam': 'lib/Control/FileCam/FileCam.module.js',
            'SBIS3.CORE.FileCamLoader': 'lib/Control/FileCamLoader/FileCamLoader.module.js',
            'SBIS3.CORE.CameraWindow': 'lib/Control/FileCamLoader/resources/CameraWindow/CameraWindow.module.js',
            'SBIS3.CORE.FileClipboard': 'lib/Control/FileClipboard/FileClipboard.module.js',
            'SBIS3.CORE.FileClipboardLoader': 'lib/Control/FileClipboardLoader/FileClipboardLoader.module.js',
            'SBIS3.CORE.Button': 'lib/Control/Button/Button.module.js',
            'SBIS3.CORE.Infobox': 'lib/Control/Infobox/Infobox.module.js',
            'SBIS3.CORE.InfoboxTrigger': 'lib/Control/InfoboxTrigger/InfoboxTrigger.module.js',
            'SBIS3.CORE.LoadingIndicator': 'lib/Control/LoadingIndicator/LoadingIndicator.module.js',
            'SBIS3.CORE.Paging': 'lib/Control/Paging/Paging.module.js',
            'SBIS3.CORE.PathSelector': 'lib/Control/PathSelector/PathSelector.module.js',
            'SBIS3.CORE.PathFilter': 'lib/Control/PathFilter/PathFilter.module.js',
            'SBIS3.CORE.HierarchyView': 'lib/Control/HierarchyView/HierarchyView.module.js',
            'SBIS3.CORE.HierarchyCustomView': 'lib/Control/HierarchyCustomView/HierarchyCustomView.module.js',
            'SBIS3.CORE.TreeView': 'lib/Control/TreeView/TreeView.module.js',
            'SBIS3.CORE.HierarchyViewAbstract': 'lib/Control/HierarchyViewAbstract/HierarchyViewAbstract.module.js',
            'SBIS3.CORE.CustomView': 'lib/Control/CustomView/CustomView.module.js',
            'SBIS3.CORE.TableView': 'lib/Control/TableView/TableView.module.js',
            'SBIS3.CORE.DataViewAbstract': 'lib/Control/DataViewAbstract/DataViewAbstract.module.js',
            'SBIS3.CORE.Suggest': 'lib/Control/Suggest/Suggest.module.js',
            'SBIS3.CORE.SwitcherAbstract': 'lib/Control/SwitcherAbstract/SwitcherAbstract.module.js',
            'SBIS3.CORE.Switcher': 'lib/Control/Switcher/Switcher.module.js',
            'SBIS3.CORE.SwitcherDouble': 'lib/Control/SwitcherDouble/SwitcherDouble.module.js',
            'SBIS3.CORE.FieldDropdown': 'lib/Control/FieldDropdown/FieldDropdown.module.js',
            'SBIS3.CORE.FieldLabel': 'lib/Control/FieldLabel/FieldLabel.module.js',
            'SBIS3.CORE.FieldFormatAbstract': 'lib/Control/FieldFormatAbstract/FieldFormatAbstract.module.js',
            'SBIS3.CORE.FieldMask': 'lib/Control/FieldMask/FieldMask.module.js',
            'SBIS3.CORE.FieldMonth': 'lib/Control/FieldMonth/FieldMonth.module.js',
            'SBIS3.CORE.FieldAbstract': 'lib/Control/FieldAbstract/FieldAbstract.module.js',
            'SBIS3.CORE.FieldString': 'lib/Control/FieldString/FieldString.module.js',
            'SBIS3.CORE.FieldEditAtPlace': 'lib/Control/FieldEditAtPlace/FieldEditAtPlace.module.js',
            'SBIS3.CORE.SearchString': 'lib/Control/SearchString/SearchString.module.js',
            'SBIS3.CORE.PageFilter': 'lib/Control/PageFilter/PageFilter.module.js',
            'SBIS3.CORE.FieldText': 'lib/Control/FieldText/FieldText.module.js',
            'SBIS3.CORE.FieldRichEditor': 'lib/Control/FieldRichEditor/FieldRichEditor.module.js',
            'SBIS3.CORE.FieldTinyEditor': 'lib/Control/FieldTinyEditor/FieldTinyEditor.module.js',
            'SBIS3.CORE.FieldRichEditor.ImagePropertiesDialog': 'lib/Control/FieldRichEditor/resources/ImagePropertiesDialog/ImagePropertiesDialog.module.js',
            'SBIS3.CORE.FieldRichEditor.FieldRichEditorMenuButton': 'lib/Control/FieldRichEditor/resources/FieldRichEditorMenuButton/FieldRichEditorMenuButton.module.js',
            'SBIS3.CORE.FieldRichEditor.FieldRichEditorDropdown': 'lib/Control/FieldRichEditor/resources/FieldRichEditorDropdown/FieldRichEditorDropdown.module.js',
            'SBIS3.CORE.Menu': 'lib/Control/Menu/Menu.module.js',
            'SBIS3.CORE.FieldDate': 'lib/Control/FieldDate/FieldDate.module.js',
            'SBIS3.CORE.FieldDatePicker': 'lib/Control/FieldDatePicker/FieldDatePicker.module.js',
            'SBIS3.CORE.FilterController': 'lib/Control/FilterController/FilterController.module.js',
            'SBIS3.CORE.FiltersArea': 'lib/Control/FiltersArea/FiltersArea.module.js',
            'SBIS3.CORE.FiltersDialog': 'lib/Control/FiltersDialog/FiltersDialog.module.js',
            'SBIS3.CORE.FiltersWindow': 'lib/Control/FiltersWindow/FiltersWindow.module.js',
            'SBIS3.CORE.FilterView': 'lib/Control/FilterView/FilterView.module.js',
            'SBIS3.CORE.FloatArea': 'lib/Control/FloatArea/FloatArea.module.js',
            'SBIS3.CORE.RecordFloatArea': 'lib/Control/RecordFloatArea/RecordFloatArea.module.js',

            'SBIS3.CORE.FilterFloatArea': 'lib/Control/FilterFloatArea/FilterFloatArea.module.js',
            'SBIS3.CORE.FilterButtonArea'      : 'lib/Control/FilterButton/FilterButtonArea/FilterButtonArea.module.js',
            'SBIS3.CORE.FilterButtonHistory'   : 'lib/Control/FilterButton/FilterButtonHistory/FilterButtonHistory.module.js',
            'SBIS3.CORE.FilterButton'          : 'lib/Control/FilterButton/FilterButton.module.js',

            'SBIS3.CORE.Master'                : 'lib/Control/Master/Master.module.js',
            /*'SBIS3.CORE.SchemeEditor'          : 'lib/Control/SchemeEditor/SchemeEditor.module.js',*/
            'SBIS3.CORE.TabTemplatedArea'      : 'lib/Control/TabTemplatedArea/TabTemplatedArea.module.js',
            'SBIS3.CORE.Tabs'                  : 'lib/Control/Tabs/Tabs.module.js',
            'SBIS3.CORE.Grid'                  : 'lib/Control/Grid/Grid.module.js',
            'SBIS3.CORE.RelativeGrid'          : 'lib/Control/RelativeGrid/RelativeGrid.module.js',
            'SBIS3.CORE.GridLayout'            : 'lib/Control/GridLayout/GridLayout.module.js',
            'SBIS3.CORE.StackPanel'            : 'lib/Control/StackPanel/StackPanel.module.js',
            'SBIS3.CORE.Table'                 : 'lib/Control/Table/Table.module.js',
            'SBIS3.CORE.Accordion'             : 'lib/Control/Accordion/Accordion.module.js',
            'SBIS3.CORE.NavigationPanel'       : 'lib/Control/NavigationPanel/NavigationPanel.module.js',
            'SBIS3.CORE.ToolBar'               : 'lib/Control/ToolBar/ToolBar.module.js',
            'SBIS3.CORE.FieldImage'            : 'lib/Control/FieldImage/FieldImage.module.js',
            'SBIS3.CORE.ImageGallery'          : 'lib/Control/ImageGallery/ImageGallery.module.js',
            'SBIS3.CORE.FieldLink'             : 'lib/Control/FieldLink/FieldLink.module.js',
            'SBIS3.CORE.FieldNumeric'          : 'lib/Control/FieldNumeric/FieldNumeric.module.js',
            'SBIS3.CORE.FieldInteger'          : 'lib/Control/FieldInteger/FieldInteger.module.js',
            'SBIS3.CORE.FieldMoney'            : 'lib/Control/FieldMoney/FieldMoney.module.js',
            'SBIS3.CORE.FieldRadio'            : 'lib/Control/FieldRadio/FieldRadio.module.js',
            'SBIS3.CORE.ProgressBar'           : 'lib/Control/ProgressBar/ProgressBar.module.js',
            'SBIS3.CORE.HTMLChunk'             : 'lib/Control/HTMLChunk/HTMLChunk.module.js',
            'SBIS3.CORE.MasterProgress'        : 'lib/Control/MasterProgress/MasterProgress.module.js',
            'SBIS3.CORE.GroupCheckBox'         : 'lib/Control/GroupCheckBox/GroupCheckBox.module.js',
            'SBIS3.CORE.OperationsPanel'       : 'lib/Control/OperationsPanel/OperationsPanel.module.js',
            'SBIS3.CORE.OperationsPanelND'     : 'lib/Control/OperationsPanelND/OperationsPanelND.module.js',
            'SBIS3.CORE.HTMLView'              : 'lib/Control/HTMLView/HTMLView.module.js',
            'SBIS3.CORE.DateRange'             : 'lib/Control/DateRange/DateRange.module.js',
            'SBIS3.CORE.DateRangeChoose'       : 'lib/Control/DateRangeChoose/DateRangeChoose.module.js',
            'SBIS3.CORE.FieldCheckbox'         : 'lib/Control/FieldCheckbox/FieldCheckbox.module.js',
            'SBIS3.CORE.RecordArea'            : 'lib/Control/RecordArea/RecordArea.module.js',
            'SBIS3.CORE.GridAbstract'          : 'lib/Control/GridAbstract/GridAbstract.module.js',
            'SBIS3.CORE.Dialog'                : 'lib/Control/Dialog/Dialog.module.js',
            'SBIS3.CORE.DialogAlert'           : 'lib/Control/DialogAlert/DialogAlert.module.js',
            'SBIS3.CORE.DialogConfirm'         : 'lib/Control/DialogConfirm/DialogConfirm.module.js',
            'SBIS3.CORE.DialogRecord'          : 'lib/Control/DialogRecord/DialogRecord.module.js',
            'SBIS3.CORE.Selector'              : 'lib/Control/DialogSelector/Selector.module.js',
            'SBIS3.CORE.DialogSelector'        : 'lib/Control/DialogSelector/DialogSelector.module.js',
            'SBIS3.CORE.FloatAreaSelector'     : 'lib/Control/DialogSelector/FloatAreaSelector.module.js',
            'SBIS3.CORE.SimpleDialogAbstract'  : 'lib/Control/SimpleDialogAbstract/SimpleDialogAbstract.module.js',
            'SBIS3.CORE.Window'                : 'lib/Control/Window/Window.module.js',
            'SBIS3.CORE.ModalOverlay'          : 'lib/Control/ModalOverlay/ModalOverlay.module.js',
            'SBIS3.CORE.TemplatedArea'         : 'lib/Control/TemplatedArea/TemplatedArea.module.js',
            'SBIS3.CORE.TemplatedAreaAbstract' : 'lib/Control/TemplatedAreaAbstract/TemplatedAreaAbstract.module.js',
            'SBIS3.CORE.AreaAbstract'          : 'lib/Control/AreaAbstract/AreaAbstract.module.js',
            'SBIS3.CORE.RaphaelMultiGraph'     : 'lib/Control/RaphaelMultiGraph/RaphaelMultiGraph.module.js',
            'SBIS3.CORE.RaphaelPieGraph'       : 'lib/Control/RaphaelPieGraph/RaphaelPieGraph.module.js',
            'SBIS3.CORE.RaphaelChartGraph'     : 'lib/Control/RaphaelChartGraph/RaphaelChartGraph.module.js',
            'SBIS3.CORE.RaphaelDrawerInternal' : 'lib/Control/RaphaelDrawerInternal/RaphaelDrawerInternal.module.js',
            'SBIS3.CORE.DragAndDropPlugin'     : 'lib/Control/DragAndDropPlugin/DragAndDropPlugin.module.js',
            'SBIS3.CORE.CompoundControl'       : 'lib/Control/CompoundControl/CompoundControl.module.js',
            'SBIS3.CORE.TabButtons'            : 'lib/Control/TabButtons/TabButtons.module.js',
            'SBIS3.CORE.CollapsingNavigation'  : 'lib/CollapsingNavigation/CollapsingNavigation.module.js',

            'SBIS3.CORE.CopyPlugin'            : 'lib/Control/DataViewAbstract/plugins/Copy-plugin.js',
            'SBIS3.CORE.MarkedRowOptionsPlugin': 'lib/Control/DataViewAbstract/plugins/MarkedRowOptions-plugin.js',
            'SBIS3.CORE.MergePlugin'           : 'lib/Control/DataViewAbstract/plugins/Merge-plugin.js',
            'SBIS3.CORE.PrintPlugin'           : 'lib/Control/DataViewAbstract/plugins/Print-plugin.js',
            'SBIS3.CORE.ToolbarPlugin'         : 'lib/Control/DataViewAbstract/plugins/Toolbar-plugin.js',
            'SBIS3.CORE.MovePlugin'            : 'lib/Control/DataViewAbstract/plugins/Move-plugin.js',

            'SBIS3.CORE.AtPlaceEditPlugin'     : 'lib/Control/TableView/plugins/AtPlaceEdit-plugin.js',
            'SBIS3.CORE.LadderPlugin'          : 'lib/Control/TableView/plugins/Ladder-plugin.js',
            'SBIS3.CORE.ResultsPlugin'         : 'lib/Control/TableView/plugins/Results-plugin.js',
            'SBIS3.CORE.ColorMarkPlugin'       : 'lib/Control/TableView/plugins/ColorMark-plugin.js',
            'SBIS3.CORE.PartScrollPlugin'      : 'lib/Control/TableView/plugins/PartScroll-plugin/PartScroll-plugin.js',
            'SBIS3.CORE.ScrollPaging'          : 'lib/Control/TableView/plugins/ScrollPaging-plugin.js',
            'SBIS3.CORE.RightAccordionPlugin'  : 'lib/Control/TableView/plugins/RightAccordion-plugin/RightAccordion-plugin.js',

            'SBIS3.CORE.CropPlugin'            : 'lib/Control/FieldImage/plugins/FieldImageCrop-plugin.js',
            'SBIS3.CORE.ZoomPlugin'            : 'lib/Control/FieldImage/plugins/FieldImageZoom-plugin.js',

            'SBIS3.CORE.AccordionCollapsePlugin':'lib/Control/Accordion/plugins/Collapse-plugin.js',
            'SBIS3.CORE.NavigationPanelCollapsePlugin':'lib/Control/NavigationPanel/plugins/Collapse-plugin.js',

            'SBIS3.CORE.RequestHistoryPlugin'  : 'lib/Control/FilterButton/plugins/RequestHistory-plugin.js',

            'SBIS3.CORE.Label'                 : 'lib/Control/Label/Label.module.js',
            'SBIS3.CORE.ButtonAbstract'        : 'lib/Control/ButtonAbstract/ButtonAbstract.module.js',
            'SBIS3.CORE.LinkButton'            : 'lib/Control/LinkButton/LinkButton.module.js',
            'SBIS3.CORE.OutlineButton'           : 'lib/Control/OutlineButton/OutlineButton.module.js',
            'SBIS3.CORE.PushButton'            : 'lib/Control/PushButton/PushButton.module.js',
            'SBIS3.CORE.TabControl'            : 'lib/Control/TabControl/TabControl.module.js',
            'SBIS3.CORE.SwitchableArea'        : 'lib/Control/SwitchableArea/SwitchableArea.module.js',
            'SBIS3.CORE.FloatAreaManager'      : 'lib/FloatAreaManager/FloatAreaManager.module.js',

            "SBIS3.CORE.CustomType"            : "lib/Type/CustomType.module.js",
            "SBIS3.CORE.TDataSource"           : "lib/Type/TDataSource/TDataSource.module.js",
            "SBIS3.CORE.TReaderParams"         : "lib/Type/TReaderParams/TReaderParams.module.js",
            "SBIS3.CORE.PluginManager"         : "lib/PluginManager/PluginManager.module.js",
            "SBIS3.CORE.PluginSetupDialog"     : "lib/PluginManager/resources/PluginSetupDialog/PluginSetupDialog.module.js",
            'SBIS3.CORE.DataBoundMixin'        : 'lib/Mixins/DataBoundMixin.module.js',
            'SBIS3.CORE.CompoundActiveFixMixin': 'lib/Mixins/CompoundActiveFixMixin.module.js',
            'SBIS3.CORE.ServerEventBus'        : 'lib/ServerEventBus/ServerEventBus.module.js',
            'SBIS3.CORE.CloseButton'           : 'lib/Control/CloseButton/CloseButton.module.js',
            'SBIS3.CORE.Cache'                 : 'lib/Cache/Cache.module.js',
            'SBIS3.CORE.CoreValidators'        : 'lib/CoreValidators/CoreValidators.module.js',
            'SBIS3.CORE.KbLayoutRevert'        : 'lib/KbLayoutRevert/KbLayoutRevert.module.js',
            'SBIS3.CORE.MarkupTransformer'     : 'lib/MarkupTransformer/MarkupTransformer.module.js',
            'SBIS3.CORE.TileView'              : 'lib/Control/TileView/TileView.module.js',
            'SBIS3.CORE.XSLT'                  : 'lib/xslt.js',
            'SBIS3.CORE.ServiceUpdateNotifier' : 'lib/ServiceUpdateNotifier/ServiceUpdateNotifier.module.js'
         },
         jsModules:{},
         /**
          * Информация о словарях, чтобы знать какие есть и какие грузить
          * Временная мера (все временное постоянно :( )
          */
         dictionary:{
            'SBIS3.CORE.DialogConfirm.uk-UA.json'     : 'ws/lib/Control/DialogConfirm/resources/lang/uk-UA/uk-UA.json',
            'SBIS3.CORE.LoadingIndicator.uk-UA.json'  : 'ws/lib/Control/LoadingIndicator/resources/lang/uk-UA/uk-UA.json',
            'SBIS3.CORE.PathSelector.uk-UA.json'      : 'ws/lib/Control/PathSelector/resources/lang/uk-UA/uk-UA.json',
            'SBIS3.CORE.Control.uk-UA.json'           : 'ws/lib/Control/resources/lang/uk-UA/uk-UA.json',
            'SBIS3.CORE.SearchString.uk-UA.json'      : 'ws/lib/Control/SearchString/resources/lang/uk-UA/uk-UA.json'
         },
         classLoaderMappings: {},
         /**
          * Расстояние, утянув объект на которое, начинается drag&drop
          */
         startDragDistance: 4,
         availableLanguage: {},
         /**
          * Классы контролов-окон, которые могут быть родителями других окон и всплывающих панелей.
          */
         WINDOW_CLASSES: ['SBIS3.CORE.FloatArea', 'SBIS3.CORE.Window', 'SBIS3.CORE.FieldEditAtPlace']
      },
      /**
       * Хранилище загруженных обработчиков
       */
      _handlers: {},
      core: {},
      helpers: {},
      /**
       * Хранилище прототипов классов
       */
      proto : {},
      /**
       * Хранилище синглтонов
       */
      single : {},
      /**
       * Хранилище миксинов
       */
      mixins : {},
      /**
       * Рендеры.
       * См. {@link $ws.render.defaultColumn}.
       * @namespace
       */
      render : {
         /**
          * @namespace
          */
         defaultColumn: {
            /**
             * Отображает число с добавлением нулей слева от него.
             * Используется для приведения к виду с заданным количеством знаков.
             * @param {Number} val Число.
             * @param {Number} l Количество знаков, которое должно получиться.
             * @returns {String} Отформатированное число
             * @example
             * <pre>
             *     $ws.render.defaultColumn.leadZero(2, 5); // выведет 00002
             * </pre>
             */
            leadZero : function(val, l){
               var s ='' + Math.floor(val);
               if (s.length < l) {
                  s = '00000000000000000000000000000000'.substr(0, l - s.length) + s;
               }
               return s;
            },
            /**
             * Отображает форматированное целое число.
             * Производит отделение разрядов пробелами.
             * format: -N NNN, ..., -1, 0, 1, ... N NNN.
             * Например, 123456 = 123 456.
             * @param {Number} val Целое число.
             * @param {Boolean} [noDelimiters = false] Не нужны ли разделители:
             * true - не будет производить форматирование по разрядам.
             * false или null - разделит разряды пробелами.
             * @returns {string} Возвращает отформатированное число.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.integer(1111111) // выведет 1 111 111
             * </pre>
             * <pre>
             *     $ws.render.defaultColumn.integer(1111111, true) // выведет 1111111
             * </pre>
             */
            integer : function(val, noDelimiters){
               try {
                  val = String.trim('' + val);
               } catch (e) {
                  val = '';
               }
               //пример регулярки "-000233.222px"
               var numRe = /^-?([0]*)(\d+)\.?\d*\D*$/, f;
               if(!val.match(numRe))
                  return '0';
               f = val.replace(numRe, '$2');
               return (val.substr(0, 1) == '-' ? '-' : '') + (noDelimiters ? f : String.trim(f.replace(/(?=(\d{3})+$)/g, ' ')));
            },
            /**
             * Спан для boolean, формирует вёрстку: если true - чекбокс с галочкой, иначе пустой.
             * @param {Boolean} val Исходное значение.
             * @param {Boolean} [returnStr = false] Нужно ли вернуть как строку или же как jQuery(на случай использования в прикладном коде).
             * По умолчанию возвращает jQuery-объект.
             * @returns {String|jQuery} Cтрока или jQuery-объект.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.logic(true,true); // вернёт "<span class="ws-browser-checkbox-logic true"></span>"
             * </pre>
             */
            logic: function(val, returnStr){
               var className;
               if (val) {
                  className = 'ws-browser-checkbox-logic-true';
               } else {
                  className = 'ws-browser-checkbox-logic-false';
               }
               var str = '<span class="ws-browser-checkbox-logic ' + (className) + '"></span>';
               return returnStr ? str : $(str);
            },
            /**
             * Отображает число в формате денежной единицы
             * Округляет с точностью до двух знаков после запятой, целую часть разделяет на разряды пробелами.
             * Дробная часть округляется математически.
             * format: -N NNN.NN, ..., -1.00, -, 1.00, ... N NNN.NN
             * @param {Number} val Вещественное число.
             * @returns {String} {val} Форматированное вещественное число.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.money(12345.678); // выведет "12 345.68"
             * </pre>
             */
            money : function(val){
               return $ws.render.defaultColumn.real(val, 2, true);
            },
            /**
             * Отображает значение в виде отформатированного числа
             * @param val Вещественное число.
             * @param {Number} integers Количество знаков до запятой.
             * @param {Boolean} delimiters Отделить ли разряды пробелами.
             * @param {Number} decimals Количество знаков после запятой. Если их нет, то допишет нули.
             * @param {Boolean} notNegative Показывать только неотрицательное значения или произвольные
             * @param {Number} maxLength Задание максимальной длины текста в поле
             * @returns {String} val Отформатированное число.
             */
            numeric: function(val, integers, delimiters, decimals, notNegative, maxLength) {
               var
                  // позиция точки
                  dotPos,
                  // позиция второй точки
                  dotSec,
                  // позиция 0 до точки справа
                  lastZeroPos,
                  // присутствует ли минус в значении
                  hasMinus;
               if ((val+'').indexOf('e') !== -1 && !isNaN(parseFloat(val+''))) {
                  val = val.toFixed(20);
                  lastZeroPos = val.length;
                  while (val.charAt(lastZeroPos-1) === '0') {
                     --lastZeroPos;
                  }
                  val = val.substr(0, lastZeroPos);
               }
               val = ('' + val).replace(notNegative ? /[^0-9\.]/g : /[^0-9\.\-]/g,'');
               dotPos = val.indexOf('.');
               dotSec = val.indexOf('.',dotPos+1);
               hasMinus = /\-/.test(val) ? 1 : 0;
               if (dotSec !== -1) {
                  val = val.substring(0,dotSec);
               }
               if (dotPos === val.length-1) {
                  val = val.substr(0,val.length-1);
                  dotPos = -1;
               }
               if(!/^\-?[0-9]*(\.[0-9]*)?$/.test(val)) {
                  val = '';
               }
               if (val === '' || val === null) { // все нумерик поля кроме денег могут иметь значение null
                  val = null;
               } else {
                  if (integers >= 0) {
                     if (dotPos === -1) {
                        dotPos = val.length;
                     }
                     if (integers + hasMinus < dotPos) {
                        val = val.substring(0, integers + hasMinus) + val.substr(dotPos);
                     }
                     dotPos = val.indexOf('.');
                  }
                  if (decimals < 0) {
                     val = dotPos === -1
                        ? $ws.render.defaultColumn.integer(val, !delimiters)
                        : [
                        $ws.render.defaultColumn.integer(val.substring(0, dotPos), !delimiters),
                        val.substr(dotPos)
                     ].join('');
                  } else {
                     val = val.substr(0, maxLength && !delimiters ?  maxLength : val.length);
                     val = $ws.render.defaultColumn.real(val, decimals, delimiters);
                  }
               }
               return val;
            },
             /**
              * Отображает значение в виде отформатированного вещественного числа
              * @param val Вещественное число.
              * @param {Number} decimals Количество знаков после запятой. Если их нет, то допишет нули.
              * @param {Boolean} delimiters Отделить ли разряды пробелами.
              * @returns {String} val Отформатированное вещественное число.
              * @example
              * <pre>
              *     $ws.render.defaultColumn.real(2564, 2, true); // выведет "2 564.00"
              * </pre>
              */
            real : function(val, decimals, delimiters){
               decimals = decimals === undefined ? 0 : decimals;
               var dotPos = (val = (val + "")).indexOf(".");
               var firstPart = val;

               if (dotPos != -1)
                  firstPart = val.substring(0, dotPos);

               // Получаем математическое округление дробной части
               var
                  parsedVal = dotPos != -1 ? val.substr(dotPos) : 0,
                  isNegative = firstPart.indexOf('-') !== -1,
                  weNeedDecimals;
               if(parsedVal == '.')
                  parsedVal = '.0';
               weNeedDecimals = parseFloat(parsedVal).toFixed(decimals);
               if (weNeedDecimals == 1) {
                  firstPart = parseInt(firstPart, 10);
                  firstPart = isNegative ? firstPart - 1 : firstPart + 1;
               }
               weNeedDecimals = weNeedDecimals.replace(/.+\./, "");

               // Если передано значение без точки или нам нужна только целая часть
               if (decimals === 0) {
                  return $ws.render.defaultColumn.integer(firstPart, !delimiters);
               }

               var buffer = [];
               buffer.push($ws.render.defaultColumn.integer(firstPart, !delimiters));
               buffer.push('.');
               buffer.push(weNeedDecimals);
               return buffer.join('');
            },
            /**
             * Отображает любое число в виде вещественного с 3 знаками после запятой
             * Может использоваться для перевода из миллисекунд в секунды и других целей.
             * В результате перевода всегда будут 3 знака после запятой - допишутся нули,
             * если их окажется меньше, например 20000 = 20,000.
             * При делении округляет в меньшую сторону, например, 2,65 = 0,002.
             * @param {number} val Вещественное число.
             * @returns {String} Возвращает строку.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.timer(123456); // выведет 123.456
             * </pre>
             */
            timer : function(val){
               return Math.floor(val / 1000) + "." + $ws.render.defaultColumn.leadZero(val % 1000, 3);
            },
            /**
             * Отображает объект Date строкой вида 'DD.MM.YY HH:MM:SS'
             * Например, new Date(2010,8,6,17,44,15) преобразуется в '06.09.10 17:44:15'.
             * Месяцы нумеруются с 0 по 11. 0 - январь, 11 - декабрь.
             * @param {} date объект
             * @param {String} [type] Возможны три вида: "Дата", "Время", "Дата и время".
             * @param {Boolean} [prec] Отвечает за точность:
             *                        1. true - время с секундами и миллисекундами
             *                        2. {precision: sec} - только с секундами
             *                        3. {precision: msec} - с секундами и миллисекундами
             *                        4. {precision: min} - только с минутами
             *                        5. что-то другое - только с секундами
             * @returns {String} Возвращает строку.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.timestamp(new Date(2013,10,7,9,27,0,1), "Дата и время", true); // выведет "07.11.13 09:27:00.001"
             * </pre>
             */
            timestamp : function(date, type, prec){
               var retval = "",
                   year, month, day, hours, minutes, seconds, millisec,
                   precision = (typeof prec == 'object' && 'precision' in prec ? prec.precision : prec);
               if(date instanceof Date){
                  year = date.getFullYear()%100;
                  month = date.getMonth() + 1;
                  day = date.getDate();
                  hours = date.getHours();
                  minutes = date.getMinutes();
                  seconds = date.getSeconds();
                  millisec = date.getMilliseconds();
                  if(type !== "time" && type !== "Время")
                     retval = ((day < 10 ? "0" : "") + day) + "." + ((month < 10 ? "0" : "") + month) + "." + ((year < 10 ? "0" : "") + year);
                  if(type in {"timestamp": 0, "Дата и время": 0, "time": 0, "Время": 0}){
                     retval += type in {"time": 0, "Время": 0} ? "" : " ";
                     retval +=  ((hours < 10 ? "0" : "") + hours) + ":" + ((minutes < 10 ? "0" : "") + minutes);
                  if(precision === true || precision == 'sec' || precision == 'msec' || precision !== 'min') {
                     retval += ":" + (seconds < 10 ? "0" : "") + seconds;
                  }

                     if(precision === true || precision == 'msec') {
                        if(millisec > 0) {
                           if(millisec < 10)
                              retval += ".00" + millisec;
                           else {
                              if(millisec < 100)
                                 retval += ".0" + millisec;
                              else
                                 retval += "." + millisec;
                           }
                        }
                        else
                           retval += ".000";
                     }

                  }
               }
               else {
                  retval = "&minus;";
               }
               return retval;
            },
            /**
              * Отображение по умолчанию для колонок типа "перечисляемое"
              * Отображает текущее значение.
              * @param {$ws.proto.Enum} iEnum Набор доступных значений.
              * @returns {String} Возвращает строковое значение, соответствующее переданному экземпляру.
              * @example
              * <pre>
              *     var myEnum = new $ws.proto.Enum({
              *         availableValues: {
              *             "0" : "синий",
              *             "1" : "красный",
              *             "2" : "белый"
              *         }
              *     });
              *     myEnum.set("1");
              *     $ws.render.defaultColumn.enumType(myEnum); // выведет "красный"
              * </pre>
             */
            enumType: function(iEnum) {
               if(iEnum instanceof $ws.proto.Enum){
                  var value = iEnum.getCurrentValue();
                  if(value === null){
                     return '';
                  }
                  return iEnum.getValues()[iEnum.getCurrentValue()];
               }
               return '';
            },
            /**
             * Отображение по умолчанию для колонок типа "флаги"
             * @param {$ws.proto.Record} record Запись, флаги передаются именно в таком виде.
             * @returns {string} Возвращает строку заголовков активных флагов через запятую.
             * <pre>
             *    var record = new $ws.proto.Record({
             *       colDef: [{
             *          "n": "Первое",
             *          "t": "Логическое"
             *       },{
             *          "n": "Второе",
             *          "t": "Логическое"
             *       },{
             *          "n": "Третье",
             *          "t": "Логическое"
             *       }],
             *       row: [true, false, true]
             *    });
             *    $ws.render.defaultColumn.flags(record); // выведет "Первое, Третье"
             * </pre>
             */
            flags: function(record){
               var res = [];
               record.each(function(title, value){
                  if(value){
                     res.push(title);
                  }
               });
               if(res.length){
                  return res.join(', ');
               }
               return "&minus;";
            },
            /**
             * Проверяет принадлежность типа к строковому
             * @param {String} type Тип данных.
             * @returns {Boolean} true, если передано строковое значение, иначе false.
             * @example
             * <pre>
             *     $ws.render.defaultColumn.isText("xid"); // выведет "false"
             * </pre>
             */
            isText: function(type){
               return type.indexOf('char') !== -1 || type == 'text';
            }
         }
      }
   };
})();

/**
 * @class
 * @name Date
 * @public
 */
/**
 * приводит объект Date() к виду, необходимому для передачи в SQL
 * @param {Boolean|Object} [mode] необходимость выводить время.
 *    undefined   - Сериализуется как Дата.
 *    true        - Сериализуется как Дата и время.
 *    false       - Сериализуется как Время.
 *    null        - выбрать тип автоматически (см. setSQLSerializationMode).
 * @returns {String}
 */
Date.prototype.toSQL = function (mode) {

   if (mode === Date.SQL_SERIALIZE_MODE_AUTO)
      mode = this._serializeMode;

   var
      year = this.getFullYear(),
      month = this.getMonth() + 1,
      day = this.getDate(),
      hours = this.getHours(),
      minutes = this.getMinutes(),
      seconds = this.getSeconds(),
      milliseconds = this.getMilliseconds(),
      offsetNum = this.getTimezoneOffset(),
   //offset = ['+', 0, ':', 0],
      offset = ['+', 0],
      someDig = function (num, dig) { // функция для форматирования чисел с нужным количеством цифр/ведущих нулей
         if (dig === undefined || dig < 2) {
            dig = 2;
         }
         var
            dec = num % 10;
         num -= dec;
         num /= 10;
         return (dig == 2 ? '' + num : someDig(num, dig - 1)) + dec;
      },
      data = '';
   if (mode !== Date.SQL_SERIALIZE_MODE_TIME)
      data = year + '-' + someDig(month) + '-' + someDig(day);
   if (mode !== Date.SQL_SERIALIZE_MODE_DATE) {
      if (mode === Date.SQL_SERIALIZE_MODE_DATETIME)
         data += ' ';
      data += someDig(hours) + ':' + someDig(minutes) + ':' + someDig(seconds);
      if (milliseconds) // выводим милисекунды, если они заданы
         data += '.' + someDig(milliseconds, 3);
      if (offsetNum > 0) // добавляем указание часового пояса локали
         offset[0] = '-';
      else
         offsetNum = -offsetNum;
      //offset[3] = offsetNum % 60;
      offsetNum -= offsetNum % 60;
      offset[1] = offsetNum / 60;
      offset[1] = someDig(offset[1]);
      //offset[3] = someDig(offset[3]);
      data += offset.join('');
   }
   return data;
};
/**
 * Метод сравнения дат. Если даты равны, вернёт true, иначе - false
 * @param {Date} d Другая дата.
 * @return {Boolean}
 */
Date.prototype.equals = function (d) {
   var res = false;
   if (d instanceof Date)
      res = this.getTime() == d.getTime();
   return res;
};

Date.SQL_SERIALIZE_MODE_DATE = undefined;
Date.SQL_SERIALIZE_MODE_DATETIME = true;
Date.SQL_SERIALIZE_MODE_TIME = false;
Date.SQL_SERIALIZE_MODE_AUTO = null;

/**
 * @param {boolean} mode режим сериализации текущего инстанса даты в SQL-формат по умолчанию
 *    undefined - Сериализуется как Дата.
 *    true - Сериализуется как Дата и время.
 *    false - Сериализуется как Время.
 */
Date.prototype.setSQLSerializationMode = function (mode) {
   this._serializeMode = mode;
};

Date.prototype.getSQLSerializationMode = function () {
   return this._serializeMode;
};

$ws._const.Date = {
   days: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
   daysSmall: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
   longDays: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
   months: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
   monthsSmall: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
   monthsBig: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
   longMonths: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
   longMonthsSmall: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
   monthsWithDays: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
};

/**
 * Откатывает дату
 * @param {Number} timeValue Число, равное количеству миллисекунд,
 * прошедших с полуночи 1 января 1970 года по универсальному времени
 */
Date.prototype.rollback = function (timeValue) {
   this.setTime(timeValue);
};

/**
 * Метод форматирования даты.
 * Во многом похож на аналог из пхп.
 * <a href="http://php.net/manual/ru/function.strftime.php">http://php.net/manual/ru/function.strftime.php</a>
 *
 * Отображение года:
 * <ul>
 *    <li>'%y': Двухзначный порядковый номер года;</li>
 *    <li>'%Y': Четырехзначный номер года;</li>
 *    <li>'%C': Двухзначный порядковый номер столетия (год, делённый на 100, усечённый до целого);</li>
 *    <li>'%g': <b>См. пример 2!</b> Двухзначный номер года в соответствии со стандартом ISO-8601:1988 (см. %V);</li>
 *    <li>'%G': <b>См. пример 2!</b> Полная четырёхзначная версия %g.</li>
 * </ul>
 * Отображение месяца:
 * <ul>
 *    <li>'%b': Аббревиатура названия месяца (Янв);</li>
 *    <li>'%v': Аббревиатура названия месяца со строчной буквы (янв);</li>
 *    <li>'%B': Полное название месяца (Январь);</li>
 *    <li>'%f': Полное название месяца со строчной буквы (январь);</li>
 *    <li>'%q': Имя месяца с маленькой буквы в родительном падеже (января);</li>
 *    <li>'%m': Двухзначный порядковый номер месяца (01, 02, ...).</li>
 * </ul>
 * Отображение дня:
 * <ul>
 *    <li>'%d': Двухзначное представление дня месяца (с ведущими нулями) (01, 02, ...);</li>
 *    <li>'%e': День месяца, с ведущим пробелом, если он состоит из одной цифры. ( 1,  2, ...);</li>
 *    <li>'%j': Порядковый номер в году, 3 цифры с ведущими нулями;</li>
 *    <li>'%u': Порядковый номер дня недели согласно стандарту ISO-8601.</li>
 * </ul>
 * Отображение недели и дня недели:
 * <ul>
 *    <li>'%a': Сокращённое название дня недели (Пн, Вт, ...);</li>
 *    <li>'%A': Полное название дня недели (Понедельник, ...);</li>
 *    <li>'%w': Порядковый номер дня недели (0 - воскресенье, 1 - понедельник, ...);</li>
 *    <li>'%U': Порядковый номер недели в указанном году, начиная с первого воскресенья в качестве первой недели;</li>
 *    <li>'%W': Порядковый номер недели в указанном году, начиная с первого понедельника в качестве первой недели;</li>
 *    <li>'%V': <b>См. пример 2!</b> Порядковый номер недели в указанном году в соответствии со стандартом ISO-8601:1988.</li>
 * </ul>
 * Отображение времени:
 * <ul>
 *    <li>'%R': Аналогично '%H:%M' (21:17);</li>
 *    <li>'%T': Аналогично '%H:%M:%S' (21:17:56);</li>
 *    <li>'%H': Двухзначный номер часа в 24-часовом формате;</li>
 *    <li>'%I': Двухзначный номер часа в 12-часовом формате;</li>
 *    <li>'%l': Час в 12-часовом формате, с пробелом перед одиночной цифрой;</li>
 *    <li>'%p': 'AM' или 'PM' в верхнем регистре, в зависимости от указанного времени;</li>
 *    <li>'%P': 'am' или 'pm' в зависимости от указанного времени;</li>
 *    <li>'%M': Двухзначный номер минуты;</li>
 *    <li>'%S': Двухзначный номер секунды;</li>
 *    <li>'%z': Смещение временной зоны относительно UTC либо аббревиатура;</li>
 *    <li>'%Z': Смещение временной зоны/аббревиатура, НЕ выдаваемая опцией %z.</li>
 * </ul>
 * Прочее:
 * <ul>
 *    <li>'%Q': квартал (I, II, ...);</li>
 *    <li>'%s': Метка времени Эпохи Unix;</li>
 *    <li>'%%': Символ процента ("%").</li>
 * </ul>
 *
 * @example
 * 1. Пример вывода даты.
 * <pre>
 *    var date = new Date();
 *
 *    date.strftime('Сегодня %e %q %Y года.');
 *    // > "Сегодня 16 апреля 2014 года."
 *
 *    date.setMonth(date.getMonth()+1);
 *    date.setDate(0);
 *    date.strftime('Последний день текущего месяца будет %e %q %Y года.');
 *    // > "Последний день текущего месяца будет 30 апреля 2014 года."
 * </pre>
 * 2. Про %V, %g и %G.
 * По стандарту ISO-8601:1988 счет недель начинается с той, которая содержит минимум 4 дня текущего года.
 * Неделя начинается с понедельника, даже если он выпал на предыдущий год.
 * <pre>
 *    var date = new Date(2013,11,30);
 *
 *    date.toString();
 *    // > "Mon Dec 30 2013 00:00:00 GMT+0400 (Московское время (зима))"
 *
 *    date.strftime('Дата %d %q %Y года по ISO-8601:1988 выпадает на %V неделю %G года (%G-%V).');
 *    // > "Дата 30 декабря 2013 года по ISO-8601:1988 выпадает на 01 неделю 2014 года (2014-01)."
 * </pre>
 * @param {String} format Формат вывода
 * @returns {String} Возвращает дату в выбранном формате.
 * @function
 */
Date.prototype.strftime = function () {
   function _xPad(x, pad, r) {
      if (typeof r === 'undefined') {
         r = 10;
      }
      for (; parseInt(x, 10) < r && r > 1; r /= 10) {
         x = ('' + pad) + x;
      }
      return '' + x;
   }

   var _formats = {
      a: function (d) {
         return $ws._const.Date.days[d.getDay()];
      },
      A: function (d) {
         return $ws._const.Date.longDays[d.getDay()];
      },
      b: function (d) {
         return $ws._const.Date.months[d.getMonth()];
      },
      B: function (d) {
         return $ws._const.Date.longMonths[d.getMonth()];
      },
      q: function (d) {
         return $ws._const.Date.monthsWithDays[d.getMonth()];
      },
      f: function (d) {
         return $ws._const.Date.longMonthsSmall[d.getMonth()];
      },
      C: function (d) {
         return _xPad(parseInt(d.getFullYear() / 100, 10), 0);
      },
      d: ['getDate', '0'],
      e: ['getDate', ' '],
      g: function (d) {
         return _xPad(parseInt(_formats.G(d) % 100, 10), 0);
      },
      G: function (d) {
         var y = d.getFullYear();
         var V = parseInt(_formats.V(d), 10);
         var W = parseInt(_formats.W(d), 10);

         if (W > V) {
            y++;
         } else if (W === 0 && V >= 52) {
            y--;
         }

         return y;
      },
      H: ['getHours', '0'],
      I: function (d) {
         var I = d.getHours() % 12;
         return _xPad(I === 0 ? 12 : I, 0);
      },
      j: function (d) {
         var ms = d - new Date('' + d.getFullYear() + '/1/1 GMT');
         ms += d.getTimezoneOffset() * 60000; // Line differs from Yahoo implementation which would be equivalent to replacing it here with:
         // ms = new Date('' + d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate() + ' GMT') - ms;
         var doy = parseInt(ms / 60000 / 60 / 24, 10) + 1;
         return _xPad(doy, 0, 100);
      },
      k: ['getHours', '0'],
      // not in PHP, but implemented here (as in Yahoo)
      l: function (d) {
         var l = d.getHours() % 12;
         return _xPad(l === 0 ? 12 : l, ' ');
      },
      m: function (d) {
         return _xPad(d.getMonth() + 1, 0);
      },
      M: ['getMinutes', '0'],
      p: function (d) {
         return ['AM', 'PM'][d.getHours() >= 12 ? 1 : 0];
      },
      P: function (d) {
         return ['am', 'pm'][d.getHours() >= 12 ? 1 : 0];
      },
      Q: function (d) {
         return ['I', 'II', 'III', 'IV'][parseInt(d.getMonth() / 3, 10)];
      },
      s: function (d) { // Yahoo uses return parseInt(d.getTime()/1000, 10);
         return Date.parse(d) / 1000;
      },
      S: ['getSeconds', '0'],
      u: function (d) {
         var dow = d.getDay();
         return ((dow === 0) ? 7 : dow);
      },
      U: function (d) {
         var doy = parseInt(_formats.j(d), 10);
         var rdow = 6 - d.getDay();
         var woy = parseInt((doy + rdow) / 7, 10);
         return _xPad(woy, 0);
      },
      v: function (d) {
         var month = d.getMonth();
         return $ws._const.Date.monthsSmall[month];
      },
      V: function (d) {
         var woy = parseInt(_formats.W(d), 10);
         var dow1_1 = (new Date('' + d.getFullYear() + '/1/1')).getDay();
         // First week is 01 and not 00 as in the case of %U and %W,
         // so we add 1 to the final result except if day 1 of the year
         // is a Monday (then %W returns 01).
         // We also need to subtract 1 if the day 1 of the year is
         // Friday-Sunday, so the resulting equation becomes:
         var idow = woy + (dow1_1 > 4 || dow1_1 <= 1 ? 0 : 1);
         if (idow === 53 && (new Date('' + d.getFullYear() + '/12/31')).getDay() < 4) {
            idow = 1;
         } else if (idow === 0) {
            idow = _formats.V(new Date('' + (d.getFullYear() - 1) + '/12/31'));
         }
         return _xPad(idow, 0);
      },
      w: 'getDay',
      W: function (d) {
         var doy = parseInt(_formats.j(d), 10);
         var rdow = 7 - _formats.u(d);
         var woy = parseInt((doy + rdow) / 7, 10);
         return _xPad(woy, 0, 10);
      },
      y: function (d) {
         return _xPad(d.getFullYear() % 100, 0);
      },
      Y: 'getFullYear',
      z: function (d) {
         var o = d.getTimezoneOffset();
         var H = _xPad(parseInt(Math.abs(o / 60), 10), 0);
         var M = _xPad(o % 60, 0);
         return (o > 0 ? '-' : '+') + H + M;
      },
      Z: function (d) {
         return d.toString().replace(/^.*\(([^)]+)\)$/, '$1');
      },
      '%': function (d) {
         return '%';
      }
   };

   var _aggregates = {
      c: '%a %d %b %Y %r %Z',
      D: '%d/%m/%y',
      F: '%y-%m-%d',
      h: '%b',
      n: '\n',
      r: '%I:%M:%S %p',
      R: '%H:%M',
      t: '\t',
      T: '%H:%M:%S',
      x: '%d/%m/%Y',
      X: '%r'
   };

   return function (format) {
      var self = this;

      // First replace aggregates (run in a loop because an agg may be made up of other aggs)
      while (format.match(/%[cDFhnrRtTxX]/)) {
         format = format.replace(/%([cDFhnrRtTxX])/g, function (m0, m1) {
            return _aggregates[m1];
         });
      }

      // Now replace formats - we need a closure so that the date object gets passed through
      return format.replace(/%([aAbBCdefgGHIjklmMpPsqQSuUvVwWyYzZ%])/g, function (m0, m1) {
         var f = _formats[m1];
         if (typeof f === 'string') {
            return self[f]();
         } else if (typeof f === 'function') {
            return f(self);
         } else if (typeof f === 'object' && typeof(f[0]) === 'string') {
            return _xPad(self[f[0]](), f[1]);
         } else { // Shouldn't reach here
            return m1;
         }
      });
   }
}();

/**
 * Пытается разобрать дату из БД в объект Date
 * @param {String} date_time.
 * @returns {Date}.
 */
Date.fromSQL = function (date_time) {
   var
      dateSep = date_time.indexOf("-"),
      timeSep = date_time.indexOf(":"),
      millisecSep = date_time.indexOf("."),
      tz = date_time.match(/([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,9})?)([+-])([0-9]{2})[:-]*([0-9]{2})*$/),
      tzSep = tz && tz.index + tz[1].length || -1,
      timeOffset = tz && ((tz[2] + "1") * (tz[3] * 60 + (tz[4] * 1 || 0))) || $ws._const.moscowTimeOffset,
      retval = new Date(),
      ms = null,
      msStr, y, m, d;

   retval.setHours(0, 0, 0, 0);

   if (timeSep === -1 && dateSep === -1)
      return retval;

   if (millisecSep !== -1) {
      msStr = date_time.substr(millisecSep + 1, (tzSep == -1 ? date_time.length : tzSep) - (millisecSep + 1));
      if (msStr.length > 3) {
         msStr = msStr.substr(0, 3);
      }
      ms = parseInt(msStr, 10);
      if (msStr.length < 3)
         ms *= (msStr.length === 2 ? 10 : 100);
   }

   if (dateSep !== -1) {
      y = parseInt(date_time.substr(dateSep - 4, 4), 10);
      m = parseInt(date_time.substr(dateSep + 1, 2), 10) - 1;
      d = parseInt(date_time.substr(dateSep + 4, 2), 10);

      if ($ws._const.compatibility.dateBug && m === 0 && d == 1) {
         retval.setHours(1);
      }

      retval.setFullYear(y, m, d);
   }

   if (timeSep !== -1) {
      retval.setHours(
         parseInt(date_time.substr(timeSep - 2, 2), 10),
         parseInt(date_time.substr(timeSep + 1, 2), 10),
         parseInt(date_time.substr(timeSep + 4, 2), 10),
         ms);
      // Приводим время к местному из Московского если дата передана с сервера со временем
      retval.setMinutes(retval.getMinutes() - timeOffset - retval.getTimezoneOffset());
   }

   return retval;
};

/**
 * Отменяет перевод времени, производимый в функции fromSQL.
 * Изменяет пришедшую дату.
 * @returns {Date} Возвращает текущую уже изменённую дату.
 */
Date.prototype.toServerTime = function () {
   // Приводим время к местному из Московского
   this.setMinutes(this.getMinutes() + this.getTimezoneOffset() + $ws._const.moscowTimeOffset);
   return this;
};

/**
 * Установить дату на последний день месяца
 * @param {Number} [month] Номер месяца 0 - 11, последний день которого нужен.
 * Если не указан берется из даты.
 * @returns {Date}
 */
Date.prototype.setLastMonthDay = function (month) {
   month = month === undefined ? this.getMonth() : parseInt(month, 10);
   this.setDate(1);
   this.setMonth(month + 1);
   this.setDate(0);
   return this;
};



Object.isEmpty = function (obj) {
   if (typeof(obj) !== 'object' || obj === null)
      return false;

   if (obj instanceof Object) {
      for (var i in obj)
         return false;
   } else if (obj instanceof Array) {
      return obj.length === 0;
   }

   return true;
};

Object.isValid = function (obj) {
   return obj !== null && !(obj instanceof Date) && typeof(obj) == 'object' && !Object.isEmpty(obj);
};

if (typeof Object.getPrototypeOf !== "function") {
   if (typeof "test".__proto__ === "object") {
      Object.getPrototypeOf = function (object) {
         return object.__proto__;
      };
   } else {
      Object.getPrototypeOf = function (object) {
         // May break if the constructor has been tampered with
         return object.constructor.prototype;
      };
   }
};

/**
 * Возвращает ключи и значения объекта в отсортированном виде.
 * Сортирует либо по ключам, либо по значениям. Зависит от параметра sortByValues.
 *
 * @param {Object} obj объект
 * @param {Boolean} [sortByValues] Сортировать по занчениям (true) или по ключам (false).
 * @returns {Object} Объект с ключами. keys - ключи, values - значения.
 */
Object.sortedPairs = function (obj, sortByValues) {
   var
      keys = Object.keys(obj),
      values = [],
      tempValue,
      comparator = function (a, b) {
         var aFloat = parseFloat(a),
            bFloat = parseFloat(b),
            aNumeric = aFloat + '' === a,
            bNumeric = bFloat + '' === b;
         if (aNumeric && bNumeric) {
            return aFloat > bFloat ? 1 : aFloat < bFloat ? -1 : 0;
         } else if (aNumeric && !bNumeric) {
            return 1;
         } else if (!aNumeric && bNumeric) {
            return -1;
         }
         return a > b ? 1 : a < b ? -1 : 0;
      };

   sortByValues = sortByValues || false;

   for (var i = 0, l = keys.length; i < l; i++) {
      values.push(obj[keys[i]]);
   }

   for (i = values.length - 2; i >= 0; i--) {
      for (var j = 0; j <= i; j++) {
         var what = sortByValues ? values : keys;
         var ret = comparator(what[j + 1], what[j]);
         if (ret < 0) {
            tempValue = values[j];
            values[j] = values[j + 1];
            values[j + 1] = tempValue;

            tempValue = keys[j];
            keys[j] = keys[j + 1];
            keys[j + 1] = tempValue;
         }
      }
   }
   return {keys: keys, values: values};
};

if (Object.keys === undefined) {
   /**
    * Возвращает ключи объекта
    * @param {Object} obj
    * @return {Array}
    */
   Object.keys = function (obj) {
      var rv = [];
      for (var k in obj) {
         if (obj.hasOwnProperty(k))
            rv.push(k);
      }
      return rv;
   }
}

/**
 * Привязывает фукнцию к заданному контексту и аргументам
 * (Почти) Аналог Function.bind из ES5.
 * @param {*} ctx Привязанный контекст исполнения.
 * @param {*} [arg...] Аргумент...
 * @returns {Function}
 *
 * @see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
 *
 * <pre>
 *   function sum(a, b, c) {
 *     return a + b + c;
 *   }
 *   var sum10 = sum.bind(undefined, 10);
 *   alert(sum(20, 1)); // 31, == sum.apply(undefined, [ 10, 20, 1 ]);
 *
 *   function getA() {
 *      alert(this.a);
 *   }
 *   var a10 = getA.bind({ a: 10 });
 *   a10(); // 10, == getA.apply({ a : 10 }, []);
 * </pre>
 */
if (!Function.prototype.bind) {
   (function () {
      var funcSlice = Array.prototype.slice,
         funcPush = Array.prototype.push;
      Function.prototype.bind = function (ctx) {
         var f = this, args = arguments;
         if (args.length > 1) {
            return function () {
               var selfArgs = funcSlice.call(args, 1);
               if (selfArgs.concat) {
                  selfArgs = selfArgs.concat(funcSlice.call(arguments));
               } else {
                  funcPush.apply(selfArgs, funcSlice.call(arguments));
               }
               return f.apply(ctx, selfArgs);
            }
         } else {
            return function () {
               return f.apply(ctx, arguments);
            }
         }
      };
   })();
}
/**
 * @class
 * @name Function
 * @public
 */
/**
 * Откладывает выполнение функции на период задержки
 * <br/>
 * Это работает таким образом:
 * <ol>
 *    <li>При первом вызове функции её выполнение откладывается на время, заданное параметром delay. Если за это время
 *    происходит второй вызов функции, то он также откладывается на время delay, а первая функция не будет выполнена вообще.
 *    И так далее по аналогии.</li>
 *    <li>Если параметр first=true, то первая функция из серии вызовов будет выполнена до начала задержки.</li>
 * </ol>
 * @param {Number} delay Период задержки в мс.
 * @param {Boolean} [first=false] Определяет необходимость выполнения первой функции из серии вызовов до начала задержки.
 * @returns {Function} Функция, выполнение которой отложено на время задержки.
 * @see throttle
 * @example
 * В форме документа существуют поля, в которые пользователь вносит значение. При изменении значения поля вызывается обработчик.
 * В нём производится перерасчет связанных результирующих полей, которые используют данные всей формы. Т.к. процесс ресурсоёмкий,
 * принимается решение ограничить вызов перерасчет - раз в секунду.
 * <pre>
 * // определена функция расчета результирующих полей
 * function ResultFieldHandler(controlName, value){
 *    ...
 * }
 * // задержка в 1 секунду
 * var d_ResultFieldHandler = ResultFieldHandler.debounce(1000);
 * ...
 * // установлен обработчик на изменение значений поля
 * fieldstring.subscribe('onValueChange', function(eventObject, value) {
 *    var name = this.getName();
 *    d_ResultFieldHandler(name, value);
 * }
 * </pre>
 */
Function.prototype.debounce = function (delay, first) {
   var f = this, timer, wait = false;
   return function () {
      if(wait) return;
      if (first && !timer) {
         f.apply(this, arguments);
         wait = true;
         setTimeout(function(){ wait = false; }, delay);
         return;
      }

      if (timer)
         clearTimeout(timer);
      var argsToCallWith = Array.prototype.slice.call(arguments);
      argsToCallWith.unshift(this);
      // f.bind(this, arg1, arg2, arg3, ...);
      timer = setTimeout(f.bind.apply(f, argsToCallWith), delay);
   };
};

/**
 *
 * Ограничивает число вызовов функции в заданный период времени
 * <br/>
 * Функция может быть вызвана последовательно несколько раз. С помощью throttle можно выполнить только первый её вызов,
 * а затем проигнорировать остальные в течение периода задержки.
 * <br/>
 * Это работает таким образом:
 * <ol>
 *    <li>Сначала происходит выполнение функции.</li>
 *    <li>Далее генерируется задержка на время, указанное параметром delay.</li>
 *    <li>Если за время задержки происходит очередной вызов функции, то она не выполняется.</li>
 *    <li>Если параметр last=true, и за время задержки была вызвана функция, то она выполнится по окончании задержки.
 *    После выполнения также генерируется задержка.</li>
 *    <li>Если параметр last=true и за время delay функция была вызвана несколько раз, то по окончании будет выполнена
 *    последняя из серии вызовов.</li>
 * </ol>
 * @param {Number} delay Период задержки в мс.
 * @param {Boolean} [last=false] Устанавливает необходимость выполнения последней функции из серсии вызовов по окончании задержки.
 * @returns {Function} Функция, после выполнения которой генерируется задержка.
 * @see debounce
 * @example
 * Часто в прикладном коде можно встратить ограничение на число кликов.
 * <pre>
 * this.click(function(){
 *   ... //обработка клика
 * }).throttle(1000);
 * </pre>
 */
Function.prototype.throttle = function (delay, last) {
   var f = this, next, state = true;
   return function () {
      if (state) {
         f.apply(this, arguments);
         state = false;
         setTimeout(function () {
            state = true;
            if (last && next) {
               next();
               next = null;
            }
         }, delay);
      }
      else if(last){
         var argsToCallWith = Array.prototype.slice.call(arguments);
         argsToCallWith.unshift(this);
         next = f.bind.apply(f, argsToCallWith);
      }
   }
};

Function.prototype.callAround = function (fn) {
   if (fn) {
      var f = this;
      return function () {
         Array.prototype.unshift.call(arguments, f);
         return fn.apply(this, arguments);
      }
   } else
      return this;
};

Function.prototype.once = function () {
   var
      original = this,
      called = false,
      result;
   return function () {
      if (!called) {
         result = original.apply(this, arguments);
         called = true;
      } else {
         original = null;
      }
      return result;
   }
};
/**
 * Метод обертки функции. Вызовет перед доопределяемой функцией переданную.
 * Если переданная функция вернула результат, добавит его последним аргументом
 * @param fn Функция, которую нужно позвать до исходной
 * @returns {Function} Доопределенная функция
 * <pre>
 *    var func = function(){
 *          alert(arguments[1]); //выведет false, если доопределить
 *       },
 *        beforeFunc = function(){
 *           if(arguments[1] === true)
 *             arguments[1] === false;
 *        },
 *        newFunc = func.callBefore(beforeFunc);
 * </pre>
 */
Function.prototype.callBefore = function (fn) {
   if (fn) {
      var f = this;
      return function () {
         var res = fn.apply(this, arguments);
         if (res !== undefined)
            Array.prototype.push.call(arguments, res);
         return f.apply(this, arguments);
      }
   } else
      return this;
};

Function.prototype.callBeforeWithCondition = function (fn, condition) {
   if (fn) {
      return this.callBefore(function () {
         if (condition && condition.apply(this, [])) {
            return fn.apply(this, arguments);
         }
      });
   } else {
      return this;
   }
};

Function.prototype.callNext = function (fn) {
   var f = this;
   return function () {
      var res = f.apply(this, arguments),
         sourceResult = res;
      if (fn) {
         Array.prototype.push.call(arguments, res);
         res = fn.apply(this, arguments);
      }
      return res === undefined ? sourceResult : res;
   }
};

Function.prototype.callNextWithCondition = function (fn, condition) {
   if (fn)
      return this.callNext(function () {
         if (condition && condition.apply(this, [])) {
            return fn.apply(this, arguments);
         }
      });
   else
      return this;
};

Function.prototype.callIf = function (condition) {
   var f = this;
   return function () {
      if (condition && condition.apply(this, [])) {
         return f.apply(this, arguments);
      }
   };
};

if (String.prototype.trim === undefined) {
   String.prototype.trim = function () {
      return this.replace(/^\s+|\s+$/g, '');
   };
}

String.prototype.beginsWith = function (s) {
   s = ('' + s);
   return this.substr(0, s.length) === s;
}

String.prototype.ucFirst = function () {
   return this.substr(0, 1).toUpperCase() + this.substr(1);
}

String.prototype.lcFirst = function () {
   return this.substr(0, 1).toLowerCase() + this.substr(1);
}

if (String.trim === undefined) {
   String.trim = function (str) {
      return str.trim();
   };
}

if (typeof Object.create != 'function') {
   // Production steps of ECMA-262, Edition 5, 15.2.3.5
   // Reference: http://es5.github.io/#x15.2.3.5
   Object.create = (function() {
      // To save on memory, use a shared constructor
      function Temp() {}

      // make a safe reference to Object.prototype.hasOwnProperty
      var hasOwn = Object.prototype.hasOwnProperty;

      return function (O) {
         // 1. If Type(O) is not Object or Null throw a TypeError exception.
         if (typeof O != 'object') {
            throw TypeError('Object prototype may only be an Object or null');
         }

         // 2. Let obj be the result of creating a new object as if by the
         //    expression new Object() where Object is the standard built-in
         //    constructor with that name
         // 3. Set the [[Prototype]] internal property of obj to O.
         Temp.prototype = O;
         var obj = new Temp();
         Temp.prototype = null; // Let's not keep a stray reference to O...

         // 4. If the argument Properties is present and not undefined, add
         //    own properties to obj as if by calling the standard built-in
         //    function Object.defineProperties with arguments obj and
         //    Properties.
         if (arguments.length > 1) {
            // Object.defineProperties does ToObject on its first argument.
            var Properties = Object(arguments[1]);
            for (var prop in Properties) {
               if (hasOwn.call(Properties, prop)) {
                  obj[prop] = Properties[prop];
               }
            }
         }

         // 5. Return obj
         return obj;
      };
   })();
}

/**
 * Получить копию массива.
 * Создает копию не только основного массива как делает slice,
 * но также создает копию внутренних массивов
 * @returns {Array} массив, копию которого нужно получить
 */
Array.clone = function (array) {
   var copy = array.slice(),
      obj = {};
   for (var i = 0, l = copy.length; i < l; i++) {
      if (copy[i]) {
         if ($ws.helpers.isPlainArray(copy[i])) {
            copy[i] = Array.clone(copy[i]);
         } else if ($ws.helpers.isPlainObject(copy[i])) {
            obj = copy[i] = $ws.core.merge({}, copy[i]);
            for (var j in obj) {
               if (obj.hasOwnProperty(j) && $ws.helpers.isPlainArray(obj[j])) {
                  obj[j] = Array.clone(obj[j]);
               }
            }
         }
      }
   }
   return copy;
};
Array.isArray = function (arg) {
   return isPlainArray(arg);
};

Array.indexOf = function (arr, e /*, from */) {

   if (!(arr instanceof Array))
      throw new TypeError("Incorrect type of the first arguments. Array expected");

   if ([].indexOf)
      return arr.indexOf(e, arguments[2]);

   var len = arr.length;
   var from = Number(arguments[2]) || 0;
   from = (from < 0) ? Math.ceil(from) : Math.floor(from);
   if (from < 0)
      from += len;
   for (; from < len; from++) {
      if (arr[from] === e)
         return from;
   }
   return -1;
};

Array.remove = function (arr, index, count) {
   var resCount = count ? count : 1;
   if (!(arr instanceof Array))
      throw new TypeError("Incorrect type of the first arguments. Array expected");
   return arr.splice(index, resCount);
};

Array.insert = function (arr, index) {
   if (!(arr instanceof Array))
      throw new TypeError("Incorrect type of the first arguments. Array expected");
   if (typeof(index) == 'undefined') {
      throw new TypeError("Index must be defined");
   }
   var curIndex = index;
   for (var i = 2; i <= arguments.length; i++) {
      if (arguments.hasOwnProperty(i)) {
         arr.splice(curIndex++, 0, arguments[i]);
      }
   }
   return [];
};

/**
 * IoC контейнер
 * Эта штука позволяет нам конфигурировать, какая конкретная реализация соответствует заданному интерфейсу.
 * Все как во взрослых языках, ога.
 * Это используется например для:
 *    - конфигурирования какой транспорт использовать;
 *    - конфигурирования system-wide логгера.
 *
 * <pre>
 *    $ws.single.ioc.bind('ITransport', 'XHRPostTransport');
 *    $ws.single.ioc.bindSingle('ILogger', 'ConsoleLogger', { ...config...});
 *    ...
 *    $ws.single.ioc.resolve('ITransport', config);
 *    $ws.single.ioc.resolve('ILogger');
 * </pre>
 *
 * @class $ws.single.ioc
 * @singleton
 * @public
 */
$ws.single.ioc = (function(){
   var
         map = {},
         singletons = {};
   return /** @lends $ws.single.ioc.prototype */ {
      /**
       * Привязывает реализацию к интерфейсу.
       *
       * @param {String} interfaceName
       * @param {String|Function} implementationName Имя реализации или функция-резолвер возвращающая экземпляр
       */
      bind: function(interfaceName, implementationName){
         map[interfaceName] = {
            implementation: implementationName,
            isSingle: 0
         };
      },
      /**
       * Привязывает единственный экземпляр реализации к указанному "интерфейсу"
       *
       * @param {String} interfaceName
       * @param {String} implementationName
       * @param {Object} [config]
       */
      bindSingle: function(interfaceName, implementationName, config) {
         map[interfaceName] = {
            implementation: implementationName,
            isSingle: 1,
            config: config || {}
         };
         singletons[interfaceName] = '';
      },
      /**
       * @param {String} interfaceName
       * @param {Object} [config]
       * @returns {Object}
       * @throws TypeError
       * @throws ReferenceError
       */
      resolve: function(interfaceName, config){
         if(interfaceName in map){
            var
                  binding = map[interfaceName],
                  classConstructorName = binding.implementation,
                  isSingleton = binding.isSingle;
            if(isSingleton && singletons[interfaceName])
               return singletons[interfaceName];

            // resolver mode
            if(typeof classConstructorName == 'function')
               return classConstructorName(config);

            if(typeof($ws.proto[classConstructorName]) == 'function') {
               if(isSingleton)
                  return singletons[interfaceName] = new $ws.proto[classConstructorName](binding.config);
               else
                  return new $ws.proto[classConstructorName](config);
            }
            else
               throw new TypeError("Implementation " + classConstructorName + " is not defined");
         }
         else
            throw new ReferenceError("No mappings defined for " + interfaceName);
      }
   };
})();

/**
 * @class $ws.core
 * @public
 */
$ws.core = /** @lends  $ws.core.prototype */{
   /**
    * Объединение двух hash.
    * @param {Object} hash Исходный хэш.
    * @param {Object} hashExtender хэш-расширение.
    * @param {Object} [cfg] Параметры работы.
    * @param {Boolean} [cfg.preferSource=false] Сохранять или нет исходное значение. По умолчанию исходное значение не сохраняется.
    * @param {Boolean} [cfg.rec=true] Рекурсивное объединение (по умолчанию - рекурсивное объединение включено).
    * @param {Boolean} [cfg.clone=false] Клонировать элементы или передавать по ссылке (по умолчанию - по ссылке).
    * @param {Boolean} [cfg.create=true] Создавать элементы, отсутствующие в исходном объекте. По умолчанию включено.
    * @param {Boolean} [cfg.noOverrideByNull=false] Запретить заменять исходные значения на null. По умолчанию выключено.
    */
   merge: function wsCoreMerge(hash, hashExtender, cfg) {
      if (cfg === undefined) {
         cfg = {};
      }
      cfg.preferSource = cfg.preferSource !== undefined ? cfg.preferSource : false; // не сохранять исходное значение
      cfg.rec = cfg.rec !== undefined ? cfg.rec : true;  // объединять рекурсивно
      cfg.clone = cfg.clone !== undefined ? cfg.clone : false; // не клонировать элементы (передаем по ссылке)
      cfg.create = cfg.create !== undefined ? cfg.create : true; // создавать элементы, которых нет в исходном хэше
      cfg.noOverrideByNull = cfg.noOverrideByNull !== undefined ? cfg.noOverrideByNull : false; // не заменять значения null'овыми

      if (hashExtender instanceof Date) {
         if (cfg.clone) {
            return new Date(hashExtender);
         } else {
            hash = hashExtender;
            return hash;
         }
      }

      function isMergeableObject(o) {
         return o && ((o.constructor == Object && !('$constructor' in o)) || o.constructor == Array);
      }

      function cloneOrCopy(i) {
         /**
          * Если к нам пришел объект и можно клонировать
          * Запускаем мерж того, что пришло с пустым объектом (клонируем ссылочные типы).
          */
         if ((typeof(hashExtender[i]) == 'object' && hashExtender[i] !== null) && cfg.clone) {
            if (isMergeableObject(hashExtender[i])) {
               hash[i] = $ws.core.merge(hashExtender[i] instanceof Array ? [] : {}, hashExtender[i], cfg);
            } else {
               hash[i] = hashExtender[i];
            }
         }
         /**
          * Иначе (т.е. это
          *  ... не объект (простой тип) или
          *  ... запрещено клонирование)
          *
          * Если к нам пришел null и запрещено им заменять - не копируем.
          */
         else if (!(hashExtender[i] === null && cfg.noOverrideByNull)) {
            hash[i] = hashExtender[i];
         }
      }

      if (typeof(hash) == 'object' && hash !== null && typeof(hashExtender) == "object" && hashExtender !== null) {
         for (var i in hashExtender) {
            if (hashExtender.hasOwnProperty(i)) {
               // Если индекса в исходном хэше нет и можно создавать
               if (hash[i] === undefined) {
                  if (cfg.create) {
                     if (hashExtender[i] === null) {
                        hash[i] = null;
                     } else {
                        cloneOrCopy(i);
                     }
                  }
               } else if (!cfg.preferSource) { // Индекс есть, исходное значение можно перебивать
                  if (hash[i] && typeof hash[i] == "object" && typeof hashExtender[i] == "object") {
                     // Объект в объект
                     if (hash[i] instanceof Date) {
                        if (hashExtender[i] instanceof Date) {
                           if (cfg.clone) {
                              hash[i] = new Date(+hashExtender[i]);
                           } else {
                              hash[i] = hashExtender[i];
                           }
                           continue;
                        } else {
                           // Исходный - дата, расщирение - нет. Сделаем пустышку в которую потом замержим новые данные
                           hash[i] = hashExtender[i] instanceof Array ? [] : {};
                        }
                     } else {
                        if (hashExtender[i] instanceof Date) {
                           if (cfg.clone) {
                              hash[i] = new Date(+hashExtender[i]);
                           } else {
                              hash[i] = hashExtender[i];
                           }
                           continue;
                        }
                     }

                     if (cfg.rec && (isMergeableObject(hashExtender[i]) || hashExtender[i] === null) && !Object.isEmpty(hash[i])) {
                        hash[i] = $ws.core.merge(hash[i], hashExtender[i], cfg);
                     } else {
                        hash[i] = hashExtender[i];
                     }
                  } else { // Перебиваем что-то в что-то другое...
                     cloneOrCopy(i);
                  }
               }
               /**
                * Исходное значение имеет приоритет, но разрешена рекурсия
                * Идем глубже.
                */
               else if (typeof hash[i] == "object" && typeof hashExtender[i] == "object" && cfg.rec) {
                  if (isMergeableObject(hashExtender[i]) || hashExtender[i] === null) {
                     hash[i] = $ws.core.merge(hash[i], hashExtender[i], cfg);
                  } else {
                     // Если это сложный объект мы ничего не делаем, т.к. сюда мы попадем только в том случае, если preferSource === true
                     // А значит нам нельзя здесь ничего перетирать
                  }
               }
            }
         }
      } else if (!(hashExtender === null && cfg.noOverrideByNull) && !cfg.preferSource) {
         hash = hashExtender;
      }

      return hash;
   },

   propertyMerge: function propertyMerge(source, target) {
      /**
       * При конструировании source это конфиг, переданный в new, target - this._options
       * Если есть _goUp это сконструированный класс ферймворка
       */
      for(var prop in source) {
         if (source.hasOwnProperty(prop)) {
            if (prop in target) {
               if (typeof source[prop] == 'object') {
                  if (toS.call(source[prop]) == '[object Object]' && source[prop]) {
                     if (!('_goUp' in source[prop])) {
                        if (toS.call(target[prop]) == '[object Object]' && target[prop]) {
                           if (!('_goUp' in target[prop])) {
                              $ws.core.propertyMerge(source[prop], target[prop]);
                           } else {
                              if ('isCustomType' in target[prop]) {
                                 target[prop].updateProperties(source[prop]);
                              } else {
                                 target[prop] = source[prop];
                              }
                           }
                        } else {
                           target[prop] = source[prop];
                        }
                     } else {
                        target[prop] = source[prop];
                     }
                  } else {
                     target[prop] = source[prop];
                  }
               } else if(toS.call(target[prop]) == '[object Object]' && target[prop] && ('isCustomType' in target[prop])) {
                  // Пропускаем параметр, ничего не присваиваем. Оставим дефолтное значение
                  // Просто любой CustomType может иметь несколько обязательныйх свойств
               } else {
                  target[prop] = source[prop];
               }
            } else {
               target[prop] = source[prop];
            }
         }
      }
   },

   /**
    * Функция, клонирующая объект или массив. Сделана на основе <strong>$ws.core.merge</strong>.
    * @param hash Исходный объект или массив.
    * @return {Object} Клонированный объект или массив.
    */
   clone: function(hash) {
      hash = {v: hash};
      var result = $ws.core.merge({}, hash, {clone: true});
      return result.v;
   },

   /**
    * Функция, делающая поверхностное (без клонирования вложенных объектов и массивов) копирование объекта или массива. Сделана на основе <strong>$ws.core.merge</strong>.
    * @param hash Исходный объект или массив.
    * @return {Object} Скопированный объект или массив.
    */
   shallowClone: function(hash) {
      var result;
      if ($ws.helpers.isPlainArray(hash)) {
         result = hash.slice(0);
      } else {
         result = $ws.core.merge({}, hash, {clone: false, rec: false});
      }
      return result;
   },

   initializerHelper: (function() {
      var storage = [];

      function replacer(k, v) {
         if (typeof v == 'function') {
            storage[storage.length] = v;
            if (v.prototype && v.prototype.isCustomType) {
               return 'CUSTOMTYPE(' + (storage.length - 1) + ')';
            } else {
               return 'FUNCTION(' + (storage.length - 1) + ')';
            }
         } else if (v === Infinity) {
            return "+INF";
         } else if (v === -Infinity) {
            return "-INF";
         } else if (!isNaN(Number(k)) && Number(k) >= 0 && v === undefined) {
            // В массивах позволяем передавать undefined
            return "UNDEF!";
         } else {
            return v;
         }
      }

      return {
         create: function createInitializer(extender) {
            var text = [ 'var compVal;' ];
            $ws.helpers.forEach(extender.$protected, function(v, k) {
               var isO = (v && typeof v == 'object' && v.constructor == Object);
               var stringified = JSON.stringify(v, replacer);
               if (stringified) {
                  stringified = stringified.replace(/"FUNCTION\((\d+)\)"/g, 'storage[$1]');
                  stringified = stringified.replace(/"CUSTOMTYPE\((\d+)\)"/g, 'new storage[$1]()');
                  stringified = stringified.replace(/"wsFuncDecl::([\w!:.\/]+)"/g, '$ws.helpers.getFuncFromDeclaration("$1")');
                  stringified = stringified.replace(/"\+INF"/g, 'Infinity');
                  stringified = stringified.replace(/"\-INF"/g, '-Infinity');
                  stringified = stringified.replace(/"UNDEF!"/g, 'undefined');
               }
               if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(k)) {
                  k = '["' + k + '"]';
               } else {
                  k = '.' + k;
               }
               if (isO) {
                  if (stringified == '{}' || stringified == '[]') {
                     text.push('this' + k + '= this' + k + ' || ' + stringified + ';');
                  } else {
                     text.push('compVal = ' + stringified + ';');
                     text.push('this' + k + ' !== undefined ? $ws.core.propertyMerge(compVal, this' + k + ') : this' + k + '= compVal;');
                  }
               } else {
                  text.push('this' + k + '=' + stringified + ';');
               }
            });
            return new Function('storage', text.join('\n'));
         },
         bind: function(base, extender, initializer) {
            extender._initializer = function() {
               if (base && base._initializer) {
                  base._initializer.call(this, storage);
               }
               initializer.call(this, storage);
            };
         }
      };
   })(),
   /**
    * Создание класса-наследника.
    *
    * @description
    * Класс-наследник описывается объектом.
    * В нем поддерживаются следующие элементы:
    *  - {Function} $constructor - Функция-конструктор нового класса.
    *  - {Object} $protected - объект-описание защищенных (protected) полей класса.
    *             Описывается как _ИмяПеременной : ЗначениеПоУмолчанию
    *  - {Function} любойМетод - методы класса.
    * Также функция extend доступна как член конструктора любого класса, полученного с помощью нее.
    * В этом случае первый аргумент не используется.
    * Пример:
    * <pre>
    *    // Наследуем SomeClass от Abstract
    *    $ws.proto.SomeClass = $ws.proto.Abstract.extend({
    *       $protected: {
    *          _myProtectedVar: 10,
    *          _myProtectedArray: []
    *       },
    *       $constructor: function(cfg){
    *          this._doInit(); // Call method
    *       },
    *       _doInit: function(){
    *          // do something
    *       },
    *       doSomethingPublic: function(){
    *          // do something public
    *       }
    *    });
    * </pre>
    *
    * @param {Function|Object} classPrototype Родительский класс.
    * @param {Array} mixinsList - массив объектов-миксинов
    * @param {Object} classExtender Объект-описание нового класса-наследника.
    * @returns {Function} Новый класс-наследник.
    */
   extend : (function() {

      function localExtend(mixinsList, classExtender){
         return $ws.core.extend(this, mixinsList, classExtender);
      }

      function localExtendPlugin(pluginConfig){
         return $ws.core.extendPlugin(this, pluginConfig);
      }

      function localMixin(mixinConfig){
         return $ws.core.mixin(this, mixinConfig);
      }

      function mergePropertiesToPrototype(classResult, classExtender) {
         // Copy all properties to a newly created prototype
         for (var i in classExtender){
            if (classExtender.hasOwnProperty(i) && i.charAt(0) != '$') {
               classResult.prototype[i] = classExtender[i];
            }
         }
         // fix for the best browser in the world (IE) (c) ErshovKA
         // IE 7-8 не видит при переборе через for-in свойства valueOf и toString
         if(!$ws._const.browser.isModernIE) {
            var props = [ 'valueOf', 'toString' ];
            for(i = 0; i < props.length; i++) {
               if(classExtender.hasOwnProperty(props[i])) // property is redefined
                  classResult.prototype[props[i]] = classExtender[props[i]]
            }
         }
      }

      function createInitializer(base, extender) {
         var helper = $ws.core.initializerHelper;
         helper.bind(base, extender, helper.create(extender));
      }


      return function extend(classPrototype, mixinsList, classExtender){
         if (Object.prototype.toString.call(mixinsList) === '[object Array]') {
            classPrototype = $ws.core.mixin(classPrototype, mixinsList);
         }
         else {
            classExtender = mixinsList;
         }

         if (classExtender && '_options' in classExtender) {
            throw new Error('Ошибка в определении класса: секция _options в наследнике должна быть внутри секции $protected, а не в корне');
         }

         var
            parentCtor = classPrototype.prototype && classPrototype.prototype.$constructor || null,
            childCtor = classExtender.$constructor,
            constructor = function(){},
            classResult;

         classResult = classExtender.$constructor = function constructFn(cfg){

            this._goUp = this._goUp || 1;

            /**
             * Пойдем к родительской функции-обертке, если она есть
             * Ее нет, если мы на вершине иерархии.
             */
            if (parentCtor) {
               this._goUp++;
               parentCtor.call(this, cfg);
            } else {
               this._initializer();
               if (cfg) {
                  $ws.core.propertyMerge(cfg = $ws.helpers.parseMarkup(cfg), this._options = this._options || {});
               }
            }

            /**
             * Вызов собственного конструктора
             */
            if (childCtor) {
               /**
                * Это честная возможность вернуть из конструктора класса что-то иное...
                */
               var r = childCtor.call(this, cfg);
               if(r)
                  return r;
            }

            --this._goUp;

            if(this._goUp === 0) {
               this.init && this.init();
               this._initComplete && this._initComplete();
               this._isInitialized = true;
               this._allowEvents && this._allowEvents();
               this._constructionDone && this._constructionDone();
            }

            return undefined;
         };

         constructor.prototype = classPrototype.prototype;
         classResult.prototype = new constructor();

         createInitializer(classPrototype.prototype, classExtender);
         mergePropertiesToPrototype(classResult, classExtender);
         if (classExtender.destroy &&
             'isDestroyed' in classResult.prototype &&
              typeof classResult.prototype.isDestroyed === 'function')
         {
            classResult.prototype.destroy = $ws.helpers.forAliveOnly(classExtender.destroy);
         }

         classResult.prototype.$constructor = classExtender.$constructor;

         classResult.extend = localExtend;
         classResult.extendPlugin = localExtendPlugin;
         classResult.mixin = localMixin;
         classResult.superclass = classPrototype.prototype;

         return classResult;
      }

   })(),
   /**
    * Расширение класса с помощью "плагина"
    * Подробное описание см. в файле EXTENDING.md
    *
    * @param {Function} classPrototype Прототип расширяемого класса
    * @param {Object} pluginConfig "Конфигурация" плагина
    */
   extendPlugin: function(classPrototype, pluginConfig){
      if(!Object.isEmpty(pluginConfig.$protected)) {
         var initializer = $ws.core.initializerHelper.create(pluginConfig);
         classPrototype.prototype._initializer = classPrototype.prototype._initializer.callNext(initializer);
      }

      pluginConfig.$withoutCondition = $ws.core.hash(pluginConfig.$withoutCondition || []);
      function callNext(classMethod, pluginFunction) {
         var classFunction;
         if (classPrototype.prototype.hasOwnProperty(classMethod)) {
            classFunction = classPrototype.prototype[classMethod];
         } else if(classPrototype.superclass) {
            classFunction = function() {
               var superClassFunction = classPrototype.superclass[classMethod];
               if (superClassFunction) {
                  return superClassFunction.apply(this, arguments);
               }
            };
         }
         if (classFunction) {
            // Делаем исключение для метода destroy, сначала вызовем метод плагина
            var method = classMethod === 'destroy' ? 'callBefore' : 'callNext';
            if (pluginConfig.$condition && pluginConfig.$withoutCondition[classMethod] === undefined) {
               classPrototype.prototype[classMethod] = classFunction[method + 'WithCondition'](pluginFunction, pluginConfig.$condition);
            } else {
               classPrototype.prototype[classMethod] = classFunction[method](pluginFunction);
            }
         }
      }

      function addPluginFunction(functionName, pluginFunction) {
         if (classPrototype.prototype[functionName]) {
            callNext(functionName, pluginFunction);
         } else if (pluginConfig.$condition) {
            classPrototype.prototype[functionName] = pluginConfig.$withoutCondition[functionName] === undefined ?
               pluginFunction.callIf(pluginConfig.$condition) :
               pluginFunction;
         } else {
            classPrototype.prototype[functionName] = pluginFunction;
         }
      }

      for (var i in pluginConfig) {
         if (pluginConfig.hasOwnProperty(i) && !(i in {'$constructor': true, '$protected': true, 'init': true, '$condition': true, '$withoutCondition': true})) {
            addPluginFunction(i, pluginConfig[i]);
         }
      }
      // IE 7-8 не видит при переборе через for-in свойства valueOf и toString
      if (!$ws._const.browser.isModernIE) {
         var props = [ 'valueOf', 'toString' ];
         for (i = 0; i < props.length; i++) {
            if (pluginConfig.hasOwnProperty(props[i])) {
               // property is redefined
               addPluginFunction(props[i], pluginConfig[props[i]]);
            }
         }
      }

      if (pluginConfig.$constructor) {
         callNext('init', pluginConfig.$constructor);
         if ($ws.single.ControlStorage) {
            var pluginConstructor = pluginConfig.$constructor,
                controls = $ws.single.ControlStorage.getControls();
            for (var id in controls) {
               if (controls.hasOwnProperty(id)) {
                  if (controls[id] instanceof classPrototype){
                     pluginConstructor.apply(controls[id]);
                  }
               }
            }
         }
      }
   },
   /**
    * Расширение класса с помощью "mixin'а"
    *
    *
    * @param {Function} classPrototype Прототип расширяемого класса
    * @param {Object|Array} mixinConfig "Конфигурация" примеси, или массив описаний нескольких примесей
    * В случае массива будут подмешаны в том порядке, в котором перечислены.
    */
   mixin: function(classPrototype, mixinConfig){
      if(mixinConfig && Object.prototype.toString.call(mixinConfig) === '[object Object]'){
         mixinConfig = [mixinConfig];
      }
      var mixinOptions = {},
          mixinConstructor,
          l = mixinConfig.length, i,
          description = {},
          functionCollection,
          callMethod = {
             'around': 'callAround',
             'after': 'callNext',
             'before': 'callBefore'
          };
      for(i = 0; i < l; i++){
         description = mixinConfig[i];
         if (description.$protected) {
            mixinOptions = $ws.core.merge(mixinOptions, description.$protected);
         }
         if (description.$constructor) {
            mixinConstructor = mixinConstructor ? mixinConstructor.callNext(description.$constructor) : description.$constructor;
         }
      }
      var mixin = $ws.core.extend(classPrototype, {
            $protected: mixinOptions,
            $constructor: mixinConstructor || function(){}
         });

      function addSpecialFunctionInIE(descriptionObject, position){
         // IE 7-8 не видит при переборе через for-in свойства valueOf и toString
         if(!$ws._const.browser.isModernIE) {
            var props = [ 'valueOf', 'toString' ];
            for(k = 0; k < props.length; k++) {
               if(descriptionObject.hasOwnProperty(props[k]) && !(props[k] in {'$protected': 0, '$constructor': 0})) {
                  addMixinFunction(props[k], descriptionObject[props[k]], position);
               }
            }
         }
      }

      function addMixinFunction(functionName, functionDescription, functionPosition){
         if( typeof(functionDescription) === 'function'){
            //проверим определена ли уже функция в классе, иначе добавим
            if ( functionPosition === 'instead' || typeof(mixin.prototype[functionName]) !== 'function') {
               mixin.prototype[functionName] = functionDescription;
            } else {
               var newFunction = mixin.prototype[functionName][callMethod[functionPosition]](functionDescription);
               mixin.prototype[functionName] = newFunction;
            }
         }
      }

      for(i = 0; i < l; i++){
         description = mixinConfig[i];
         for(var k in description){
            if(!( k in {'$protected': 0, '$constructor': 0} )){
               functionCollection = description[k];
               if (functionCollection && Object.prototype.toString.call(functionCollection) === '[object Object]'){
                  for(var j in functionCollection){
                     addMixinFunction(j, functionCollection[j], k);
                  }
                  addSpecialFunctionInIE(functionCollection, k);
               } else {
                  addMixinFunction(k, functionCollection, 'instead');
               }
            }
         }
         addSpecialFunctionInIE(description, 'instead');
      }

      mixin.prototype._mixins = (mixin.prototype._mixins || []).concat(mixinConfig);

      return mixin;
   },
   /**
    * Генерация хэша переданных параметров/объекта.
    */
   hash : function(){
      var
         src = arguments.length > 1 ? Array.prototype.slice.call(arguments) : arguments[0],
         dst = {};
      if (src instanceof Array || src instanceof Object){
         for (var i in src){
            if (src.hasOwnProperty(i)){
               if (typeof src[i] in {"boolean":null, "number":null, "string":null})
                  dst["" + src[i]] = i;
            }
         }
      }
      return dst;
   },
   /**
    * Функция разбивает путь на класс и компонент
    * @param path
    * @returns {{component: *, className: *, moduleName: *, isModule: *}}
    */
   extractComponentPath : function(path){
      var className, modName;
      path = $ws.single.ClassMapper.getClassMapping(path);

      if(path.indexOf(':') == -1){
         path = path.split('/');
         path.push(className = path.pop());
         if(className.indexOf('@') != -1)
            className = className.split('@').pop();
      }
      else{
         path = path.split(':');
         className = path.pop();
         path = path.pop().split('/');
      }

      modName = $ws._const.jsCoreModules[className] ? className :  ($ws._const.jsModules[className] ? className : "SBIS3.CORE." + className);

      return {
         component: path.join('/'),
         className: className,
         moduleName: modName,
         isModule: !!($ws._const.jsCoreModules[modName] || $ws._const.jsModules[modName])
      };
   },

   /**
    * Загружает контролы и их зависимости по массиву конфигов контролов.
    * @param configsPaths Массив путей и конфигов для контролов. Пример:
    * <pre>
    *    [
    *       ['Control/DataViewAbstract/TableView', {config}],
    *       ['Control/DataViewAbstract/TreeView', {config}] ....
    *    ]
    * </pre>
    * @param resolveCtors Ожидается ли возвращение конструкторов модулями указанных контролов. Если
    * ожидается, то функция будет проверять значения, возвращённые модулями, и кидать исключения, если те не похожи на конструкторы.
    * @returns {$ws.proto.Deferred}
    */
   loadControlsDependencies: function(configsPaths, resolveCtors) {
      var loadedPaths = {},
          global = (function() { return this || (0,eval)('this') })(),
          reduce = $ws.helpers.reduce.bind($ws.helpers),
          map = $ws.helpers.map.bind($ws.helpers),
          jsModRegex = /js!/;

      function loaderForPath(path, resolveCtor) {
         var result;

         if (jsModRegex.test(path)){
            result = function() {
               return $ws.require([path]).addCallback(function(mod) {
                  return [path, mod[0]];
               });
            };
         } else {
            result = function() {
               var requestedPath = $ws.core.extractComponentPath(path),
                   loadAsModule = requestedPath.isModule,
                   moduleName = requestedPath.moduleName,
                   componentName = requestedPath.className,
                   loadDfr = loadAsModule ? $ws.require("js!" + moduleName) : $ws.core.attachComponent(requestedPath.component);

               loadDfr.addCallback(function(mod){
                  var ctor = loadAsModule ? mod[0] : null;
                  if (!ctor && resolveCtor) {
                     // Шаг 3: Построим запрошенный класс
                     ctor = $ws.proto;
                     if(componentName.indexOf('.') != -1) {
                        var classPath = componentName.split('.');
                        while(classPath.length && ctor) {
                           ctor = ctor[classPath.shift()];
                        }
                     } else {
                        ctor = ctor[componentName];
                     }
                  }

                  return [path, ctor];
               });

               return loadDfr;
            };
         }

         return result;
      }

      function getPathLoadersPDef(configsPaths, needCtors) {
         return reduce(configsPaths, function(pDef, cfgPath) {
            var path_ = cfgPath[0], path, loader;

            if (!(path_ in loadedPaths)) {
               loadedPaths[path_] = true;
               loader = loaderForPath(path_, needCtors);
               pDef.push(loader());
            }

            return pDef;
         }, new $ws.proto.ParallelDeferred()).done().getResult();
      }

      function resolveDepsAsControlConfigs(configsPaths) {
         return reduce(configsPaths, function(result, cfgPath) {
            var path = cfgPath[0],
                cfg = cfgPath[1],
                requestedPath, loadAsModule, moduleName, componentName, depPath, deps;

            if(!jsModRegex.test(path)) {
               requestedPath = $ws.core.extractComponentPath(path);
               loadAsModule = requestedPath.isModule;
               moduleName = requestedPath.moduleName;

               depPath = loadAsModule ? moduleName : path;
               deps = $ws.single.DependencyResolver.resolve(depPath, cfg);
               $ws.helpers.forEach(deps, function(dep) {
                  result.push([dep, cfg]);
               });
            }
            return result;
         }, []);
      }

      function constructorsForAllConfigs(configsPaths, pathsConstructors) {
         var hash = reduce(pathsConstructors, function(result, pathConstr) {
            result[pathConstr[0]] = pathConstr[1];
            return result;
         }, {});

         return map(configsPaths, function(cfgPath) {
            var path = cfgPath[0],
                ctor = hash[path];

            if (resolveCtors && typeof ctor !== 'function' ) {
                throw new Error("Can't instantiate class '" + path + "'. Class not exists");
            }

            return ctor;
         });
      }

      function loadPaths(configsPaths, resolveCtors) {
         var loadersPDef = getPathLoadersPDef(configsPaths, resolveCtors);

         return loadersPDef.addCallback(function(pathsConstructors) {
            var depConfigs = resolveDepsAsControlConfigs(configsPaths),
                result;

            if (depConfigs.length > 0) {
               result = loadPaths(depConfigs, false).addCallback(function() { return pathsConstructors; });
            } else {
               result = pathsConstructors;
            }
            return result;
         });
      }

      return loadPaths(configsPaths, resolveCtors).addCallback(constructorsForAllConfigs.bind(undefined, configsPaths));
   },

   /**
    * Загружает зависимости компонента (его модули, и дополнительные модули, требуемые по его конфигурации), и отдаёт
    * deferred, который по готовности выдаёт функцию, конструирующую компонент, и берущую конфиг в качестве аргумента (как его конструктор).
    * Эта функция нужна для случая, когда хочется загрузить зависимости для нескольких компонентов зараз, и потом создать их синхронно,
    * предварительно проверив, не удалился во время загрузки зависимостей родительский контрол.
    * @param {string} path путь компонента и имя класса
    *    /path/to/component:className
    *    /path/to/component - путь к файлу с компонентом
    *    className - имя класса, который надо инстанцировать
    * @param {object} cfg конфиг
    * @returns {$ws.proto.Deferred}
    * @deprecated Используйте {$ws.core.loadControlsDependencies}. Удалено в 3.8.0
    */
   loadAttachInstanceDependencies: function(path, cfg){
      return this.loadControlsDependencies([ [ path, cfg ] ], true).addCallback(function(ctors){
         return function(cfg) {
            return new ctors[0](cfg);
         }
      })
   },

   /**
    * Метод построения компонента
    *
    * @description
    * Пример использования:
    * <pre class="brush: js">
    * var iDef = $ws.core.attachInstance('Control/Field:FieldAbstract', {});
    * iDef.addCallback(function(inst) {
    *    alert("ints instanceOf FieldAbstract: " + (inst instanceof $ws.proto.FieldAbstract).toString());
    *    return inst;
    * }).addErrback(function(e) {
    *    alert(e.message);
    *    return e;
    * });
    * </pre>
    *
    * @param {string} path путь компонента и имя класса
    *    /path/to/component:className
    *    /path/to/component - путь к файлу с компонентом
    *    className - имя класса, который надо инстанцировать
    * @param {object} [cfg] конфиг
    * @returns {$ws.proto.Deferred} Асинхронный результат
    */
   attachInstance : function(path, cfg){
      var
         deps = $ws.core.loadControlsDependencies([[path, cfg]], true),
         block = BOOMR.plugins.WS.startBlock('attachInstance:' + path);
      return deps.addCallback(function(ctor) {
         block.openSyncBlock();
         var result = new ctor[0](cfg);
         block.closeSyncBlock();
         block.close();
         return result;
      });
   },
   /**
    * Подключение цепочки компонентов.
    *
    * @param {String} path Компонент
    * @param {String} [servicePath] Путь к сервису, с которого загружать файлы.
    * @returns {$ws.proto.Deferred}
    */
   attachComponent: function(path, servicePath){
      var resourceRoot,
          global = (function() { return this || (0,eval)('this') })();

      if(!servicePath){
         servicePath = '';
         resourceRoot = $ws._const.resourceRoot;
      }
      else
         resourceRoot = '/';
      /**
       * Это - Deferred для всей цепочки. Его успех зависит от выполнения CodeChain
       */
      return $ws.single.Storage.store(path, function(dChainResult){

         // Костыль
         // Если мы на node (есть process) или в браузере (есть window) - грузим через require
         // На серверном скрипте (нет window и нет process) - работаем по старому.
         if ((typeof window !== 'undefined' || typeof process !== 'undefined') && path === 'Source') {
            global.requirejs(['Lib/Source'], function () {
               dChainResult.callback();
            }, function(){
               dChainResult.errback();
            });
            return;
         }

         var
            queue = path.split("/"),
            codeChain = new $ws.proto.CodeChain(queue.length),
            i = queue.length - 1;
         // строим цепочку вложенных подключений скриптов компонентов
         while (queue.length > 0){
            (function(componentPath, index){
               var libPath,
                   fileUrl;
               if(componentPath.indexOf('@') != -1)
               {
                  componentPath = componentPath.split('@');
                  var module = componentPath.shift();

                  // если модуля нет в списке подключенных модулей,
                  // то, значит, мы подключаем модули на сервере, и в таком случае
                  // транслитерация не нужна
                  if(module in $ws._const.modules)
                     module = $ws._const.modules[module];

                  libPath = servicePath + resourceRoot + module + "/";
               }
               else
                  libPath = servicePath + $ws._const.wsRoot;
               fileUrl = $ws.core.checkPackages(libPath + 'lib/' + componentPath + '.js');
               var wasStored = $ws.single.Storage.isStored(fileUrl);
               /**
                * Это - Deferred для единичного файла цепочки. Его успех зависит от XHR
                * @param {$ws.proto.Deferred} dSingleFileResult
                */
               $ws.single.Storage.store(fileUrl, function(dSingleFileResult){
                  // Этот код должен выполниться только один раз (грузим из сети единожды) ...
                  dSingleFileResult.dependOn(
                     $ws.single.ioc.resolve('ITransport', {
                        url: $ws.core.urlWithHost(fileUrl)
                     }).execute(null)
                  );
               }).addCallback(function(code){
                  /**
                   * ... а этот должен выполняться кажый раз при подключении данного файла
                   * Потому что здесь codeChain и она должна знать, что все компоненты готовы.
                   *
                   * Если данный файл был загружен ранее - не добавляем его код в CodeChain,
                   * просто известим что он готов.
                   */
                  if (codeChain.setCode(index, wasStored ? '' : code))
                     dChainResult.callback(); // Цепочка выполнена
                  // Меняем результат на пустую строку
                  // при следующей загрузке CodeChain посчитает что этот код уже готов к работе
                  return '';
               }).addErrback(function(e){
                  // Построение завершилось ошибкой
                  if (!dChainResult.isReady()) {
                     dChainResult.errback(new Error("Building failed. Reason: " + e.message + ". Component: " + path + ". File: " + fileUrl));
                  }
                  return e;
               });
            })(queue.join('/'), i--);
            queue.pop();
         }
         return dChainResult;
      });
   },
   /**
    * Получает описание переданного имени хэндлера
    *
    * @param {String} name
    * @returns {Object}
    */
   getHandlerInfo: function(name) {
      var
         firstChar = name.substring(0, 1),
         pathParts = name.split('/'),
         handlerName = pathParts.pop(),
         handlerPackage = pathParts.pop(),
         base = (firstChar == '.' || firstChar == '/') ? '' : ($ws._const.wsRoot + 'res/hdl/'),
         ext = '.hdl',
         isModule = false,
         packageUniqName, type, fullPath;

      type = pathParts.pop();  // some kind of peek()
      if(type || type === "")  // if type is not null | undefined
         pathParts.push(type); // return it to path
      if(type != 'render')     // If it is not render
         type = "_handlers";   // ...set default handlers type

      if(handlerPackage in $ws._const.jsCoreModules || handlerPackage in $ws._const.jsModules) {

         pathParts.push($ws._const.jsCoreModules[handlerPackage] || $ws._const.jsModules[handlerPackage]);
         if($ws._const.jsModules[handlerPackage]) {
            base = '/resources/';
         } else {
            base = $ws._const.wsRoot;
         }
         packageUniqName = fullPath = handlerPackage;
         isModule = true;
      } else {
         pathParts.push(handlerPackage + ext);
         packageUniqName = base + pathParts.join('/');
         pathParts.pop();

         pathParts.push(handlerPackage + ext);
         fullPath = base + pathParts.join('/');
      }


      if (packageUniqName.indexOf('/resources/') === 0)
         packageUniqName = packageUniqName.replace('/resources/', $ws._const.resourceRoot);
      if(fullPath.indexOf('/resources/') === 0)
         fullPath = fullPath.replace('/resources/', $ws._const.resourceRoot);
      if(ext && $ws._const.buildnumber && fullPath.indexOf(".v" + $ws._const.buildnumber) == -1)
         fullPath = fullPath.replace(ext, '.v' + $ws._const.buildnumber + ext);

      return {
         type: type,
         name: handlerName,
         'package': packageUniqName,
         url: fullPath,
         isModule: isModule
      };
   },
   /**
    * Загружает пакет, возвращает его через Deferred
    *
    * @param {String} name.
    * @returns {$ws.proto.Deferred} асинхронный результат загрузки пакета.
    */
   getHandlerPackage: function(name) {
      var
            urlSpec = $ws.core.getHandlerInfo(name),
            url = urlSpec.url;

      return $ws.single.Storage.store("hdlpack://" + url, function(dResult){
         (function(){
            if(urlSpec.isModule) {
               return $ws.requireModule(url).addCallback(function(mods){
                  return mods[0];
               });
            } else {
               return $ws.single.ioc.resolve('ITransport', {  // начинаем загрузку
                  url: url
               }).execute(null).addCallback(function(data) {
                  var hdl = null;
                  // Добавим sourceURL для нормальных браузеров
                  // TODO Это устаревший стандарт!
                  if(!$ws._const.browser.isIE){
                     var sourceURL = url.substr(url.lastIndexOf('/') + 1);
                     data += "\n//# sourceURL=" + sourceURL;
                     if(data.indexOf('//@ sourceURL') !== -1){
                        data = data.replace(/\/\/@ sourceURL[^\n]+/, "");//replace "
                     }
                     data += "\n//@ sourceURL=" + sourceURL;
                  }
                  eval(data);                   // эвалим полученный код
                  return hdl;
               });
            }
         }()).addCallbacks(function(hdl){
            for(var f in hdl) {
               if(hdl.hasOwnProperty(f) && typeof hdl[f] == 'function')
                  hdl[f].wsHandlerPath = urlSpec['package'].replace('.hdl', '') + '/' + f;
            }
            $ws[urlSpec.type][urlSpec['package']] = hdl;
            dResult.callback(hdl);
         }, function(res){
            res.message = "getHandler failed (" + name + "). Reason: " + res.message;
            dResult.errback(res);
         });
      });
   },
   /**
    * Загружает и получает указанную функцию-обработчик
    *
    * @param {String} name Имя обработчика в формате HandlerPackage/handlerName.
    * @returns {$ws.proto.Deferred} Deferred, результатом которого будет заказанный обработчик.
    */
   getHandler: function(name){

      var
         urlTemp = $ws.core.getHandlerInfo(name),
         type = urlTemp.type,
         dResult = new $ws.proto.Deferred(),
         handlerName = urlTemp.name,
         handlerPackage = urlTemp['package'],
         funcCheckHandler = function(type, pkgName, hdlName){
            return $ws[type][pkgName] && typeof($ws[type][pkgName][hdlName]) == 'function';
         };

      // есть ли информация о наличии указанного пакета
      if(typeof($ws[type][handlerPackage]) == 'object'){
         if (funcCheckHandler(type, handlerPackage, handlerName))
            dResult.callback($ws[type][handlerPackage][handlerName]);
         else
            dResult.errback(
                  new Error("getHandler failed: package is loaded but function is not present (" + name + ")"));
      }
      else {                                 // загрузка пакета
         $ws[type][handlerPackage] = '';     // система знает о наличии такого обработчика
         dResult.dependOn($ws.core.getHandlerPackage(name)).addCallback(function(){
            if (funcCheckHandler(type, handlerPackage, handlerName))
               return $ws[type][handlerPackage][handlerName];
            else
               throw new Error("getHandler failed: package is loaded but function is not present (" + name + ")");
         });
      }
      return dResult;
   },
   /**
    * Проверяет, имеется ли для файла альтернативный URL
    *
    * @param {String} url исходный URL файла.
    * @returns {String} альтернативный URL для файла (с учетом пакета).
    */
   checkPackages : function(url){
      var shortUrl = url.replace($ws._const.wsRoot, '/');
      var packages = $ws._const.jsPackages;
      return packages[shortUrl] ? ($ws._const.wsRoot + packages[shortUrl]) : url;
   },
   /**
    * Возвращает случайный хост из списка хостов
    *
    * @param {String} url
    * @returns {String} адрес хоста
    */
   urlWithHost: function(url) {
      var l = $ws._const.hosts.length,
          host = '',
          lang = $ws.single.i18n.getLang();
      if (l > 0) {
         host = $ws._const.hosts[Math.floor(Math.random()*l)];
         if (url.substring(0, 1) == '.') {
            var curPath = window.location.pathname;
            curPath = curPath.substring(0, curPath.lastIndexOf('/') + 1);
            url = host + curPath + url.substring(2);
         } else {
            url = host + (url.substring(0, 1) == '/' ? '' : '/') + url;
         }
      }
      if ($ws._const.buildnumber && url.indexOf(".v" + $ws._const.buildnumber) == -1) {
         url = url.replace(/(\.js|\.css|\.xml)/, ".v" + $ws._const.buildnumber + "$1");
      }
      if ($ws._const.i18n && lang && url.indexOf(".l" + lang) == -1) {
         url = url.replace(/(\.xml)/, ".l" + lang + "$1");
      }
      return url;
   },
   /**
    * @function
    * Подключение JS/CSS-файла в контекст документа.
    * @param {String} URL URL подключаемого файла.
    * @param {Object} [options] Опциональные опции. Например options.charset - значение аттрибута charset при подключении (для IE7).
    * @returns {$ws.proto.Deferred}
    */
   attach: function(URL, options){
      URL = $ws.core.checkPackages(URL);
      if(URL.charAt(0) !== '/'){
         URL = $ws._const.wsRoot + URL;
      }
      URL = $ws.core.urlWithHost(URL);
      return $ws.single.Storage.store(URL, function(resource){
         $ws.single.ioc.resolve('IAttachLoader').attach(URL, resource, options);
      });
   },
   /**
    * Подключает переданные файлы по порядку
    * @param {Array} urls Массив строк с адресами файлов для подключения.
    * @return {$ws.proto.Deferred}
    */
   attachSequentally: function(urls) {
      urls = urls || [];
      urls = urls instanceof Array ? urls : [ urls ];
      urls = $ws.helpers.filter(urls);

      var dResult = new $ws.proto.Deferred();

      (function loader() {
         if (urls.length) {
            var url = urls.shift();
            if (/^(js!|css!)/.test(url)) {
               $ws.require(url).addCallbacks(loader, function (e) {
                  dResult.errback(e);
               });
            } else {
               $ws.core.attach(url).addCallbacks(loader, function (e) {
                  dResult.errback(e);
               });
            }
         } else
            dResult.callback();
      })();

      return dResult;
   },
   /**
    * Готовит ядро к работе с указанными компонентами.
    * Фактически замена $ws.core.ready + attachComponent * N.
    * @returns {$ws.proto.Deferred} Deferred готовности ядра + готовности всех компонентов.
    */
   withComponents: function(/*components*/) {
      var components = arguments;
      return $ws.core.ready.addCallback(function(){
         var dComponents = new $ws.proto.ParallelDeferred();
         for (var i = 0, li = components.length; i < li; i++){
            var requestedPath = $ws.core.extractComponentPath(components[i]),
                componentName = requestedPath.className,
                moduleName = $ws._const.jsCoreModules[componentName] ? componentName : "SBIS3.CORE." + componentName;
            (function(moduleName){
               if($ws._const.jsCoreModules[moduleName])
                  dComponents.push($ws.require("js!" + moduleName).createDependent().addCallback( function(){
                     return $ws.core.loadControlsDependencies([[moduleName, {}]], false);
                  }));
               else
                  dComponents.push($ws.core.attachComponent(components[i]));
            })(moduleName);
         }
         return dComponents.done().getResult();
      })
   },
   /**
    * Вызывает диалог-сообщение
    * @param {String} message - текст сообщения.
    * @param {String} [detail] - текст-расшифровка.
    * @param {String} [type] - тип сообщения (info || error || success), по умолчанию "info".
    */
   alert: function(message, detail, type) {
      var
         defOnClose = new $ws.proto.Deferred(),
         types = {"error":0, "success":0, "info":0},
         windowManager = $ws.single.WindowManager;
      if (arguments.length == 2 && detail in types){
         type = detail;
         detail = "";
      }
      $ws.core.attachInstance('SBIS3.CORE.DialogAlert', {
         message: message,
         opener: windowManager && windowManager.getActiveWindow(),
         detail: detail,
         type : type,
         handlers : {
            onAfterClose : function(){
               defOnClose.callback();
            }
         }
      }).addErrback(function(err) {
         $ws.single.ioc.resolve('ILogger').log('$ws.core.alert', err.message);

         message = $ws.helpers.htmlToText(message);
         detail = $ws.helpers.htmlToText(detail);

         alert(message + '\n\n' + detail);//Если не удалось создать диалог, показываем простой браузерный алёрт
      });
      return defOnClose;
   },
   getNamedContents: function(name) {
      var isPath = name.lastIndexOf('/');
      if(isPath != -1)
         name = name.substring(isPath + 1);
      return $ws._const.hdlBindings[name] || [];
   },
   /**
    * Устанавливает курсор загрузки или стандартный
    * @param {Boolean} def -- ставить ли стандартный курсор.
    */
   setCursor: function(def){
      $('body').toggleClass('ws-progress', !def);
   },
   /**
    * Возвращает URL сервиса по имени
    * @param {String} serviceName имя сервиса (как указано на 4 шаге мастера выгрузки).
    * @returns {String} URL сервиса.
    */
   getServiceByName: function(serviceName) {
      return $ws._const.services[serviceName] || $ws._const.defaultServiceUrl;
   },
   /**
    * Прописывает оглавление
    * @param {Object} contents.
    * @param {Boolean} [replace] заменять ли содержимое.
    * @param {Object} [options] опции для указания пути до service (/, /auth/ etc.) и resources (resources, myresources etc.).
    */
   loadContents: function(contents, replace, options) {
      if (replace) {
         $ws._const.hosts = [];
         $ws._const.jsPackages = {};
         $ws._const.xmlPackages = {};
         $ws._const.xmlContents = {};
         $ws._const.hdlBindings = {};
         $ws._const.services = {};
         $ws._const.modules = {};
         $ws._const.htmlNames = {};
         $ws._const.jsModules = {};
         //$ws._const.dictionary = {};
         $ws._const.availableLanguage = {};
      }

      // Формируем options
      options = options || {};
      options.service = removeLeadingSlash(removeTrailingSlash(options.service || '/'));
      options.resources = removeLeadingSlash(removeTrailingSlash(options.resources || 'resources'));

      function removeLeadingSlash(path) {
         if (path) {
            var head = path.charAt(0);
            if (head == '/' || head == '\\') {
               path = path.substr(1);
            }
         }
         return path;
      }

      function removeTrailingSlash(path) {
         if (path) {
            var tail = path.substr(-1);
            if (tail == '/' || tail == '\\') {
               path = path.substr(0, path.length - 1);
            }
         }
         return path;
      }

      function resolvePath(path, obj) {
         $ws.helpers.forEach(obj, function(val, key) {
            obj[key] = path + '/' + removeLeadingSlash(val);
         });
      }

      function pathjoin(path1, path2) {
         if (path1 !== '') {
            var head = path1.charAt(0);
            if (head != '/' && head != '\\' && path1.charAt(1) !== ':') {
               path1 = '/' + path1;
            }
         }
         if (!path1 && /[a-z]+:\/{2}/i.test(path2)) {
            return path2;
         } else {
            return path1 + '/' + path2;
         }
      }

      if (contents) {
         var path = pathjoin(options.service, options.resources);

         //Перестраиваем пути в оглавлении, с учетом options
         if (contents.jsModules) {
            resolvePath(path, contents.jsModules);
         }

         if (contents.xmlContents) {
            resolvePath(path, contents.xmlContents);
         }

         $ws._const = $ws.core.merge($ws._const, contents);
      }
   },
   _initRequireJS: function() {
      this.initRequireJS();
   },
   initRequireJS: function(){
      var
            global = (function() { return this || (0,eval)('this') })(),
            wsPath = $ws._const.wsRoot;

      // TODO СРОЧО ЭТО ВЫПИЛИТЬ! КОНФИГ ДУБЛИРУЕТСЯ!
      global.requirejs.config({
         baseUrl: "/",
         paths: {
            "Ext": wsPath + "lib/Ext",
            "Core": wsPath + "core",
            'Resources': $ws._const.resourceRoot,
            "css": wsPath + "ext/requirejs/plugins/css",
            "js": wsPath + "ext/requirejs/plugins/js",
            "native-css": wsPath + "ext/requirejs/plugins/native-css",
            "normalize": wsPath + "ext/requirejs/plugins/normalize",
            "html": wsPath + "ext/requirejs/plugins/html",
            "tmpl": wsPath + "ext/requirejs/plugins/tmpl",
            "text": wsPath + "ext/requirejs/plugins/text",
            "is": wsPath + "ext/requirejs/plugins/is",
            "is-api": wsPath + "ext/requirejs/plugins/is-api",
            "i18n": wsPath + "ext/requirejs/plugins/i18n",
            "json": wsPath + "ext/requirejs/plugins/json"
         },
         waitSeconds: 30,
         nodeRequire: global.require
      });
   },
   /**
    * Классическое наследование на классах
    * @param Child - класс-наследник.
    * @param Parent - класс-родитель.
    */
   classicExtend : function(Child, Parent) {
      var F = function() { };
      F.prototype = Parent.prototype;
      Child.prototype = new F();
      Child.prototype.constructor = Child;
      Child.superclass = Parent.prototype
   },
   /**
    * @param {Function} func
    * @deprecated Используйте $ws.single.EventBus.channel('errors').subscribe('onAuthError', ...); Удаляется с 3.8
    */
   appendAuthError : function(func){
      if (typeof func == "function")
         $ws.core._authError = func;
   }
};

$ws.single.ClassMapper = {
   _mapping: {},
   setClassMapping: function(classSpec, mapTo) {
      if(typeof classSpec == 'string')
         this._mapping[classSpec] = mapTo;
      else if(classSpec !== null && Object.isValid(classSpec)) {
         for(var spec in classSpec) {
            if(classSpec.hasOwnProperty(spec))
               this._mapping[spec] = classSpec[spec];
         }
      }
   },
   getClassMapping: function(classSpec) {
      return this._mapping[classSpec] || classSpec;
   },
   resetClassMapping: function(classSpec) {
      delete this._mapping[classSpec];
   },
   restoreDefaultClassMapping: function() {
      this._mapping = {};
   }
};
/**
 * Класс вспомогательных функций
 * @class $ws.helpers
 * @public
 */
$ws.helpers = /** @lends $ws.helpers.prototype */{
   /**
    * Функция, позволяющая сгенерировать URL для открытия страницы редактирования/создания записи
    *
    * @param recordId Идентификатор записи
    * @param {Boolean} isBranch узел или лист
    * @param {Number} parentId идентификатор родителя отображаемой записи
    * @param {Boolean} isCopy копирование
    * @param {String} editDialogTemplate имя шаблона диалога редактирования элемента
    * @param {String} id идентификатор браузера
    * @param {Boolean} readOnly будет ли невозможно менять содержимое
    * @param {Object} dataSource параметры получения данных
    * @param {Object} filter текущий фильтр
    * @param {Object} [reports] список отчетов
    * @param {Object} [handlers] обработчики событий
    * @param {String} [columnParentId] поле иерархии
    * @return {String|Boolean}
     * deprecated Используйте функцию generatePageURL
    */
   generateURL: function(recordId, isBranch, parentId, isCopy, editDialogTemplate, id, readOnly, dataSource, filter, reports, handlers,columnParentId){
       var params = {
           recordId : recordId,
           isBranch : isBranch,
           parentId : parentId,
           isCopy : isCopy,
           editDialogTemplate : editDialogTemplate,
           id : id,
           readOnly : readOnly,
           dataSource : dataSource,
           filter : filter,
           reports : reports,
           handlers : handlers,
           columnParentId : columnParentId
       };
       return $ws.helpers.generatePageURL(params, false);
    },

   /**
    * Функция, позволяющая сгенерировать URL для открытия страницы редактирования/создания записи
    * @param {Object} cfg объект параметров функции.
    * @param {String} cfg.recordId  Идентификатор записи.
    * @param {Boolean} cfg.isBranch узел или лист.
    * @param {Number}  cfg.parentId идентификатор родителя отображаемой записи.
    * @param {Boolean} cfg.isCopy копирование.
    * @param {String} cfg.editDialogTemplate имя шаблона диалога редактирования элемента.
    * @param {String} cfg.id идентификатор браузера.
    * @param {Boolean} cfg.readOnly будет ли невозможно менять содержимое.
    * @param {Object} cfg.dataSource параметры получения данных.
    * @param {Object} cfg.filter текущий фильтр.
    * @param {Object} cfg.reports список отчетов.
    * @param {Object} cfg.handlers обработчики событий. Ключ - имя события, значение - путь к обработчику
    * @param {String} cfg.columnParentId поле иерархии.
    * @param {String} cfg.changedRecordValues хэш-меп значений, которые уже изменены в записи и которые нужно перенести на страницу редактирования.
    * @param {Boolean} cfg.history
    * @param {Boolean} [retParams] признак того, как возвращать результат: в виде объекта или строки.
    * @param {String} [url]
    * @return {String|Boolean}
    * @example
    * <pre>
    *  var params = {
    *      recordId : "1",
    *      editDialogTemplate : "Edit",
    *      id: view.getid(),
    *      readOnly: false,
    *      dataSource: dataSource,
    *      reports : reports,
    *      handlers : {
    *       'onBeforeCreate': ['/resources/Module/handlerFile/handlerFunction']
    *      }
    *  },
    *  paramsObj = $ws.helpers.generatePageURL(params, true );
    * </pre>
    */
   generatePageURL: function(cfg, retParams, url){
      if((cfg.editDialogTemplate && ($ws._const.htmlNames[cfg.editDialogTemplate] || $ws._const.xmlContents[cfg.editDialogTemplate]))) {
         var isHierarchyMode = !!(cfg.isBranch),
             hdlIsObject = cfg.handlers && Object.prototype.toString.call(cfg.handlers) == "[object Object]",
             params = {
                  id : cfg.id,
                  hierMode : isHierarchyMode,
                  pk : cfg.recordId,
                  copy : cfg.isCopy || false,
                  readOnly : cfg.readOnly || false,
                  obj : cfg.dataSource.readerParams.linkedObject,
                  _events : {}
               },
               editTemplate,
               pageURL;
         if(url)
            pageURL = url;
         else if ($ws._const.htmlNames[cfg.editDialogTemplate]) {
            var arr = $ws._const.htmlNames[cfg.editDialogTemplate].split('/');
            pageURL = arr[arr.length - 1];
         }
         else {
            editTemplate = $ws._const.xmlContents[cfg.editDialogTemplate].split('/');
            pageURL = $ws._const.appRoot + editTemplate[editTemplate.length - 1] + ".html";
         }
         params["changedRecordValues"] = cfg.changedRecordValues;
         params["history"] = cfg.history;
         params["format"] = cfg.dataSource.readerParams.format;
         params["type"] = cfg.dataSource.readerType;
         if(cfg.dataSource.readerParams.otherURL !== $ws._const.defaultServiceUrl)
            params["url"] = cfg.dataSource.readerParams.otherURL;
         params["db"] = cfg.dataSource.readerParams.dbScheme;
         params["method"] = cfg.dataSource.readerParams.queryName;
         params["readMethod"] = cfg.dataSource.readerParams.readMethodName;
         params["createMethod"] = cfg.dataSource.readerParams.createMethodName;
         params["updateMethod"] = cfg.dataSource.readerParams.updateMethodName;
         params["destroyMethod"] = cfg.dataSource.readerParams.destroyMethodName;
         if(isHierarchyMode){
            params["branch"] = cfg.isBranch;
            params["pId"] = cfg.parentId;
            if(cfg.columnParentId)
               params["pIdCol"] = cfg.columnParentId;
         }
         if(cfg.recordId === undefined){
            params["filter"] = cfg.filter;
            params._events["onBeforeCreate"] = hdlIsObject && cfg.handlers.onBeforeCreate || [];
            params._events["onBeforeInsert"] = hdlIsObject && cfg.handlers.onBeforeInsert || [];
         }
         params._events["onBeforeRead"] = hdlIsObject && cfg.handlers.onBeforeRead || [];
         params._events["onBeforeUpdate"] = hdlIsObject && cfg.handlers.onBeforeUpdate || [];
         params._events["onBeforeShowRecord"] = hdlIsObject && cfg.handlers.onBeforeShowRecord || [];
         params._events["onLoadError"] = hdlIsObject && cfg.handlers.onLoadError || [];
         if( cfg.reports && !(Object.isEmpty(cfg.reports)) ){
            params["reports"] = cfg.reports;
            params._events["onBeforeShowPrintReports"] = hdlIsObject && cfg.handlers.onBeforeShowPrintReports || [];
            params._events["onPrepareReportData"] = hdlIsObject && cfg.handlers.onPrepareReportData || [];
            params._events["onSelectReportTransform"] = hdlIsObject && cfg.handlers.onSelectReportTransform || [];
         }
         if(retParams)
            return params;
         else{
            pageURL += "?editParams=" + encodeURIComponent($ws.helpers.serializeURLData(params));
            return pageURL;
         }
      } else {
         if(!$ws._const.htmlNames[cfg.editDialogTemplate] && !$ws._const.xmlContents[cfg.editDialogTemplate]) {
            $ws.single.ioc.resolve('ILogger').log('$ws.helpers.generatePageURL', 'ВНИМАНИЕ! Диалог "' + cfg.editDialogTemplate + '" отсутствует в оглавлении!');
         }
         return false;
      }
   },
   /**
    * Проверяет изменения между двумя наборами данных
    * @param {Array} obj1 Исходный набор данных
    * @param {Array} obj2 Результирующий набор данных
    * @returns {Array} Массив изменений
    */
   objectsDiff: function(object1, object2) {
      var VALUE_CREATED = 'created',
          VALUE_UPDATED = 'updated',
          VALUE_DELETED = 'deleted',
          VALUE_UNCHANGED = 'unchanged',
          VALUE_MOVED = 'moved',
          cloneObj1 = JSON.parse(JSON.stringify(object1)),
          cloneObj2 = JSON.parse(JSON.stringify(object2));

      function compareValues(value1, value2) {
         if (value1 === value2) {
            return VALUE_UNCHANGED;
         }
         if (value1 !== value2 && 'undefined' !== typeof(value1) && 'undefined' !== typeof(value2)) {
            return VALUE_UPDATED;
         }
         if ('undefined' == typeof(value1)) {
            return VALUE_CREATED;
         }
         if ('undefined' == typeof(value2)) {
            return VALUE_DELETED;
         }

         return VALUE_UPDATED;
      }
      function isFunction(obj) {
         return {}.toString.apply(obj) === '[object Function]';
      }
      function isArray(obj) {
         return {}.toString.apply(obj) === '[object Array]';
      }
      function isObject(obj) {
         return {}.toString.apply(obj) === '[object Object]';
      }
      function isValue(obj) {
         return !isObject(obj) && !isArray(obj);
      }
      function push(arr, index, id, data){
         for (var i=arr.length; i>index; i--){
            arr[i]= JSON.parse(JSON.stringify(arr[i-1]));
         }
         arr[index] = {};
         arr[index][id] = data;
      }
      function findInArr(obj, id){
         for (var i in obj) {
            if (Object.keys(obj[i])[0] == id) return i;
         }
         return false;
      }
      function createChanges(obj1, obj2){
         for (var i in obj1){
            var curKey = Object.keys(obj1[i])[0],
                newKey = obj2[i] && Object.keys(obj2[i])[0],
                isMoved = findInArr(obj2, curKey);
            if (curKey != newKey && isMoved === false) {
               push(obj2, i, curKey, obj1[i][curKey])
               obj2[i].type = VALUE_DELETED
            }
         }
         for (var i in obj2){
            var curKey = Object.keys(obj2[i])[0],
                newKey = obj1[i] && Object.keys(obj1[i])[0],
                isMoved = findInArr(obj1, curKey);
            if (curKey != newKey && isMoved === false) {
               push(obj1, i, curKey, obj2[i][newKey])
               obj2[i].type = VALUE_CREATED
            }
            if (curKey != newKey && isMoved !== false) {
               obj2[i].type = VALUE_MOVED;
               obj2[i].fromRowNum = isMoved;
            }
         }

         return parseValues(getChanges(obj1, obj2, 0));
      }
      function getChanges(obj1, obj2, level) {
         if (isFunction(obj1) || isFunction(obj2)) {
            throw 'Invalid argument. Function given, object expected.';
         }
         if (isValue(obj1) || isValue(obj2)) {
            return {type: compareValues(obj1, obj2)};
         }
         var diff = {}, isChanged=false;
         for (var key in obj2) {
            if (isFunction(obj2[key]) || (obj2[key] && obj2[key].type !== undefined)) {
               continue;
            }

            changed = getChanges(obj1[key], obj2[key], level+1);
            if (changed.type === VALUE_UPDATED){
               isChanged = true;
               if (level == 1) {
                  obj2.type = VALUE_UPDATED;
               }
            }
         }

         if (isChanged && level > 1) return {type: VALUE_UPDATED};
         if (level == 0) return obj2;
         return changed;
      }


      function parseValues(obj){
         var actions=[];
         if (obj.type == VALUE_UNCHANGED) return actions;
         for (var i in obj){
            if (!obj[i].type) continue;
            var result={};
            result.op = obj[i].type;
            if (obj[i].fromRowNum){
               result.fromRowNum = obj[i].fromRowNum;
            }
            result.rowNum = i;
            result.id = Object.keys(obj[i])[0];
            actions.push(result);
         }
         return actions;
      }
      return createChanges(cloneObj1, cloneObj2);
   },
   /**
    * Проверяет строковое значение даты на соответствие формату ISO 8601
    * @param {String} value строковое значение даты
    * @returns {Boolean} true, если строковое значение даты соответствует формату ISO
    */
   isISODate: function(value) {
      return /^(\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))?$/g.test(value);
   },
   /**
    * Преобразует строковое значение даты в формате ISO 8601 в Date
    * @param {String} value строковое значение даты в формате ISO 8601
    * @returns {Date|NaN} Date - в случае успешного преобразования, NaN - в противном случае
    */
   dateFromISO: function(value) {
      var day, tz,
            rx= /^(\d{4}\-\d\d\-\d\d([tT][\d:\.]*)?)([zZ]|([+\-])(\d\d):?(\d\d))?$/,
            p= rx.exec(value) || [];
      if(p[1]){
         day = $ws.helpers.map(p[1].split(/\D/), function(itm){
            return parseInt(itm, 10) || 0;
         });
         day[1] -= 1;
         var secToStr = (day[6] !== undefined ? day[6] + '' : '');
         if(secToStr.length > 3) {
            day[6] = parseInt(secToStr.substr(0,3), 10);
         }
         day= new Date(Date.UTC.apply(Date, day));
         if(!day.getDate()) return NaN;
         if(p[5]){
            tz= parseInt(p[5], 10)*60;
            if(p[6]) tz += parseInt(p[6], 10);
            if(p[4]== "+") tz*= -1;
            if(tz) day.setUTCMinutes(day.getUTCMinutes()+ tz);
         }
         return day;
      }
      return NaN;
   },
   /**
    * Подготавливает пакет для отрпавки запроса JSON RPC
    * @param {String}         method   Название метода.
    * @param {Object}         params   Параметры метода.
    * @param {String|Number}  [id=1]   Идентификатор.
    * @returns {Object}                Объект с двумя полями:
    * reqBody — тело запроса в виде строки,
    * reqHeaders — объект с необходимыми заголовками.
    */
   jsonRpcPreparePacket: function(method, params, id) {
      var
         body = {
            jsonrpc  :  '2.0',
            protocol :  $ws._const.JSONRPC_PROOTOCOL_VERSION,
            method   :  method,
            params   :  params,
            id       :  id !== undefined ? id : 1
         },
         headers = {
            'X-CalledMethod'        : $ws.helpers.transliterate("" + method),
            'X-OriginalMethodName'  : $ws.single.base64.encode("" + method),
            'Accept-Language'       : $ws.single.i18n.getLang() + ';q=0.8,en-US;q=0.5,en;q=0.3'
         },
         url = '?protocol=' + $ws._const.JSONRPC_PROOTOCOL_VERSION +
               '&method=' + encodeURI(method) +
               '&params=' + encodeURIComponent($ws.helpers.serializeURLData(params)) +
               '&id=' + (id !== undefined ? id : 1);

      return {
         reqBody: JSON.stringify(body),
         reqUrl: url,
         reqHeaders: headers
      };
   },
   /**
    * Функция, которая превращает строку вида 'js!SBIS3.EDO.MyPackage:handler' в функцию
    * @param {String} declaration - декларативное описание функции
    * @returns {Function|undefined}
    */
   getFuncFromDeclaration: (function(toJSON){
      return function(declaration){
         var
            paths = declaration.split(':'),
            result, module, p;

         try {
            // Сперва попробуем загрузить модуль.
            // requirejs.defined здес НЕ помогает (Сюрприз!)
            // Контрольный пример: define('x', function(){}); requirejs.defined('x') -> false
            module = requirejs(paths[0]);
         } catch(e) {
            // Если модуля нет - результат будет исходная декларация модуля
            result = declaration;
         }

         if (module) {
            // Если модуль загрузили
            try{
               // Ищем внутренности
               result = module;
               if (paths[1]){
                  paths = paths[1].split('.');
                  while(p = paths.shift()){
                     // try/catch нам тут нужен если указали кривой путь
                     result = result[p];
                  }
                  result._declaration = 'wsFuncDecl::' + declaration;
                  result.wsHandlerPath = declaration;
                  result.toJSON = toJSON;
               }
            }
            catch (e){
               throw new Error('Parsing function declaration "' + declaration + '" failed. Original message: ' + e.message);
            }

            if (typeof result !== 'function'){
               throw new Error('Can`t transform "'+ declaration +'" declaration to function');
            }
         }

         return result;
      }
   }(function(){return this._declaration})),
   /**
    * Функция, которая превращает строку вида 'datasource!SBIS3.EDO.MyDataSourcePackage:datasource_name' в json
    * @param declaration
    * @returns {object}
    */
   getDataSourceFromDeclaration: function (declaration) {
      var
         parts = declaration.split(':'),
         global = (function() { return this || (0,eval)('this') })(),
         result;
      try {
         result = global.requirejs(parts[0]);
         if (parts[1]) {
            var data = result.contents && result.contents[parts[1]];
            result = {
               readerParams: {
                  adapterType: "TransportAdapterStatic",
                  adapterParams: {
                     data: data
                  }
               }
            }
         }
      }
      catch (e) {
         throw new Error('Parsing datasource declaration "' + declaration + '" failed. Message:' + e.massage);
      }
      return result;
   },
   /**
    * Кроссбраузерно считает высоту страницы
    * @returns {Number}
    */
   getDocumentHeight: function() {
      return Math.max(
         document.body.scrollHeight, document.documentElement.scrollHeight,
         document.body.offsetHeight, document.documentElement.offsetHeight,
         document.body.clientHeight, document.documentElement.clientHeight
      );
   },
   /**
    * Возвращает имя тэга элемента DOM дерева в нижнем регистре. Ф-ция совместима с IE8+.
    * @param {Object} elem - элемент DOM дерева
    * @returns {String}
    */
   getTagName : function (elem) {
      return elem.localName || (elem.nodeName && elem.nodeName.toLowerCase());
      // Bugfix. IE8 DOM localName is undefined, checking nodeName instead.
   },
    /**
     * Высчитывает ширину переданного текста в пикселях.
     * Высчитывает по базовым на странице шрифту и размеру, то есть без довеска каких-либо классов.
     * @param text Переданный текст.
     * @returns {Number} Ширина переданного текста в пикселях.
     * @example
     * <pre>
     *     $ws.helpers.getTextWidth("helloWorld")
     * </pre>
     */
   getTextWidth : function(text){
      var hiddenStyle = "left:-10000px;top:-10000px;height:auto;width:auto;position:absolute;";
      var clone = document.createElement('div');

      // устанавливаем стили у клона, дабы он не мозолил глаз.
      // Учитываем, что IE не позволяет напрямую устанавливать значение аттрибута style
      document.all ? clone.style.setAttribute('cssText', hiddenStyle) : clone.setAttribute('style', hiddenStyle);

      clone.innerHTML = text;

      parent.document.body.appendChild(clone);

      //var rect = {width:clone.clientWidth,height:clone.clientHeight,text:clone.innerHTML};
      var rect = clone.clientWidth;
      parent.document.body.removeChild(clone);

      return rect;
   },
   /**
    * Достаем значение из localStorage по key.
    * @param {String} key - ключ
    * @returns {String} Значение localStorage по key
    */
   getLocalStorageValue: function(key) {
      if (typeof localStorage !== "undefined") {
         var lastSid = localStorage.getItem('__sid'),
             currentSid = $.cookie('sid');

         function clear() {
            //сбросим значения всех параметров, которые мы сохраняли, ибо сессия поменялась
            var localKeys = localStorage.getItem('ws-local-keys');
            try {
               localKeys = JSON.parse(localKeys) || [];
            } catch (e) {
               localKeys = [];
            }
            $ws.helpers.forEach(localKeys, function(key) {
               localStorage.removeItem(key);
            });
            localStorage.removeItem('ws-local-keys');
            // Установим новое занчение
            localStorage.setItem('__sid', currentSid);
         }

         if (lastSid && currentSid) {
            var w = lastSid.split("-"),
                n = currentSid.split("-");
            //если изменились пользователи или клиент
            if (w[0] !== n[0] || w[1] !== n[1]) {
               clear();
            }
         } else {
            clear();
         }

         return localStorage.getItem(key);
      }
   },
   /**
    * Устанавливаем значение localStorage по key.
    * @param {String} key - ключ
    * @param {String} value - Значение
    */
   setLocalStorageValue: function(key, value) {
      if ("localStorage" in window && window.localStorage !== null) {
         if (key !== '__sid') {
            localStorage.setItem(key, value);
            var localKeys = localStorage.getItem('ws-local-keys');
            try {
               localKeys = JSON.parse(localKeys) || [];
            } catch(e) {
               localKeys = [];
            }

            // если мы еще не запомнили, что мы используем этот ключ, то запомним его в список
            if (Array.indexOf(localKeys, key) === -1) {
               localKeys.push(key);
            }
            localStorage.setItem('ws-local-keys', JSON.stringify(localKeys));
         }
      }
   },
   /**
    * Возвращает количество свойств в объекте
    * @param {Object} obj - Объект, у которого хотим узнать кол-во свойств
    * @returns {Number}
    */
   countOfProperties: function(obj) {
      var count = 0;
      if (typeof(obj) != "object" || obj == null) {
         return 0;
      }
      for (var prop in obj) {
         count++;
      }
      return count;
   },
   /**
    * Превращает переданный контейнер в конфиг компонента, содержащий ссылку на элемент DOM дерева
    * @param {HTMLElement | *} cfg - контейнер для инстанцирования компонента.
    * @returns {Object}
    */
   parseMarkup : (function() {
      var
         fnStorage = {},
         reOpt = /^(option|opt)$/i,
         reOpts = /^(options|opts)$/i;


      function toJSON (){
         var id = $ws.helpers.randomId();
         fnStorage[id] = this;
         return 'wsGlobalFnDecl::' + id;
      }

      function getHTML(where, what) {
         var property = what + 'HTML';
         if (typeof where[property] == 'function') {
            return where[property]();
         } else {
            return where[property];
         }
      }

      function containsElementNodes(node) {
         var child;
         if (node.childNodes.length > 0) {
            for(var i = 0, l = node.childNodes.length; i < l; i++) {
               child = node.childNodes[i];
               if (child.nodeType !== 3) {
                  return true;
               }
            }
         }
         return false;
      }

      function isNumber(n) {
         return !isNaN(parseFloat(n)) && isFinite(n);
      }

      function parseElem(elem, vStorage){
         var result;

         function parseValue(valueAttr, valTypeAttr, content) {
            var
               ok, value, rawValue, key;

            if (content && content.length) {
               rawValue = String.trim(content);
            }
            else if (valueAttr !== null) {
               rawValue = valueAttr;
            } else {
               rawValue = undefined;
            }

            ok = rawValue !== undefined;

            switch (valTypeAttr) {
               case 'function':
                  if (ok) {
                     value = $ws.helpers.getFuncFromDeclaration(rawValue);
            }
                  break;

               case 'ref':
                  if (ok) {
                     key = rawValue;
                     value = vStorage.storage[key];
                     if (typeof value === 'function' && !value.toJSON) {
                        value.toJSON = toJSON;
            }
                     delete vStorage.storage[key];
               }
                  break;

               case 'null':
                  {
                     value = null;
                     ok = true;
            }
                  break;

               case 'undefined':
                  {
                     value = undefined;
                     ok = true;
                  }
                  break;

               case 'string':
                  if (ok) {
                     value = rawValue;
                  }
                  break;

               default:
                  if (ok) {
                     if (isNumber(rawValue)) {
                  //is number
                  //проверяем наличие лидирующих нулей (строка 0001234 - не должна быть преобразована в число)
                        value = /^0+/.test(rawValue) && rawValue.length > 1 ? rawValue : parseFloat(rawValue);
               }
                     else if (rawValue === 'false') {
                  //is boolean "false"
                        value = false;
               }
                     else if (rawValue === 'true') {
                  //is boolean "true"
                        value = true;
               }
                     else if (/^datasource!/.test(rawValue)) {
                        value = $ws.helpers.getDataSourceFromDeclaration(rawValue);
                     } else {
                        value = rawValue;
               }
            }
            }

            return {
               ok: ok,
               value: value
            };
         }

         function setBinding(elem, result, subBindings) {
            var
               bindTo = elem.getAttribute('bind'),
               nonexistentAttr = elem.getAttribute('nonexistent'),
               nonexistentTypeAttr = elem.getAttribute('nonexistentType'),
               nonExistent;
            if (bindTo || subBindings.length > 0) {
               nonExistent = parseValue(nonexistentAttr, nonexistentTypeAttr, undefined);

               result.binding = {
                  fieldName: bindTo,
                  nonExistentValue: nonExistent.ok ? nonExistent.value : undefined,
                  bindNonExistent: nonExistent.ok,
                  propName: result.name,
                  oneWay: elem.getAttribute('oneWay') === 'true',
                  direction: elem.getAttribute('direction') || 'fromContext'
               };

               if (subBindings.length > 0) {
                  result.binding.subBindings = subBindings;
               }
            }
         }

         if (elem.nodeType === 3) { //TEXT_NODE
            //если это любой непробельный символ - считаем, что это часть контента, иначе скорее всего перевод строки - пропускаем
            result = /\S/.test(elem.text || elem.textContent) ? {name : 'content', value : (elem.text || elem.textContent)} : false;
         }
         else if (reOpt.test(elem.nodeName)) {
            var
               obj = {},
               content,
               val = elem.getAttribute('value'),
               valType = elem.getAttribute('type'),
               parsed;

            content = getHTML(elem, 'inner');

            obj.name = elem.getAttribute('name');
            parsed = parseValue(val, valType, content);
            if (parsed.ok) {
               obj.value = parsed.value;
            }

            setBinding(elem, obj, []);

            result = obj;
         }
         else if (reOpts.test(elem.nodeName)) {
            var
               isArray = /Array|array/.test(elem.getAttribute('type')),
               res = isArray ? [] : {},
               attr,
               bindings = [],
               childRes,
               childNodes = elem.childNodes;

            // считаем атрибуты свойствами объекта только если у него нет дочерних нод (исключая текстовые)
            if (!isArray && !containsElementNodes(elem)) {
               for (var aI = 0, attrs = elem.attributes, aL = attrs.length; aI < aL; aI++){
                  attr = attrs[aI];
                  if (attr.name !== 'name') {
                     res[attr.name] = attr.value;
                  }
               }
            }

            for (var i = 0, l = childNodes.length; i < l; i++){
               if ((childRes = parseElem(childNodes[i], vStorage)) !== false){
                  if (isArray){
                     if (childRes.binding) {
                        childRes.binding.index = res.length;
                        bindings.push(childRes.binding);
                     }
                     if ('value' in childRes) {
                     res.push(childRes.value);
                  }
                  }
                  else if (childRes.name == 'content' && res.content) {
                        res.content += childRes.value;
                     }
                     else{
                     if ('value' in childRes) {
                        res[childRes.name] = childRes.value;
                     }

                     if (childRes.binding) {
                        bindings.push(childRes.binding);
                  }
               }
            }
            }

            result =  {
               name: elem.getAttribute('name') || 'Object',
               value: res
            };

            setBinding(elem, result, bindings);
            }
         else if ('outerHTML' in elem){
            result = {name : "content", value : getHTML(elem, 'outer')};
         }

         return result;
      }

      function getOldStyleBindings(node) {
         var
            parserModule = 'js!SBIS3.CORE.AttributeCfgParser',
            attributeCfgParser = requirejs.defined(parserModule) ? requirejs(parserModule) : null,
            attr = attributeCfgParser && node.getAttribute("data-bind"),
            result;

         if (attr) {
            result = $ws.helpers.map(attributeCfgParser(attr), function (fieldName, propName) {
               return {
                  fieldName: fieldName,
                  propName: propName.lcFirst(),
                  oneWay: false
               };
            });
         } else {
            result = [];
         }
         return result;
      }

      function parseConfigFromDOM(cfg, node, vStorage) {

         var childNodes = node.childNodes,
             bindings = [],
             oldStyleBindings = getOldStyleBindings(node);

         if (childNodes.length){
            for (var i = 0, l = childNodes.length; i < l; i++){
               var field = parseElem(childNodes[i], vStorage);
               if (field){
                  if (field.name === 'content') {
                     cfg.content = cfg.content || '';
                     cfg.content += field.value;
                  }
                  else{
                     cfg[field.name] = field.value;
                     if (field.binding) {
                        bindings.push(field.binding);
                  }
               }
            }
         }
         }

         if (bindings.length + oldStyleBindings.length > 0) {
            cfg.bindings = bindings.concat(oldStyleBindings);
         }

         return cfg;
      }

      return function parseMarkupInner(node, vStorage, noRevive){
         if (node && node.getAttribute){ // Bugfix. IE8 type of DOM elements functions == "object".
            var cfg, name;

            // Попробуем получить конфиг с самой ноды
            cfg = $ws.helpers.decodeCfgAttr(node.getAttribute('config') || '{}', fnStorage, noRevive);

            // если есть атрибут name, занесем его в конфиг
            if (!('name' in cfg)) {
               name = node.getAttribute('name');
               if (name) {
                 cfg.name = name;
               }
            }

            if (node.cloneNode) {
               // Если работает с настоящей DOM-нодой
               if (node.getAttribute('hasMarkup') != 'true') {
                  // И у нее нет разметки, попробуем дополнить конфиг из разметки
                  cfg = parseConfigFromDOM(cfg, node, vStorage);
               }
               // Заполним свойство element текущей нодой, на которой проводим разбор
               cfg.element = node;
            } else {
               // Если это не настоящая нода (ParserUtilities-нода) - просто считаем конфиг
               cfg = parseConfigFromDOM(cfg, node, vStorage);
            }

            return cfg;
         } else {
            return node;
         }
      }
   })(),

   setElementCachedSize: function(element, size) {
      var cachedSize = element.data('cachedSize');
      if (!cachedSize || cachedSize.width !== size.width || cachedSize.height !== size.height) {
         element.data('cachedSize', size);
         element.css(size);
      }
   },

   getElementCachedDim: function(element, dim) {
      var size = element.data('cachedSize');
      if (!size) {
         size = {};
         element.data('cachedSize', size);
      }
      if (!(dim in size)) {
         size[dim] = element[dim]();
      }

      return size[dim];
   },

   /**
    * Сохранение файла в  формате pdf или excel
    * В результате выполнения данного метода будет отправлен запрос
    * к методу бизнес-логики, возвращающему файл; и будет выведено окно
    * для сохранения  этого файла.
    * @param {String} object Название объекта бизнес-логики.
    * @param {String} methodName Имя метода.
    * @param {Object} params Параметры. Различные параметры в зависимости от метода.
    * @param {String} url ссылка на service, если не задано, то смотрим на сервис по умолчанию: '/service/sbis-rpc-service300.dll'
    * @param {Object} useGET Создать GET-запрос. Важно, на нашем сервере есть ограничение по длине запроса, так что пользоваться этим параметром нужно на свой страх и риск.
    * Важно учесть параметр "fileDownloadToken" - он будет добавлен, если не передан.
    * Метод saveToFile при формировании запроса передает в метод бизнес-логики ещё один параметр к перечисленным в
    * объекте params. Дополнительный параметр служит для передачи случайно сгенерированного числа, с помощью которого
    * определяется момент завершения выполнения  метода БЛ. Чтобы воспользоватся методом saveToFile,
    * вызываемый метод БЛ должен:
    * 1. принимать дополнительный параметр с именем "fileDownloadToken" (число целое 8 байт)
    * 2. добавлять cookie с именем (!): "fileDownloadToken_" + значение_параметра_в_виде_строки
    * и значением: значение_параметра_в_виде_строки.
    * @returns {$ws.proto.Deferred}
    */
   saveToFile: function(object, methodName, params, url, useGET){
      var dResult = new $ws.proto.Deferred();
      if(object && methodName && params){
         if(!params['fileDownloadToken'])
            params['fileDownloadToken'] = ('' + Math.random()).substr(2)* 1;
         if (useGET) {
            window.open($ws.helpers.prepareGetRPCInvocationURL( object, methodName, params));
            dResult.callback();
         } else {
            var body = $('body'),
                  cookie = 'fileDownloadToken_'+params['fileDownloadToken'],
                  fileDownloadCheckTimer,
                  cookieValue,
                  form = $('.ws-upload-form'),
                  iframe = $('.ws-upload-iframe');

            if(!form.length && !iframe.length){
               body.append(form = $('<form enctype="multipart/form-data" target="ws-upload-iframe" '+
               'action="' + ( url ? url : $ws._const.defaultServiceUrl ) +
               '?raw_file_result" method="POST" class="ws-upload-form ws-hidden">'+
               '<input type="hidden" name="Запрос"></form>'));
               body.append(iframe = $('<iframe class="ws-upload-iframe ws-hidden" name="ws-upload-iframe"></iframe>'));
            }
            form.find('[name=Запрос]').val(
                  $ws.helpers.jsonRpcPreparePacket(
                        object + '.' + methodName,
                        params,
                        ("" + Math.random()).substr(2)
                  ).reqBody
            );
            form.submit();
            fileDownloadCheckTimer = setInterval(function(){
               var iframeText = iframe.contents().find('pre');
               cookieValue = $.cookie(cookie);
               if (parseInt(cookieValue, 10) === params['fileDownloadToken']) {
                  clearInterval(fileDownloadCheckTimer);
                  $.cookie(cookie, null);
                  if(iframeText.length) {
                     dResult.errback(new Error(JSON.parse(iframeText.html()).error.details));
                     iframeText.remove('pre');
                  } else {
                     dResult.callback();
                  }
               }
            }, 1000);
         }
      }else
         dResult.errback();
      return dResult;
   },
   /**
    * Удаляет все пробелы из строки
    * @param str
    * @returns {*}
    */
   removeWhiteSpaces: function(str){
      return typeof(str) === "string" ? str.replace(/\s/g, "") : undefined;
   },
   /**
    * Удаляем указанные тэги.
    * @param {String} str - строка.
    * @param {Array|String} tags - массив тэгов, которые необходимо убрать из строки.
    */
   escapeTagsFromStr : function(){
      var reCache = {};

      return function(str, tags){
         var tagString, re;
         if (typeof tags == 'string')
            tags = [tags];
         if (typeof str == 'string' && tags instanceof Array) {
            tagString = tags.join('|');
            re = reCache[tagString] || (reCache[tagString] = new RegExp('<(?=\/*(?:' + tagString + '))[^>]+>', 'g'));
            re.lastIndex = 0;
            str = str.replace(re, '');
         }
         return str;
      }
   }(),

   /**
    * Удаляет все теги из строки, заменяя теги <pre><br></pre> на переводы строки (<pre>\n</pre>).
    * @param {String} html - исходная строка.
    * @return {String} строка без тегов
    */
   htmlToText: function(html) {
      var result = html.replace(/<br>/g, '\n');
      return $ws.helpers.escapeTagsFromStr(result, '\\w+');
   },

   /**
    * Экранирование HTML тэгов
    * @param {String} str строка.
    * @return {String} экранированная строка.
    */
   escapeHtml : function(str){
      if (typeof str == "string") {
         return str.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
      }
      else
         return str;
   },
   /**
    * Разэкранирование HTML тэгов
    * @param {String} str строка.
    * @return {String} разэкранированная строка.
    */
   unEscapeHtml: function(str){
      BOOMR.plugins.WS.reportEvent("ws.helpers", "unEscapeHtml");
      if (typeof str == "string")
         return str.replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      else
         return str;
   },
   /**
    * Экранирование ASCII символов
    * @param {String} str строка.
    * @return {String} экранированная строка.
    */
   escapeASCII: function (str) {
      if (typeof str == "string") {
         return str.replace(/./g, function(str){
            var c = str.charCodeAt(0);
            if ((c < 256) && (c < 48 || c > 57) && (c < 65 || c > 90) && (c < 97 || c > 122)) {
               return '&#' + c + ';';
            } else {
               return str;
            }
         });
      } else {
         return str;
      }
   },
   /**
    * Разэкранирование ASCII символов
    * @param {String} str строка.
    * @return {String} разэкранированная строка.
    */
   unEscapeASCII: function (str) {
      if (typeof str == "string") {
         return str.replace(/&#(.*?);/g, function (str, sub) {
            return String.fromCharCode(sub);
         });
      } else {
         return str;
      }
   },
   /**
    * Преобразование html-сущностей в символы
    * @param {String} str строка.
    * @return {String} преобразованная строка.
    */
   unEscapeHtmlSpecialChars: function(str){
      if (typeof str == "string"){
         var
               chars = {
                  '&minus;': '-',
                  '&nbsp;': ' ',
                  '&#92;': '\\'
               },
               chr;
         for(chr in chars){
            str = str.replace(new RegExp(chr, 'g'), chars[chr]);
         }
      }
      return str;
   },
    /**
     * Подготавливает объект сортировки для передачи на бизнес-логику
     * Создаёт объект вида { d: [], s: [] }.
     * @param filter - текущий фильтр табличного представления.
     * @returns {*} возвращает объект или null.
     */
   prepareSorting: function(filter){
      if(!filter || filter['sorting'] === undefined){
         return null;
      }
      var result = {
         s:[
            {'n': 'n', 't': 'Строка'},
            {'n': 'o', 't': 'Логическое'},
            {'n': 'l', 't': 'Логическое'}
         ],
         d:[]
      };
      for(var len = filter['sorting'].length, i = 0; i < len; ++i){
         result.d.push([filter['sorting'][i][0], filter['sorting'][i][1], !filter['sorting'][i][1]]);
      }
      return result;
   },
    /**
     * Подготавливает фильтр
     * Создаёт объект вида { d: [], s: [] }.
     * @param filter - текущий фильтр табличного представления.
     * @returns {{d: Array, s: Array}} возвращает объект вида { d: [], s: [] }.
     */
   prepareFilter: function(filter){
      var retval = { d: [], s: [] };
      if(filter && filter instanceof Object) {
         var keys = Object.keys(filter).sort();
         for(var i, j = 0; j < keys.length; ++j) {
            i = keys[j];
            if(i == 'pageNum' || i == 'pageCount' || i == 'usePages' || i == 'sorting'){
               continue;
            }
            if(filter.hasOwnProperty(i) && filter[i] !== undefined) {
               var serialized = $ws.proto.ReaderSBIS.serializeParameter(i, filter[i]);
               if(filter[i] instanceof Object && filter[i].hasOwnProperty('hierarchy')){
                  retval.d = retval.d.concat(serialized.d);
                  retval.s = retval.s.concat(serialized.s);
               }else{
                  retval.d.push(serialized.d);
                  retval.s.push({ 'n': i, 't': serialized.s });
               }
            }
         }
      }
      return retval;
   },
    /**
     * Возвращает на сколько пикселей сдвинули страницу вниз/влево
     * @returns {{left: (Number), top: (Number)}}
     */
   getScrollOffset: function() {
      return {
         left: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
         top: window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      };
   },
   makeBackground: (function(){
      var backDeffered, backgroundMapper;
      return function(element, image){
         backDeffered = backDeffered || $ws.requireModule('Core/BackgroundMapper').addCallback(function(BackgroundMapper) {
            backgroundMapper=BackgroundMapper[0];
            return backgroundMapper;
         });

         if(!backDeffered.isReady()) {
            backDeffered.addCallback(function (){
               backgroundMapper.makeBackground(element, image);
            })
         } else {
            backgroundMapper.makeBackground(element, image);
         }
         return element;
      }
   })(),
    /**
     * Превращает абстрактный путь к картинке вида "ws:/" к пути относительно корня
     * @param {string} path
     * @returns {*}
     */
   processImagePath: function(path) {
      BOOMR.plugins.WS.reportEvent("ws.helpers", "processImagePath");
      if (typeof path == 'string') {
         if (typeof window == 'undefined') {
            var nodePath = require('path');
         }

         if (path.indexOf('ws:/') === 0) {
            var replaceTo = $ws._const.wsRoot + 'img/themes/' + $ws._const.theme;
            if (typeof window == 'undefined') {
               var wsRoot = (typeof process !== 'undefined' && process.domain) ? process.domain.wsRoot || $ws._const.wsRoot : $ws._const.wsRoot;
               replaceTo = nodePath.join('/', nodePath.relative($ws._const.appRoot, wsRoot), 'img/themes', $ws._const.theme);
            }
            path = path.replace('ws:', replaceTo);
         }
         else if(/^js!/.test(path)) {
            var modulePath = $ws.helpers.resolveModule(path.replace(/^js!|\/.*/g, ''));
            if (modulePath) {
               if (typeof window == 'undefined') {
                  modulePath = nodePath.join('/', nodePath.relative($ws._const.appRoot, modulePath));
               }
               path = path.replace(/^js![^\/]*/, modulePath.replace(/\/[^\/]*$/, ''));
            }
         }
         if ($ws._const.buildnumber && !/\.v[0-9a-z]+/.test(path)) {
            path = path.replace(/(jpg|png|gif)$/, "v" + $ws._const.buildnumber + ".$1");
         }
      }
      return path;
   },
   /**
    * Превращаем упрощенный путь до ресурсов компонента в "настоящий"
    * @param {String} path упрощенный путь до ресурсов комопнента, например, 'SBIS3.CORE.Button/resources/images/process.gif'.
    * <pre>
    *    var image = $ws.helpers.resolveComponentPath('SBIS3.CORE.Button/resources/images/process.gif');
    * </pre>
    */
   resolveComponentPath: function(path){
      var
         pA = path.split("/"),
         componentName = pA.shift(),
         rA = [$ws._const.wsRoot],
         relativePath = $ws._const.jsCoreModules[componentName] || $ws._const.jsModules[componentName];

      rA.push(relativePath ? relativePath.replace(/\/[^\/]*$/, "/") : componentName);
      rA.push(pA.join("/"));
      return rA.join("");
   },
    /**
     * Переводит строку адреса в строку base64
     * @param {string} data - строка адреса
     * @returns {String}
     */
   serializeURLData: function(data) {
      // Шилов 12.10.2012
      // Если это IE8 или мало ли какой паразит, то преобразуем в UTF-8
      var stringified = JSON.stringify(data);
      if( stringified.indexOf( "\\u" ) != -1 )
         stringified  = unescape(stringified.replace(/\\u/g, '%u'));

      return $ws.single.base64.encode(stringified);
   },
    /**
     * Переводит строку из base64 в обычную строку
     * @param {string} serialized
     * @returns {*}
     */
   deserializeURLData: function(serialized) {
      var parseFunc = JSON && JSON.parse ? JSON.parse : $.parseJSON;
      return parseFunc($ws.single.base64.decode(serialized));
   },
   /**
    * Функция для приведения строки к валидной для XSLT трансформации
    */
   removeInvalidXMLChars: function(valueStr) {
      if (typeof valueStr == "string"){
         valueStr = valueStr.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]*/g, "");
      }
      return valueStr;
   },

   checkAssertion: function (assert, message) {
      if (!assert) {
         throw new Error(message || 'Ошибка логики');
      }
   },

   /**
    * Функция, проверяющая, является ли переданный аргумент простым js-объектом, то есть, объектом вида {field1: value1}.
    * Такая проверка бывает нужна для аргументов, представляющих собой хеш с ключами и значениями, для того, чтобы отличать
    * их от объектов Date, jquery, или экземпляров классов.
    * @param [Any] obj Проверяемое значение
    * @returns {Boolean}  Является ли переданный аргумент простым js-объектом
    */
   isPlainObject: (function () {
      var objTag = '[object Object]';

      return function (obj) {
         return !!(obj && toS.call(obj) === objTag &&
                   Object.getPrototypeOf(obj) === Object.prototype);
      };
   })(),

   /**
    * Функция, проверяющая, является ли переданный аргумент простым js-массивом, то есть, объектом вида [v1, v2].
    * Такая проверка бывает нужна для отличения аргументов-массивов от объектов со свойством length и численной индексацией,
    * таких, как jquery-объекты, например.
    * @param [Any] arr Проверяемое значение
    * @returns {Boolean}  Является ли переданный аргумент простым js-массивом
    */
   isPlainArray: isPlainArray,

   /**
    * Рекурсивно сравнивает два объекта или массива. Объекты считаются равными тогда, когда они равны по оператору ===,
    * или у них одинаковые наборы внутренних ключей, и по каждому ключу значения равны, причём, если эти значения - объекты или массивы, то они сравниваются рекурсивно.
    * @param {Object|Array} obj1 Первый объект
    * @param {Object|Array} obj2 Второй объект
    * @return {boolean}
    */
   isEqualObject: function isEqualObject(obj1, obj2) {
      function isTraversable(v) {
         return typeof(v) === 'object' && v !== null;
      }

      var
         ok = obj1 === obj2,
         notFound = {},
         diff1, diff2;

      if (!ok && $ws.helpers.isPlainArray(obj1) === $ws.helpers.isPlainArray(obj2) && isTraversable(obj1) && isTraversable(obj2)) {
         diff1 = $ws.helpers.findIdx(obj1, function (val, key) {
            var
               ok = key in obj2,
               val2;

            if (ok) {
               val2 = obj2[key];
               ok = isEqualObject(val, val2);
            }
            return !ok;
         }, undefined, notFound);

         diff2 = $ws.helpers.findIdx(obj2, function (val, key) {
            var
               ok = key in obj1,
               val1;

            if (ok) {
               val1 = obj1[key];
               ok = isEqualObject(val, val1);
            }
            return !ok;
         }, undefined, notFound);

         ok = diff1 === notFound && diff2 === notFound;
      }
      return ok;
   },

   /**
    * Делает функцию, вызывающую заданный метод у объекта, который будет передан ей в качестве аргумента.
    * Удобно для передачи метода объекта в качестве функции-итератора в forEach и ему подобные.
    * @param String methodName Имя метода
    * @param [Any] args Аргументы метода
    * @returns {Function}
    * @example
    * <pre>
    *     $ws.helpers.forEach([control1, control2, control3], $ws.helpers.methodCaller('destroy'));//вызовет destroy у всех контролов
    *     $ws.helpers.forEach([window1, floatArea1], $ws.helpers.methodCaller('hide'));//закроет окно и плав. панель
    * </pre>
    */
   methodCaller: function(methodName, args) {
      return function(obj) {
         if (obj) {
            return args ? obj[methodName].apply(obj, args) : obj[methodName]();
         } else {
            return undefined;
         }
      }
   },

   /**
    * Делает функцию, возвращающую заданное значение-константу. Может пригодиться для создания примитивных обработчиков, возвращающих одно и то же значение.
    * @param {*} res Значение
    * @return {Function}
    * <pre>
    *     var dfr = new $ws.proto.Deferred();
    *     ... //отдаём dfr кому-то, кто в него что-то стреляет...
    *     dfr.addBoth($ws.helpers.constant(100500)); //dfr будет всегда возвращать 100500, что бы с ним не делали раньше (была в нём ошибка или нет)...
    *     //или:
    *     dfr.addErrback($ws.helpers.constant(new Error('Unknown error'))); //dfr в случае ошибки будет всегда возвращать 'Unknown error'
    * </pre>
    */
   constant: function(res) {
      return function() {
         return res;
      };
   },

   /**
    * Функция для обхода элементов объекта или массива (взята отсюда: http://documentcloud.github.com/underscore/#each).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются).
    * Если obj - массив, то iterateCallback вызывается с аргументами (element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Объект/массив, свойства/элементы которого перебираются.
    * @param iterateCallback Функция, вызываемая для каждого элемента/свойства.
    * @param [context] - опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    */
   forEach: function(obj, iterateCallback, context) {
      if (obj === null || obj === undefined || obj.length === 0)
         return;

      var i, l, key;
      if (obj instanceof Array) {
         if (obj.forEach) {
            //В Firefox-е именно здесь глючит цикл обхода - пропускает некоторые итерации
            //Заменяю forEach на родной массивский - он работает нормально
            obj.forEach(iterateCallback, context);
         } else {
            l = obj.length;
            for (i = 0; i < l; i++) {
               if (i in obj) {
                  iterateCallback.call(context, obj[i], i, obj);
               }
            }
         }
      } else if ('length' in obj && (obj.length - 1) in obj) {
         /**
          * Это место переписано так не случайно.
          * При необъяснимых обстоятельствах на iOS 8.1 старая проверка
          * (obj.length === +obj.length) для obj === { 0: ??? }
          * давала положительный результат (obj.length в момент проверки был === 1)
          * Но следующая строка при чтении obj.length уже давала как и положено `undefined`
          * Как показали опыты, переписанная нижеследующим образом проверка не багает
          */
         l = parseInt(obj.length, 10);
         for (i = 0; i < l; i++) {
            if (i in obj) {
               iterateCallback.call(context, obj[i], i, obj);
            }
         }
      } else {
         for (key in obj) {
            if (obj.hasOwnProperty(key)) {
               iterateCallback.call(context, obj[key], key, obj);
            }
         }
      }
   },

   /**
    * Функция для создания нового массива из преобразованных элементов/свойств исходного массива/объекта (взята отсюда: http://documentcloud.github.com/underscore/#map).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются),
    * и добавляет результат iterateCallback в выходной массив.
    * Если obj - массив, то iterateCallback вызывается с аргументами (element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Исходный объект/массив.
    * @param iterateCallback Функция, вызываемая для каждого элемента/свойства. Должна возвращать преобразованный элемент.
    * @param [context] - опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    */
   map: function(obj, iterateCallback, context) {
      var results = [];
      if (obj === null || obj === undefined)
         return results;

      $ws.helpers.forEach(obj, function(value, index, list) {
         results[results.length] = iterateCallback.call(context, value, index, list);
      }, context);
      if (obj.length === +obj.length)//если на входе массив - подгоним длину
         results.length = obj.length;
      return results;
   },

   /**
    * Функция для создания нового массива из фильтрованных элементов/свойств исходного массива/объекта (взята отсюда: http://documentcloud.github.com/underscore/#filter).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются),
    * и добавляет элемент в выходной массив, если результат iterateCallback для него положителен (!!result).
    * Если obj - массив, то iterateCallback вызывается с аргументами (element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Исходный объект/массив
    * @param [iterateCallback] Функция, вызываемая для каждого элемента/свойства. Должна возвращать true или эквивалентное ему значение, которое показывает, добавлять ли объект в массив результатов. Может быть не указана, тогда вместо неё используется преобразование тек. элемента в bool (!!obj[i])
    * @param [context] - опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    */
   filter: function(obj, iterateCallback, context) {
      var results = [];
      if (obj === null || obj === undefined)
         return results;

      $ws.helpers.forEach(obj, function(value, index, list) {
         if (iterateCallback) {
            if (iterateCallback.call(context, value, index, list))
               results[results.length] = value;
         } else if (!!value) {
            results[results.length] = value;
         }
      }, context);

      return results;
   },

   filterObj: function (obj, iterateCallback, context) {
      var results = {};
      if (obj === null || obj === undefined)
         return results;

      $ws.helpers.forEach(obj, function (value, index, list) {
         if (iterateCallback) {
            if (iterateCallback.call(context, value, index, list))
               results[index] = value;
         } else if (value)
            results[index] = value;
      }, context);

      return results;
   },

   /**
    * Функция для поиска элемента в массиве/объекте (взята отсюда: http://documentcloud.github.com/underscore/#find).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются),
    * и возвращает первый элемент, результат iterateCallback для которого положителен (!!result).
    * Если obj - массив, то iterateCallback вызывается с аргументами (element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Исходный объект/массив.
    * @param [iterateCallback] Функция, вызываемая для каждого элемента/свойства. Должна возвращать true или эквивалентное ему значение, которое показывает, добавлять ли объект в массив результатов. Может быть не указана, тогда вместо неё используется преобразование тек. элемента в bool (!!obj[i])
    * @param [context] - опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    * @param [notFoundIndex] - опциональный аргумент, указывающий результат, который надо отдавать в том случае, если элемент не найден.
    */
   find: function (obj, iterateCallback, context, notFoundIndex) {
      var result = notFoundIndex;
      if (obj === null || obj === undefined)
         return result;

      var i, l, key;
      if (obj.length === +obj.length) { //хак, определяющий массив
         if (iterateCallback) {
            for (i = 0, l = obj.length; i < l; i++) {
               if (i in obj) {
                  if (iterateCallback.call(context, obj[i], i, obj)) {
                     result = obj[i];
                     break;
                  }
               }
            }
         } else {
            for (i = 0, l = obj.length; i < l; i++) {
               if (i in obj) {
                  if (!!obj[i]) {
                     result = obj[i];
                     break;
                  }
               }
            }
         }
      } else {
         if (iterateCallback) {
            for (key in obj) {
               if (obj.hasOwnProperty(key)) {
                  if (iterateCallback.call(context, obj[key], key, obj)) {
                     result = obj[key];
                     break;
                  }
               }
            }
         } else {
            for (key in obj) {
               if (obj.hasOwnProperty(key)) {
                  if (!!obj[key]) {
                     result = obj[key];
                     break;
                  }
               }
            }
         }
      }

      return result;
   },

   /**
    * Функция для поиска индекса (ключа) элемента в массиве/объекте. Если элемент не найден, возвращает -1 (число).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются),
    * и возвращает индекс первого элемента, результат iterateCallback для которого положителен (!!result).
    * Если obj - массив, то iterateCallback вызывается с аргументами (element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Исходный объект/массив.
    * @param [iterateCallback] Функция, вызываемая для каждого элемента/свойства. Должна возвращать true или эквивалентное ему значение, которое показывает, добавлять ли объект в массив результатов. Может быть не указана, тогда вместо неё используется преобразование тек. элемента в bool (!!obj[i])
    * @param [context] - опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    * @param [notFoundIndex] - опциональный аргумент, указывающий результат, который надо отдавать в том случае, если элемент не найден.
    */
   findIdx: function (obj, iterateCallback, context, notFoundIndex) {
      BOOMR.plugins.WS.reportEvent("ws.helpers", "find");
      var result = notFoundIndex === undefined ? -1 : notFoundIndex;
      if (obj === null || obj === undefined)
         return ;

      var i, l, key;
      if (obj.length === +obj.length) { //хак, определяющий массив
         if (iterateCallback) {
            for (i = 0, l = obj.length; i < l; i++) {
               if (i in obj) {
                  if (iterateCallback.call(context, obj[i], i, obj)) {
                     result = i;
                     break;
                  }
               }
            }
         } else {
            for (i = 0, l = obj.length; i < l; i++) {
               if (i in obj) {
                  if (!!obj[i]) {
                     result = i;
                     break;
                  }
               }
            }
         }
      } else {
         if (iterateCallback) {
            for (key in obj) {
               if (obj.hasOwnProperty(key)) {
                  if (iterateCallback.call(context, obj[key], key, obj)) {
                     result = key;
                     break;
                  }
               }
            }
         } else {
            for (key in obj) {
               if (obj.hasOwnProperty(key)) {
                  if (!!obj[key]) {
                     result = key;
                     break;
                  }
               }
            }
         }
      }

      return result;
   },

   /**
    * Функция, которая не делает ничего. Бывает нужна в качестве коллбека-заглушки, чтобы не проверять коллбеки на null
    */
   nop: function() {
   },

   /**
    * Функция для свёртки массива или набора свойств объекта в скалярное значение. (взята отсюда: http://documentcloud.github.com/underscore/#reduce).
    * Вызывает iterateCallback для каждого элемента (при этом обрабатываются только собственные элементы-свойства объекта, прототипные игнорируются),
    * при этом её параметр memo будет равен результату предыдущего вызова iterateCallback или начальному значению, заданному аргументом memoInitial.
    * Если obj - массив, то iterateCallback вызывается с аргументами (memo, element, index, array), где array === obj (исходный массив).
    * Если obj - объект, то iterateCallback вызывается с аргументами (memo, value, key, obj), где obj - исходный объект.
    * @param obj {Object|Array} Исходный объект/массив
    * @param iterator {Function} Функция, вызываемая для каждого элемента/свойства. Должна возвращать новое значение memo, вычисленное на основе аргументов memo и value.
    * @param memoInitial
    * @param [context] опциональный аргумент, указывающий контекст, в котором будет выполняться iterateCallback.
    */
   reduce: function(obj, iterator, memoInitial, context) {
      var initial = arguments.length > 2, memo = memoInitial;

      if (obj === null || obj === undefined)
         obj = [];

      $ws.helpers.forEach(obj, function(value, index, list) {
         if (!initial) {
            memo = value;
            initial = true;
         } else {
            memo = iterator.call(context, memo, value, index, list);
         }
      });

      if (!initial)
         throw new TypeError('Reduce of empty array with no initial value');

      return memo;
   },

   memoize: function(func, cachedFuncName) {
      var wrapFn = function() {
         var res = func.call(this),
             cached = function() { return res;},
             self = this;

         cached.reset = function() {
            self[cachedFuncName] = wrapFn;
         };

         this[cachedFuncName] = cached;
         return res;
      };
      wrapFn.reset = function() {};

      return wrapFn;
   },

   /**
    * Оборачивает указанную функцию в функцию, проверяющую, удалён ли указанный в аргументе selfControl контрол.
    * Если selfControl не задан, то используется обычный this (предполагается, что функция будет вызываться на этом контроле).
    * Если контрол удалён (его метод isDestroyed() возвращает true), то функция func вызываться не будет.
    * @param func {Function} Функция, которая будет работать только на живом контроле.
    * @param [selfControl] Ссылка на контрол. Если не указана, то используется this (такой вариант удобно использовать
    * для оборачивания методов контрола).
    * @returns {Function}
    */
   forAliveOnly: function (func, selfControl) {
      return function() {
         var self = selfControl || this;
         if (!self.isDestroyed()) {
            return func.apply(self, arguments);
         }
      }
   },

   /**
    * Определяет, разрешена ли прокрутка (скроллбары) в элементе (по свойствам overflow/overflow-x/y).
    * При isScrollable === false прокрутки при вылезании содержимого элемента за его границы не будет.
    * @param element - Элемент HTML DOM или jQuery
    * @param [kind] {String} Какой тип прокрутки (скроллбара) имеется в виду:
    *  <strong>kind === undefined</strong> - любой,
    *  <strong>kind === 'x'</strong> - горизонтальный,
    *  <strong>kind === 'y'</strong> - вертикальный.
    * @return {Boolean}
    */
   isScrollable: function(element, kind) {
      var el = $(element),
          overflow = el.css('overflow'),
          overflowX, overflowY;

      return (overflow === 'scroll' || overflow === 'auto') ||
             ((kind === undefined || kind === 'y') &&
              ((overflowY = el.css('overflow-y')) === 'auto' || overflowY === 'scroll')) ||
             ((kind === undefined || kind === 'x') &&
              ((overflowX = el.css('overflow-x')) === 'auto' || overflowX === 'scroll'));
   },

   /**
    * Определяет, показаны ли полосы прокрутки (скроллбары) в элементе.
    * Способ не очень быстрый, но надёжный.
    * @param element - Элемент HTML DOM или jQuery.
    * @param [kind] {String} Какой тип прокрутки (скроллбара) имеется в виду:
    *  <strong>kind === undefined</strong> - любой,
    *  <strong>kind === 'x'</strong> - горизонтальный,
    *  <strong>kind === 'y'</strong> - вертикальный.
    * @return {Boolean}
    */
   hasScrollbar: function(element, kind) {
      var el, result = false;

      element = $(element);//это может быть DOM-объект, а не jQuery-объект
      if (element.size() > 0) { //проверим, есть ли полосы прокрутки
         el = element.get(0);
         if (kind === undefined || kind === 'y') {
            result = (el.scrollHeight !== el.clientHeight);
         }

         if (!result && (kind === undefined || kind === 'x')) {
            result = (el.scrollWidth !== el.clientWidth);
         }
      }

      return result;
   },

   /**
    * Определяет, показана ли вертикальная полоса прокрутки в элементе.
    * @param element - Элемент HTML DOM или jQuery.
    * @return {Boolean}
    */
   hasVerticalScrollbar: function(element) {
      return this.hasScrollbar(element, 'y');
   },

   /**
    * Определяет, показана ли горизонтальная полоса прокрутки в элементе.
    * @param element - Элемент HTML DOM или jQuery.
    * @return {Boolean}
    */
   hasHorizontalScrollbar: function(element) {
      return this.hasScrollbar(element, 'x');
   },
    /**
     * Возвращает случайный идентификатор в виде "префикс"-123...
     * Идентификатор без префикса составляет 16 знаков.
     * @param {String} [prefix='ws-'] Префикс идентификатора
     * @returns {string} Случайный идентификатор с префиксом или без него в зависимости от переданного параметра.
     * @example
     * <pre>
     *     $ws.helpers.randomId(); // выведет идентификатор вида "ws-5543191684409976"
     * </pre>
     */
   randomId: function(prefix) {
      return (prefix || 'ws-') + Math.random().toString(36).substr(2) + (+new Date());
   },
   /**
    * Создает "GUID"
    * В кавычках потому, что он не настоящий, только выглядит как GUID.
    * Используется свой аглоритм, не такой как настоящий.
    *
    * @returns {String} "GUID"
    */
   createGUID: function() {
      var
            i = 0, s = 0, pad = new Date().getTime().toString(16);
      pad = '000000000000'.substr(0, 12 - pad.length) + pad;
      var p = function() {
         return (pad.substring(s, s += (i++ % 2 ? 2 : 1)) + (((1+Math.random())*0x10000)|0).toString(16)).substring(0, 4);
      };
      return (p()+p()+'-'+p()+'-'+p()+'-'+p()+'-'+p()+p()+p());
   },
    /**
     * Метод разбора сложного ключа
     * в объект вида
     * {
     *    objName: name,
     *    objKey: key
     * }
     * @param {string} key - сложный идентификатор.
     * @returns {*}
     */
   parseComplexKey: function(key) {
      if(typeof key == 'string') {
         var splitPos = key.indexOf($ws._const.IDENTITY_SPLITTER);
         if(splitPos != -1) {
            return {
               objName: key.substr(splitPos+1),
               objKey: key.substr(0, splitPos)
            }
         }
      }
      return {
         objName: '',
         objKey: key
      };
   },
    /**
     * Формирует GET запрос к бизнес-логике
     * Подготавливает адрес для вызова метода БЛ через GET запрос. Например, чтобы при клике на ссылку начиналась
     * загрузка какого-либо файла, расположенного в базе данных бизнес-логики.
     * @param {String} object Объект бизнес-логики.
     * @param {String} method Метод бизнес-логики.
     * @param {Object} args Аргументы  вызова бизнес-логики. Можно передать пустой объект {}.
     * @param {$ws.proto.Context} [context=$ws.single.GlobalContext] Контекст для параметров (см. пример).
     * @param {String} [serviceUrl=$ws._const.defaultServiceUrl] Адрес сервиса бизнес-логики.
     * @returns {String} Возвращает строку GET запроса.
     * @example
     * <pre>
     *     // параметр 'Версия' берётся из поля 'version' глобального контекста
     *     $ws.helpers.prepareGetRPCInvocationURL('ВерсияВнешнегоДокумента', 'ПолучитьФайл', {'ИдО': 123, 'Версия' : {fieldName : 'version'}})
     * </pre>
     */
   prepareGetRPCInvocationURL: function(object, method, args, context, serviceUrl) {
      var
         baseUrl = serviceUrl || $ws._const.defaultServiceUrl,
         rpcMethod = encodeURIComponent(object + '.' + method),
         filterParams = $ws.core.merge({}, args || {}),
      // IE8-9 пускай горят в огне, не кэшим ничего и никогда
         id = ($ws._const.browser.isIE8 || $ws._const.browser.isIE9) ? ('' + Math.random()).substr(2,9) : 0,
         complexKey, objName;

      for(var fName in filterParams) {
         if(filterParams.hasOwnProperty(fName)) {
            var param = filterParams[fName];
            if(param !== null && typeof param == 'object' && 'fieldName' in param) {
               filterParams[fName] = (context || $ws.single.GlobalContext).getValue(param.fieldName);
            }
            if(fName == 'ИдО') {
               var oN = filterParams[fName];
               if(!oN) {
                  return '';
               }
               if(typeof oN == 'string') {
                  complexKey = $ws.helpers.parseComplexKey(oN);
                  objName = complexKey.objName || object;

                  if (complexKey.objKey) {
                     filterParams[fName] = complexKey.objKey;
                  }
                  rpcMethod = encodeURIComponent(objName + '.' + method);
               }
            }
         }
      }

      return baseUrl +
            '?id=' + id +
            '&method=' + rpcMethod +
            '&protocol=' + $ws._const.JSONRPC_PROOTOCOL_VERSION +
            '&params=' + encodeURIComponent( $ws.helpers.serializeURLData(filterParams) );
   },
   /**
    * Выполняет GET запрос на получение файла с помощью метода БЛ.
    * @param {String} objectName имя объекта БЛ. Например "Контакт".
    * @param {String} methodName имя метода БЛ. Например "Список".
    * @param {Object} params JSON-объект параметров запроса
    * @param {String} serviceUrl путь до сервиса, на котором надо выполнить метод
    * @return $ws.proto.Deferred объект deferred с результатом запроса
    */
   fetchFile : function(objectName, methodName, params, serviceUrl){
      return $ws.single.ioc.resolve('ITransport', {
         method: 'GET',
         dataType: 'text',
         url: $ws.helpers.prepareGetRPCInvocationURL(objectName, methodName, params, null, serviceUrl)
      }).execute();
   },
    /**
     * Метод для создания запросов.
     * @param {String} object Имя таблицы, у которой будет вызван метод.
     * @param {String} [method] Имя метода БЛ.
     * @param {Object} [filter] Параметры фильтрации.
     * @param {String} [reader = ReaderUnifiedSBIS] Используемый Reader.
     * @param {Boolean} [autoQuery = true] Производить ли начальное заполнение RecordSet'а.
     * @param {String} [url] Адрес сервиса.
     * @param {String} [hierarchyField = ''] Поле иерархии.
     * @param {Object} [readerParams = {}] Дополнительные параметры Reader, например, readMethodName.
     * @returns {$ws.proto.Deferred} В случае успеха подписант на результа deferred получит RecodSet {@link $ws.proto.RecordSet}.
     * В противном случае происходит ошибка.
     * @example
     * <pre>
     *    fieldLink.subscribe('onBeforeShowRecord', function(event, record){
     *       if (record.isBranch()) {
     *          //не показываем диалог для выбранного подразделения.
     *          event.setResult(false);
     *       } else if (record.get('Сотрудник.Лицо1') !== $ws.single.GlobalContext.getValue('currentOrganization')) {
     *          //если сотрудник в текущей организации, то её запись уже есть и отдадим на показ её.
     *          event.setResult(window.currentOrgRecord);
     *       } else {
     *          //иначе вычитаем.
     *          var waitOrg = new $ws.proto.Deferred();
     *          event.setResult(wait);
     *          $ws.helpers.newRecordSet('Организация', 'Список', {}, undefined, false).addCallback(function(rs){
     *             waitOrg.dependOn(rs.readRecord(record.get('Сотрудник.Лицо1')));
     *          }).addErrback(function(error){
     *             waitOrg.errback(error);
     *          });
     *       }
     *    });
     * </pre>
     */
    newRecordSet : function(object, method, filter, reader, autoQuery, url, hierarchyField, readerParams){
        var
           attachDfr,
           canceled = false,
           internalRs = null;

       autoQuery = ((autoQuery === undefined) ? true : !!autoQuery);

       hierarchyField = (hierarchyField === undefined ? '' : hierarchyField);

       readerParams = $ws.core.merge({
          otherUrl : url,
          dbScheme: '',
          linkedObject: object,
          queryName: method
       }, (!!readerParams && readerParams.constructor === Object) ? readerParams : {});

       attachDfr = $ws.core.attachInstance('Source:RecordSet', {
          hierarchyField: hierarchyField,
          firstRequest: false,
          filterParams: filter,
          readerType: reader || 'ReaderUnifiedSBIS',
          readerParams: readerParams
       }).addCallback(function(rs){
          var res;

          if (autoQuery && !!method && !canceled) {
             internalRs = rs;
             res = rs.reload().createDependent().addCallback($ws.helpers.constant(rs));
          } else {
             res = rs;
          }

          return res;
       });

       return attachDfr.createDependent().addErrback(function(err) {
          var rs;
          if (err.canceled) {
             canceled = true;
             if (internalRs) {
                rs = internalRs;
                internalRs = null;
                rs.abort();
             }
          }
          return err;
       });
   },
    /**
     * Назначает обработчик на на событие keydown
     * Для одинаковой обработки событий в разных браузерах.
     * Актуально для старых версий, например, Opera до 12.10.
     * @param object - jQuery объект, на который вешается обработчик события нажатия клавиши.
     * @param callback - функция, которая сработает при нажатии клавиши.
     */
   keyDown: function(object, callback){
      object[$ws._const.compatibility.correctKeyEvents ? 'keydown' : 'keypress'](function(e){
         if(!$ws._const.compatibility.correctKeyEvents){
            if(e.which === e.keyCode){
               if(e.which >= 97 && e.which <= 122){
                  e.which = e.keyCode - 32;
               }
               else if(e.which in $ws._const.operaKeys){
                  e.which = $ws._const.key[$ws._const.operaKeys[e.which]];
               }
            }
            if(e.which === 0){
               e.which = e.keyCode;
            }
            e.keyCode = e.which;
         }
         callback(e);
      });
   },
   /**
    * Рисует календарик
    * @param {String|jQuery} id - идентификатор элемента, либо jQuery элемент, в который вставляем календарик.
    * @param {Function} func  - функция для изменения отображения дней в календаре.
    * @param {Date} [firstDayToShow] - дата дня, на котором нужно сфокусировать календарь.
    * Вызов showDatePicker("datepicker", dayFormat);
    * @returns {$ws.proto.Deferred} асинхронное событие. Нужно для того, чтобы знать,
    * что календарик уже нарисовался.
    * Пример функции func
    * @example
    * <pre>
    * // <div id="test"></div> Должен существовать блок с идентификатором 'test'
    * $ws.helpers.showDatePicker('test', function dayFormat(date) {
    *  // Если отображаемый день месяца меньше 15
    *   if (date.getDate() < 15) {
    *    // [может ли быть выбрано, 'css-класс для добавления к ячейке дня', "текст всплывающей подсказки"]
    *       return [true, 'ui-state-highlight', "tooltip"];
    *   }
    *   return [true, ''];
    * });
    * </pre>
    */
   showDatePicker:function  (id , func, firstDayToShow){
      var def = new $ws.proto.Deferred();
      $ws.core.ready.addCallback(function (){
         $ws.require(["js!Ext/jquery-ui/jquery-ui-1.8.5.custom.min",
                      "css!Ext/jquery-ui/jquery-ui-1.8.5.custom",
                      "js!SBIS3.CORE.FieldDate/resources/ext/jquery.ui.datepicker-ru"])
               .addCallback(function(){
               var el = (id instanceof $) ? id : $('#' + id);
               el.datepicker({
                  beforeShowDay: func,
                  defaultDate: firstDayToShow
               });
               def.callback();
            });
         });
      return def;
   },
   /**
    * Переводит число/денежное значение из его цифрового представления в строковое(словесное)
    * @remark
    * Диапазон значений параметра numAsStr:
    * <ul>
    *    <li> от 0 до 999999999999999 - целая часть</li>
    *    <li>от 0 .. 99 дробная часть (если есть еще дробные знаки, то они отбрасываются)</li>
    * </ul>
    * Целая или дробная часть могут отсутствовать.
    * @param {String} numAsStr Число
    * @param {Boolean} pSocr Сокращать до 'руб' 'коп' или полностью ('рубли' 'копейки')
    * @returns {String} Значение прописью
    * @example
    * <pre>
    *   var num = '673453453535.567';
    *   var vs = $ws.helpers.numToWritten(num, true);
    *   var num = '673453453535.567';
    *   // результат = 'шестьсот семьдесят три миллиарда четыреста пятьдесят три миллиона четыреста пятьдесят три тысячи пятьсот тридцать пять руб пятьдесят шесть коп'
    *
    *   var vs = $ws.helpers.numToWritten(num, false);  // или что тоже самое var vs = $ws.helpers.numToWritten(num);
    *   // результат = 'шестьсот семьдесят три миллиарда четыреста пятьдесят три миллиона четыреста пятьдесят три тысячи пятьсот тридцать пять рублей пятьдесят шесть копеек'
    * </pre>
    */
   numToWritten : function(numAsStr, pSocr) {
      // pSexFemale = true если для женского рода, например для тысяч
      function numberToWritten999(value, pSexFemale) {
         var
            digits = {'0':'','1':'один','2':'два','3':'три','4':'четыре','5':'пять','6':'шесть','7':'семь','8':'восемь','9':'девять','10':'десять','11':'одиннадцать','12':'двенадцать','13':'тринадцать','14':'четырнадцать','15':'пятнадцать','16':'шестнадцать','17':'семнадцать','18':'восемнадцать','19':'девятнадцать'},
            dozens = {'2':'двадцать','3':'тридцать','4':'сорок','5':'пятьдесят','6':'шестьдесят','7':'семьдесят','8':'восемьдесят','9':'девяносто'},
            hundreds = {'0': '','1':'сто','2':'двести','3':'триста','4':'четыреста','5':'пятьсот','6':'шестьсот','7':'семьсот','8':'восемьсот','9':'девятьсот'},
            result, h, d;
         if(pSexFemale === true) {
            digits['1'] = 'одна';
            digits['2'] = 'две';
         }
         d = value % 100;
         d = d <= 19 ? digits[d] : dozens[Math.floor(d/10)] + (d%10 ? ' ' : '') + digits[d%10];
         h = hundreds[Math.floor(value / 100)];
         if( h && d ) { h += ' '; }
         result = h + d;
         return result;
      }

      function chooseNumericEndingType(value) {
         var
            fst = Math.abs(value % 10),
            sec = Math.abs(value % 100);
         if(fst === 0 || fst >= 5 || sec >= 11 && sec <= 19) {
            return 0;
         }
         if(fst === 1) {
            return 1; // 11 excluded
         }
         return 2;
      }

      // pSexFemale = true если для женского рода, например для тысяч
      function numberToWritten(numAsStr,pSexFemale,allowMinus) {
         allowMinus = allowMinus || true;
         var
            result = '',
            i = 0,
            trizryads = {
               0:{'0':'',              '1':'',              '2':''},
               1:{'0':'тысяч',         '1':'тысяча',        '2':'тысячи'},
               2:{'0':'миллионов',     '1':'миллион',       '2':'миллиона'},
               3:{'0':'миллиардов',    '1':'миллиард',      '2':'миллиарда'},
               4:{'0':'триллионов',    '1':'триллион',      '2':'триллиона'},
               5:{'0':'квадриллионов', '1':'квадриллион',   '2':'квадриллиона'},
               6:{'0':'квинтиллионов', '1':'квинтиллион',   '2':'квинтиллиона'},
               7:{'0':'сикстиллионов', '1':'сикстиллион',   '2':'сикстиллиона'},
               8:{'0':'септиллионов',  '1':'септиллион',    '2':'септиллиона'},
               9:{'0':'октиллионов',   '1':'октиллион',     '2':'октиллиона'},
              10:{'0':'нониллионов',   '1':'нониллион',     '2':'нониллиона'},
              11:{'0':'дециллионов',   '1':'дециллион',     '2':'дециллиона'}
            },
            three, writning, negative;
         if(numAsStr.charAt(0)==='-') {
            if(allowMinus) {
               negative = true;
               numAsStr = numAsStr.slice(1);
            }
            else {
               return 'ОШИБКА';
            }
         }
         if(parseInt(numAsStr,10) === 0) {
            return 'ноль';
         }
         if(isNaN(numAsStr)){
            return 'ОШИБКА';
         }
         if(''===numAsStr){
            return '';
         }
         while(numAsStr.length > 0) {
            three = parseInt(numAsStr.substr(Math.max(numAsStr.length-3,0),3),10);
            var ct = chooseNumericEndingType(three);
            writning = trizryads[i] && trizryads[i][ct] ? ' ' + trizryads[i][ct] : '';

            if(three > 0) {
               if(i && writning === '') {
                  return 'ОШИБКА'; // Слишком много разрядов
               }
               result = numberToWritten999(three,i===1 || pSexFemale) + writning + (result ? ' ' + result : '');
            }
            numAsStr = numAsStr.slice(0,-3);
            i++;
         }
         if(negative) {
            result = 'минус ' + result;
         }
         return result;
      }

      // если pSocr = true, то тоже самое что и moneyToWritten, но сокращенно аббревиатуры руб и коп.
      // если pSocr = false или не указана, то полностью, например, рублей и копеек.
      function moneyToWritten (numAsStr, pSocr) {
         // Все операции проводим со строками, чтобы можно было оперировать с большими числами
         numAsStr = (numAsStr+'').replace(/\s/g,'');
         if(isNaN(numAsStr) || !numAsStr.match(/^[-0-9.]*$/)){ return 'ОШИБКА'; }
         if(''===numAsStr){ return ''; }
         var
            arr = (numAsStr+'').split('.'),
            rub = arr[0] || '0',
            kop = arr[1] || '00',
            rubles = {'0':'рублей', '1':'рубль',   '2':'рубля'},
            kopeks = {'0':'копеек', '1':'копейка', '2':'копейки'},
            rubR, kopR, result;
         if(rub === '-') { rub = '-0'; }
         if(kop.length === 1){ kop += '0'; }
         if(kop.length > 2){
            // rounding
            var flow = kop.charAt(2);
            kop = kop.substr(0,2);
            if(flow >= '5') {
               kop = parseInt(kop,10)+1+'';
               if(kop.length === 1){ kop = '0' + kop; }
               if(kop === '100') {
                  kop = '00';
                  if(rub === '') {
                     rub = 1;
                  }
                  var pos = rub.length - 1, after = '';
                  while(true) {
                     if(pos < 0 || isNaN(parseInt(rub.charAt(pos),10))) {
                        after = (pos >= 0 ? rub.substr(0,pos+1) : '') +'1' + after;
                        break;
                     }
                     else if(rub.charAt(pos) === '9') {
                        after = '0' + after;
                        pos--;
                     }
                     else {
                        after = rub.substr(0,pos) + (parseInt(rub.charAt(pos),10)+1) + after;
                        break;
                     }
                  }
                  rub = after;
               }
            }
         }

         rubR = numberToWritten(rub);
         if(rubR === 'ОШИБКА'){ return 'ОШИБКА'; }
         rubR = rubR || 'ноль';
         rubR += ' ' + (pSocr ? 'руб' : rubles[chooseNumericEndingType(parseInt(rub.substr(Math.max(0,rub.length-2),2),10))]);
         kopR = ' ' + kop + ' ' + (pSocr ? 'коп' : kopeks[chooseNumericEndingType(parseInt(kop,10))]);
         if(parseInt(kop.substr(0,2),10) > 0 && rub.charAt(0)==='-' && rubR.charAt(0) !== 'м') {
            rubR = 'минус ' + rubR; // так как 0 рублей, то минус не прописался
         }
         result = rubR + kopR;
         result = result.charAt(0).toUpperCase() + result.substr(1);
         return result;
      }

      return moneyToWritten(numAsStr, pSocr);
   },
   /**
    * Получает и парсит атрибут alignmargin, отвечающий за отступы контрола.
    * Если атрибута нет, марджины ставятся в ноль по умолчанию.
    * @param {jQuery} elem  элемент, у которого получить марджины.
    * @returns {Object} Объект марджинов.
    */
   parseMargins:function (elem){
      var result, wsMargin, margins;
      BOOMR.plugins.WS.reportEvent("ws.helpers", "parseMargins");

      elem = $(elem);

      wsMargin = elem.attr('alignmargin');
      if(wsMargin){
         margins = wsMargin.split(',');
         result = {
            'top':parseInt(margins[0], 10),
            'right':parseInt(margins[1], 10),
            'bottom':parseInt(margins[2], 10),
            'left':parseInt(margins[3], 10)
         }
      } else {
         result = {};
      }

      $ws.helpers.forEach(result, function(val, key) {
         result[key] = result[key] || parseInt(elem.css('margin-' + key), 10) || 0;
      });
      return result;
   },
   NON_CTRL: '.ws-non-control',

   /**
    * Получить авто-размер для неконтрола
    * @param {Object} collection jQuery-набор элементов - неконтролов.
    * @param {String} type Height|Width - тип размера.
    * @returns {Number} значение.
    */
   getNonControlSize: function(collection, type){
      var max = 0, curr = 0, i, ln = (collection && collection.length) || 0, isHidden, ltype;

      if (ln > 0) {
         isHidden = jQuery.expr.filters.hidden,
         ltype = type.toLowerCase();

         for (i = 0; i < ln; i++)  {
            var elem = collection[i], jqElem;

            if (!isHidden(elem)) {
               jqElem = $(elem);

               var attr = elem.getAttribute('orig' + type);
               if (attr === null || attr === "auto" || attr === "Auto") {
                  curr = jqElem['getNative' + type]();
               } else {
                  curr = parseFloat(attr);

                  var margins = elem.getAttribute('alignmargin');
                  if (margins !== null) {
                     margins = margins.split(',');

                     if (type === 'Height') {
                        curr += ((parseInt(margins[0], 10) + parseInt(margins[2], 10)) || 0);
                     } else {
                        curr += ((parseInt(margins[1], 10) + parseInt(margins[3], 10)) || 0);
                     }
                  }

                  // добавляем padding+border, если есть.
                  curr += jqElem["outer"+type]() - jqElem[ltype]();
               }
               max = (curr > max) ? curr : max;
            }
         };
      }

      return max;
   },
   /**
    * Проверяет нажата ли клавиша CapsLock
    * @param {Event} keypressEvent jQuery событие keypress, для которого проверяется нажат капс-лок или нет.
    * @returns {Boolean} нажат ли капс-лок. undefined возвращается когда определить невозможно.
    */
   checkCapsLock:function (keypressEvent){
      if (!keypressEvent || !keypressEvent.which)
         return undefined;
      var asciiCode = keypressEvent.which;
      var letter = String.fromCharCode(asciiCode);
      var upper = letter.toUpperCase();
      var lower = letter.toLowerCase();
      var shiftKey = keypressEvent.shiftKey;

      // Если верхние и нижние регистры равны, то нет возможности определить нажат ли капс-лок
      if(upper !== lower){

         // Если вводится верхний символ при ненажатом шифте, значит капс-лок включен
         if(letter === upper && !shiftKey){
            return true;
            // Если нижний, то выключен.
         } else if(letter === lower && !shiftKey){
            return false;
            // Если нижний при нажажатом шифте, то включен
         } else if(letter === lower && shiftKey){
            return true;
         } else if(letter === upper && shiftKey){
            if(navigator.platform.toLowerCase().indexOf("win") !== -1){
               // Если на Windows, то выключен
               return false;
            } else{
               if(navigator.platform.toLowerCase().indexOf("mac") !== -1){
                  // Если на Mac, то выключен
                  return false;
               } else{
                  return undefined;
               }
            }
         } else{
            return undefined;
         }
      } else{
         return undefined;
      }
   },

   /**
    * Построить строку заданного формата по объекту/записи/контексту
    * Принимает следующие типы шаблонов:
    * t: $имя поля$<b>t</b>$формат даты$ - дата/время, используется формат функции {@link Date#strftime}.
    * d: $имя поля$<b>d</b>$ - целое число (D - с разделителями).
    * f: $имя поля$<b>f</b>$[точность$] - вещественное число (F - с разделителями).
    * s: $имя поля$<b>s</b>$ - прочее, строки, в т.ч. Enum.
    * @param {Object|$ws.proto.Record|$ws.proto.Context} source Объект/запись/контекст - источник.
    * @param {String} format Строка формата.
    * @example
    * <pre>
    *    var
    *       formatString = 'Сегодня $date$t$%e %q %Y года$ и курс доллара составляет $number$F$3$ рублей.',
    *       object = {number:1234.5678, date:new Date()},
    *       result = $ws.helpers.format(object, formatString);
    *       // "Сегодня 11 октября 2013 года и курс доллара составляет 1 234.568 рублей."
    * </pre>
    * @returns {String}
    */
   format:function(source,format){
      if (typeof format !== "string")
         return "";
      return format.replace(/\$([а-яА-Яa-zA-Z0-9_ .]+)\$(?:([sdD])|([t])\$([\s\S]*?)|([fF])(?:\$([0-9]+))?)\$/g, function(str, m0, m1, m2, m3, m4, m5) {
         var
            field =
               source ?
                  (
                     source instanceof $ws.proto.Record && source.hasColumn(m0) ? source.get(m0) :
                     source.getValue && typeof source.getValue === 'function' ? source.getValue(m0) :
                     source[m0] ) :
                  null;
         if (m2)
            m1 = m2;
         if (m4)
            m1 = m4;
         if (m1 === 't')
            return field ? field.strftime(m3) : "";
         if (m1 === 'd' || m1 === 'D')
            return $ws.render.defaultColumn.integer( field, !!(m1 === 'd') );
         if (m1 === 'f' || m1 === 'F')
            return $ws.render.defaultColumn.real( field, m5 ? m5 : 2, m1 !== 'f' );
         //if (m1 === 's')
         if (field instanceof $ws.proto.Enum)
            return $ws.render.defaultColumn.enumType( field );
         else
            return field ? field : "";
      });
   },
   /**
    * Информационное окно "Общий вопрос".
    * Пользователю будет доступно 2 варианта ответа: "Да" и "Нет".
    * Результатом является $ws.proto.Deferred, в который передаётся:
    * 1. 'true' - при нажатии кнопки "Да".
    * 2. 'false' - при нажатии кнопки "Нет".
    * 3. 'undefined' - при нажатии на клавишу "Esc".
    * <wiTag group="Управление" class="Window" page=2>
    * @param {string} text Текст вопроса
    * @param {object} [cfg] Можно переопределить стандартный вид диалога.
    * @returns {$ws.proto.Deferred} Стреляет ответом пользователя /Да/Нет/undefined (если нажали Esc).
    * @example
    * 1. Вызвать окно "Общий вопрос" можно следующим образом:
    * <pre>
    *    $ws.helpers.question('Сохранить изменения?');
    * </pre>
    *
    * 2. Использование результата ответа пользователя:
    * <pre>
    *  $ws.helpers.question('Сохранить изменения?').addCallback(function(result){
    *      //тело функции
    *      //в переменную result занесён результат выбора пользователя: true, false или undefined
    *  });
    *  </pre>
    *
    *  3. Можно настроить, какую из кнопок "Да"/"Нет" выделить оранжевым цветом по умолчанию.
    *  <pre>
    *       //Для этого вторым параметром передаём объект с invertDefaultButton: false/ true:
    *       //'true' - по умолчанию установлена кнопка "Да".
    *       //'false' - по умолчанию установлена кнопка "Нет".
    *       //Этим свойством мы инвертируем кнопку, выбранную по умолчанию:
    *      $ws.helpers.question('Сохранить изменения?', {invertDefaultButton: true});
    *  </pre>
    * @see alert
    * @see message
    */
   question: function( text, cfg, opener ){
      var res = new $ws.proto.Deferred(),
          escPressed = false,
          windowManager = $ws.single.WindowManager;
      $ws.core.attachInstance('SBIS3.CORE.DialogConfirm', $ws.core.merge({
         message: text,
         opener: opener || (windowManager && windowManager.getActiveWindow()),
         handlers: {
            onKeyPressed : function (event, result){
               if(result.keyCode == $ws._const.key.esc) {
                  escPressed = true;
               }
            },
            onConfirm: function(event, result) {
               //Он может зайти сюда ещё раз из какого-то обработчика в res.callback
               // (например, из opener-a - FloatArea, которая будет закрываться сама и закрывать свои дочерние окна,
               // и это окно в том числа),
               // тогда он может попытаться стрельнуть ещё раз, и будет ошибка
               if (!res.isReady()) {
                  if(escPressed) {
                     res.callback(undefined);
                  }
                  else {
                     res.callback( result );
                  }
               }
            }
         }
      }, cfg || {} ) ).addErrback(function(err){
         res.errback( err );
      });
      return res;
   },
   /**
    * Показывает сообщение. Возвращает Deferred, который сработает при закрытии окна.
    * @param {String} text Текст.
    * @param {Object} cfg  Параметры, которые могут переопределять/дополнять стандартные.
    * @param {String} type Тип. 'info', 'error' или 'complete'.
    * @param {Object} opener контрол, который вызвал функцию (нужен в случае вызова из floatArea)
    * @returns {$ws.proto.Deferred}
    * @private
    */
   _messageBox: function(text, cfg, type, opener){
      var res = new $ws.proto.Deferred(),
          windowManager = $ws.single.WindowManager;
      $ws.core.attachInstance('SBIS3.CORE.DialogAlert', $ws.core.merge({
         message: text,
         type: type,
         opener: opener || (windowManager && windowManager.getActiveWindow()),
         handlers: {
            onAfterClose: function(){
               res.callback();
            }
         }
      }, cfg || {})).addErrback(function(err){
         $ws.single.ioc.resolve('ILogger').log('$ws.helpers._messageBox', err.message);
         alert($ws.helpers.htmlToText(text));//Если не удалось создать диалог, показываем простой браузерный алёрт
         res.errback(err);
      });
      return res;
   },
   /**
    * Информационное окно "Ошибка"
    * Возвращает $ws.proto.Deferred, который сработает при закрытии окна.
    * <wiTag group="Управление" class="Window" page=4>
    * @param {String|Error} text  Текст сообщения.
    * @param {Object} [cfg] Параметры окна, которые могут переопределять стандартные.
    * @param {Boolean} [cfg.checkAlreadyProcessed=false] Если передан true и вместо текста передан объект ошибки, проверяет флаг processed (указывает на то что ошибка уже обработана и не надо о ней более извещать) и если флаг выставлен - не показывает сообщение
    * @param {Object} [opener] Контрол, который вызвал функцию (нужен в случае вызова из floatArea)
    * @returns {$ws.proto.Deferred}
    * @example
    * 1. Окно "Ошибка" (предупреждение, alert) можно вызвать так:
    * <pre>
    *    $ws.helpers.alert('Сообщение об ошибке!');
    * </pre>
    *
    * 2. Окно возвращает $ws.proto.Deferred, который сработает при закрытии окна. Но как подписаться на результат? Делаем следующее:
    * <pre>
    *    $ws.helpers.alert('Соообщение об ошибке!').addBoth(function(){
    *       //внутрь функции всегда передаётся одинаковое значение, вне зависимости от действий пользователя: нажал кнопку "ОК" или "Ecs"
    *       //тело функции, которая должна быть выполнена
    *    });
    * </pre>
    *
    * 3. Если требуется, например, изменить состояние флага после нажатия кнопки "ОК" в окне "Ошибка"(Alert), то:
    * <pre>
    * $ws.helpers.alert('Сообщение об ошибке').addBoth(function(){
    *     //устанавливаем флаг сброшенным
    *     $ws.single.ControlStorage.getByName('ИмяФлага').setValue(false);
    * });
    * </pre>
    * @see message
    * @see question
    */
   alert: function(text, cfg, opener){
      if (text instanceof Error) {
         //Обработка отмены запроса пользователем
         if (text.httpError === 0) {
            return new $ws.proto.Deferred().callback();
         }
         else {
            if (cfg && cfg.checkAlreadyProcessed) {
               if (text.processed) {
                  return new $ws.proto.Deferred().callback();
               } else {
                  text.processed = true;
               }
            }
            text = (text.message || '').replace(/\n/mg, '<br />');
         }
      }

      if (text) {
         return $ws.helpers._messageBox(text, cfg, 'error', opener);
      } else {
         return new $ws.proto.Deferred().callback();
      }
   },
   /**
    * Информационное окно "Сообщение"
    * Возвращает $ws.proto.Deferred, который сработает при закрытии окна.
    * <wiTag class="Window" group="Управление" page=3>
    * @param {String} text  Текст сообщения.
    * @param {Object} [cfg] Параметры окна, которые могут переопределять стандартные.
    * @returns {$ws.proto.Deferred}
    * @example
    * 1. Вызвать информационное окно "Сообщение" можно так:
    * <pre>
    *    $ws.helpers.message('Это информационное окно "Сообщение"!');
    * </pre>
    *
    * 2. Это окно возвращает $ws.proto.Deferred. Как это использовать? Можно, например, выполнять функции только закрытия окна:
    * <pre>
    *    $ws.helpers.message('Это информационное окно "Сообщение"!').addBoth(function(){
    *        //тело функции
    *    });
    * </pre>
    * @see alert
    * @see question
    */
   message: function(text, cfg, opener){
      return $ws.helpers._messageBox(text, cfg, 'info', opener);
   },
   /**
    * Создает контекстное меню по упрощенным параметрам - список пунктов и м.б. функция активации
    * @param {Array} items Пункты меню.
    * @param {Function} [onActivate] Функция, которая будет выполняться при выборе пункта меню.
    * @returns {$ws.proto.Deferred} Стреляет созданным контекстным меню.
    */
   newContextMenu: function(items, onActivate){
      var config = [];
      for(var k = 0, l = items.length; k < l; k++){
         config[k] = {
            caption: items[k],
            id: items[k],
            handlers: {}
         };
         if(typeof(onActivate) == 'function')
            config[k].handlers['onActivated'] = onActivate;
      }
      return $ws.core.attachInstance('Control/Menu', {
         data: config
      });
   },
   /**
    * Показывает стандартный платформенный диалог печати.
    * @param {String|Object} htmlText|cfg Если этот параметр-строка, то в нём лежит html-текст, который нужно показать в окне предварительного просмотра при печати.
    * Если этот параметр-объект, то в нём лежит набор аргументов функции плюс, если нужно, параметры, используемые в конструкторе диалога печати (см. справку по конструктору $ws.proto.Dialog).
    * Первый параметр можно задавать объектом, чтобы было удобнее передать только те аргументы, которые нужно, и не писать undefined вместо остальных.
    *
    * @param {Number} [top] отступ сверху для окна предварительного просмотра
    * @param {Number} [left] отступ слева для окна предварительного просмотра
    * @param {Object} [opener] контрол, который вызвал функцию (нужен в случае вызова из floatArea)
    *
    * @param {String} cfg.htmlText html-текст, который нужно показать в окне предварительного просмотра при печати
    * @param {Number} [cfg.top] отступ сверху для окна предварительного просмотра
    * @param {Number} [cfg.left] отступ слева для окна предварительного просмотра
    * @param {$ws.proto.Control} [cfg.opener] контрол, который вызвал функцию (нужен в случае вызова из floatArea)
    * @param {Object} [cfg.handlers] Обработчики событий для окна предварительного просмотра
    *
    * @returns {$ws.proto.Deferred} стреляет созданным окном предварительного просмотра
    */
   showHTMLForPrint: function(htmlText, top, left, opener){

      var
         options = typeof(htmlText) === 'string' ? {} : $ws.core.shallowClone(htmlText),
         windowManager = $ws.single.WindowManager;

      function removeUndefinded(obj) {
         $ws.helpers.forEach(obj, function(val, key) {
            if (val === undefined) {
               delete obj[key];
            }
         });
         return obj;
      }

      //Параметры должны перебивать опции
      $ws.core.merge(options, removeUndefinded({
         top: top,
         left: left,
         opener: opener || (windowManager && windowManager.getActiveWindow())
      }), {clone: false, rec: false});

      //Устанавливаем неустановленные опции в дефолтные значения
      $ws.core.merge(options, {
         htmlText: String(htmlText),
         resizable: true,
         parent: null,
         handlers: {}
      }, {preferSource: true});

      return $ws.core.attachInstance('SBIS3.CORE.PrintDialog', options).addCallback(function(dlg) {
         return dlg.getReadyDeferred().addCallback($ws.helpers.constant(dlg));
      });
   },
   /**
    * Вычисляет ширину скроллбара в текущем браузере
    * @return {*}
    */
   getScrollWidth: function() {
      if(document && document.body) {
         var div = document.createElement('div');
         div.style.cssText="position:absolute;height:50px;overflow-y:hidden;width:50px;visibility:hidden";
         div.innerHTML = '<div style="height:100px"></div>';
         var innerDiv = div.firstChild;

         document.body.appendChild(div);
         var w1 = innerDiv.offsetWidth;
         div.style.overflowY = 'scroll';
         var scrollWidth = w1 - innerDiv.offsetWidth;
         document.body.removeChild(div);

         $ws.helpers.getScrollWidth = function() { return scrollWidth; };
         return scrollWidth;
      } else if (!document) {
         throw new Error('Ошибка: функция $ws.helpers.getScrollWidth вызвана на сервере. Она должна вызываться только в клиентском браузере.');
      } else {
         throw new Error('Ошибка: функция $ws.helpers.getScrollWidth вызвана на клиентском браузере, однако body ещё не готово.');
      }
   },
   /**
    * Вычисляет координаты элемента с учетом скроллинга
    * @param elem Элемент, координаты которого надо вычислить.
    * @return {Object} Координаты элемента в виде объекта { top: , left: }
    */
   getOffsetRect: function(elem) {
      var box = elem.getBoundingClientRect(),
          body = document.body,
          docElem = document.documentElement,
          scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
          scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
          clientTop = docElem.clientTop || body.clientTop || 0,
          clientLeft = docElem.clientLeft || body.clientLeft || 0,
          top = box.top + scrollTop - clientTop,
          left = box.left + scrollLeft - clientLeft;
      return { top: Math.round(top), left: Math.round(left) };
   },
   /**
    * Возвращает слово в нужном падеже, в зависимоси от числа,
    * например (10, "рублей", "рубль", "рубля") возвратит слово "рублей".
    * @param {Number} num Число, стоящее перед словом.
    * @param {String} word0 Падеж, соответствующий числу 0.
    * @param {String} word1 Падеж, соответствующий числу 1.
    * @param {String} word2 Падеж, соответствующий числу 2.
    * @returns {String}
    */
   wordCaseByNumber: function (num, word0, word1, word2) {
      num = Math.abs(num);

      // если есть дробная часть
      if (num % 1 > 0)
         return word2;

      // если две последние цифры 11 ... 19
      num = num % 100;
      if (num >= 11 && num <= 19)
         return word0;

      // все остальные случаи - по последней цифре
      num = num % 10;

      if (num == 1)
         return word1;

      if (num == 2 || num == 3 || num == 4)
         return word2;
      else
         return word0;
   },
   addXmlLog: function(templateName){
      var tplListElem = $('#xmlContent');
      if(!tplListElem.length){
         tplListElem = $('<div id="xmlContent" style="display:none; visibility: hidden;"></div>');
         $('body').append(tplListElem);
      }
      if(!tplListElem.data(templateName)){
         tplListElem.data(templateName, true);
         tplListElem.append('<div name="'+templateName+'">')
      }
   },
   /**
    * Если есть deferred, то дожидается его окончания и выполняет callback, иначе просто выполняет callback
    * @param {*} deferred То, чего ждём.
    * @param {Function} callback То, что нужно выполнить.
    * @return {$ws.proto.Deferred|*} Если есть деферред, то возвращает его, иначе - результат выполнения функции.
    */
   callbackWrapper: function(deferred, callback){
      if(deferred && deferred instanceof $ws.proto.Deferred){
         return deferred.addCallback(callback);
      }
      else{
         return callback(deferred);
      }
   },
   /**
    * Вставляет кусок css на страницу
    * @param {String} style CSS-текст, который нужно вставить.
    * @param {Boolean} [waitApply=false] Нужно ли ожидание применения css. Если задано true, то возвращает Deferred, сигнализирующий готовность css (применённость к документу).
    * @param {String} [hint] "Подсказка". Присутствует в сообщении об ошибке если стили не удалось применить.
    * @returns {Deferred|null} Если waitApply = true, то возвращает Deferred, сигнализирующий готовность css (применённость к документу), иначе null.
    */
   insertCss: function(style, waitApply, hint){
      /**
       * Возвращает тэг для вставки css
       * @return {*}
       */
      function getCurStyleHolder(){
         var tag;
         if ("getElementsByClassName" in document){
            tag = document.getElementsByClassName("ws-style-holder-current")[0];
         }
         else{
            var styles = document.getElementsByTagName("style");
            for (var i = 0, l = styles.length; i < l; i++){
               if (hasClass(styles[i], "ws-style-holder-current")){
                  tag = styles[i];
                  break;
               }
            }
         }
         tag = tag || createStyleHolder();
         return tag;
      }

      /**
       * Создает новый тэг style
       * @return {HTMLElement}
       */
      function createStyleHolder(){
         var sHolder = document.createElement('style');
         var head = document.getElementsByTagName('head')[0];

         sHolder.setAttribute('type', 'text/css');
         sHolder.setAttribute('media', 'all');
         sHolder.className = 'ws-style-holder ws-style-holder-current';
         head.appendChild(sHolder);

         return sHolder;
      }

      /**
       * Проверяет есть ли у элемента указанные классы
       * @param {HTMLElement} element.
       * @param {String} cls классы через пробел.
       * @return {Boolean}
       */
      function hasClass(element, cls) {
         var
            className = ' ' + element.className + ' ',
            m = cls.split(" ");
         for (var i = 0, l = m.length; i < l; i++){
            if (className.indexOf(' ' + m[i] + ' ') == -1){
               return false;
            }
         }
         return true;
      }

      /**
       * Функция проверки применения стилей
       * @returns {boolean}
       */
      function checkMarkerDiv() {
         var pos = markerDiv.css('position'),
            ok = (pos === 'absolute'),
            isIEBefore10 = $ws._const.browser.isIE7 || $ws._const.browser.isIE8 || $ws._const.browser.isIE9,
            timeout = +new Date() - start > $ws._const.styleLoadTimeout,
            notifierDiv = $('#onlineChecker');

         if (ok || timeout) {
            markerDiv.remove();
            if (waitInterval) {
               clearInterval(waitInterval);
               if(timeout && isIEBefore10) {
                  result.errback('Timeout waiting for styles to apply' + (hint ? ' for ' + hint : ''));
               } else if(timeout) {
                  notifierDiv.text("Страница загружается слишком долго. Попробуйте перезагрузить страницу");
                  notifierDiv.css('display', '');
                  result.callback();
               } else {
                  result.callback();
               }
            }
         }
         return ok;
      }

      var
         markerCss = '',
         result = null,
         markerDivId, markerDiv, waitInterval, start, styleHolder;

      if (waitApply) {
         markerDivId = $ws.helpers.randomId('cssReady-');

         markerDiv = $('<div id="' + markerDivId + '" style="display: none;" />').appendTo($('body'));
         markerCss = '#' + markerDivId + ' { position: absolute; }';
      }

      if ($ws._const.compatibility.standartStylesheetProperty){
         styleHolder = createStyleHolder();
         styleHolder.appendChild(document.createTextNode(style + markerCss));
      }
      else {
         styleHolder = getCurStyleHolder();
         style = style + markerCss;
         var
            cssText = styleHolder.styleSheet.cssText,
            curRulesCnt = (cssText.match(/\{|,/g) || []).length,
            insRulesCnt = (style.match(/\{|,/g) || []).length;

         if (curRulesCnt + insRulesCnt > 4000){
            styleHolder.className = 'ws-style-holder';
            styleHolder = createStyleHolder();
         }

         try {
            styleHolder.styleSheet.cssText += style;
         } catch (e) {
            $ws.single.ioc.resolve('ILogger').error('insertCss', 'Failed to insert styles to document! IE8/9 Stylesheet limit exceeded (31 per document)?');
            throw e;
         }
      }

      if (waitApply) {
         start = +new Date();
         if (!checkMarkerDiv()) {
            result = new $ws.proto.Deferred();
            waitInterval = setInterval(checkMarkerDiv, 1);
         }
      }

      return result;
   },

   /**
    * Возвращает выделенный на странице текст
    * @return {String}
    */
   getTextSelection : function(){
      var txt;

      if (window.getSelection)
         txt = window.getSelection().toString();
      else if (document.getSelection)
         txt = document.getSelection().toString();
      else if (document.selection)  // IE 6/7
         txt = document.selection.createRange().text;

      return txt;
   },
    /**
     * Скрывает/показывает индикатор загрузки
     */
   toggleIndicator: (function(){
      var indicInstance, indicDeffered;
      function indicatorVisible(toggle){
         if(!!toggle) {
            // Если передали Deferred
            if( toggle instanceof $ws.proto.Deferred ){
               // Если он еще не готов
               if(!toggle.isReady()) {
                  // Покажем
                  indicInstance.show();
                  // Подпишемся на завершение с любым статусом ...
                  toggle.addBoth(function( res ){
                     // и скроем индикатор
                     indicInstance.hide();
                     return res;
                  });
               }
               else{ // Скроем индикатор, если Deferred сразу готов
                  indicInstance.hide();
               }
            }
            else {
               indicInstance.show();
            }
         } else {
            indicInstance.hide();
         }
      }
      return function (toggle) {
         indicDeffered = indicDeffered || $ws.requireModule('SBIS3.CORE.LoadingIndicator').addCallback(function() {
            indicInstance = new $ws.proto.LoadingIndicator({message: 'Пожалуйста, подождите…'});
            return indicInstance;
         });
         if(!indicDeffered.isReady()) {
            //Идет попытка загрузить LoadingIndicator, но он еще не готов
            indicDeffered.addCallback(function (){
               indicatorVisible(toggle);
            })
         } else {
            // Был определен LoadingIndicator, обрабатываем индикатор
            indicatorVisible(toggle);
         }
      }
   })(),
   /**
    * Показывает индикатор загрузки над конкретной областью
    * @param {jQuery} target область под индикатором
    * @param {Boolean} state скрыть / показать
    */
   toggleLocalIndicator: function (target, state){
      // ищем существующий индикатор
      var indicator = target.children('.ws-browser-ajax-loader').first();

      // если не нашли - создаём новый
      if(!indicator.length){
         indicator = $('<div class="ws-browser-ajax-loader ws-hidden"><div class="ws-loading-indicator-outer">' +
         '<div class="ws-loading-indicator-block"><div class="ws-loading-indicator ws-browser-loading-indicator">' +
         '</div></div></div></div>');
         target.append(indicator);
      }

      // переключаем
      if(state){
         indicator.removeClass('ws-hidden');
      }
      else{
         indicator.addClass('ws-hidden');
      }
   },
   /**
    * Показывает всплывающую панель с указанным конфигом. Если она уже есть, не создаёт новую. Для корректной работы необходим name в config
    * @param {Object} config Конфигурация панели. Параметры конфигурации должны быть теми, которые требуются конструктору класса создаваемой панели.
    * Класс создаваемой панели определяется так: если в параметре config есть поле 'path' (путь к классу), то будет создан экземпляр указанного класса с заданными настройками.
    * Пример: 'SBIS3.CORE.FloatArea' - для обычной плав. панели, или 'SBIS3.CORE.RecordFloatArea' - для панели с рекордом, или 'SBIS3.CORE.FilterFloatArea' - для панели фильтров.
    * Поле path работает аналогично параметру 'path' у функции {@link attachInstance}.
    * Если же path не указан, но в параметре config есть поле 'filter': true, то будет загружаться панель фильтров (SBIS3.CORE.FilterFloatArea) - так, как если бы в поле 'path'  было бы
    * 'SBIS3.CORE.FilterFloatArea'.
    * Если же не указано ни поле 'path', ни поле 'filter', то будет создаваться обычная плав. панель (SBIS3.CORE.FloatArea).
    * Если в параметре config есть поля 'id' или 'name', то панель со своим конфигом будет сохранена в кеше по указанным ключам (id и/или name), и при следующем вызове функции showFloatArea
    * (или {@link showHoverFloatArea}) с теми же параметрами 'id' или 'name' будет показана та же панель.
    * При этом, если в новом конфиге поля path, filter, или template отличаются от таких полей в старом конфиге, будет создана новая панель (потому что класс или шаблон сменился).
    * Если же в новом конфиге отличаются поля target, hoverTarget, opener, то они будут переустановлены методами setTarget/setHoverTarget/setOpener,
    * и будет показана старая панель с переустановленными параметрами.
    * @return {$ws.proto.Deferred}
    */
   showFloatArea: function(config){
      var
         id = config.id,
         name = config.name,
         storage = $ws.helpers.showFloatArea.storage,
         storageEntry, result, oldCfg;

      if(!storage){
         $ws.helpers.showFloatArea.storage = storage = {
            id: {},
            name: {}
         };
      }

      var path;
      if (config.path) {
         path = config.path;
      }
      else if (config.filter) {
         path = 'SBIS3.CORE.FilterFloatArea';
      } else {
         path = 'SBIS3.CORE.FloatArea';
      }

      storageEntry = storage.id[id] || storage.name[name];
      if (storageEntry) {
         oldCfg = storageEntry.config;
         if (oldCfg.path !== config.path || oldCfg.filter !== config.filter || oldCfg.template !== config.template) {
            storageEntry = null;

            if (id !== undefined) {
               delete storage.id[id];
            }
            if (name !== undefined) {
               delete storage.name[name];
            }
         }
      }

      if (storageEntry) {
         result = storageEntry.instDfr.addCallback(function(instance) {
            var result = instance;
            if (instance.isDestroyed()) {
               result = $ws.core.attachInstance(path, config);
            } else {
               if (config.target) {
                  instance.setTarget(config.target);
               }

               if (config.hoverTarget) {
                  instance.setHoverTarget(config.hoverTarget, true);
               }

               //переустановим opener-а на случай, если старый удалился, и панель от него отвязалась, оставшись без opener-а
               if (config.opener) {
                  instance.setOpener(config.opener);
               }

               if (config.autoShow || config.autoShow === undefined) {
                  instance.show();
               }
            }
            return result;
         });
      }
      else {
         result = $ws.core.attachInstance(path, config);
         storageEntry = {
            instDfr: result,
            config: config
         };

         if (id !== undefined) {
            storage.id[id] = storageEntry;
         }
         if (name !== undefined) {
            storage.name[name] = storageEntry;
         }

         result.addCallback(function(instance) {
            //при удалении области выкидываем её из кеша,
            //чтоб зря память не ела.
            instance.once('onDestroy', function() {
               if (id !== undefined) {
                  delete storage.id[id];
               }
               if (name !== undefined) {
                  delete storage.name[name];
               }
            });
            return instance;
         });
      }

      //нужно отдавать результат через createDependent, чтобы клиентский код не мог испортить состояния deferred-а с экземпляром панельки
      return result.createDependent();
   },
   /**
    * Показывает всплывающую панель, аналогично {@link showFloatArea}. Только панель показывается при ховере по элементу.
    * Является надстройкой, позволяющей избежать ситуации, когда на элемент навели мышь, панель загружается, мышь убрали, панель показалась и больше никогда не убирается.
    * @param {jQuery|HTMLElement|String}  element  Элемент, при наведении мыши на который будет показана всплывающая панель.
    * @param {Boolean}                    hovered  Находится ли мышь над нужным элементом (при этом панель будет показана после загрузки).
    * @param {Object}                     config   Конфигурация панели. Параметры конфигурации смотрите в документации функции {@link showFloatArea}.
    * @return {$ws.proto.Deferred}
    */
   showHoverFloatArea: function(element, hovered, config){
      var
         hover = hovered || false,
         block = $(element).bind('mouseenter.wsShowHoverFloatArea', function(){
            hover = true;
         }).bind('mouseleave.wsShowHoverFloatArea', function(){
            hover = false;
         });

      config.autoShow = false;
      config.hoverTarget = element;

      return $ws.helpers.showFloatArea(config).addCallback(function(area){
         block.unbind('.wsShowHoverFloatArea');
         if(hover){
            area.show();
         }
         return area;
      });
   },
   /**
    * Проверяет, лежит ли элемент 2 в дом дереве элемента 1
    * @param {HTMLElement|jQuery} parent
    * @param {HTMLElement|jQuery} child
    * @returns {boolean}
    */
   contains: function(parent, child) {
      var
         contains = false,
         par = parent instanceof jQuery ? parent[0] : parent,
         chi = child  instanceof jQuery ? child[0]  : child;

      while(!contains && chi) {
         chi = chi.parentNode;
         contains = par === chi;
      }

      return contains;
   },
   /**
    * Очистка выделения на странице
    * Если передали currentContainer, и window.getSelection().getRangeAt(0).startContainer находится в нём,
    * то будет произведено selection.collapseToStart(). Иначе будет произведено selection.removeRange(), иначе
    * collapse может приводить к получению фокуса теряющим активность контролом.
    * @param {HTMLElement|jQuery} [currentContainer] Контейнер в котором должен сохраняться фокус.
    */
   clearSelection: function(currentContainer){
      if(window.getSelection){
         var
            elem,
            selection = window.getSelection(),
            collapsed = false;

         try {
            elem = selection.getRangeAt(0).startContainer;

            // Если выделение находится в активном контейнере, то просто сколлапсим его вместо очищения
            if($ws.helpers.contains(currentContainer, elem)) {
               selection.collapseToStart();
               collapsed = true;
            }
         } catch (w) {
         }

         if(collapsed) {
            return;
         }

         // Если выделение не сколлапсили в начало, то просто очистим его
         try { //If node is invisible "INVALID_STATE_ERR: DOM Exception 11", mb there's other cases
            if (selection && selection.removeRange) {
               selection.removeRange();
            } else if (selection && selection.empty) {
               selection.empty(); // ie
            }
         } catch(e) {
         }
      }
      else if(document.selection && document.selection.empty){
         try {
            document.selection.empty();
         }
         catch(e) {
         }
      }
   },
   /**
    * Располагает элемент так, чтобы он полностью помещался в окне (координаты - абсолютные, скролл учитывается
    * @param {Object} offset Объект с координатами top и left.
    * @param {Number} width Ширина объекта.
    * @param {Number} [height] Высота объекта. Если не передать, не будет переносить вниз.
    * @returns {Object} Объект с координатами top и left (тот же самый объект, что и offset).
    */
   positionInWindow: function(offset, width, height){
      var scrollTop = $ws._const.$win.scrollTop(),
         scrollLeft = $ws._const.$win.scrollLeft(),
         maxWidth = $ws._const.$win.width(),
         maxHeight = $ws._const.$win.height();

      offset.top -= scrollTop;
      offset.left -= scrollLeft;

      if(offset.left + width > maxWidth){
         offset.left = maxWidth - width;
      }
      if(offset.left < 0){
         offset.left = 0;
      }
      if(height !== undefined && offset.top + height > maxHeight){
         offset.top = maxHeight - height;
      }
      if(offset.top < 0){
         offset.top = 0;
      }

      offset.top += scrollTop;
      offset.left += scrollLeft;

      return offset;
   },

   /**
    * Вызываем DialogSelector, выполняет функцию для каждой выбранной записи,
    * если функция возвращает Deferred, то они объединяются в ParallelDeferred;
    * и ParallelDeferred дождется их завершения с любым результатом, в этом случае будет показан индикатор.
    * @param cfg - конфиг DialogSelector, не стоит использовать handlers.
    * @param func - функция вида func( record, номер_среди_выбранных, массив_выбранных_записей ).
    * @param [ctx] - контекст, чтобы можно было обращаться из фильтра браузера к полям контекста.
    * @return {$ws.proto.Deferred} стрельнет, когда будет произведен выбор, и все результаты будут обработаны.
    */
   showDialogSelector: function( cfg, func, ctx ){
      return this._showSelector( cfg, func, ctx, 'SBIS3.CORE.DialogSelector');
   },

   /**
    * Вызываем flowAreaSelector, выполняет функцию для каждой выбранной записи,
    * если функция возвращает Deferred, то они объединяются в ParallelDeferred;
    * и ParallelDeferred дождется их завершения с любым результатом, в этом случае будет показан индикатор.
    * @param cfg - конфиг flowAreaSelector.
    * @param func - функция вида func( record, номер_среди_выбранных, массив_выбранных_записей ).
    * @param [ctx] - контекст, чтобы можно было обращаться из фильтра браузера к полям контекста.
    * @return {$ws.proto.Deferred} стрельнет, когда будет произведен выбор, и все результаты будут обработаны.
    */
   showFloatAreaSelector: function( cfg, func, ctx ) {
      return this._showSelector(cfg, func, ctx, 'SBIS3.CORE.FloatAreaSelector');
   },
   /**
    * Вызываем селектор, выполняет функцию для каждой выбранной записи,
    * если функция возвращает Deferred, то они объединяются в ParallelDeferred;
    * и ParallelDeferred дождется их завершения с любым результатом, в этом случае будет показан индикатор.
    * @param cfg {object} - конфиг для селектора
    * @param func {Function} - функция вида func( record, номер_среди_выбранных, массив_выбранных_записей ).
    * @param ctx контекст, чтобы можно было обращаться из фильтра браузера к полям контекста.
    * @param moduleName {string} - подключаемый модуль
    * @returns {$ws.proto.Deferred} стрельнет, когда будет произведен выбор, и все результаты будут обработаны.
    * @private
    */
   _showSelector: function( cfg, func, ctx, moduleName ){
      var result = new $ws.proto.Deferred(),
          needIndic = false;

      $ws.core.attachInstance(moduleName, $ws.core.merge({
         context: new $ws.proto.Context().setPrevious(ctx),
         handlers: {
            onChange: function (event, records){
               var self = this;
               // если выбор только листьев, то для папки может прийти [ null ], проверка на это
               if( records && records[0] ){
                  // чтобы дождаться всех
                  var ready = new $ws.proto.ParallelDeferred({ stopOnFirstError : false });
                  $ws.helpers.forEach(records, function (){
                     var funcRes = func.apply(self, arguments),
                         isDeferred = funcRes instanceof $ws.proto.Deferred;

                     // может не нужна ансинхронная обработка, тогда индикатор не покажем
                     needIndic |= isDeferred;
                     if (isDeferred) {
                        ready.push(funcRes);
                     }
                  });
                  if( needIndic ) {
                     $ws.helpers.toggleIndicator(true);
                  }
                  this.close(ready.done().getResult());
               }
            },
            onAfterClose: function (event, res){
               //  если просто закрыли диалог, то res будет false вроде
               if(res && res instanceof $ws.proto.Deferred)
                  result.dependOn(res);
               else
                  result.callback(res);
            }
         }
      }, cfg )).addErrback(function (err){
         result.errback(err);
         return err;
      });
      result.addBoth(function (res){
         if( needIndic )
            $ws.helpers.toggleIndicator(false);
         return res;
      });
      return result;
   },

   /**
    * Возврат jQuery элемента в виде строки
    * @param {jQuery}jq
    * @return {String}
    */
   jQueryToString: function (jq){
      var res = [];
      for(var i = 0, l = jq.length; i < l; i++) {
         res.push(jq.get(i).outerHTML);
      }
      return res.join('');
   },
   parseIdentity: function(value) {
      if(value instanceof Array) {
         if(value.length === 1 && value[0] === null)
            return null;
         return value.join($ws._const.IDENTITY_SPLITTER);
      }
      else
         return value;
   },

   /**
    * Обернуть текстовые ссылки
    * Оборачивает ссылки и адреса почты строки в &lt;a&gt;&lt;/a&gt;.
    * Не оборачивает ссылки и адреса почты, которые уже находятся внутри &lt;a&gt;&lt;/a&gt;.
    * <pre>> var text = 'Посетите http://online.sbis.ru/. Вопросы и предложения отправляйте на help@sbis.ru!'; $ws.helpers.wrapURLs(text);
    * "Посетите <a target="_blank" href="http://online.sbis.ru/">online.sbis.ru</a>. Вопросы и предложения отправляйте на <a target="_blank" href="mailto:help@sbis.ru">help@sbis.ru</a>!"
    * </pre>
    * @param {String} text Текст, в котором нужно обернуть ссылки.
    * @param {Boolean} [newTab=true] Открывать ли созданные ссылки в новой вкладке.
    * @returns {String} Текст с обёрнутыми ссылками.
    */
   wrapURLs: function() {
      var
          urlRegExpString = '(https?|ftp|file):\/\/[-A-Za-zА-ЯЁа-яё0-9.]+(?::[0-9]+)?(\/[-A-Za-zА-ЯЁа-яё0-9+&@#$/%=~_{|}!?:,.;()]*)*',
          emailRegExpString = "[-a-zА-ЯЁа-яё0-9!#$%&'*+/=?^_`{|}~]+(?:\\.[-a-zА-ЯЁа-яё0-9!#$%&'*+/=?^_`{|}~]+)*@(?:[a-zА-ЯЁа-яё0-9]([-a-zА-ЯЁа-яё0-9]{0,61}[a-zА-ЯЁа-яё0-9])?\\.)*(?:aero|arpa|asia|biz|cat|com|coop|edu|gov|info|int|jobs|mil|mobi|museum|name|net|org|pro|tel|travel|[a-zА-ЯЁа-яё][a-zА-ЯЁа-яё])",
          // регулярка для поиска готовых ссылок между <a></a>, их преобразовывать не нужно
          excludeLinkString = '<[\\s]*a[\\s\\S]*?>[\\s\\S]*?<\/a>|',
          emailRegExp = new RegExp( excludeLinkString + emailRegExpString, 'gi'),
          urlRegExp = new RegExp(excludeLinkString + urlRegExpString, 'i'),
          urlStartRegExp = new RegExp( "^"+urlRegExpString, "i"),
          quotRegExp = /(&quot;)+$/i,
          cleanRegExp = /^(&nbsp;|,)+/gi,
          specialRegExp = /(&nbsp;|,|&quot;)+/i, //для поиска в ссылки &quot;,&nbsp;
          assembleUrl = function(href, linkText, newTab){
             return '<a class="asLink"' + ( newTab ? ' target="_blank"' : '') + ' href="' + href + '">' + linkText + '</a>';
          };

      // ищет в строке ссылки и оборачивает их в тег <a></a>
      function parseElement (str, newTab) {
         var
             result = [],
             linkPos = -1, //позиция начала ссылки в строке
             beforeStr = '', //текст до ссылки
             link = '',
             linkLength = 0,
             length = str.length,
             quot = false; //заключена ли ссылка в &quot;

         // распознаём ссылку
         urlRegExp.lastIndex = 0;
         //Получаем грязную ссылку (с &blank и &quot)
         str.replace(urlRegExp, function(a, protocol, href, pos) {
            linkPos = pos;
            linkLength = a.length;
            link = a;
         });
         if (linkPos !== -1) { //ссылка найдена
            beforeStr = str.substr(0, linkPos);
            if (beforeStr) {
               quot = quotRegExp.exec(beforeStr.trim()); // если ссылка заключена в &quot;
            }
            var resLink,
                trash = '', //складываем в trash текст, который находится после &blank/&quot
                linkModified = false; //ссылка отделена от &blank/&quot
            if (link.charAt(0) != '<' && str.substr(linkPos - 5, 4) !== 'src=' && str.substr(linkPos - 5, 4) !== 'url(') {
               //ссылку нашли, теперь нужно её разобрать
               link.replace(specialRegExp, function(founded, part, pos, str){
                  var foundedQuot = false, //найдена &quot;
                      trashIsUrl = false, //является ли ссылкой текст после &nbsp;
                      cleanTrash = ''; //чистый текст после &nbsp
                  if (founded == '&quot;') {
                     foundedQuot = true; //возможно ссылка обёрнута в &quot с двух сторон
                  }
                  trash = str.substr(pos, str.length);
                  if (trash) {
                     cleanTrash = trash.replace(cleanRegExp, ''); //текст после &nbsp;
                     if (cleanTrash.length > 0) {
                        // текст после &nbsp также является ссылкой?
                        trashIsUrl = urlStartRegExp.exec(cleanTrash);
                     }
                     if ( (quot && foundedQuot)  || trashIsUrl || cleanTrash.length == 0) {
                        // если заключена в &quot, или после &nbsp следует новая ссылка, или ссылка заканчивается символом &nbsp, то отделим чистую ссылку
                        link = str.substr(0, pos);
                        linkModified = true;
                     }
                  }
               });
               resLink = assembleUrl(link, link, newTab);
            }
            else {
               resLink = link;
            }
            //формируем результат
            result.push(beforeStr + resLink); //найденная ссылка
            if (linkModified) {
               result.push(trash); //будем искать ссылку в trash
            }
            linkLength += linkPos;
            if (linkLength < length) {
               result.push(str.substr(linkLength, length)); //будем искать ссылку в остальной части строки
            }
         } else {
            result.push(str);
         }
         return result;
      }

      return function (str, newTab) {
         var
             idx,
             arr;
         if (typeof str === 'string') {
            newTab = newTab === undefined ? true : newTab;
            arr = [str];
            idx = 0;
            if (arr.length) {
               while (idx < arr.length) {
                  //Тут надо разобрать элемент массива. Результат разбора - массив. Этот массив надо splice к текущему. idx должен увеличиться на один
                  Array.prototype.splice.apply(arr, [idx, 1].concat(parseElement(arr[idx], newTab)));
                  idx++;
               }
            }
            str = arr.join('');

            // Заменим электронную почту
            emailRegExp.lastIndex = 0;
            str = str.replace(emailRegExp, function (result) {
               if (result.charAt(0) === '<') {
                  // Мы нашли ссылку, ничего делать с ней не нужно.
                  return result;
               }
               return assembleUrl('mailto:' + result, result, newTab);
            });
         }
         return str;
      }
   }(),

   /**
     * Заменяет/убирает юникод символы, на аналогичные коды из win1251.
     * Актуально пока БД в кодировке win1251
   */
   escapeUnicode: function() {
      // Коды для замены utf символов аналогами из win1251
      var codeMap = {
         8210: 45
      };
      return function(str) {
         var L = [];
         for (var i=0; i<str.length; i++) {
            var ord = str.toString().charCodeAt(i);
            // диапозон win1251 оставляем
            if (ord < 128 || (ord > 1025 && ord < 1104)) {
               L.push(String.fromCharCode(ord));
            }
            else if(ord in codeMap) { // если код входит в таблицу codeMap
               L.push(String.fromCharCode(codeMap[ord]));
            }
         }
         return L.join('')
        }
   }(),

   /**
    * Открывает указанный файл при помощи FileLink плагина нотификатора.
    * <pre>
    * $ws.helpers.openFile('C:\update.txt').addCallback(function() {
    *    $ws.helpers.alert('Файл успешно открыт!');
    * }).addErrback(function() {
    *    $ws.helpers.alert('При открытии файла произошла ошибка.');
    * });
    * </pre>
    * @param {String} fileName Имя открываемого файла.
    * @returns {Deferred} Деферред с результатом выполнения функции.
    */
   openFile: function(fileName) {
      var
         result = new $ws.proto.Deferred(),
         global = (function() { return this || (0,eval)('this') })();

      global.requirejs(['js!SBIS3.CORE.PluginManager'], function (plugins) {
         plugins.getPlugin('FileLink', '1.0.0.4', {}).addCallbacks(function(plugin) {
            var def = plugin.OpenLink(fileName);
            def.addCallbacks(function(){
               result.callback();
            }, function() {
               $ws.single.ioc.resolve('ILogger').log('$ws.helpers.openFile', 'error opening file "' + fileName + '".');
               result.errback();
            });
         }, function() {
            $ws.single.ioc.resolve('ILogger').log('$ws.helpers.openFile', 'error opening file "' + fileName + '".');
            result.errback();
         });
      });
      return result;
   },
   /**
    * Обернуть файловые ссылки.
    * Оборачивает ссылки на файлы и папки в &lt;a&gt;&lt;/a&gt;.
    * <pre>
    *    var text = 'Полный список изменений расположен в файле "c:\update.txt"';
    *    $ws.helpers.wrapFiles(text);
    * </pre>
    * @param {String} string Текст, в котором нужно обернуть ссылки.
    * @returns {String} Текст с обёрнутыми ссылками.
    */
   wrapFiles: function () {
      var
         //Регулярка для поиска начала ссылки
         startChars = /(?:\b[a-z]:|\\\\[a-z0-9 %._-]+\\[a-z0-9 $%._-]+)/i,
         //Регулярка для поиска окончания ссылки, которая НЕ обрамлена в кавычки
         endLinkRegex = /[:*?"'<>|\r\n]/gi,
         //Регулярка для поиска окончания ссылки, которая обрамлена в кавычки
         endLinkWithCommaRegex = /([,.]+(([ ]|&nbsp;)*[а-я]|([ ]|&nbsp;)+[a-z]|[:*?"'<>|])|[:*?"'<>|])|[.,]+$/gi;
      function parseElement (str) {
         var
            result = [],
            idx = -1,
            beforeStr = '',
            link = '',
            startLinkLength = 0,
            linkLength = 0,
            length = str.length;
         str.replace(startChars, function(str, pos) {
            idx = pos;
            startLinkLength = str.length;
         });
         if (idx !== -1) {
            beforeStr = str.substr(0, idx);
            linkLength = str.substr(idx + startLinkLength).search(str[idx - 1] === '"' || str[idx - 1] === '\'' ? endLinkRegex : endLinkWithCommaRegex);
            if (linkLength !== -1) {
               linkLength += startLinkLength;
               link += str.substr(idx, linkLength);
               idx += linkLength;
            } else {
               link += str.substr(idx);
               idx = length;
            }
            result.push(beforeStr + '<a class="asLink" title="Открыть файл (папку)" onclick="$ws.helpers.openFile(\'' + link.replace(/\\/g, '\\\\') + '\');">' + link + '</a>');
            if (idx < length) {
               result.push(str.substr(idx, length));
            }
         } else {
            result.push(str);
         }
         return result;
      };
      return function wrapFiles(str) {
         var
            idx,
            arr;
         if (typeof str === 'string') {
            arr = [str];
            idx = 0;
            if (arr.length) {
               while (idx < arr.length) {
                  //Тут надо разобрать элемент массива. Результат разбора - массив. Этот массив надо splice к текущему. idx должен увеличиться на один
                  Array.prototype.splice.apply(arr, [idx, 1].concat(parseElement(arr[idx])));
                  idx++;
               }
            }
            return arr.join('');
         }
         return str;
      }
   }(),
   /**
    * Открытие диалога просмотра изображений
    * в модальном окне.
    * @param {Object} MouseEvent
    */
   openImageViewer: function(event) {
      var target = event.target;
      if (!$(target).parents('.ws-editor-frame').length && target.tagName === 'IMG' && target.className.indexOf('ws-fre__smile') === -1) {
         $('<img src="' + target.getAttribute('src') + '">').bind('load', function () {
            var image = this;
            image.style.margin = '0 auto';
            image.style.display = 'block';

            function getDimensions(target) {
               var
                  doc = document.documentElement,
                  // коэффициент отступа
                  perIndent = 0.05,
                  // минимальная ширина/длина модального окна
                  dialogDimensionMin = 100,
                  // ширина окна документа
                  docWidth = doc.clientWidth,
                  // длина окна документа
                  docHeight = doc.clientHeight,
                  // расчет процента превышения размера изображения над размером документа
                  perDimension = function (docDimension, imgDimension) {
                     return docDimension > imgDimension ? 1 : docDimension / imgDimension;
                  },
                  // выбор наибольшего соотношения сторон по которому производить уменьшение изображения
                  perMostSide = function (dimensions) {
                     var
                        widthPer = perDimension(dimensions.docW, dimensions.imgW),
                        heightPer = perDimension(dimensions.docH, dimensions.imgH),
                        //чем больше процент, тем меньше соотношение сторон
                        isHeightMostSide = widthPer >= heightPer,
                        mostSidePer = 0;
                     if (widthPer !== heightPer) {
                        mostSidePer = isHeightMostSide ? heightPer : widthPer;
                        if (mostSidePer > perIndent) {
                           mostSidePer -= perIndent;
                        }
                        $(image).css(isHeightMostSide ? 'height' : 'width', '100%');
                     }
                     return mostSidePer;
                  },
                  // расчёт сторон окна для оптимального просмотра изображения
                  sideDimension = function (docDimension, imgDimension, percentageRatio) {
                     if (percentageRatio) {
                        imgDimension *= percentageRatio;
                     }
                     return imgDimension < dialogDimensionMin ? dialogDimensionMin : imgDimension;
                  },
                  // процент уменьшения изображения
                  perRatio = perMostSide({
                     docW: docWidth,
                     docH: docHeight,
                     imgW: target.naturalWidth,
                     imgH: target.naturalHeight
                  });

               return {
                  width: sideDimension(docWidth, target.naturalWidth, perRatio),
                  height: sideDimension(docHeight, target.naturalHeight, perRatio)
               };
            }

            var size = getDimensions(target);

            $ws.requireModule(['SBIS3.CORE.Dialog', 'SBIS3.CORE.CloseButton']).addCallback(function(classes) {
               var
                  Dialog = classes[0],
                  CloseButton = classes[1],
                  //контейнер для кнопки закрытия модального окна
                  $btnContainer = $('<div class="ws-closeBtn">'),
                  win = $ws._const.$win,
                  dialog;

               function resizeHandler() {
                  var size = getDimensions(target);
                  dialog.setSize(size);
               }

               win.bind('resize', resizeHandler);

               dialog = new Dialog({
                  name: 'modal_picture',
                  caption: image.getAttribute('alt'),
                  border: false,
                  autoHeight: false,
                  autoWidth: false,
                  resizable: false,
                  isRelativeTemplate: true,
                  opener: $(event.target).wsControl(),
                  width: size.width,
                  height: size.height,

                  handlers: {
                     onDestroy: function() {
                        win.unbind('resize', resizeHandler);
                     }
                  }
               });

               dialog.getContainer().append(image).append($btnContainer).css('padding', 0);

               new CloseButton({
                  name: 'closeBtn',
                  element: $btnContainer,
                  parent: dialog,
                  handlers: {
                     onActivated: function(){
                        dialog.close();
                     }
                  }
               });
            });
         });
         event.stopPropagation();
      }
   },
   /**
    * Метод, который добавляет обработчик на вращение колеса мыши
    * @param {jQuery} element Элемент, над которым нужно вращать колесо мыши. В некоторых браузерах также необходимо, чтобы страница имела фокус.
    * @param {Function} callback Функция, которая будет вызвана. Получит один аргумент - event, объект jQuery-события. У него будет задано свойство wheelDelta. При вращении колеса вниз значение будет отрицательным, вверх - положительным. Значение примерно равно количеству пикселей, на которое будет проскроллен блок, но не гарантируется, что в разных браузерах это значение будет одинаковым.
    * @return {jQuery}
    */
   wheel: function(element, callback){
      var support = $ws._const.compatibility.wheel;
      return element.bind(support, function(event){
         var originalEvent = event.originalEvent;
         if( support === 'wheel' ){
            event.wheelDelta = -originalEvent.deltaY;
            if( originalEvent.deltaMode === 1 ){
               event.wheelDelta *= 40;
            }
         }
         else if( support === 'DOMMouseScroll' ){
            event.wheelDelta = -originalEvent.detail * 40;
         }
         callback.call(this, event);
      });
   },

   /**
    * Пробрасывает события колёсика из iframe в родительский документ. Обычно ифреймы захватывают мышиные события и не прокидывают их в родительский документ,
    * что не даёт возможности его крутить, если курсор расположен над ифреймом.
    * Этот метод устанавливает обработчик события колёсика, который смотрит, находится ли мышиный курсор над чем-то в ифрейме, у чего есть верт. прокрутка
    *  (чтобы можно было крутить прокручиваемые области внутри ифрейма),
    * и, если нет, то пробрасывает событие родителям ифрейма вверх по иерархии.
    * @param {jQuery|HTMLElement} iframe
    */
   dispatchIframeWheelEventsToParentDocument: function(iframe) {
      if (iframe.contentDocument) {
         var ingnoreProps = {target: true, eventPhase: true, explicitOriginalTarget: true, originalTarget: true,
                             timeStamp: true, isTrusted: true, defaultPrevented: true,  cancelable: true, bubbles: true},
             doc = $(iframe.contentDocument);

         // Attach a new onmousemove listener
         $ws.helpers.wheel(doc, function(event) {
            var target = $(event.target, doc),
               hasScrollable = target.parents().filter(function() {
                  return this.scrollHeight > this.offsetHeight && /auto|scroll/.test($(this).css('overflow-y'));
               }).length;

            if (!hasScrollable) {
               var evt = doc.get(0).createEvent("Event"),
                  e = event.originalEvent;

               evt.initEvent(e.type, true, false);

               for (var key in e) {
                  if (!(key in ingnoreProps) && key.charAt(0) === key.charAt(0).toLowerCase()) {
                     try {
                        evt[key] = e[key];
                     } catch (err) {
                        //если вдруг встретим неучтённое свойство, которое нельзя копировать
                     }
                  }
               }

               iframe.dispatchEvent(evt);
            }
         });
      }
   },

   /**
    * Пробрасывает событие нажатия на кнопку esc в родительский документ. Обычно ифреймы захватывают события и не прокидывают их в родительский документ,
    * что не даёт возможности закрыть окно по нажатию на esc.
    * Этот метод устанавливает обработчик события нажатия на esc, который смотрит, находится ли фокус над чем-то в ифрейме
    * и, если да, то пробрасывает событие родителям ифрейма вверх по иерархии.
    * @param {jQuery|HTMLElement} iframe
    */
   dispatchIframeEscEventsToParentDocument: function(iframe) {
      iframe = $(iframe).get(0);

      if (iframe.contentDocument) {
         var ingnoreProps = {target: true, eventPhase: true, explicitOriginalTarget: true, originalTarget: true,
               timeStamp: true, isTrusted: true, defaultPrevented: true,  cancelable: true, bubbles: true},
            doc = $(iframe.contentDocument);

         $ws.helpers.keyDown(doc, function(event) {
            if ( event.which == $ws._const.key.esc ) { //esc
               var evt = doc.get(0).createEvent("Event"),
                  e = event.originalEvent;

               evt.initEvent(e.type, true, false);

               $ws.helpers.forEach(e, function(value, key) {
                  if (!(key in ingnoreProps) && key.charAt(0) === key.charAt(0).toLowerCase()) {
                     try {
                        evt[key] = value;
                     } catch (err) {
                        //если вдруг встретим неучтённое свойство, которое нельзя копировать
                     }
                  }
               });

               evt.which = event.which;
               iframe.dispatchEvent(evt);
            }
         });
      }
   },

   /**
   * Функция позволяет получить инвертированную строку при неверной расскладке клавиатуры
   * @param {String} words.
   * @param {Boolean} switched_kb - true, если был ввод в начале на неверной расскладке, потом включена требуемая.
   * @returns {String}
   * @example
   * <pre>
    *    $ws.helpers.invertedInput("ckjdj") // слово
   * </pre>
   */
   invertedInput: function (words, switched_kb) {
      var keyboardEn = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?'],
          keyboardRu = ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ', 'ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э', 'я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', '.', 'Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ', 'Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', ','],
          res = '',
          i, j, k, l, l2, l3;
      function evalDirection(data) {
         var directionEn = false,
             stop = false,
             i, j, l, l2;

         for (i = 0, l = data.length; i < l; i++) {
            if (stop) break;
            for (j = 0, l2 = keyboardEn.length; j < l2; j++) {
               if (data.charAt(i) === keyboardEn[j]) {
                  directionEn = true;
                  stop = true;
                  break;
               }
            }
            for (j = 0, l2 = keyboardRu.length; j < l2; j++) {
               if (data.charAt(i) === keyboardRu[j]) {
                  directionEn = false;
                  stop = true;
                  break;
               }
            }
         }
         return directionEn;
      }

      var directionEn = evalDirection(words);

      for (i = 0, l = words.length; i < l; i++) {
         var invSymbol = null;

         if (switched_kb === true) {
            if (directionEn) {
               for (j = 0, l2 = keyboardRu.length; j < l2; j++) {
                  if (words.charAt(i) === keyboardEn[j]) {
                     invSymbol = keyboardRu[j];
                     break;
                  }
               }
            } else {
               for (j = 0, l2 = keyboardEn.length; j < l2; j++) {
                  if (words.charAt(i) === keyboardRu[j]) {
                     invSymbol = keyboardEn[j];
                     break;
                  }
               }
            }
            if (!invSymbol) {
               invSymbol = words[i];
            }
         } else {
            for (j = 0, l2 = keyboardRu.length; j < l2; j++) {
               if (words.charAt(i) === keyboardEn[j]) {
                  invSymbol = keyboardRu[j];
                  break;
               }
            }
            if (!invSymbol) {
               for (j = 0, l2 = keyboardEn.length; j < l2; j++) {
                  if (words.charAt(i) === keyboardRu[j]) {
                     invSymbol = keyboardEn[j];
                     break;
                  }
               }
            }
            if (!invSymbol) invSymbol = words[i];
         }
         res += invSymbol;
      }
      return res;
   },
   /**
    * Выполняет четыре проверки:
    * 1) object - что объект существует.
    * 2) typeof(object) === 'object'.
    * 3) property in object - что проверяемое свойство у данного объекта есть.
    * 4) typeof(object[property]) === "function".
    * @param {Object} object
    * @param {String} property
    * @return {Boolean}
    */
   hasFunctionProperty: function(object, property) {
      return object &&
         typeof(object) === 'object' &&
         property in object &&
         typeof(object[property]) === 'function';
   },
   /**
    * Выполняет транслитерацию строки. Заменяет пробелы на _, вырезает мягкий и твердый знаки
    * @param {String} string Исходная строка
    * @returns {String}
    */
   transliterate: (function() {
      var charMap = {
         'а': 'a',
         'б': 'b',
         'в': 'v',
         'г': 'g',
         'д': 'd',
         'е': 'e',
         'ё': 'e',
         'ж': 'j',
         'з': 'z',
         'и': 'i',
         'й': 'j',
         'к': 'k',
         'л': 'l',
         'м': 'm',
         'н': 'n',
         'о': 'o',
         'п': 'p',
         'р': 'r',
         'с': 's',
         'т': 't',
         'у': 'u',
         'ф': 'f',
         'х': 'h',
         'ц': 'ts',
         'ч': 'ch',
         'ш': 'sh',
         'щ': 'sch',
         'ъ': '',
         'ы': 'y',
         'ь': '',
         'э': 'e',
         'ю': 'yu',
         'я': 'ya',
         ' ': '_'
      };
      for(var k in charMap) {
         if(charMap.hasOwnProperty(k)) {
            charMap[k.toUpperCase()] = charMap[k].toUpperCase();
         }
      }
      return function(string) {
         var result = [], c, i, l;
         for(i = 0, l = string.length; i < l; i++) {
            c = string.charAt(i);
            result[i] = (c in charMap) ? charMap[c] : c;
         }
         return result.join('');
      }
   })(),
    /**
     * Проверяет поддерживается ли конкретным браузером указанный плагин
     * @param mimeType
     * @returns {boolean}
     */
   checkMimeSupport: function(mimeType) {
      if (navigator.mimeTypes) {
         return !!navigator.mimeTypes[mimeType];
      } else {
         // Невозможно точно выяснить. Скажем что поддерживается.
         return true;
      }
   },
   /**
    * Открывает диалог с результатами выполнения массовых операций
    * @param cfg - конфигурация
    * Пример кода:
    * @example
    * <pre>
    *    $ws.helpers.openErrorsReportDialog({
    *       'numSelected':cntSelected, //Количество обработанных\выделенных записей
    *       'numSuccess':cntSuccess,   //Количество успешно выполненных операций
    *       'errors':errors,        //{$ws.proto.Array} Список всех ошибок.
    *       'title': 'Итоги операции: "Отправить"' //Заголовок - опция для вывода названия операции, которая выполнялась
    *    });})
    * </pre>
    */
   openErrorsReportDialog: function(cfg){
      var
         numSelected = cfg.numSelected || 0,
         numSuccess = cfg.numSuccess || 0,
         numErrors = numSelected - numSuccess,
         errors = cfg.errors || [],
         context = new $ws.proto.Context(),
         title = cfg.title || '',
         errorsText = [],
         windowManager = $ws.single.WindowManager;

      context.setValue('Отмечено', numSelected);
      context.setValue('Обработано', numSuccess);
      context.setValue('НеВыполнено', numErrors);
      for (var i = 0, len = errors.length; i < len; i++){
         var text = errors[i] instanceof Error ? errors[i].message : errors[i];
         if ($.inArray(text, errorsText)===-1){
            errorsText.push(text);
            if (errorsText.length > 5)
               break;
         }
      }
      context.setValue('ТекстОшибки', errorsText.join('<br>'));
      $ws.core.attachInstance('SBIS3.CORE.ErrorsReportDialog', {}).addCallback(function(){
         $ws.core.attachInstance('Control/Area:Dialog', {
            template: 'js!SBIS3.CORE.ErrorsReportDialog',
            context: context,
            resizable: false,
            isReadOnly: true,
            opener: windowManager && windowManager.getActiveWindow(),
            handlers: {
               'onAfterLoad':function(e){
                  if (title) {
                     this.setTitle(title);
                  }
                  this.getChildControlByName('ТекстОшибки').setContent('<div style="color:red; overflow: auto;">'+errorsText.join('<br>')+'</div>');
                  if (numErrors===0){
                     $("div[sbisname='заголовокОшибок']").css('display','none');
                     this.getChildControlByName('НеВыполнено').hide();
                     this.getChildControlByName('ТекстОшибки').hide();
                  }
               }
            }
         });
      }.bind(this));
   },
   /**
    * Возвращает путь до картинки, лежащей в ресурсах компонента
    * @param {String} name Строка в формате "имя компонента|имя картинки"
    * @returns {String}
    */
   getImagePath: function(name){
      var
            moduleAndName = name.split('|'),
            img = moduleAndName.pop(),
            module = moduleAndName.pop();
      return $ws._const.wsRoot + 'lib/Control/' + module + '/resources/images/' + img;
   },
   /**
    * Возвращает путь с готовым блоком картинки или sprite
    * @param {String} img Ссылка на картинку или sprite
    * @returns {String}
    */
   getImageBlock: function(img){
      var imgBlock = document.createElement('div');
      var isSpriteImage = (img.indexOf('sprite:') !== -1);

      if(!isSpriteImage){
         $(imgBlock).append('<img src="' + img + '" />');
      }
      else{
         $(imgBlock).addClass(img.replace("sprite:",""));
      }
      return imgBlock;
   },
   /**
    * Мержит набор строк, переданных в аргументах, рассматривая их как значения, разделенные пробелами
    * Функция дял слияния таких DOM-аттрибутов как class.
    * @returns {Array}
    */
   mergeAttributes: function() {
      var unfilteredList, prev = null;

      unfilteredList = $ws.helpers.map(arguments, function(element){
         return String.trim(element || '').split(/\s+/);
      });

      unfilteredList = Array.prototype.concat.apply([], unfilteredList).sort();

      return $ws.helpers.filter(unfilteredList, function(item) {
         var check = item !== prev;
         prev = item;
         return check;
      });
   },
    /**
     * Помещает xhtml разметку файла в контейнер создаваемого компонента
     * Зовётся с браузера, либо с препроцессора; заполнит нужным содержимым компонент при создании.
     * @param container - контейнер.
     * @param markup - xhtml разметка файла.
     * @returns {Node}
     */
   replaceContainer: function(container, markup) {
      var
         attributes,
         rCounter = 0;

      markup = markup.replace(/(<\/?)option/g, function(str, bkt){
         rCounter++;
         return bkt + 'opt';
      });

      if (rCounter){
         BOOMR.plugins.WS.reportMessage('Configuration warning: tags <option> and <options> was deprecated, please use tags <opt> and <opts> respectively');
      }
      if("jquery" in container){ // from browser
         markup = $(markup);

         // get unique class names
         var mergingClass = $ws.helpers.mergeAttributes(container.attr('class'), markup.attr('class'));

         attributes = {};
         // copy all the attributes to the shell
         $.each(container.get(0).attributes, function(index, attribute) {
            attributes[attribute.name] = attribute.value;
         });
         // assign attributes
         markup.attr(attributes);
         // merge attribute "class"
         markup.attr('class', mergingClass.join(' '));
         // copy the data
         markup.data(container.data());
         // replace
         container.replaceWith(markup);
         // emtpy jQuery collection
         container.length = 0;
         // add markup into empty collection
         container.push(markup.get(0));
         container.attr("hasMarkup", "true");

         return container;
      }
      else{ // from preprocessor
         var
            document = container.ownerDocument,
            id = container.getAttribute('id'),
            element = document.createElement('div'),
            attrsToMerge, firstElt, values, result;

         attrsToMerge = {
            'class': 1
         };

         element.innerHTML = markup;
         firstElt = element.firstChild;

         while (firstElt && firstElt.nodeType != 1) {
            firstElt = firstElt.nextSibling;
         }

         if(firstElt) {
            attributes = container.attributes;
            for(var i = 0, l = attributes.length; i < l; i++) {
               var attr = attributes[i], attrname = attr.nodeName;
               if(attrname in attrsToMerge) {
                  values = $ws.helpers.mergeAttributes(attr.nodeValue, firstElt.getAttribute(attrname));
                  firstElt.setAttribute(attrname, values.join(' '));
               } else {
                  if(!firstElt.hasAttribute(attrname)) {
                     firstElt.setAttribute(attrname, attr.nodeValue);
                  }
               }
            }

            result = firstElt;
            container.parentNode.replaceChild(result, container);
            result.setAttribute('hasMarkup', 'true');
         } else {
            result = container;
         }

         result.setAttribute("hasMarkup", "true");
         return result;
      }
   },
    /**
     * Строит путь до компонента по его имени
     * По имени компонента, который хотим получить,
     * строит до него путь вида /ws/... или /resources/...
     * @param name - имя компонента.
     * @param plugin - плагин, который запрашиваем.
     * @returns {*}
     */
   requirejsPathResolver: function(name, plugin){
      var plugins = {
         'js': 0,
         'css': 0,
         'html': 0,
         'tmpl': 0,
         'i18n': 0,
         'json': 0,
         'dpack': 0,
         'xml': 0
      };

      function pathResolver(plugin){
         var
             path,
             ext;

         if (plugin == 'html') {
            ext = '.xhtml';
         } else if (plugin == 'i18n') {
            var currLang = $ws.single.i18n.getLang();
            ext = '/resources/lang/' + currLang + '/' + currLang + '.json'
         } else {
            ext = '.' + plugin;
         }

         if (/\//.test(name)) {
            var paths = name.split('/'),
                moduleName = paths.shift();

            path = $ws.helpers.resolveModule(moduleName);
            if (path) {
               path = path.replace(/(\w|\.)+\.module\.js$/, paths.join('/') + ext);
            } else {
               var regexp = new RegExp('\\' + ext + '$');
               path = name + ((plugin === 'js' || regexp.test(name)) ? '' : ext);
            }
         } else {
            path = $ws.helpers.resolveModule(name);
            if (!path) {
               throw new Error("Module " + name + " is not defined");
            }

            if (plugin == 'i18n') {
               path = path.replace(/(\/|\\)(\w|\.)+\.module\.js$/, ext);
            } else if (plugin != 'js') {
               path = path.replace(/(\.module\.js|\.js)$/, ext)
            }
         }


         if (typeof window !== 'undefined' && plugin == 'html') {
            var rightshash = ($ && $.cookie && $.cookie('rightshash'));
            var rid = rightshash ? '.r' + rightshash : '';

            if (path == name) {
               path = path.replace(new RegExp('\\' + ext + '$'), rid + ext);
            } else {
               path = path.replace(/(\.[^\.]+$)/, function(e) {return rid + e});
            }
         }

         return path;
      }

      if (!(plugin in plugins)) {
         throw new Error("Plugin " + plugin + " is not defined");
      }

      return pathResolver(plugin);
   },
   /**
    * Возвращает путь до модуля по его имени
    * @param {String} name имя модуля
    * @returns {string}
    */
   resolveModule : function(name){
      if ($ws._const.jsCoreModules[name]){
         return $ws._const.wsRoot + $ws._const.jsCoreModules[name];
      } else {
         var jsMod = $ws._const.jsModules[name];
         if (jsMod) {
            if (jsMod.charAt(0) == '/' || /[a-z]+:\/{2}/.test(jsMod) || jsMod.charAt(1) == ':') {
               return jsMod;
            } else {
               return $ws._const.resourceRoot + jsMod;
            }
         }
      }
      return '';
   },
   /**
    * Возвращает стек ошибки
    * @param e - ошибка
    */
   getStackTrace: function(e){
      var
         getChromeStack = function() {
            var obj = {};
            Error.captureStackTrace(obj, getChromeStack);
            return obj.stack;
         },
         stringifyArguments = function(args) {
            var result = [];
            var slice = Array.prototype.slice;
            for (var i = 0; i < args.length; ++i) {
               var arg = args[i];
               if (arg === undefined) {
                  result[i] = 'undefined';
               } else if (arg === null) {
                  result[i] = 'null';
               } else if (arg.constructor) {
                  if (arg.constructor === Array) {
                     if (arg.length < 3) {
                        result[i] = '[' + stringifyArguments(arg) + ']';
                     } else {
                        result[i] = '[' + stringifyArguments(slice.call(arg, 0, 1)) + '...' + stringifyArguments(slice.call(arg, -1)) + ']';
                     }
                  } else if (arg.constructor === Object) {
                     result[i] = '#object';
                  } else if (arg.constructor === Function) {
                     result[i] = '#function';
                  } else if (arg.constructor === String) {
                     result[i] = '"' + arg + '"';
                  } else if (arg.constructor === Number) {
                     result[i] = arg;
                  }
               }
            }
            return result.join(',');
         },
         other = function(curr) {
            var ANON = '{anonymous}', fnRE = /function\s*([\w\-$]+)?\s*\(/i, trace = [], fn, args, maxStackSize = 40;
            while (curr && curr['arguments'] && trace.length < maxStackSize) {
               fn = fnRE.test(curr.toString()) ? RegExp.$1 || ANON : ANON;
               args = Array.prototype.slice.call(curr['arguments'] || []);
               trace[trace.length] = fn + '(' + stringifyArguments(args) + ')';
               curr = curr.caller;
            }
            return trace.join('\r\n');
         },
         stack;

      if (e && e.stack) {
         stack = e.stack;
      } else {
         if (Error && Error.captureStackTrace) {
            stack = getChromeStack();
         } else if ((stack = Error().stack)) {
            return stack;
         } else {
            // ie11 thinks he is in strict mode. Yes, some kind of...
            try {
               stack = other(arguments.callee);
            } catch(e) {
               stack = '';
            }
         }
      }
      return stack;
   },
   /**
    * Преобразование массива объектов в коллекцию
    * @param {Array} arr
    * @return {Array}
    * <pre>
    *    var collection = $ws.helpers.collection([
    *       {
    *          "name": "Bob",
    *          "age": 23
    *       },
    *       {
    *          "name": "Alice",
    *          "age": 21
    *       }
    *    ]);
    * </pre>
    *    у коллекции есть событие на изменение onChange
    * <pre>
    *    collection.subscribe('onChange', function(){
    *       alert("collection changed!");
    *    });
    * </pre>
    * Также есть событие на добавление элементов onInsertItem.
    * В него приходят новые элементы и их позиции в получившейся коллекции
    * <pre>
    *    collection.subscribe('onInsertItem', function(event, elements, positions){
    *       alert("collection changed!");
    *    });
    * </pre>
    * И событие на удаление элементов onRemoveItem.
    * В него приходят удаленные элементы и позиции, которые они занимали в коллекции
    * <pre>
    *    collection.subscribe('onRemoveItem', function(event, elements, positions){
    *       alert("collection changed!");
    *    });
    * </pre>
    */
   collection: function(arr){
      arr._eventBusChannel = $ws.single.EventBus.channel({
         strictMode : true
      });
      arr._eventBusChannel.publish("onChange", "onRemoveItem", "onInsertItem", "onMove", "onChangeOrder");
      var notifyChanges = function(){
         this._eventBusChannel.notify("onChange");
      },
      notifyChagesAndChangeOrder = function(){
         notifyChanges.apply(this);
         this._eventBusChannel.notify("onChangeOrder");
      },
      toCollection = function(){
         return $ws.helpers.collection(arguments[arguments.length - 1]);
      },
      onInsertItems = function(items, indexes){
         notifyChanges.apply(this, []);
         this._eventBusChannel.notify("onInsertItem", items, indexes);
      },
      onRemoveItems = function(items, indexes){
         notifyChanges.apply(this, []);
         this._eventBusChannel.notify("onRemoveItem", items, indexes);
      },
      callMethod = function(methodName, args){
         this._eventBusChannel[methodName].apply(this._eventBusChannel, args);
         return this;
      },
      getItems = function(){
         return Array.prototype.slice.apply(arguments, [0, arguments.length - 1]);
      },
      getIndexes = function(start, length){
         var indexes = [];
         for(var i = 0; i < length; i++){
            indexes.push(start + i);
         }
         return indexes;
      };
      arr.subscribe = function(event, $handler){
         this._eventBusChannel.subscribe(event, $handler, this);
         return this;
      };
      arr.once = function(){
         return callMethod.apply(this, ["once", arguments]);
      };
      arr.unsubscribe = function(){
         return callMethod.apply(this, ["unsubscribe", arguments]);
      };
      arr.unbind = function(){
         return callMethod.apply(this, ["unbind", arguments]);
      };
      arr.slice = Array.prototype.slice.callNext(toCollection.bind(arr));
      arr.concat = Array.prototype.concat.callNext(toCollection.bind(arr));
      arr.pop = Array.prototype.pop.callNext(function(element){
         if(this._eventBusChannel.hasEventHandlers("onRemoveItem")){
            onRemoveItems.apply(this, [[element], [this.length]]);
         } else if(this._eventBusChannel.hasEventHandlers("onChange")){
            notifyChanges.apply(this, []);
         }
      });
      arr.push = Array.prototype.push.callNext(function(){
         if(this._eventBusChannel.hasEventHandlers("onInsertItem")){
            var items = getItems.apply(this, arguments),
                l = items.length,
                indexes = getIndexes(this.length - l, l);
            onInsertItems.apply(this, [items, indexes]);
         } else if(this._eventBusChannel.hasEventHandlers("onChange")){
            notifyChanges.apply(this, []);
         }
      });
      arr.reverse = Array.prototype.reverse.callNext(notifyChagesAndChangeOrder.bind(arr));
      arr.shift = Array.prototype.shift.callNext(function(){
         if(this._eventBusChannel.hasEventHandlers("onRemoveItem")){
            onRemoveItems.apply(this, [Array.prototype.slice.apply(arguments, []), [0]]);
         } else if(this._eventBusChannel.hasEventHandlers("onChange")){
            notifyChanges.apply(this, []);
         }
      });
      arr.unshift = Array.prototype.unshift.callNext(function(){
         if(this._eventBusChannel.hasEventHandlers("onInsertItem")){
            var items = getItems.apply(this, arguments).reverse(),
                indexes = getIndexes(0, items.length);
            onInsertItems.apply(this, [items, indexes]);
         } else if(this._eventBusChannel.hasEventHandlers("onChange")){
            notifyChanges.apply(this, []);
         }
      });
      arr.sort = Array.prototype.sort.callNext(notifyChagesAndChangeOrder.bind(arr));
      arr.splice = Array.prototype.splice.callNext(function(start, deleteCount){
         var ln = arguments.length,
             needNotifyChanges = true;
         if(this._eventBusChannel.hasEventHandlers("onRemoveItem") && deleteCount > 0){
            var deletedItems = arguments[ln - 1];
            needNotifyChanges = false;
            onRemoveItems.apply(this, [deletedItems, getIndexes(start, deletedItems.length)]);
         }
         if(this._eventBusChannel.hasEventHandlers("onInsertItem") && ln > 3){
            var items = Array.prototype.slice.apply(arguments, [2, ln - 1]);
            needNotifyChanges = false;
            onInsertItems.apply(this, [items, getIndexes(start, items.length)]);
         }
         if(needNotifyChanges)
            notifyChanges.apply(this, []);
         return toCollection.apply(this, arguments);
      });
      arr.move = function(from, to){
         var element = this[from];
         Array.prototype.splice.apply(this, [from, 1]);
         Array.prototype.splice.apply(this, [to, 0, element]);
         this._eventBusChannel.notify("onMove", from, to);
         notifyChagesAndChangeOrder.bind(arr).apply(this);
         return this;
      };
      return arr;
   },
   /**
    * Возвращает координаты первого нажатия по jQuery-событию
    * @param {Object} event jQuery-событие
    * @returns {{x: Number, y: Number}}
    */
   getTouchEventCoords: function(event) {
      var x = event.clientX,
         y = event.clientY;
      if (!x) {
         var touch = event.originalEvent.touch || event.originalEvent.touches[0] ||
            event.originalEvent.changedTouches[0];
         if (touch) {
            x = touch.pageX;
            y = touch.pageY;
         }
      }
      return {'x': x, 'y': y};
   },
    /**
     * <wiTag group="Данные">
     * Проверяет, является ли объект экземпляром класса, определённого в модуле.
     * @param {*} inst Проверяемый объект.
     * @param {String} moduleName Имя модуля.
     * @returns {Boolean} Результат проверки. Если модуль не определен, вернёт false.
     * @example
     * <pre>
     *     if ($ws.helpers.instanceOfModule(this, 'SBIS3.CORE.FloatArea')) {
     *        console.log('Это FloatArea');
     *     }
     * </pre>
     */
   instanceOfModule: function(inst, moduleName){
      return requirejs.defined("js!" + moduleName) ? (inst instanceof requirejs("js!" + moduleName)) : false;
   },
   instanceOfMixin: function(inst, mixin) {
      return requirejs.defined("js!" + mixin) ? Array.indexOf(inst._mixins || [], requirejs("js!" + mixin)) !== -1 : false;
   },
   /**
    * Метод для поиска только "своих" элементов верстки (не отосящихся в верстке вложенных компонентов, если они есть)
    * @param {jQuery} root корневой элемент, в котором осуществляется поиск
    * @param {String} selector селектор, по кторому осуществляется поиск
    * @returns {Array} массив найденных элементов
    * @protected
    */
   getChildContainers: function(root, selector){
      var
         topParent = root.get(0),
         components = root.find(selector),
         deadCollection = [];

      components.each(function(){
         var
            elem = this,
            p = elem;

         while((p = p.parentNode) !== null){
            if (p === topParent){
               deadCollection.push(elem);
               break;
            }
            else if(p.getAttribute("hasMarkup") == "true" || $ws.helpers.getTagName(p) == 'component'){
               break;
            }
         }
      });

      return deadCollection;
   },
   /**
    * Метод для поиска контейнеров дочерних компонентов 1ой вложенности
    * @param {jQuery} root корневой элемент, в котором осуществляется поиск
    * @returns {Array} массив найденных элементов
    * @protected
    */
   getNestedComponents: function(root){
      var
         topParent = root.get(0),
         components,
         deadCollection = [];

      if (topParent.id){
         components = topParent.querySelectorAll('[data-pid="'+ topParent.id +'"]');
         for (var i = 0, l = components.length; i < l; i++){
            deadCollection.push(components[i]);
         }
      }
      else{
         deadCollection = $ws.helpers.getChildContainers(root, '[data-component]');
      }

      return deadCollection;
   },
   /**
    * Метод для определения типа элемента.
    * @remark
    * Умеет распознавать следующие типы:
    * <ul>
    *    <li>number: 1, 0, -3, 123456;</li>
    *    <li>nan: NaN;</li>
    *    <li>infinity: Infinity, -Infinity;</li>
    *    <li>string: '', 'строчка';</li>
    *    <li>boolean: true, false;</li>
    *    <li>undefined: undefined;</li>
    *    <li>null: null;</li>
    *    <li>date: new Date();</li>
    *    <li>regexp: /регулярка/, /[0-9]{6,8}/;</li>
    *    <li>function: function(){};</li>
    *    <li>object: {}, { field1: 1, field2: '2' };</li>
    *    <li>array: [], [1, 'a'];</li>
    *    <li>error: new Error();</li>
    *    <li>element: document, document.body, document.head;</li>
    * </ul>
    * @param {*} elem Произвольный объект, тип которого необходимо определить
    * @returns {String} Строка - тип элемента elem
    * @example
    * <pre>
    * if($ws.helpers.type(style) === 'array'){
    *    styleString = style.join(';');
    * }
    * </pre>
    */
   type: function(elem) {
      // обработка null для старых версий IE
      if (elem === null)
         return 'null';

      // обработка DOM-элементов
      if (elem && (elem.nodeType === 1 || elem.nodeType === 9))
         return 'element';

      var regexp = /\[object (.*?)\]/,
         match = Object.prototype.toString.call(elem).match(regexp),
         type = match[1].toLowerCase();

      // обработка NaN и Infinity
      if (type === 'number') {
         if (isNaN(elem))
            return 'nan';
         if (!isFinite(elem))
            return 'infinity';
      }

      return type;
   },
   /**
    * Проверить видимость элемента
    * Метод выполняет для переданного элемента две проверки:
    * 1. Элемент находится в DOM (у него есть родитель 'html').
    * 2. У него нет невидимых родителей ('.ws-hidden').
    * @param   {jQuery}    elem  Проверяемый на видимость элемент.
    * @returns {boolean}         Видимость элемента.
    */
   isElementVisible: (function() {
      var invisibleRe = /\bws-hidden\b/;
      return function isElementVisibleInner(elem) {
         var classes, doc = document;

         elem = (elem && elem.jquery) ? elem[0] : elem;

         while (elem && elem.getAttribute) {
            classes = elem.getAttribute('class');
            if (classes && invisibleRe.test(classes)) {
               break;
            }
            elem = elem.parentNode;
         }
         return elem === doc;
      }
   })(),
   /**
    * Приводит innerHTML, отдаваемый ie8 к стандарту
    * @param html
    * @returns {XML|string|void}
    */
   ieFixInnerHTML: function (html){
      var
         tRegExp = /<(?:[A-Z][A-Z0-9]*)\b[^>]*>/gi,
         aRegExp = /\s+\S+=[^'"\s>]+/g;

      return html.replace(tRegExp, function(tag){
         return tag.replace(aRegExp, function(attr){
            var a = attr.split('=');
            a[1] = '"'+a[1]+'"';
            return a.join('=');
         });
      });
   },
   /**
    * Возвращает набор дефолтных опций для переданного конструктора класса
    * @param {Function} ctor
    * @param {Object} [options] набор опций, который нужно вмержить в опции по умолчанию.
    * Если не передан, метод возвращает опции по умолчанию
    * @returns {*}
    */
   resolveOptions: function(ctor, options) {
      if (ctor) {
         var
            finalConfig;

         if (ctor.prototype._initializer) {
            var cfg = {};
            ctor.prototype._initializer.call(cfg);

            if (options){
               finalConfig = cfg._options || {};
               $ws.core.propertyMerge(options, finalConfig);
               if (ctor.prototype._contentAliasing){
                  //finalConfig надо давать вторым аргументом в качестве "актуального конфига" - чтобы _contentAliasing мог понять
                  //дана ли ему в актуальном конфиге (а не дефолтом в опциях) альяснутая опция, и решить, заменять ли её на опцию content
                  finalConfig = ctor.prototype._contentAliasing.apply(cfg, [finalConfig, finalConfig]);
               }
            }
            else{
               finalConfig = cfg._options || {};
            }
         } else {
            finalConfig = $ws.core.merge(
               this.resolveOptions(ctor.superclass && ctor.superclass.$constructor),
               ctor.prototype.$protected && ctor.prototype.$protected._options || {},
               { clone:true });

            if (options){
               finalConfig = $ws.core.merge(finalConfig, options);
               if (ctor.prototype._contentAliasing){
                  finalConfig = ctor.prototype._contentAliasing(finalConfig, finalConfig);
               }
            }
         }
         return finalConfig;
      } else
         return {};
   },
   /**
    * Сравнивает два слова
    * @param {String} firstWord
    * @param {String} secondWord
    * @returns {boolean | Array}
    * Возвращает массив вида [Общая часть двух слов, хвост первого слова, хвост второго слова]
    * Если слова одинаковые вернёт false
    */
   searchSymbolsDifference: function(firstWord, secondWord) {
      if(typeof firstWord === 'string' && typeof secondWord === 'string' && firstWord.length && secondWord.length){
         for (var i = 0, len = firstWord.length; i < len; i++) {
            if (firstWord[i] !== secondWord[i]) {
               return [firstWord.substr(0, i), firstWord.substr(i), secondWord.substr(i)];
            }
         }
         return false;
      }
   },
   /**
    * Проверка на равенство двух параметров. Спецпроверка, если оба пакраметра являются массивами
    * @param {Array || SimpleType} first
    * @param {Array || SimpleType} second
    * @returns {boolean}
    */
   isEqualValues: function(first, second){
      if (first instanceof Array && second instanceof Array && first.length === second.length) {
         for (var i = 0, len = first.length; i > len; i++) {
            if (first[i] !== second[i]) {
               return false;
            }
         }
         return true;
      }
      return first === second;
   },
   /**
    * Сравнение двух дат без учета времени.
    *
    * В качестве примера, "12.12.2012 13:23:12" и "12.12.2012 14:43:52" равны.
    *
    * @param date1 - первая дата
    * @param date2 - вторая дата
    * @param sign - тип сравнения дат. Например, " >= " - первая дата больше или равна второй
    * @returns {boolean}
    */
   compareDates: function(date1, sign, date2){
      if(!date1 || !date2)
         return false;

      var equal = date1.toSQL() == date2.toSQL();

      switch(sign) {
         case '<':
            return !equal && date1 < date2;
         case '<=':
            return equal || date1 < date2;
         case '=':
            return equal;
         case '==':
            return equal;
         case '>=':
            return equal || date1 > date2;
         case '>':
            return !equal && date1 > date2;
         case '!=':
            return !equal;
         default:
            return false;
      }
   },
   wsCfgEnc: (function() {
      var table = {
         '"': '%22',
         '%': '%25',
         '&': '%26',
         '{': '%7b',
         '}': '%7d'
      }
      return function(str) {
         return str.replace(/"|'|%|&|{|}/g, function(s) {
            return s == '\'' ? '&apos;' : table[s];
         })
      }
   })(),
   wsCfgDec: (function() {
      var table = {
         '22': '"',
         '25': '%',
         '26': '&',
         '7b': '{',
         '7d': '}'
      };
      return function(str) {
         return str.replace(/%(22|25|26|7b|7d)|(&apos;)/g, function(_, code, apos) {
            return code ? table[code] : '\'';
         });
      }
   })(),
   encodeCfgAttr: function(json){
      return $ws.helpers.wsCfgEnc(JSON.stringify(json));
   },
   decodeCfgAttr: (function(){
      var global = (function() { return this || (0,eval)('this') })(),
         serializer;

      function JSONreviver(key, value){
         if (typeof value === 'string'){
            if(value.beginsWith('wsFuncDecl::')) {
               return $ws.helpers.getFuncFromDeclaration(value.replace('wsFuncDecl::', ''));
            }
            else if(value.beginsWith('wsGlobalFnDecl::')){
               var
                  sKey = value.replace('wsGlobalFnDecl::', ''),
                  result = this[sKey];
               delete this[sKey];
               return result;
            }
            else if (value.beginsWith('moduleFunc#')){
               var
                  m = value.replace(/^moduleFunc#/, '').split("/"),
                  fName = m.length > 1 ? m.pop() : '',
                  mName = m.join('/');
               try{
                  value = global.requirejs("js!" + mName)[fName];
               }
               catch(e){
                  throw new Error('Parsing moduleFunc "' + value + '" failed. Original message: ' + e.message)
               }
            } else if (value.beginsWith('datasource!')) {
               return $ws.helpers.getDataSourceFromDeclaration(value);
            }
         } else if ($ws.helpers.detectCommonDataContainer(value)) {
            return $ws.helpers.commonDataContainerReviver(key, value);
         }

         return serializer.deserialize(key, value);
      }

      return function(encodedCfg, fnStorage, noRevive){
         var
            reviver = noRevive ? undefined : JSONreviver.bind(fnStorage),
            result;

         try{
            serializer = new $ws.proto.Serializer();
            result = JSON.parse($ws.helpers.wsCfgDec(encodedCfg), reviver);
            serializer = undefined;
         }
         catch(e){
            try{
               result = JSON.parse(encodedCfg, reviver);
            }
            catch(error){
               throw new Error('Ошибка разбора конфигурации компонента!');
            }
         }

         return result;
      }
   }()),

   detectCommonDataContainer: function(value) {
      return value && value.s && value.d && (value._type == 'record' || value._type == 'recordset');
   },

   commonDataContainerReviver: function(key, value) {
      if (value._type == 'recordset' && $ws.proto.RecordSet) {
         return new $ws.proto.RecordSet({
            readerParams: {
               adapterType: 'TransportAdapterStatic',
               adapterParams: {
                  data: {
                     d: value.d,
                     s: value.s
                  }
               }
            }
         });
      } else if (value._type == 'record' && $ws.proto.Record) {
         return new $ws.proto.Record({
            row: value.d,
            colDef: value.s,
            pkValue: value._key
         });
      } else {
         return value;
      }
   },

   /**
    * Принудительно обновляет позиции элементов, отслеживаемых функцией $ws.helpers.trackElement.
    * Может потребоваться в редких случаях, когда меняются параметры body  типа overflow-y, в результате чего пропадает прокрутка у body,
    * и требуется исправить координаты элементов, абсолютно спозиционированных в body.
    * Такое происходит при показе первой панели в стеке панелей, и при скрытии последней панели из стека, и тогда, чтобы
    * не ждать обновления позиций по таймеру, чтобы элементы не "прыгали", стек панелей вызывает эту функцию.
    */
   updateTrackedElements: function() {
      $ws.single.EventBus.channel('ticker').notify('onTickFast', true);
   },

   /**
    * @param {jQuery|Element} element
    * @param {Boolean} [doTrack = true]
    * @returns {$ws.proto.EventBusChannel}
    * @type function
    */
   trackElement: (function() {

      var
         CHANNEL_HOLDER = 'ws_trackerChannelId',
         STATE_HOLDER = 'ws_trackerState';

      function setData(element, key, value) {
         var el = element[0];
         if (el) {
            el[key] = value;
         }
      }

      function getData(element, key) {
         var el = element[0];
         return el && el[key];
      }


      function attachChannel($element) {
         var
            id = $ws.helpers.randomId('tracker-'),
            channel = $ws.single.EventBus.channel(id);
         setData($element, CHANNEL_HOLDER, id);
         channel.setEventQueueSize('*', 1);
         return channel;
      }

      function isFixedState($element) {
         var isFixed = false;
         $element.parents().each(function(i, elem){
            if ($(elem).css('position') === 'fixed') {
               isFixed = true;
               return false;
            }
         });
         return isFixed;
      }

      function getState($element) {
         var isVisible = $ws.helpers.isElementVisible($element),
             isFixed = isFixedState($element),
             el = $element.get(0),
             win = $ws._const.$win,
             bcr = isVisible && el && el.getBoundingClientRect(),
             width = bcr ? bcr.right  - bcr.left : 0,
             height = bcr ? bcr.bottom - bcr.top : 0;

         return {
            visible: isVisible && (width > 0 || height > 0),
            fixed: isFixed,
            left:   bcr ? bcr.left + win.scrollLeft() : 0,
            top:    bcr ? bcr.top + win.scrollTop() : 0,
            winLeft:   bcr ? bcr.left : 0,
            winTop:    bcr ? bcr.top : 0,
            width:  width,
            height: height
         };
      }

      function tracker(force) {
         //Если есть активные пакеты, то обновлять позиции элементов не надо, поскольку они ещё не окончательные,
         //и можно сэкономить на этом расчёте при наличии активных пакетов.
         if ($ws.single.ControlBatchUpdater.haveBatchUpdate() && !force) {
            return;
         }

         var
            $element = $(this),
            channelId = getData($element, CHANNEL_HOLDER),
            lastState = getData($element, STATE_HOLDER),
            currentState, channel, pos, lastPos, isInitial = false;

         if (!lastState) {
            isInitial = true;
            lastState = {
            };
         }

         currentState = getState($element);
         channel = $ws.single.EventBus.channel(channelId);

         if (currentState.visible !== lastState.visible) {
            channel.notify('onVisible', currentState.visible);
         }

         if (currentState.visible) {
            pos = currentState;
            lastPos = lastState;
            if (pos.fixed !== lastPos.fixed || pos.left !== lastPos.left || pos.top !== lastPos.top ||
                pos.width !== lastPos.width || pos.height !== lastPos.height ||
                pos.winLeft !== lastPos.winLeft || pos.winTop !== lastPos.winTop)
            {
               channel.notify('onMove', currentState, isInitial);
            }
         }

         setData($element, STATE_HOLDER, currentState);
      }

      function beginTrackElement($element) {
         $ws.single.EventBus.channel('ticker').subscribe('onTickFast', tracker, $element[0]);
      }

      function stopTrackElement($element) {
         $ws.single.EventBus.channel('ticker').unsubscribe('onTickFast', tracker, $element[0]);
      }


      return function(element, doTrack) {
         var $element = $(element),
            channelId = getData($element, CHANNEL_HOLDER),
            channel;

         if (doTrack === undefined) {
            doTrack = true;
         }

         // Кому-то уже выдан канал
         if (channelId) {
            channel = $ws.single.EventBus.channel(channelId);
         } else {
            channel = attachChannel($element);
         }

         // Если попросили остановить отслеживание
         if (doTrack) {
            // Канала еще нет и попросили начать следить
            beginTrackElement($element);
         } else {
            stopTrackElement($element);
            setData($element, CHANNEL_HOLDER, null);
            setData($element, STATE_HOLDER, null);
            channel.destroy();
         }

         return channel;
      }
   })(),
   compareValues: function(a, b) {
      var comparisonResult
      if(a && a.equals) {
         comparisonResult = a.equals(b);
      } else {
         comparisonResult = (a == b);
      }
      return comparisonResult;
   },
   axo: (function() {

      var
         n = 'A' + [ 'ctiv' ].concat('bject').join('eXO'),
         w = (function(){ return this || (0,eval)('this'); }()),
         axo = w[n];

      if (axo) {
         return function mkAxo(name) {
            return new axo(name);
         }
      }

   })(),
   /**
    * Профайлер кода на препроцессоре
    * @param {String} profile
    * @returns function
    * @type function
    * */
   profilingStart: function (profile) {
      return nop;
   },

   /**
    * Помогает перегрузить картинку, если url не изменился, а картинка изменилась
    * @param {String|jQuery|HTMLElement}img - картинка, которую надо перерисовать
    * @param [url] - адрес, откуда брать картинку
    * @param [Function] - метод, выполняемый при возникновении ошибки
    */
   reloadImage: function(img, url, errback) {
      var element, xhr;
      if (img instanceof jQuery) {
         element = img;
      } else if (typeof img === 'string' || img instanceof HTMLElement) {
         element = $(img);
      } else {
         // Неизвестный тип
         return;
      }

      function loadImage(img, url) {
         if ($ws._const.browser.isIE8 || $ws._const.browser.isIE9 || $ws._const.browser.firefox) {
            if (url.indexOf('id=') > -1) {
               url = url.replace(/\?id=(.+?)&/, function(a, b) {
                  return a.replace(b, (new Date().getTime()));
               });
            } else {
               url += (url.indexOf('?') > -1 ? '&' : '?') + ('&t=' + (new Date().getTime()));
            }
            img.setAttribute('src', url);
         } else {
            xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onreadystatechange = function() {
               if (xhr.readyState === 4) {
                  if (xhr.status >= 200 && xhr.status < 400) {
                     img.setAttribute('originsrc', url);
                     img.setAttribute('src', $ws._const.browser.chrome ? url : URL.createObjectURL(xhr.response));
                  } else if (typeof errback === 'function') {
                     errback();
                  }
               }
            };
            xhr.send(null);
         }
      }

      function reload(elem) {
         url = url || element.attr('originsrc') || element.attr('src');
         if (!/^(data:|blob:)/.test(url)) {
            loadImage(elem, url);
         }
      }

      for (var i = 0, len = element.length; i < len; i++) {
         reload(element[i]);
      }
   },
   /**
    * Проверяет значение на соответсвие типу Деньги, дополняет нулями слева или обрезает, вещественную часть до заданной точности
    * Используется при сериализации значений в рекордсетах, рекордах, моделях итд.
    * Не используйте этот хелпер если у вас точность типа Деньги меньше 4, это будет просто число.
    * Например 1.001 руб - используем тип Number, а если 1.0015 руб то используем этот хелпер.
    *
    * @param {String} value  Значение
    * @param {Numeric} precision длинна вещественной части, по умолчанию 4
    * @returns {String}
    */
   prepareMoneyByPrecision: function (value, precision ) {
      var groups = /^\-?(\d+)(\.\d{0,})?$/.exec(value);
      if (groups !== null) {
         precision = +precision||4;
         var floatPart = groups[2],
            realPart = groups[1] ;
         if (typeof floatPart === 'undefined') {
            floatPart = '.';
         }
         var len = precision - floatPart.length + 1;
         if (len > 0) {
            for (var i=0;i < len; i++)  floatPart += '0';
         } else if(len < 0) {
            floatPart = floatPart.slice(0, len);
         }
         return realPart+floatPart;
      } else {
         $ws.single.ioc.resolve('ILogger').error('prepareMoneyByPrecision', 'Value containing not valid characters only numbers allowed.');
      }
      return value;
   }

};

/**
 * Менеджер работы с правами.
 * Класс предназначен для синхронной проверки прав на зону доступа.
 * Варианты результата проверки:
 * <ul>
 *    <li>нет прав;</li>
 *    <li>права на просмотр;</li>
 *    <li>права на просмотр и запись.</li>
 * </ul>
 * @public
 * @class $ws.single.RightsManager
 */

$ws.single.RightsManager =  /** @lends $ws.single.RightsManager.prototype */{
   /**
    * Метод проверки прав на зоны доступа.
    * Работает как на клиенте, так и в роутинге при генерации страниц на сервере.
    * @param {String|Array} zones Массив идентификаторов зон доступа.
    * @returns {Object} Объект с правами:
    * <ul>
    *    <li>{Number} access соответствует методу ПроверкаПрав.НаличиеДействия;</li>
    *    <li>{Boolean} allow соответствует методу ПроверкаПрав.ПраваНаЗонуДоступа.</li>
    * </ul>
    * Возможные значения поля access:
    * <ul>
    *    <li>0 - действие запрещено;</li>
    *    <li>1 - разрешён просмотр;</li>
    *    <li>2 - разрешены просмотр и запись.</li>
    * </ul>
    * @example
    * Такой вызов:
    * <pre>
    *    $ws.single.RightsManager.checkRights(['zone0', 'zone1', 'zone2']);
    * </pre>
    * Вернёт:
    * <pre>
    *   {
    *      zone0: {
    *         access: 0,
    *         allow: true
    *      },
    *      zone1: {
    *         access: 1,
    *         allow: false
    *      },
    *      zone2: {
    *         access: 2,
    *         allow: true
    *      }
    *   }
    * </pre>
    */
   checkRights: function (zones) {
      var r = typeof(window) == 'undefined' ? false : window.rights || false;
      var checkRights = r && !Object.isEmpty(r);
      var result = {};

      if (!(zones instanceof Array)) {
         zones = [zones];
      }

      for(var i in zones){
         if(zones.hasOwnProperty(i)) {
            var zone = zones[i];
            if (checkRights) {
               result[zone] = r && r[zone] || {allow: false, access: 0};
            } else {
               result[zone] = {allow: true, access: 2};
            }
         }
      }

      return result;
   }

};
/**
 * Получение информации о текущем пользователе
 * @class $ws.single.UserInfo
 * @public
 * @author Егоров Артем
 */
$ws.single.UserInfo = {
  /**
   * Метод получения значения по ключу
   * @param {String} key Ключ для поиска.
   * @return {String} value Значение
   * @example
   * <pre>
   *    var userName = $ws.single.UserInfo.get('ИмяПользователя');
   *    console.log(userName); // 'Демо Д.'
   * </pre>
   */
   get: function (key) {
      var info = window.userInfo || {};
      return info[key];
   }
};

/**
 * Менеджер работы с лицензией.
 * Класс предназначен для синхронной проверки параметров лицензии пользователя.
 * @public
 * @class $ws.single.LicenseManager
 */

$ws.single.LicenseManager = /** @lends $ws.single.LicenseManager.prototype */{
   /**
    * Метод получения параметров лицензии.
    * Работает и на клиенте, и в роутинге при генерации страниц на сервере.
    * @param {String|Array} params Массив идентификаторов параметров лицензии.
    * @returns {Object} Объект со значениями параметров лицензии
    * @example
    * <pre>
    *    $ws.single.LicenseManager.checkLicense(['param0', 'param1', 'param2']);
    * </pre>
    */
   checkLicense: function (params) {
      var r = typeof(window) == 'undefined' ? false : window.userLicense || false;
      var checkLicense = r && !Object.isEmpty(r);
      var result = {};

      if (!(params instanceof Array)) {
         params = [params];
      }

      for (var i in params) {
         if (params.hasOwnProperty(i)) {
            var param = params[i];
            if (checkLicense) {
               result[param] = r && r[param] || false;
            } else {
               result[param] = false;
            }
         }
      }

      return result;
   }
};

/**
 * Хранилище асинхронных событий.
 *
 * @singleton
 * @class $ws.single.Storage
 * @public
 */
$ws.single.Storage = /** @lends $ws.single.Storage.prototype */{
   _storage : {},
   /**
    *
    * @param {string} name Уникальное имя асинхронной операции.
    * @param {Function} constructor Функция, выполняющая асинхронное действие.
    * Первым и единственным аргументом принимает {@link $ws.proto.Deferred},
    * у которого по завершении должна вызвать .callback.
    * @returns {$ws.proto.Deferred}
    * @see isStored
    */
   store : function(name, constructor){
      // помещаем ресурс в хранилище и блокируем возможность повторной загрузки
      if(!(name in this._storage)) {
         if(typeof(constructor) != 'function')
            throw new Error("Constructor is not specified for newly created async resource");
         this._storage[name] = new $ws.proto.Deferred();
         // запускаем асинхронное событие
         constructor(this._storage[name]);
      }
      return new $ws.proto.Deferred().dependOn(this._storage[name]);
   },
   /**
    * Проверяет существует ли deferred с данным именем.
    * @param {string} name Имя.
    * @return {Boolean} Результат проверки существования deferred с указанным именем.
    * @see store
    */
   isStored : function(name){
      return name in this._storage;
   },
   isReady: function(name) {
      return name in this._storage ? this._storage[name].isReady() : false;
   }
};

/**
 * Сериалайзер - обеспечивает возможность сериализовать и десериализовать специальные типы
 * @class $ws.proto.Serializer
 * @public
 */
$ws.proto.Serializer = (/** @lends $ws.proto.Serializer.prototype */function() {
   var Serializer = function() {
      this._functionStorage = [];
      this._instanceStorage = {};
      this.serialize = this.serialize.bind(this);
      this.deserialize = this.deserialize.bind(this);
   }
   /**
    * @member {Number} Счетчик экземпляров
    */
   Serializer.prototype._instanceCounter = 0;

   /**
    * @member {Array.<Function>} Хранилище функций
    */
   Serializer.prototype._functionStorage = null;

   /**
    * @member {Object.<Number, Object>} Хранилище инстансов
    */
   Serializer.prototype._instanceStorage = null;

   /**
    * @member {Object.<String, RegExp>} Сигнатуры результатов сериализации через метод toJSON для стандартных JS-объектов
    */
   Serializer.prototype._patterns = {
      'Date': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-9\.]+Z$/
   };

   /**
    * Replacer для использования в JSON.stringify(value[, replacer]).
    * @param {String} name Название сериализуемого свойства
    * @param {*} value Значение сериализуемого свойства
    * @returns {*}
    */
   Serializer.prototype.serialize = function (name, value) {
      if (typeof value === 'function') {
         this._functionStorage.push(value);
         return {
            $serialized$: 'func',
            id: this._functionStorage.length - 1
            //TODO: При сериализации на сервере надо ли сохранять код функций-"не членов класса"?
            //code: $ws.single.base64.encode(value.toString())
         };
      } else if (value === Infinity) {
         return {
            $serialized$: '+inf'
         };
      } else if (value === -Infinity) {
         return {
            $serialized$: '-inf'
         };
      } else if (!isNaN(Number(name)) && Number(name) >= 0 && value === undefined) {
         // В массивах позволяем передавать undefined
         return {
            $serialized$: 'undef'
         };
      } else {
         return value;
      }
   };

   /**
    * Reviver для использования в JSON.parse(text[, reviver]).
    * @param {String} name Название десериализуемого свойства
    * @param {*} value Значение десериализуемого свойства
    * @returns {*}
    */
   Serializer.prototype.deserialize = function (name, value) {
      var result = value;

      if ((value instanceof Object) &&
         value.hasOwnProperty('$serialized$')
      ) {
         switch (value.$serialized$) {
            case 'func':
               result = this._functionStorage[value.id];
               break;
            case 'inst':
               if (this._instanceStorage[value.id]) {
                  result = this._instanceStorage[value.id];
               } else {
                  var Module = require('js!' + value.module),
                     instance;
                  if (typeof Module.prototype.fromJSON !== 'function') {
                     throw new Error('Module prototype doesn\'t have fromJSON() method');
                  }
                  instance = Module.prototype.fromJSON.call(Module, value);
                  this._instanceStorage[value.id] = instance;
                  result = instance;
               }
               break;
            case '+inf':
               result = Infinity;
               break;
            case '-inf':
               result = -Infinity;
               break;
            case 'undef':
               result = undefined;
               break;
            default:
               throw new Error('Unknown serialized type "' + value.$serialized$ + '" detected');
         }
      }

      if (typeof result === 'string') {
         for (var key in this._patterns) {
            if (this._patterns.hasOwnProperty(key) &&
               this._patterns[key].test(result)
            ) {
               switch (key) {
                  case 'Date':
                     return new Date(result);
               }
            }
         }
      }

      return result;
   };

   return Serializer;
})();

/**
 * Работа с Json-rpc
 * @class $ws.proto.RPCJSON
 * @public
 *
 */
$ws.proto.RPCJSON = $ws.core.extend({}, /** @lends $ws.proto.RPCJSON.prototype */ {
   $protected: {
      _transportPOST: null,
      _transportGET: null,
      _currentTransport: null,
      _useGet: false,
      _options: {
          /**
           * @cfg {String} Адрес сервиса БЛ
           */
         serviceUrl: ''
      }
   },
   $constructor : function(){
      this._transportPOST = $ws.single.ioc.resolve('ITransport', {
         url: this._options.serviceUrl || $ws._const.defaultServiceUrl,
         method: 'POST',
         dataType: 'json',
         contentType: 'application/json; charset=utf-8'
      });
      this._useGet = typeof window !== 'undefined' && !Object.isEmpty(window.cachedMethods || []);
   },
   _handleRPCError: function(dResult, method, args, response) {
      var
         error = response.error,
         transportError = new TransportError(
               error.message,
               '',
               error.code,
               method,
               error.details || '',
               this._options.serviceUrl || $ws._const.defaultServiceUrl,
               error.data && error.data.classid || '',
               error.type || 'error',
               error.data && error.data.addinfo || '',
               error.data && error.data.error_code || ''
         );

      $ws.single.EventBus.channel('errors').notify('onRPCError', transportError);
      dResult.errback(transportError);
   },
   _handleHTTPError: function(dResult, method, args, error) {
      var errInst,
          payload;
      if(error instanceof HTTPError) {
         var message = error.message, details = '', code = 0, classid = '', errType = '', addinfo = '', error_code = '';
         try {
            payload = JSON.parse(error.payload);
            if(payload.error) {
               message = payload.error.message || message;
               details = payload.error.details;
               code = payload.error.code;
               if(payload.error.data) {
                  classid = payload.error.data.classid || classid;
                  addinfo = payload.error.data.addinfo || addinfo;
                  error_code = payload.error.data.error_code || error_code;
               }
               errType = payload.error.type;
            }
         } catch (e) {}
         errInst = new TransportError(message, error.httpError, code, method, details, error.url, classid, errType || 'error', addinfo || '', error_code);
         $ws.single.EventBus.channel('errors').notify('onRPCError', errInst);
      } else
         errInst = error;

      dResult.errback(errInst);
      if(errInst.processed)
         error.processed = true;
   },
   _useGetMethod: function(method) {
      return Array.indexOf(window.cachedMethods || [], method) > -1;
   },
   _setGetCacheHeaders: function(req) {
      var sid = $ && $.cookie && $.cookie('sid');
      if (sid) {
         var tmp = sid.split('-'),
             client = tmp[0],
             user = tmp[1];

         req.reqHeaders['X-SbisSessionsID'] = sid;
         req.reqHeaders['X-CID'] = client;
         req.reqHeaders['X-UID'] = user;
      }
   },
   /**
    * @param {String} method
    * @param {Array|Object} args
    * @returns {$ws.proto.Deferred}
    */
   callMethod: function(method, args){
      var
         dResult = new $ws.proto.Deferred({
            cancelCallback: this.abort.bind(this)
         }),
         rpcErrorHandler = this._handleRPCError.bind(this, dResult, method, args),
         httpErrorHandler = this._handleHTTPError.bind(this, dResult, method, args),
         req = $ws.helpers.jsonRpcPreparePacket(method, args),
         dExecute;

      if (this._useGet && this._useGetMethod(method) && req.reqUrl.length < 2 * 1024) {
         this._setGetCacheHeaders(req);
         if (!this._transportGET) {
            this._transportGET = $ws.single.ioc.resolve('ITransport', {
               url: this._options.serviceUrl || $ws._const.defaultServiceUrl,
               method: 'GET',
               dataType: 'json',
               contentType: 'application/json; charset=utf-8'
            });
         }
         this._transportGET.setUrl((this._options.serviceUrl || $ws._const.defaultServiceUrl) + req.reqUrl);
         dExecute = this._transportGET.execute('', req.reqHeaders);
         this._currentTransport = this._transportGET;
      } else {
         dExecute = this._transportPOST.execute(req.reqBody, req.reqHeaders);
         this._currentTransport = this._transportPOST;
      }

      if ($ws._const.debug) {
         dExecute.addCallbacks(
            function(r){
               $ws.single.ioc.resolve('ILogger').info( method, '(args:', args, ') =', 'error' in r ? r.error : r.result );
               return r;
            },
            function(e){
               $ws.single.ioc.resolve('ILogger').info( method, '(args:', args, ') =', e ? e.details || e : e );
               return e;
            }
         );
      }

      dExecute.addCallbacks(
         function(r){
            r = r || {
               error: {
                  message: "Получен пустой ответ от сервиса",
                  code: "",
                  details: ""
               }
            };
            if('error' in r) {
               // Это 200 ОК, но внутри - ошибка или нет JSON
               rpcErrorHandler(r);
            }
            else {
               // Пробросим результат дальше
               dResult.callback(r.result);
            }
            return r;
         },
         function(e){
            // НЕ 200 ОК, какая-то ошибка, возможно не просто HTTP.
            httpErrorHandler(e);
            return e;
         }
      );

      return dResult;
   },
   /**
    * Прерывает загрузку
    */
   abort: function() {
      this._currentTransport && this._currentTransport.abort();
   }
});

/**
 * Абстрактный траспорт
 *
 * @class $ws.proto.ITransport
 * @public
 */
$ws.proto.ITransport = $ws.core.extend({}, /** @lends $ws.proto.ITransport.prototype */{
   /**
    * Отправка запроса
    *
    * @param data данные
    * @param {Object} [headers] Заголовки запроса
    * @returns {$ws.proto.Deferred}
    */
   execute: function(data, headers){
      throw new Error("Method not implemented");
   }
});

/**
 * Интерфейс предназначен для организации логирования в приложениях.
 * Работа с интерфейсом обеспечивается с помощью механизма {@link https://ru.wikipedia.org/wiki/Инверсия_управления ioc}
 * Это важно учитывать при вызове методов класса.
 * Доступ к реализации осуществляется с помощью вызова конструкции $ws.single.ioc.resolve('ILogger').
 * По умолчанию в ws для интерфейса ILogger включена реализация {@link $ws.proto.ConsoleLogger}.
 * @class $ws.proto.ILogger
 * @public
 */
$ws.proto.ILogger = $ws.core.extend({}, /** @lends $ws.proto.ILogger.prototype */{
   /**
    * Задать текст выводимого сообщения.
    * @param {String} tag Заголовок.
    * @param {String} message Текст выводимого сообщения.
    * @example
    * <pre>
    *     //в консоль будет выведено сообщение вида "tag: message" (при условии, что реализация интерфейса настроена на $ws.proto.ConsoleLogger)
    *     $ws.single.ioc.resolve('ILogger').log('tag','message')
    * </pre>
    * @see error
    * @see info
    */
   log: function(tag, message){
      throw new Error("ILogger::log method is not implemented");
   },
    /**
     * Задать текст сообщения об ошибке.
     * Текст будет со специальной пометкой "ошибка" в начале и красным цветом.
     * Удобно использовать для представления информации об ошибках и критических условиях.
     * @param tag Заголовок ошибки - краткое описание.
     * @param message Текст выводимого сообщения.
     * @example
     * <pre>
     *     //в ConsoleLogger будет выведено сообщение вида "tag: message"
     *     $ws.single.ioc.resolve('ILogger').error('tag','message')
     * </pre>
     * @see log
     * @see info
     */
   error: function(tag, message){
      throw new Error("ILogger::error method is not implemented");
   },
    /**
     * Задать тест выводимой информации.
     * Текст будет со специальной пометкой "информация" в начале.
     * Данный метод удобно использовать для предупреждения о различных событиях.
     * @example
     * <pre>
     *     $ws.single.ioc.resolve('ILogger').info('Информация для пользователя')
     * </pre>
     * @see log
     * @see error
     */
   info: function(){
      // чтобы серверный скрипт не падал, не кидаем исключение
   }
});

/**
 * Интерфейс для подключения JS/CSS-файла в контекст документа.
 *
 * @class $ws.proto.IAttachLoader
 * @public
 */
$ws.proto.IAttachLoader = $ws.core.extend({}, /** @lends $ws.proto.IAttachLoader.prototype */{
   /**
    * Подключить файл.
    * @param {String} URL URL подключаемого файла.
    * @param {$ws.proto.Deferred} resource Deferred, который будет зависеть от загрузки файла.
    * @param {Object} [options] Опции.
    */
   attach: function (URL, resource, options) {
      throw new Error("IAttachLoader::attach method is not implemented");
   }
});

/**
 * Интерфейс RightsManager-a
 */
$ws.proto.IRightsManager = $ws.core.extend({}, /** @lends $ws.proto.IRightsManager.prototype */{
   //getZoneById: nop,
   //getZoneId: nop,
   //getUserRights: nop,
   //connectRedis: nop,
   //getCachedRightsConfig: nop,
   //extractRightsConfig: nop,
   //checkHtmlRights: nop,
   //checkRights: nop,
   //checkRightsXhtml: nop,
   //getUserRightsMiddleware: nop,

   /**
    * Проверяет права на визуальный компонент
    * @param xhtml {String} разметка визуального компонента
    */
   applyRightsXhtml: function(xhtml) {
      throw new Error('IRightsManager::applyRightsXhtml method is not implemented');
   }
});

/**
 * Этот класс задаёт реализацию интерфейса ILogger по умолчанию в ws, обеспечивает работу механизма {@link https://ru.wikipedia.org/wiki/Инверсия_управления ioc}.
 * Доступ к реализации осуществляется с помощью вызова конструкции $ws.single.ioc.resolve('ILogger').
 * @class $ws.proto.ConsoleLogger
 * @extends $ws.proto.ILogger
 * @public
 */
$ws.proto.ConsoleLogger = $ws.proto.ILogger.extend(/** @lends $ws.proto.ConsoleLogger.prototype */{
   $protected: {
      _con: null
   },
   $constructor: function(){
      if("jstestdriver" in window)
         this._con = window['jstestdriver']['console'];
      else
         if("console" in window && window['console']['log'])
            this._con = window['console'];
   },
   log: function(tag, message) {
      BOOMR.plugins.WS.reportMessage(tag + ": " + message);
      if(this._con && typeof(this._con) === 'object' &&'log' in this._con && typeof(this._con.log) == 'function')
         this._con.log(tag + ": " + message + "\n");
      else {
         try {
            this._con.log(tag + ": " + message + "\n");
         } catch(e) {
         }
      }
   },
   error: function(tag, message, exception) {
      exception && exception.httpError !== 0 && BOOMR.plugins.WS.reportError(exception, tag + ": " + message, $ws.helpers.getStackTrace(exception));
      message = message + (exception && exception.stack ? '\nStack: ' + exception.stack : '');
      if(this._con && typeof(this._con) === 'object' &&'error' in this._con && typeof(this._con.error) === 'function'){
         this._con.error(tag + ": " + message);
      } else{
         try{
            this._con.error(tag + ": " + message + "\n");
         } catch(e){
            this.log(tag, message);
         }
      }
   },
   info: function(){
      if(this._con && typeof(this._con) === 'object' && 'info' in this._con && typeof(this._con.info) === 'function'){
         this._con.info.apply( this._con, arguments );
      } else {
         try{
            this._con.info.apply( this._con, arguments );
         } catch(e){
         }
      }
   }
});

/**
 * @class $ws.proto.WindowAttachLoader
 * @extends $ws.proto.IAttachLoader
 * @public
 */
$ws.proto.WindowAttachLoader = $ws.proto.IAttachLoader.extend(/** @lends $ws.proto.WindowAttachLoader.prototype */{
   attach: function (URL, resource, options) {
      var
          nodeType = URL.replace(/^.*\.([^\.]+)(\?.*)?$/ig, "$1").toLowerCase(),
          nodePath = URL,
          nodeAttr = {
             css:{
                tag : "LINK",
                rel : "stylesheet",
                type : "text/css",
                href : nodePath
             },
             js:{
                tag : "SCRIPT",
                charset: options && options.charset || 'UTF-8',
                type : "text/javascript",
                src : nodePath
             }
          }[nodeType],
          global = (function() { return this || (0,eval)('this') })();

      // создаем ресурс в контексте документа
      if (nodeAttr !== undefined) {
         var
             head = document.getElementsByTagName("head")[0],
             node = document.createElement(nodeAttr.tag),
             ready = false;
         delete nodeAttr.tag;
         for (var i in nodeAttr)
            node.setAttribute(i, nodeAttr[i]);

         var span = BOOMR.plugins.WS.startSpan('Loading resource: '+nodePath);
         node.onerror = function (exception) {
            span.stop();
            BOOMR.plugins.WS.reportError(exception, "Error loading resource: "+nodePath);
            resource.errback(new Error('attach: cannot load resource: ' + nodePath));
         };

         switch (node.tagName.toUpperCase()) {
            case "LINK":
               global.requirejs(['native-css!' + nodePath], function () {
                  span.stop();
                  resource.callback();
               }, function(error) {
                  span.stop();
                  BOOMR.plugins.WS.reportError(error, "Error loading resource: "+nodePath);
                  resource.errback(error);
               });
               break;
            case "SCRIPT":
               node.onload = node.onreadystatechange = function () {
                  var state = this.readyState;
                  if (!ready && (!state || state == "loaded" || state == "complete")) {
                     ready = true;
                     node.onload = node.onreadystatechange = null;
                     span.stop();
                     // Такой результат здесь нужен для корректной работы attachComponent,
                     // в случае, если мы сделали сначала attach, а потом attachComponent и он загрузил
                     // тот же файл
                     resource.callback('');
                  }
               };
               head.appendChild(node);
               break;
         }
      } else
         resource.errback(new Error("attach: Unknown resource type specified: " + URL));
   }
});

/**
 * Fake интерфейс Rights Manager-a
 * RightsManager, выполняющий проверку прав на серверной стороне, на клиентской не должен выполнять никакой работы
 */
$ws.proto.RightsManager = $ws.proto.IRightsManager.extend(/** @lends $ws.proto.RightsManager.prototype */{
   /**
    * Не выполняет никакой работы по проверке прав на визуальный компонент.
    * Возвращает компонент без изменений
    */
   applyRightsXhtml: skip
});

/**
 * Объект события, приходит в обработчики после {@link $ws.proto.Abstract#_notify}
 * @class
 * @name $ws.proto.EventObject
 * @public
 */
$ws.proto.EventObject = function(eventName, target) {
   this.name = this._eventName = eventName;
   this._target = target;
};

$ws.proto.EventObject.prototype = /** @lends $ws.proto.EventObject.prototype */{
   _isBubbling: true,
   _result: undefined,
   _eventName: null,
   _target: null,

   /**
    * Отменить дальнейшую обработку
    */
   cancelBubble: function(){ this._isBubbling = false; },

   /**
    * Будет ли продолжена дальнейшая обработка
    * @returns {Boolean}
    */
   isBubbling: function() { return this._isBubbling; },

   /**
    * Возвращает результат
    * @returns {*}
    */
   getResult: function(){ return this._result; },

   /**
    * Устанавливает результат
    * @param {*} r
    */
   setResult: function(r){ this._result = r; },

   /**
    * Возвращает объект, инициировавший событие
    * @returns {*}
    */
   getTarget: function(){ return this._target; }
};

/**
 * Шина для обмена сообщениями
 *
 * @class $ws.proto.EventBusChannel
 * @public
 */
$ws.proto.EventBusChannel = (function(){

   var DEFAULT_MAX_LISTENERS = 10;
  /**
   * @alias $ws.proto.EventBusChannel
   */
   function EventBusChannel(cfg) {
      this._events = {};
      this._eventQueue = [];
      this._eventsAllowed = false;
      this._isDestroyed = false;
      this._onceEvents = {};
      // Очередь нотификаций события для отложенной подписки. Обрабатывается слева-на-право. 0 индекс будет взят первым
      this._notificationQueue = {};
      this._queueSize = {};
      this._waitForPermit = cfg && cfg.waitForPermit || false;
      this._strictMode = cfg && cfg.strictMode || false;
      this._name = cfg && cfg.name || '';
      this._maxListeners = cfg && cfg.numMaxListeners || DEFAULT_MAX_LISTENERS;

      this.publish('onDestroy');
   }

   /**
    * Возвращает признак того, удалён канал или нет (отработала ли функция destroy).
    * Функция полезна в обработчиках асинхронных вызовов, обращающихся к объектам, которые могли быть удалены за время
    * асинхронного вызова. Удалённый канал обнуляет все свои подписки, и не принимает новых подписок на события.
    * @returns {Boolean} true - объект удалён, false - объект не удалён, функция {@link destroy} не отработала.
    * @see destroy
    */
   EventBusChannel.prototype.isDestroyed = function(){
      return this._isDestroyed;
   };

   /**
    * Декларирует наличие у объекта событий
    * События могут быть переданы в виде строки, в виде массива строк.
    */
   EventBusChannel.prototype.publish = function(/*$event*/){
      for (var i = 0, li = arguments.length; i < li; i++){
         var event = arguments[i];
         if (event && !event.charAt) {
            throw new Error('Аргументами функции publish должно быть несколько строк - имён событий');
         }
         this._events[event] = this._events[event] || [];
         this._notificationQueue[event] = this._notificationQueue[event] || [];
      }
      return this;
   };

   /**
    * Задачет длину орчереди для события. Если очередь не нулевая - сохраняется заданное количество последних нотификаций.
    * Новые подписчики получат все события, сохраненные в очереди.
    *
    * @param {String|Object} [event='*'] Название события или '*' для всех событий.
    * Чтобы применить ограничение для всех события можно также позвать метод с одним целочесленным аргументом.
    * Можно передать объект: ключи - события, значение - размер очереди
    * @param {Number} queueLength Желаемая длина очереди
    *
    * @example
    * <pre>
    *    // Событие onFoo - очередь 3
    *    channel.setEventQueueSize('onFoo', 3);
    *    // Для всех событий очередь 5, для onFoo - 3, onBar - 4
    *    channel.setEventQueueSize({
    *       onFoo: 3,
    *       onBar: 4,
    *       '*': 5
    *    });
    *    // Для всех событий очередь 5
    *    channel.setEventQueueSize('*', 5); // эквивалентно следующему
    *    channel.setEventQueueSize(5);
    * </pre>
    */
   EventBusChannel.prototype.setEventQueueSize = function(event, queueLength) {
      var eventList;

      if (typeof event == 'number') {
         queueLength = event;
         event = '*';
      }

      if (typeof event == 'object') {
         $ws.helpers.forEach(event, function(limit, event) {
            this.setEventQueueSize(event, limit);
         }, this);

         return;
      }

      this._queueSize[event] = queueLength;

      if (event == '*') {
         eventList = Object.keys(this._notificationQueue);
      } else {
         eventList = [event];
      }

      $ws.helpers.forEach(eventList, function(event) {
         if (this._notificationQueue[event] && this._notificationQueue[event].length > queueLength) {
            this._notificationQueue[event].slice(0, queueLength);
         }
      }, this);
   };

   EventBusChannel.prototype._notifyToHandler = function(eventName, eventState, handler, args) {
      try {
         args = [eventState].concat(args);
         if (handler && (!handler.ctx || !handler.ctx.isDestroyed || !handler.ctx.isDestroyed())) {
            handler.fn.apply(handler.ctx, args);
         }

         if(!eventState.isBubbling() || !this._events) {
            return false;
         }
      } catch(e) {
         $ws.single.ioc.resolve('ILogger').error(
            (handler.ctx && handler.ctx.describe) ? handler.ctx.describe() : 'Unknown Object',
            'Event handler for "' + eventName + '" returned error: ' + e.message,
            e);
      }
   };

   /**
    * Извещает всех подписантов события. Этот метод аналогичен методу {@link notifyWithTarget} с параметром target === undefined.
    * Все аргументы после имени события будут переданы подписантам.
    * @param {string} event Имя события.
    * @param [arg1, [...]] Параметры, получаемые подписантами.
    * @returns {Boolean|String|Object} Результат выполнения цепочки.
    */
   EventBusChannel.prototype.notify = function (event/*, payload*/) {
      var args = new Array(arguments.length - 1);
      for(var i = 1; i < arguments.length; i++) {
         args[i - 1] = arguments[i];
      }
      return this._notifyWithTarget(event, undefined, args);
   };

   /**
    * Извещает всех подписантов события
    * Все аргументы после имени события будут переданы подписантам.
    * @param {string} event Имя события.
    * @param {*} target Объект, на котором произошло событие.
    * @param [arg1, [...]] Параметры, получаемые подписантами.
    * @returns {Boolean|String|Object} Результат выполнения цепочки.
    */
   EventBusChannel.prototype.notifyWithTarget = function (event, target/*, payload*/) {
      var args = new Array(arguments.length - 2);
      for(var i = 2; i < arguments.length; i++) {
         args[i - 2] = arguments[i];
      }
      return this._notifyWithTarget(event, target, args);
   };

   EventBusChannel.prototype._notifyWithTarget = function (event, target, args) {
      var
         result = undefined,
         queueLimit = this._queueSize[event] || this._queueSize['*'] || 0,
         notifyQueue, eventState, eventSaved, i, l, ln, handlers, argsCopy;

      if (this._waitForPermit && !this._eventsAllowed) {
         // Здесь и далее намеренно не используется Array.prototype.slice или что-то подобное
         // см. https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
         argsCopy = new Array(arguments.length);
         for(i = 0, l = arguments.length; i < l; i++) {
            argsCopy[i] = arguments[i];
         }
         this._eventQueue.push(argsCopy);
      }
      else {
         handlers = this._events[event];

         if (!handlers) {
            if (this._strictMode) {
               throw new Error('Event "' + event + '" have not published yet');
            }
            else {
               handlers = [];
               this._events[event] = handlers;
            }
         }

         ln = handlers.length;
         if (ln !== 0) {
            eventSaved = event;
            eventState = new $ws.proto.EventObject(event, target);

            for (i = 0; i < ln; i++) {
               if (this._notifyToHandler(eventSaved, eventState, handlers[i], args) === false) {
                  break;
               }
            }
            result = eventState.getResult();
         }

         // Если включена запись нотификаций для событий...
         if (queueLimit > 0) {
            notifyQueue = (this._notificationQueue[event] = this._notificationQueue[event] || []);
            // Если в очереди накопилось больше чем положено
            if (notifyQueue.length >= queueLimit) {
               // Уберем первый элемент
               notifyQueue.shift();
            }
            // Добавим новый в конец очереди
            notifyQueue.push([target, args]);
         }
      }
      return result;
   };

   /**
    * Показывает, включена ли отсылка событий.
    * Если она отключена, то при вызовах notify события будут накапливаться в очереди, и отсылаться
    * после вызова метода allowEvents. Подробнее см. метод allowEvents.
    * @returns {boolean}
    */
   EventBusChannel.prototype.eventsAllowed = function () {
      return this._eventsAllowed;
   };

   /**
    * Включает отсылку событий, и отсылает все события, скопленные до вызова этого метода, пока отсылка была выключена.
    * Откладывание отсылки событий используется при конструировании контролов, чтобы события остылались после окончания работы всей
    * цепочки конструкторов по иерархии наследования.
    */
   EventBusChannel.prototype.allowEvents = function(){
      if(this._eventsAllowed === false) {
         this._eventsAllowed = true;
         for(var i = 0, l = this._eventQueue.length; i < l; i++){
            this._notifyWithTarget.apply(this, this._eventQueue[i]);
         }
         this._eventQueue.length = 0;
      }
   };

   /**
    * <wiTag group="Управление">
    * Выполнит обработчик события единожды
    * @param {String} event Имя события, при котором следует выполнить обработчик.
    * @param {Function} handler Функция-обработчик события.
    * @param {Object} ctx Контекст, в котором выполнится обработчик.
    * <pre>
    *    eventBusChannel.once('onSome', function(event){
    *       //do smth
    *    });
    * </pre>
    */
   EventBusChannel.prototype.once = function(event, handler, ctx, first) {
      function handlerWrapper() {
         self._unsubscribeFromOnce(event, handler, ctx, handlerWrapper);
         handler.apply(this, arguments);
      }

      var
         self = this,
         object = {
            handler: handler,
            ctx: ctx,
            wrapper: handlerWrapper
         };

      if(!this._onceEvents[event]) {
         this._onceEvents[event] = [];
      }
      this._onceEvents[event].push(object);

      return this.subscribe(event, handlerWrapper, ctx, first);
   };
   /**
    * <wiTag group="Управление">
    * Добавить обработчик на событие.
    * Подписывает делегата на указанное событие текущего объекта.
    * @param {String} event Имя события, на которое следует подписать обработчик.
    * @param {Function} handler Функция-делегат, обработчик события.
    * @param {Object} ctx Контекст, в котором выполнится обработчик.
    * @throws Error Выкидывает исключение при отсутствии события и передаче делегата не-функции.
    * @example
    * <pre>
    *    eventBusChannel.subscribe('onSome', function(event){
    *       //do smth
    *    });
    * </pre>
    */
   EventBusChannel.prototype.subscribe = function(event, handler, ctx, first){

      var handlerObject;

      if (this._isDestroyed) {
         throw new Error("Trying to subscribe event '" + event + "', but EventBusChannel is destroyed");
      } else if (this._strictMode && !(event in this._events)) {
         throw new Error("Event '" + event + "' is not registered");
      } else {
         if (typeof handler === 'function'){
            /**
             * Да, ты совершенно прав. Этот код делает ничего.
             *
             * Это костыль против бага оптимизирующегно компилятора в Chrome 33 версии.
             * Оптимизация, а затем де-оптимизация кода приводила к том, что в момент деоптимизации
             * все шло не так как было задумано и толи с массива пропадает push толи массив перестает быть массивом...
             *
             * Блок кода ниже не дает компилятору оптимизировать код из-за наличия arguments
             *
             * Это необходимо выпилить после того, как Chrome 33 пропадет с наших радаров...
             */
           /* if (arguments[100]) {
               void(0);
            }*/

            handlerObject = {
               fn : handler,
               ctx : ctx
            };

            this._events[event] = this._events[event] || [];
            this._events[event].push(handlerObject);

            if (false && this._events[event].length > this._maxListeners) {
               $ws.single.ioc.resolve('ILogger').error(
                     'EventBusChannel',
                     'Потенциальная проблема производительности! ' +
                     'На событие "' + event + '" канала "' + (this._name || 'noname') + '" добавлено слишком много обработчиков!');
            }

            if (this._notificationQueue[event] && this._notificationQueue[event].length) {
               $ws.helpers.forEach(this._notificationQueue[event], function (savedEvent) {
                  var
                     target = savedEvent[0],
                     args = savedEvent[1],
                     eventState = new $ws.proto.EventObject(event, target);

                  this._notifyToHandler(event, eventState, handlerObject, args);
               }, this);
            }

            return this;
         } else {
            throw new TypeError("Event '" + event + "' has unexpected handler");
         }
      }
   };

   /**
    * Отписаться от обработчиков, добавленных через once
    * @param {String}   event       Имя события.
    * @param {Function} handler     Функция-обработчик события.
    * @param {Object}   [ctx]       Контекст, в котором выполнялся обработчик.
    * @param {Function} [wrapper]   Сама обёртка, если отписываемся из уже стрельнувшего через once события.
    * @private
    */
   EventBusChannel.prototype._unsubscribeFromOnce = function(event, handler, ctx, wrapper) {
      var
         i, elem,
         events = this._onceEvents[event],
         found = [];
      if(!events) {
         return;
      }
      for(i = 0; i < events.length; ++i) {
         elem = events[i];
         if(elem.handler === handler && (!ctx || elem.ctx === ctx) && (!wrapper || wrapper === elem.wrapper)) {
            found.push(i);
         }
      }
      for(i = found.length - 1; i >= 0; --i) {
         this.unsubscribe(event, events[found[i]].wrapper, ctx);
         this._onceEvents[event].splice(found[i],1);
      }
   };

   /**
    * <wiTag group="Управление">
    * Снять подписку заданного обработчика с заданного события
    * @param {String} event Имя события.
    * @param {Function} handler Функция-обработчик события.
    * @param {Object} [ctx] Контекст, в котором выполнялся обработчик.
    * <pre>
    *    eventBusChannel.unsubscribe('onSome', function(event){
    *       //do smth
    *    });
    * </pre>
    */
   EventBusChannel.prototype.unsubscribe = function(event, handler, ctx) {
      if (!handler || typeof handler !== 'function'){
         throw new TypeError("Unsubscribe: second argument is not a function");
      }
      var handlers = this._strictMode ? this._events[event] : this._events[event] = this._events[event] || [];
      if (handlers) {
         this._unsubscribeFromOnce(event, handler, ctx);
         handlers = this._events[event];
         var newHandlers, i, last, ln;
         for (i = 0, ln = handlers.length; i !== ln; i++) {
            if (handlers[i]["fn"] === handler && (handlers[i]["ctx"] && ctx ? handlers[i]["ctx"] === ctx : true)) {
               newHandlers = handlers.slice(0, i);

               i++;
               last = i;
               for (; i !== ln; i++) {
                  if (handlers[i]["fn"] === handler && (handlers[i]["ctx"] && ctx ? handlers[i]["ctx"] === ctx : true)) {
                     if (last !== i)
                        newHandlers = newHandlers.concat(handlers.slice(last, i));
                     last = i + 1;
                  }
               }

               if (last !== ln) {
                  newHandlers = newHandlers.concat(handlers.slice(last, ln));
               }

               this._events[event] = newHandlers;
               break;
            }
         }

         return this;
      } else {
         throw new Error("Event '" + event + "' is not registered");
      }
   };

   /**
    * <wiTag group="Управление">
    * Снять все подписки со всех событий.
    */
   EventBusChannel.prototype.unsubscribeAll = function() {
      $ws.helpers.forEach(this._events, function (handlers, eventName, events) {
         if (events[eventName]) {
            events[eventName].length = 0;
         }
      });
   };

   /**
    * <wiTag group="Управление">
    * Возвращает имя канала
    * @returns {String} Возвращает имя контрола, на который применили метод.
    * @example
    * <pre>
    *     class.getName();
    * </pre>
    */
   EventBusChannel.prototype.getName = function(){
      return this._name;
   };

   EventBusChannel.prototype.destroy = function(){
      //Нужно делать notifyWithTarget, чтобы у тех, кто подписался прямо на этот EventBusChannel, правильно
      //работала автоотписка (чтобы там таргет в событии onDestroy был правильный)
      this.notifyWithTarget('onDestroy', this);

      this.unsubscribeAll();
      if (this._name) {
         $ws.single.EventBus.removeChannel(this._name);
      }
      this._isDestroyed = true;
   };

   /**
    * <wiTag group="Управление">
    * Снимает все обработчики с указанного события
    * @param {String} event Имя события.
    * <pre>
    *    eventBusChannel.unbind('onSome');
    * </pre>
    */
   EventBusChannel.prototype.unbind = function(event){
      this._events[event] = [];

      return this;
   };

   /**
    * <wiTag group="Управление">
    * Проверка наличия указанного события
    * @param {String} name Имя события.
    * @return {Boolean} Есть("true") или нет("false") событие у класса.
    * <pre>
    *    if(eventBusChannel.hasEvent('onSome'))
    *       eventBusChannel.unbind('onSome');
    * </pre>
    */
   EventBusChannel.prototype.hasEvent = function(name){
      return !this._strictMode || this._events && !!this._events[name];
   };

   /**
    * <wiTag group="Управление">
    * Возвращает список зарегистрированных событий
    * @return {Array} Массив зарегистрированных событий.
    * @example
    * <pre>
    *     eventBusChannel.getEvents();
    * </pre>
    */
   EventBusChannel.prototype.getEvents = function(){
      return Object.keys(this._events);
   };

   /**
    * <wiTag group="Управление">
    * Проверка наличия обработчиков на указанное событие
    * @param {String} name Имя события.
    * @return {Boolean} Есть("true") или нет("false") обработчики.
    * @example
    * <pre>
    *     class.hasEventHandlers();
    * </pre>
    */
   EventBusChannel.prototype.hasEventHandlers = function(name){
      return !!this._events[name] && this._events[name].length > 0;
   };

   /**
    * <wiTag group="Управление">
    * Получение списка обработчиков, подписанных на событие
    * @param {String} name Имя события.
    * @return {Array} Массив функций-обработчиков.
    * @example
    * <pre>
    *     var handlers = eventBusChannel.getEventHandlers('onSomeEvent');
    *     log('Событие onSomeEvent имеет ' + handlers.length + ' обработчиков');
    * </pre>
    */
   EventBusChannel.prototype.getEventHandlers = function(name){
      return $ws.helpers.map(this._events[name] || [], function(i){ return i.fn });
   };

   return EventBusChannel;

})();

/**
 * @class $ws.single.EventBus
 * @public
 * @single
 */
$ws.single.EventBus = /** @lends $ws.single.EventBus */{
   _channels : {},
   /**
    * Возвращает канал с указанным именем, если он есть, в противном случае создает новый
    * <wiTag group="Управление">
    * @param [name] - имя канала.
    * @param [options] - опции канала.
    * @returns {$ws.proto.EventBusChannel}
    */
   channel : function(name, options){
      var channel;

      if (arguments.length == 1 && typeof name == "object"){
         options = name;
         name = '';
      }

      if (name) {
         options = options || {};
         options.name = name;

         return this._channels[name] = this._channels[name] || new $ws.proto.EventBusChannel(options);
      } else {
         return new $ws.proto.EventBusChannel(options);
      }
   },
   /**
    * Удаляет канал с указанным именем
    * <wiTag group="Управление">
    * @param {String} name имя канала.
    */
   removeChannel : function(name){
      delete this._channels[name];
   },
   /**
    * Проверяет наличие канала с указанным имененм
    * <wiTag group="Управление">
    * @param {String} name имя канала.
    * @returns {Boolean}
    */
   hasChannel: function(name){
      return this._channels[name] !== undefined;
   },

   /**
    * Отдаёт "глобальный" канал, в котором дублируются все события контролов, и сигналятся некоторые "глобальные" события,
    * происходящие при изменении некоторых параметров документа, могущих повлиять на позиции некоторых контролов, например, лежащих в body.
    * Подробное описание смотри в объекте $ws.single.EventBusGlobalChannel.
    * @returns {$ws.proto.EventBusChannel}
    */
   globalChannel: function() {
      return $ws.single.EventBus.channel('Global');
   }
};

/**
 * "Глобальный" канал, в котором дублируются все события контролов, и сигналятся некоторые "глобальные" события,
 * происходящие при изменении некоторых параметров документа, могущих повлиять на позиции некоторых контролов, например, лежащих в body.
 * Этот объект здесь объявлен только для удобства документирования, поскольку в описании метода $ws.single.EventBus.globalChannel
 * нельзя указать события.
 * @type {$ws.proto.EventBusChannel}
 */
/**
 * @lends $ws.single.EventBusGlobalChannel
 * @event onBodyMarkupChanged Событие, возникающее при изменении внутренних размеров body или каких-то других элементов
 * вёрстки, заданных в html-шаблоне (не в компонентах). Такие изменения происходят, например, при показе или скрытии стека панелей:
 * у body меняется margin и overflow-y. Некоторым контролам может потребоваться при этом изменении подогнать свою позицию под новые
 * параметры вёрстки body.
 */
$ws.single.EventBusGlobalChannel = $ws.single.EventBus.globalChannel();

/**
 * Абстрактный класс.
 * Здесь живет событийная модель.
 * Все, кому нужны события, должны наследоваться от него.
 *
 * EventObject
 * В обработчик события первым параметром ВСЕГДА приходит объект, используя который можно работать с текущим событием.
 * Событию можно запретить всплытие(Bubbling) и сменить результат.
 * В зависимости от результата оно продолжит выполняться дальше, либо перестанет.
 * Интерфейс EventObject:
 * void     cancelBubble()    - метод, запрещающий дальнейшее всплытие.
 * boolean  isBubbling()      - получение статуса всплытия.
 * boolean  getResult()       - получение результата события.
 * void     setResult(result) - смена результата события.
 *
 * @class $ws.proto.Abstract
 * @public
 */
$ws.proto.Abstract = $ws.core.extend({}, /** @lends $ws.proto.Abstract.prototype */{
   /**
    * @event onInit При инициализации класса
    * Событие, возникающее непосредственно после построения экземпляра класса через attachInstance.
    * <wiTag group="Управление">
    * @param {$ws.proto.EventObject} eventObject Дескриптор события.
    * @return Результат не обрабатывается.
    * @example
    * 1. При инициализации класса вывести об этом информацию в элемент с идентификатором status.
    * <pre>
    *    onInit: function(eventObject) {
    *       $('#status').html('Инициализация прошла успешно');
    *    }
    * </pre>
    *
    * 2. При инициализации контрола проверить значение поля контекста.
    * При необходимости запретить пользователю взаимодействовать с контролом.
    * <pre>
    *    control.subscribe('onInit', function(eventObject) {
    *       var value = this.getLinkedContext().getValue('РазрешеноРедактирование');
    *       this.setEnabled(!!value);
    *    });
    * </pre>
    */
   /**
    * @event onReady При готовности класса
    * Событие, возникающее при готовности класса, что означает:
    * 1. С экземпляром класса уже можно полноценно работать.
    * 2. Все дочерние элементы построены и доступны для взаимодействия.
    * <wiTag group="Управление">
    * @param {$ws.proto.EventObject} eventObject Дескриптор события.
    * @return Результат не обрабатывается.
    * @example
    * 1. При готовности класса вывести об этом информацию в элемент с идентификатором status.
    * <pre>
    *    onReady: function(eventObject) {
    *       $('#status').html('Готовность к работе');
    *    }
    * </pre>
    *
    * 2. При готовности табличного браузера (tableView) изменить фильтр.
    * <pre>
    *    tableView.subscribe('onReady', function(eventObject) {
    *       this.setQuery({'Тип': 'Все'});
    *    });
    * </pre>
    *
    * 3. При готовности контрола (control) установить открытие группы аккордеона в верхней позиции.
    * <pre>
    *    control.subscribe('onReady', function(eventObject) {
    *       this.getChildControlByName('Аккордеон').setDragToTop(true);
    *    });
    * </pre>
    */
   /**
    * @event onDestroy При уничтожении экземпляра класса
    * Событие, возникающее при уничтожении экземпляра класса.
    * Происходит, например, при закрытии страницы или смене шаблона области по шаблону.
    * <wiTag group="Управление">
    * @param {$ws.proto.EventObject} eventObject Дескриптор события.
    * @return Результат не обрабатывается.
    * @example
    * 1. При уничтожении экземпляра класса вывести об этом информацию в элемент с идентификатором status.
    * <pre>
    *    onDestroy: function(eventObject) {
    *       $('#status').html('Экземпляр класса уничтожен');
    *    }
    * </pre>
    *
    * 2. При смене шаблона Области по шаблону (template) сбросить группу флагов (groupCheckbox) к значениям по умолчанию.
    * <pre>
    *    template.subscribe('onDestroy', function(eventObject) {
    *       var value = groupCheckbox.getDefaultValue();
    *       groupCheckbox.setValue(value);
    *    });
    * </pre>
    */
   $protected: {
      _eventBusChannel : null,
      _isDestroyed : false,
      /**
       * Показывает, окончен ли процесс конструирования и инициализации этого объекта.
       */
      _isInitialized: false,
      /**
       * @cfg {object} handlers Обработчики событий
       * <wiTag group="Управление">
       * Обработчик - это функция, выполняемая при возникновении определённого события.
       *
       * При каждом событии может существовать несколько обработчиков.
       * В таком случае они будут выполняться последовательно, согласно порядку их объявления.
       *
       * @example
       * Изменить подпись флага в зависимости от его состояния.
       * <pre>
       *    $ws.core.attachInstance('SBIS3.CORE.FieldCheckbox', {
       *       element: 'left2',
       *       name: 'Флаг3',
       *       cssClassName: 'classic',
       *       tabindex: 4,
       *       caption: 'Изменить текст подписи флага?',
       *       handlers: {
       *          //обработчик получает значение флага, в которое его установили
       *          onValueChange: function(event, value) {
       *             this.setCaption(value ? 'Текст подписи флага изменён!' : 'Изменить текст подписи флага?');
       *          }
       *       }
       *    });
       * </pre>
       */
      _handlers : {},
      _subscriptions: [],
      _subDestroyControls: [],

      _options : {
         eventBusId : null
      }
   },
   $constructor : function(cfg){
      if (cfg && cfg.handlers && typeof cfg.handlers == "object"){
         this._handlers = cfg.handlers;
      }
      this._publish('onInit', 'onInitComplete', 'onReady', 'onDestroy');
   },

   /**
    * Подписка на событие у другого контрола (или канала событий - см. EventBusChannel), с автоматической отпиской при
    * разрушении объекта, который подписывается, или того, на чьё событие происходит подписка.
    * @param {$ws.proto.Abstract|$ws.proto.Control|$ws.proto.EventBusChannel} control Объект, на чьё событие происходит подписка
    * @param {String} event Название события.
    * @param {Function} handler Обработчик события, который выполняется в контексте объекта (первый параметр, control).
    * В этом случае this возвратит сам объект.
    * @return {$ws.proto.Abstract} Возвращает этот же объект.
    */
   subscribeTo: function(control, event, handler) {
      return this._subscribeTo(control, event, handler, false);
   },

   /**
    * Подписка на событие у другого контрола (или канала событий - см. EventBusChannel), с автоматической отпиской
    * после срабатывания события, а также при разрушении объекта, который подписывается, или того, на чьё событие происходит подписка.
    * @param {$ws.proto.Abstract|$ws.proto.Control|$ws.proto.EventBusChannel} control Объект, на чьё событие происходит подписка
    * @param {String} event Событие
    * @param {Function} handler Обработчик
    * @return {$ws.proto.Abstract} Возвращает этот же объект.
    */
   subscribeOnceTo: function(control, event, handler) {
      return this._subscribeTo(control, event, handler, true);
   },

   _subscribeTo: function(control, event, handler, once) {
      if (!control.isDestroyed() && !this.isDestroyed()) {
         if (typeof handler !== 'function'){
            throw new Error("Аргумент handler у метода subscribeTo должен быть функцией");
         }

         var sub, onceWrapper, contr;
         control[once ? 'once' : 'subscribe'](event, handler);

         if (once) {
            onceWrapper = function() {
               this._unsubscribeFrom(control, event, handler, onceWrapper);
            }.bind(this);

            this._subscriptions.push({
               handler: handler,
               control: control,
               event: event,
               onceWrapper: onceWrapper
            });

            control.once(event, onceWrapper);
         }
         else {
            sub = $ws.helpers.find(this._subscriptions, function (sub) {
               return sub.control === control && sub.handler === handler &&
                      sub.event   === event   && sub.onceWrapper === undefined;
            });

            if (!sub) {
               this._subscriptions.push({
                  handler: handler,
                  control: control,
                  event: event
               });
            }
         }

         contr = $ws.helpers.find(this._subDestroyControls, function(sub) {
            return sub.control === control;
         });

         if (!contr) {
            var onDestroy = function(event) {
               //нужно отписываться только на onDestroy своего контрола
               if (event.getTarget() === control) {
                  this.unsubscribeFrom(control);
               }
            }.bind(this);
            this._subDestroyControls.push({control: control, handler: onDestroy});

            //тут я ожидаю, что отписка внутри notify('onDestroy') не испортит уже выполняющуюся цепочку onDestroy
            //(см. EventBusChannel.notify) - иначе пользовательские onDestroy, подписанные после служебного onDestroy,
            //не выполнятся, поскольку служебный onDestroy отписывает все мои обработчики всех событий этого контрола.
            control.subscribe('onDestroy', onDestroy);
         }
      }

      return this;
   },

   /**
    * Отписка от события объекта, на которое была подписка методом subscribeTo.
    * @param {$ws.proto.Abstract|$ws.proto.Control|$ws.proto.EventBusChannel} [control] Объект, от чьего события происходит отписка.
    * Если не указан, то отписка пойдёт по всем подписанным контролам по параметрам event и handler.
    * @param {String} [event] Событие. Если не указано, то будет отписка от всех событий объекта, указанного в параметре control,
    * или всех подписанных объектов (если параметр control не передан)
    * Если при этом указан обработчик - аргумент handler,
    * то отписан от всех подписанных событий будет именно этот обработчик, а остальные, если они есть, останутся.
    * @param {Function} [handler] Обработчик. Если не указан, то будут отписаны все обработчики события,
    * указанного в аргументе event, или вообще все обработчики всех событий, если аргумент event не задан.
    * @return {$ws.proto.Abstract} Возвращает этот же объект.
    */
   unsubscribeFrom: function(control, event, handler) {
      return this._unsubscribeFrom(control, event, handler);
   },

   _unsubscribeFrom: function(control, event, handler, onceWrapper) {
      var self = this;

      function filterSubs(needUnsub) {
         return $ws.helpers.filter(self._subscriptions, function(sub) {
            var ok = (control === undefined || control === sub.control) &&
                     (event   === undefined || event   === sub.event)   &&
                     (handler === undefined || handler === sub.handler) &&
                     (onceWrapper === undefined || onceWrapper === sub.onceWrapper);

            return needUnsub ? ok : !ok;
         });
      }

      function filterControlDestroys(needUnsub) {
         return $ws.helpers.filter(self._subDestroyControls, function(controlSub) {
            var ok = !$ws.helpers.find(self._subscriptions, function (sub) {
               return sub.control === controlSub.control;
            });
            return needUnsub ? ok : !ok;
         });
      }

      var unsubs = filterSubs(true);

      this._subscriptions = filterSubs(false);

      //если _unsubscribeFrom вызывается из onceWrapper (см. subscribeTo+once), то источник - sub.control
      //уже сам отписал обработчики у себя, и приёмнику отписываться не надо (и нельзя, потому что тогда источник отпишет не once-обработчики с таким вот handler)
      if (!onceWrapper) {
         $ws.helpers.forEach(unsubs, function (sub) {
            if (!sub.control.isDestroyed()) {
               sub.control.unsubscribe(sub.event, sub.handler);
            }
         });
      }

      //оставляем те обработчики удаления контрола, для которых есть какие-то подписки на этот контрол
      var unsubControls = filterControlDestroys(true);
      this._subDestroyControls = filterControlDestroys(false);

      $ws.helpers.forEach(unsubControls, function(sub) {
         if (!sub.control.isDestroyed()) {
            sub.control.unsubscribe('onDestroy', sub.handler);
         }
      });

      return this;
   },

   _getChannel: function() {
      if (!this._eventBusChannel) {
         this._eventBusChannel = $ws.single.EventBus.channel(this._options.eventBusId, {
            waitForPermit: true
         });
      }
      return this._eventBusChannel;
   },
   /**
    * <wiTag group="Управление">
    * Возвращает признак того, удалён объект или нет (отработала ли функция destroy).
    * @returns {Boolean} true - объект удалён, false - объект не удалён, функция {@link destroy} не отработала.
    * @remark
    * Функция полезна в обработчиках асинхронных вызовов, обращающихся к объектам, которые могли быть удалены за время
    * асинхронного вызова.
    * @example
    * <pre>
    *     var FloatArea = testFloatArea,
    *        bl = testBLogic;
    *     bl.addCallback(function() {
    *         if(!FloatArea.isDestroyed()) {
    *         //Если юзер не закрыл окошко, то грузим новый шаблон
    *            bodyArea.setTemplate('загрузили шаблон Б');
    *        }
    *     });
    * </pre>
    * @see destroy
    */
   isDestroyed: function() {
      return this._isDestroyed;
   },

   /**
    * <wiTag group="Управление" noShow>
    * Метод инициализации класса.
    * @see describe
    * @see destroy
    */
   init: function() {
      // В момент вызова init() события отложены
      // После отработки метода init конструирующая функция ($ws.core.extend) вызовет _initComplete,
      // а потом запустит отложенные события через _allowEvents()
      this._notify('onInit');
   },
   /**
    * Этот метод вызывается конструирующей функцией ($ws.core.extend) тогда, когда отработали init всех классов в цепочке наследования,
    * контрол совсем готов, его можно класть в ControlStorage, и запускать его отложенные события.
    *
    * @protected
    */
   _initComplete: function() {
   },

   _constructionDone: function() {
      this._notify('onInitComplete');
   },

   /**
    * <wiTag group="Управление" noShow>
    * Получить описание класса.
    * Удобно использовать для логгирования ошибок.
    * @returns {String} "Описание" класса.
    * @example
    * <pre>
    *    onDestroy: function(){
    *       $ws.single.ioc.resolve('ILogger').log('Error', 'Class ' + myClass.describe() + ' destroyed');
    *    }
    * </pre>
    * @see init
    * @see destroy
    */
   describe: function() {
      return 'Abstract';
   },
   /**
    * Декларирует наличие у объекта событий
    * События могут быть переданы в виде строки, в виде массива строк.
    */
   _publish : function(/*$event*/){
      for (var i = 0, li = arguments.length; i < li; i++){
         var event = arguments[i], handlers = this._handlers[event], j, lh;
         if (handlers){
            if (typeof handlers === 'function') {
               this._getChannel().subscribe(event, handlers, this);
               this._handlers[event] = null;
            }
            else {
               lh = handlers.length;
               if (lh) {
                  for (j = 0; j < lh; j++) {
                     this._getChannel().subscribe(event, handlers[j], this);
                  }
                  this._handlers[event].length = 0;
               }
            }
         }
      }
   },
   /**
    * Извещает всех подписантов события
    * Все аргументы после имени события будут переданы подписантам.
    * @param {string} event Имя события.
    * @param [arg1, [...]] Параметры, получаемые подписантами.
    * @returns {*} Результат выполнения цепочки.
    */
   _notify : function(event/*, payload*/){
      var
         channel = this._getChannel(),
         args = Array.prototype.slice.call(arguments, 1),
         result = channel._notifyWithTarget(event, this, args),
         globalChannel = $ws.single.EventBus.globalChannel();

      globalChannel._notifyWithTarget(event, this, args);

      return result;
   },

   /**
    * Включает отсылку событий.
    * Подробнее см. метод $ws.proto.EventBusChannel.allowEvents.
    */
   _allowEvents: function(){
      this._getChannel().allowEvents();
   },

   /**
    * Показывает, включена ли отсылка событий.
    * Подробнее см. метод $ws.proto.EventBusChannel.eventsAllowed.
    * @returns {boolean}
    */
   _eventsAllowed: function(){
      return this._getChannel().eventsAllowed();
   },

   /**
    * <wiTag group="Управление">
    * Выполнить обработчик события единожды.
    * @param {String} event Имя события, при котором следует выполнить обработчик.
    * @param {Function} handler Обработчик события.
    * @example
    * Отправить подписчикам первый DOM-элемент, над которым откроется Инфобокс.
    * <pre>
    *     $ws.single.Infobox.once('onShow', function() {
    *        this._notify('onFirstShow', this.getCurrentTarget());
    *     });
    * </pre>
    * @see unsubscribe
    * @see unbind
    * @see getEvents
    * @see hasEvent
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   once : function(event, handler) {
      this._getChannel().once(event, handler, this);
   },
   /**
    * Добавить обработчик на событие контрола.
    * <wiTag group="Управление">
    * @param {String} event Имя события.
    * @param {Function} $handler Обработчик события.
    * @throws {Error} Выкидывает исключение при отсутствии события и передаче делегата не функции.
    * @return {$ws.proto.Abstract} Экземпляр класса.
    * @example
    * При клике на кнопку (btn) восстановить начальное состояние группы флагов (groupCheckbox).
    * <pre>
    *    btn.subscribe('onClick', function() {
    *       var record = groupCheckbox.getDefaultValue();
    *       groupCheckbox.setValue(record);
    *    });
    * </pre>
    * @see once
    * @see unsubscribe
    * @see unbind
    * @see getEvents
    * @see hasEvent
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   subscribe : function(event, $handler){
      this._getChannel().subscribe(event, $handler, this);
      return this;
   },
   /**
    * <wiTag group="Управление">
    * Снять обработчик с указанного события.
    * @param {String} event Имя события.
    * @param {Function} handler Обработчик события.
    * @return {$ws.proto.Abstract} Экземпляр класса.
    * @example
    * Задать/снять обработчик клика по кнопке (btn) в зависимости от значения флага (fieldCheckbox).
    * <pre>
    *    var handler = function() {
    *       //некая функция
    *    };
    *    fieldCheckbox.subscribe('onChange', function(eventObject, value) {
    *       if (value) {
    *          btn.subscribe('onClick', handler);
    *       } else {
    *          btn.unsubscribe('onClick', handler);
    *       }
    *    });
    * </pre>
    * @see once
    * @see subscribe
    * @see unbind
    * @see getEvents
    * @see hasEvent
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   unsubscribe: function(event, handler) {
      this._getChannel().unsubscribe(event, handler);
      return this;
   },
   /**
    *  <wiTag group="Управление">
    * Снять все обработчики с указанного события.
    * @param {String} event Имя события.
    * @return {$ws.proto.Abstract} Экземпляр класса.
    * @example
    * При клике на кнопку (btn) снять все обработчики c события onSome.
    * <pre>
    *    btn.subscribe('onClick', function() {
    *       this.getParent().unbind('onSome');
    *    });
    * </pre>
    * @see once
    * @see subscribe
    * @see unsubscribe
    * @see getEvents
    * @see hasEvent
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   unbind: function(event) {
      this._getChannel().unbind(event);
      return this;
   },
   /**
    * <wiTag group="Управление">
    * Разрушить экземпляр класса.
    * @example
    * При клике на кнопку (btn) уничтожить один из контролов.
    * <pre>
    *    btn.subscribe('onClick', function()
    *       control.destroy();
    *    }):
    * </pre>
    * @see init
    * @see describe
    * @see isDestroyed
    */
   destroy: function() {
      if (this._eventBusChannel) {
         //onDestroy нужно вызывать на контроле, чтобы в объекте события был target (контрол, у которого onDestroy вызывается)
         this._notify('onDestroy');

         //отписываю канал от всех событий, чтобы он повторно не кинул onDestroy при вызове destroy()
         this._eventBusChannel.unsubscribeAll();
         this._eventBusChannel.destroy();
      }

      this.unsubscribeFrom();//Отписываемся ото всего у всех, на кого подписались

      this._handlers = {};
      this._isDestroyed = true;
   },
   /**
    * <wiTag group="Управление">
    * Получить список событий контрола.
    * @return {Array} Массив, в котором каждый элемент - это имя события.
    * @example
    * Передать подписчикам список событий контрола.
    * <pre>
    *    control.subscribe('onReady', function() {
    *       var events = this.getEvents(),
    *           flag,
    *           eventName;
    *       $ws.helpers.forEach(events, function(element, index, array) {
    *          flag = element == eventName ? true : false;
    *       });
    *       if (!flag) {
    *          this.subscribe(eventName, function() {
    *             //какой-то функционал
    *          });
    *       }
    *    });
    * </pre>
    * @see once
    * @see subscribe
    * @see unsubscribe
    * @see unbind
    * @see hasEvent
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   getEvents: function() {
      return this._getChannel().getEvents();
   },
   /**
    * <wiTag group="Управление">
    * Проверить наличие указанного события у контрола.
    * @param {String} name Имя события.
    * @return {Boolean} Признак: событие присутствует (true) или нет (false).
    * @example
    * Снять обработчики с события, если оно определено для контрола.
    * <pre>
    *    control.subscribe('onReady', function() {
    *       if (this.hasEvent('onSome')) {
    *          this.unbind('onSome');
    *       }
    *    });
    * </pre>
    * @see once
    * @see subscribe
    * @see unsubscribe
    * @see unbind
    * @see getEvents
    * @see getEventHandlers
    * @see hasEventHandlers
    */
   hasEvent : function(name){
      return this._getChannel().hasEvent(name);
   },
   /**
    * <wiTag group="Управление">
    * Проверить наличие обработчиков на указанное событие у контрола.
    * @param {String} name Имя события.
    * @return {Boolean} Признак: обработчики присутствуют (true) или нет (false).
    * @example
    * Если для контрола определены обработчики на указанное событие, снять их.
    * <pre>
    *    control.subscribe('onReady', function() {
    *       if (this.hasEventHandlers('onSome')) {
    *          this.unbind('onSome');
    *       }
    *    });
    * </pre>
    * @see once
    * @see subscribe
    * @see unsubscribe
    * @see unbind
    * @see hasEvent
    * @see getEvents
    * @see getEventHandlers
    */
   hasEventHandlers : function(name){
      return this._getChannel().hasEventHandlers(name);
   },
   /**
    * <wiTag group="Управление">
    * Получить обработчики указанного события у контрола.
    * @param {String} name Имя события.
    * @returns {Array} Массив, в котором каждый элемент - это обработчик указанного события.
    * @example
    * Передать подписчикам контрола обработчики события onSome.
    * @example
    * <pre>
    *    var handlers = object.getEventHandlers('onSomeEvent'),
    *        handler = function() {
    *           //do something
    *        };
    *    //проверим подписаны ли мы уже на это событие.
    *    //если нет, то подписываемся.
    *    if (Array.indexOf(handlers, handler) === -1) {
    *       object.subscribe('onSomeEvent', handler);
    *    }
    * </pre>
    * @see once
    * @see subscribe
    * @see unsubscribe
    * @see unbind
    * @see hasEvent
    * @see getEvents
    * @see hasEventHandlers
    */
   getEventHandlers : function(name){
      return this._getChannel().getEventHandlers(name);
   }
});

/**
 * Реализация класса Deferred <br />
 * Абстрактное асинхронное событие, может либо произойти, может сгенерировать ошибку.
 * Подробное описание находится {@link https://wi2.sbis.ru/doc/platform/developmentapl/interfacedev/deferred/ здесь}.
 * Частично приведено ниже:<br />
 * Deferred - объект, используемый для работы с асинхронными отложенными вычислениями.<br />
 * Ближайшим стандартным аналогом является {@link https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Promise Promise}.
 * К сожалению Deferred в WS не полностью соответствует стандартизованному Promise.
 * Имеются важные фундаментальные отличия.<br />
 * Любой Deferred может иметь три состояния:
 * <ol>
 *    <li>Не определено (в этом состоянии создается изначально любой Deferred).</li>
 *    <li>Завершён успешно.</li>
 *    <li>Завершён ошибкой.</li>
 * </ol>
 * Для перевода Deferred в одно из состояний используются методы:
 * <ul>
 *    <li>.callback(res) - для перевода в состояние "Завершён успешно";</li>
 *    <li>.errback(err) - для перевода в состояние "Завершён с ошибкой";</li>
 * </ul>
 * <b>ВАЖНО!</b> Если при вызове .callback() передать в качестве аргумента объект Error, то это будет равносильно вызову
 * .errback() с тем же аргументом.
 * <b>ВАЖНО!</b> Нельзя использовать методы .callback() и .errback() несколько раз на одном и том же Deferred.
 * При попытке вызвать данные методы повторно будет выброшено исключение. Как правило, повторный вызов свидетельствует
 * об ошибке в коде приложения.<br />
 * Для получения результата используются методы:
 * <ul>
 *    <li>.addCallback(f) - для получения успешного результата;</li>
 *    <li>.addErrback(f) - для получения ошибочного результата;</li>
 *    <li>.addCallbacks(f1, f2) - для получения в первую функцию успешного результата, а во вторую - ошибки;</li>
 *    <li>.addBoth(f) - для подписки на любой результат одной функицией.</li>
 * </ul>
 * Вызов .addBoth(f) эквивалентен .addCallbacks(f, f).
 * Вызов .addCallback(f) эквивалентен .addCallbacks(f, null).
 * Вызов .addErrback(f) эквивалентен .addCallbacks(null, f).<br />
 * Все вышеописанные методы возвращают тот же Deferred, на котором они были вызваны.<br />
 * Deferred позволяет "мутировать" результат в функциях-обработчиках. То, что вернёт функция обработчик, будет передано
 * на вход следующему подписчику.
 * <br />
 * Пример первый:
 * <pre>
 *    var def = new $ws.proto.Deferred();
 *    def.callback(10);
 *    def.addCallback(function(res) {
 *       console.log(res);  // 10
 *       return 20;
 *    });
 *    def.addCallback(function(res) {
 *       console.log(res); // 20
 *    });
 * </pre>
 * Обратие внимание: несмотря на то, что обработчики добавлены после перевода Deferred в состояние "Завершён успешно",
 * они все равно выполняются. Deferred сохраняет свой последний результат и передаёт его всем вновь добавленным подписчикам.<br />
 * <b>ВАЖНО!</b>
 * Обратите внимание на последний добавленный колбэк в примере выше. В нём нет return. Что равнозначно return undefined.
 * Это приводит к следующему побочному эффекту:
 * <br />
 * <pre>
 *     // продолжение первого примера...
 *     def.addCallback(function(res) {
 *        console.log(res); // undefined
 *     });
 * </pre>
 * Мутация значения возможна также в том случае, если обработчик выбросит исключение.
 * <br />
 * Пример второй:
 * <pre>
 *    var def = new $ws.proto.Deferred();
 *    def.addCallback(function(res) {
 *       throw new Error(123);
 *    });
 *    def.addCallback(function(res) {
 *    // никогда не выполнится
 *    });
 *    def.addErrback(function(err) {
 *       console.log(err); // Error 123
 *    });
 *    def.callback();
 * </pre>
 * Deferred был переведён в состояние "Успешное завершение", но первая функция-обработчик сгенерировала исключение
 * (конечно же оно могло быть сгенерировано не только конструкцией new Error, но и любой некорректной JS-операцией) и
 * Deferred переключился в состояние "Ошибка". По этой причине следующий добавленный обработчик на успешное завершение
 * выполнен не был, а вот обработчик на ошибку уже выполнился и отобразил в консоли текст ошибки.<br />
 * Для переключения Deferred в состояние "ошибка" не обязательно "выбрасывать" исключение. Достаточно просто вернуть из
 * обработчика объект Error. Разница лишь в том, что "выброшенное" исключение будет залогировано в консоли,
 * а возвращенный объект - нет.<br />
 * Верно и обратное. Если в функции-обработчике ошибки вернуть не ошибочное значение, Deferred изменит свое состояние в
 * "завершён успешно". Данный паттерн удобно использовать, например, в следующем случае. Пусть нам надо вызвать метод
 * бизнес-логики и вернуть результат. Но в случае ошибки не нужно пробрасывать её дальше, нужно заменить ошибку
 * некоторым объектом-заглушкой.
 * <br />
 * Пример третий:
 * <pre>
 *     function fetchData(args) {
 *        var stub = {
 *           some: 'stub',
 *           data: true
 *        };
 *        return loadDataSomehow(args).addErrback(function(err) {
 *           return stub;
 *        });
 *     }
 * </pre>
 * Данный пример демонстрирует ещё один правильный паттерн использования Deferred. Если у вас есть некая функция,
 * которая возвращает асинхронный результат в виде Deferred, и вам нужно его как-то модифицировать - не надо создавать
 * новый Deferred и проводить операции с ним, нужно мутировать результат, возвращаемый исходной асинхронной функцией.
 * <br />
 * Пример четвёртый:
 * <pre>
 *    function fetchData(args) {
 *       var stub = {
 *          some: 'stub',
 *          data: true
 *       };
 *       return loadDataSomehow(args).addCallback(function(res) {
 *          return processData(res);
 *       });
 *    }
 * </pre>
 * При данном способе реализации исходная ошибка будет передана далее вызывающей стороне.
 * <br />
 * Одной важной возможностью Deferred является создание цепочек. Например, ваша функция должна вызвать два метода БЛ
 * один за другим. Причём для вызова второго требуется результат первого. Это очень легко сделать.
 * <br />
 * Пример пятый:
 * <pre>
 *    function fetchData(args) {
 *       return doFirstCall(args).addCallback(function(firstResponse) {
 *          return doSecondCall(firstResponse);
 *       });
 *    }
 * </pre>
 * Если из функции обработчика (любого, не важно успеха или ошибки) вернуть Deferred, то следующий обработчик:
 * <ul>
 *   <li>будет ждать результата асинхронной операции, которую "описывает" возвращенный Deferred;</li>
 *   <li>получит состояние, которое вернёт возвращенный Deferred;</li>
 * </ul>
 * <b>ВАЖНО!</b> Deferred, который вернули из обработчика (т.е. который стал частью цепочки) нельзя более использовать для
 * добавления обработчиков. Попытка добавить обработчик как на успешное завершение, так и на ошибку приведёт к выбросу
 * исключения. Проверить заблокировано ли добавление обработчиков можно с помощью метода .isCallbacksLocked()
 * Если всё же требуется подписаться на результат Deferred, отдаваемый в цепочку, воспользуйтесь следующим паттерном.
 * <br />
 * Пример шестой:
 * <pre>
 *    someDef.addCallback(function(res) {
 *       var def2 = getDeferredSomehow();
 *       var dependent = def2.createDependent();
 *       dependent.addCallback(someHandler);
 *       return def2;
 *    });
 * </pre>
 * Функция .createDependent() позволяет создать новый Deferred, результат которого будет зависеть от данного.<br />
 * Есть и "обратная" функция. def.dependOn(someDef) - позволяет сделать уже существующий Deferred зависимым от данного.
 * @class $ws.proto.Deferred
 * @public
 */
$ws.proto.Deferred = (function(){
   function DeferredCanceledError(message) {
      this.message = message;
      this.canceled = true;
   }

   $ws.core.classicExtend(DeferredCanceledError, Error);

   var
      WAITING = -1,
      SUCCESS = 0,
      FAILED = 1,
      CANCELED = 2,
      CHAIN_INDEXES = [0, 1, 1],
      STATE_NAMES = {};

   STATE_NAMES[WAITING]  = 'waiting';
   STATE_NAMES[SUCCESS]  = 'success';
   STATE_NAMES[FAILED]   = 'failed';
   STATE_NAMES[CANCELED] = 'canceled';

   function notCanceled(dfr) {
      return dfr._fired !== CANCELED;
   }

   function isCancelValue(res) {
      return res instanceof DeferredCanceledError;
   }

   function isErrorValue(res) {
      return res instanceof Error;
   }

   function isDeferredValue(res) {
      return res instanceof Deferred;
   }

   function resultToFired(res) {
      return isCancelValue(res) ? CANCELED : isErrorValue(res) ? FAILED : SUCCESS;
   }

    /**
     * @alias $ws.proto.Deferred
     * @param {Object} [cfg] Конфигурация. Содержит опцию: cancelCallback - функция, реализующая отмену на уровне кода, управляющего этим Deferred-ом.
     * @example
     * <pre>
     *    var dfr;
     *    var timeoutId = setTimeout(function() {
     *      console.log('TIMEOUT'); doSomething(); dfr.callback();
     *    }, 1000);
     *    var dfr = new Deferred({
     *      cancelCallback: function() {
     *         clearTimeout(timeoutId);
     *      }
     *    });
     *    dfr.cancel();//таймаут timeoutId отменится, его обработчик не выполнится (console.log, doSomething, и т.п.)
     * </pre>
     */
   function Deferred(cfg) {
      if (cfg) {
         if (cfg.cancelCallback) {
            this._cancelCallback = cfg.cancelCallback;
         }
      }
      this._chained = false;
      this._chain = [];
      this._fired = WAITING;
      this._paused = 0;
      this._results = [ null, null ];
      this._running = false;
   }

   /**
    * Отменяет Deferred. Отмена работает только тогда, когда он находится в состоянии ожидания (когда на нём ещё не были
    * вызваны методы callback/errback/cancel), иначе метод cancel не делает ничего.
    * Если в конструкторе в опции cancelCallback ему была передана функция отмены, то при первом вызове метода cancel
    * она вызовется (только если Deferred ещё не сработал и не отменён).
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.cancel = function () {
      if (this._fired === WAITING) {
         //Состояние CANCELED нужно выставить в самом начале, чтобы вызов методов callback/errback,
         //возможный из cancelCallback, срабатывал бы вхолостую, и не мешал бы выполняться обработчикам, вызванным из
         //_fire отмены
         this._fired = CANCELED;
         this._results[CHAIN_INDEXES[this._fired]] = new DeferredCanceledError('Cancel');

         if (this._cancelCallback) {
            var cbk = this._cancelCallback;
            this._cancelCallback = null;
            try {
               cbk();
            } catch (err) {
               $ws.single.ioc.resolve('ILogger').error("Deferred", "Cancel function throwing an error: " + err.message, err);
            }
         }

         this._fire();
      }
      return this;
   };

    /**
     * Запускает на выполнение цепочку коллбэков.
     * Метод должен вызываться только на несработавшем или отменённом объекте, иначе он выдаст ошибку.
     * На отменённом объекте (после вызова метода cancel) callback/errback можно вызывать сколько угодно - ошибки не будет,
     * метод отработает вхолостую.
     * @param [res] результат асинхронной операции, передаваемой в коллбэк.
     * @returns {$ws.proto.Deferred}
     */
    Deferred.prototype.callback = function (res){
       if (notCanceled(this)) {
          this._resback(this._check(res));
       }
       return this;
    };

    /**
     * Запуск цепочки обработки err-бэков.
     * Метод должен вызываться только на несработавшем или отменённом объекте, иначе он выдаст ошибку.
     * На отменённом объекте (после вызова метода cancel) callback/errback можно вызывать сколько угодно - ошибки не будет,
     * метод отработает вхолостую.
     * @param [res] результат асинхронной операции.
     * @returns {$ws.proto.Deferred}
     */
    Deferred.prototype.errback = function (res){
       if (notCanceled(this)) {
          this._resback(this._check(res, true));
       }
       return this;
    };

   Deferred.prototype._resback = function (res){
      //после вызова callback/errback/cancel отмена работает вхолостую, поэтому функция отмены (cancelCallback) после
      //_resback точно не понадобится, и её можно обнулить, чтобы GC её мог собрать пораньше
      this._cancelCallback = null;
      this._fired = resultToFired(res);
      this._results[CHAIN_INDEXES[this._fired]] = res;

      this._fire();
   };

   Deferred.prototype._check = function (res, isError) {
      if (this._fired !== WAITING) {
         throw new Error("Deferred is already fired with state '" + STATE_NAMES[this._fired] + "'");
      }

      if (isDeferredValue(res)) {
         throw new Error("Deferred instances can only be chained if they are the result of a callback");
      }

      if (isError && !isErrorValue(res)) {
         res = new Error(res);
         // Исправляем поведение IE8. Error(1) == { number: 1 }, Error("1") == { number: 1 }, Error("x1") == { message: "x1" }
         // Если после создания ошибки в ней есть поле number, содержащее число, а в message - пусто,
         // скастуем к строке и запишем в message
         if (!isNaN(res.number) && !res.message) {
            res.message = "" + res.number;
         }
      }

      return res;
   };

   /**
    * Добавляет один коллбэк как на ошибку, так и на успех
    * @param {Function} fn общий коллбэк.
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.addBoth = function (fn){
      if (arguments.length != 1) {
         throw new Error("No extra args supported");
      }
      return this.addCallbacks(fn, fn);
   };

   /**
    * Добавляет колбэк на успех
    * @param {Function} fn коллбэк на успех.
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.addCallback = function (fn){
      if (arguments.length != 1) {
         throw new Error("No extra args supported");
      }
      return this.addCallbacks(fn, null);
   };

   /**
    * Добавляет колбэк на ошибку
    * @param {Function} fn коллбэк на ошибку.
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.addErrback = function (fn){
      if (arguments.length != 1) {
         throw new Error("No extra args supported");
      }
      return this.addCallbacks(null, fn);
   };

   /**
    * Добавляет два коллбэка, один на успешный результат, другой на ошибку
    * @param {Function} cb коллбэк на успешный результат.
    * @param {Function} eb коллбэк на ошибку.
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.addCallbacks = function (cb, eb){
      if (this._chained){
         throw new Error("Chained Deferreds can not be re-used");
      }

      if((cb !== null && typeof(cb) !== 'function') || (eb !== null && typeof(eb) !== 'function')) {
         throw new Error("Both arguments required in addCallbacks");
      }

      var fired = this._fired,
          waiting = fired === WAITING || this._running || this._paused > 0;

      if (waiting || (cb && fired === SUCCESS) || (eb && (fired === FAILED || fired === CANCELED))) {
         this._chain.push([cb, eb]);

         if (!waiting) {
            // не запускаем выполнение цепочки при добавлении нового элемента, если цепочка уже выполняется
            this._fire();
         }
      }

      return this;
   };

   /**
    * Вся логика обработки результата.
    * Вызов коллбэков-еррбэков, поддержка вложенного Deferred
    */
   Deferred.prototype._fire = function (){
      var chain = this._chain;
      var fired = this._fired;
      var res = this._results[CHAIN_INDEXES[fired]];
      var self = this;
      var cb = null;
      while (chain.length > 0 && this._paused === 0) {
         var pair = chain.shift();
         var f = pair[CHAIN_INDEXES[fired]];
         if (f === null)
            continue;

         try {
            this._running = true; // Признак того, что Deferred сейчас выполняет цепочку
            res = f(res);
            fired = resultToFired(res);
            if (isDeferredValue(res)) {
               cb = function(res) {
                  self._paused--;
                  self._resback(res);
               };
               this._paused++;
            }
         } catch (err) {
            fired = FAILED;
            if (!isErrorValue(err)) {
               err = new Error(err);
            }
            res = err;
            $ws.single.ioc.resolve('ILogger').error("Deferred", "Callback function throwing an error: " + err.message, err);
         } finally {
            this._running = false;
         }
      }
      this._fired = fired;
      this._results[CHAIN_INDEXES[fired]] = res;
      if (cb && this._paused){
         res.addBoth(cb);
         res._chained = true;
      }
   };
   /**
    * Объявляет данный текущий Deferred зависимым от другого.
    * Колбэк/Еррбэк текущего Deferred будет вызван при соотвествтующем событии в "мастер"-Deferred.
    *
    * @param {$ws.proto.Deferred} dDependency Deferred, от которого будет зависеть данный.
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.dependOn = function(dDependency){
      var self = this;
      dDependency.addCallbacks(function(v){
         self.callback(v);
         return v;
      }, function(e){
         self.errback(e);
         return e;
      });
      return this;
   };

   /**
    * Создаёт новый Deferred, зависимый от этого.
    * Колбэк/Еррбэк этого Deferred-а будут вызваны при соотвествтующем событии исходного.
    *
    * @returns {$ws.proto.Deferred}
    */
   Deferred.prototype.createDependent = function() {
      var dependent = new $ws.proto.Deferred();
      return dependent.dependOn(this);
   };

   /**
    * @returns {Boolean} Готов или нет этот экземпляр (стрельнул с каким-то результатом)
    */
   Deferred.prototype.isReady = function(){
      //Признак _paused тут учитывать не надо, потому что isReady говорит именно о наличии результата этого
      //Deferred-а (и возможности или невозможности вызывать методы callback/errback),
      //а не о состоянии цепочки его обработчиков.
      return this._fired !== WAITING;
   };

   /**
    * Показывает, не запрещено ли пользоваться методами, добавляющими обработчики: addCallbacks/addCallback/addErrback/addBoth.
    * Не влияет на возможность вызова методов callback/errback.
    * @return {Boolean} true: добавлять обработчики запрещено. false: добавлять обработчики можно.
    */
   Deferred.prototype.isCallbacksLocked = function() {
      return this._chained;
   };

   /**
    * @returns {Boolean} Завершился ли данный экземпляр успехом
    */
   Deferred.prototype.isSuccessful = function(){
      return this._fired === SUCCESS;
   };

   /**
    * Возвращает текущее значение Deferred.
    * @returns Текущее значение Deferred
    * @throws {Error} Когда значения еще нет.
    */
   Deferred.prototype.getResult = function() {
      if(this.isReady()) {
         return this._results[CHAIN_INDEXES[this._fired]];
      }
      else {
         throw new Error("No result at this moment. Deferred is still not ready");
      }
   };
    /**
     * Возвращает Deferred, который завершится успехом через указанное время.
     * @param {Number} delay Значение в миллисекундах.
     * @returns {$ws.proto.Deferred}
     * @example
     * <pre>
     *    //выполнит обработчик через 5 секунд
     *    var def = $ws.proto.Deferred.fromTimer(5000);
     *    def.addCallback(function(){
     *     //код обработчика
     *    });
     * </pre>
     */
   Deferred.fromTimer = function(delay) {
      var d = new $ws.proto.Deferred();
      setTimeout(d.callback.bind(d), delay);
      return d;
   };
    /**
     * Возвращает Deferred, завершившийся успехом.
     * @param {*} result Результат выполнения.
     * @returns {$ws.proto.Deferred}
     * @example
     * <pre>
     *    var def = $ws.proto.Deferred.success('bar');
     *    //выполнит обработчик и передаст в него результат.
     *    def.addCallback(function(res) {
     *       // Выведет в консоль 'bar'
     *       console.log(res);
     *    });
     * </pre>
     */
   Deferred.success = function(result) {
      return new $ws.proto.Deferred().callback(result);
   };
    /**
     * Возвращает Deferred, завершившийся ошибкой.
     * @param {*|Error}result - результат выполнения.
     * @returns {$ws.proto.Deferred}
     * @example
     * <pre>
     *    var def = $ws.proto.Deferred.fail('Bug');
     *    // Выполнит обработчик и передаст в него результат.
     *    def.addErrback(function(err) {
     *       console.log(err.message); // Выведет в консоль 'Bug'
     *    });
     * </pre>
     */
   Deferred.fail = function(result) {
      var err = result instanceof Error ? result : new Error('' + result);
      return new $ws.proto.Deferred().errback(err);
   };
    /**
     * Возвращает Deferred, который завершится успехом или ошибкой, сразу же как завершится успехом или ошибкой любой из переданных Deferred.
     * @param {Array} steps Набор из нескольких отложенных результатов.
     * @returns {$ws.proto.Deferred}
     * @example
     * <pre>
     * var query = (new $ws.proto.BLObject('Клиент')).call('Параметры');
     * // Если запрос к БЛ займёт более 10 секунд, то Deferred завершится успехом, но вернёт undefined в результате.
     * var def = $ws.proto.Deferred.nearestOf([$ws.proto.Deferred.fromTimer(10000), query]);
     * def.addCallback(function(res){
     *    if (res.from === 0) {
     *       // Обработка случая не завершённого запроса к БЛ, занимающего продолжительное время.
     *       $ws.helpers.alert('Ваш запрос обрабатывается слишком долго.');
     *    } else {
     *       var recordSet = res.data;
     *       // Логика обработки полученных данных.
     *    }
     * });
     * def.addErrback(function(res) {
     *   // В res.data придёт экземпляр ошибки, если один из запросов завершился ошибкой.
     * });
     * </pre>
     */
   Deferred.nearestOf = function(steps) {
      var dResult = new $ws.proto.Deferred();

      $ws.helpers.forEach(steps, function(step, key){
         step.addBoth(function(r){
            if (!dResult.isReady()) {
               if (r instanceof Error) {
                  var res = new Error();
                  res.from = key;
                  res.data = r;
                  dResult.errback(res);
               } else {
                  dResult.callback({
                     from: key,
                     data: r
                  });
               }
            }
            return r;
         });
      });

      if (steps.length === 0) {
         dResult.callback();
      }

      return dResult;
   };

   return Deferred;

})();



/**
 * Враппер для нескольких Deferred - процессов, работающих параллельно.
 * Условием успеха является успешное завершение всех экземпляров.
 *
 * Алгоритм работы:
 * 1. Создать экземпляр ParallelDeferred, опционально передать в конструктор массив операций, окончания которых будет ожидать этот экземпляр.
 * Каждая операция - это Deferred ("энергичная" операция), или функция возвращающая Deferred ("ленивая" операция).
 * Объект ParallelDeferred одновременно выполняет ленивых операций не больше, чем указано в опции maxRunningCount.
 * Если в push их передано больше, чем maxRunningCount, то часть операций выполняется, а часть ждёт в очереди.
 * Это позволяет запускать выполнение множества ajax-запросов фиксированными "пачками", не перегружая браузер ими (см. пример далее).
 * При этом, если включена опция stopOnFirstError, то после первой же ошибки в любой из переданных операций, ни одна "ленивая" операция, переданная в
 * push, или ожидающая в очереди, запущена не будет.
 * 2. Добавить в набор операции через вызов .push().
 * 3. Получить результирующий Deferred через вызов .getResult(), подписаться на его события.
 * 4. Завершить создание набора через вызов done().
 *
 * Пример выполнения "энергичных" операций:
 * <pre>
 *    ..
 *    var parallelDeferred = new $ws.proto.ParallelDeferred({steps: [deferred0, deferred1]});
 *    ...
 *    parallelDeferred.push(deferred2);
 *    ...
 *    parallelDeferred.push(deferredN); //Все deferred-ы - от deferred0 до deferredN будут выполняться параллельно
 *    ...
 *    parallelDeferred.done().getResult().addCallback(function(){
 *       alert('All done!');//Все deferred-ы выполнились
 *    });
 * </pre>
 *
 * Пример выполнения "ленивых" операций:
 * <pre>
 *    ..
 *    var parallelDeferred = new $ws.proto.ParallelDeferred();
 *    ...
 *    var lazy1 = function() { return new $ws.proto.BLObject({...}).call(); };
 *    parallelDeferred.push(lazy1);
 *    ...
 *    var lazyN = function() { return new $ws.proto.BLObject({...}).call(); };
 *
 *    //функция lazyI будет выполняться тогда, когда число запущенных запросов к бизнес-логике будет не больше maxRunningCount,
 *    //т.е., когда для неё будет место в "пачке" размером maxRunningCount. Если для неё не будет там места
 *    (в этот момент уже запущено maxRunningCount операций), то она будет ждать в очереди окончания какой-либо операции из "пачки".
 *    parallelDeferred.push(lazyN);
 *    ...
 *    parallelDeferred.done().getResult().addCallback(function(){
 *       alert('All done!');//Все deferred-ы выполнились
 *    });
 * </pre>
 *
 * @class $ws.proto.ParallelDeferred
 * @public
 *
 */
$ws.proto.ParallelDeferred = $ws.core.extend({}, /** @lends $ws.proto.ParallelDeferred */{
    /**
     * @cfg {$ws.proto.Deferred[]} Порядковые индексы шагов
     * @name $ws.proto.ParallelDeferred#steps
     * @see done
     * @see push
     * @see getStepsDone
     * @see getStepsSuccess
     * @see getStepsCount
     */
   $protected: {
      _successResult: undefined,
      _ready: false,
      _locked: false,
      _stepsCount: 0,
      _stepsFinish: 0,
      _stepsSuccess: 0,
      _dResult: null,
      _errors: [],
      _results: {},
      _lazyQueue: [],  // очередь на выполнение функций, возвращающих deferred

      _options: {
          /**
           * @cfg {boolean} Этот флаг показывает то, что готовность этого объекта ParallelDeferred наступит при первой
           * ошибке в любом из объектов-процессов, переданных в метод push (ленивых или энергичных - см. описание метода
           * {@link push}).
           */
         stopOnFirstError: true,

         /**
          * @cfg {boolean} Максимальное количество одновременно выполняющихся "ленивых" операций, переданных в push.
          * "Ленивая" операция - это та, которая была передана функции push в виде функции, возвращающей Deferred.
          * @see push
          */
         maxRunningCount: 10
      }
   },
   /**
    * @param {Object} cfg
    * @param {$ws.proto.Deferred[]} cfg.steps
    */
   $constructor: function(cfg) {
      this._dResult = new $ws.proto.Deferred();

      if(cfg && cfg.steps) {
         $ws.helpers.forEach(cfg.steps, function(deferred, stepId){
            this.push(deferred, stepId);
         }, this);
      }
   },

   _successHandler: function(stepId, res){
      this._stepsFinish++;
      this._stepsSuccess++;

      this._results[stepId] = res;
      this._check();

      return res;
   },

   _errorHandler: function(stepId, res){
      this._stepsFinish++;

      this._errors.push(res.message);
      // Оставим старое поведение, и добавим новое
      // Если у нас стоит флаг "не останавливаться при ошибке",
      // то надо получить все результаты, включая ошибки
      if (!this._options.stopOnFirstError) {
         this._results[stepId] = res;
      }
      this._check();

      return res;
   },

   _isFinishedByError: function() {
      return this._options.stopOnFirstError && this._errors.length > 0;
   },

   _runDfr: function(lazyDfr, isLazy, stepId) {
      var dfr;
      if (isLazy) {
         try {
            dfr = lazyDfr();
         } catch (e) {
            dfr = new $ws.proto.Deferred();
            dfr.errback(e);
         }
      } else {
         dfr = lazyDfr;
      }
      dfr.addCallbacks(this._successHandler.bind(this, stepId), this._errorHandler.bind(this, stepId));
   },

   /**
    * Добавление Deferred в набор
    * @param {$ws.proto.Deferred|Function} dOperation Асинхронная операция для добавления в набор.
    * Эта операция может быть экземпляром класса {@link $ws.proto.Deferred} или функцией, возращающей объект такого класса.
    * В первом случае метод получает уже выполняющуюся операцию, во втором - "ленивый" экземпляр операции - то есть, функцию,
    * которая может её запустить и отдать в виде экземпляра класса {@link $ws.proto.Deferred}.
    *
    * @param {String|Number} [stepId]  Идентификатор шага (операции). Результат шага (операции) с заданным идентификатором будет
    * помещен в результат ParallelDeferred.
    * @returns {$ws.proto.ParallelDeferred}
    * @see steps
    */
   push: function(dOperation, stepId) {
      if(this._locked)
         return this;

      var self = this,
          isEager = dOperation instanceof $ws.proto.Deferred,
          isLazy = typeof dOperation == 'function';

      function checkStepId() {
         if (stepId === undefined) {
            stepId = self._stepsCount;
         }

         self._stepsCount++;

         if (self._results.hasOwnProperty(stepId)) {
            throw new Error('Действие с id="' + stepId + '" уже есть в этом объекте ParallelDeferred');
         }

         self._results[stepId] = undefined;
      }

      if (isEager || isLazy) {
         if (this._locked) {
            throw new Error('Нельзя вызывать push после done.');
         }
         else if (!this._isFinishedByError()) { //после остановки по ошибке новые операции игнорируем
            if (isEager) {
               checkStepId();
               this._runDfr(dOperation, false, stepId);
            }
            else if (isLazy) {
               checkStepId();

               // Если количество выполняющихся процессов меньше максимального, то запускаем новую операцию, иначе добавляем в очередь
               if (this._stepsCount - this._stepsFinish - this._lazyQueue.length <= this._options.maxRunningCount) {
                  this._runDfr(dOperation, true, stepId);
               } else {
                  this._lazyQueue.push([dOperation, stepId]);
               }
            }
         }
      } else {
         throw new Error('Неверный параметр dOperation: требуется Deferred или функция, возвращающая его.');
      }

      return this;
   },
   /**
    * Данная функция должна быть вызвана, когда закончено добавление всех элементов в набор.
    * ВНИМАНИЕ: При инициализации набора через конструктор done сам НЕ вызывается.
    *
    * @param {Object} [successResult] результат, который будет возвращен в случае успеха в общий колбэк
    * @returns {$ws.proto.ParallelDeferred}
    * @see steps
    * @see getStepsDone
    */
   done: function(successResult){
      this._locked = true;
      this._successResult = successResult;
      this._check();
      return this;
   },
   /**
    * Функция, выполняющая проверку, выполнен ли набор, и выполнен ли он успешно
    */
   _check: function(){
      function checkQueue() {
         var op, queueLn = this._lazyQueue.length,
             runningCnt = this._stepsCount - this._stepsFinish - queueLn,
             needUnqueue = queueLn > 0 && runningCnt < this._options.maxRunningCount;

         if (needUnqueue) {
            op = this._lazyQueue.shift();
            this._runDfr(op[0], true, op[1]);
         }

         return needUnqueue;
      }

      if (!this._ready) {
         this._ready = this._locked &&
                       (this._stepsFinish === this._stepsCount || this._isFinishedByError());

         if (this._ready) {
            this._lazyQueue = [];
            if (this._isFinishedByError())
               this._dResult.errback(this._errors.join('\n'));
            else
               this._dResult.callback(this._successResult !== undefined ? this._successResult : this._results);
         } else {
            var ok = checkQueue.call(this);
            while (ok) {
               ok = checkQueue.call(this);
            }
         }
      }
   },
   /**
    * Метод получения результирующего Deferred, который будет служить индикатором всего набора
    * Сам Deferred в случае успеха в качестве результата вернет successResult, если он был задан в методе done(),
    * либо объект с результатами Deferred, составляющих параллельное событие. В объекте в качестве идентификаторов
    * результатов событий будут использоваться stepId, переданные при соответствующих вызовах метода push(), либо порядковые индексы
    * шагов из опции steps
    * @returns {$ws.proto.Deferred}
    */
   getResult: function() {
      return this._dResult;
   },

   /**
    * Возвращает общее число операций, добавленных в объект из конфига или метода push.
    * @see push
    * @returns {Number}
    * @see steps
    * @see push
    */
   getStepsCount: function() {
      return this._stepsCount;
   },

   /**
    * Возвращает общее число оконченных (успешно или нет) операций, добавленных в объект из конфига или метода push.
    * @returns {Number}
    * @see steps
    * @see push
    */
   getStepsDone: function() {
      return this._stepsFinish;
   },

   /**
    * Возвращает общее число успешно оконченных операций, добавленных в объект из конфига или метода push.
    * @returns {Number}
    * @see push
    * @see steps
    */
   getStepsSuccess: function(){
      return this._stepsSuccess;
   }
});
/**
 * Цепочка кода указанной длины.
 * Код добавляется в произвольные места.
 * Выполняются только законченные от начала куски цепочки.
 *
 * @class $ws.proto.CodeChain
 * @public
 */
$ws.proto.CodeChain = $ws.core.extend({}, /** @lends $ws.proto.CodeChain.prototype */{
   $protected: {
      _chain: [],
      _length: 0
   },
   /**
    * @param {Number} chainLen Длинна цепочки
    */
   $constructor: function(chainLen){
      this._length = chainLen;
      for (var i = 0; i < chainLen; i++)
         this._chain[i] = 0;
   },
   /**
    * Добавляет код в цепочку
    *
    * @param {Number} idx Позиция цепочки, куда следует добавить код.
    * @param {string} code Код для добавления.
    * @returns {Boolean} true, если цепочка полностью выполнилась, false в противном случае.
    */
   setCode: function(idx, code){
      if (idx >= this._length || idx < 0)
         throw new RangeError("Setting chain element above the range: Idx: " + idx + ", Len: " + this._length);
      if (this._chain[idx] !== 0)
         throw new Error("Setting chain element what is already processed! Erroneous usage detected! Idx: " + idx);
      this._chain[idx] = code;
      return this._check();
   },
   /**
    * Проверяет цепочку.
    * Заменяет успешно выполненный код пустой строкой.
    * @returns {Boolean} True - когда вся цепочка выполнена.
    */
   _check: function(){
      for (var i = 0, l = this._length; i < l; i++){
         if (typeof this._chain[i] == 'string'){
            if (this._chain[i] !== ''){
               try{
                  var block = BOOMR.plugins.WS.startBlock("eval");
                  eval(this._chain[i]);
                  block.close();
                  this._chain[i] = '';
               } catch(e){
                  throw new EvalError("Chain failed due to erroneous code: " + e.message);
               }
            }
         }
         else
            return false;
      }
      return true;
   }
});

/**
 * Асинхронный XHR Transport через Deferred
 * @class $ws.proto.XHRTransport
 * @public
 * @extends $ws.proto.ITransport
 */
$ws.proto.XHRTransport = $ws.proto.ITransport.extend(/** @lends $ws.proto.XHRTransport.prototype */{
   $protected: {
      _options: {
          /**
           * @cfg {String} Метод запроса. POST или GET. По умолчанию = Get.
           */
         method: 'GET',
          /**
           * @cfg {String} Тип данных, который Вы ожидаете от сервера. По умолчанию text.
           */
         dataType: 'text',
          /**
           * @cfg {String} contentType Тип данных при отсылке данных на сервер. По умолчанию application/x-www-form-urlencoded.
           */
          contentType : 'application/x-www-form-urlencoded',
          /**
           * @cfg {String} url URL, по которому отправляется запрос.
           */
          url: ''
      },
      _xhr: undefined      //Последний запрос
   },
   $constructor: function(){
      if(this._options.url === '') {
         throw new Error("Request with no URL is ambiguous");
      }
   },
   /**
    * @param {String} data Данные для отправки
    * @param {Object} [headers] Заголовки
    * @return {$ws.proto.Deferred}
    */
   execute: function(data, headers){
      var
         block = this._boomrStartBlock(data),
         dResult = new $ws.proto.Deferred({
            cancelCallback: this.abort.bind(this)
         }),
         self = this;

      if (!this._validateCookies()) {
         dResult.errback(new Error('Ошибка авторизации. Текущая сессия принадлежит другому пользователю/клиенту'));
      } else {
         try {
            this._xhr = $.ajax({
               type: this._options.method,
               dataType: this._options.dataType,
               contentType: this._options.contentType,
               url: this._options.url,
               headers: headers || {},
               data: data,

               beforeSend: function(xhr, settings) {
                  var channel = $ws.single.EventBus.channel('Transport'),
                      res = channel.notify('onBeforeSend', xhr, settings);

                  return res;
               },

               success: function(result) {
                  var channel = $ws.single.EventBus.channel('Transport'),
                      resultDfr = $ws.proto.Deferred.success(result);

                  block.close();
                  self._validateCookies();

                  channel.notify('onResponseSuccess', self._xhr, resultDfr);
                  dResult.dependOn(resultDfr);
                  return result;
               },
               // null
               // "timeout"
               // "error"
               // "notmodified"
               // "parsererror"
               error: function(xhr, textStatus) {
                  block.close();
                  self._validateCookies();
                  var
                     humanReadableErrors = {
                        timeout: 'Таймаут запроса',
                        error: 'Неизвестная ошибка',
                        parsererror: 'Ошибка разбора документа',
                        abort: 'Запрос был прерван',
                        403: 'У вас недостаточно прав для выполнения данного действия.',
                        404: 'Документ не найден',
                        423: 'Действие заблокировано лицензией',
                        500: 'Внутренняя ошибка сервера',
                        502: 'Сервис недоступен. Повторите попытку позже.',
                        503: 'Сервис недоступен. Повторите попытку позже.',
                        504: 'Сервис недоступен. Повторите попытку позже.'
                     },
                     textError = ((xhr.status in humanReadableErrors) ? humanReadableErrors[xhr.status]
                               : ((textStatus in humanReadableErrors) ? humanReadableErrors[textStatus]
                               :  humanReadableErrors['error'])),
                     channel,
                     resultDfr,
                     error;

                  // Запрос был отменен пользователем по esc
                  if( xhr.status === 0 && xhr.getAllResponseHeaders() === "" ) {
                     textError = 'Запрос был прерван пользователем';
                  }

                  error = new HTTPError(textError, xhr.status, self._options.url, xhr.responseText);

                  // Извещаем о HTTP-ошибке
                  $ws.single.EventBus.channel('errors').notify('onHTTPError', error);

                  //обрабатываем ситуацию истекшей сессии
                  if (xhr.status == "401"){

                     // Новый вариант рассылки ошибки о проблеме аутентификации
                     if ($ws.single.EventBus.channel('errors').notify('onAuthError') === true) {
                        return;
                     }

                     // Старый способ. Надо выпилить в 3.8
                     if (typeof $ws.core._authError == "function"){
                        $ws.core._authError();
                        return;
                     }
                  }

                  //Здесь ошибку точно надо отдавать в dResult
                  channel = $ws.single.EventBus.channel('Transport');
                  resultDfr = $ws.proto.Deferred.fail(error);
                  channel.notify('onResponseError', self._xhr, resultDfr);

                  resultDfr.addCallback(function(result) {
                     dResult.callback(result);
                  }).addErrback(function(error) {
                     dResult.errback(error);
                     if ((xhr.status == "403" || xhr.status == "423") &&  !error.processed) {
                        $ws.core.alert(textError, "error");
                     }
                  });
               }
            });
         } catch(e) {
            dResult.errback("JavaScript exception while trying to execute request: " + e.message);
         }

      }

      return dResult;
   },
   /**
    * Заменяет url
    * @param {String} url
    */
   setUrl: function(url) {
      if (typeof url == 'string') {
         this._options.url = url;
      }
   },
   /**
    * Заменяет url
    * @param {String} url
    */
   setUrl: function(url) {
      if (typeof url == 'string') {
         this._options.url = url;
      }
   },
   /**
    * Прерывает загрузку
    */
   abort: function(){
      if(this._xhr){
         this._xhr.abort();
      }
   },
   /**
    * Проверка куки, если изменилась - кидаем ошибку авторизации
    * @returns {Boolean} true если с сессией все в порядке
    */
   _validateCookies : function(){
      var storedSID = $ws.single.GlobalContext.getValue('sid'), cookieSID;
      if ($ws._const.checkSessionCookie && 'jQuery' in window && 'cookie' in window.jQuery) {
         cookieSID = $.cookie('sid');
         // Если у нас сохранен ранее SID и если в куке тоже есть SID
         if (storedSID && cookieSID){
            var
               w = storedSID.split("-"),
               n = cookieSID.split("-");

            //если изменились пользователи или клиент, то покажем ошибку авторизации
            if(w[0] !== n[0] || w[1] !== n[1]) {
               // Новый способ извещения об ошибке аутентицикации
               $ws.single.EventBus.channel('errors').notify('onAuthError');

               // Старый способ. Удалить с 3.8
               if (typeof $ws.core._authError == "function") {
                  $ws.core._authError();
               }

               return false;
            }
         }
         else {
            // ... если SID ранее не сохранен - сохраним
            $ws.single.GlobalContext.setValue('sid', cookieSID);
         }
      }
      return true;
   },
   /**
    * Создает фрейм для статистики
    */
   _boomrStartBlock : function(data){
      var name = this._options.url;

      if (BOOMR.version){
         if (/.*\.dll$/.test(name)){
            if (data) {
               var d = $.parseJSON(data);
               if (d && d.method) {
                  name = [
                     name,
                     d.method
                  ].join("?");
               }
            }
         }
      }

      return BOOMR.plugins.WS.startBlock(name);
   }
});


(function () {

   var
      Context,
      FindIntent = {
         SET: 'FindIntent.SET',
         GET: 'FindIntent.GET',
         REMOVE: 'FindIntent.REMOVE'
      },
      RestrictFlags = {
         NONE:    0,
         GET:     1,
         SET:     2,
         GETSET:  3,
         UNDEFINEDS_AS_EXISTENT: 4
      },

      constant = $ws.helpers.constant,
      STRUCTURE_SEPARATOR = '/',
      LINK_SEPARATOR = '.',

      notImplemented = function () {
         throw new Error('Метод не должен вызываться');
      },
      NonExistentValue = function() {},
      UndefinedFieldType = {
         is: notImplemented,

         get: constant(NonExistentValue),

         set: function (oldValue, keyPath, value) {
            return value;
         },

         remove: notImplemented,

         setWillChange: constant(true),

         toJSON: notImplemented
      },
      SimpleFieldType = {
         name: 'SimpleFieldType',

         is: constant(true),

         equals: function (v1, v2) {
            return (v1 === v2) || (v1 && v2 && typeof(v1.equals) === 'function' && v1.equals(v2));
         },

         get: function (value, keyPath) {
            var result, subValue, subType;

            if (keyPath.length === 0) {
               result = value;
            } else if (value === null || typeof(value) !== 'object' || !(keyPath[0] in value)) {
               result = NonExistentValue;
            } else {
               subValue = value[keyPath[0]];
               subType = Context.getValueType(subValue);
               result = subType.get(subValue, keyPath.slice(1));
            }

            return result;
         },

         setWillChange: function (oldValue, keyPath, value) {
            var result, subValue, subType, key;

            if (keyPath.length === 0) {
               result = !SimpleFieldType.equals(oldValue, value);
            } else if (oldValue === null || typeof(oldValue) !== 'object') {
               result = false;
            } else {
               key = keyPath[0];
               result = !(key in oldValue);
               if (!result) {
                  subValue = oldValue[key];
                  subType = Context.getValueType(subValue);
                  result = subType.setWillChange(subValue, keyPath.slice(1), value);
               }
            }

            return result;
         },

         set: function (oldValue, keyPath, value) {
            var subValue, newSubValue, subType, key, result,
                isEqual, equals = SimpleFieldType.equals;

            if (keyPath.length === 0) {
               result = value;
            }
            else if (oldValue !== null && typeof(oldValue) === 'object') {
               key = keyPath[0];
               subValue = oldValue[key];

               if (keyPath.length === 1) {
                  isEqual = key in oldValue && equals(subValue, value);
                  if (isEqual) {
                     result = oldValue;
                  } else {
                     subValue = oldValue[key];
                     subType = Context.getValueType(subValue);
                     newSubValue = subType.set(subValue, [], value);
                     if (equals(subValue, newSubValue)) {
                        result = oldValue;
                     } else {
                        result = $ws.core.shallowClone(oldValue);
                        result[key] = newSubValue;
                     }
                  }
               } else {
                  subType = Context.getValueType(subValue);
                  newSubValue = subType.set(subValue, keyPath.slice(1), value);
                  if (subValue === newSubValue) {
                     result = oldValue;
                  } else {
                     result = SimpleFieldType.set(oldValue, [key], newSubValue);
                  }
               }
            } else {
               result = oldValue;
            }

            return result;
         },

         remove: function (value, keyPath) {
            var
               subValue, subType, changed, key, newValue, res, idx,
               equals = SimpleFieldType.equals;

            changed = keyPath.length !== 0;
            if (changed) {
               key = keyPath[0];
               changed = value !== null && typeof(value) === 'object' && key in value;
               if (changed) {
                  if (keyPath.length === 1) {
                     if ($ws.helpers.isPlainArray(value)) {
                        newValue = value.slice(0);
                        idx = parseInt(key, 10);
                        if (idx == key) {//строка-индекс вроде "1", "2"...
                           newValue.splice(idx, 1);
                        } else {
                           delete newValue[key];
                        }
                     } else {
                        subValue = value[key];
                        subType = Context.getValueType(subValue);
                        res = subType.remove(subValue, []);

                        if (subType.isProxy) {
                           changed = res.changed;
                           newValue = value;
                        } else {
                           changed = true;
                           newValue = $ws.core.shallowClone(value);
                           delete newValue[key];
                        }
                     }
                  } else {
                     subValue = value[key];
                     subType = Context.getValueType(subValue);
                     res = subType.remove(subValue, keyPath.slice(1));
                     changed = res.changed;
                     if (changed) {
                        if (subType.isProxy || equals(res.value, subValue)) {
                           newValue = value;
                        } else {
                           newValue = $ws.core.shallowClone(value);
                           newValue[key] = res.value;
                        }
                     }
                  }
               }
            }

            return {
               value: changed ? newValue : value,
               changed: changed
            };
         },

         toJSON: function (value, deep) {
            var useToJson = deep && value !== null && typeof(value) === 'object' && typeof(value['toJSON']) === 'function';

            return useToJson ? value.toJSON() : value;
         }
      },
      AllFieldTypes = [SimpleFieldType];

/**
 * Объект контекста.
 * Содержит в себе ВСЕ данные контекста и умеет отличать, какие лежат в рекорде, а какие нет.
 * При изменении данных рекорд актуализируется.
 * Умеет отдавать рекорд целиком.
 *
    * ContextObject
 */
   var ContextObject = $ws.core.extend({}, {
   $protected: {
      _options: {
          /**
           * @cfg {$ws.proto.Record | Object} Объект с начальными данными. Может быть рекордом.
           */
         objectData: null
      },
      _isEmpty: true,
      _contextObject: {}
   },
   $constructor : function(){
      this._contextObject = {};
      if(this._options.objectData){
            var data = this._options.objectData;

            if (!$ws.helpers.isPlainObject(data)) {
               throw new Error('Опция objectData должна быть простым объектом с ключами и значениями');
            }

            //перелопачиваем объект переданный в конфигурации в свой формат
            $ws.helpers.forEach(data, function (value, key) {
               var type = this._getValueType(value);
               this._contextObject[key] = this._createTypedValue(value, type);
               this._isEmpty = false;
            }, this);
            }
   },

   /**
       * @param value
       * @return {number}
       * @private
    */
      _getValueType: function (value) {
         return Context.getValueType(value);
   },

   /**
       *
       * @param qname
       * @return {number}
       * @private
    */
      _getFieldType: function (qname) {
         var
            data = this._contextObject,
            hasKey = qname in data;

         return hasKey ? data[qname].type : UndefinedFieldType;
      },

      _getFieldValue: function (qname) {
         var
            data = this._contextObject,
            hasKey = qname in data;

         return hasKey ? data[qname].value : NonExistentValue;
      },

      /**
    * Проверка на пустоту
    * @return {Boolean} пуст контекст или нет.
    */
   isEmpty : function(){
      return this._isEmpty;
   },

      _createTypedValue: function (value, type) {
         return {
            value: value,
            type: type
         };
   },

      toObject: function (recursive) {
         return $ws.helpers.reduce(this._contextObject, function (result, _, key) {
            var
               ftype = this._getFieldType(key),
               v = this._getFieldValue(key);

            result[key] = ftype.toJSON(v, recursive);
            return result;
         }, {}, this);
   },

   has: function(fieldName) {
         var
            descr = this._getFieldDescr(fieldName),
            value = descr && this.get(descr.qname, descr.keyPath);

         return !!(descr && value !== NonExistentValue);
   },

   /**
    * Меняет значение поля
    * @param {String} fieldName имя поля.
    * @param value значение поля.
    */
      set: function (qname, keyPath, value) {
         var
            vtype, newValue,
            oldValue = this._getFieldValue(qname),
            ftype = this._getFieldType(qname),
            data = this._contextObject,
            changed = !(oldValue === NonExistentValue && value === undefined) ? ftype.setWillChange(oldValue, keyPath, value) : false;

         if (changed) {
            newValue = ftype.set(oldValue, keyPath, value);
            vtype = this._getValueType(newValue);
            data[qname] = this._createTypedValue(newValue, vtype);
      this._isEmpty = false;
         }

         return changed;
   },

   /**
       * @param {string} name
       * @param {Boolean} [undefiniedAsExistent]
       * @param {Boolean} [createNonExistent]
       * @return {{qname: string, keyPath: Array}}
       * @private
       */
      _getFieldDescr: function (name, undefiniedAsExistent, createNonExistent) {
         var
            path = name.split(STRUCTURE_SEPARATOR),
            pathSlices = $ws.helpers.map(path, function (_, i) {
               return path.slice(0, path.length - i);
            }),
            data = this._contextObject,
            foundSlice = $ws.helpers.find(pathSlices, function (slice) {
               var fieldName = slice.join(STRUCTURE_SEPARATOR),
                   hasValue = fieldName in data,
                   value = data[fieldName];

               return value !== undefined || (undefiniedAsExistent && hasValue && value === undefined);
            }),
            qname, keyPath, result;

         if (foundSlice) {
            qname = foundSlice.join(STRUCTURE_SEPARATOR);
            keyPath = path.slice(foundSlice.length);

            result = {
               qname: qname,
               keyPath: keyPath
            };
         } else if (createNonExistent) {
            result = {
               qname: name,
               keyPath: []
            };
         } else {
            result = null;
         }

         return result;
      },

      /**
    * Получение значения поля
    * @param {String} fieldName имя поля.
    * @return value значение поля или undefined при его отсутствии.
    */
      get: function (qname, keyPath) {
         var
            ftype = this._getFieldType(qname),
            fvalue = this._getFieldValue(qname);

         return ftype.get(fvalue, keyPath);
   },

      getRaw: function (qname) {
         var data = this._contextObject;

         return qname in data ? data[qname].value : NonExistentValue;
      },

      removeRaw: function (qname) {
         delete this._contextObject[qname];
      },

      setRaw: function (qname, value) {
         this._contextObject[qname] = {
            value: value,
            type: this._getValueType(value)
         };
      },

   /**
    * Удаляет поле из объекта контекста.
    * @param {String} fieldName имя поля, которое необходимо удалить.
    * @return {Boolean} result результат удаления, произошло оно или нет.
    */
      remove: function (qname, keyPath) {
         var
            ftype = this._getFieldType(qname),
            data = this._contextObject,
            result = ftype !== UndefinedFieldType,
            res;

         if (result) {
            if (keyPath.length === 0) {
               if (ftype.clear) {
                  res = ftype.clear(data[qname].value);
                  data[qname].value = res.value;

                  result = res.changed;
               } else {
                  delete data[qname];
               }
            } else {
               res = ftype.remove(data[qname].value, keyPath);

               data[qname].value = res.value;
               result = res.changed;
            }
      }
      return result;
   }
});

   function withGroupChangeEvent(func) {
      return function () {
         var
            eventsCnt,
            result;

         if (!this.isDestroyed()) {
            if (this._updateLockCnt === 0) {
               this._updatedEventsCnt = 0;
            }
            this._updateLockCnt++;
            try {
               result = func.apply(this, arguments);
            } finally {
               this._updateLockCnt--;
               if (this._updateLockCnt === 0) {
                  eventsCnt = this._updatedEventsCnt;
                  this._updatedEventsCnt = 0;

                  if (eventsCnt > 0) {
                     this._notify('onFieldsChanged');
                  }
               }
            }
         }
         return result;
      };
   }

/**
 * Контекст области.
 * Отвечает за управление данными в объекте.
 * Здесь логика наследования контекстов и проброса методов.
 *
 * @class $ws.proto.Context
 * @extends $ws.proto.Abstract
 * @public
 */
   Context = $ws.proto.Abstract.extend(/** @lends $ws.proto.Context.prototype */{
   /**
       * @event onFieldNameResolution Событие, позволяющее перехватить поиск поля в этом контексте.
       * В параметре fieldName передаётся имя поля. Если обработчик события не выдаёт никакого результата, то
       * работает логика по умолчанию: если поле в этом контексте есть, то результатом поиска будет этот контекст, и это поле.
       * Если поле есть в родительском контексте, то результатом будет родительский контекст и это поле.
       * Если же обработчик события выдаст результатом имя какого-то другого поля, то поиск пойдёт уже в этом контексте, и по другому имени (и выше по родительским контекстам).
       * Таким образом можно, например, "заворачивать" какие-то поля дочерних контекстов, отсутствующие в них, в под-поля сложного поле родительского контекста (в рекорд, и js-объект).
       * @param {$ws.proto.EventObject} eventObject Дескриптор события.
       * @param {String} fieldName Имя поля.
       */
      /**
    * @event onDataBind При изменении контекста
    * Событие, происходящее при полном изменения контекста, а не одного поля, например, при выполнении {@link setContextData}.
    * @param {$ws.proto.EventObject} eventObject Дескриптор события.
    */
   /**
    * @event onDataBind Событие, происходящее в момент изменения контекста
    * @param {Object} eventObject описание в классе $ws.proto.Abstract
    */
   /**
    * @event onFieldChange Событие, происходящее при смене значения поля текущего или вышестоящего контекста.
    * @param {Object} eventObject описание в классе $ws.proto.Abstract.
    * @param {String} fieldName Имя измененного поля.
    * @param {$ws.proto.Control} [initiator] Инициатор изменения контекста. Передается, если изменение вызвал какой-то контрол.
    * @param {*} value Значение поля.
    * @see setValue
    */
      /**
       * @event onFieldsChanged Событие, происходящее при каком-либо изменении в полях контекста.
       * Причём, если метод контекста (или группа методов, выполняемая через метод контекста runInBatchUpdate) делает
       * несколько изменений в контексте, то событие onFieldsChanged произойдёт только один раз по окончании этого метода.
       * @param {Object} eventObject описание в классе $ws.proto.Abstract.
       * @see setValue
       * @see removeValue
       * @see insert
       * @see runInBatchUpdate
       */
   $protected: {
      _options: {
          /**
           * @cfg {Boolean} Является ли данный контекст глобальным.
           * Глобальный контекст - это контекст верхнего уровня.
           */
         isGlobal: false,
         /**
          * @cfg {String} Ограничение на запись или чтения
          * Работа только с текущим контекстом, игнорируется previousContext
          * Если значение set, то запись происходит только в текущий контекст, чтение не ограничено
          * Если значение setget, то запись происходит только в текущий контекст, чтение только из текущего контекста
          */
         restriction: ''
      },
         _restrictFlags: 0,
      _previousContext: null,
      _context: null,
         _record: null,
         _parentContextDataBindHandler: null,
      _parentContextFieldUpdateHandler: null,
         _updateLockCnt: 0,
         _updatedEventsCnt: 0,
         _fieldSubscriptions: {}
   },
   $constructor: function() {
         this._context = new ContextObject();

      switch(this._options.restriction) {
         case 'setget':
               this._restrictFlags = this._restrictFlags | RestrictFlags.GETSET;
         // break; пропущен специально, так как ограничиваем и на set тоже
         case 'set':
               this._restrictFlags = this._restrictFlags | RestrictFlags.SET;
      }

         this._parentContextDataBindHandler = withGroupChangeEvent(function () {
            if (!this._hasGetRestrictions()) {
               this._updatedEventsCnt++;
               this._notify('onDataBind');
         }
         }).bind(this);

         this._parentContextFieldsChangedHandler = withGroupChangeEvent(function () {
            if (!this._hasGetRestrictions()) {
               this._updatedEventsCnt++;
            }
         }).bind(this);

      this._parentContextFieldUpdateHandler = function(event, field, value, initiator) {
            if (!this._hasGetRestrictions()) {
               var descr = this._getFieldDescr(field, FindIntent.GET, RestrictFlags.GET);
               if (!descr) {
            // если у нас самих нет такого значения ...
                  this._notify('onFieldChange', field, value, initiator); // ... известим ниже о смене выше
         }
            }
         }.bind(this);

      if(this._options.isGlobal === false) {
         this._previousContext = $ws.single.GlobalContext;
      }

      this._subscribeOnParentUpdates();

         this._publish('onDataBind', 'onFieldChange', 'onFieldsChanged');
   },
   _subscribeOnParentUpdates: function() {
         var prev = this._previousContext;
         if (prev) {
            prev.subscribe('onDataBind', this._parentContextDataBindHandler);
            prev.subscribe('onFieldsChanged', this._parentContextFieldsChangedHandler);
            prev.subscribe('onFieldChange', this._parentContextFieldUpdateHandler);
      }
   },
   _unsubscribeOnParentUpdates: function() {
         var prev = this._previousContext;
         if (prev) {
            prev.unsubscribe('onDataBind', this._parentContextDataBindHandler);
            prev.unsubscribe('onFieldsChanged', this._parentContextFieldsChangedHandler);
            prev.unsubscribe('onFieldChange', this._parentContextFieldUpdateHandler);
      }
   },

      _unsubscribeFromFields: function () {
         $ws.helpers.forEach(this._fieldSubscriptions, function (sub, key) {
            this._setFieldSubscription(key, this._context.getRaw(key), NonExistentValue);
         }, this);
         this._fieldSubscriptions = {};
      },

   /**
    * Получить текущее ограничение контекста
    * @return {string}
    */
   getRestriction: function() {
      return this._options.restriction;
   },
   /**
    * Установить ограничение контекста
    * @param {String} restriction Ограничение на запись или чтения
    * Работа только с текущим контекстом, игнорируется previousContext
    * Если значение set, то запись происходит только в текущий контекст, чтение не ограничено
    * Если значение setget, то запись происходит только в текущий контекст, чтение только из текущего контекста
    */
   setRestriction: function(restriction) {
      this._options.restriction = restriction;

         this._restrictFlags = this._restrictFlags & (~RestrictFlags.GETSET);

      switch(restriction) {
         case 'setget':
               this._restrictFlags = this._restrictFlags | RestrictFlags.GET;
         // break; пропущен специально, так как ограничиваем и на set тоже
         case 'set':
               this._restrictFlags = this._restrictFlags | RestrictFlags.SET;
      }
   },

      _hasGetRestrictions: function () {
         return this._hasRestrictions(RestrictFlags.GET);
      },

      _hasSetRestrictions: function () {
         return this._hasRestrictions(RestrictFlags.SET);
      },

      _hasRestrictions: function (flags) {
         return (this._restrictFlags & flags) !== 0;
      },

   /**
    * Установить предыдущий контекст
    * @param {$ws.proto.Context} previous Контекст, который необходимо привязать предыдущим к текущему.
    * @return {$ws.proto.Context}  Текущий контекст.
    * @see getPrevious
    */
      setPrevious: withGroupChangeEvent(function (previous) {
      if (this.isGlobal()) {
            throw new Error('Attempt to set a previous context to a global context');
      }

         if (previous !== null && !previous instanceof $ws.proto.Context) {
            throw new Error('"previous" argument should be instance of $ws.proto.Context');
         }

         if (previous !== this._previousContext) {
         this._unsubscribeOnParentUpdates();
         this._previousContext = previous;
         this._subscribeOnParentUpdates();

            if (!this._hasGetRestrictions()) {
               this._updatedEventsCnt++;
      }
         }
      return this;
      }),

   /**
    * Получить предыдущий контекст.
    * @return {$ws.proto.Context} Предыдущий контекст или null, если он отсутствует.
    * @see setPrevious
    */
   getPrevious: function(){
      return this._previousContext;
   },

   /**
    * Навешивает/снимает обработчики с _context._record. Вызывает callback(newData).
    * @param {Object|$ws.proto.Record} newData Новый контекст.
    * @param {Function} callback Функция для выполнения дополнительного кода
    * @private
    */
      _changeContextData: withGroupChangeEvent(function (newData, callback) {
         var
            RecordFieldProxy = Context.RecordFieldProxy,
            proxy, old;

         callback.apply(this);

      if(newData instanceof $ws.proto.Record) {
            this._record = newData;

            this._record.each(function (colName) {
               proxy = new RecordFieldProxy(this._record, colName);
               old = this._context.getRaw(colName);

               this._setFieldSubscription(colName, old, proxy);
               this._context.setRaw(colName, proxy);
            }.bind(this));
         } else {
            $ws.helpers.forEach(newData, function (value, colName) {
               old = this._context.getRaw(colName);
               this._setFieldSubscription(colName, old, value);
               this._context.setRaw(colName, value);
            }, this);
      }

         this._updatedEventsCnt++;
      this._notify('onDataBind');
      }),
   /**
    * Изменить данные, хранимые контекстом.
    * Стирает всё, что было и записывает новые значения. В контексте будет только то, что передали в параметре context.
    * @param {Object|$ws.proto.Record} context Новый контекст.
    * @see replaceRecord
    * @see {@link $ws.proto.RecordSet#getContext getContext}
    */
   setContextData: function(context) {
         this._unsubscribeFromFields();

         this._changeContextData(context, function () {
            this._context = new ContextObject();
      });
   },
   /**
    * Смена записи в контексте.
    * Оставляет без изменения всё, кроме записи - её подменяет на новую.
    * @param {$ws.proto.Record} record Новая запись.
    * @see setContextData
    * @see {@link $ws.proto.RecordSet#getContext getContext}
    */
   replaceRecord: function(record) {
         if (this._record) {
            //Отписываюсь от полей рекорда
            this._record.each(function (colName) {
               this._setFieldSubscription(colName, this._context.getRaw(colName), null);
               this._context.removeRaw(colName);
            }.bind(this));
         }

         this._changeContextData(record, $ws.helpers.nop);
   },
   /**
    * Проверить контекст на то, является он глобальным или нет.
    * @return {Boolean} Флаг глобальности.
    */
   isGlobal: function(){
      return this._options.isGlobal;
   },
   /**
    * Проверить пуст ли контекст
    * @return {Boolean} true - контекст пуст, false - контекст не пуст.
    * @see setValue
    * @see getValue
    */
   isEmpty: function(){
      return this.isDestroyed() ? true : this._context.isEmpty();
   },
   /**
    * Получить запись, по которой построен контекст
    * Если контекст построен без записи, вернет null.
    * @returns {$ws.proto.Record} Если в контекст положили запись, то возвращаем её.
    */
   getRecord: function() {
         return this._record;
   },

      _getValue: function (fieldName, func, selfOnly, nonExistentAsIs) {
         if (func !== undefined && typeof(func) !== 'function') {
            throw new Error('Параметр func должен быть функцией, если он есть');
         }

         var
            restrOvr = RestrictFlags[selfOnly ? 'GET' : 'NONE'],
            descr = this._getFieldDescr(fieldName, FindIntent.GET, restrOvr, func),
            result;

         if (descr) {
            result = descr.contextData.get(descr.qname, descr.keyPath);
         } else {
            result = NonExistentValue;
         }
         return result === NonExistentValue && !nonExistentAsIs ? undefined : result;
      },

   /**
    * Получить значение поля из контекста
    * Если поле не найдено в текущем контексте, то ищется в предыдущем. И так, пока не найдётся.
    * @param {String} fieldName Имя поля, значение которого необходимо вернуть.
    * @param {Function} [func] Функция валидации значения, принимает один параметр - значение поля в контексте;
    * если возвращает TRUE, то значение ищется в предыдущем контексте, иначе должен возвращать значение поля.
    * @returns {String} Значение поля из контекста. Если такого поля нет, то вернёт undefined.
    * @see isEmpty
    * @see setValue
    */
   getValue: function(fieldName, func) {
      return fieldName ? this._getValue(fieldName, func, false) : undefined;
   },
   /**
    * Получить значение поля из контекста
    * Отличается от {@link getValue} тем, что не ищет в "родительских" контекстах.
    * @param {String} fieldName Название поля.
    * @returns {*} Значение поля из контекста. Если такого поля нет, то вернёт undefined.
    */
   getValueSelf: function(fieldName) {
         return this._getValue(fieldName, undefined, true);
   },

   /**
       * Функция возвращает true, если поле subField лежит внутри поля parentField, или является тем же самым полем.
       * @param {String} subField - предполагаемое под-поле (или то же самое поле)
       * @param {String} parentField - предполагаемое родительское (или то же самое поле)
       * @return {boolean}
       */
      isFieldSameOrSubField: function (subField, parentField) {
         var
            subDescr = this._getFieldDescr(subField),
            parentDescr = this._getFieldDescr(parentField),
            result;

         result = subDescr.context === parentDescr.context && subDescr.qname === parentDescr.qname;
         if (result) {
            result = $ws.helpers.findIdx(parentDescr.keyPath, function (val, idx) {
               return subDescr.keyPath[idx] !== val;
            }) === -1;
         }
         return result;
      },

      /**
       * @param {string} fieldName
       * @param {string} intent
       * @param {number} [restrictionsOvrerride]
       * @param {function} [validateFn]
       * @return {{qname: string, keyPath: Array, context: $ws.proto.Context, contextData: ContextObject}}
       * @private
       */
      _getFieldDescr: function (fieldName, intent, restrictionsOvrerride, validateFn) {
         var
            context = this,
            result = null,
            intentCheckFlags = {},
            restrFlags,
            undefAsExistent,
            check, val, newName;

         intentCheckFlags[FindIntent.GET]    = RestrictFlags.GET;
         intentCheckFlags[FindIntent.SET]    = RestrictFlags.SET;
         intentCheckFlags[FindIntent.REMOVE] = RestrictFlags.SET;

         while (!result && context) {
            restrFlags = context._restrictFlags | (restrictionsOvrerride || 0);
            undefAsExistent = (restrFlags & RestrictFlags.UNDEFINEDS_AS_EXISTENT) !== 0;

            result = context._context._getFieldDescr(fieldName, undefAsExistent);

            if (result && validateFn) {
               val = context._context.get(result.qname, result.keyPath);
               result = !validateFn(val) ? result : null;
            }

            if (!result) {
               newName = '' + (context._notify('onFieldNameResolution', fieldName, intent === FindIntent.SET) || '');

               result = newName.length > 0;
               if (result) {
                  result = context._context._getFieldDescr(newName, false, true);
               }

               if (!result) {
                  check = restrFlags & intentCheckFlags[intent];
                  context = check === 0 ? context.getPrevious() : null;
               }
            }
         }

         if (!result && intent === FindIntent.SET) {
            context = this;
            result = context._context._getFieldDescr(fieldName, false, true);
         }

         if (result) {
            result.context = context;
            result.contextData = context._context;
         }

         return result;
      },

      _setFieldSubscription: function (qname, oldValue, newValue) {
         var subscriptions = this._fieldSubscriptions, sub, newType;

         if (oldValue !== newValue) {
            if (qname in subscriptions) {
               sub = subscriptions[qname];
               delete subscriptions[qname];
               if (sub) {
                  sub();
               }
            }

            newType = Context.getValueType(newValue);
            if (newValue && newValue !== NonExistentValue && newType.subscribe) {
               sub = function () {
                  //если это внешнее изменение, от самого поля, а не из setValue
                  if (this._updateLockCnt === 0) {
                     withGroupChangeEvent(function() {
                        this._updatedEventsCnt++;
                        this._notify('onFieldChange', qname, this.getValue(qname));
                     }).call(this);
                  }
               }.bind(this);

               subscriptions[qname] = newType.subscribe(newValue, sub);
            }
         }
      },

      /**
    * Получить оригинальный контекст, в котором непосредственно расположено поле.
    * Если такого поля во всех родительских контекстах нет, то вернёт undefined.
    * @param {String} fieldName Имя поля.
    * @param {Boolean} [setRestriction] - Учесть ограничение на set
    * @return {$ws.proto.Context|undefined} Объект контекста или undefined.
    */
   getFieldOrigin: function (fieldName, setRestriction) {
         var
            intent = FindIntent[setRestriction ? 'SET' : 'GET'],
            descr = this._getFieldDescr(fieldName, intent);

         return descr && descr.context;
   },
   /**
    * Проверить, есть ли указанное поле в данном контексте
    * @param {String} fieldName Имя поля.
    * @returns {Boolean} true - указанное поле есть в данном контексте, false - нет.
    */
   hasField: function(fieldName) {
         var value = this._getValue(fieldName, undefined, true, true);
         return value !== NonExistentValue;
   },

   /**
       * Проверить, есть ли указанное поле в данном контексте, или в его родительских контекстах.
       * @param {String} fieldName Имя поля.
       * @returns {Boolean} true - указанное поле есть в данном контексте, false - нет.
       */
      hasFieldWithParents: function (fieldName) {
         var value = this._getValue(fieldName, undefined, false, true);
         return value !== NonExistentValue;
      },

      /**
    * Получить оригинальный контекст, непосредственно в котором расположено поле.
    * Аналогично {@link getFieldOrigin}, но находит даже те поля, значения которых undefined.
    * Если контекст не найден, то вернет null.
    * @param {String} fieldName Имя поля.
    * @returns {$ws.proto.Context} Объект контекста.
    */
   getFieldOrigin2: function(fieldName) {
         var
            descr = this._getFieldDescr(fieldName, FindIntent.GET, RestrictFlags.UNDEFINEDS_AS_EXISTENT);

         return descr && descr.context;
   },
   /**
    * Установка значения в контекст
    * @param {String|Object} fieldName Имя поля, в которое будет установлено значение. Можно передать объект.
    * Его ключи - поля, значения - соответственно значения контекста.
    * @param {*} [value] Значение, которое будет установлено.
    * @param {Boolean} [toSelf=false] Принудительная установка значения в текущий контекст.
    * - true - запишет значение в текущий контекст без поиска в родительских,
    * - false - сначала будет пытаться найти в родительских  контекстах поле с таким же именем и записать туда, если не
    * найдёт, то запишет в текущий.
    * Если желаемого значения нет ни в одном из контекстов выше, независимо от параметра toSelf запишет значение в
    * текущий контекст.
    * @param {$ws.proto.Control} [initiator] Инициатор изменения полей контекста
    * @example
    * 1. Зададим значение поля контекста:
    * <pre>
    *     //fieldName - необходимое имя поля
    *     control.getLinkedContext().setValue(linkedFieldName, control.getValue());
    * </pre>
    * 2. Одновременная установка нескольких полей контекста:
    * <pre>
    *     context.setValue({
    *        field1: 1,
    *        field2: 2
    *     });
    * </pre>
    */
      setValue: withGroupChangeEvent(function (fieldName, value, toSelf, initiator) {
      // пустые названия полей вообще не принимаем
      if (!fieldName) {
         throw new Error('Нельзя писать значения в контекст по пустому полю ""');
      }
      function setV(fieldName, val, toSelf, initiator) {
            var
               descr = this._getFieldDescr(fieldName, FindIntent.SET, RestrictFlags[toSelf ? 'SET' : 'NONE']),
               context = descr.context,
               updateContext = withGroupChangeEvent(function () {
                  var
                     oldRaw = this._context.getRaw(descr.qname),
                     changed = this._context.set(descr.qname, descr.keyPath, val),
                     newRaw = this._context.getRaw(descr.qname);

                  if (changed) {
                     this._setFieldSubscription(descr.qname, oldRaw, newRaw);
                     this._updatedEventsCnt++;
                     this._notify('onFieldChange', fieldName, val, initiator); // ... известим
      }
               }).bind(context);

            updateContext();
         }

      // А вдруг кто-то передал объект
      if (typeof(fieldName) == 'object') {
            if (!$ws.helpers.isPlainObject(fieldName)) {
               throw new Error('setValue supports simple JSON objects only');
            }

            var toSelf_ = value, initiator_ = toSelf;

            $ws.helpers.forEach(fieldName, function (value, key) {
            // Смещаем параметры
               setV.call(this, key, value, toSelf_, initiator_);
            }, this);
      } else {
            setV.call(this, fieldName, value, toSelf, initiator);
      }
      }),

      /** Эта функция позволяет вызвать несколько методов контекста, и получить по итогам выполнения этих методов только
       * одно событие onFieldsChanged (если были сделаны какие-то изменения). В неё передаётся один аргумент - функция,
       * которая и вызывает эти методы.
       * @param {Function} fn Функция, которая вызывает у контекста несколько методов.
       */
      runInBatchUpdate: withGroupChangeEvent(function (fn) {
         return fn.call(this);
      }),

   /**
    * Удалить значения из контекста
    * @param {String} fieldName Имя поля, из которого удалять.
    * @param {Boolean} [toSelf=false]  Если false и не удалил в текущем, то пытается удалить в предыдущем.
    */
      removeValue: withGroupChangeEvent(function (fieldName, toSelf) {
         var
            restrOvr = toSelf ? RestrictFlags.SET : RestrictFlags.NONE,
            descr = this._getFieldDescr(fieldName, FindIntent.REMOVE, restrOvr),
            newRaw, oldRaw, data,
            result;

         if (descr) {
            data = descr.contextData;
            oldRaw = data.getRaw(descr.qname);
            result = descr.contextData.remove(descr.qname, descr.keyPath);
            if (result) {
               newRaw = data.getRaw(descr.qname);
               descr.context._setFieldSubscription(descr.qname, oldRaw, newRaw);

               this._updatedEventsCnt++;
            }
      } else {
            result = false;
         }
         return result;
      }),
   /**
    * Установка значения в себя, без проброса в родительский контекст
    * @param {String|Object} fieldName имя поля, в которое будет установлено значение или объект с данными для установки в контекст ({ имяПоля: значение })
    * @param [value] значение, которое будет установлено.
    * @param {$ws.proto.Control} [initiator] Инициатор изменения контекста.
    *
    * <pre>
    *    ctx.setValueSelf('field', 10, control);
    *    ctx.setValueSelf({
    *       field: 10
    *    }, control);
    * </pre>
    */
   setValueSelf: function(fieldName, value, initiator) {
      if (typeof fieldName == 'object') {
         this.setValue(fieldName, true, initiator);
      } else {
         this.setValue(fieldName, value, true, initiator);
      }
   },
   /**
    * Вставить в контекст объект как связанный
    * @param {$ws.proto.Record || Object} values Значения для вставки
    * @param {String} link Имя связи
    */
   insert: function(values, link){
      this._multiOperation(values, link, 'insert');
   },
   /**
    * Удалить из контекста объект по связи
    * @param {$ws.proto.Record | Object} values Значения для удаления
    * @param {String} link Имя связи
    */
   remove: function(values, link){
      this._multiOperation(values, link, 'remove');
   },
   /**
    * Метод работы со связанными объектами
    * @param {$ws.proto.Record | Object} values значения для вставки.
    * @param {String} link Имя связи.
    * @param {String} type  Тип действия 'insert' || 'remove'.
    */
      _multiOperation: withGroupChangeEvent(function (values, link, type) {
         if (link !== null && link !== undefined && typeof link !== 'string') {
            throw new Error('Параметр link должен быть строкой - именем связи');
         }

         var linkS = link ? link + LINK_SEPARATOR : '';

      if (values instanceof $ws.proto.Record) {
         values = values.toObject();
      }

         if (typeof(values) === 'object') {
            if (!$ws.helpers.isPlainObject(values) && !$ws.helpers.isPlainArray(values)) {
               throw new Error('"values" argument error: _multiOperation supports simple JSON objects only');
            }

         for (var i in values){
            if(values.hasOwnProperty(i)) {
                  if (type == 'remove') {
                     this.removeValue(linkS + i, true);
            }
                  if (type == 'insert') {
                     this.setValueSelf(linkS + i, values[i]);
         }
               }
            }
      } else if(values === false || values === null || values === undefined) {
         // Вычищение связанных значений из контекста с попыткой понять, что же вычищать
            var
               record = this.getRecord(),
               removeValue = function (key) {
                  if (key.indexOf(link) === 0) {
                     this.removeValue(key, true);
         }
               }.bind(this);

            if (record) {
               $ws.helpers.forEach(record.getColumns(), function (key) {
                  removeValue(key);
               });
            } else {
               $ws.helpers.forEach(this.toObject(false), function (_, key) {
                  removeValue(key);
               });
      }
      }

      this._notify('onDataBind');
      }),
   destroy: function() {
         this._record = null;

      this._unsubscribeOnParentUpdates();
         this._unsubscribeFromFields();
         this._context = new ContextObject();

      $ws.proto.Context.superclass.destroy.apply(this, arguments);
   },
   /**
    * Создать дочерний контекст
    * Создаёт новый контекст, зависимый от текущего.
    * @returns {$ws.proto.Context} Дочерний контекст
    */
   createDependent: function() {
         var result = new $ws.proto.Context();
      result.setPrevious(this);
      return result;
   },
   /**
    * Представляет контекст в виде объекта, содержащего поля контекста со значениями в строковом виде
    * @param {Boolean} recursive Флаг, позволяющий при значени true получить полное содержимое контекста включая всех родителей.
    * @returns {Object} Объект, содержащий поля контекста в строковом виде
    */
   toObject: function(recursive) {
         var result = this._context.toObject(recursive);

      if(recursive) {
         var parent = this.getPrevious();
         if(parent) {
            var parentObj = parent.toObject(true);
            for(var i in parentObj) {
               if(parentObj.hasOwnProperty(i) && !(i in result)) {
                  result[i] = parentObj[i];
               }
            }
         }
      }

      return result;
   }
});

   Context.registerFieldType = function (type) {
      AllFieldTypes.unshift(type);
   };

   Context.getValueType = function (value) {
      return $ws.helpers.find(AllFieldTypes, function (ftype) {
         return ftype.is(value);
      });
   };

   Context.NonExistentValue = NonExistentValue;
   Context.SimpleFieldType = SimpleFieldType;
   Context.RecordFieldProxy = null;
   Context.STRUCTURE_SEPARATOR = STRUCTURE_SEPARATOR;

   $ws.proto.Context = Context;
})();

/**
 * Глобальный контекст
 *
 * Это экземпляр класса {@link $ws.proto.Context}. Все методы смотрите у контекста.
 *
 * @class $ws.single.GlobalContext
 * @singleton
 * @public
 */
$ws.single.GlobalContext = new $ws.proto.Context({ isGlobal: true });

/**
 * Диспетчер команд
 *
 * @class $ws.single.CommandDispatcher
 * @singleton
 * @public
 */
$ws.single.CommandDispatcher = new ($ws.core.extend({}, /** @lends $ws.single.CommandDispatcher.prototype */{
   /**
    * Пример объявления команд: объявляются 2 команды: fill и clear. Команда fill принимает параметры.
    * Если команда возвращает true-value (что-то, что кастуется к булевскому true), то всплытие команды прекращается,
    * если false, то всплытие по цепочке хозяев продолжается.
    *
    * <pre>
    *    $ws.proto.FieldIntegerWithCommands = $ws.proto.FieldInteger.extend({
    *        $constructor : function() {
    *           $ws.single.CommandDispatcher.declareCommand(this, 'fill', this._fillCommand);
    *           $ws.single.CommandDispatcher.declareCommand(this, 'clear', this._clearCommand);
    *        },
    *
    *        _fillCommand: function(args) {
    *           var options = $.extend({
    *              'fillData': '12345'
    *           }, args);
    *           this.setValue(options['fillData']);
    *           return false; // чтобы продолжить всплытие команды
    *        },
    *        _clearCommand: function() {
    *           this.setValue('');
    *           return true;
    *        }
    *     });
    * </pre>
    * @param {$ws.proto.Control} control Контрол, регистрирующий команду
    * @param {string} commandName Имя команды
    * @param {Function} commandHandler Обработчик команды. На данном контроле для данной команды может быть зарегистрирован только один обработчик
    */
   declareCommand: function(control, commandName, commandHandler){
      var commandStorage;
      if (control && $ws.proto.Control && control instanceof $ws.proto.Control) {
         commandStorage = control.getUserData('commandStorage') || {};
         commandStorage[commandName] = commandHandler.bind(control);
         control.setUserData('commandStorage', commandStorage);
      }
   },
   /**
    * Удаление всех команд для объекта. Должно ОБЯЗАТЕЛЬНО выполняться для удаляемых объектов (вызываться в деструкторах, например).
    * @param object
    */
   deleteCommandsForObject: function(object) {
      if (object && $ws.proto.Control && object instanceof $ws.proto.Control) {
         object.setUserData('commandStorage');
      }
   },
   /**
    * Отправка команды.
    * Команда отправляется либо объекту хозяину (см. {@link $ws.proto.Control#owner}),
    * либо по цепочке родителей контрола (см. {@link $ws.proto.Control#parent}) до первого обработчика, вернувшего true-value.
    * Если обработчик возвращает false - всплытие продолжается к родителю.
    * @param {*} [arg1, ...] Аргументы, которые будут переданы в команду.
    * @example
    * <pre>
    *    hdl = {
    *        sendCommand1: function(e){
    *           $ws.single.CommandDispatcher.sendCommand(this, 'fill', {'fillData': '+7 (4855) 25245'});
    *        },
    *        sendCommand2: function(e){
    *           $ws.single.CommandDispatcher.sendCommand(this, 'clear');
    *        },
    *        sendCommand3: function () {
    *           dialogRecord.sendCommand('save', readyDeferred, true);
    *           readyDeferred.addCallBacks(
    *              function () {
    *                 $ws.core.alert("Сохранено успешно.");
    *              },
    *              function () {
    *                 $ws.core.alert("Ошибка при сохранении.");
    *              }
    *          );
    *        }
    *    };
    * </pre>
    * @param {$ws.proto.Control} eventSender Контрол, отправивший команду
    * @param {String} commandName Имя команды
    *
    * @return {*} Возвращает результат обработчика команды или true, если было вызвано несколько обработчиков; или false, если ни один обработчик не был вызван.
    */
   sendCommand: function(eventSender, commandName){
      var payload = Array.prototype.slice.call(arguments, 2),
          commandDestination,
          commandHandler,
          result,
          owner;
      if (eventSender) {
         commandHandler = this._getCommand(eventSender, commandName);
         if (commandHandler !== null) {
            result = commandHandler.apply(eventSender, payload);
            if (result) {
               return result;
            }
         }
         if (eventSender.getOwner && (owner = eventSender.getOwner()) !== null) {
            commandDestination = owner;
            commandHandler = this._getCommand(commandDestination, commandName);
            if (commandHandler !== null) {
               return commandHandler.apply(commandDestination, payload) || true;
            }
         }
         var flag = false;
         commandDestination = eventSender;
         while ((commandDestination = commandDestination.getParent()) !== null) {
            commandHandler = this._getCommand(commandDestination, commandName);
            if (commandHandler !== null) {
               flag = true;
               result = commandHandler.apply(commandDestination, payload);
               if (result) {
                  return result;
               }
            }
         }
         return flag;
      } else
         return false;
   },

   /**
    * Получает команду из хэша команд
    * @param {$ws.proto.Control} owner Элемент, для которого запрашивается обработчик команды.
    * @param {String} commandName Имя команды.
    * @return {Function} Возвращает обработчик команды или null, если передаваемый элемент не декларировал обработку данной команды.
    */
   _getCommand: function(owner, commandName){
      if (owner && $ws.proto.Control && owner instanceof $ws.proto.Control) {
         var commandStorage = owner.getUserData('commandStorage');
         if (commandStorage) {
            return commandStorage[commandName] || null;
         }
      }
      return null;
   }
}))();

/**
 * Реализация объекта "Перечисляемое".
 * Хранит набор доступных значений.
 * Несмотря на то, что в Object ключ - строка, если текущий индекс null, он возвращается как null, а не как "null".
 *
 * @class $ws.proto.Enum
 * @name $ws.proto.Enum
 * @public
 */
$ws.proto.Enum = (function(){

   var toS = Object.prototype.toString;

   var SUPPORTED = {
      'boolean': 1,
      'string': 1,
      'number': 1
   };

   function strToHash(str) {
      str = str + '';
      return $ws.helpers.reduce(str.split(''), function(hash, c) {
         return hash + 31 * c.charCodeAt(0);
      }, 17);
   }

   function Enum(cfg) {

      this._curValIndex = undefined;
      this._availableValues  = {};
      this._hashCode = 0;
      this._fallbackVal = undefined;
      this._initialValue = undefined;

      var
         avValues = cfg.availableValues,
         curValue = cfg.currentValue,
         iKey;

      curValue = (curValue === null || curValue === 'null') ? 'null' : parseInt(curValue, 10);

      if(toS.call(avValues) == '[object Object]' && avValues){
         for(var i in avValues){
            if(avValues.hasOwnProperty(i)) {
               var v = avValues[i];
               if (v === null || (typeof v) in SUPPORTED) {
                  iKey = (i === null || i === 'null') ? 'null' : parseInt(i, 10);
                  if(this._fallbackVal === undefined) {
                     this._fallbackVal = iKey;
                  }
                  if (curValue === iKey) {
                     this._curValIndex = iKey;
                  }
                  this._availableValues[i] = avValues[i];
               }
            }
         }
      } else {
         throw new Error ('Class Enum. Option availableValues must be set to object');
      }
      if(this._curValIndex === undefined) {
         if(this._fallbackVal === undefined)
            throw new Error ('Class Enum. No values to build');
         else
            this._curValIndex = iKey;
      }
      this._initialValue = this._curValIndex;
   }

   Enum.prototype.valueOf = function(){
      return this.getCurrentValue();
   };

   /**
    * Получить индекс текущего значения.
    * @return {*} "Индекс" текущего значения перечисляемого.
    * @example
    * При клике на кнопку (btn) вернуть к начальному состоянию группу радиокнопок (fieldRadio).
    * <pre>
    *    btn.subscribe('onClick', function() {
    *       var index = fieldRadio.getDefaultValue().getCurrentValue();
    *       fieldRadio.setValueByIndex(index);
    *    });
    * </pre>
    */
   Enum.prototype.getCurrentValue = function() {
      return this._curValIndex == "null" ? null : this._curValIndex;
   };

   /**
    * Получить доступные значения Enum.
    * @return {Object} Hash-map доступных значений для данного перечисляемого.
    *
    */
   Enum.prototype.getValues = function() {
      return this._availableValues;
   };

   /**
    * Установить текущее значение перечисляемого
    * @param index индекс нового текущего значения
    * @throws {Error} в случае, если указанный индекс отсутствует в текущем Enum'е
    */
   Enum.prototype.set = function(index){
      // null преобразовываем к строке 'null'
      index = (index === null) ? 'null' : index;
      if(index in this._availableValues) {
         this._hashCode = 0;
         this._curValIndex = index;
      }
      else {
         // Попытались сбросить Enum, но null не допускается.
         if(index === 'null')
            this.set(this._initialValue);
         else // Что-то иное
            throw new Error('Class Enum. Unsupported index: ' + index);
      }
   };

   /**
    * Возвращает представление Enum в виде объекта.
    * Можно использовать для создания клона Enum.
    * <pre>
    *    var enumClone = new $ws.proto.Enum(original.toObject());
    * </pre>
    * @returns {Object} Представление в виде объекта
    */
   Enum.prototype.toObject = function() {
      return {
         availableValues: this.getValues(),
         currentValue: this.getCurrentValue()
      }
   };

   Enum.prototype.hashCode = function() {
      if(this._hashCode === 0) {
         this._hashCode = 17 + 31 * Object.keys(this._availableValues).length;
         $ws.helpers.forEach(this._availableValues, function(val, key){
            var v = parseInt(key, 10);
            this._hashCode += 31 * ((isNaN(v) ? -1 : v) + strToHash(val));
         }, this);
      }
      return this._hashCode;
   };

   /**
    * Проверяет данный объект на совпадение с другим.
    * Проверяется как текущее выставленное значение, так и набор допустимых.
    *
    * @param obj Объект, с которым сравниваем.
    * @return {Boolean} Совпадает или нет.
    */
   Enum.prototype.equals = function(obj) {
      return obj instanceof $ws.proto.Enum &&                  // this is an enum
         this.hashCode() == obj.hashCode() &&              // it stores same values
         this.getCurrentValue() == obj.getCurrentValue();  // current value is the same
   };

   Enum.prototype.rollback = function(val){
      this.set(val);
   };

   /**
    * Получить текущее значение Enum.
    * @returns {string} Возвращает строковое значение Enum.
    * @example
    * <pre>
    *     var value = myEnum.toString();
    * </pre>
    */
   Enum.prototype.toString = function() {
      return "" + this._availableValues[this._curValIndex];
   };

   /**
    * Клонирует текущий объект
    * @return {$ws.proto.Enum}
    */
   Enum.prototype.clone = function(){
      return new Enum({
         currentValue: this.getCurrentValue(),
         availableValues: this.getValues()
      });
   };

   /**
    * Изменено ли значение Enum по сравнению с начальным значением, которым был инициализирован Enum.
    * @returns {boolean} Возвращает булево значение. true - значение было изменено, иначе false.
    */
   Enum.prototype.isChanged = function() {
      return this._curValIndex !== this._initialValue;
   };

   return Enum;

})();

/**
 * Реализация объекта "Временной интервал".
 *
 * "Временной интервал" предназначен для хранения относительного временного промежутка, т.е. начало и окончание которого
 * не привязано к конкретным точкам во времени. Он может быть использован для хранения времени выполнения какого-либо
 * действия или для хранения времени до наступления события. При установке значения переменной данного типа, сохраняется
 * только дельта. При этом нужно учитывать, что интервал нормализует значения. В результате, интервал в 1 день, 777 часов,
 * 30 минут будет преобразован в интервал равный 33-м дням, 9 часам, 30 минутам, и будет сохранён именно в таком формате.
 * Формат ISO 8601 урезан до дней. Причина в том, что в случае использования месяцев и лет возникает неоднозначность. В итоге,
 * строковой формат выглядит так:
 * P[<Число_недель>W][<Число_дней>D][T[<Число_часов>H][<Число_минут>M][<Число_секунд>[.Число_долей_секунды]S]
 *
 * @class $ws.proto.TimeInterval
 * @name $ws.proto.TimeInterval
 */
$ws.proto.TimeInterval = (function() {
   var
      millisecondsInSecond = 1000,
      millisecondsInMinute = 60000,
      millisecondsInHour = 3600000,
      millisecondsInDay = 86400000,
      secondsInMinute = 60,
      minutesInHour = 60,
      hoursInDay = 24,
      intervalKeys = ['days', 'hours', 'minutes', 'seconds', 'milliseconds'],
      millisecondsConst = {
         days: millisecondsInDay,
         hours: millisecondsInHour,
         minutes: millisecondsInMinute,
         seconds: millisecondsInSecond,
         milliseconds: 1
      },
      regExesArrayForParsing = [
         {
            regExp: /^P(?:(-?[0-9]+)D)?(?:T(?:(-?[0-9]+)H)?(?:(-?[0-9]+)M)?(?:(-?[0-9]+(?:\.[0-9]{0,3})?)[0-9]*S)?)?$/i,
            format: 'P[<Число_дней>D][T[<Число_часов>H][<Число_минут>M][<Число_секунд>[.Число_долей_секунды]S]'
         }
      ],
      regExesArrayForValidation = [
         {
            regExp: /^P(-?[0-9]+D)?(T(-?[0-9]+H)?(-?[0-9]+M)?(-?[0-9]+(\.[0-9]+)?S)?)?$/i,
            format: 'P[<Число_дней>D][T[<Число_часов>H][<Число_минут>M][<Число_секунд>[.Число_долей_секунды]S]'
         }
      ];

   // вспомогательные функции
   function getAvailableFormats() {
      var formats = [];

      for (var i = 0; i < regExesArrayForValidation.length; i++) {
         formats[i] = regExesArrayForValidation[i].format;
      }

      return formats.join(', ');
   }

   function toNumber(number) {
      return parseFloat(number) || 0;
   }

   function truncate(number)
   {
      return number > 0
         ? Math.floor(number)
         : Math.ceil(number);
   }

   // нужно учитывать, что данный метод округляет число
   function toFixedNumber(number, fractionDigits) {
      return toNumber(toNumber(number).toFixed(fractionDigits));
   }

   function fromIntervalStrToIntervalArray(intervalStr) {
      var
         intervalArray = [],
         regexResult,
         validatorIndex;

      if (!isValidStrInterval(intervalStr)) {
         throw new Error('Передаваемый аргумент не соответствует формату ISO 8601. Допустимые форматы: ' + getAvailableFormats() + '. ');
      }

      for (validatorIndex = 0; validatorIndex < regExesArrayForParsing.length; validatorIndex++) {
         if (regexResult = regExesArrayForParsing[validatorIndex].regExp.exec(intervalStr)) {
            break;
         }
      }

      switch (validatorIndex) {
         case 0:
            // i = 1 - исключаем первый элемент из перебора, так как это всего лишь строка intervalStr
            for (var i = 1; i < regexResult.length; i++) {
               // если секунды
               if (i === (regexResult.length - 1)) {
                  // секунды
                  intervalArray.push(truncate(regexResult[i]));
                  // миллисекунды
                  intervalArray.push(toFixedNumber((regexResult[i] % 1) * 1000));
               } else {
                  intervalArray.push(toNumber(regexResult[i]));
               }
            }
      }

      return intervalArray;
   }

   function fromIntervalArrayToIntervalObj(intervalArray) {
      var intervalObj = {};

      for (var i = 0; i < intervalKeys.length; i++) {
         intervalObj[intervalKeys[i]] = toNumber(intervalArray[i]);
      }

      return intervalObj;
   }

   function fromIntervalObjToMilliseconds(intervalObj) {
      var milliseconds = 0;

      $ws.helpers.forEach(millisecondsConst, function(val, key){
         milliseconds += val * toNumber(intervalObj[key]);
      });

      return milliseconds;
   }

   function fromMillisecondsToNormIntervalObj(milliseconds) {
      var normIntervalObj = {};

      $ws.helpers.forEach(millisecondsConst, function(val, key){
         normIntervalObj[key] = truncate(milliseconds / val);
         milliseconds = milliseconds % val;
      });

      return normIntervalObj;
   }

   // преобразует нормализованный объект в нормализованную строку: {days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5} => "P1DT2H3M4.005S"
   function fromNormIntervalObjToNormIntervalStr(normIntervalObj) {
      var secondsWithMilliseconds = toFixedNumber(normIntervalObj.seconds + normIntervalObj.milliseconds / 1000, 3);

      return 'P' + normIntervalObj.days + 'D' + 'T' + normIntervalObj.hours + 'H' + normIntervalObj.minutes + 'M' + secondsWithMilliseconds + 'S';
   }

   function isValidStrInterval(intervalStr) {
      for (var i = 0; i < regExesArrayForValidation.length; i++) {
         if (regExesArrayForValidation[i].regExp.test(String(intervalStr))) {
            return true;
         }
      }
      return false;
   }

   function isInteger(number) {
      if (typeof number === 'number' && (number % 1) === 0) {
         return true
      }

      return false
   }

   // вызывать с помощью call или apply
   function dateModifier(sign, date) {
      if (!(date instanceof Date)) {
         throw new Error('Передаваемый аргумент должен быть объектом класса Date. ');
      }

      date = new Date(date.getTime());

      date.setTime(date.getTime() + sign * this.getTotalMilliseconds());

      return date;
   }

   /**
    * Конструктор.
    *
    * @param {$ws.proto.TimeInterval | String | Array | Object | Number} source - Может быть: строка - “P20DT3H1M5S”, массив - [5, 2, 3, -4], объект - {days: 1, minutes: 5}, число – 6 или объект типа $ws.proto.TimeInterval. Если передается массив, то первый элемент – дни, второй – часы, т.д. до миллисекунд. Остальные элементы игнорируются. Если передается число, то оно интерпретируется, как количество миллисекунд.
    * @return {$ws.proto.TimeInterval}
    */
   function TimeInterval(source) {
      // вызов через оператор new
      if (this instanceof TimeInterval) {
         this._normIntervalObj = undefined;
         this._normIntervalStr = undefined;

         this.set(source);
      } else {
         throw new Error('$ws.proto.TimeInterval вызывать через оператор new. ');
      }
   }

   /**
    * Возвращает колличество дней в интервале.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getDays = function() {
      return this._normIntervalObj.days;
   };

   /**
    * Добавляет дни к интервалу.
    *
    * @param {Number} days - Колличество дней.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.addDays = function(days) {
      return this.addMilliseconds(toNumber(days) * millisecondsInDay);
   };

   /**
    * Вычитает дни из интервала.
    *
    * @param {Number} days - Колличество дней.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.subDays = function(days) {
      return this.subMilliseconds(toNumber(days) * millisecondsInDay);
   };

   /**
    * Возвращает колличество часов в интервале.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getHours = function() {
      return this._normIntervalObj.hours;
   };

   /**
    * Добавляет часы к интервалу.
    *
    * @param {Number} hours - Колличество часов.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.addHours = function(hours) {
      return this.addMilliseconds(toNumber(hours) * millisecondsInHour);
   };

   /**
    * Вычитает часы из интервала.
    *
    * @param {Number} hours - Колличество часов.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.subHours = function(hours) {
      return this.subMilliseconds(toNumber(hours) * millisecondsInHour);
   };

   /**
    * Возвращает колличество минут в интервале.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getMinutes = function() {
      return this._normIntervalObj.minutes;
   };

   /**
    * Добавляет минуты к интервалу.
    *
    * @param {Number} minutes - Колличество минут.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.addMinutes = function(minutes) {
      return this.addMilliseconds(toNumber(minutes) * millisecondsInMinute);
   };

   /**
    * Вычитает часы из интервала.
    *
    * @param {Number} hours - Колличество часов.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.subMinutes = function(minutes) {
      return this.subMilliseconds(toNumber(minutes) * millisecondsInMinute);
   };

   /**
    * Возвращает колличество секунд в интервале.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getSeconds = function() {
      return this._normIntervalObj.seconds;
   };

   /**
    * Добавляет секунды к интервалу.
    *
    * @param {Number} seconds - Колличество секунд.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.addSeconds = function(seconds) {
      return this.addMilliseconds(toNumber(seconds) * millisecondsInSecond);
   };

   /**
    * Вычитает секунды из интервала.
    *
    * @param seconds {Number} Колличество секунд.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.subSeconds = function(seconds) {
      return this.subMilliseconds(toNumber(seconds) * millisecondsInSecond);
   };

   /**
    * Возвращает колличество миллисекунд в интервале.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getMilliseconds = function() {
      return this._normIntervalObj.milliseconds;
   };

   /**
    * Добавляет миллисекунды к интервалу.
    *
    * @param {Number} milliseconds - Колличество миллисекунд.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.addMilliseconds = function(milliseconds) {
      return this.set(this.getTotalMilliseconds() + truncate(milliseconds));
   };

   /**
    * Вычитает миллисекунды из интервала.
    *
    * @param {Number} milliseconds - Колличество миллисекунд.
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.subMilliseconds = function(milliseconds) {
      return this.set(this.getTotalMilliseconds() - truncate(milliseconds));
   };

   /**
    * Возвращает общее колличество часов в интервале, переводя дни в часы.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getTotalHours = function() {
      return this._normIntervalObj.days * hoursInDay + this._normIntervalObj.hours;
   };

   /**
    * Возвращает общее колличество минут в интервале, переводя дни и часы в минуты.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getTotalMinutes = function() {
      return this.getTotalHours() * minutesInHour + this._normIntervalObj.minutes;
   };

   /**
    * Возвращает общее колличество секунд в интервале, переводя дни, часы и минуты в секунды.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getTotalSeconds = function() {
      return this.getTotalMinutes() * secondsInMinute + this._normIntervalObj.seconds;
   };

   /**
    * Возвращает общее колличество миллисекунд в интервале, переводя дни, часы, минуты и секунды в миллисекунды.
    *
    * @return {Number}
    */
   TimeInterval.prototype.getTotalMilliseconds = function() {
      return this.getTotalSeconds() * millisecondsInSecond + this._normIntervalObj.milliseconds;
   };

   /**
    * Устанавливает значение интервала.
    *
    * @param {$ws.proto.TimeInterval | String | Array | Object | Number} source - Может быть: строка - “P20DT3H1M5S”, массив - [5, 2, 3, -4], объект - {days: 1, minutes: 5}, число – 6 или объект типа $ws.proto.TimeInterval. Если передается массив, то первый элемент – дни, второй – часы, т.д. до миллисекунд. Остальные элементы игнорируются. Если передается число, то оно интерпретируется, как количество миллисекунд.
    * @return {$ws.proto.TimeInterval} Возвращает this.
    */
   TimeInterval.prototype.set = function(source) {
      var type;

      source = $ws.core.clone(source);

      if (source instanceof TimeInterval) {
         type = 'timeInterval';
      } else if (typeof source === 'string') {
         type = 'intervalStr';
      } else if (source instanceof Array) {
         type = 'intervalArray';
      } else if (source && typeof source === 'object') {
         type = 'intervalObj';
      } else {
         source = toNumber(source);
         type = 'milliseconds';
      }

      switch (type) {
         case 'intervalStr':
            source = fromIntervalStrToIntervalArray(source);
            // pass through
         case 'intervalArray':
            source = fromIntervalArrayToIntervalObj(source);
            // pass through
         case 'intervalObj':
            source = fromIntervalObjToMilliseconds(source);
            // pass through
         case 'milliseconds':
            this._normIntervalObj = source = fromMillisecondsToNormIntervalObj(source, false);
            this._normIntervalStr = fromNormIntervalObjToNormIntervalStr(source, false);
            break;
         case 'timeInterval':
            this._normIntervalObj = source._normIntervalObj;
            this._normIntervalStr = source._normIntervalStr;
            break;
      }

      return this;
   };

   /**
    * Возвращает значение интервала в виде строки формата ISO 8601.
    * @deprecated Метод делает то же самое, что и метод {@link toString}
    */
   TimeInterval.prototype.getValue = function() {
      return this.toString();
   };

   /**
    * Возвращает значение интервала в виде строки формата ISO 8601.
    *
    * @return {String} P[<Число_дней>D][T[<Число_часов>H][<Число_минут>M][<Число_секунд>[.Число_долей_секунды]S].
    */
   TimeInterval.prototype.toString = function() {
      return this._normIntervalStr;
   };

   /**
    * Возвращает значение интервала в виде объекта {days: 1, minutes: 2, seconds: 3, miliseconds: 4}.
    * @deprecated Метод делает то же самое, что и метод {@link toObject}
    */
   TimeInterval.prototype.getValueAsObject = function() {
      return this.toObject();
   };

   /**
    * Возвращает значение интервала в виде объекта {days: 1, minutes: 2, seconds: 3, miliseconds: 4}.
    *
    * @return {Object}
    */
   TimeInterval.prototype.toObject = function() {
      return this._normIntervalObj;
   };

   /**
    * Возвращает клон интервала.
    *
    * @return {$ws.proto.TimeInterval}
    */
   TimeInterval.prototype.clone = function() {
      return new TimeInterval(this);
   };

   /**
    * Возвращает результат операции над интервалом.
    *
    * @param {String} operation - Возможные значения: '==', '!=', '>=', '<=', '>', '<', '+', '-', '+=', '-='.
    * @param {$ws.proto.TimeInterval} operand
    * @return {$ws.proto.TimeInterval | Boolean} ['+=', '-='] - this, ['+', '-'] - новый $ws.proto.TimeInterval-объект, ['==', '!=', '>=', '<=', '>', '<'] - true/false.
    */
   TimeInterval.prototype.calc = function(operation, operand) {
      var
         allowedOps = [
            '==',
            '!=',
            '>=',
            '<=',
            '>',
            '<',
            '+',
            '-',
            '+=',
            '-='
         ];

      if (allowedOps.indexOf(operation) === -1) {
         throw new Error('Операция \"' + operation + '\" не доступна. Разрешенные операции: ' + allowedOps.join(', ') + '. ');
      }
      if (!(this instanceof TimeInterval && operand instanceof TimeInterval)) {
         throw new Error('Operand должен быть объектом класса TimeInterval. ');
      }

      var
         milliseconds1 = this.getTotalMilliseconds(),
         milliseconds2 = operand.getTotalMilliseconds();

      switch (operation) {
         case '==':
            return milliseconds1 === milliseconds2;
         case '!=':
            return milliseconds1 !== milliseconds2;
         case '>=':
            return milliseconds1 >= milliseconds2;
         case '<=':
            return milliseconds1 <= milliseconds2;
         case '>':
            return milliseconds1 > milliseconds2;
         case '<':
            return milliseconds1 < milliseconds2;
         case '+':
            return new TimeInterval().set(milliseconds1 + milliseconds2);
         case '-':
            return new TimeInterval().set(milliseconds1 - milliseconds2);
         case '+=':
            return this.set(milliseconds1 + milliseconds2);
         case '-=':
            return this.set(milliseconds1 - milliseconds2);
      }
   };

   /**
    * Прибавляет интервал к дате.
    *
    * @param {Date} date
    * @return {Date}
    */
   TimeInterval.prototype.addToDate = function(date) {
      return dateModifier.call(this, 1, date);
   };

   /**
    * Вычитает интервал из даты.
    *
    * @param {Date} date
    * @return {Date}
    */
   TimeInterval.prototype.subFromDate = function(date) {
      return dateModifier.call(this, -1, date);
   };

   /**
    * Возвращает строку формата ISO 8601.
    * @deprecated Метод делает то же самое, что и метод {@link toString}
    */
   TimeInterval.getValue = function(source) {
      return this.toString(source);
   };

   /**
    * Возвращает строку формата ISO 8601.
    *
    * @param {$ws.proto.TimeInterval | String | Array | Object | Number} source - Может быть: строка - “P20DT3H1M5S”, массив - [5, 2, 3, -4], объект - {days: 1, minutes: 5}, число – 6 или объект типа $ws.proto.TimeInterval. Если передается массив, то первый элемент – дни, второй – часы, т.д. до миллисекунд. Остальные элементы игнорируются. Если передается число, то оно интерпретируется, как количество миллисекунд.
    * @return {String} P[<Число_дней>D][T[<Число_часов>H][<Число_минут>M][<Число_секунд>[.Число_долей_секунды]S].
    */
   TimeInterval.toString = function(source) {
      if (source !== undefined) {
         return TimeInterval.prototype.set.call({}, source)._normIntervalStr;
      }

      return Function.toString.call(this);
   };

   return TimeInterval;
})();

/**
 * @class $ws.single.MicroSession
 * @singleton
 * @public
 */
$ws.single.MicroSession = /** @lends $ws.single.MicroSession */{
   _available : true,
   _ms : {},
   _msid : null,
   _storage : null,
   _sessionsLimit : 5,
   _storageChangeHandler: function(e) {
      if (!e) {
         e = window.event;
      }
      if ('key' in e) {
         if (e.key == this._msid && e.newValue === null) {
            try {
               localStorage.setItem(this._msid, JSON.stringify(this._ms));
            } catch (e) {
               // ignore
            }
         }
      } else {
         if (!localStorage.getItem(this._msid)) {
            try {
               localStorage.setItem(this._msid, JSON.stringify(this._ms));
            } catch (e) {
               // ignore
            }
         }
      }
   },
   _syncMsid: function() {
      this._set('ws-msid', this._msid);
   },
   init : function(){

      function syncMsidOnLinkClick(event) {
         event = event || window.event;
         var target = event.target || event.srcElement;
         if (target.hasAttribute('href')) {
            this._syncMsid();
         }
      }

      var self = this;

      this._prepareStorage();

      if (!this._available) {
         return;
      }

      this._msid = this.getId();
      this._ms = this._get(this._msid);

      if (this._ms){
         try {
            this._ms = $.parseJSON(this._ms);
         } catch (e) {
            throw new Error('microsession : parse json error');
         }
      } else{
         var
            prevSessionId = this._get('ws-msid'),
            prevSession = prevSessionId ? this._get(prevSessionId) : false;

         this._ms = {};
         if (prevSession){
            prevSession = $.parseJSON(prevSession);
            $.extend(true, this._ms, prevSession);
         }
      }

      this._ms.sid = $.cookie('sid');

      this._prepareHash(this._msid);
      this._set('ws-msid', '');
      this._set(this._msid, JSON.stringify(this._ms));

      this._garbageCollector();

      if (window.addEventListener) {
         window.addEventListener('storage', this._storageChangeHandler.bind(this), false);
      } else {
         if ($ws._const.browser.isIE8) {
            document.attachEvent('onstorage', this._storageChangeHandler.bind(this));
         } else {
            window.attachEvent('onstorage', this._storageChangeHandler.bind(this));
         }
      };

      $(window).unload(this._syncMsid.bind(this));

      if (window.addEventListener) {
         // Ловим на capture-фазе чтобы поймать все клики
         document.addEventListener('click', syncMsidOnLinkClick.bind(self), true);
      } else {
         document.attachEvent('onclick', syncMsidOnLinkClick.bind(self));
      }

      (function(open){
         window.open = function(){
            self._syncMsid();
            var res;
            switch (arguments.length){
               case 1:
                  res = open(arguments[0]);
                  break;
               case 2:
                  res = open(arguments[0], arguments[1]);
                  break;
               case 3:
                  res = open(arguments[0], arguments[1], arguments[2]);
                  break;
            }
            return res;
         };
      })(window.open);
   },
   /**
    * Подготавливает хранилище
    * @private
    */
   _prepareStorage : function(){
      if(typeof localStorage !== "undefined"){
         //use localStorage
         this._storage = window.localStorage;
      } else{
         this._available = false;
      }
   },
   /**
    * Записывает идентификатор сессии в адресную строку
    * @param {String} id идентификатор сессии
    * @private
    */
   _prepareHash : function(id){
      $ws.single.HashManager.set('msid', id, true);
   },
   /**
    * Возвращает значение непосредственно из localStorage
    * @param {String} key - ключ.
    * @return {*}
    * @private
    */
   _get : function(key){
      var result;
      result = this._storage.getItem(key);
      result = result === "undefined" ? undefined : result;
      return result ? result.toString() : undefined;
   },
   /**
    * Записывает значение непосредственно в localStorage
    * @param {String} key - ключ.
    * @param {String} value - значение.
    * @private
    */
   _set : function(key, value){
      try {
         this._storage.setItem(key, value);
      } catch (e) {
         // ignore
      }
   },
   /**
    * Сборщик мусора, не позволяет накапливаться сессиям. Держит _sessionsLimit сессий
    * @private
    */
   _garbageCollector : function(){
      var keys = [],
          sid = $.cookie('sid'),
          ms, i, l, len, msVal;

      //collect session keys
      for (i in this._storage){
         if (/^s\d+$/.exec(i))
            keys.push(parseInt(i.substr(1), 10));
      }

      //sort
      keys.sort();

      //remove old keys
      while (keys.length > this._sessionsLimit){
         try {
            this._storage.removeItem('s' + keys[0]);
         } catch (e) {
            // ignore
         }
         keys.shift();
      }

      // actualize sid
      for (i = 0, len = keys.length; i < len - 1; ++i) {
         msVal = this._get('s' + keys[i]);
         if (msVal) {
            ms = JSON.parse(msVal);
         } else {
            ms = null;
         }
         // ms может быть null
         if (!sid || (ms && (!ms.hasOwnProperty('sid') || (sid !== ms.sid)))) {
            this._storage.removeItem('s' + keys[i]);
         }
      }
   },
   /**
    * Очищает ВСЁ хранилище
    */
   _clear : function(){
      this._storage.clear();
   },
   clearCurrentSession : function(){
      if (this._available){
         this._ms = {};
         this._set(this._msid, "{}");
      }
      else
         return false;
   },
   /**
    * Проверяет является ли сессия пустой
    * @return {Boolean}
    */
   isEmpty : function(){
      return Object.isEmpty(this.toObject());
   },
   /**
    * Возвращает если уже есть, иначе генерирует идентификатор текущей сессии
    * @return {String} идентификатор сессии.
    * @private
    */
   getId : function(){
      if (this._available)
         return $ws.single.HashManager.get("msid") || ["s", ("" + new Date().getTime())].join("");
      else
         return false;
   },
   /**
    * Устанавливает значение
    * @param {String} key - ключ.
    * @param {String} value - значение.
    */
   set : function(key, value){
      if (this._available){
         this._ms[key] = value;
         this._set(this._msid, JSON.stringify(this._ms));
      }
      else
         return false;
   },
   /**
    * Возвращает значение
    * @param {String} key - ключ.
    * @return {*}
    */
   get : function(key){
      if (this._available)
         return this._ms[key];
      else
         return false;
   },
   /**
    * Устанавливает значение постоянно. Не зависит от текущей микросессии.
    * Сделано оберткой, может понадобиться еще доработать.
    * @param {String} key - ключ.
    * @param {String} value - значение.
    */
   setPermanently : function(key, value){
      this._set(key, value);
   },
   /**
    * Возвращает значение из постоянного хранилища
    * @param {String} key - ключ.
    * @return {*}
    */
   getPermanently : function(key){
      return this._get( key );
   },
   /**
    * Удаляет значение из сессии по ключу
    * @param {String} key - ключ.
    */
   remove : function(key){
      if (this._available){
         delete this._ms[key];
         this._set(this._msid, JSON.stringify(this._ms));
      }
      else
         return false;
   },
   /**
    * Возвращает текущую сессию в виде объекта
    * @return {*}
    */
   toObject : function(){
      return this._ms;
   }
};

/**
 * Менеджер окон
 *
 * @singleton
 * @class $ws.single.WindowManager
 * @extends $ws.proto.Abstract
 * @public
 */
$ws.single.WindowManager = new ($ws.proto.Abstract.extend(/** @lends $ws.single.WindowManager.prototype */{
   /**
    * @event onAreaFocus Переход фокуса в какую-то область
    * @param {$ws.proto.EventObject} eventObject Дескриптор события
    * @param {$ws.proto.AreaAbstract} area Область, в которую перешёл фокус
    *
    * @event zIndexChanged Изменение максимального z-index, который под модальным окном
    * @param {$ws.proto.EventObject} eventObject Дескриптор события
    * @param {Number} maxZIndexBelowModal Максимальный z-index среди тех, которые находятся под модальными окнами,
    * то есть максимальный, но меньший, чем минимальный модальный z-index
    * @example
    * <pre>
    *   $ws.single.WindowManager.subscribe('zIndexChanged', function(event, maxZIndexBelowModal) {
    *     console.log(maxZIndexBelowModal);
    *   });
    * </pre>
    */
   _windows : [],
   _tabEventEnable: true,
   _focusIn: undefined,
   _focusOut: undefined,
   _focusControlled: false,
   _acquireIndex: 1000,
   _acquiredIndexes: [],
   _modalIndexes: [],
   _maximizedIndexes: [],
   _hintIndexes: [],
   _visibleIndexes: [],
   _windowsStack: [],
   _currentVisibleIndicator: null,
   _zIndexChangedFlag: false,
   _zIndexChanged: 0,
   /**
    * Поднять окно в стеке.
    * Поднимает окно вверх в стеке окон если это возможно.
    * В случае индикатора пытается поднять его именно туда, куда нужно (сложная логика).
    * Возвращает успешность подняние.
    * @param {$ws.proto.Window} window
    * @returns {Boolean} Успешность/доступность поднятия.
    */
   pushUp: function(window) {
      var
         movable = window.isMovableToTop(),
         found = false,
         i,
         item,
         stack = [];
      if( movable === true ) {
         // Обычное поведение, просто пушим окно наверх.
         this.popBack(window);
         this._windowsStack.push({
            visible: function(){
               return window.isVisible();
            },
            window:  window
         });
         return true;
      } else if( movable === null ) {
         // Нужно пропушить индикатор, над которым есть скрытые индикаторы — пропушим их все сразу.
         for(i = this._windowsStack.length - 1; i >= 0 && !found; --i) {
            item = this._windowsStack[i];
            if(!found && item.window._isIndicator) {
               stack.push(item);
               found = item.window === window;
               this._windowsStack.splice(i,1);
            }
         }
         for(i = stack.length - 1; i >= 0; --i) {
            this._windowsStack.push(stack[i]);
         }
         return true;
      } else if ( movable === false ) {
         // Либо не нужно пушить,
         if(!window._isIndicator) {
            return false;
         }
         //    либо нужно пушить индикатор, над которым есть видимые индикаторы.
         i = 0;
         while(i < this._windowsStack.length && found !== null) {
            item = this._windowsStack[i];
            if( found === false ) {
               found = item.window === window;
            }
            if( found === true && item.window._isIndicator ) {
               if(item.window !== window && item.visible()) {
                  found = null;
                  Array.prototype.splice.apply(this._windowsStack, [i,0].concat(stack));
               } else {
                  stack.push(this._windowsStack.splice(i,1)[0]);
                  i--;
               }
            }
            i++;
         }
      }
      return false;
   },
   /**
    * Удалить окно из стека
    * Удаляет окно из стека без всяких проверок.
    * @param {$ws.proto.Window} window
    */
   popBack: function(window) {
      this._windowsStack = $ws.helpers.filter(this._windowsStack, function(item){
         return item.window !== window;
      });
   },
   /**
    * Убрать окно из стека.
    * Пытается удалить окно из стека и показать следующее видимое окно и рассчитать положение следующего видимого индикатора.
    * @param {$ws.proto.Window} window
    */
   popAndShowNext: function(window) {
      if(!window._isIndicator) {
         this.popBack(window);
      }
      var
         windowVisible = false,
         stack = this._windowsStack;
      // возможно стоит добавить проверку, что скрыли верхнее окно? но вроде бы и так хуже не станет
      for(var i = stack.length - 1; i >= 0; i--) {
         var stackItem = stack[i];
         if(stackItem.window._isIndicator && stackItem.window._isIndicatorVisible) {
            // Нашли индикатор (который сейчас был скрыт). Покажем его.
            if(stackItem.window !== window) { // ... кроме случая, когда его же только что и скрыли
               if(!windowVisible) {
                  // Должны показать индикатор с оверлеем поверх всего.
                  if(stackItem.window._myIndicator) {
                     // sbisdoc://1+ОшРазраб+27.02.14+84600+2DBDF88C-35F7-4D89-A64B-3FFA3E7584F+
                     stackItem.window._myIndicator.show();
                  }
               } else if(this._pendingIndicator === stackItem.window._myIndicator) {
                  // Пытаемся показать индикатор, который покажем поверх всего чуть позже,
                  //    ... поэтому здесь и сейчас ничего не будем с ним делать.
               }
               else {
                  // У нас есть окна над индикатором. Покажем индикатор с оверлеем под окнами.
                  stackItem.window.show(true);
                  this.setCurrentVisibleIndicator(stackItem.window._myIndicator);
                  stackItem.window._myIndicator._isVisible = true;
               }
            }
            return;
         } else if(stackItem.visible()) {
            // Нашли окно. Оно уже видмо. Ничего не неужно делать. Запомним это.
            windowVisible = true;
            // Если скрывали не индикатор, то ничего делать больше не нужно.
            if(!window._isIndicator) {
               break;
            }
         }
      }
   },
   /**
    * Получить стек окон
    * @returns {Array}
    */
   getStack: function() {
      return this._windowsStack;
   },
   /**
    * Получить текущий видимый индикатор
    * @returns {null|$ws.proto.LoadingIndicator}
    */
   getCurrentVisibleIndicator: function() {
      return this._currentVisibleIndicator;
   },
   /**
    * Установить текущий видимый индикатор
    * @param {null|$ws.proto.LoadingIndicator} indicator
    */
   setCurrentVisibleIndicator: function(indicator) {
      this._currentVisibleIndicator = indicator;
   },
   acquireZIndex: function(isModal, isMaximized, isHint) {
      this._acquireIndex += 10;
      var index = this._acquireIndex;
      this._acquiredIndexes.push(index);
      if(isModal)
         this._modalIndexes.push(index);
      if(isMaximized)
         this._maximizedIndexes.push(index);
      if(isHint)
         this._hintIndexes.push(index);

      this._notifyZIndexChanged();

      return index;
   },
   _notifyZIndexChanged: function() {

      function isVisible(value) {
         return self._visibleIndexes && Array.indexOf(self._visibleIndexes, value) !== -1;
      }

      function _getMaxZIndex() {
         var zIndex = $ws.single.WindowManager.getDefaultZIndex(),
            maxIndex;

         maxIndex = $ws.helpers.reduce(this._modalIndexes.concat(this._maximizedIndexes).concat(this._hintIndexes), function(memo, value) {
            return isVisible(value) ?
               Math.min(value, memo) :
               memo;
         }, Infinity);

         $ws.helpers.forEach(this._acquiredIndexes, function(value) {
            if (isVisible(value)) {
               if (value > zIndex && value < maxIndex) {
                  zIndex = value;
               }
            }
         });
         return zIndex;
      }

      var self = this;
      if (!this._zIndexChangedFlag) {
         this._zIndexChangedFlag = true;

         setTimeout(function() {
            self._zIndexChangedFlag = false;
            var maxZIndexBelowModal = _getMaxZIndex.apply(self);
            if (maxZIndexBelowModal != this._zIndexChanged) {
               this._zIndexChanged = maxZIndexBelowModal;
               self._notify('zIndexChanged', maxZIndexBelowModal);
            }
         }, 0);
      }
   },
   setVisible: function(index) {
      if(Array.indexOf(this._visibleIndexes, index) == -1) {
         this._visibleIndexes.push(index);
         this._notifyZIndexChanged();
      }
   },
   setHidden: function(index) {
      var pos = Array.indexOf(this._visibleIndexes, index);
      if(pos >= 0) {
         this._visibleIndexes.splice(pos, 1);
         this._notifyZIndexChanged();
      }
   },
   getDefaultZIndex: $ws.helpers.constant(1000),
   releaseZIndex: function(index) {
      $ws.helpers.forEach(['acquired', 'visible', 'modal', 'maximized', 'hint'], function(name) {
         var arr = this['_' + name + 'Indexes'],
             pos = Array.indexOf(arr, index);
         if(pos >= 0) {
            arr.splice(pos, 1);
         }
      }.bind(this));

      this._acquireIndex = Math.max.apply(Math, [this.getDefaultZIndex()].concat(this._acquiredIndexes));

      this._notifyZIndexChanged();
   },
   getMaxVisibleZIndex: function() {
      var r = 0;
      $ws.helpers.forEach(this._visibleIndexes, function(n){
         if(n > r && Array.indexOf(this._modalIndexes, n) != -1)
            r = n;
      }, this);
      return r;
   },
   isMaximizedWindowExists: function() {
      return !!$ws.single.WindowManager._maximizedIndexes.length;
   },

   /**
    * Инициализирует менеджер
    */
   init: function(){
      this._publish('onAreaFocus', 'zIndexChanged');
   },
   /**
    * Инициализация, требующая jQuery
    */
   postInit: function() {
      $(function(){
         this._createFirstElementToFocus();
         this._createLastElementToFocus();
      }.bind(this));
   },
   /**
    * Находит окно, у котрого нужно активировать первый/последний контрол
    * @return {$ws.proto.AreaAbstract|undefined}
    */
   _findActiveWindow: function(){
      var activeWindow = $ws.single.WindowManager.getActiveWindow(true);
      if(activeWindow){
         activeWindow = activeWindow.findParent(function(area){
            return $ws.proto.FloatArea && area instanceof $ws.proto.FloatArea;
         }) || activeWindow.getTopParent();
         return activeWindow;
      }
      return undefined;
   },
   /**
    * Создаёт первый элемент для фокуса
    * @private
    */
   _createFirstElementToFocus: function(){
      if(this._focusIn){
         this._focusIn.remove();
      }
      var self = this,
         moveFocus = function(){
            if(!self._focusControlled){
               var activeWindow = self._findActiveWindow();
               if(activeWindow){
                  activeWindow.activateFirstControl();
               }
            }
         };
      this._focusIn = $('<a class="ws-focus-in" tabindex="1"></a>').prependTo('body')
         .bind('focusin', moveFocus);
   },
   /**
    * Создаёт последний элемент для фокуса
    * @private
    */
   _createLastElementToFocus: function(){
      if(this._focusOut){
         this._focusOut.remove();
      }
      var self = this;
      this._focusOut = $('<a class="ws-focus-out" tabindex="0"></a>').appendTo('body')
         .bind('focusin', function(){
            if(!self._focusControlled){
               var activeWindow = self._findActiveWindow();
               if(activeWindow){
                  activeWindow.activateLastControl();
               }
            }
         });
   },
   /**
    * Переносит фокус на первый элемент
    */
   focusToFirstElement: function(){
      if(this._focusIn){
         this._focusControlled = true;
         this._focusIn.focus();
         this._focusControlled = false;
      }
   },
   /**
    * Переносит фокус на последний элемент
    */
   focusToLastElement: function(){
      if(this._focusOut){
         this._focusControlled = true;
         $('body').append(this._focusOut);
         this._focusOut.focus();
         this._focusControlled = false;
      }
   },

   _findWindowIndex: function(window) {
      var i, windows = this._windows, ln = windows.length;
      for (i = 0; i !== ln; i++) {
         if (windows[i] === window)
            return i;
      }
      return -1;
   },

   _checkRegisterBatchUpdaterActions: function() {
      //Функция выполняется только один раз
      this._checkRegisterBatchUpdaterActions = function() {};

      var self = this;
      //Активирует последний активный контрол с последнего активного окна
      $ws.single.ControlBatchUpdater.registerDelayedAction('WindowManager.activateControl', function() {
         var nextWindow = self.getActiveWindow();
         if (nextWindow){
            nextWindow.onBringToFront();
         }
      }, 'FocusActions');
   },

   /**
    * @param {$ws.proto.AreaAbstract} window
    */
   addWindow : function(window){
      if (this._findWindowIndex(window) === -1) {
         var self = this;

         this._checkRegisterBatchUpdaterActions();
         this._windows.push(window);

          if($ws.helpers.instanceOfModule(window, 'SBIS3.CORE.AreaAbstract')){
            window.subscribe('onActivate', function(event){
               if (event.getTarget() === this) {
                  self.onActivateWindow(this);
               }
            });
         }
      }
   },

   /**
    * Удаляет окно из менеджера
    * @param {$ws.proto.AreaAbstract} window Окно, которое необходимо удалить
    */
   removeWindow: function(window){
      this.deactivateWindow(window, function(idx) {
         if (idx !== -1) {
            this._windows.splice(idx, 1);
         }
      }.bind(this));
   },

   /**
    * Общая служебная функция-обвязка для различных способов деактивации окна. Используется при удалении окна в деструкторе и вызове removeWindow,
    * а также при нестандартном скрытии окна в плавающей панели, например.
    * @param window Окно, которое будет деактивироваться.
    * @param deactivateFn Пользовательская функция деактивации. В неё передаётся индекс этого окна в менеджере окон. Если окно уже удалено из менеджера, передастся -1.
    */
   deactivateWindow: function(window, deactivateFn) {
      var idx = this._findWindowIndex(window);
      if (idx !== -1) {
         deactivateFn(idx);
         $ws.single.ControlBatchUpdater.runBatchedDelayedAction('WindowManager.activateControl');
      } else  {
         deactivateFn(-1);
      }
   },

   /**
    * Обработчик события активации окна
    * @param window
    */
   onActivateWindow : function(window) {
      if(window){
         window.setActivationIndex(this.getMaxActivisionIndex() + 1);
         this._notify('onAreaFocus', window);
      }
   },

   disableTabEvent: function(){
      this._tabEventEnable = false;
   },
   enableTabEvent: function(){
      this._tabEventEnable = true;
   },
   getTabEvent: function(){
      return this._tabEventEnable;
   },
   /**
    * Получить отображаемое окно с максимальным z-index
    * @param {Function} [filterFunc] функция-фильтр, указывающая, учитывать ли окно в поиске
    */
   getMaxZWindow : function(filterFunc) {
      var maxZ = -1, maxWindow, i, zIndex,
         windows = this._windows, ln = windows.length, win;
      for(i = 0; i !== ln; i++) {
         win = windows[i];
         if ((!filterFunc || filterFunc(win)) && win.isShow()) {
            zIndex = win.getZIndex();
            if (zIndex > maxZ) {
               maxZ = zIndex;
               maxWindow = win;
            }
         }
      }
      return maxWindow;
   },
   /**
    * Получить отображаемое _модальное_ окно с максимальным z-index среди модальных
    */
   getMaxZModalWindow : function() {
      return this.getMaxZWindow(function(win) { return win.isModal(); });
   },
   /**
    * Возвращает максимальный z-index из всех окон
    * @return {Number}
    */
   getMaxZIndex: function(){
      var maxWindow = this.getMaxZWindow();
      return maxWindow && maxWindow.getZIndex() || 1000;
   },
   /**
    * Возвращает, может ли область получить фокус с учётом родителей
    * @private
    */
   _isWindowAcceptFocus: function(window){
      var parent = window;
      while(parent){
         if(!parent.canAcceptFocus()){
            return false;
         }
         parent = parent.getParent();
      }
      return true;
   },

   /**
    * Возвращает, может ли область получить фокус с учётом родителей
    * @param {$ws.proto.AreaAbstract} window
    * @private
    */
   _isWindowActivable: function(window){
      //_isWindowActivable должна принимать и выключенные области, поскольку иначе возвращение фокуса после закрытия панели/диалога,
      //открытых из панели, где выключены все контролы, приведёт к закрытию этой панели
      return window.isVisibleWithParents();
   },

   _getActiveWindow: function(filterFn){
      var
         idxMax = -1, winMax = undefined, i, idx, win,
         windows = this._windows, ln = windows.length;

      for(i = 0; i !== ln; i++){
         win = windows[i];
         if (!filterFn || filterFn(win)) {
            idx = win.getActivationIndex();

            if (idx > idxMax) {
               idxMax = idx;
               winMax = win;
            }
         }
      }

      return winMax;
   },

   /**
    * Возвращает последнее активированное окно
    * @param {Boolean} [forFocus] Найти последнее активированное окно из тех, в которых есть элементы, которые могут принимать фокус (поля ввода, кнопки, и т.п.).
    * @param {Boolean} [forDeactivation] Использовать при деактивации, начинает искать среди всех окон, даже скрытых. Актуально, если не forFocus.
    * @return {$ws.proto.AreaAbstract}
    */
   getActiveWindow: function(forFocus, forDeactivation){
      var filterFn = forFocus ?
         this._isWindowAcceptFocus :
         forDeactivation ?
            function() {return true;} :
            this._isWindowActivable;
      //Для параметра forFocus: Если нет активного окно, могущего взять фокус, отдадим просто последнее активированное окно
      // (чтобы getActiveWindow всегда возвращал окно)
      return this._getActiveWindow(filterFn.bind(this));
   },

   /**
    * Возвращает последнее активное окно
    * @return {$ws.proto.AreaAbstract}
    * @deprecated Метод делает то же самое, что и метод {@link getActiveWindow},
    * так что теперь нужно пользоваться методом {@link getActiveWindow}, а getLastActiveWindow мы удалим.
    */
   getLastActiveWindow: function() {
      return this.getActiveWindow();
   },

   /**
    * Возвращает индекс последнего активного окна
    * @return {$ws.proto.AreaAbstract}
    */
   getMaxActivisionIndex: function(){
      //для получения макс. индекса нужно учитывать все области, даже невидимые,
      //(иначе новые индексы будут перемешиваться с индексами скрытых)
      var maxWindow = this.getActiveWindow(false, true);
      return maxWindow && maxWindow.getActivationIndex() || 0;
   },
   /**
    * Выключает последний активный контрол
    * @param {$ws.proto.Control} control Контрол, на который перешёл фокус
    */
   disableLastActiveControl: function(control){
      var window = this.getActiveWindow();
      if (window) {
         var prevActive = window.getActiveChildControl();
         if(prevActive && prevActive.getParent() === window && prevActive !== control){
            prevActive.setActive(false, undefined, undefined, control);
         }
      }
   }
}))();

/**
 * Инструмент управления location.hash
 * @singleton
 * @class $ws.single.HashManager
 * @public
  */
$ws.single.HashManager = new ($ws.proto.Abstract.extend(/** @lends $ws.single.HashManager.prototype */{
   /**
    * @event onChange Событие, происходящее при изменении хэша
    * @param {Object} eventObject Дескриптор события
    */
   $constructor: function(){
      if (window){
         var self = this;
         this._replace = true;
         this._publish('onChange');

         window.onhashchange = function(){
            self._notify('onChange');
         };
      }
   },
   _getLocWithoutHash : function(){
      var
         loc = window.location.toString(),
         hPos = loc.indexOf('#');
      if(hPos !== -1)
         loc = loc.substring(0, hPos);
      return loc;
   },
   /**
    * Возвращает параметр из хэша
    * @param {String} name имя параметра.
    * @return {*}
    */
   get : function(name){
      var result = "";
      if (window){
         var
            hash = decodeURI(window.location.hash),
            reg = new RegExp("(?:#|&)" + name + "=(?:[^&]+$|[^&]+(?=&))", "");
         result = hash.match(reg);
      }
      return result ? (result[0].replace(/^./,"").replace(name + "=", "")).replace(/:a:/g, "&") : undefined;
   },
   /**
    * Устанавливает значение в хэш
    * @param {String|Object} name имя параметра или набор параметров и их значений.
    * @param {String} [value] значение параметра (если name передано в виде String).
    * @param {Boolean} [replace] Установить без добавления записи в историю.
    * @example
    * <pre>
    *    $ws.single.HashManager.set('p0', 'v0');
    *
    *    $ws.single.HashManager.set('p1', 'v1', true);
    *    $ws.single.HashManager.set('p2', 'v2', true);
    *
    *    $ws.single.HashManager.set({
    *       p1: 'v1',
     *      p2: 'v2'
     *   }, true);
    * </pre>
    */
   set : function(name, value, replace, forceReplace){
      if (window && name) {
         var map = {},
             toSet = {},
             toRemove = [],
             paramName,
             paramValue;

         //Normalize arguments
         if (typeof name === 'object') {
            map = name;
            forceReplace = replace;
            replace = value;
         } else {
            map[name] = value;
         }

         //Analize hash params
         for (paramName in map) {
            if (map.hasOwnProperty(paramName)) {
               paramValue = map[paramName];
               if (paramValue === undefined || !String.trim('' + paramValue)) {
                  toRemove.push(paramName);
               } else {
                  toSet[paramName] = paramValue;
               }
            }
         }

         //Apply hash params
         if (toRemove.length) {
            this.remove(toRemove, replace);
         }
         if (!Object.isEmpty(toSet)) {
            var hash = decodeURI(window.location.hash);

            if (hash.indexOf('#') === 0) {
               hash = hash.substring(1);
            }

            for (paramName in toSet) {
               if (toSet.hasOwnProperty(paramName)) {
                  var v = (toSet[paramName] + '').replace(/&/g, ":a:"),
                      reg = new RegExp(paramName + "=[^&]+$|" + paramName + "=[^&]+(?=&)", ""),
                      param = [paramName, v].join("=");

                  if (hash.length) {
                     hash = hash.match(reg) ? hash.replace(reg, param) : [hash, param].join("&");
                  } else {
                     hash = param;
                  }
               }
            }

            this.setHash(hash, replace, forceReplace);
         }
      }
   },
   setHash: function(hashValue, replace, forceReplace){
      var sLoc = this._getLocWithoutHash();
      if(forceReplace || this._replace){
         window.location.replace(sLoc + '#' + hashValue);
      } else {
         window.location = sLoc + '#' + hashValue;
      }
      !forceReplace && (this._replace = replace);
   },
   /**
    * Записывает текущее состояние в историю браузера
    */
   pushState: function(){
      this._replace = false;
      this.set('ws-dummy', '1');
      this._replace = true;
      this.remove('ws-dummy', true);
      $ws.single.NavigationController.saveAllStates();
   },
   /**
    * Удаляет значение из хэша
    * @param {String|Array} name имя параметра или набор имен параметров.
    * @param {Boolean} [replace] Установить без добавления записи в историю.
    * @example
    * <pre>
    *    $ws.single.HashManager.remove('p0');
    *
    *    $ws.single.HashManager.remove(['p1', 'p2'], true);
    * </pre>
    */
   remove: function(name, replace){
      if (window) {
         if (!(name instanceof Array)) {
            name = [name];
         }
         var hash = decodeURI(window.location.hash),
             sLoc = this._getLocWithoutHash();

         if (hash.indexOf('#') === 0)
            hash = hash.substring(1);

         for (var i = 0; i < name.length; i++) {
            var reg = new RegExp("&?" + name[i] + "=[^&]+$|" + name[i] + "=[^&]+&", "g");
            hash = hash.replace(reg, "");
         }

         if (this._replace) {
            window.location.replace(sLoc + '#' + hash);
         } else {
            window.location = sLoc + '#' + hash;
         }

         this._replace = replace;
      }
   }
}))();

/**
 * Конструктор класса TransportError
 * @param {String} message - текст ошибки.
 * @param {String} [httpError] - код HTTP ошибки.
 * @param {Number} [code] - код ошибки бизнес-логики.
 * @param {String} [methodName] - имя вызванного метода бизнес-логики.
 * @param {String} [details] - детальное описание ошибки.
 * @param {String} [url] - адрес, который загружался.
 * @param {String} [classid]
 * @param {String} [errType] - Тип ошибки.
 * @param {String} [addinfo] - Доп информация.
 * @param {String} [error_code] - код ошибки прикладников
 *
 * @constructor
 * @class TransportError
 * @extends HTTPError
 * @public
 */
function TransportError(message, httpError, code, methodName, details, url, classid, errType, addinfo, error_code){
   this.message = message;
   this.httpError = httpError === undefined ? "" : httpError;
   this.code = code || 0;
   this.name = 'Transport error';
   this.methodName = methodName || "";
   this.details = details || "";
   this.url = url || '';
   this.classid = classid || '';
   this.errType = errType || 'error';
   this.addinfo = addinfo || '';
   this.error_code = error_code;
}

/**
 * HTTP-ошибка
 *
 * @param message Человекопонятное сообщение об ошибке.
 * @param httpError HTTP-код ошибки.
 * @param url Адрес.
 * @param payload.
 *
 * @constructor
 * @class HTTPError
 * @extends Error
 * @public
 */
function HTTPError(message, httpError, url, payload) {
   this.message = message || '';
   this.name = 'HTTP error';
   this.httpError = httpError === undefined ? '' : httpError;
   this.url = url || '';
   this.payload = payload || '';
   this.processed = false;
}

/**
 * Наследуем HTTPError от Error
 */
$ws.core.classicExtend(HTTPError, Error);
/**
 * Наследуем TransportError от HTTPError
 */
$ws.core.classicExtend(TransportError, HTTPError);
/**
 * Переопределяем метод toString
 */
TransportError.prototype.toString = function(){
   return [this.name, ': ', this.message, '; method: ', this.methodName, '; code: ', this.code,'; httpError: ', this.httpError, '; details: ', this.details].join('');
};

HTTPError.prototype.toString = function(){
   return [this.name, ': ', this.message, '; httpError: ', this.httpError, '; url: ', this.url].join('');
};

$ws._const.key = {
   left: 37,
   up: 38,
   right: 39,
   down: 40,
   insert: 45,
   del: 46,
   space: 32,
   backspace: 8,
   minus: 109,
   plus: 107,
   enter: 13,
   esc: 27,
   f1: 112,
   f3: 114,
   f4: 115,
   f5: 116,
   f7: 118,
   f12: 123,
   meta: 157,
   underscore: 95,
   pageUp: 33,
   pageDown: 34,
   end: 35,
   home: 36,
   tab: 9,
   ctrl: 17,
   b: 66,
   h: 72,
   v: 86,
   y: 89,
   q: 81,
   p: 80,
   m: 77,
   n: 78,
   o: 79
};

$ws._const.modifiers = {
   nothing: 0,
   shift: 2,
   control: 4,
   alt: 8
};

$ws._const.operaKeys = {
   43: 'plus',
   45: 'minus'
};

$ws.context = {};

/**
 * @class $ws.single.base64
 * @singleton
 * @public
 */
$ws.single.base64 = /** @lends $ws.single.base64.prototype */{
   _keyStr : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
   utf8 : 'UTF-8',
   win1251 : 'WINDOWS-1251',
   auto : 'AUTO',
   noConvert: 'NOCONVERT',

   /**
    * Метод, кодирующий переданные данные в base64
    * @param {String} input.
    * @param {String} [format="UTF-8"] кодировка, в которую будет переведен текст.
    * Возможные значения: UTF-8|WINDOWS-1251|AUTO|NOCONVERT
    * @returns {String} данные в base64.
    */
   encode: function(input, format) {
      var output;
      format = !format || typeof format !== 'string'? this.utf8 : format.toUpperCase();
      if (format === this.utf8) {
         input = $ws.single.iconv.unicode2utf(input);
      } else if (format === this.win1251) {
         input = $ws.single.iconv.unicode2win(input);
      } else if (format === this.auto) {
         input = $ws.single.iconv.autoDetect(input, true);
      } else if (format === this.noConvert) {
         // ничего не делаем
      } else {
         input = encodeURIComponent(input);
      }

      if (typeof btoa !== 'function' || format === this.noConvert) {
         output = this._encode(input);
      } else {
         output = btoa(input);
      }

      return output;
   },

   /**
    * Декодирует данные из base64
    * @param {String} input.
    * @param {String} [format="UTF-8"] кодировка, из которой будет переведен текст.
    * Возможные значения: UTF-8|WINDOWS-1251|AUTO|NOCONVERT
    * @returns {String} Декодированные данные.
    */
   decode: function(input, format) {
      var output;

      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

      if (typeof atob !== 'function') {
         output = this._decode(input);
      } else {
         output = atob(input);
      }

      // Попытка определить кодировку, медленно
      format = !format || typeof format !== 'string'? this.utf8 : format.toUpperCase();
      if (format === this.utf8) {
         output = $ws.single.iconv.utf2unicode(output);
      } else if (format === this.win1251) {
         output = $ws.single.iconv.win2unicode(output);
      } else if (format === this.auto) {
         output = $ws.single.iconv.autoDetect(output);
      } else if (format === this.noConvert) {
         // ничего не делаем
      } else {
         output = decodeURIComponent(output);
      }

      return output;
   },

   /**
    * Кодирование в base64 средствами JS
    * @param {String} input
    * @returns {String}
    * @private
    */
   _encode: function(input) {
      var output = "",
          i = 0,
          chr1, chr2, chr3,
          enc1, enc2, enc3, enc4;

      while (i < input.length) {
         chr1 = input.charCodeAt(i++);
         chr2 = input.charCodeAt(i++);
         chr3 = input.charCodeAt(i++);

         enc1 = chr1 >> 2;
         enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
         enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
         enc4 = chr3 & 63;

         if (isNaN(chr2)) {
            enc3 = enc4 = 64;
         } else if (isNaN(chr3)) {
            enc4 = 64;
         }

         output = output +
                  this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                  this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
      }

      return output;
   },

   /**
    * Декодирование из base64 средствами JS
    * @param input
    * @returns {String}
    * @private
    */
   _decode: function(input) {
      var output = '',
          i = 0,
          chr1, chr2, chr3,
          enc1, enc2, enc3, enc4;

      while (i < input.length) {
         enc1 = this._keyStr.indexOf(input.charAt(i++));
         enc2 = this._keyStr.indexOf(input.charAt(i++));
         enc3 = this._keyStr.indexOf(input.charAt(i++));
         enc4 = this._keyStr.indexOf(input.charAt(i++));

         chr1 = (enc1 << 2) | (enc2 >> 4);
         chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
         chr3 = ((enc3 & 3) << 6) | enc4;

         output = output + String.fromCharCode(chr1);

         if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
         }
         if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
         }
      }
      return output;
   }
};

/**
 * @class $ws.single.iconv
 * @singleton
 * @public
 */
$ws.single.iconv = /** @lends $ws.single.iconv.prototype */{
   _CP1251ToUnicode: {
      128:1026 , 129:1027, 130:8218, 131:1107, 132:8222, 133:8230, 134:8224, 135:8225,
      136:8364 , 137:8240, 138:1033, 139:8249, 140:1034, 141:1036, 142:1035, 143:1039,
      144:1106 , 145:8216, 146:8217, 147:8220, 148:8221, 149:8226, 150:8211, 151:8212,
      152:65533, 153:8482, 154:1113, 155:8250, 156:1114, 157:1116, 158:1115, 159:1119,
      160:160  , 161:1038, 162:1118, 163:1032, 164:164 , 165:1168, 166:166 , 167:167 ,
      168:1025 , 169:169 , 170:1028, 171:171 , 172:172 , 173:173 , 174:174 , 175:1031,
      176:176  , 177:177 , 178:1030, 179:1110, 180:1169, 181:181 , 182:182 , 183:183 ,
      184:1105 , 185:8470, 186:1108, 187:187 , 188:1112, 189:1029, 190:1109, 191:1111
   },
   _UnicodeToCP1251: {
      1026:128 , 1027:129, 8218:130, 1107:131, 8222:132, 8230:133, 8224:134, 8225:135,
      8364:136 , 8240:137, 1033:138, 8249:139, 1034:140, 1036:141, 1035:142, 1039:143,
      1106:144 , 8216:145, 8217:146, 8220:147, 8221:148, 8226:149, 8211:150, 8212:151,
      65533:152, 8482:153, 1113:154, 8250:155, 1114:156, 1116:157, 1115:158, 1119:159,
      160:160  , 1038:161, 1118:162, 1032:163, 164:164 , 1168:165, 166:166 , 167:167 ,
      1025:168 , 169:169 , 1028:170, 171:171 , 172:172 , 173:173 , 174:174 , 1031:175,
      176:176  , 177:177 , 1030:178, 1110:179, 1169:180, 181:181 , 182:182 , 183:183 ,
      1105:184 , 8470:185, 1108:186, 187:187 , 1112:188, 1029:189, 1109:190, 1111:191
   },

   /**
    * Конвертирует данные из unicode в win1251
    * @param {String} input Строка в кодировке Unicode (16-bit).
    * @returns {String} Строка в кодировке win1251.
    */
   unicode2win: function(input) {
      var output = "";
      for (var i = 0; i < input.length; i++) {
         var ord = input.charCodeAt(i);
         if (ord < 128) {
            output += String.fromCharCode(ord);
         } else if (ord >= 0x410 && ord <= 0x44f) {
            output += String.fromCharCode( ord - 848 );
         } else if (ord in this._UnicodeToCP1251) {
            output += String.fromCharCode(this._UnicodeToCP1251[ord]);
         } else {
            output += "";
         }
      }

      return output;
   },

   /**
    * Конвертирует данные из win1251 в unicode
    * @param {String} input Строка в кодировке win1251.
    * @returns {String} Строка в кодировке Unicode (16-bit).
    */
   win2unicode: function(input){
      var output = "";
      for (var i = 0; i < input.length; i++) {
         var ord = input.charCodeAt(i);
         if (ord < 128) {
            output += String.fromCharCode(ord);
         } else if (ord >= 192 && ord <= 255) {
            output +=  String.fromCharCode( ord + 848 );
         } else if (ord in this._CP1251ToUnicode) {
            output += String.fromCharCode(this._CP1251ToUnicode[ord]);
         } else {
            output += "";
         }
      }

      return output;
   },

   /**
    * Конвертирует данные из unicode в UTF-8
    * @param {String} input Строка в кодировке Unicode (16-bit).
    * @returns {String} Строка в кодировке UTF-8.
    * @description
    * При кодировании нужно учесть, что UTF-8 однобайтная кодировка,
    * где символы из большого диапазона представлены последовательностью байт.
    * [0x0000–0x007f] - 0xxxxxxx (7 bits, один байт)
    * [0x0080–0x07FF] - 110xxxxx, 10xxxxxx (5+6 bits = 11 bits, 2-х байтная последовательность)
    * [0x0800–0xFFFF] - 1110xxxx, 10xxxxxx, 10xxxxxx (4+6+6 bits = 16 bits, 3-х байтная последовательность)
    * [0x10000–0x10FFFF] - 11110xxx, 10xxxxxx, 10xxxxxx, 10xxxxxx (3+6+6+6 bits = 21 bits, 4-х байтная последовательность)
    * [0x10FFFF-0x1FFFFF] - Неавилдные символы для UTF-8
    * @see http://en.wikipedia.org/wiki/UTF-8#Codepage_layout
    * @see http://phpjs.org/functions/utf8_encode/
    * @see http://www.2ality.com/2013/09/javascript-unicode.html
    */
   unicode2utf: function(input) {
      var output = "";
      //input = input.replace(/\r\n/g,"\n");
      for (var n = 0; n < input.length; n++) {
         var c1 = input.charCodeAt(n);
         if (c1 < 0x80) {
            output += String.fromCharCode(c1);
         } else if(c1 <= 0x7FF) {
            output += String.fromCharCode((c1 >> 6) | 0xC0);
            output += String.fromCharCode((c1 & 0x3F) | 0x80);
         } else if(c1 <= 0xFFFF) {
            output += String.fromCharCode((c1 >> 12) | 0xE0);
            output += String.fromCharCode(((c1 >> 6) & 0x3F) | 0x80);
            output += String.fromCharCode((c1 & 0x3F) | 0x80);
         } else if (c1 <= 0x10FFFF) {
            // surrogate pairs
            if ((c1 & 0xFC00) != 0xD800) {
               throw new RangeError('Unmatched tail surrogate at ' + n);
            }
            var c2 = input.charCodeAt(++n);
            if ((c2 & 0xFC00) != 0xDC00) {
               throw new RangeError('Unmatched lead surrogate at ' + (n - 1));
            }
            c1 = ((c1 & 0x3FF) << 10) + (c2 & 0x3FF) + 0x10000;
            output += String.fromCharCode((c1 >> 18) | 0xF0);
            output += String.fromCharCode(((c1 >> 12) & 0x3F) | 0x80);
            output += String.fromCharCode(((c1 >> 6) & 0x3F) | 0x80);
            output += String.fromCharCode((c1 & 0x3F) | 0x80);
         } else {
            throw Error('Invalid Unicode code point');
         }
      }

      return output;
   },

   /**
    * Конвертирует данные из UTF-8 в unicode
    * @param {String} input Строка в кодировке UTF-8.
    * @returns {String} Строка в кодировке Unicode (16-bit).
    * @description
    * По стандартам UTF-8 не требует BOM. Его мы вырежем.
    *
    * При декодировании нужно учесть, что UTF-8 однобайтная кодировка,
    * где символы из большого диапазона представлены последовательностью байт.
    * [0x00-0x7F] - ASCII.
    * [0x80-0xBF] - Байты продолжения последовательности. Могут быть только 2, 3, 4 байтами.
    * [0xC0-0xC1] - Невалидные коды.
    * [0xC2-0xDF] - Начало 2-х байтной последовательности. Второй байт должен жыть байтом продолжением.
    * [0xE0-0xEF] - Начало 3-х байтной последовательности. Второй и третий байт должен жыть байтом продолжением.
    * [0xF0-0xF4] - Начало 4-х байтной последовательности. Второй и третий и четвертый байт должен жыть байтом продолжением.
    * [0xF5-0xFF] - Невалидные коды. Так как в юникодые это коды больше U+10FFFF
    * @see http://en.wikipedia.org/wiki/UTF-8#Codepage_layout
    * @see http://phpjs.org/functions/utf8_decode/
    */
   utf2unicode: function(input) {
      var output = "",
          i = 0, c1 = 0, c2 = 0, c3 = 0, c4 = 0;

      /* remove BOM */
      if (input.substr(0,3) === 'ï»¿') {
         input = input.substr(3);
      }

      function sequenceError(index, symbol) {
         throw Error('Invalid continuation byte at ' + symbol + ' (index: ' + index + ')');
      }

      while (i < input.length) {
         c1 = input.charCodeAt(i);
         if (c1 < 0x80) {
            output += String.fromCharCode(c1);
            i += 1;
         } else if (c1 < 0xC2) { // continuation or overlong 2-byte sequence
            throw Error('Invalid UTF-8 detected');
         } else if (c1 < 0xE0) { // 2-byte sequence
            c2 = input.charCodeAt(i+1);
            if ((c2 & 0xC0) != 0x80) sequenceError(i+1, c2);

            output += String.fromCharCode(((c1 & 0x1F) << 6) | (c2 & 0x3F));
            i += 2;
         } else if (c1 < 0xF0) { // 3-byte sequence
            c2 = input.charCodeAt(i + 1);
            if ((c2 & 0xC0) != 0x80) sequenceError(i + 1, c2);
            if (c1 == 0xE0 && c2 < 0xA0) sequenceError(i + 1, c2); // overlong

            c3 = input.charCodeAt(i + 2);
            if ((c3 & 0xC0) != 0x80) sequenceError(i + 2, c3);

            output += String.fromCharCode(((c1 & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F));
            i += 3;
         } else if (c1 < 0xF5) { // 4-byte sequence
            c2 = input.charCodeAt(i + 1);
            if ((c2 & 0xC0) != 0x80) sequenceError(i + 1, c2);
            if (c1 == 0xF0 && c2 < 0x90) sequenceError(i + 1, c2); // overlong
            if (c1 == 0xF4 && c2 >= 0x90) sequenceError(i + 1, c2);  // > U+10FFFF

            c3 = input.charCodeAt(i + 2);
            if ((c3 & 0xC0) != 0x80) sequenceError(i + 2, c3);

            c4 = input.charCodeAt(i + 3);
            if ((c4 & 0xC0) != 0x80) sequenceError(i + 3, c4);

            c1 = ((c1 & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F);
            c1 -= 0x10000;
            output += String.fromCharCode(0xD800 | ((c1 >> 10) & 0x3FF));
            output += String.fromCharCode(0xDC00 | (c1 & 0x3FF));
            i += 4;
         } else { // > U+10FFFF
            throw Error('Invalid UTF-8 detected');
         }
      }

      return output;
   },

   /**
    * Попытаемся сами определить кодировку
    * @param {String} input - входная строка в неизвестной кодировке
    * @param {Boolean} [encode] - перекодировать. По умолчанию пытаемся в UTF-8. Если не получилось в windows-1251
    * @returns {String}
    */
   autoDetect: function(input, encode) {
      var output;
      if (encode) {
         try {
            output = $ws.single.iconv.unicode2utf(input);
         } catch(e) {
            output = $ws.single.iconv.unicode2win(input);
         }
      } else {
         try {
            var deltaUtf, deltaWin, // Погрешность
                j, charCode;

            output = $ws.single.iconv.utf2unicode(input);
            // Сначала пытаемся узнать не UTF-8 ли у нас
            for (deltaUtf = 0, j = 0; j < output.length; j++) {
               charCode = output.charCodeAt(j);
               // Русские символы в UNICODE
               if (charCode >= 0x410 && charCode <= 0x44F) {
                  deltaUtf++;
               }
            }

            // Вполне возможно что строка в UTF-8, но нет кириллицы,
            // но все равно проверим, может есть символы из диаппазона 192-255 кодовой таблицы windows-1251
            for (deltaWin = 0, j = 0; j < input.length; j++) {
               charCode = input.charCodeAt(j);
               // Русские символы в windows-1251
               if (charCode > 0xC0 && charCode < 0xFF) {
                  deltaWin++;
               }
            }

            // если дельта cp1251 больше, предположим, что строка в windows-1251
            output = deltaUtf >= deltaWin ? output : $ws.single.iconv.win2unicode(input);
         } catch(e) {
            // Если не смогли декодировать из UTF-8, предположим, что это windows-1251
            output = $ws.single.iconv.win2unicode(input);
         }
      }
      return output;
   }
};

/**
 * Абстрактный класс работы с конфигурации
 * @class $ws.proto.AbstractConfig
 * @extends $ws.proto.Abstract
 * @control
 * @public
 */
$ws.proto.AbstractConfig = $ws.proto.Abstract.extend(/** @lends $ws.proto.AbstractConfig.prototype */{
   /**
    * @event onChange Событие, возникающее при изменении параметра
    * @param {Object} eventObject описание в классе $ws.proto.Abstract.
    * @param {String} name Название параметра.
    * @param {String} value Значение параметра.
    */
   $protected: {
      _blo: null
   },

   $constructor: function() {
      this._publish('onChange');
   },

   /**
    * Есть ли поддержка конфига на странице
    * @protected
    */
   _isConfigSupport: function() {
      throw new Error('AbstractConfig:_isConfigSupport must be implemented in child classes');
   },

   /**
    * Возвращает имя объекта, ответственного за хранение параметров
    * Должен быть переопределен в дочерних классах.
    */
   _getObjectName: function() {
      throw new Error('AbstractConfig:_getObjectName must be implemented in child classes');
   },

   /**
    * Получить объект БЛ
    * @return {$ws.proto.Deferred}
    * @protected
    */
   _getBLObject: function() {
      var
         rv = new $ws.proto.Deferred(),
         self = this;

      if (this._blo === null) {
         return rv.dependOn($ws.core.attachComponent('Source').addCallback(function() {
            self._blo = new $ws.proto.BLObject(self._getObjectName());
            return self._blo;
         }));
      } else {
         rv.callback(this._blo);
      }
      return rv;
   },

   /**
    * Обработка полученного параметра
    * @param {String} operation - операция над контекстом
    * @param {String|Object} name - ключ или объект.
    * @param {String} [value] - значение.
    * @param {Boolean} [noSaveToGlobalContext] - не сохраняем значение в глобальном контексте
    * @private
    */
   _processingParam: function(operation, name, value, noSaveToGlobalContext) {
      if (noSaveToGlobalContext || !name) {
         return;
      }

      switch (operation) {
         case 'update':
            $ws.single.GlobalContext.setValue(name, value);
            break;
         case 'delete':
            $ws.single.GlobalContext.removeValue(name);
            break;
         case 'read':
            return $ws.single.GlobalContext.getValue(name);
      }
      this._notify('onChange', name, value);
   },

   /**
    * Возвращает значение данного параметра
    * @param {String} key - Название параметра.
    * @return {$ws.proto.Deferred}
    */
   getParam: function(key) {
      if (this._isConfigSupport()) {
         var self = this;
         return this._getBLObject().addCallback(function(blo) {
            return blo.call('ПолучитьЗначение', {'Путь': key}, $ws.proto.BLObject.RETURN_TYPE_ASIS).addCallback(function(v) {
               self._processingParam('update', key, v);
               return v;
            });
         });
      } else {
         return new $ws.proto.Deferred().callback(this._processingParam('read', key));
      }
   },

   /**
    * Возвращает все параметры с их значениями
    * В виде набора записей. В каждой записи два поля: Название и Значение.
    * @return {$ws.proto.Deferred}
    */
   getParams: function() {
      if (this._isConfigSupport()) {
         var self = this;
         return this._getBLObject().addCallback(function(blo) {
            return blo.call('ПолучитьПараметры', {}, $ws.proto.BLObject.RETURN_TYPE_RECORDSET).addCallback(function(rs) {
               var r, obj = {};
               rs.rewind();
               while ((r = rs.next()) !== false) {
                  var name = r.get('Название');
                  if (name) {
                     obj[name] = r.get('Значение');
                  }
               }
               self._processingParam('update', obj);
               return rs;
            })
         });
      } else {
         return new $ws.proto.Deferred().callback({});
      }
   },

   /**
    * Вставляет параметр со значением
    * @param {String} key - Название параметра.
    * @param {String} value - Значение параметра.
    * @param {Boolean} [noSaveToGlobalContext] - не сохраняем значение в глобальном контексте
    * @return {$ws.proto.Deferred}
    */
   setParam: function(key, value, noSaveToGlobalContext) {
      if (value === undefined) {
         value = null;
      }

      this._processingParam('update', key, value, noSaveToGlobalContext);

      if (this._isConfigSupport()) {
         return this._getBLObject().addCallback(function(blo) {
            return blo.call(
               'ВставитьЗначение', {
                  'Путь': key,
                  'ЗначениеПараметра': value
               }, $ws.proto.BLObject.RETURN_TYPE_ASIS);
         });
      } else {
         return new $ws.proto.Deferred().callback(true);
      }
   },

   /***
    * Удаляет параметр
    * @param {String} key - Название параметра.
    * @param {Boolean} [noSaveToGlobalContext] - не сохраняем значение в глобальном контексте
    * @return {$ws.proto.Deferred}
    */
   removeParam: function(key, noSaveToGlobalContext) {
      this._processingParam('delete', key, null, noSaveToGlobalContext);
      if (this._isConfigSupport()) {
         return this._getBLObject().addCallback(function(blo) {
            return blo.call('УдалитьПараметр', {
               'Путь': key
            }, $ws.proto.BLObject.RETURN_TYPE_ASIS);
         });
      } else {
         return new $ws.proto.Deferred().callback(true);
      }
   }
});

/**
 * Класс для взаимодействия с параметрами глобальной конфигурации Клиента
 * В качестве основного хранилища выступает бизнес-логика.
 * Все операции отражаются на глобальном контексте.
 *
 * @author darbinyanad
 * @class $ws.single.ClientsGlobalConfig
 * @extends $ws.proto.AbstractConfig
 * @singleton
 * @public
 */
$ws.single.ClientsGlobalConfig = new ($ws.proto.AbstractConfig.extend({
   _getObjectName: function() {
      return 'ГлобальныеПараметрыКлиента';
   },
   _isConfigSupport: function() {
      return $ws._const.globalConfigSupport;
   }
}))();


/**
 * Класс для взаимодействия с параметрами пользовательской конфигурации.
 * В качестве основного хранилища выступает бизнес-логика, т.е. в отличие от класса {@link $ws.single.MicroSession}
 * пользовательские настройки сохраняются не только в рамках одной сессии, а для конкретного пользователя в базе данных.
 * Для работы с методами данного класса нужна авторизация.
 * Все операции отражаются на глобальном контексте.
 *
 * @author Oleg Elifantiev
 * @class $ws.single.UserConfig
 * @extends $ws.proto.AbstractConfig
 * @singleton
 * @public
 */
$ws.single.UserConfig = new ($ws.proto.AbstractConfig.extend(/** @lends $ws.single.UserConfig.prototype */ {
   /**
    * Возвращает имя объекта, ответственного за хранение параметров
    * Должен быть переопределен в дочерних классах.
    */
   _getObjectName: function() {
      return 'ПользовательскиеПараметры';
   },

   /**
    * Есть ли поддержка конфига на странице
    * @protected
    */
   _isConfigSupport: function() {
      return $ws._const.userConfigSupport;
   },

   /**
    * Обработка полученного параметра
    * @param {String} operation - операция над контекстом
    * @param {String} name - ключ.
    * @param {String} [value] - значение.
    * @param {Boolean} [noSaveToGlobalContext] - не сохраняем значение в глобальном контексте
    * @private
    */
   _processingParam: function(operation, name, value, noSaveToGlobalContext) {
      switch (operation) {
         case 'update':
            $ws.single.SessionStorage.set(name, value);
            $ws.single.SessionStorage.set('userParamsDefined', true);
            break;
         case 'delete':
            $ws.single.SessionStorage.remove(name);
            break;
         case 'read':
            return $ws.single.SessionStorage.get(name);
      }

      $ws.proto.AbstractConfig.prototype._processingParam.apply(this, arguments);
   },

   /**
    * Возвращает список значений параметра
    * Список значений возвращается в виде массива строк
    * @param {String} key - Название параметра.
    * @return {$ws.proto.Deferred}
    */
   getParamValues: function(key) {
      if (this._isConfigSupport()) {
         var self = this;
         return this._getBLObject().addCallback(function(blo) {
            return blo.call('ПолучитьСписокЗначений', {'Путь': key}, $ws.proto.BLObject.RETURN_TYPE_ASIS).addCallback(function(v) {
               self._processingParam('update', key, v);
               return v;
            });
         });
      } else {
         return new $ws.proto.Deferred().callback(this._processingParam('read', key));
      }
   },

   /**
    * Вставляет новое значение параметра
    * @param {String} key Название параметра.
    * @param {String} value Значение параметра.
    * @param {Number} [maxCount] Максимальное количество значений параметра. По умолчанию 10.
    * @return {$ws.proto.Deferred}
    */
   setParamValue: function(key, value, maxCount) {
      this._processingParam('update', key, value);
      if (this._isConfigSupport()) {
         return this._getBLObject().addCallback(function(blo) {
            return blo.call(
               'ДобавитьЗначение', {
                  'Путь': key,
                  'Значение': value,
                  'МаксимальноеКоличество': maxCount || 10
               }, $ws.proto.BLObject.RETURN_TYPE_ASIS);
         });
      } else {
         return new $ws.proto.Deferred().callback(true);
      }
   }
}))();

/**
 * "Направленный" хэш-мэп.
 * Перебор всегда идет в порядке добавления элементов.
 * Отслеживает конкурентные модификации (попытки изменения при переборе).
 *
 * @class $ws.proto.OrderedHashMap
 * @author Oleg Elifantiev
 * @public
 */
$ws.proto.OrderedHashMap = (function() {

   'use strict';
    /**
     * @alias $ws.proto.OrderedHashMap
     */
   function OrderedHashMap() {
      this._keys = [];
      this._values = [];
      this._reading = false;
      this._helperHash = {};
   };

   /**
    * Добавляет элемент с указанным ключем
    *
    * @param key ключ. Принудительно преобразуется в строку.
    * @param value значение.
    * @returns {Boolean} Добавлен ли элемент.
    */
   OrderedHashMap.prototype.put = function(key, value) {
      this._checkConcurent();
      key = key + '';
      if(!this.contains(key)) {
         this._keys.push(key);
         this._values.push(value);
         this._helperHash[key] = null;
         return true;
      }
      return false;
   };

   /**
    * Вставляет элемент после указанного. Если не указан after, то будет вставлено в конец
    * @param {String|Number} key Ключ.
    * @param {*} value Значение.
    * @param {String|Number} [after] После какого элемента вставлять.
    * @return {Boolean} Удалось ли вставить.
    */
   OrderedHashMap.prototype.insert = function(key, value, after){
      this._checkConcurent();
      key = key + '';
      if(!this.contains(key)){
         var index;
         if(after !== undefined){
            after = after + '';
            if(!this.contains(after)){
               return false;
            }
            index = Array.indexOf(this._keys, after) + 1;
         }
         else{
            index = 0;
         }
         this._keys.splice(index, 0, key);
         this._values.splice(index, 0, value);
         this._helperHash[key] = null;
         return true;
      }
      return false;
   };

   /**
    * Возвращает элемент по ключу
    *
    * @param {String} key Запрашиваемый ключ.
    * @returns {*} Элемент с указанным ключем или undefined.
    */
   OrderedHashMap.prototype.get = function(key) {
      var idx = this._getKeyIndex(key);
      return idx == -1 ? undefined : this._values[idx];
   };

   /**
    * Удаляем элемент по ключу
    * @param {String} key ключ.
    * @returns {Boolean} Удален ли элемент.
    */
   OrderedHashMap.prototype.remove = function(key) {
      this._checkConcurent();
      var idx = this._getKeyIndex(key);
      if(idx !== -1) {
         this._keys.splice(idx, 1);
         this._values.splice(idx, 1);
         this._helperHash[key] = undefined;
         return true;
      }
      return false;
   };

   /**
    * Удаляет несколько ключей
    * @param {Array} keys ключи, которые нужно удалить.
    * @returns {Boolean} true, если все ключи были удалены.
    */
   OrderedHashMap.prototype.removeAll = function(keys) {
      if(keys instanceof Array) {
         var r = true;
         for(var i = 0, l = keys.length; i < l; i++) {
            r &= this.remove(keys[i]);
         }
         return !!r;
      }
      return false;
   };

   /**
    * Перебирает элементы
    * @param {Function} f Функция, выполняемая для каждого элемента.
    * this - хэш-мэп, первый аргумент - ключ, второй - значение.
    * Для остановки перебора вернуть false из функции.
    */
   OrderedHashMap.prototype.each = function(f) {
      this._reading = true;
      try {
         for (var i = 0, l = this._keys.length; i < l; i++) {
            if (f.apply(this, [ this._keys[i], this._values[i] ]) === false)
               break;
         }
      } finally {
         this._reading = false;
      }
   };

   /**
    * Удаляет все значения
    */
   OrderedHashMap.prototype.clear = function() {
      this._checkConcurent();
      this._keys = [];
      this._values = [];
      this._helperHash = {};
   };

   /**
    * Деструктор
    */
   OrderedHashMap.prototype.destroy = function() {
      this._keys = null;
      this._values = null;
      this._helperHash = null;
   };

   /**
    * Проверяет, существует ли такой ключ
    * @param {String} key Ключ.
    * @returns {Boolean} Найден ли ключ.
    */
   OrderedHashMap.prototype.contains = function(key){
      return this._helperHash[key] !== undefined;
   };

   OrderedHashMap.prototype._checkConcurent = function() {
      if(this._reading)
         throw new ReferenceError("Конкурентная модификация объекта. Попытка изменения при переборе");
   };

   OrderedHashMap.prototype._getKeyIndex = function(key) {
      return Array.indexOf(this._keys, key + "");
   };

   return OrderedHashMap;

})();

/**
 * i18n поддержка интернационализации
 * @class i18n
 * @singleton
 * @public
 */
$ws.single.i18n = {
   /**
    * Инициализация синглтона
    */
   init: function() {
      // Теперь определим текущий язык
      this._currentLang = this.detectLanguage();
      if (this._currentLang && typeof document !== 'undefined') {
         $.cookie('lang', this._currentLang, {path: '/'});
         $('body').addClass(this._currentLang);
      }

      var global = (function(){ return this || (0,eval)('this'); }());
      global.rk = $ws.single.i18n.rk.bind( $ws.single.i18n );
   },

   detectLanguage: function() {
      if (typeof window === 'undefined') {
         // Мы на препроцессоре, язык попробуем определить из куки
         return (process && process.domain && process.domain.req && process.domain.req.cookies && process.domain.req.cookies.lang) || '';
      }

      var hostname = location.hostname,
          domain = hostname.substring(hostname.lastIndexOf('.') + 1, hostname.length).toUpperCase(),
          avLang = this.getAvailableLang(),
          detectedLng, parts;

      // get from cookie
      detectedLng = $.cookie('lang') || '';

      // get from qs
      if (!detectedLng) {
         detectedLng = $ws.single.GlobalContext.getValue('lang');
      }

      // get from navigator
      if (!detectedLng) {
         detectedLng = navigator.language || navigator.userLanguage;
         // Здесь надо проверить, если формат ru-RU, то совпадает ли страна с доменом
         if (detectedLng.indexOf('-') > -1) {
            parts = detectedLng.split('-');
            if (domain.length == 2 && parts[1] !== domain) {
               detectedLng = parts[0] + '-' + domain;
            }
         }
      }

      if (detectedLng) {
         if (detectedLng.indexOf('-') > -1) {
            parts = detectedLng.split('-');
            detectedLng = parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
         } else if (domain.length == 2) {
            // Вряд ли домен верхнего уровня какой то страны будет больше 2 букв
            detectedLng = detectedLng.toLowerCase() + '-' + domain.toUpperCase();
         }
      }

      // Если уже ничто не помогло, Возьмем первый язык из доступных
      if (!detectedLng || detectedLng.length !== 5 || !avLang[detectedLng]) {
         detectedLng = Object.keys(avLang).length ? Object.keys(avLang)[0] : '';
      }

      return detectedLng;
   },

   /**
    * Возвращает текущий выбранный язык
    * В двухсимвольном виде (EN, RU, DE и т.п.).
    * @returns {string}
    */
   getLang: function(){
      return this._currentLang;
   },

   /**
    * Возвращает список доступных языков, на которые переведена платформа
    * @returns {Object}
    */
   getAvailableLang: function(){
      return $ws._const.availableLanguage;
   },

   /**
    * Проверяет, имеется ли язык в доступных
    * @param {String} language Двухбуквенное название языка.
    * @returns {boolean}
    */
   hasLang: function(language) {
      return language in $ws._const.availableLanguage;
   },

   /**
    * Устанавливает язык, на который будут переводиться значения
    * @param {String} language Двухбуквенное название языка.
    * @returns {boolean}
    */
   setLang: function(language) {
      var changeLang = false,
         oldLang = this._currentLang;
      if (language && typeof(language) === 'string' && /..-../.test(language) && language !== this._currentLang) {
         var parts = language.split('-');
         this._currentLang = parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
         changeLang = true;
      }

      if (!language) {
         this._currentLang = '';
         changeLang = true;
      }

      if (changeLang && typeof window !== 'undefined') {
         $.cookie('lang', this._currentLang, {path: '/'});
         $('body').removeClass(oldLang).addClass(this._currentLang);
      }

      return changeLang;
   },

   /**
    * Возвращает переведенное значение из словаря по ключу.
    * Если значения нет, возвращается сам ключ.
    * @param {String} key
    * @param {String} ctx
    * @returns {string}
    */
   rk: function(key, ctx) {
      if (typeof window == 'undefined') {
         this.setLang(this.detectLanguage());
      }
      var index = key.indexOf(this._separator);
      if (index > -1) {
         ctx = key.substr(0, index);
         key = key.substr(index + this._separator.length);
      }

      if (this._dict[this._currentLang]) {
         var trans_key = this._dict[this._currentLang][ctx ? '' + ctx + this._separator +  key : '' + key];
         if (trans_key) {
            return trans_key.replace(/</g,'&lt;').replace(/>/g,'&gt;'); // Простое экранирование
         }
      }

      return key;
   },
   /**
    * Проверят наличие словаря по его имени
    * @param {String} dictName.
    * @returns {boolean}
    */
   hasDict: function(dictName) {
      return this._dictNames[this._currentLang] ? dictName in this._dictNames[this._currentLang] : false;
   },

   /**
    * Вставляет новый словарь
    * @param {Object} dict.
    * @param {String} name.
    * @parma {String} [lang=this.getLang()]
    */
   setDict: function(dict, name, lang){
      lang = lang || this.getLang();
      if (lang && !this.hasDict(name)) {
         if (name) {
            this._dictNames[lang] = this._dictNames[lang] || {};
            this._dictNames[lang][name] = true;
         }

         this._dict[lang] = $ws.core.merge(this._dict[lang] || {}, dict);
      }
   },

   /** Разделитель между контекстом и ключом */
   _separator: '@@',
   /** Текущий язык */
   _currentLang: '',
   /** Все загруженные словари, где ключ - слово на языке оригинала */
   _dict: {},
   /** Все загруженные словари, где ключ - имя словаря */
   _dictNames: {}
};

(function() {

   "use strict";

   $ws.requireModule = function(mods){
      mods = mods instanceof Array ? mods : [mods];
      var modules = [];
      $ws.helpers.forEach(mods, function(mod){
         modules.push("js!" + mod);
      });
      return $ws.require(modules);
   };

   $ws.require = function(modulesArg){
      var
         dReady = new $ws.proto.Deferred(),
         isResultSet = false,
         global = (function(){ return this || (0,eval)('this'); }()),
         mods = modulesArg instanceof Array ? modulesArg : [modulesArg],
         resultMods = new Array(mods.length),
         idsToLoad = [],
         fireResult = function () {
            var
               nameArray,
               moduleName,
               glob;

            $ws.helpers.forEach(arguments, function(mod, idx) {
               var modIdx = idsToLoad[idx];
               resultMods[modIdx] = mod;
            });

            $ws.helpers.forEach(mods, function(mod, index){
               glob = global;
               nameArray = /[^!]*$/.exec(mod)[0].split(".");
               moduleName = nameArray.pop();
               $ws.helpers.forEach(nameArray, function(elem){
                  glob = glob[elem] = glob[elem] || {};
               });
               glob[moduleName] = resultMods[index];
            });

            dReady.callback(resultMods);
         },
         modsToLoad;

      $ws.helpers.forEach(mods, function(mod, idx) {
         if (global.requirejs.defined(mod)) {
            resultMods[idx] = global.requirejs(mod);
         } else {
            idsToLoad.push(idx);
         }
      });

      if (idsToLoad.length > 0) {
         modsToLoad = $ws.helpers.map(idsToLoad, function (id) {
            return mods[id];
         });

         global.requirejs(modsToLoad, fireResult, function(err) {
            if (!isResultSet) {
               isResultSet = true;
               dReady.errback(err);
            }
         });
      } else {
         fireResult();
      }

      return dReady;
   };
}());

/**
 *
 * @class $ws.single.DependencyResolver
 * @singleton
 * @public
 */
$ws.single.DependencyResolver = {
   _store: {},
   _parents: {},
   /**
    * Метод регистрации зависимостей
    * @param {String} control Имя класса контрола, для которого регистрируются зависимости.
    * @param {Array|Function} dependency Зависимости в виде массива или функции, которая возвращает массив.
    * @param {String} parentsControl Список родителей контрола для вызова резолверов родителей.
    */
   register: function(control, dependency, parentsControl) {
      this._store[control] = dependency;
      this._parents[control] = parentsControl;
   },
   /**
    *
    * @param {String} control Имя класса, для которого требуется выяснить зависимости.
    * @param {Object} [config] Конфиг контрола.
    * @return {Array} Массив зависимостей.
    */
   resolve: function(control, config) {
      var
            result = [],
            components = control.split('/' ),
            parents = this._parents[control] ? this._parents[control].split('/') : [];
      while(components.length) {
         this._addDependency(result, components.join('/'), config, true);
         components.pop();
      }

      while(parents.length) {
         this._addDependency(result, parents.pop(), config, true);
      }
      return result.sort();
   },
   /**
    * Добавляет зависимость в массив store, если ее там еще нет.
    * Вычисляет дополнительные зависимости по данным, зарегистрированным через register.
    *
    * @param {Array} store
    * @param {String} dependency
    * @param {Object} [config]
    * @param {Boolean} [excludeSelf] исключает сам переданный класс из результата, по умолчанию == false.
    * @private
    */
   _addDependency: function (store, dependency, config, excludeSelf) {
      var self = this;
      dependency = $ws.single.ClassMapper.getClassMapping(dependency);
      if(Array.indexOf(store, dependency) == -1) {
         if(!excludeSelf)
            store.push(dependency);
         if(this._store[dependency]) {
            var resolved = typeof this._store[dependency] == 'function' ? this._store[dependency](config) : this._store[dependency];
            if(resolved && resolved instanceof Array)
               $ws.helpers.forEach(resolved, function(dep){
                  self._addDependency(store, dep);
               });
         }
      }
   }
};

/**
 * @singleton
 * @class $ws.single.Indicator
 * @public
 */
$ws.single.Indicator = /** @lends $ws.single.Indicator.prototype */{
   _container: undefined,
   _ready: false,
   _dReady: undefined,
   _init: function(cfg){
      var self = this;
      if(!cfg)
         cfg = {};
      cfg.handlers = {
         'onReady': function(){
            self._ready = true;
         }
      };
      if(!this._dReady){
         this._dReady = $ws.core.attachInstance('SBIS3.CORE.LoadingIndicator',cfg).addCallback(function(inst){
            self._container = inst;
            return inst;
         });
      }
      return this._dReady;
   },
   /**
    * Показывает индикатор
    * @returns {Object} возвращает самого себя.
    */
   show: function(){
      if(!this._ready){
         this._init().addCallback(function(inst){
            inst.show();
            return inst;
         });
      }
      else
         this._container.show();
      return this;
   },
   /**
    * Устанавливает сообщение и показывает индикатор, если он скрыт
    * @param {String} message - сообщение.
    * @returns {Object} возвращает самого себя.
    */
   setMessage: function(message){
      if(!this._ready){
         this._init().addCallback(function(inst){
            inst.setMessage(message);
            inst.subscribe('onReady', function(){
               this.setMessage(message);
            });
            return inst;
         });
      }
      else{
         this._container.setMessage(message);
         this._container.show();
      }
      return this;
   },
   /**
    * Скрывет индикатор
    * @returns {Object} возвращает самого себя.
    */
   hide: function(){
      if(this._ready)
         this._container.hide();
      else{
         this._init().addCallback(function(inst){
            inst.hide();
            return inst;
         });
      }
      return this;
   },
   /**
    * Переключает вид индикатора: true - индикатор с прогрессбаром, false - без него
    * @param {Boolean} state.
    * @returns {Object} возвращает самого себя.
    */
   progressBar: function(state){
      var self = this;
      if(!this._ready){
         this.destroy();
         this._init({progressBar: state});
      }
      else{
         if(!(this._container._myProgressBar && state)){
            this.destroy();
            this._init({progressBar: state});
         }
      }
      return self;
   },
   /**
    * Устанавливает прогресс идкатора в режиме прогрессбара
    * Предварительно нужно переключить вид индикатора $ws.single.Indicatior.progressBar(true).
    * @param {Number} progress - количество процентов.
    * @returns {Object} возвращает самого себя.
    */
   setProgress: function(progress){
      if(!this._ready)
         this._init().addCallback(function(inst){
            inst.setProgress(progress);
            inst.subscribe('onReady', function(){
               this.setProgress(progress);
            });
            return inst;
         });
      else
         this._container.setProgress(progress);
      return this;
   },
   /**
    * Уничтожает индикатор
    * @returns {Object} возвращает самого себя.
    */
   destroy: function(){
      if(this._ready){
         this._container.destroy();
      }
      else{
         this._init().addCallback(function(inst){
            inst.destroy();
            return inst;
         });
      }
      this._container = undefined;
      this._ready = false;
      this._dReady = undefined;
      return this;
   }
};

/**
 * Код конфигурирования ядра и запуска загрузки минимально необходимого набора компонентов
 *
 * ВНИМАНИЕ!!!
 * Пожалуйста, не добавляйте ничего после него. Все классы и т.п. должны быть выше этих строк.
 */
(function() {

   "use strict";

   var global = (function(){ return this || (1,eval)('this') }());

   var bindings = $ws.core.merge({
      ITransport: 'XHRTransport',
      IXMLDocument: 'ClientXMLDocument',
      IBLObject: 'ClientBLObject',
      IEnum: 'ClientEnum',
      IAttachLoader: {
         name: 'WindowAttachLoader',
         single: true
      },
      ILogger: {
         name: 'ConsoleLogger',
         single: true
      },
      IDeclareModule: {
         name: 'DeclareModule',
         single: true
      },
      IRightsManager: {
         name: 'RightsManager',
         single: true
      }
   }, global.wsBindings || {}, { rec: false });

   $ws.helpers.forEach(bindings, function(target, iface){
      var single = false;
      if(target.single) {
         target = target.name;
         single = true;
      }
      if(single) {
         $ws.single.ioc.bindSingle(iface, target);
      } else {
         $ws.single.ioc.bind(iface, target);
      }
   });

   $ws.single.ClassMapper.setClassMapping({
      'Control/FieldImageGallery':        'Control/ImageGallery',
      'Control/Field:FieldImage':         'Control/FieldImage',
      'Control/Field:FieldDropdown':      'Control/FieldDropdown',
      'Control/Field:FieldCheckbox':      'Control/FieldCheckbox',
      'Control/Field:FieldRadio':         'Control/FieldRadio',
      'Control/Field:FieldNumeric':       'Control/FieldNumeric',
      'Control/Field:FieldInteger':       'Control/FieldInteger',
      'Control/Field:FieldMoney':         'Control/FieldMoney',
      'Control/Field:FieldLabel':         'Control/FieldLabel',
      'Control/Field:FieldFormatAbstract':'Control/FieldMask',
      'Control/Field:FieldMask':          'Control/FieldMask',
      'Control/Field:FieldDate':          'Control/FieldDate',
      'Control/Field:FieldLinkNew':       'Control/FieldLink',
      'Control/Field:FieldMonth':         'Control/FieldMonth',
      'Control/Field:FieldButton':        'Control/Button',
      'Control/Field:FileScaner':         'Control/FileScaner',
      'Control/Field:FileBrowse':         'Control/FileBrowse',
      'Control/Field:FieldDatePicker':    'Control/FieldDatePicker',
      'Control/Area:ToolBar':             'Control/ToolBar',
      'Control/Area:GroupCheckBox':       'Control/GroupCheckBox',
      'Control/Area:Tabs':                'Control/Tabs',
      'Control/Area:HTMLView':            'Control/HTMLView',
      'Control/Area:FiltersArea':         'Control/FiltersArea',
      'Control/Area:FiltersDialog':       'Control/FiltersDialog',
      'Control/Area:FiltersWindow':       'Control/FiltersWindow',
      'Control/DataView/TableView':       'Control/TableView',
      'Control/DataViewAbstract/TableView/TreeView':       'Control/TreeView'
   });

// Old style configuration scheme...
   if('WSRootPath' in global)
      $ws._const.wsRoot = global.WSRootPath;
   if('ResourcePath' in global)
      $ws._const.resourceRoot = global.ResourcePath;
   if('ServicesPath' in global)
      $ws._const.defaultServiceUrl = global.ServicesPath;
   if('WSTheme' in global)
      $ws._const.theme = global.WSTheme;

   // New style configration scheme
   $ws.core.merge($ws._const, global.wsConfig || {}, { rec: false });

   global.TransportError = TransportError;
   global.HTTPError = HTTPError;
}());

(function(){

   if (typeof window !== 'undefined') {
      var
         TICKER_INTERVAL_SLOW = 1260,
         TICKER_INTERVAL = 420,
         TICKER_INTERVAL_FAST = 21;

      var
         ticker = $ws.single.EventBus.channel('ticker'),
         timerSlow, timer, timerFast;

      timerSlow = setInterval(function(){
         ticker.notify('onTickSlow')
      }, TICKER_INTERVAL_SLOW);

      timer = setInterval(function(){
         ticker.notify('onTick')
      }, TICKER_INTERVAL);

      timerFast = setInterval(function(){
         ticker.notify('onTickFast')
      }, TICKER_INTERVAL_FAST);
   }

})();

$ws.core.ready = new $ws.proto.Deferred().callback();

if(window){

   $ws.core.ready.addCallback(function(){
      Error.stackTraceLimit && (Error.stackTraceLimit = 40);
      var dResult = new $ws.proto.Deferred(),
          jQw = 'jQuery' in window,
          vernums = (jQw && window.jQuery.fn.jquery.split('.')) || [0,0];
      if(!(jQw && 'proxy' in jQuery && (parseInt(vernums[0]) == 1 && parseInt(vernums[1]) >= 11))) { // Check for jQ 1.11+
         dResult.dependOn($ws.core.attach("ext/jquery-min.js") );
      } else {
         dResult.callback();
      }
      return dResult;
   }).addCallback(function() {
      $ws._const.$win = $(window);
      $ws._const.$doc = $(document);
      if(!$ws._const.nostyle) {
         return $ws.core.attach("css/core.css").addErrback(function() {
            $ws.single.ioc.resolve('ILogger').log("Core", "Core style loading failed");
            return "";
         });
      }
   }).addCallback(function(){

      // При выгрузке документа заблокируем все сообщения пользователю
      $(window).unload(function(){
         $ws.helpers._messageBox = $ws.core.alert = $ws.helpers.question = function() {
            return $ws.proto.Deferred.success();
         };
      });

      $(document).bind('mousemove keyup', function(){
         var last;
         return function(e){
            if (e.type == 'mousemove') {
               if (last && last.pageX == e.pageX && last.pageY == e.pageY) {
                  return;
               }
               last = {
                  pageX: e.pageX,
                  pageY: e.pageY
               };
            }
            $ws.single.EventBusGlobalChannel.notify('userActivity');
            BOOMR.plugins.WS.logUserActivity();
         }.throttle(5000);
      }());

      /**
       * Поддержка css3-transform в разных браузерах через .css
       */
      (function( $ ) {
            if ($ws._const.compatibility.cssTransformProperty !== 'transform') {
               $.cssHooks["transform"] = {
                  get: function(elem) {
                     return $.css(elem, $ws._const.compatibility.cssTransformProperty);
                  },
                  set: function(elem, value) {
                     elem.style[$ws._const.compatibility.cssTransformProperty] = value;
                  }
               };
            }
      })( jQuery );

      $ws._const.$win.bind('scroll.accordeon resize.accordeon', function(){
         /*
          * Преимущественно сделано для фиксации аккордеона, но можно подписаться на событие глобального контекста
          * и не быть привязанным к тому есть ли флоат панель или нет...
          */
         $ws.single.EventBus.globalChannel().notify('ContentScrolling', $ws._const.$win.scrollTop());
      });
      var d = new $ws.proto.ParallelDeferred();
      if(!('cookie' in jQuery))
         d.push($ws.core.attach('ext/jquery-cookie-min.js'));
      if($ws._const.theme !== '' && !$ws._const.nostyle)
         d.push($ws.core.attach('css/themes/' + $ws._const.theme + '.css').addErrback(function(){
            $ws.single.ioc.resolve('ILogger').log("Core", "Theme '" + $ws._const.theme + "' is not found. Continue with default.");
            return "";
         }));

      $ws._const.$win.bind('orientationchange', function() {
         $ws._const.$win.trigger('resize');
      });

      return d.done().getResult();
   }).addCallback(function(){
      if(window.contents && !Object.isEmpty(window.contents)) {
         $ws.core.loadContents(window.contents, false, {
            resources: $ws._const.resourceRoot
         });
      }
      if(window && ('cookie' in jQuery)){
         $.cookie('tz', new Date().getTimezoneOffset());
      }
   }).addCallback(function(){
      // Вычитка параметров из адресной строки в глобальный контекст
      var args = location.search;
      if(args.indexOf('?') === 0) {
         var argsArr = args.substr(1).split('&');
         for(var i = 0, l = argsArr.length; i < l; i++) {
            // Шилов Д.А. не будем сплитить, надо найти только первый символ =
            var
               index = argsArr[i].indexOf( '='),
               name = decodeURIComponent(argsArr[i].substring(0, index));

            if (name) {
               $ws.single.GlobalContext.setValue(name, decodeURIComponent(argsArr[i].substring(index + 1)));
            }
          }
      }
   }).addCallback(function(){
      $(document).ready( function applySpecificCssClasses() {
         var
            body = $('body'),
            classes = [];
         if ($ws._const.browser.isIE) {
            classes.push('ws-is-ie');
         }
         if($ws._const.browser.isIE8) {
            classes.push('ws-is-ie8');
         }
         if($ws._const.browser.isIE9) {
            classes.push('ws-is-ie9');
         }
         if($ws._const.browser.isIE10) {
            classes.push('ws-is-ie10');
         }
         if($ws._const.browser.isIE12) {
            classes.push('ws-is-ie12');
         }
         if($ws._const.browser.firefox) {
            classes.push('ws-is-firefox');
         }
         if($ws._const.browser.chrome) {
            classes.push('ws-is-chrome');
            if ($ws._const.browser.isMobileIOS) {
               classes.push('ws-is-mobile-chrome-ios');
            }
         }
         if ($ws._const.browser.isMobileAndroid) {
            classes.push('ws-is-mobile-android');
         }
         if ($ws._const.browser.isMobileSafari) {
            classes.push('ws-is-mobile-safari');
            if (($ws._const.browser.IOSVersion || 0) < 8) {
               classes.push('ws-is-mobile-safari-ios-below-8');
            }
         }
         if ($ws._const.browser.isMobilePlatform){
            classes.push('ws-is-mobile-platform');
         }
         if ($ws._const.compatibility.touch) {
            classes.push('ws-is-touch');
         }
         if ($ws._const.browser.isMacOSDesktop) {
            classes.push('ws-is-desktop-safari');
         }
         if(classes.length) {
            body.addClass(classes.join(' '));
         }

         $ws._const.$body = body;
      });
   }).addCallback(function(){
      // Инициализация интернационализации
      $ws.single.i18n.init();
      // Инициализация микросессий
      if (window) {
         if ($ws._const.browser.isIE) {
            var def = new $ws.proto.Deferred();
            /**
             * В IE, если страница отдалась с кодом не 200 (в нашем случае это 401 когда доступ запрещен)
             * работа с локейшеном, даже если меняется только hash? (например .replace(...)) приводит к перезагрузке страницы.
             * В результате получается бесконечный релоад.
             * Если отложить работу с локейшеном - проблема пропадает.
             * Спасибо вам, авторы IE.
             */
            setTimeout(function(){
               $ws.single.MicroSession.init();
               def.callback();
            }, 0);
            return def;
         } else {
            $ws.single.MicroSession.init();
         }
      }
   }).addCallback(function() {
      return $ws.core.attachComponent('Source');
   }).addCallback(function(){

      // Инициализация HashManager
      if (window) {
         var
            pU = $ws.single.MicroSession.get("previousUrl"),
            helper = $ws.single.MicroSession.get("previousUrlHelper");

         if (pU != window.location.toString())
            $ws.single.MicroSession.set("previousUrlHelper", pU);
         else
            pU = helper;

         window.previousPageURL = pU;

         $ws.single.MicroSession.set("previousUrl", window.location.toString());

         $ws.single.HashManager.subscribe('onChange', function(){
            $ws.single.MicroSession.set("previousUrl", window.location.toString());
         });
         $ws.single.WindowManager.postInit();
      }

      // Вычитка глобальных и пользовательских параметров в глобальный контекст
      var
         pd = new $ws.proto.ParallelDeferred(),
         validatedConfig;

      pd.push($ws.require(['Core/SessionStorage']));

      if($ws._const.globalConfigSupport) {
         if (window.globalClientConfig && !Object.isEmpty(window.globalClientConfig)) {
            validatedConfig = $ws.helpers.reduce(window.globalClientConfig, function(res, value, name) {
               if (name) {
                  res[name] = value;
               }
               return res;
            }, {});
            $ws.single.GlobalContext.setValue(validatedConfig);
         } else {
            pd.push($ws.single.ClientsGlobalConfig.getParams());
         }
      }

      return pd.done().getResult()
         .addCallback(function() {
            if ($ws._const.userConfigSupport) {
               if (!$ws.single.SessionStorage.get("userParamsDefined")) {
                  return $ws.single.UserConfig.getParams();
               } else {
                  var
                     s = $ws.single.SessionStorage.toObject(),
                     validated = $ws.helpers.reduce(s, function(res, value, name) {
                        if (name) {
                           res[name] = value;
                        }
                        return res;
                     }, {});

                  $ws.single.GlobalContext.setValue(validated);
               }
            }
         })
         .addErrback(function(e){
            //проверим ошибку на корректность
            if(e instanceof HTTPError && e.httpError !== 0){
               $ws.single.ioc.resolve('ILogger').error("Ошибка при загрузке параметров", e.message, e);
            }
            // Очищаем ошибку чтобы не ломать старт ядра
            return '';
         });
   });
}
/**
 * Это должна быть ПОСЛЕДНЯЯ строка в этом файле. Не добавляйте ничего ниже.
 * Просто для того, чтобы было легко найти код конфигурации ядра.
 */
