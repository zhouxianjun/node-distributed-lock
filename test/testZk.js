/**
 * Created by Alone on 2017/2/14.
 */
'use strict';
const DistributedLock = require('../index');
const DistributedLockService = DistributedLock.ZKDistributedLockService;
let service = new DistributedLockService();
service.on('disconnected', () => {console.log('disconnected')});

service.on('ready', () => {
    service.lock('Gary').then((reentrantLock) => {
        service.haslock('Gary').then(has => {console.log(`has: Gary ${has}`)}).catch(err => {console.error(err.stack)});
        service.haslock('Gary11').then(has => {console.log(`has: Gary11 ${has}`)}).catch(err => {console.error(err.stack)});
        setTimeout(() => {
            reentrantLock.unlockSync()
        }, 5000);
    }).catch(err => {
        console.log('lock failed', err)
    });
    service.lock('Gary').then((reentrantLock) => {
        setTimeout(() => {
            reentrantLock.unlockSync()
        }, 1000);
    }).catch(err => {
        console.log('lock failed', err)
    });
    service.lock('Alone').then((reentrantLock) => {setTimeout(() => {reentrantLock.unlockSync()}, 1000)}).catch(err => {console.log('lock failed', err)});
    service.lock('Alone').then((reentrantLock) => {reentrantLock.unlockSync()}).catch(err => {console.log('lock failed', err)});
});