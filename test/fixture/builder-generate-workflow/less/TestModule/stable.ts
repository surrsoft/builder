'use strict';

export default class Test {
    private variables: [];
    private _theme: [string];
    private _style: [string];
    private defaultStyles: {};
    constructor(variable: []) {
        this.variables = variable;
        this.defaultStyles = {
            _theme: ['TestModule/test-theme-object'],
            _style: ['TestModule/test-style-object'],
        };
        this._theme = ['TestModule/Stable-with-import'];
        this._style = ['TestModule/test-style-assign'];
    }
};