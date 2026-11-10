"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class WebSocketDummy {
    };
}
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const redis_io_adapter_1 = require("./common/websockets/redis-io.adapter");
const MAX_BODY_SIZE = '2mb';
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bodyParser: true,
    });
    const isProd = process.env.NODE_ENV === 'production';
    app.set('trust proxy', process.env.TRUST_PROXY ?? 1);
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        res.removeHeader('X-Powered-By');
        if (isProd) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        next();
    });
    app.useBodyParser('json', { limit: MAX_BODY_SIZE });
    app.useBodyParser('urlencoded', { limit: MAX_BODY_SIZE, extended: true });
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
            if (allowList.includes('*') ||
                allowList.includes(origin) ||
                origin.endsWith('.vercel.app'))
                return callback(null, true);
            if (!isProd) {
                try {
                    const u = new URL(origin);
                    if ((u.protocol === 'http:' || u.protocol === 'https:') &&
                        (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
                        return callback(null, true);
                    }
                }
                catch { }
            }
            return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
        credentials: true,
    });
    const ioAdapter = new redis_io_adapter_1.RedisIoAdapter(app, allowList, isProd);
    await ioAdapter.connectToRedis();
    app.useWebSocketAdapter(ioAdapter);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        validationError: { target: false, value: false },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || !isProd;
    if (enableSwagger) {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('EduCommand API')
            .setDescription('Backend API for EduCommand EdTech Platform')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    app.enableShutdownHooks();
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`EduCommand Backend running on port ${port}`);
    logger.log(`Health probe at /api/health${enableSwagger ? ' · API docs at /api/docs' : ''}`);
}
bootstrap().catch((e) => {
    console.error('Failed to start:', e);
    process.exit(1);
});
//# sourceMappingURL=main.js.map