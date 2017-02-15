/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const DistributedLockService = require('../lib/zk/ZookeeperDistributedLockService');
let service = new DistributedLockService();
service.on('disconnected', () => {console.log('disconnected')});

service.on('ready', () => {
    service.lock('Alone').then(() => {setTimeout(() => {service.unlock('Alone')}, 5000)});
    service.lock('Alone', err => {
        if (err) {
            console.log('lock failed...', err.stack);
            return;
        }
        service.unlock('Alone');
    });
});