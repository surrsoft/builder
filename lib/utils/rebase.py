from os import walk, makedirs
from re import compile
from os.path import join, splitext, dirname
from shutil import copyfile, copytree
from datetime import datetime
from sys import argv, version_info

define = compile('define\([\'"](js!)?([\.\w/]+)[\'"],\s*(\[[\s\S]*?\])?')
inputDir = argv[1] or './'
outputDir = argv[2] or './output'


def is_remote(dep):
    return dep.find('http://') > -1 or dep.find('https://') > -1 or dep.find('cdn!') > -1 or dep.find('//') == 0


def transform_dep(dep):
    if is_remote(dep):
        return '\'' + dep + '\''
    else:
        dep = dep.replace('js!', '').replace('SBIS3.', '').replace('SBIS.', '').strip()
        parts = dep.split('.')
        if len(parts) == 1:
            parts = parts[0].split('/')
        parts.append(str((lambda part: part.split('!')[-1])(parts[-1])))

        return '\'' + '/'.join(parts) + '\''


start = datetime.now()
error_count = 0
done_count = 0
all_files = 0
js_files = []

for root, dirs, files in walk(inputDir):
    all_files += len(files)
    for name in files:
        ext = splitext(name)[1]
        if ext == '.js':
            js_files.append(name + '@' + root)

js_total = len(js_files)

print('Found {0} *.js files in {1} files for {2}'.format(js_total, all_files, datetime.now() - start))

for file in js_files:
    name, root = file.split('@')

    try:
        if version_info >= (3, 0, 0):
            f = open(join(root, name), 'r', encoding="utf_8")
        else:
            f = open(join(root, name), 'r')
        text = f.read()
        f.close()

        defanddeps = define.findall(text)
        if len(defanddeps) > 0:
            mod = defanddeps[0][1].split('.')

            if len(mod) == 1:
                mod = mod[0].split('/')

            deps = defanddeps[0][2]
            if deps:
                deps = deps.replace('[', '').replace(']', '').replace('\'', '').replace('"', '').split(',')
                deps = list(map(transform_dep, deps))
                deps = '[' + ', '.join(deps) + ']'

            mod.pop(0) if mod[0] == 'SBIS3' or mod[0] == 'SBIS' else None
            oldModuleName = name.split('.')[0]
            newModuleName = str(mod[-1])
            mod.append(newModuleName)
            new_dest = join(outputDir, *mod)
            try:
                makedirs(dirname(new_dest))
            except EnvironmentError as err:
                pass
                # print('EnvironmentError: ', err)

            if version_info >= (3, 0, 0):
                new_file = open(new_dest + '.js', 'w', encoding="utf_8", newline='')
            else:
                new_file = open(new_dest + '.js', 'wb')

            text = define.sub('define(\'' + '/'.join(mod) + '\', ' + deps, text)
            try:
                new_file.write(text)

                try:
                    copyfile(join(root, oldModuleName + '.css'), new_dest + '.css')
                except IOError as err:
                    pass
                    # print('EnvironmentError: ', err)
                try:
                    copyfile(join(root, oldModuleName + '.xhtml'), new_dest + '.xhtml')
                except IOError as err:
                    pass
                    # print('EnvironmentError: ', err)

                mod.pop()
                mod.append('resources')
                try:
                    copytree(join(root, 'resources'), join(outputDir, *mod))
                except EnvironmentError as err:
                    pass
                    # print('EnvironmentError: ', err)
            except UnicodeEncodeError as err:
                error_count += 1
                print('UnicodeEncodeError: ', join(root, name), err)
            new_file.close()

    except UnicodeDecodeError as err:
        error_count += 1
        print('UnicodeDecodeError: ', join(root, name), err)

    done_count += 1
    if done_count % 1000 == 0:
        print('{0} *.js files processed for {1}'.format(done_count, datetime.now() - start))

print('\n\033[92mDone!\033[0m\nTotal time: {0}\nFiles processed: {1}\nErrors: {2}'
      .format(datetime.now() - start, done_count, error_count))
