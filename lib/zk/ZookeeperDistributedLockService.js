/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const Q = require('q');
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const Log = require('../Log');
const DistributedLockService = require('../DistributedLockService');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: '/distributed_lock',
    retry: false,
    initRetryWait: 100,
    // 碰撞计数退避算法: https://en.wikipedia.org/wiki/Exponential_backoff
    retryInterval: (context, config) => {
        if (context.retryCurrent >= config.retry) {
            Log.warn(`lock failed, retry count max.`);
            return this.fail(context.defer, context.id, context.lockPath);
        }
        let maxDelay = Math.pow(2, context.retryCurrent) * config.initRetryWait;
        maxDelay = Math.min(maxDelay, config.initRetryWait * 10);

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
        let defer = Q.defer();
        let lockPath = `${this[Symbol.for('config')].area}/${id}`;
        let context = {id: id, timeout: timeout, cb: cb, defer: defer, retryCurrent: 0};
        this[Symbol.for('client')].create(lockPath, null, zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL, (err, path) => {
            if (err) {
                Log.error(`unable to create node: ${lockPath}`, err.stack);
                this.fail(context);
            }
            Log.debug(`node created: ${path}`);
            context.lockPath = path.split('/').pop();
            this.check(context);
        });
        return defer.promise;
    }

    unlock(id, cb = () => {}) {
        let defer = Q.defer();
        if (!this[Symbol.for('locks')].has(id)) {
            defer.resolve();
            typeof cb === 'function' && Reflect.apply(cb, cb, []);
        } else {
            let lockPath = `${this[Symbol.for('config')].area}/${this[Symbol.for('locks')].get(id)}`;
            Log.info(`unlock: ${id} --> ${lockPath}`);
            this[Symbol.for('client')].remove(lockPath, -1, err => {
                if (err) {
                    Log.error(`unlock: ${id} --> ${lockPath} failed`, err.stack);
                    let error = new Error('unlock failed');
                    defer.reject(error);
                    typeof cb === 'function' && Reflect.apply(cb, cb, [error]);
                    return;
                }
                this[Symbol.for('locks')].delete(id);
                defer.resolve();
                typeof cb === 'function' && Reflect.apply(cb, cb, []);
            });
        }
        return defer;
    }

    fail(context) {
        let error = new Error(`lock: ${context.id} failed`);
        if (context.lockPath) {
            let nodePath = `${this[Symbol.for('config')].area}/${context.lockPath}`;
            Log.error(`lock failed, cleaning up existing sequential node: ${nodePath}`);
            this[Symbol.for('client')].remove(nodePath, -1, () => {
                this.resultError(context, error);
            });
        } else {
            this.resultError(context, error);
        }
    }

    resultError(context, error) {
        context.defer.reject(error);
        typeof context.cb === 'function' && Reflect.apply(context.cb, context.cb, [error || new Error('lock failed')]);
    }

    success(context) {
        this[Symbol.for('locks')].set(context.id, context.lockPath);
        Log.info(`lock: ${context.id} success: ${context.lockPath}`);
        context.defer.resolve();
        typeof context.cb === 'function' && Reflect.apply(context.cb, context.cb, []);
    }

    /**
     * zookeeper 创建的临时节点是可以重复的,默认加了顺序,如果第一个是我们刚创建的节点则成功反之等待到超时
     */
    check(context) {
        let config = this[Symbol.for('config')];
        this[Symbol.for('client')].getChildren(config.area, null, (err, children) => {
            if (err) {
                Log.error(`check ${context.lockPath} failed to list children`, err.stack);
                return this.fail(context);
            }

            let sorted = children.sort();
            Log.debug(`node: ${config.area} children: ${util.inspect(sorted)}`);
            if (context.lockPath === sorted[0]) {
                return this.success(context);
            }
            let index = sorted.indexOf(context.lockPath);
            if (index < 0) {
                Log.error(`check ${context.lockPath} failed, is not found: ${context.lockPath}`);
                return this.fail(context);
            }

            // 等待 上一个被释放
            this.wait(context, sorted[index - 1]);
        });
    }

    wait(context, last) {
        Log.info(`lock: ${context.id} --> ${context.lockPath} waiting for ${last}`);
        let config = this[Symbol.for('config')];
        let watch = config.retry ? null : () => {
            Log.debug(`lock: ${context.id} wait watch: ${last} retrying`);
            this.check(context);
        };
        this[Symbol.for('client')].exists(`${config.area}/${last}`, watch, (err, stat) => {
            if (err) {
                Log.error(`unable check ${config.area}/${last} exists`, err.stack);
                return this.fail(context);
            }

            if (stat) {
                if (config.retry) {
                    let nextDelay = Reflect.apply(config.retryInterval, this, [context, config]);
                    Log.debug(`lock: ${context.id} wait retrying ${context.retryCurrent++} in ${nextDelay}`);

                    setTimeout(() => {this.check(context)}, nextDelay);
                }
            } else {
                // 上一个如果不存在则可能已经被释放了
                Log.debug(`lock: ${context.id} wait: ${last} not found. retry`);
                this.check(context);
            }
        });
    }
};