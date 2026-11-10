"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const query_util_1 = require("../../common/db/query.util");
let UsersService = UsersService_1 = class UsersService {
    logger = new common_1.Logger(UsersService_1.name);
    async getProfile(userId) {
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .select('id, full_name, email, role, created_at')
            .eq('id', userId)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('User not found');
        return data;
    }
    async updateProfile(userId, body) {
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .update({
            full_name: body.full_name.trim(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', userId)
            .select('id, full_name, email, role')
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async updatePassword(userId, body) {
        const { data: user } = await supabase_config_1.supabase
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();
        if (!user?.email)
            throw new common_1.NotFoundException('User not found');
        if (body.currentPassword === body.newPassword) {
            throw new common_1.BadRequestException('Your new password must be different from the current one.');
        }
        const authClient = (0, supabase_config_1.createUserAuthClient)();
        const { error: signInError } = await authClient.auth.signInWithPassword({
            email: user.email,
            password: body.currentPassword,
        });
        await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
        if (signInError) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        const { error } = await supabase_config_1.supabase.auth.admin.updateUserById(userId, {
            password: body.newPassword,
        });
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { success: true, message: 'Password updated successfully' };
    }
    async listStudents(filters) {
        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
        const from = (page - 1) * limit;
        const { students, total, error } = filters.batchId
            ? await this.pageStudentsInBatch(filters.batchId, filters.search, from, limit)
            : await this.pageAllStudents(filters.search, from, limit);
        if (error)
            throw new Error(error);
        if (!students.length) {
            return { data: [], total, page, limit, totalPages: 1 };
        }
        const studentIds = students.map((s) => s.id);
        const attempts = await (0, query_util_1.fetchAllIn)(studentIds, (idChunk) => supabase_config_1.supabase
            .from('attempts')
            .select('student_id, total_score, status, submitted_at, started_at, tests(total_marks)')
            .in('student_id', idChunk));
        const statsByStudent = new Map();
        for (const attempt of attempts) {
            const entry = statsByStudent.get(attempt.student_id) ?? {
                testsTaken: 0,
                totalPercent: 0,
                lastActiveAt: null,
            };
            const activity = attempt.submitted_at || attempt.started_at;
            if (activity && (!entry.lastActiveAt || activity > entry.lastActiveAt)) {
                entry.lastActiveAt = activity;
            }
            if (attempt.status === 'submitted') {
                const max = Number(attempt.tests?.total_marks) || 0;
                entry.testsTaken += 1;
                if (max > 0) {
                    entry.totalPercent +=
                        ((Number(attempt.total_score) || 0) / max) * 100;
                }
            }
            statsByStudent.set(attempt.student_id, entry);
        }
        return {
            data: students.map((student) => {
                const stats = statsByStudent.get(student.id);
                const testsTaken = stats?.testsTaken ?? 0;
                const avg = testsTaken > 0 ? stats.totalPercent / testsTaken : null;
                return {
                    ...student,
                    testsTaken,
                    avgScorePercent: avg === null ? null : Math.round(avg),
                    lastActiveAt: stats?.lastActiveAt ?? null,
                    status: testsTaken >= 2 && (avg ?? 100) < 40 ? 'At Risk' : 'Active',
                };
            }),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async pageAllStudents(search, from, limit) {
        let query = supabase_config_1.supabase
            .from('users')
            .select(`
        id, full_name, email, role, created_at,
        batch_students(batch_id, batches(name))
      `, { count: 'exact' })
            .eq('role', 'student')
            .order('full_name', { ascending: true })
            .range(from, from + limit - 1);
        if (search)
            query = query.ilike('full_name', `%${this.escapeLike(search)}%`);
        const { data, error, count } = await query;
        return { students: data || [], total: count ?? 0, error: error?.message };
    }
    async pageStudentsInBatch(batchId, search, from, limit) {
        let query = supabase_config_1.supabase
            .from('batch_students')
            .select(`
        student_id,
        users!inner(id, full_name, email, role, created_at)
      `, { count: 'exact' })
            .eq('batch_id', batchId)
            .eq('users.role', 'student')
            .order('student_id', { ascending: true })
            .range(from, from + limit - 1);
        if (search)
            query = query.ilike('users.full_name', `%${this.escapeLike(search)}%`);
        const { data, error, count } = await query;
        if (error)
            return { students: [], total: 0, error: error.message };
        const students = (data || [])
            .map((row) => row.users)
            .filter(Boolean)
            .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
        return { students, total: count ?? students.length, error: undefined };
    }
    async getStudentProfile(studentId) {
        const { data: user, error } = await supabase_config_1.supabase
            .from('users')
            .select(`
        id, full_name, email, role, created_at,
        batch_students(batch_id, joined_at, batches(name, subject_focus))
      `)
            .eq('id', studentId)
            .eq('role', 'student')
            .single();
        if (error || !user)
            throw new common_1.NotFoundException('Student not found');
        const { data: attempts } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, total_score, status, started_at, submitted_at, tests(title)')
            .eq('student_id', studentId)
            .eq('status', 'submitted')
            .order('submitted_at', { ascending: false })
            .limit(10);
        return { ...user, recentAttempts: attempts || [] };
    }
    async listTeachers() {
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .select('id, full_name, email, role, created_at')
            .eq('role', 'teacher')
            .order('full_name', { ascending: true });
        if (error)
            throw new Error(error.message);
        return data || [];
    }
    async listTeachersForStudents() {
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'teacher')
            .order('full_name', { ascending: true });
        if (error)
            throw new Error(error.message);
        return data || [];
    }
    async listAllUsers(filters) {
        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
        const from = (page - 1) * limit;
        let query = supabase_config_1.supabase
            .from('users')
            .select('id, full_name, email, role, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        if (filters.role && filters.role !== 'all') {
            query = query.eq('role', filters.role);
        }
        if (filters.search) {
            const safe = this.escapeOrFilter(filters.search);
            query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
        }
        const { data, error, count } = await query;
        if (error)
            throw new Error(error.message);
        const total = count ?? 0;
        return {
            data: data || [],
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async adminCreateUser(body) {
        const email = body.email.trim().toLowerCase();
        const { data: authData, error: authError } = await supabase_config_1.supabase.auth.admin.createUser({
            email,
            password: body.password,
            email_confirm: true,
            user_metadata: {
                full_name: body.full_name,
                ...(body.role === 'teacher' && body.subject
                    ? { subject: body.subject }
                    : {}),
            },
            app_metadata: body.role === 'teacher' && body.subject
                ? { subject: body.subject }
                : {},
        });
        if (authError)
            throw new common_1.BadRequestException(authError.message);
        const userId = authData.user.id;
        const { data, error } = await supabase_config_1.supabase
            .from('users')
            .insert({
            id: userId,
            full_name: body.full_name,
            email,
            role: body.role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .select('id, full_name, email, role, created_at')
            .single();
        if (error) {
            await supabase_config_1.supabase.auth.admin.deleteUser(userId).catch(() => undefined);
            throw new common_1.BadRequestException(error.message);
        }
        return data;
    }
    async adminResetPassword(userId, newPassword) {
        const { data: target } = await supabase_config_1.supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
        if (!target)
            throw new common_1.NotFoundException('User not found');
        const { error } = await supabase_config_1.supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        });
        if (error)
            throw new common_1.BadRequestException(error.message);
        await supabase_config_1.supabase.auth.admin
            .signOut(userId, 'global')
            .catch(() => this.logger.warn(`Could not revoke sessions for ${userId} after a reset.`));
        return { success: true, message: 'Password reset successfully' };
    }
    async adminDeleteUser(userId, actingAdminId) {
        if (userId === actingAdminId) {
            throw new common_1.ForbiddenException('You cannot delete your own account.');
        }
        const { data: target } = await supabase_config_1.supabase
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .single();
        if (!target)
            throw new common_1.NotFoundException('User not found');
        const { error: deleteError } = await supabase_config_1.supabase
            .from('users')
            .delete()
            .eq('id', userId);
        if (deleteError) {
            throw new common_1.BadRequestException('Cannot delete this user because they still have linked records. Remove or reassign those records first.');
        }
        const { error } = await supabase_config_1.supabase.auth.admin.deleteUser(userId);
        if (error)
            throw new Error(error.message);
        return { success: true };
    }
    escapeLike(value) {
        return value.replace(/[%_\\]/g, (m) => `\\${m}`);
    }
    escapeOrFilter(value) {
        return this.escapeLike(value).replace(/[(),"']/g, '');
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)()
], UsersService);
//# sourceMappingURL=users.service.js.map