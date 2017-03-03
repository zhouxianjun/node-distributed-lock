/**
 * Created by Alone on 2017/2/28.
 */
'use strict';
const Redis = require('ioredis');
const uuid = require('uuid');
const co = require('co');
const assert = require('assert');
const merge = require('merge');
const DistributedLockService = require('../DistributedLockService');
const RedisDistributedReentrantLock = require('./RedisDistributedReentrantLock');
const defaultConfig = {
    retryInterval: 300,
    area: 'distributed_lock',
    ReentrantLock: RedisDistributedReentrantLock,
    lockAwait: 2000,
    redisOptions: {}
};

const scripts = {
    lock: `local success = redis.call('SETNX', KEYS[1], ARGV[1]);\nif success == 1 then\nredis.call('pexpire', KEYS[1], ARGV[2]);\nend\nreturn success`,
    unlock: `local value = redis.call('GET', KEYS[1]);\nlocal result = 0;\nif value == ARGV[1] then\nresult = redis.call('DEL',KEYS[1]);\nend\nreturn result`
};

module.exports = class RedisDistributedLockService extends DistributedLockService {
    constructor(config = defaultConfig) {
        super();
        this[Symbol.for('config')] = config = merge(config, defaultConfig);
        let client = this[Symbol.for('client')] = new Redis(config);
        ['connect', 'ready', 'error', 'close', 'reconnecting', 'end'].forEach(event => {
            client.on(event, (...args) => {
                Reflect.apply(this.emit, this, [event].concat(args));
            });
        });
        loadScripts(client);

        process.on('exit', () => {client.disconnect()});
    }
};

const loadScripts = client => {
    Reflect.ownKeys(scripts).forEach(key => {
        client.defineCommand(key, {
            numberOfKeys: 1,
            lua: scripts[key]
        });
    });
};