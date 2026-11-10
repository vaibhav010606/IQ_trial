"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const supabase_jwt_1 = require("../auth/supabase-jwt");
const SUBJECT_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const subjectCache = new Map();
function pruneSubjectCache(now) {
    for (const [key, val] of subjectCache.entries()) {
        if (val.expiresAt <= now) {
            subjectCache.delete(key);
        }
    }
}
let SupabaseAuthGuard = class SupabaseAuthGuard {
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Missing or invalid Authorization header. Format: "Bearer <token>"');
        }
        const token = authHeader.slice('Bearer '.length);
        let identity;
        try {
            identity = await (0, supabase_jwt_1.verifySupabaseToken)(token);
        }
        catch (e) {
            throw new common_1.UnauthorizedException(e instanceof supabase_jwt_1.TokenVerificationError
                ? e.message
                : 'Invalid or malformed token.');
        }
        const { data: profile, error: profileError } = await supabase_config_1.supabase
            .from('users')
            .select('full_name, role')
            .eq('id', identity.userId)
            .single();
        if (profileError || !profile) {
            throw new common_1.UnauthorizedException('User profile not found. Contact support.');
        }
        let subject = identity.appMetadata?.subject;
        if (!subject) {
            const cached = subjectCache.get(identity.userId);
            if (cached && cached.expiresAt > Date.now()) {
                subject = cached.subject;
            }
            else {
                const { data } = await supabase_config_1.supabase.auth.admin.getUserById(identity.userId);
                subject =
                    data?.user?.app_metadata?.subject ||
                        data?.user?.user_metadata?.subject ||
                        'All';
                const now = Date.now();
                if (subjectCache.size >= MAX_CACHE_ENTRIES) {
                    pruneSubjectCache(now);
                    if (subjectCache.size >= MAX_CACHE_ENTRIES) {
                        const firstKey = subjectCache.keys().next().value;
                        if (firstKey)
                            subjectCache.delete(firstKey);
                    }
                }
                subjectCache.set(identity.userId, {
                    subject,
                    expiresAt: now + SUBJECT_CACHE_TTL_MS,
                });
            }
        }
        request.user = {
            id: identity.userId,
            email: identity.email,
            role: profile.role,
            full_name: profile.full_name,
            subject,
        };
        return true;
    }
};
exports.SupabaseAuthGuard = SupabaseAuthGuard;
exports.SupabaseAuthGuard = SupabaseAuthGuard = __decorate([
    (0, common_1.Injectable)()
], SupabaseAuthGuard);
//# sourceMappingURL=supabase-auth.guard.js.map