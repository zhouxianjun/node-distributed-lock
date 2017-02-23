/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const assert = require('assert');
const EventEmitter = require('events');
const co = require("co");
module.exports = class DistributedLockService extends EventEmitter {
    constructor() {
        super();
        this.awaitTimeout = new Map();
    }

    lock(id, timeout, cb) {
        throw new ReferenceError('this is interface method.');
    }

    unlock(id, cb) {
        throw new ReferenceError('this is interface method.');
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
};