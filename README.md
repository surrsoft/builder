# Builder 
Builder - утилита для сборки клиентского кода проектов на платформе СБИС3. 
Сборка - процесс преобразования исходного кода в работающее приложение. 

## Подготовка к запуску

1. Для использования:

         npm install --legacy-bundling --production

2. Для разработки:

         npm install --legacy-bundling

Флаг --legacy-bundling нужен для корректной установки зависимостей пакета sbis3-json-generator.

Флаг --production используется для того, чтобы не выкачивались devDependencies.
 
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
