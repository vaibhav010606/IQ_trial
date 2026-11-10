"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class WebSocketDummy {
    };
}
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/http-exception.filter");
const MAX_BODY_SIZE = '256kb';
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const isProd = process.env.NODE_ENV === 'production';
    app.set('trust proxy', process.env.TRUST_PROXY ?? 1);
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        res.removeHeader('X-Powered-By');
        if (isProd) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        next();
    });
    app.useBodyParser('json', { limit: MAX_BODY_SIZE });
    const allowList = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    if (isProd && !allowList.length) {
        throw new Error('FATAL: set CORS_ORIGINS (or FRONTEND_URL) in production — refusing to start with no allow-list.');
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowList.includes('*') || allowList.includes(origin) || origin.endsWith('.vercel.app'))
                return callback(null, true);
            if (!isProd) {
                try {
                    const u = new URL(origin);
                    if ((u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
                        return callback(null, true);
                    }
                }
                catch { }
            }
            return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.enableShutdownHooks();
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    logger.log(`Secure exam service running on port ${port}`);
}
bootstrap().catch((e) => {
    console.error('Failed to start:', e);
    process.exit(1);
});
//# sourceMappingURL=main.js.map