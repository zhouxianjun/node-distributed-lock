/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const util = require('util');
const uuid = require('uuid');
const Q = require('q');
const merge = require('merge');
const zookeeper = require('node-zookeeper-client');
const Log = require('../Log');
const DistributedLockService = require('../DistributedLockService');
const defaultConfig = {
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: 'distributed_lock',
    zkOption: {}
};
module.exports = class ZookeeperDistributedLockService extends DistributedLockService {
    constructor(config = defaultConfig) {
        super();
        this[Symbol.for('config')] = config = merge(config, defaultConfig);
        this[Symbol.for('client')] = zookeeper.createClient(config.url || `${config.host}:${config.port}`, config.zkOption);
        ['connectedReadOnly', 'disconnected', 'expired', 'authenticationFailed'].forEach(event => {
            this[Symbol.for('client')].once(event, () => {this.emit(event);});
        });

        this[Symbol.for('client')].once('connected', () => {
            Log.debug('Connected to ZooKeeper.');
            this[Symbol.for('client')].create(config.area, null, zookeeper.CreateMode.PERSISTENT, err => {
                if (err) {
                    if (err.getCode() !== zookeeper.Exception.NODE_EXISTS) {
                        Log.error(`Unable to create resource: ${config.area}`, err.stack);
                        this.emit('error', err);
                        return;
                    } else {
                        Log.warn(`reusing existing resource: ${config.area}`);
                    }
                }
                this.emit('ready');
            });
        });
        this[Symbol.for('client')].connect();
    }

    lock(id = `lock-${uuid()}`, timeout = 360, cb = () => {}) {
        let lockPath = `${this[Symbol.for('config')].area}/${id}`;
        let defer = Q.defer();
        this[Symbol.for('client')].create(lockPath, null, zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL, (err, path) => {
            if (err) {
                Log.error(`unable to create node: ${lockPath}`, err.stack);
                this.fail(defer, id);
            }
            Log.debug(`node created: ${path}`);
            this.check(defer, id, path.split('/').pop());
        });
        return defer.promise;
    }

    fail(defer, id, lockPath) {
        let error = new Error(`lock: ${id} failed`);
        if (lockPath) {
            let nodePath = `${this[Symbol.for('config')].area}/${lockPath}`;
            Log.error(`lock failed, cleaning up existing sequential node: ${nodePath}`);
            this[Symbol.for('client')].remove(nodePath, -1, () => {defer.reject(error)});
        } else {
            defer.reject(error);
        }
    }

    success(defer, id, lockPath) {

    }

    /**
     * zookeeper 创建的临时节点是可以重复的,默认加了顺序,如果第一个是我们刚创建的节点则成功反之等待到超时
     * @param defer
     * @param id
     * @param lockPath
     */
    check(defer, id, lockPath) {
        this[Symbol.for('client')].getChildren(this[Symbol.for('config')].area, null, (err, children) => {
            if (err) {
                Log.error(`check ${lockPath} failed to list children`, err.stack);
                return this.fail(defer, id, lockPath);
            }

            let sorted = children.sort();
            Log.debug(`node: ${this[Symbol.for('config')].area} children: ${util.inspect(sorted)}`);
            if (lockPath === sorted[0]) {
                return this.success(defer, id, lockPath);
            }
            let index = sorted.findIndex((e) => {
                return e === ctx.seqZnode;
            });
            ctx.lastChildId = sorted[index - 1];
            return exists(ctx);
        });
    }
};