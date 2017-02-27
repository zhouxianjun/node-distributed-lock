/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const Q = require('q');
const co = require('co');
const assert = require('assert');
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const Log = require('../index').Logger;
const DistributedLockService = require('../DistributedLockService');
const ZookeeperDistributedReentrantLock = require('./ZookeeperDistributedReentrantLock');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: '/distributed_lock',
    ReentrantLock: ZookeeperDistributedReentrantLock,
    lockAwait: 2000,
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
            Log().debug('Connected to ZooKeeper.');
            this[Symbol.for('client')].create(config.area, null, zookeeper.CreateMode.PERSISTENT, err => {
                if (err) {
                    if (err.getCode() !== zookeeper.Exception.NODE_EXISTS) {
                        Log().error(`Unable to create resource: ${config.area}`, err.stack);
                        this.emit('error', err);
                        return;
                    }
                }
                this.emit('ready');
            });
        });
        this[Symbol.for('client')].connect();

        process.on('exit', () => {this[Symbol.for('client')].close()});
    }

    lock(id = `lock-${uuid()}`, expire = 3000, cb = () => {}) {
        let defer = Q.defer();
        let config = this[Symbol.for('config')];
        let reentrantLock = new config.ReentrantLock(this[Symbol.for('client')], config, id);
        this.addAwaitTimeout(reentrantLock, config.lockAwait);
        co(function *() {
            yield reentrantLock.lock(expire);
        }.bind(this)).then(() => {
            defer.resolve(reentrantLock);
            typeof cb === 'function' && Reflect.apply(cb, null, [null, reentrantLock]);
        }).catch(err => {
            defer.reject(err);
            typeof cb === 'function' && Reflect.apply(cb, null, [err || new Error('lock failed')]);
        });
        return defer.promise;
    }

    unlock(locked, cb = () => {}) {
        assert.ok(locked instanceof this[Symbol.for('config')].ReentrantLock, 'locked must be ReentrantLock');
        let defer = Q.defer();
        co(function *() {
            yield locked.unlock();
        }.bind(this)).then(() => {
            defer.resolve();
            typeof cb === 'function' && Reflect.apply(cb, null, []);
        }).catch(err => {
            defer.reject(err);
            typeof cb === 'function' && Reflect.apply(cb, null, [err || new Error('lock failed')]);
        });
        return defer.promise;
    }
};