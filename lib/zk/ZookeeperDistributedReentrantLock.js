/**
 * Created by Alone on 2017/2/15.
 */
"use strict";
const util = require('util');
const Q = require('q');
const co = require('co');
const thunkify = require('thunkify');
const zookeeper = require('node-zookeeper-client');
const Log = require('../../index').Logger;
const DistributedReentrantLock = require('../DistributedReentrantLock');
module.exports = class ZookeeperDistributedReentrantLock extends DistributedReentrantLock {
    lock(expire) {
        let defer = Q.defer();
        this.defer = defer;
        this.expire = expire;
        co(function *() {
            let lockPath = `${this.config.area}/${this.id}`;
            let existsKey = yield thunkify(this.client.exists).apply(this.client, [lockPath, null]);
            Log().debug(`lock ${this.id} is exists ${!(!existsKey)}`);
            if (!existsKey) {
                Log().debug(`lock ${this.id} create key...`);
                try {
                    yield thunkify(this.client.create).apply(this.client, [lockPath, null]);
                } catch (err) {
                    if (err.getCode() == zookeeper.Exception.NODE_EXISTS) {
                        Log().warn(`lock ${this.id} create key exists.`);
                    } else {
                        throw err;
                    }
                }
            }
            yield this.lockQueue();
        }.bind(this)).catch(err => {defer.reject(err)});
        return defer.promise;
    }

    * lockQueue() {
        let lockPath = `${this.config.area}/${this.id}`;
        let path = yield thunkify(this.client.create).apply(this.client, [`${lockPath}/lock`, null, zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL]);
        this.resource = path.split('/').pop();
        Log().debug(`lock ${this.id} resource for ${this.resource}`);
        yield this.check();
    }

    * unlock() {
        if (!this.locked || this.isUnlock) {
            this.isUnlock = true;
            return;
        }
        let lockPath = `${this.config.area}/${this.id}/${this.locked}`;
        yield thunkify(this.client.remove).apply(this.client, [lockPath, -1]);
        this.isUnlock = true;
        Log().info(`unlock ${this.id} success for ${this.locked}`);

        try {
            yield this.clearKey();
        } catch (err) {
            Log().warn(`clear key ${this.id} error`, err.stack);
        }
    }

    * haslock() {
        let lockPath = `${this.config.area}/${this.id}`;
        let existsKey = yield thunkify(this.client.exists).apply(this.client, [lockPath, null]);
        if (existsKey) {
            let children = yield this.list(`${this.config.area}/${this.id}`);
            return children && children.length > 0;
        }
        return false;
    }

    * cancel() {
        if (this.resource && !this.locked && !this.isCancel) {
            yield thunkify(this.client.remove).apply(this.client, [`${this.config.area}/${this.id}/${this.resource}`, -1]);
            this.isCancel = true;
            Log().info(`lock ${this.id} await timeout, removed resource ${this.resource}`);
            this.defer.reject(new Error('lock await timeout'));
        }
    }

    /**
     * zookeeper 创建的临时节点是可以重复的,默认加了顺序,如果第一个是我们刚创建的节点则成功反之等待到超时
     */
    * check() {
        if (this.isCancel) {
            Log().warn(`lock ${this.id} is canceled`);
            return;
        }
        let children = yield this.list(`${this.config.area}/${this.id}`);
        let sorted = children.sort();
        Log().debug(`lock ${this.id} waiting children ${util.inspect(sorted)}`);

        if (this.resource === sorted[0]) {
            this.locked = this.resource;
            this.lockTime = new Date();
            this.setExpireTimeout();
            Log().info(`lock ${this.id} success for ${this.locked}`);
            this.defer.resolve();
            return;
        }
        let index = sorted.indexOf(this.resource);
        if (index < 0) {
            yield this.rollback();
            throw new Error(`check ${this.resource} failed, not found`);
        }

        // 等待 上一个被释放
        return yield this.wait(sorted[index - 1]);
    }

    * wait(last) {
        Log().info(`lock ${this.id} resource ${this.resource} waiting for ${last}`);
        let watch = () => {
            if (this.isCancel) {
                Log().warn(`lock ${this.id} is canceled`);
                return;
            }
            Log().debug(`lock ${this.id} wait watch ${last} retrying...`);
            co(function *() {yield this.check()}.bind(this));
        };

        let stat = yield thunkify(this.client.exists).apply(this.client, [`${this.config.area}/${this.id}/${last}`, watch]);
        if (!stat) {
            // 上一个如果不存在则可能已经被释放了
            Log().debug(`lock ${this.id} wait ${last} not found. retry...`);
            yield this.check();
        }
    }

    * list(path) {
        let children = yield thunkify(this.client.getChildren).apply(this.client, [path, null]);
        return getChildren(children);
    }

    * rollback() {
        let nodePath = `${this.config.area}/${this.id}/${this.resource}`;
        Log().error(`lock failed, cleaning up existing sequential zk node: ${nodePath}`);
        yield thunkify(this.client.remove).apply(this.client, [nodePath, -1]);
    }

    * clearKey() {
        let children = yield this.list(`${this.config.area}/${this.id}`);

        if (children.length <= 0) {
            Log().debug(`key ${this.id} non-empty children remove...`);
            try {
                yield thunkify(this.client.remove).apply(this.client, [`${this.config.area}/${this.id}`, -1]);
                Log().debug(`key ${this.id} removed`);
            } catch (err) {
                if (!err.getCode || err.getCode() !== zookeeper.Exception.NOT_EMPTY) {
                    Log().warn(`remove key ${this.id} failed`, err.stack);
                }
            }
        }
    }

    setExpireTimeout() {
        if (this.expireTimeout) return;
        this.expireTimeout = setTimeout(() => {
            if (!this.isCancle && !this.isUnlock) {
                Log().info(`lock ${this.id} resource ${this.locked} expire.`);
                this.unlockSync();
            }
        }, this.expire);
    }
};

const getChildren = children => {
    let result = children;
    if (children instanceof Array && children.length > 1) {
        children.every(child => {
            if (child instanceof Array) {
                if ((child.length > 0 && typeof child[0] === 'string') || child.length == 0) {
                    result = child;
                    return false;
                }
            }
        });
    }
    return result;
};