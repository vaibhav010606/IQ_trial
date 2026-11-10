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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubtsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const supabase_config_1 = require("../../config/supabase.config");
const supabase_jwt_1 = require("../../common/auth/supabase-jwt");
const doubts_service_1 = require("./doubts.service");
const doubt_dto_1 = require("./dto/doubt.dto");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TTL_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 20;
const MAX_TYPING_EVENTS_PER_WINDOW = 40;
let DoubtsGateway = class DoubtsGateway {
    doubtsService;
    server;
    constructor(doubtsService) {
        this.doubtsService = doubtsService;
    }
    async handleConnection(client) {
        const ready = this.authenticate(client);
        client.data.ready = ready;
        await ready;
    }
    async authenticate(client) {
        try {
            const identity = await (0, supabase_jwt_1.verifySupabaseToken)(client.handshake.auth?.token ?? '');
            const { data: profile } = await supabase_config_1.supabase
                .from('users')
                .select('full_name, role')
                .eq('id', identity.userId)
                .single();
            if (!profile) {
                client.emit('auth_error', { message: 'User profile not found.' });
                client.disconnect();
                return;
            }
            client.data.userId = identity.userId;
            client.data.role = profile.role;
            client.data.name = profile.full_name;
            client.data.grants = new Map();
            client.data.counters = {
                windowStart: Date.now(),
                messages: 0,
                typing: 0,
            };
            console.log(`[Socket] Connected: ${profile.full_name} (${profile.role})`);
        }
        catch (e) {
            client.emit('auth_error', {
                message: e?.message ?? 'Authentication failed.',
            });
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        console.log(`[Socket] Disconnected: ${client.data?.name}`);
    }
    async isAuthenticated(client) {
        await client.data?.ready?.catch(() => undefined);
        if (client.data?.userId)
            return true;
        client.emit('error', { message: 'Not authenticated.' });
        client.disconnect();
        return false;
    }
    readDoubtId(client, data) {
        const doubtId = typeof data?.doubtId === 'string' ? data.doubtId : '';
        if (!UUID_RE.test(doubtId)) {
            client.emit('error', { message: 'Invalid doubt id.' });
            return null;
        }
        return doubtId;
    }
    async getGrant(client, doubtId) {
        const grants = client.data.grants;
        const cached = grants.get(doubtId);
        if (cached && Date.now() - cached.checkedAt < ACCESS_TTL_MS)
            return cached;
        const access = await this.doubtsService.checkAccess(doubtId, {
            id: client.data.userId,
            role: client.data.role,
        });
        const grant = { ...access, checkedAt: Date.now() };
        grants.set(doubtId, grant);
        return grant;
    }
    withinRateLimit(client, kind) {
        const counters = client.data.counters;
        const now = Date.now();
        if (now - counters.windowStart > RATE_LIMIT_WINDOW_MS) {
            counters.windowStart = now;
            counters.messages = 0;
            counters.typing = 0;
        }
        counters[kind] += 1;
        const max = kind === 'messages'
            ? MAX_MESSAGES_PER_WINDOW
            : MAX_TYPING_EVENTS_PER_WINDOW;
        if (counters[kind] > max) {
            if (kind === 'messages') {
                client.emit('error', {
                    message: 'You are sending messages too quickly.',
                });
            }
            return false;
        }
        return true;
    }
    async handleJoinRoom(data, client) {
        if (!(await this.isAuthenticated(client)))
            return;
        const doubtId = this.readDoubtId(client, data);
        if (!doubtId)
            return;
        const grant = await this.getGrant(client, doubtId);
        if (!grant.canRead) {
            client.emit('error', {
                message: 'You do not have access to this doubt.',
            });
            return;
        }
        client.join(`doubt:${doubtId}`);
        console.log(`[Socket] ${client.data.name} joined room: doubt:${doubtId}`);
    }
    async handleLeaveRoom(data, client) {
        if (!(await this.isAuthenticated(client)))
            return;
        const doubtId = this.readDoubtId(client, data);
        if (!doubtId)
            return;
        client.leave(`doubt:${doubtId}`);
        client.data.grants?.delete(doubtId);
    }
    async handleMessage(data, client) {
        if (!(await this.isAuthenticated(client)))
            return;
        const doubtId = this.readDoubtId(client, data);
        if (!doubtId)
            return;
        if (!this.withinRateLimit(client, 'messages'))
            return;
        const text = typeof data?.message_text === 'string' ? data.message_text.trim() : '';
        if (!text)
            return;
        if (text.length > doubt_dto_1.MAX_MESSAGE_LENGTH) {
            client.emit('error', {
                message: `Message exceeds ${doubt_dto_1.MAX_MESSAGE_LENGTH} characters.`,
            });
            return;
        }
        const grant = await this.getGrant(client, doubtId);
        if (!grant.canWrite) {
            client.emit('error', {
                message: 'You are not a participant in this doubt.',
            });
            return;
        }
        let message;
        try {
            message = await this.doubtsService.persistMessage(doubtId, client.data.userId, text);
        }
        catch {
            client.emit('error', { message: 'Failed to send message' });
            return;
        }
        this.server.to(`doubt:${doubtId}`).emit('new_message', {
            ...message,
            sender: {
                id: client.data.userId,
                full_name: client.data.name,
                role: client.data.role,
            },
        });
    }
    async handleTypingStart(data, client) {
        if (!(await this.isAuthenticated(client)))
            return;
        const doubtId = this.readDoubtId(client, data);
        if (!doubtId)
            return;
        if (!this.withinRateLimit(client, 'typing'))
            return;
        if (!client.rooms.has(`doubt:${doubtId}`))
            return;
        client.to(`doubt:${doubtId}`).emit('user_typing', {
            name: client.data.name,
            role: client.data.role,
        });
    }
    async handleTypingStop(data, client) {
        if (!(await this.isAuthenticated(client)))
            return;
        const doubtId = this.readDoubtId(client, data);
        if (!doubtId)
            return;
        if (!this.withinRateLimit(client, 'typing'))
            return;
        if (!client.rooms.has(`doubt:${doubtId}`))
            return;
        client.to(`doubt:${doubtId}`).emit('user_stopped_typing', {
            name: client.data.name,
        });
    }
    broadcastMessage(doubtId, message, sender) {
        this.server
            ?.to(`doubt:${doubtId}`)
            .emit('new_message', { ...message, sender });
    }
    notifyStatusChange(doubtId, status) {
        this.server
            ?.to(`doubt:${doubtId}`)
            .emit('doubt_status_changed', { doubtId, status });
    }
};
exports.DoubtsGateway = DoubtsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DoubtsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], DoubtsGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], DoubtsGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], DoubtsGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing_start'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], DoubtsGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing_stop'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], DoubtsGateway.prototype, "handleTypingStop", null);
exports.DoubtsGateway = DoubtsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)(),
    __metadata("design:paramtypes", [doubts_service_1.DoubtsService])
], DoubtsGateway);
//# sourceMappingURL=doubts.gateway.js.map