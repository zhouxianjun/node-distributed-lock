/**
 * Created by Alone on 2017/2/15.
 */
const util = require('util');
const Q = require('q');
const zookeeper = require('node-zookeeper-client');
const Log = require('../Log');
const DistributedReentrantLock = require('../DistributedReentrantLock');
module.exports = class ZookeeperDistributedReentrantLock extends DistributedReentrantLock {
    lock() {
        let defer = Q.defer();
        this.defer = defer;
        let lockPath = `${this.config.area}/${this.id}`;
        this.client.create(lockPath, null, zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL, (err, path) => {
            if (err) {
                Log.error(`unable to create node: ${lockPath}`, err.stack);
                this.fail();
            }
            Log.debug(`zk node created: ${path}`);
            this.resource = path.split('/').pop();
            this.check();
        });
        return defer.promise;
    }

    unlock(cb = () => {}) {
        let defer = Q.defer();
        if (!this.locked || this.isUnlock) {
            this.isUnlock = true;
            defer.resolve();
            typeof cb === 'function' && Reflect.apply(cb, cb, []);
        } else {
            let lockPath = `${this.config.area}/${this.locked}`;
            Log.info(`unlock: ${this.id} --> ${lockPath}`);
            this.client.remove(lockPath, -1, err => {
                if (err) {
                    Log.error(`unlock: ${this.id} --> ${lockPath} failed`, err.stack);
                    let error = new Error('unlock failed');
                    defer.reject(error);
                    typeof cb === 'function' && Reflect.apply(cb, cb, [error]);
                    return;
                }
                this.isUnlock = true;
                defer.resolve();
                typeof cb === 'function' && Reflect.apply(cb, cb, []);
            });
        }
        return defer;
    }

    fail() {
        let error = new Error(`lock: ${this.id} failed`);
        if (this.resource) {
            let nodePath = `${this.config.area}/${this.resource}`;
            Log.error(`lock failed, cleaning up existing sequential zk node: ${nodePath}`);
            this.client.remove(nodePath, -1, () => {
                this.resultError(error);
            });
        } else {
            this.resultError(error);
        }
    }

    resultError(error) {
        this.defer.reject(error);
        typeof this.cb === 'function' && Reflect.apply(this.cb, this.cb, [error || new Error('lock failed')]);
    }

    success() {
        this.locked = this.resource;
        Log.info(`lock: ${this.id} success: ${this.locked}`);
        this.defer.resolve(this);
        typeof this.cb === 'function' && Reflect.apply(this.cb, this.cb, [this]);
    }

    /**
     * zookeeper 创建的临时节点是可以重复的,默认加了顺序,如果第一个是我们刚创建的节点则成功反之等待到超时
     */
    check() {
        this.client.getChildren(this.config.area, null, (err, children) => {
            if (err) {
                Log.error(`check ${this.resource} failed to list children`, err.stack);
                return this.fail();
            }

            let sorted = children.sort();
            Log.debug(`node: ${this.config.area} children: ${util.inspect(sorted)}`);
            if (this.resource === sorted[0]) {
                return this.success();
            }
            let index = sorted.indexOf(this.resource);
            if (index < 0) {
                Log.error(`check ${this.resource} failed, not found`);
                return this.fail();
            }

            // 等待 上一个被释放
            this.wait(sorted[index - 1]);
        });
    }

    wait(last) {
        Log.info(`lock: ${this.id} --> ${this.resource} waiting for ${last}`);
        let watch = this.config.retry ? null : () => {
            Log.debug(`lock: ${this.id} wait watch: ${last} retrying`);
            this.check();
        };
        this.client.exists(`${this.config.area}/${last}`, watch, (err, stat) => {
            if (err) {
                Log.error(`unable check ${this.config.area}/${last} exists`, err.stack);
                return this.fail();
            }

            if (stat) {
                if (this.config.retry) {
                    let nextDelay = Reflect.apply(this.config.retryInterval, this, []);
                    Log.debug(`lock: ${this.id} wait retrying ${this.retryCurrent++} in ${nextDelay}`);

                    setTimeout(() => {this.check()}, nextDelay);
                }
            } else {
                // 上一个如果不存在则可能已经被释放了
                Log.debug(`lock: ${this.id} wait: ${last} not found. retry`);
                this.check();
            }
        });
    }
};