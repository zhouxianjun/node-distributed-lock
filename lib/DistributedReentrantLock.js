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
        this.lockedTime = 0;
        this.expire = 0;
        this.expireTimeout = null;
    }

    * lock(expire) {throw new ReferenceError('this is interface method.');}

    * unlock() {throw new ReferenceError('this is interface method.');}

    unlockSync() {throw new ReferenceError('this is interface method.');}

    * cancel() {throw new ReferenceError('this is interface method.');}

    setExpireTimeout() {
        if (this.expireTimeout) return;
        this.expireTimeout = setTimeout(() => {
            if (!this.isCancle && !this.isUnlock) {
                console.info(`lock ${this.id} resource ${this.locked} expire.`);
                this.unlockSync();
            }
        }, this.expire);
    }
};