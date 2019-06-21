'use strict';

import 'css!theme?Modul/_es6/test';
import 'wml!Modul/_es6/test';

async function prepareOptions(param1, param2) {
   return {
      sum: param1 + param2
   };
}

export default prepareOptions;
