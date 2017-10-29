var path = require('path');

module.exports = function (grunt, root, application) {
    var target = path.join(root, application);


    var cfg = {
        i18n: {},
        replace: {},
        packwsmod: {},
        owndepspack: {},
        packjs: {},
        packcss: {},
        'collect-dependencies': {},
        uglify: {},
        cssmin: {},
        less1by1: {},
        splitResources: {},
        deanonymize: {},
        xhtmlmin: {},
        routsearch: {},
        custompack: {},
        'ver-contents': {},
        convert: {},
        'static-html': {},
        'xml-deprecated': {},
        'html-deprecated': {},
        tmplmin: {},
        prepackjs: {},
        gzip: {},
        'tmpl-build': {},
        'xhtml-build': {}
    };

    cfg.i18n.main = {
        root: root,
        application: application,
        cwd: target,
        dict: /\/lang\/..-..\/(..-..)\.json$/,
        css: /\/lang\/..-..\/(..-..)\.css$/,
        country: /\/lang\/..\/(..)\.css$/,
        packages: 'resources/packer/i18n'
    };

    cfg.replace = {
        core: {
            src: [target + '**/ws/ext/requirejs/config.js', target + '**/ws/core/constants.js'],
            overwrite: true,
            replacements: [{
                from: /buildnumber:\s?['"]{2}/g,
                to: 'buildnumber: "<%= grunt.option(\'versionize\') %>"'
            }]
        },
        css: {
            src: [target + '**/*.css', target + '**/*.less'],
            overwrite: true,
            replacements: [{
                from: /(url\(['"]?)([\w\/\.\-@{}]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg|\.css|\.woff|\.eot)/g,
                to: function (matchedWord, index, fullText, regexMatches) {
                    // ignore cdn and data-providers
                    if (regexMatches[1].indexOf('cdn/') > -1) {
                        return matchedWord;
                    }
                    return regexMatches[0] + regexMatches[1] + '.v' + grunt.option('versionize') + regexMatches[2];
                }
            }]
        },
        res: {
            src: [target + '**/*.xml', target + '**/*.js', target + '**/*.hdl'],
            overwrite: true,
            replacements: [{
                from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|ws:\/)[\w\/+-.]+)(\.svg|\.gif|\.png|\.jpg|\.jpeg)/g,
                to: '$1.v<%= grunt.option(\'versionize\') %>$2'
            }]
        },
        html: {
            src: [target + '**/*.html', target + '**/*.xhtml', target + '**/*.tmpl'],
            overwrite: true,
            replacements: [{
                from: /((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|%[^}]+}|{{[^}}]+}})[\w\/+-.]+(?:\.\d+)?)(\.svg|\.css|\.gif|\.png|\.jpg|\.jpeg)/ig,
                to: '$1.v<%= grunt.option(\'versionize\') %>$2'
            }, {
                from: /([\w]+[\s]*=[\s]*)((?:"|')(?:[a-z]+(?!:\/)|\/|\.\/|%[^}]+})[\w\/+-.]+(?:\.\d+)?)(\.js)/ig,
                to: function (matchedWord, index, fullText, regexMatches) {
                    // ignore cdn and data-providers
                    if (regexMatches[1].indexOf('cdn/') > -1 || regexMatches[1].indexOf('//') === 1 || !/^src|^href/i.test(matchedWord)) {
                        return matchedWord;
                    }
                    return regexMatches[0] + regexMatches[1] + '.v' + grunt.option('versionize') + regexMatches[2];
                }
            }]
        }
    };

    cfg.packwsmod.main = {
        root: root,
        application: application,
        src: '*.html',
        packages: 'resources/packer/modules'
    };

    cfg.owndepspack.main = {
        root: root,
        application: application
    };

    cfg.packjs.main = {
        root: root,
        application: application,
        src: '*.html',
        packages: 'resources/packer/js'
    };

    cfg.packcss.main = {
        root: root,
        application: application,
        src: '*.html',
        packages: 'resources/packer/css'
    };

    cfg['collect-dependencies'].main = {
        root: root,
        application: application,
        src: [
            'resources/**/*.js',
            'ws/**/*.js',
            '!**/*.test.js',
            '!**/*.routes.js',
            '!**/*.worker.js',
            '!**/design/**/*.js',
            '!**/node_modules/**/*.js',
            '!**/service/**/*.js'
        ]
    };

    cfg.uglify.main = {
        options: {
            sourceMap: true,
            preserveComments: false, // Оставим комментарии с лицениями
            mangle: {
                except: ['define']
            },
            screwIE8: false,
            compress: {
                sequences: true,
                properties: false,
                dead_code: true,
                drop_debugger: true,
                conditionals: false,
                comparisons: false,
                evaluate: false,
                booleans: false,
                loops: false,
                unused: false,
                hoist_funs: false,
                if_return: false,
                join_vars: true,
                cascade: false,
                warnings: true,
                negate_iife: false,
                keep_fargs: true
            }
        },
        files: [{
            expand: true,
            cwd: target,
            src: [
                '**/*.js',
                '**/*.hdl',
                '!**/*.min.js',
                '!**/*.routes.js',
                '!**/*.worker.js',
                '!**/*.test.js',
                '!**/design/**/*.js',
                '!**/data-providers/*.js',
                '!**/node_modules/**/*.js',
                '!**/inside.tensor.js',
                '!**/online.sbis.js',
                '!**/service/**/*.js'
            ],
            dest: target
        }]
    };

    cfg.cssmin.main = {
        options: {
            advanced: false,
            aggressiveMerging: false,
            compatibility: 'ie8',
            inliner: false,
            keepBreaks: false,
            keepSpecialComments: '*',
            mediaMerging: false,
            processImport: false,
            rebase: false,
            restructuring: false,
            roundingPrecision: 2
        },
        files: [{
            expand: true,
            cwd: target,
            src: [
                '**/*.css',
                '!**/*.min.css',
                '!**/design/**/*.css',
                '!**/node_modules/**/*.css',
                '!**/service/**/*.css'
            ],
            dest: target
        }]
    };

    cfg.less1by1.main = {
        root: root,
        application: application

    };

    cfg.splitResources.main = {
       root: root,
       application: application
    }

    cfg.deanonymize.main = {
        root: root,
        application: application,

        src: [
            '**/*.js',
            '!**/*.test.js',
            '!**/*.routes.js',
            '!**/*.worker.js',
            '!**/design/**/*.js',
            '!**/node_modules/**/*.js',
            '!**/service/**/*.js'
        ]
    };

    cfg.xhtmlmin.main = {
        cwd: target,
        src: [
            '**/*.xhtml',
            '**/*.html',
            '!**/node_modules/**/*.html',
            '!**/service/**/*.html'
        ]
    };

    cfg.routsearch.main = {
        root: root,
        application: application,
        src: [
            'resources/**/*.routes.js',
            'ws/**/*.routes.js'
        ]
    };

    cfg['ver-contents'].main = {
        cwd: target,
        ver: grunt.option('versionize')
    };

    cfg.custompack.main = {
        root: root,
        application: application,
        src: ['**/*.package.json']
    };

    cfg.convert.main = {
        cwd: target
    };

    cfg['static-html'].main = {
        root: root,
        application: application,
        src: [
            'resources/**/*.js',
            '!resources/**/*.test.js',
            '!resources/**/*.routes.js',
            '!resources/**/*.worker.js',
            '!resources/**/design/**/*.js',
            '!resources/**/node_modules/**/*.js',
            '!resources/**/service/**/*.js'
        ],
        html: ['*.html']
    };

    cfg['xml-deprecated'].main = {
        root: root,
        application: application,
        src: ['**/*.xml.deprecated']
    };

    cfg['html-deprecated'].main = {
        root: root,
        application: application,
        src: ['**/*.html.deprecated']
    };

    cfg.tmplmin.main = {
        src: ['**/*.tmpl']
    };

    cfg.prepackjs.main = {
      src: [
         'resources/**/*.js',
         'ws/**/*.js'
      ]
    };

    cfg.gzip.main = {
        root: root,
        application: application,
        src: [
            '**/*.js',
            '**/*.json',
            '**/*.css',
            '**/*.tmpl',
            '**/*.woff',
            '**/*.ttf',
            '**/*.eot',
            '!**/*.routes.js',
            '!**/*.original.js',
            '!**/*.modulepack.js',
            '!**/*.test.js',
            '!**/*.esp.json',
            '!**/design/**/*.js',
            '!**/data-providers/*.js',
            '!**/node_modules/**/*.js',
            '!**/service/**/*.js'
        ]
    };

    cfg['tmpl-build'].main = {
        root: root,
        application: application
    };
    cfg['xhtml-build'].main = {
        root: root,
        application: application
    };

    return cfg;
};
