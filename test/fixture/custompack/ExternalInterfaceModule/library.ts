'use strict';

// @ts-ignore
import rk = require('i18n!ExternalInferfaceModule');

export default rk;
export { default as Module1 } from './_private/module1';
export { default as Module2 } from './_private/module2';
export function test() {
    return 'test';
}