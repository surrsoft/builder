#!groovy

def gitlabStatusUpdate() {
    if ( currentBuild.currentResult == "ABORTED" ) {
        updateGitlabCommitStatus state: 'canceled'
    } else if ( currentBuild.currentResult in ["UNSTABLE", "FAILURE"] ) {
        updateGitlabCommitStatus state: 'failed'
    } else if ( currentBuild.currentResult == "SUCCESS" ) {
        updateGitlabCommitStatus state: 'success'
    }
}
node ('controls') {
    def version = "3.18.500"
    def ver = version.replaceAll('.','')
    echo "Читаем настройки из файла version_application.txt"
    def props = readProperties file: "/home/sbis/mount_test-osr-source_d/Платформа/${version}/version_application.txt"
    properties([
    disableConcurrentBuilds(),
    gitLabConnection('git'),
    buildDiscarder(
        logRotator(
            artifactDaysToKeepStr: '3',
            artifactNumToKeepStr: '3',
            daysToKeepStr: '3',
            numToKeepStr: '3')),
        parameters([
            string(
                defaultValue: 'sdk',
                description: '',
                name: 'controls_revision'),
            string(
                defaultValue: 'sdk',
                description: '',
                name: 'ws_data_revision'),
            string(
                defaultValue: 'sdk',
                description: '',
                name: 'ws_revision'),
            string(
                defaultValue: "rc-${version}",
                description: '',
                name: 'branch_engine'),
            string(
                defaultValue: props["atf_co"],
                description: '',
                name: "branch_atf"),
            choice(
                choices: "online\npresto\ncarry\ngenie",
                description: '',
                name: 'theme'),
            choice(choices: "chrome\nff\nie\nedge", description: '', name: 'browser_type'),
            booleanParam(defaultValue: false, description: "Запуск тестов верстки", name: 'run_reg'),
            booleanParam(defaultValue: false, description: "Запускать интеграционные тесты?", name: 'run_int'),
            booleanParam(defaultValue: false, description: "Запускать юнит тесты?", name: 'run_unit'),
            booleanParam(defaultValue: false, description: "Запуск только упавших тестов из последней сборки?", name: 'RUN_ONLY_FAIL_TEST')]),
        pipelineTriggers([])
    ])
    if ( "${env.BUILD_NUMBER}" != "1" && params.run_int == false && params.run_unit == false ) {
        currentBuild.result = 'FAILURE'
        currentBuild.displayName = "#${env.BUILD_NUMBER} TESTS NOT BUILD"
        error('Ветка запустилась по пушу, либо запуск с некоректными параметрами')
    }
    def workspace = "/home/sbis/workspace/builder_${version}/${BRANCH_NAME}"
    ws(workspace) {
        def integ = params.run_int
        def regr = params.run_reg
        def unit = params.run_unit
        def branch_atf = params.branch_atf
        def python_ver = 'python3'
        def server_address=props["SERVER_ADDRESS"]
        def SDK = ""
        def items
        def branch_engine
        def changed_files
        def only_fail = params.RUN_ONLY_FAIL_TEST
        def run_test_fail = ""
        def stream_number=props["snit"]
        if ("${env.BUILD_NUMBER}" == "1"){
            integ = true
            regr = true
            unit = true
        }
		if (params.branch_engine) {
			branch_engine = params.branch_engine
		} else {
			branch_engine = props["engine"]
		}
        parallel (
            checkout1: {
                echo " Выкачиваем сборочные скрипты"
                dir(workspace) {
                    checkout([$class: 'GitSCM',
                    branches: [[name: "rc-${version}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[
                        $class: 'RelativeTargetDirectory',
                        relativeTargetDir: "constructor"
                        ]],
                        submoduleCfg: [],
                        userRemoteConfigs: [[
                            credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                            url: 'git@git.sbis.ru:sbis-ci/platform.git']]
                    ])
                }
                dir("./constructor") {
                    checkout([$class: 'GitSCM',
                    branches: [[name: "rc-${version}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[
                        $class: 'RelativeTargetDirectory',
                        relativeTargetDir: "Constructor"
                        ]],
                        submoduleCfg: [],
                        userRemoteConfigs: [[
                            credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                            url: 'git@git.sbis.ru:sbis-ci/constructor.git']]
                    ])
                }
            },
            checkout2: {
                echo " Выкачиваем сборочные скрипты"
                dir(workspace) {
                    checkout([$class: 'GitSCM',
                    branches: [[name: env.BRANCH_NAME]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[
                        $class: 'RelativeTargetDirectory',
                        relativeTargetDir: "builder"
                        ]],
                        submoduleCfg: [],
                        userRemoteConfigs: [[
                            credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                            url: 'git@git.sbis.ru:root/sbis3-builder.git']]
                    ])
                }
            },
            checkout3: {
                echo " Выкачиваем сборочные скрипты"
                dir(workspace) {
                    checkout([$class: 'GitSCM',
                    branches: [[name: "rc-${version}"]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[
                        $class: 'RelativeTargetDirectory',
                        relativeTargetDir: "controls"
                        ]],
                        submoduleCfg: [],
                        userRemoteConfigs: [[
                            credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                            url: 'git@git.sbis.ru:sbis/controls.git']]
                    ])
                }
                parallel (
                    checkout_atf:{
                        echo " Выкачиваем atf"
                        dir("./controls/tests/int") {
                        checkout([$class: 'GitSCM',
                            branches: [[name: branch_atf]],
                            doGenerateSubmoduleConfigurations: false,
                            extensions: [[
                                $class: 'RelativeTargetDirectory',
                                relativeTargetDir: "atf"
                                ]],
                                submoduleCfg: [],
                                userRemoteConfigs: [[
                                    credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                                    url: 'git@git.sbis.ru:autotests/atf.git']]
                            ])
                        }
                    },
                    checkout_engine: {
                        echo " Выкачиваем engine"
                        dir("./controls/tests"){
                            checkout([$class: 'GitSCM',
                            branches: [[name: branch_engine]],
                            doGenerateSubmoduleConfigurations: false,
                            extensions: [[
                                $class: 'RelativeTargetDirectory',
                                relativeTargetDir: "sbis3-app-engine"
                                ]],
                                submoduleCfg: [],
                                userRemoteConfigs: [[
                                    credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                                    url: 'git@git.sbis.ru:sbis/engine.git']]
                            ])
                        }
                    }
                )
            },
            checkout4: {
                dir(workspace) {
                    echo "Выкачиваем cdn"
                    checkout([$class: 'GitSCM',
                    branches: [[name: props["cdn"]]],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[
                        $class: 'RelativeTargetDirectory',
                        relativeTargetDir: "cdn"
                        ]],
                        submoduleCfg: [],
                        userRemoteConfigs: [[
                            credentialsId: 'ae2eb912-9d99-4c34-ace5-e13487a9a20b',
                            url: 'git@git.sbis.ru:root/sbis3-cdn.git']]
                    ])
                }
            }
        )
        try {
            echo " Определяем SDK"
            dir("./constructor/Constructor/SDK") {
                SDK = sh returnStdout: true, script: "export PLATFORM_version=${version} && source ${workspace}/constructor/Constructor/SDK/setToSDK.sh linux_x86_64"
                SDK = SDK.trim()
                echo SDK
            }
            stage("Собираем builder"){
                sh """
                    python3 ${workspace}/constructor/build_builder.py ${version} ${env.BUILD_NUMBER} "${workspace}/deploy_builder" "linux_x86_64" ${env.BUILD_URL} ${env.BUILD_ID} --branch
                """
            }
            stage("Подготавливаем данные стенда"){
                items="jinnee:${workspace}/deploy_builder/${version}/${env.BUILD_NUMBER}/linux_x86_64"
                def host_db = "test-autotest-db1"
                def port_db = "5434"
                def name_db = "css_${env.NODE_NAME}${ver}"
                def user_db = "postgres"
                def password_db = "postgres"
                writeFile file: "${workspace}/controls/tests/stand/conf/sbis-rpc-service_ps.ini", text: """[Базовая конфигурация]
                    [Ядро.Http]
                    Порт=10020

                    [Ядро.Сервер приложений]
                    ЧислоРабочихПроцессов=3
                    ЧислоСлужебныхРабочихПроцессов=0
                    ЧислоДополнительныхПроцессов=0
                    ЧислоПотоковВРабочихПроцессах=10

                    [Presentation Service]
                    WarmUpEnabled=No
                    ExtractLicense=Нет
                    ExtractRights=Нет
                    ExtractSystemExtensions=Нет
                    ExtractUserInfo=Нет"""
                writeFile file: "${workspace}/controls/tests/stand/conf/sbis-rpc-service.ini", text: """[Базовая конфигурация]
                    АдресСервиса=${env.NODE_NAME}:10010
                    ПаузаПередЗагрузкойМодулей=0
                    ХранилищеСессий=host=\'dev-sbis3-autotest\' port=\'6380\' dbindex=\'2\'
                    БазаДанных=postgresql: host=\'${host_db}\' port=\'${port_db}\' dbname=\'${name_db}\' user=\'${user_db}\' password=\'${password_db}\'
                    РазмерКэшаСессий=3
                    Конфигурация=ini-файл
                    [Ядро.Сервер приложений]
                    ПосылатьОтказВОбслуживанииПриОтсутствииРабочихПроцессов=Нет
                    МаксимальноеВремяЗапросаВОчереди=60000
                    ЧислоРабочихПроцессов=4
                    [Ядро.Права]
                    Проверять=Нет
                    [Ядро.Асинхронные сообщения]
                    БрокерыОбмена=amqp://test-rabbitmq.unix.tensor.ru
                    [Ядро.Логирование]
                    Уровень=Параноидальный
                    ОграничениеДляВходящегоВызова=1024
                    ОграничениеДляИсходящегоВызова=1024
                    ОтправлятьНаСервисЛогов=Нет
                    [Тест]
                    Адрес=http://${env.NODE_NAME}:10010"""
                // Копируем шаблоны
                sh """cp -f ${workspace}/controls/tests/stand/Intest/pageTemplates/branch/* ${workspace}/controls/tests/stand/Intest/pageTemplates"""
                sh """cp -fr ${workspace}/controls/Examples/ ${workspace}/controls/tests/stand/Intest/Examples/"""
                sh """
                cd "${workspace}/controls/tests/stand/Intest/"
                sudo python3 "change_theme.py" ${params.theme}
                cd "${workspace}"
                """
            }
            stage("Разворот стенда"){
            sh """
                sudo chmod -R 0777 ${workspace}
                ${python_ver} "${workspace}/constructor/updater.py" "${version}" "/home/sbis/Controls" "css_${env.NODE_NAME}${ver}" "${workspace}/controls/tests/stand/conf/sbis-rpc-service.ini" "${workspace}/controls/tests/stand/distrib_branch_ps" --sdk_path "${SDK}" --items "${items}" --host test-autotest-db1 --stand nginx_branch --daemon_name Controls --use_ps --conf x86_64
                sudo chmod -R 0777 ${workspace}
                sudo chmod -R 0777 /home/sbis/Controls
            """
            }
            parallel(
                unit: {
                    stage ("Unit тесты"){
                        if ( unit ) {
                            sh """
                            cd ${workspace}/builder
                            npm run build:verify
                            """
                        }
                    }
                },
                int_reg: {
                        if ( regr || integ ) {
                            def soft_restart = "True"
                            if ( params.browser_type in ['ie', 'edge'] ){
                                soft_restart = "False"
                            }
                        writeFile file: "./controls/tests/int/config.ini", text:
                            """# UTF-8
                            [general]
                            browser = ${params.browser_type}
                            SITE = http://${NODE_NAME}:30010
                            SERVER = test-autotest-db1:5434
                            BASE_VERSION = css_${NODE_NAME}${ver}
                            DO_NOT_RESTART = True
                            SOFT_RESTART = ${soft_restart}
                            NO_RESOURCES = True
                            DELAY_RUN_TESTS = 2
                            TAGS_NOT_TO_START = iOSOnly
                            ELEMENT_OUTPUT_LOG = locator
                            WAIT_ELEMENT_LOAD = 20
                            SHOW_CHECK_LOG = True
                            HTTP_PATH = http://${NODE_NAME}:2100/builder_${version}/${BRANCH_NAME}/controls/tests/int/"""

                        if ( "${params.theme}" != "online" ) {
                            writeFile file: "./controls/tests/reg/config.ini",
                            text:
                                """# UTF-8
                                [general]
                                browser = ${params.browser_type}
                                SITE = http://${NODE_NAME}:30010
                                DO_NOT_RESTART = True
                                SOFT_RESTART = False
                                NO_RESOURCES = True
                                DELAY_RUN_TESTS = 2
                                TAGS_TO_START = ${params.theme}
                                ELEMENT_OUTPUT_LOG = locator
                                WAIT_ELEMENT_LOAD = 20
                                HTTP_PATH = http://${NODE_NAME}:2100/builder_${version}/${BRANCH_NAME}/controls/tests/reg/
                                SERVER = test-autotest-db1:5434
                                BASE_VERSION = css_${NODE_NAME}${ver}
                                #BRANCH=True
                                [regression]
                                IMAGE_DIR = capture_${params.theme}
                                RUN_REGRESSION=True"""
                        } else {
                            writeFile file: "./controls/tests/reg/config.ini",
                            text:
                                """# UTF-8
                                [general]
                                browser = ${params.browser_type}
                                SITE = http://${NODE_NAME}:30010
                                DO_NOT_RESTART = True
                                SOFT_RESTART = False
                                NO_RESOURCES = True
                                DELAY_RUN_TESTS = 2
                                TAGS_TO_START = ${params.theme}
                                ELEMENT_OUTPUT_LOG = locator
                                WAIT_ELEMENT_LOAD = 20
                                HTTP_PATH = http://${NODE_NAME}:2100/builder_${version}/${BRANCH_NAME}/controls/tests/reg/
                                SERVER = test-autotest-db1:5434
                                BASE_VERSION = css_${NODE_NAME}${ver}
                                #BRANCH=True
                                [regression]
                                IMAGE_DIR = capture
                                RUN_REGRESSION=True
                                """
                        }

                        dir("./controls/tests/int"){
                            sh"""
                                source /home/sbis/venv_for_test/bin/activate
                                ${python_ver} start_tests.py --files_to_start smoke_test.py --SERVER_ADDRESS ${server_address} --RESTART_AFTER_BUILD_MODE --BROWSER chrome --FAIL_TEST_REPEAT_TIMES 0
                                deactivate
                            """
                            junit keepLongStdio: true, testResults: "**/test-reports/*.xml"
                            sh "sudo rm -rf ./test-reports"
                            if ( currentBuild.result != null ) {
                                exception('Стенд неработоспособен (не прошел smoke test).', 'SMOKE TEST FAIL')

                            }
                        }
                        if ( only_fail ) {
                            step([$class: 'CopyArtifact', fingerprintArtifacts: true, projectName: "${env.JOB_NAME}", selector: [$class: 'LastCompletedBuildSelector']])
                            run_test_fail = "-sf"
                        }
                        def tests_for_run = ""
                        parallel (
                            int_test: {
                                stage("Инт.тесты"){
                                    if (  integ ){
                                        echo "Запускаем интеграционные тесты"
                                        dir("./controls/tests/int"){
                                            sh """
                                            source /home/sbis/venv_for_test/bin/activate
                                            python start_tests.py --RESTART_AFTER_BUILD_MODE ${tests_for_run} ${run_test_fail} --SERVER_ADDRESS ${server_address} --STREAMS_NUMBER ${stream_number}
                                            deactivate
                                            """
                                        }

                                    }
                                }
                            },
                            reg_test: {
                                stage("Рег.тесты"){
                                    if ( regr ){
                                        echo "Запускаем тесты верстки"
                                        sh "cp -R ./controls/tests/int/atf/ ./controls/tests/reg/atf/"
                                        dir("./controls/tests/reg"){
                                            sh """
                                                source /home/sbis/venv_for_test/bin/activate
                                                python start_tests.py --RESTART_AFTER_BUILD_MODE ${run_test_fail} --SERVER_ADDRESS ${server_address} --STREAMS_NUMBER ${stream_number}
                                                deactivate
                                            """
                                        }

                                    }
                                }
                            }
                        )
                    }
                }
            )
        } catch (err) {
            echo "ERROR: ${err}"
            currentBuild.result = 'FAILURE'
            gitlabStatusUpdate()

        } finally {
        sh """
            sudo chmod -R 0777 ${workspace}
            sudo chmod -R 0777 /home/sbis/Controls
        """
            if ( unit ){
                junit keepLongStdio: true, testResults: "**/builder/*.xml"
            }
            if ( integ ) {
                junit keepLongStdio: true, testResults: "**/test-reports/*.xml"
                archiveArtifacts allowEmptyArchive: true, artifacts: '**/result.db', caseSensitive: false
            }

        gitlabStatusUpdate()
        }
    }
}