/**
 * Created by Alone on 2017/2/28.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const Q = require('q');
const co = require('co');
const thunkify = require('thunkify');
const logger = require('tracer-logger');
const DistributedReentrantLock = require('../DistributedReentrantLock');
module.exports = class RedisDistributedReentrantLock extends DistributedReentrantLock {
    lock(expire) {
        if (this.isCancel) {
            logger.warn(`lock ${this.id} is canceled resource ${this.resource}`);
            return;
        }
        this.defer = this.defer || Q.defer();
        let lockPath = `${this.config.area}:${this.id}`;
        this.resource = this.resource || uuid();
        co(function *() {
            let success = yield thunkify(this.client.lock).apply(this.client, [lockPath, this.resource, expire]);
            if (success === 1) {
                this.lockTime = new Date();
                logger.info(`lock ${this.id} success for ${this.resource}`);
                this.defer.resolve();
            } else {
                this.waitTimeout = setTimeout(() => {
                    this.lock(expire);
                }, this.config.retryInterval);
            }
        }.bind(this));
        return this.defer.promise;
    }

    * unlock() {
        let lockPath = `${this.config.area}:${this.id}`;
        let success = yield thunkify(this.client.unlock).apply(this.client, [lockPath, this.resource]);
        this.isUnlock = true;
        logger.info(`unlock ${this.id} success for ${this.resource}`);
    }

    * haslock() {
        let result = yield this.client.get(`${this.config.area}:${this.id}`);
        return !!result;
    }

    * cancel() {
        if (!this.lockTime && !this.lockedTime && !this.isCancel) {
            this.isCancel = true;
            logger.info(`lock ${this.id} await timeout, resource ${this.resource}`);
            this.defer.reject(new Error('lock await timeout'));
        }
    }
};