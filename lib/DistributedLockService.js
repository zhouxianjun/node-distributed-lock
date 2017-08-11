/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const assert = require('assert');
const EventEmitter = require('events');
const Q = require('q');
const co = require("co");
class DistributedLockService extends EventEmitter {
    constructor() {
        super();
        this.awaitTimeout = new Map();
    }

    lock(id, expire = 3000, cb = () => {}) {
        assert.ok(id, 'id has must be not null');
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

    haslock(id, cb = () => {}) {
        assert.ok(id, 'id has must be not null');
        let config = this[Symbol.for('config')];
        let reentrantLock = new config.ReentrantLock(this[Symbol.for('client')], config, id);
        let defer = Q.defer();
        co(function *() {
            return yield reentrantLock.haslock();
        }.bind(this)).then((result) => {
            defer.resolve(result);
            typeof cb === 'function' && Reflect.apply(cb, null, [result]);
        }).catch(err => {
            defer.reject(err);
            typeof cb === 'function' && Reflect.apply(cb, null, [err || new Error('lock failed')]);
        });
        return defer.promise;
    }

    addAwaitTimeout(reentrantLock, lockAwait) {
        if (lockAwait && reentrantLock instanceof this[Symbol.for('config')].ReentrantLock) {
            this.awaitTimeout.set(reentrantLock, setTimeout(() => {
                co(function *() {
                    yield reentrantLock.cancel();
                }.bind(this)).then(() => {
                    this.awaitTimeout.delete(reentrantLock);
                }).catch(err => {throw err});
            }, lockAwait));
        }
    }
}
module.exports = DistributedLockService;