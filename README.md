# Builder 
Builder - утилита для сборки клиентского кода проектов на платформе СБИС3. 
Сборка - процесс преобразования исходного кода в работающее приложение. 

Пользовательская документация: https://wi.sbis.ru/doc/platform/developmentapl/development-tools/builder/

## Подготовка к запуску

1. Для использования:

         npm install --production --legacy-bundling --no-package-lock --no-shrinkwrap 

2. Для разработки builder'а:

         npm install --legacy-bundling --no-package-lock --no-shrinkwrap

Флаг --legacy-bundling нужен для корректной установки зависимостей пакета sbis3-json-generator.

Флаг --production используется для того, чтобы не выкачивались devDependencies.

Флаги --no-package-lock --no-shrinkwrap нужны для того, чтобы не создавались файлы package-lock.json и 
npm-shrinkwrap.json, которые имеют больший приоритет чем package.json. 
Подробнее тут:
1. https://docs.npmjs.com/files/package-lock.json, 
2. https://docs.npmjs.com/cli/shrinkwrap
 
## Использование

### Задача Build

Выполнить из папки builder'а:

        node ./node_modules/gulp/bin/gulp.js --gulpfile ./gulpfile.js build --config=custom_config.json 

Где custom_config.json - путь до JSON конфигарации в формате:

      {
         "cache": "путь до папки с кешем",
         "output": "путь до папки с ресурсами статики стенда",
         "localization": ["ru-RU", "en-US"] | false,            //опционально
         "default-localization": "ru-RU",                       //опционально, если нет "localization" 
         "mode": "debug"|"release",
         "modules": [                                           //сортированный по графу зависимостей список
            {
              "name": "имя модуля",
              "path": "путь до папки модуля",
              "responsible": "ответственный"
            }
         ]
      }

## Тестирование

Builder тестируем через модульные тесты с помощью mocha и chai. 
Для запуска тестов на сервере сборки нужно из папки builder выполнить команду:

      npm test

В корне будет создан файл с результатами выполнения "xunit-result.xml".
Для локальной отладки тестов нужно настроить среду разработки на запуск mochа в папке test. 

## Style guide
Стандарт разработки на JavaScript подробно описан тут: https://wi.sbis.ru/doc/platform/developmentapl/standards/styleguide-js/
Чтобы эти требования соблюдались, написан конфиг для ESLint - файл ".eslintrc" в корне проекта.
WebStorm 2017.2 умеет импортировать настройка code style из конфига ESLint. Для этого нужно открыть файл ".eslintrc", 
после чего WebStorm предложит сделать импорт настроек.


Для проверки всего проекта через ESLint нужно выполнить команду:

        npm run check 

ESLint умеет самостоятельно исправлять некоторые предупреждения. Для запуска ESLint для исправления
предупреждений по всему проекту нужно выполнить команду:

        npm run fix 

При review кода будет нулевая толерантность к предупреждениям ESLint. Причины описаны тут: 
1. https://ru.wikipedia.org/wiki/Теория_разбитых_окон
2. https://habrahabr.ru/company/pvs-studio/blog/347686/

Также не пренебрегайте функцией Inspect Code в WebStorm.
 
### Логирование и вывод ошибок
Логирование и вывод ошибок осуществляется через универсальный логгер для Grunt и Gulp задач: sbis3-builder/lib/logger.js
Пример использования: 

        const logger = require('./lib/logger').logger();
        logger.debug('Сообщение не будет видно пользователям, но будет в логах');
        logger.info('Сообщение будет видно пользователям и будет в логах');
        logger.warning('Текст предупреждения');
        logger.error('Текст ошибки');
        logger.warning({
            message: 'Текст предупреждения', //обязательно
            filePath: filePath, //полный путь до файла, крайне желательно
            moduleInfo: moduleInfo // экземпляр класса ModuleInfo, если есть. актуально для Gulp.
        });
        logger.error({
            message: 'Текст ошибки', //обязательно
            filePath: filePath, //полный путь до файла, крайне желательно
            moduleInfo: moduleInfo, // экземпляр класса ModuleInfo, если есть. актуально для Gulp.
            error: error //пойманное исключение, если есть
        });

Вывод сообщений уровня debug включается при запуске утилиты с флагом -LLLL. Побробнее тут: https://github.com/gulpjs/gulp-cli
