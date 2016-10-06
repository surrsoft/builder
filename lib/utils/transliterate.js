'use strict';

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
(function () {
    for (var k in charMap) {
        if (charMap.hasOwnProperty(k)) {
            charMap[k.toUpperCase()] = charMap[k].toUpperCase();
        }
    }
})();

function transliterate(string) {
    var result = [], c, i, l;
    for (i = 0, l = string.length; i < l; i++) {
        c = string.charAt(i);
        result[i] = (c in charMap) ? charMap[c] : c;
    }
    return result.join('');
}

module.exports = transliterate;