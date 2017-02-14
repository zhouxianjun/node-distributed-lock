/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const uuid = require('uuid');
const assert = require('assert');
module.exports = class DistributedLockService extends require('events') {
    constructor() {
        super();
    }

    lock(id = `lock-${uuid()}`, timeout = 360, cb = () => {}) {
        throw new ReferenceError('this is interface method.');
    }

    unlock(id, cb = () => {}) {
        throw new ReferenceError('this is interface method.');
    }
};