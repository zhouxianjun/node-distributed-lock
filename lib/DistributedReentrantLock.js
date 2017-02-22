/**
 * Created by Alone on 2017/2/15.
 */
module.exports = class DistributedReentrantLock {
    constructor(client, config, id, timeout) {
        this.id = id;
        this.client = client;
        this.timeout = timeout;
        this.config = config;
        this.isUnlock = false;
    }

    lock(id, timeout) {throw new ReferenceError('this is interface method.');}

    unlock() {throw new ReferenceError('this is interface method.');}
};