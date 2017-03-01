/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const DistributedLock = require('../lib');
const DistributedLockService = DistributedLock.RedisDistributedLockService;
let service = new DistributedLockService();
service.on('ready', () => {console.log('ready')});
service.on('error', error => {console.log('error', error)});

service.lock('Gary').then(lock => {setTimeout(() => {lock.unlockSync()}, 5000)}).catch(err => {console.error(err.stack)});
service.lock('Gary').catch(err => {console.error(err.stack)});

service.lock('Alone').then(lock => {setTimeout(() => {lock.unlockSync()}, 1000)}).catch(err => {console.error(err.stack)});
service.lock('Alone').catch(err => {console.error(err.stack)});