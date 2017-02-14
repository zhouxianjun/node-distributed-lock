'use strict';
/**
 * Created by Alone on 2017/2/14.
 */
const path = require('path');
const fs = require("fs");
const findLog = (parent) => {
    let filePath = path.join(parent, 'Logger.js');
    if(fs.existsSync(filePath)) {
        return require(filePath);
    }
    let files = fs.readdirSync(parent);
    let obj = null;
    files.forEach(file => {
        file = path.join(parent, file);
        let stats = fs.statSync(file);
        if(stats.isDirectory()){
            obj = findLog(file);
        }
    }, this);
    return obj;
};
const log = findLog(process.cwd()) || console;
module.exports = class Log {
    static log() {log['log'] && Reflect.apply(log['log'], log, [...arguments])}
    static info() {log['info'] && Reflect.apply(log['info'], log, [...arguments])}
    static warn() {log['warn'] && Reflect.apply(log['warn'], log, [...arguments])}
    static error() {log['error'] && Reflect.apply(log['error'], log, [...arguments])}
};