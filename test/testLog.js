/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const DistributedLockService = require('../lib/zk/ZookeeperDistributedLockService');
let service = new DistributedLockService();
service.on('disconnected', () => {console.log('disconnected')});

service.on('ready', () => {
    service.lock('Gary').then((reentrantLock) => {setTimeout(() => {reentrantLock.unlock()}, 5000)}).catch(err => {console.log('lock failed', err)});
    service.lock('Alone').then((reentrantLock) => {reentrantLock.unlock()}).catch(err => {console.log('lock failed', err)});
});