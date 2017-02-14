/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const assert = require('assert');
const EventEmitter = require('events');
module.exports = class DistributedLockService extends EventEmitter {
    constructor() {
        super();
    }

    lock(id, timeout, cb) {
        throw new ReferenceError('this is interface method.');
    }

    unlock(id, cb) {
        throw new ReferenceError('this is interface method.');
    }
};