"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const crypto = __importStar(require("crypto"));
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const ioredis_1 = __importDefault(require("ioredis"));
let CacheService = CacheService_1 = class CacheService {
    logger = new common_1.Logger(CacheService_1.name);
    memory = new Map();
    redis = null;
    redisHealthy = false;
    inFlight = new Map();
    memoryLocks = new Map();
    constructor() {
        const url = process.env.REDIS_URL;
        if (!url) {
            this.logger.log('REDIS_URL not set — using in-memory cache.');
            return;
        }
        try {
            this.redis = new ioredis_1.default(url, {
                maxRetriesPerRequest: 2,
                retryStrategy: (times) => times > 5 ? null : Math.min(times * 200, 2000),
                lazyConnect: false,
            });
            this.redis.on('ready', () => {
                this.redisHealthy = true;
                this.logger.log('Redis cache connected.');
            });
            this.redis.on('error', (e) => {
                if (this.redisHealthy)
                    this.logger.warn(`Redis error, falling back to memory: ${e.message}`);
                this.redisHealthy = false;
            });
            this.redis.on('end', () => {
                this.redisHealthy = false;
            });
        }
        catch (e) {
            this.logger.warn(`Redis init failed (${e?.message}) — using in-memory cache.`);
            this.redis = null;
        }
    }
    async onModuleDestroy() {
        if (this.redis) {
            try {
                await this.redis.quit();
            }
            catch {
                this.redis.disconnect();
            }
        }
    }
    get isDistributed() {
        return Boolean(this.redis && this.redisHealthy);
    }
    async get(key) {
        if (this.isDistributed) {
            try {
                const raw = await this.redis.get(key);
                return raw ? JSON.parse(raw) : null;
            }
            catch {
            }
        }
        const hit = this.memory.get(key);
        if (!hit)
            return null;
        if (hit.expiresAt <= Date.now()) {
            this.memory.delete(key);
            return null;
        }
        return JSON.parse(hit.value);
    }
    async set(key, value, ttlSeconds) {
        const raw = JSON.stringify(value);
        if (this.isDistributed) {
            try {
                await this.redis.set(key, raw, 'EX', ttlSeconds);
                return;
            }
            catch {
            }
        }
        if (this.memory.size > 500)
            this.pruneMemory();
        this.memory.set(key, {
            value: raw,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }
    async invalidate(prefix) {
        for (const key of this.memory.keys()) {
            if (key.startsWith(prefix))
                this.memory.delete(key);
        }
        if (this.isDistributed) {
            try {
                let cursor = '0';
                do {
                    const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
                    cursor = next;
                    if (keys.length)
                        await this.redis.del(...keys);
                } while (cursor !== '0');
            }
            catch {
            }
        }
    }
    async wrap(key, ttlSeconds, produce) {
        const cached = await this.get(key);
        if (cached !== null)
            return cached;
        const running = this.inFlight.get(key);
        if (running)
            return running;
        const promise = (async () => {
            const second = await this.get(key);
            if (second !== null)
                return second;
            const fresh = await produce();
            await this.set(key, fresh, ttlSeconds);
            return fresh;
        })().finally(() => {
            this.inFlight.delete(key);
        });
        this.inFlight.set(key, promise);
        return promise;
    }
    async withLock(key, ttlSeconds, task) {
        const lockKey = `lock:${key}`;
        const token = (0, crypto_1.randomUUID)();
        if (!(await this.acquire(lockKey, token, ttlSeconds)))
            return null;
        try {
            return await task();
        }
        finally {
            await this.release(lockKey, token);
        }
    }
    async acquire(lockKey, token, ttlSeconds) {
        if (this.isDistributed) {
            try {
                const ok = await this.redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
                return ok === 'OK';
            }
            catch {
            }
        }
        const held = this.memoryLocks.get(lockKey);
        if (held && held.expiresAt > Date.now())
            return false;
        this.memoryLocks.set(lockKey, {
            token,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return true;
    }
    async release(lockKey, token) {
        const held = this.memoryLocks.get(lockKey);
        if (held?.token && typeof token === 'string') {
            const a = Buffer.from(held.token);
            const b = Buffer.from(token);
            if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
                this.memoryLocks.delete(lockKey);
            }
        }
        if (this.isDistributed) {
            try {
                await this.redis.eval(`if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`, 1, lockKey, token);
            }
            catch {
            }
        }
    }
    pruneMemory() {
        const now = Date.now();
        for (const [key, entry] of this.memory) {
            if (entry.expiresAt <= now)
                this.memory.delete(key);
        }
        if (this.memory.size > 500) {
            const excess = this.memory.size - 400;
            let i = 0;
            for (const key of this.memory.keys()) {
                if (i++ >= excess)
                    break;
                this.memory.delete(key);
            }
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CacheService);
//# sourceMappingURL=cache.service.js.map