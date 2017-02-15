/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const assert = require('assert');
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const Log = require('../Log');
const DistributedLockService = require('../DistributedLockService');
const ZookeeperDistributedReentrantLock = require('./ZookeeperDistributedReentrantLock');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: '/distributed_lock',
    ReentrantLock: ZookeeperDistributedReentrantLock,
    retry: false,
    initRetryWait: 100,
    // 碰撞计数退避算法: https://en.wikipedia.org/wiki/Exponential_backoff
    retryInterval: () => {
        if (this.retryCurrent >= this.config.retry) {
            Log.warn(`lock failed, retry count max.`);
            return this.fail();
        }
        let maxDelay = Math.pow(2, this.retryCurrent) * this.config.initRetryWait;
        maxDelay = Math.min(maxDelay, this.config.initRetryWait * 10);

        return Math.floor((Math.random() * maxDelay));
    },
    zkOption: {}
};
module.exports = class ZookeeperDistributedLockService extends DistributedLockService {
    constructor(config = defaultConfig) {
        super();
        this[Symbol.for('locks')] = new Map();
        this[Symbol.for('config')] = config = merge(config, defaultConfig);
        this[Symbol.for('client')] = zookeeper.createClient(config.url || `${config.host}:${config.port}`, config.zkOption);
        ['connectedReadOnly', 'disconnected', 'expired', 'authenticationFailed'].forEach(event => {
            this[Symbol.for('client')].once(event, () => {this.emit(event);});
        });

        this[Symbol.for('client')].once('connected', () => {
            Log.debug('Connected to ZooKeeper.');
            this[Symbol.for('client')].create(config.area, null, zookeeper.CreateMode.PERSISTENT, err => {
                if (err) {
                    if (err.getCode() !== zookeeper.Exception.NODE_EXISTS) {
                        Log.error(`Unable to create resource: ${config.area}`, err.stack);
                        this.emit('error', err);
                        return;
                    } else {
                        Log.warn(`reusing existing resource: ${config.area}`);
                    }
                }
                this.emit('ready');
            });
        });
        this[Symbol.for('client')].connect();

        process.on('exit', () => {this[Symbol.for('client')].close()});
    }

    lock(id = `lock-${uuid()}`, timeout = 360, cb = () => {}) {
        let config = this[Symbol.for('config')];
        return new config.ReentrantLock(this[Symbol.for('client')], config, id, timeout, cb).lock();
    }

    unlock(locked, cb = () => {}) {
        assert.ok(locked instanceof this[Symbol.for('config')].ReentrantLock, 'locked must be ReentrantLock');
        return locked.unlock(cb);
    }
};