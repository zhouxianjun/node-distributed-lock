/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const co = require('co');
const assert = require('assert');
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const logger = require('tracer-logger');
const DistributedLockService = require('../DistributedLockService');
const ZookeeperDistributedReentrantLock = require('./ZookeeperDistributedReentrantLock');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: '/distributed_lock',
    ReentrantLock: ZookeeperDistributedReentrantLock,
    lockAwait: 2000,
    zkOption: {}
};
module.exports = class ZookeeperDistributedLockService extends DistributedLockService {
    constructor(config = defaultConfig) {
        super();
        this[Symbol.for('locks')] = new Map();
        this[Symbol.for('config')] = config = merge(config, defaultConfig);
        this[Symbol.for('client')] = zookeeper.createClient(config.url || `${config.host}:${config.port}`, config.zkOption);
        ['connectedReadOnly', 'disconnected', 'expired', 'authenticationFailed'].forEach(event => {
            this[Symbol.for('client')].on(event, (...args) => {
                Reflect.apply(this.emit, this, [event].concat(args));
            });
        });

        this[Symbol.for('client')].once('connected', () => {
            logger.debug('Connected to ZooKeeper.');
            this[Symbol.for('client')].create(config.area, null, zookeeper.CreateMode.PERSISTENT, err => {
                if (err) {
                    if (err.getCode() !== zookeeper.Exception.NODE_EXISTS) {
                        logger.error(`Unable to create resource: ${config.area}`, err.stack);
                        this.emit('error', err);
                        return;
                    }
                }
                this.emit('ready');
            });
        });
        this[Symbol.for('client')].connect();

        process.on('exit', () => {this[Symbol.for('client')].close()});
    }
};