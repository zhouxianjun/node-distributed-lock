/**
 * Created by Alone on 2017/2/15.
 */
module.exports = class DistributedReentrantLock {
    constructor(client, config, id, timeout, cb) {
        this.id = id;
        this.client = client;
        this.timeout = timeout;
        this.cb = cb;
        this.config = config;
        this.isUnlock = false;
    }

    lock(id, timeout, cb) {throw new ReferenceError('this is interface method.');}

    unlock(cb) {throw new ReferenceError('this is interface method.');}
};