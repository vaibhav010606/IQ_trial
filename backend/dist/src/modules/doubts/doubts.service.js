"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoubtsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const supabase_config_1 = require("../../config/supabase.config");
const doubt_dto_1 = require("./dto/doubt.dto");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
};
function sniffImageMime(buffer) {
    if (!buffer || buffer.length < 12)
        return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'image/jpeg';
    if (buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return 'image/png';
    const head6 = buffer.subarray(0, 6).toString('latin1');
    if (head6 === 'GIF87a' || head6 === 'GIF89a')
        return 'image/gif';
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buffer.subarray(8, 12).toString('latin1') === 'WEBP')
        return 'image/webp';
    return null;
}
let DoubtsService = class DoubtsService {
    async loadOwnership(doubtId) {
        const { data, error } = await supabase_config_1.supabase
            .from('doubts')
            .select('id, student_id, accepted_by, status')
            .eq('id', doubtId)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('Doubt not found');
        return data;
    }
    canRead(doubt, user) {
        if (user.role === 'admin')
            return true;
        if (doubt.student_id === user.id)
            return true;
        if (doubt.accepted_by && doubt.accepted_by === user.id)
            return true;
        if (user.role === 'teacher' &&
            !doubt.accepted_by &&
            doubt.status === 'pending')
            return true;
        return false;
    }
    canWrite(doubt, user) {
        if (doubt.student_id === user.id)
            return true;
        if (doubt.accepted_by && doubt.accepted_by === user.id)
            return true;
        if (user.role === 'admin')
            return true;
        return false;
    }
    async assertCanRead(doubtId, user) {
        const doubt = await this.loadOwnership(doubtId);
        if (!this.canRead(doubt, user)) {
            throw new common_1.ForbiddenException('You do not have access to this doubt.');
        }
        return doubt;
    }
    async assertCanWrite(doubtId, user) {
        const doubt = await this.loadOwnership(doubtId);
        if (!this.canWrite(doubt, user)) {
            throw new common_1.ForbiddenException('You are not a participant in this doubt.');
        }
        return doubt;
    }
    async checkAccess(doubtId, user) {
        try {
            const doubt = await this.loadOwnership(doubtId);
            return {
                canRead: this.canRead(doubt, user),
                canWrite: this.canWrite(doubt, user),
            };
        }
        catch {
            return { canRead: false, canWrite: false };
        }
    }
    async create(studentId, body) {
        if (body.teacher_id) {
            const { data: teacher } = await supabase_config_1.supabase
                .from('users')
                .select('id, role')
                .eq('id', body.teacher_id)
                .single();
            if (!teacher || !['teacher', 'admin'].includes(teacher.role)) {
                throw new common_1.BadRequestException('Selected teacher is not available.');
            }
        }
        if (body.question_id) {
            const { data: question } = await supabase_config_1.supabase
                .from('questions')
                .select('id')
                .eq('id', body.question_id)
                .single();
            if (!question)
                throw new common_1.BadRequestException('Question not found.');
        }
        if (body.attempt_id) {
            const { data: attempt } = await supabase_config_1.supabase
                .from('attempts')
                .select('id, student_id')
                .eq('id', body.attempt_id)
                .single();
            if (!attempt)
                throw new common_1.BadRequestException('Attempt not found.');
            if (attempt.student_id !== studentId) {
                throw new common_1.ForbiddenException('That attempt does not belong to you.');
            }
        }
        const payload = {
            student_id: studentId,
            question_id: body.question_id,
            attempt_id: body.attempt_id,
            snippet: body.snippet,
            status: body.teacher_id ? 'accepted' : 'pending',
            accepted_by: body.teacher_id || null,
        };
        const { data, error } = await supabase_config_1.supabase
            .from('doubts')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async getMyDoubts(studentId, page = 1, limit = 50) {
        const { from, to, safePage, safeLimit } = this.paginate(page, limit);
        const { data, error, count } = await supabase_config_1.supabase
            .from('doubts')
            .select(`
        id, status, created_at, resolved_at, accepted_by,
        questions(id, question_text, subject, topic),
        teacher:users!doubts_accepted_by_fkey(id, full_name)
      `, { count: 'exact' })
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error)
            throw new Error(error.message);
        return this.page(data, count, safePage, safeLimit);
    }
    async findAll(user, status, page = 1, limit = 50) {
        const { from, to, safePage, safeLimit } = this.paginate(page, limit);
        let query = supabase_config_1.supabase
            .from('doubts')
            .select(`
        id, status, created_at, resolved_at,
        student:users!doubts_student_id_fkey(id, full_name),
        questions(id, question_text, subject, topic),
        teacher:users!doubts_accepted_by_fkey(id, full_name)
      `, { count: 'exact' })
            .order('created_at', { ascending: true })
            .range(from, to);
        if (user.role !== 'admin') {
            query = query.or(`accepted_by.is.null,accepted_by.eq.${user.id}`);
        }
        if (status)
            query = query.eq('status', status);
        const { data, error, count } = await query;
        if (error)
            throw new Error(error.message);
        return this.page(data, count, safePage, safeLimit);
    }
    paginate(page, limit) {
        const safePage = Math.max(Number(page) || 1, 1);
        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const from = (safePage - 1) * safeLimit;
        return { from, to: from + safeLimit - 1, safePage, safeLimit };
    }
    page(data, count, page, limit) {
        const total = count ?? 0;
        return {
            data: data || [],
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async findOne(id, user) {
        await this.assertCanRead(id, user);
        const { data, error } = await supabase_config_1.supabase
            .from('doubts')
            .select(`
        id, status, created_at, resolved_at,
        student:users!doubts_student_id_fkey(id, full_name, email),
        questions(id, question_text, subject, topic, options, correct_answer),
        teacher:users!doubts_accepted_by_fkey(id, full_name)
      `)
            .eq('id', id)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('Doubt not found');
        if (user.role === 'student' && data.questions) {
            const questions = data.questions;
            if (Array.isArray(questions)) {
                questions.forEach((q) => delete q.correct_answer);
            }
            else {
                delete questions.correct_answer;
            }
        }
        return data;
    }
    async accept(id, user) {
        const doubt = await this.loadOwnership(id);
        if (doubt.accepted_by === user.id)
            return doubt;
        if (doubt.accepted_by && user.role !== 'admin') {
            throw new common_1.ConflictException('This doubt has already been accepted by another teacher.');
        }
        let query = supabase_config_1.supabase
            .from('doubts')
            .update({ accepted_by: user.id, status: 'accepted' })
            .eq('id', id);
        if (user.role !== 'admin')
            query = query.is('accepted_by', null);
        const { data, error } = await query.select().single();
        if (error || !data) {
            throw new common_1.ConflictException('This doubt has already been accepted by another teacher.');
        }
        return data;
    }
    async resolve(id, user) {
        const doubt = await this.loadOwnership(id);
        if (doubt.accepted_by !== user.id && user.role !== 'admin') {
            throw new common_1.ForbiddenException('Only the teacher handling this doubt can resolve it.');
        }
        const { data, error } = await supabase_config_1.supabase
            .from('doubts')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async getMessages(doubtId, user) {
        await this.assertCanRead(doubtId, user);
        const { data, error } = await supabase_config_1.supabase
            .from('doubt_messages')
            .select('id, message_text, sent_at, users(id, full_name, role)')
            .eq('doubt_id', doubtId)
            .order('sent_at', { ascending: true })
            .limit(500);
        if (error)
            throw new Error(error.message);
        return data;
    }
    async sendMessage(doubtId, user, messageText) {
        await this.assertCanWrite(doubtId, user);
        return this.persistMessage(doubtId, user.id, messageText);
    }
    async persistMessage(doubtId, senderId, messageText) {
        const text = (messageText ?? '').trim();
        if (!text)
            throw new common_1.BadRequestException('Message cannot be empty.');
        if (text.length > doubt_dto_1.MAX_MESSAGE_LENGTH) {
            throw new common_1.BadRequestException(`Message exceeds ${doubt_dto_1.MAX_MESSAGE_LENGTH} characters.`);
        }
        const { data, error } = await supabase_config_1.supabase
            .from('doubt_messages')
            .insert({ doubt_id: doubtId, sender_id: senderId, message_text: text })
            .select('id, message_text, sent_at, doubt_id')
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async uploadImage(doubtId, user, file) {
        await this.assertCanWrite(doubtId, user);
        if (!file || !file.buffer?.length)
            throw new common_1.BadRequestException('No file provided');
        if (file.size > MAX_IMAGE_BYTES) {
            throw new common_1.BadRequestException('Image must be 5 MB or smaller.');
        }
        const sniffed = sniffImageMime(file.buffer);
        if (!sniffed || !ALLOWED_IMAGE_TYPES[sniffed]) {
            throw new common_1.BadRequestException('Only JPG, PNG, GIF and WEBP images are supported.');
        }
        const fileName = `doubts/${doubtId}/${(0, crypto_1.randomUUID)()}.${ALLOWED_IMAGE_TYPES[sniffed]}`;
        const { error: uploadError } = await supabase_config_1.supabase.storage
            .from('question-images')
            .upload(fileName, file.buffer, {
            contentType: sniffed,
            cacheControl: '31536000',
            upsert: false,
        });
        if (uploadError)
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase_config_1.supabase.storage
            .from('question-images')
            .getPublicUrl(fileName);
        const imageUrl = urlData.publicUrl;
        const data = await this.persistMessage(doubtId, user.id, `[IMAGE]:${imageUrl}`);
        return { ...data, imageUrl };
    }
    async remove(doubtId, user) {
        const doubt = await this.loadOwnership(doubtId);
        const isOwner = doubt.student_id === user.id;
        const isHandler = Boolean(doubt.accepted_by) && doubt.accepted_by === user.id;
        if (user.role !== 'admin' && !isOwner && !isHandler) {
            throw new common_1.ForbiddenException('Only an admin, the student who raised this doubt, or the teacher handling it can delete it.');
        }
        await supabase_config_1.supabase.from('doubt_messages').delete().eq('doubt_id', doubtId);
        const { error } = await supabase_config_1.supabase.from('doubts').delete().eq('id', doubtId);
        if (error)
            throw new Error(error.message);
        return { success: true };
    }
};
exports.DoubtsService = DoubtsService;
exports.DoubtsService = DoubtsService = __decorate([
    (0, common_1.Injectable)()
], DoubtsService);
//# sourceMappingURL=doubts.service.js.map