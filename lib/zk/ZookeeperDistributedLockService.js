/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const DistributedLockService = require('../DistributedLockService');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false
};
module.exports = class ZookeeperDistributedLockService extends DistributedLockService {
    constructor(config = defaultConfig) {
        super();
        this[Symbol.for('config')] = config = merge(config, defaultConfig);
        let zkClient = zookeeper.createClient(config.url || `${config.host}:${config.port}`);
        ['connectedReadOnly', 'disconnected', 'expired', 'authenticationFailed'].forEach(event => {
            zkClient.once(event, () => {this.emit(event);});
        });
        zkClient.connect();
    }
};