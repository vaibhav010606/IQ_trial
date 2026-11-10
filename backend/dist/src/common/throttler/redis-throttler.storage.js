"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisThrottlerStorage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisThrottlerStorage = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisThrottlerStorage = RedisThrottlerStorage_1 = class RedisThrottlerStorage {
    logger = new common_1.Logger(RedisThrottlerStorage_1.name);
    memory = new throttler_1.ThrottlerStorageService();
    redis = null;
    healthy = false;
    constructor() {
        const url = process.env.REDIS_URL;
        if (!url) {
            this.logger.log('REDIS_URL not set — throttling counters are per-instance.');
            return;
        }
        try {
            this.redis = new ioredis_1.default(url, {
                maxRetriesPerRequest: 1,
                retryStrategy: (times) => times > 5 ? null : Math.min(times * 200, 2000),
                keyPrefix: 'throttle:',
            });
            this.redis.on('ready', () => {
                this.healthy = true;
                this.logger.log('Redis throttler storage connected.');
            });
            this.redis.on('error', (e) => {
                if (this.healthy)
                    this.logger.warn(`Redis throttler error: ${e.message}`);
                this.healthy = false;
            });
            this.redis.on('end', () => {
                this.healthy = false;
            });
        }
        catch (e) {
            this.logger.warn(`Redis throttler init failed (${e?.message}) — using memory.`);
            this.redis = null;
        }
    }
    async onModuleDestroy() {
        this.memory.onApplicationShutdown?.();
        if (this.redis) {
            try {
                await this.redis.quit();
            }
            catch {
                this.redis.disconnect();
            }
        }
    }
    async increment(key, ttl, limit, blockDuration, throttlerName) {
        if (!this.redis || !this.healthy) {
            return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
        }
        try {
            return await this.incrementInRedis(key, ttl, limit, blockDuration, throttlerName);
        }
        catch (e) {
            this.logger.warn(`Redis throttler read failed (${e?.message}) — using memory this call.`);
            return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
        }
    }
    async incrementInRedis(key, ttl, limit, blockDuration, throttlerName) {
        const hitsKey = `${throttlerName}:${key}`;
        const blockKey = `${throttlerName}:${key}:blocked`;
        const script = `
      local blockTtl = redis.call('PTTL', KEYS[2])
      if blockTtl > 0 then
        return { redis.call('GET', KEYS[1]) or ARGV[2], 0, 1, blockTtl }
      end

      local hits = redis.call('INCR', KEYS[1])
      if hits == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      local ttlLeft = redis.call('PTTL', KEYS[1])

      if hits > tonumber(ARGV[2]) then
        redis.call('SET', KEYS[2], 1, 'PX', ARGV[3])
        return { hits, ttlLeft, 1, tonumber(ARGV[3]) }
      end

      return { hits, ttlLeft, 0, 0 }
    `;
        const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = (await this.redis.eval(script, 2, hitsKey, blockKey, String(ttl), String(limit), String(blockDuration > 0 ? blockDuration : ttl)));
        return {
            totalHits: Number(totalHits) || 0,
            timeToExpire: Math.ceil(Math.max(0, Number(timeToExpire)) / 1000),
            isBlocked: Number(isBlocked) === 1,
            timeToBlockExpire: Math.ceil(Math.max(0, Number(timeToBlockExpire)) / 1000),
        };
    }
};
exports.RedisThrottlerStorage = RedisThrottlerStorage;
exports.RedisThrottlerStorage = RedisThrottlerStorage = RedisThrottlerStorage_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisThrottlerStorage);
//# sourceMappingURL=redis-throttler.storage.js.map