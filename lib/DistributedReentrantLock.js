/**
 * Created by Alone on 2017/2/15.
 */
module.exports = class DistributedReentrantLock {
    constructor(client, id, timeout) {
        this.id = id;
        this.client = client;
        this.timeout = timeout;
    }

    lock(id, timeout, cb) {throw new ReferenceError('this is interface method.');}

    unlock(cb) {throw new ReferenceError('this is interface method.');}
};