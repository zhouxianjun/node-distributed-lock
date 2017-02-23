/**
 * Created by Alone on 2017/2/15.
 */
'use strict';
module.exports = class DistributedReentrantLock {
    constructor(client, config, id) {
        this.client = client;
        this.config = config;
        this.id = id;
        this.isUnlock = false;
        this.isCancle = false;
    }

    lock(expire) {throw new ReferenceError('this is interface method.');}

    unlock() {throw new ReferenceError('this is interface method.');}

    cancel() {throw new ReferenceError('this is interface method.');}
};