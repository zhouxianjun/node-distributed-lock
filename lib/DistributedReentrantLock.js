/**
 * Created by Alone on 2017/2/15.
 */
'use strict';
const co = require('co');
module.exports = class DistributedReentrantLock {
    constructor(client, config, id) {
        this.client = client;
        this.config = config;
        this.id = id;
        this.isUnlock = false;
        this.isCancle = false;
        this.lockedTime = 0;
        this.expire = 0;
    }

    * lock(expire) {throw new ReferenceError('this is interface method.');}

    * unlock() {throw new ReferenceError('this is interface method.');}

    unlockSync() {return co(function *() {yield this.unlock()}.bind(this));;}

    * cancel() {throw new ReferenceError('this is interface method.');}
};