"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const common_1 = require("@nestjs/common");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    allowList;
    isProd;
    logger = new common_1.Logger(RedisIoAdapter.name);
    adapterConstructor = null;
    clients = [];
    constructor(app, allowList, isProd) {
        super(app);
        this.allowList = allowList;
        this.isProd = isProd;
    }
    async connectToRedis() {
        const url = process.env.REDIS_URL;
        if (!url) {
            this.logger.log('REDIS_URL not set — WebSocket events stay within this instance.');
            return;
        }
        try {
            const pubClient = new ioredis_1.default(url, { maxRetriesPerRequest: null });
            const subClient = pubClient.duplicate();
            this.clients = [pubClient, subClient];
            for (const client of this.clients) {
                client.on('error', (e) => this.logger.warn(`Redis socket adapter error: ${e.message}`));
            }
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
            this.logger.log('WebSocket Redis adapter enabled.');
        }
        catch (e) {
            this.logger.error(`Could not set up the WebSocket Redis adapter (${e?.message}). ` +
                'Running single-instance; do not scale the API out until this is fixed.');
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: (origin, callback) => {
                    if (!origin)
                        return callback(null, true);
                    if (this.allowList.includes('*') ||
                        this.allowList.includes(origin) ||
                        origin.endsWith('.vercel.app'))
                        return callback(null, true);
                    if (!this.isProd) {
                        try {
                            const u = new URL(origin);
                            if ((u.protocol === 'http:' || u.protocol === 'https:') &&
                                (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
                                return callback(null, true);
                            }
                        }
                        catch { }
                    }
                    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
                },
                credentials: true,
            },
        });
        if (this.adapterConstructor)
            server.adapter(this.adapterConstructor);
        return server;
    }
    async close(server) {
        await super.close?.(server);
        await Promise.all(this.clients.map((c) => c.quit().catch(() => {
            c.disconnect();
        })));
        this.clients = [];
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map