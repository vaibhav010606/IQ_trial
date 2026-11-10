"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const supabase_jwt_1 = require("../../common/auth/supabase-jwt");
let AuthService = AuthService_1 = class AuthService {
    logger = new common_1.Logger(AuthService_1.name);
    async login(email, password) {
        const { data, error } = await supabase_config_1.supabaseAuth.auth.signInWithPassword({
            email,
            password,
        });
        if (error || !data.session) {
            throw new common_1.UnauthorizedException('Invalid email or password. Please check your credentials.');
        }
        const { data: profile, error: profileError } = await supabase_config_1.supabase
            .from('users')
            .select('full_name, role')
            .eq('id', data.user.id)
            .single();
        if (profileError || !profile) {
            throw new common_1.UnauthorizedException('User account exists but profile is missing. Contact support.');
        }
        return {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            user: {
                id: data.user.id,
                email: data.user.email,
                full_name: profile.full_name,
                role: profile.role,
                subject: data.user.app_metadata?.subject ||
                    data.user.user_metadata?.subject ||
                    'All',
            },
        };
    }
    async refresh(refreshToken) {
        const sessionPayload = { ['refresh_token']: refreshToken };
        const { data, error } = await (0, supabase_config_1.createUserAuthClient)().auth.refreshSession(sessionPayload);
        if (error || !data.session) {
            throw new common_1.UnauthorizedException('Refresh token is invalid or expired. Please log in again.');
        }
        return {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
        };
    }
    async logout(accessToken) {
        try {
            await supabase_config_1.supabase.auth.admin.signOut(accessToken, 'local');
        }
        catch (e) {
            this.logger.warn(`Session revocation failed (token may already be expired): ${e?.message}`);
        }
        return { success: true, message: 'Logged out.' };
    }
    async forgotPassword(email) {
        const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL ||
            `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`;
        try {
            await supabase_config_1.supabase.auth.resetPasswordForEmail(email, { redirectTo });
        }
        catch (e) {
            this.logger.warn(`Password reset request failed for ${email}: ${e?.message}`);
        }
        return {
            success: true,
            message: 'If an account exists for that address, a reset link is on its way.',
        };
    }
    async resetPassword(accessToken, newPassword) {
        let userId;
        try {
            const identity = await (0, supabase_jwt_1.verifySupabaseToken)(accessToken);
            userId = identity.userId;
        }
        catch {
            throw new common_1.UnauthorizedException('This reset link is invalid or has expired.');
        }
        const { error } = await supabase_config_1.supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        });
        if (error)
            throw new common_1.BadRequestException(error.message);
        try {
            await supabase_config_1.supabase.auth.admin.signOut(accessToken, 'global');
        }
        catch {
        }
        return { success: true, message: 'Password updated. Please log in again.' };
    }
    async getMe(userId, subject = 'All') {
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .select('id, full_name, email, role, created_at')
            .eq('id', userId)
            .single();
        if (error || !data) {
            throw new common_1.UnauthorizedException('Could not retrieve user profile.');
        }
        return { ...data, subject };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)()
], AuthService);
//# sourceMappingURL=auth.service.js.map