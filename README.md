
# 如何安装

[Node.js](http://nodejs.org).

npm install distributed-lock

---

## 如何使用

```javascript
// 引用模块
const DistributedLock = require('distributed-lock');
// 使用zookeeper分布式锁
const DistributedLockService = DistributedLock.ZKDistributedLockService;
// 创建分布式锁服务(如果实例只需要一种分布式锁则可以使用单例)
let service = new DistributedLockService();

// 采用链式风格
    service.lock('Gary').then((reentrantLock) => {
        // 5秒后解锁
        setTimeout(() => {
            reentrantLock.unlockSync()
        }, 5000);
    }).catch(err => {
        console.log('lock failed', err)
    });
```

## API

### DistributedLockService

分布式锁服务接口.

* `lock` - (`id`, `timeout`, `cb`) 锁定资源:

  * `id` - (String) 资源ID.
  * `timeout` - (int - `optional`) 锁资源成功后过期时间(毫秒) 默认3000毫秒.
  * `cb` - (Function(`error`, `reentrantLock`) - `optional`) 回调函数.

* `unlock` - (`locked`, `cb`) 解锁资源:

  * `locked` - (DistributedReentrantLock) 锁定返回资源.
  * `cb` - (Function(`error`) - `optional`) 回调函数.

Return this

### aop()

start aop.