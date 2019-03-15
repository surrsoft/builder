'use strict';

function removeArrayDuplicates(array) {
   // @ts-ignore
   const result = new Set();
   array.forEach(element => result.add(element));
   return [...result];
}

export = removeArrayDuplicates;