
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

### exports

暴露属性

#### `Function` Logger

返回日志记录器

#### DistributedLockService

分布式锁服务接口.

#### DistributedReentrantLock

分布式锁处理器接口

#### ZKDistributedLockService

zookeeper 协议分布式锁服务实现.

#### ZKDistributedReentrantLock

zookeeper 协议分布式锁处理器实现.

#### RedisDistributedLockService

Redis 协议分布式锁服务实现.

#### RedisDistributedReentrantLock

Redis 协议分布式锁处理器实现.

#### setLogConfig(config)

设置日志记录配置,使用 `tracer` 第三方日志服务

### DistributedLockService

分布式锁服务接口.

#### `Promise` lock(id, [timeout = 3000], [cb])

锁定资源

**Arguments**

* id `String` - 待锁定资源ID.
* timeout `int` - `optional` 锁资源成功后过期时间(毫秒) 默认3000毫秒.
* cb(error, reentrantLock) `Function` - 回调函数.

#### `Promise` unlock(locked, [cb])

解锁资源

**Arguments**

* locked `DistributedReentrantLock` - 锁定资源后的返回.
* cb(error, reentrantLock) `Function` - 回调函数.

---

### ZookeeperDistributedLockService

zookeeper 协议分布式锁服务实现

#### constructor(config)

构造函数.

**Default Config**

```javascript
{
    host: '127.0.0.1',
    port: 2181,
    url: false,
    area: '/distributed_lock',
    ReentrantLock: ZookeeperDistributedReentrantLock,
    lockAwait: 2000,
    zkOption: {}
}
```

* host `String` - zk IP 地址.
* port `int` - zk 端口.
* url `String` - 使用逗号分隔: `host:port` 每个代表一个zk服务地址.

    * `'localhost:2181,localhost:2182/test'`

* area `String` - zk root路径
* ReentrantLock `DistributedReentrantLock` - 分布式锁实现
* lockAwait `int` - 请求锁等待时间(毫秒)
* zkOption `Object` - zk 参数

#### events

**connectedReadOnly、disconnected、expired、authenticationFailed、ready**

---

### RedisDistributedLockService

Redis 协议分布式锁服务实现

#### constructor(config)

构造函数.

**Default Config**

```javascript
{
    retryInterval: 300,
    area: 'distributed_lock',
    ReentrantLock: RedisDistributedReentrantLock,
    lockAwait: 2000,
    redisOptions: {}
}
```

* retryInterval `int` - 重试间隔(毫秒).
* area `String` - redis root路径
* ReentrantLock `DistributedReentrantLock` - 分布式锁实现
* lockAwait `int` - 请求锁等待时间(毫秒)
* zkOption `Object` - redis 参数

#### events

**connect、 ready、 error、 close、 reconnecting、 end**