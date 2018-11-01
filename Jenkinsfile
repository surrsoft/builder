#!groovy

def version = "3.18.610"
def gitlabStatusUpdate() {
    if ( currentBuild.currentResult == "ABORTED" ) {
        updateGitlabCommitStatus state: 'canceled'
    } else if ( currentBuild.currentResult in ["UNSTABLE", "FAILURE"] ) {
        updateGitlabCommitStatus state: 'failed'
    } else if ( currentBuild.currentResult == "SUCCESS" ) {
        updateGitlabCommitStatus state: 'success'
    }
}

def exception(err, reason) {
    currentBuild.displayName = "#${env.BUILD_NUMBER} ${reason}"
    error(err)
}

echo "Ветка в GitLab: https://git.sbis.ru/root/sbis3-builder/tree/${env.BRANCH_NAME}"

node ('test-autotest86') {
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
                defaultValue: props["engine"],
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
           booleanParam(defaultValue: false, description: "Запуск ТОЛЬКО УПАВШИХ тестов из предыдущего билда. Опции run_int и run_reg можно не отмечать", name: 'run_only_fail_test')
            ]),
        pipelineTriggers([])
    ])

    def workspace = "/home/sbis/workspace/builder_${version}/${BRANCH_NAME}"
    ws(workspace) {


        def inte = params.run_int
        def regr = params.run_reg
        def unit = params.run_unit
        def branch_atf = params.branch_atf
        def branch_engine = params.branch_engine
        def python_ver = 'python3'
        def server_address=props["SERVER_ADDRESS"]
        def SDK = ""
        def items
        def changed_files
        def only_fail = params.run_only_fail_test
        def run_test_fail = ""
        def tests_for_run = ""
        def stream_number=props["snit"]
		def smoke_result = true

    try {

        if ("${env.BUILD_NUMBER}" == "1"){
            inte = true
            regr = true
            unit = true
        }
		dir(workspace){
			echo "УДАЛЯЕМ ВСЕ КРОМЕ ./controls"
			sh "ls | grep -v -E 'controls' | xargs rm -rf"
			dir("./controls/tests"){
				sh "rm -rf ${workspace}/controls/tests/int/atf"
				sh "rm -rf ${workspace}/controls/tests/sbis3-app-engine"
			}
		}

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
        dir("./builder"){
            sh """
            git fetch
            git merge origin/rc-${version}
            """
        }
        updateGitlabCommitStatus state: 'running'
        if ( "${env.BUILD_NUMBER}" != "1" && !(inte || unit || regr || only_fail)) {
            exception('Ветка запустилась по пушу, либо запуск с некоректными параметрами', 'TESTS NOT BUILD')
        }

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
        echo " Определяем SDK"
        dir("./constructor/Constructor/SDK") {
            SDK = sh returnStdout: true, script: "export PLATFORM_version=${version} && source ${workspace}/constructor/Constructor/SDK/setToSDK.sh linux_x86_64"
            SDK = SDK.trim()
            echo SDK
        }

        parallel (
            controls: {
                def controls_revision = sh returnStdout: true, script: "${python_ver} ${workspace}/constructor/read_meta.py -rev ${SDK}/meta.info controls"
                dir(workspace) {
                    checkout([$class: 'GitSCM',
                    branches: [[name: "3.18.610/bugfix/bls/break_tests_for_check"]],
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
					dir("./controls"){
                        sh """
							git clean -fd
							git checkout 3.18.610/bugfix/bls/break_tests_for_check
							git pull
                        """
					}
                }
                parallel (
                    atf: {
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
                    engine: {
                    echo "Выкачиваем engine"
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
                })
            },
            cdn: {
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
        if ( only_fail ) {
            run_test_fail = "-sf"
            // если галки не отмечены, сами определим какие тесты перезапустить
            if ( !inte && !regr  ) {
                step([$class: 'CopyArtifact', fingerprintArtifacts: true, projectName: "${env.JOB_NAME}", selector: [$class: 'LastCompletedBuildSelector']])
                script = "python3 ../fail_tests.py"
                for ( type in ["int", "reg"] ) {
                    dir("./controls/tests/${type}") {
                    def result = sh returnStdout: true, script: script
                    echo "${result}"
                    if (type == "int") {
                        if ( result.toBoolean() ) {
                            inte = true
                        } else {
                            inte = false
                            }
                        }
                    if (type == "reg") {
                        if ( result.toBoolean() ) {
                            regr = true
                        } else {
                            regr = false
                            }
                        }
                    }
                }
                if (!inte && !regr) {
                    exception('Нет тестов для перезапуска.', 'USER FAIL')
                }
            }
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
					МаксимальныйРазмерВыборкиСписочныхМетодов=0

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
					МаксимальныйРазмерВыборкиСписочныхМетодов=0
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
			if ( regr || inte ) {
				def soft_restart = "True"
				if ( params.browser_type in ['ie', 'edge'] ){
					soft_restart = "False"
				}
				if ( "${params.theme}" != "online" ) {
					img_dir = "capture_${params.theme}"
				} else {
					img_dir = "capture"
				}
				writeFile file: "./controls/tests/int/config.ini", 
					text:
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
						IMAGE_DIR = ${img_dir}
						RUN_REGRESSION=True"""				

				dir("./controls/tests/int"){
					sh"""
						source /home/sbis/venv_for_test/bin/activate
						${python_ver} start_tests.py --files_to_start smoke_test.py --SERVER_ADDRESS ${server_address} --RESTART_AFTER_BUILD_MODE --BROWSER chrome --FAIL_TEST_REPEAT_TIMES 0
						deactivate
					"""
					junit keepLongStdio: true, testResults: "**/test-reports/*.xml"
					sh "sudo rm -rf ./test-reports"
					smoke_result = currentBuild.result == null
				}
				if ( only_fail && smoke_result) {
					step([$class: 'CopyArtifact', fingerprintArtifacts: true, projectName: "${env.JOB_NAME}", selector: [$class: 'LastCompletedBuildSelector']])
				}
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
				int_test: {
					stage("Инт.тесты"){
						if (  inte && smoke_result){
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
						if ( regr && smoke_result){
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
        } catch (err) {
            echo "ERROR: ${err}"
            currentBuild.result = 'FAILURE'
            gitlabStatusUpdate()

        } finally {
			sh """
				sudo chmod -R 0777 ${workspace}
			"""
			def exists_dir = fileExists '/home/sbis/Controls'
			if ( exists_dir ){
				sh """
					sudo chmod -R 0777 /home/sbis/Controls
				"""
			}
            if ( unit ){
                junit keepLongStdio: true, testResults: "**/builder/*.xml"
            }
            if ( inte || regr ) {
				
				dir(workspace){
					sh """
					7za a log_jinnee -t7z ${workspace}/jinnee/logs
					"""			
					archiveArtifacts allowEmptyArchive: true, artifacts: '**/log_jinnee.7z', caseSensitive: false
					
					sh "mkdir logs_ps"
					if ( exists_dir ){
						dir('/home/sbis/Controls'){
							def files_err = findFiles(glob: 'intest*/logs/**/*_errors.log')
							
							if ( files_err.length > 0 ){
								sh "sudo cp -R /home/sbis/Controls/intest/logs/**/*_errors.log ${workspace}/logs_ps/intest_errors.log"
								sh "sudo cp -R /home/sbis/Controls/intest-ps/logs/**/*_errors.log ${workspace}/logs_ps/intest_ps_errors.log"
								dir ( workspace ){
									sh """7za a logs_ps -t7z ${workspace}/logs_ps """
									archiveArtifacts allowEmptyArchive: true, artifacts: '**/logs_ps.7z', caseSensitive: false
								}					
							}
						}
					}
				}
				
                junit keepLongStdio: true, testResults: "**/test-reports/*.xml"
                archiveArtifacts allowEmptyArchive: true, artifacts: '**/result.db', caseSensitive: false
            }
            if ( regr ){
                dir("./controls") {
                    publishHTML([allowMissing: true, alwaysLinkToLastBuild: false, keepAll: false, reportDir: './tests/reg/capture_report/', reportFiles: 'report.html', reportName: 'Regression Report', reportTitles: ''])
                }
                archiveArtifacts allowEmptyArchive: true, artifacts: '**/report.zip', caseSensitive: false
            }
        }
        gitlabStatusUpdate()
    }
}
