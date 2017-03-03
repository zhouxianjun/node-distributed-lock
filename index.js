/**
 * Created by Alone on 2017/2/22.
 */
"use strict";
const merge = require('merge');
const defaultLogConfig = {
    root:'../logs',
    format : [
        "{{timestamp}} <{{title}}>  [{{file}}:{{line}}:{{pos}}] - {{message}}", //default format
        {
            error : "{{timestamp}} <{{title}}>  [{{file}}:{{line}}:{{pos}}] - {{message}}\nCall Stack:\n{{stack}}" // error format
        }
    ],
    dateformat : "HH:MM:ss.L",
    preprocess :  function(data){
        data.title = data.title.toUpperCase();
    },
    transport: function(data){
        console.log(data.output);
    }
};
let log = null;
let logConfig = defaultLogConfig;
exports.setLogConfig = (config = {}) => {
    logConfig = merge(config, defaultLogConfig);
};
exports.Logger = function () {
    if (!log){
        log = require('tracer').dailyfile(logConfig);
    }
    return log;
};

exports.DistributedLockService = require('./lib/DistributedLockService');
exports.DistributedReentrantLock = require('./lib/DistributedReentrantLock');

exports.ZKDistributedLockService = require('./lib/zk/ZookeeperDistributedLockService');
exports.ZKDistributedReentrantLock = require('./lib/zk/ZookeeperDistributedReentrantLock');

exports.RedisDistributedLockService = require('./lib/redis/RedisDistributedLockService');
exports.RedisDistributedReentrantLock = require('./lib/redis/RedisDistributedReentrantLock');