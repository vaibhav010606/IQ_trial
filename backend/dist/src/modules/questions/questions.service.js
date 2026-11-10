"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const query_util_1 = require("../../common/db/query.util");
const csvParser = require('csv-parser');
const stream_1 = require("stream");
const WRITABLE_COLUMNS = [
    'subject',
    'topic',
    'subtopic',
    'question_text',
    'options',
    'correct_answer',
    'difficulty',
    'q_type',
    'marks',
    'image_url',
];
let QuestionsService = class QuestionsService {
    scopedSubject(user) {
        if (!user)
            return null;
        if (user.role !== 'teacher')
            return null;
        if (!user.subject || user.subject === 'All')
            return null;
        return user.subject;
    }
    async assertCanWriteAll(ids, user) {
        const subject = this.scopedSubject(user);
        if (!subject || !ids.length)
            return;
        for (const idChunk of (0, query_util_1.chunk)(ids, query_util_1.ID_CHUNK_SIZE)) {
            const { data, error } = await supabase_config_1.supabase
                .from('questions')
                .select('id, subject')
                .in('id', idChunk);
            if (error)
                throw new Error(error.message);
            if ((data?.length ?? 0) !== idChunk.length) {
                throw new common_1.NotFoundException('Question not found');
            }
            if (data.some((q) => String(q.subject).toLowerCase() !== subject.toLowerCase())) {
                throw new common_1.ForbiddenException(`You can only modify ${subject} questions.`);
            }
        }
    }
    pickWritable(body) {
        const out = {};
        for (const key of WRITABLE_COLUMNS) {
            if (body?.[key] !== undefined)
                out[key] = body[key];
        }
        return out;
    }
    async findAll(filters, user) {
        const page = Math.max(Number(filters.page) || 1, 1);
        const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 5000);
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const scoped = this.scopedSubject(user);
        const subject = scoped ?? filters.subject;
        let query = supabase_config_1.supabase
            .from('questions')
            .select('id, subject, topic, subtopic, difficulty, q_type, question_text, options, correct_answer, marks, created_at, image_url, review_status, source', { count: 'exact' })
            .eq('is_active', true)
            .range(from, to)
            .order('created_at', { ascending: false });
        if (filters.review_status === 'all') {
        }
        else if (filters.review_status) {
            query = query.eq('review_status', filters.review_status);
        }
        else {
            query = query.eq('review_status', 'approved');
        }
        if (subject)
            query = query.ilike('subject', this.escapeLike(subject));
        if (filters.difficulty)
            query = query.eq('difficulty', filters.difficulty);
        if (filters.q_type) {
            query = query.eq('q_type', filters.q_type);
        }
        else if (filters.exclude_subjective === 'true') {
            query = query.neq('q_type', 'subjective');
        }
        if (filters.topic)
            query = query.ilike('topic', `%${this.escapeLike(filters.topic)}%`);
        if (filters.search)
            query = query.ilike('question_text', `%${this.escapeLike(filters.search)}%`);
        const { data, error, count } = await query;
        if (error)
            throw new Error(error.message);
        const total = count ?? 0;
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            hasMore: to + 1 < total,
        };
    }
    escapeLike(value) {
        return value.replace(/[%_\\]/g, (m) => `\\${m}`);
    }
    async getReviewQueue(filters, user) {
        return this.findAll({ ...filters, review_status: 'pending' }, user);
    }
    async findOne(id, user) {
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('Question not found');
        const subject = this.scopedSubject(user);
        if (subject &&
            String(data.subject).toLowerCase() !== subject.toLowerCase()) {
            throw new common_1.ForbiddenException(`You can only view ${subject} questions.`);
        }
        return data;
    }
    async create(body, user) {
        const scoped = this.scopedSubject(user);
        if (scoped && String(body.subject).toLowerCase() !== scoped.toLowerCase()) {
            throw new common_1.ForbiddenException(`You can only create ${scoped} questions.`);
        }
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .insert({
            ...this.pickWritable(body),
            source: 'manual',
            review_status: 'approved',
            is_active: true,
            created_by: user.id,
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async update(id, body, user) {
        await this.assertCanWriteAll([id], user);
        const patch = this.pickWritable(body);
        const scoped = this.scopedSubject(user);
        if (scoped &&
            patch.subject &&
            String(patch.subject).toLowerCase() !== scoped.toLowerCase()) {
            throw new common_1.ForbiddenException(`You can only file questions under ${scoped}.`);
        }
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        if (!data)
            throw new common_1.NotFoundException('Question not found');
        return data;
    }
    async remove(id, user) {
        await this.assertCanWriteAll([id], user);
        const { error } = await supabase_config_1.supabase
            .from('questions')
            .update({ is_active: false })
            .eq('id', id);
        if (error)
            throw new Error(error.message);
        return { message: 'Question deleted successfully' };
    }
    async duplicate(id, user) {
        await this.assertCanWriteAll([id], user);
        const { data: original } = await supabase_config_1.supabase
            .from('questions')
            .select('*')
            .eq('id', id)
            .single();
        if (!original)
            throw new common_1.NotFoundException('Question not found');
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, reviewed_by: _reviewedBy, reviewed_at: _reviewedAt, ...rest } = original;
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .insert({
            ...rest,
            is_active: true,
            review_status: 'pending',
            reviewed_by: null,
            reviewed_at: null,
            created_by: user.id,
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async approve(id, reviewer, corrections) {
        await this.assertCanWriteAll([id], reviewer);
        const payload = {
            ...this.pickWritable(corrections || {}),
            review_status: 'approved',
            reviewed_by: reviewer.id,
            reviewed_at: new Date().toISOString(),
        };
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        if (!data)
            throw new common_1.NotFoundException('Question not found');
        return data;
    }
    async reject(id, reviewer) {
        await this.assertCanWriteAll([id], reviewer);
        const { data, error } = await supabase_config_1.supabase
            .from('questions')
            .update({
            review_status: 'rejected',
            is_active: false,
            reviewed_by: reviewer.id,
            reviewed_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        if (!data)
            throw new common_1.NotFoundException('Question not found');
        return data;
    }
    async bulkApprove(ids, reviewer) {
        if (!ids?.length)
            return { approved: 0 };
        await this.assertCanWriteAll(ids, reviewer);
        let approved = 0;
        for (const idChunk of (0, query_util_1.chunk)(ids, query_util_1.ID_CHUNK_SIZE)) {
            const { data, error } = await supabase_config_1.supabase
                .from('questions')
                .update({
                review_status: 'approved',
                reviewed_by: reviewer.id,
                reviewed_at: new Date().toISOString(),
            })
                .in('id', idChunk)
                .select('id');
            if (error)
                throw new Error(error.message);
            approved += data?.length || 0;
        }
        return { approved };
    }
    async bulkRemove(ids, user) {
        if (!ids?.length)
            return { deleted: 0 };
        await this.assertCanWriteAll(ids, user);
        let deleted = 0;
        for (const idChunk of (0, query_util_1.chunk)(ids, query_util_1.ID_CHUNK_SIZE)) {
            const { data, error } = await supabase_config_1.supabase
                .from('questions')
                .update({ is_active: false })
                .in('id', idChunk)
                .select('id');
            if (error)
                throw new Error(error.message);
            deleted += data?.length || 0;
        }
        return { deleted };
    }
    async deleteImageQuestions(user) {
        const rows = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
            .from('questions')
            .select('id, subject')
            .eq('is_active', true)
            .not('image_url', 'is', null)
            .neq('image_url', ''));
        if (!rows.length)
            return { deleted: 0 };
        const ids = rows.map((r) => r.id);
        const scoped = this.scopedSubject(user);
        if (scoped &&
            rows.some((q) => String(q.subject).toLowerCase() !== scoped.toLowerCase())) {
            throw new common_1.ForbiddenException(`You can only modify ${scoped} questions.`);
        }
        let deleted = 0;
        for (const idChunk of (0, query_util_1.chunk)(ids, query_util_1.ID_CHUNK_SIZE)) {
            const { data, error } = await supabase_config_1.supabase
                .from('questions')
                .update({ is_active: false })
                .in('id', idChunk)
                .select('id');
            if (error)
                throw new Error(error.message);
            deleted += data?.length || 0;
        }
        return { deleted };
    }
    validateCsvRow(row) {
        const problems = [];
        if (!String(row?.question_text || '').trim())
            problems.push('question is required');
        const answer = row?.correct_answer;
        const validIndex = (value) => value !== null &&
            value !== '' &&
            Number.isInteger(Number(value)) &&
            Number(value) >= 0;
        let answerValid = false;
        if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
            if ('index' in answer) {
                answerValid = validIndex(answer.index);
            }
            else if ('indices' in answer) {
                answerValid =
                    Array.isArray(answer.indices) &&
                        answer.indices.length > 0 &&
                        answer.indices.every((index) => validIndex(index));
            }
            else if ('value' in answer) {
                answerValid =
                    (typeof answer.value === 'number' && Number.isFinite(answer.value)) ||
                        (typeof answer.value === 'string' && answer.value.trim().length > 0);
            }
        }
        if (!answerValid)
            problems.push('correct must be A, B, C or D');
        const difficulty = String(row?.difficulty || 'medium')
            .trim()
            .toLowerCase();
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            problems.push('difficulty must be easy, medium or hard');
        }
        if (!String(row?.subject || '').trim())
            problems.push('subject is required');
        if (!String(row?.topic || '').trim())
            problems.push('topic is required');
        return problems;
    }
    async parseCSV(fileBuffer, maxRows = 2000) {
        return new Promise((resolve, reject) => {
            const results = [];
            const stream = stream_1.Readable.from(fileBuffer.toString('utf8'));
            const parser = csvParser();
            parser
                .on('data', (row) => {
                if (results.length >= maxRows)
                    return;
                const correctIndex = ['A', 'B', 'C', 'D'].indexOf(String(row.correct || '')
                    .trim()
                    .toUpperCase());
                const difficulty = String(row.difficulty || 'medium')
                    .trim()
                    .toLowerCase();
                const parsed = {
                    question_text: String(row.question || '').slice(0, 8000),
                    options: [
                        row.optA || '',
                        row.optB || '',
                        row.optC || '',
                        row.optD || '',
                    ],
                    correct_answer: { index: correctIndex },
                    difficulty,
                    subject: String(row.subject || '').slice(0, 100),
                    topic: String(row.topic || '').slice(0, 200),
                    q_type: 'single_correct',
                    marks: Number.isFinite(parseFloat(row.marks))
                        ? parseFloat(row.marks)
                        : 4,
                };
                const problems = this.validateCsvRow(parsed);
                results.push({
                    ...parsed,
                    valid: problems.length === 0,
                    errorMsg: problems.length ? problems.join('; ') : null,
                });
            })
                .on('end', () => resolve(results))
                .on('error', reject);
            stream.on('error', reject);
            stream.pipe(parser);
        });
    }
    async bulkInsert(rows, user) {
        const scoped = this.scopedSubject(user);
        const validRows = (rows || [])
            .filter((r) => this.validateCsvRow(r).length === 0)
            .map((r) => {
            if (scoped &&
                String(r.subject).toLowerCase() !== scoped.toLowerCase()) {
                throw new common_1.ForbiddenException(`You can only import ${scoped} questions.`);
            }
            return {
                ...this.pickWritable(r),
                created_by: user.id,
                is_active: true,
                source: 'csv',
                review_status: 'approved',
            };
        });
        if (!validRows.length)
            return { inserted: 0 };
        let inserted = 0;
        for (const batch of (0, query_util_1.chunk)(validRows, 500)) {
            const { data, error } = await supabase_config_1.supabase
                .from('questions')
                .insert(batch)
                .select('id');
            if (error)
                throw new Error(error.message);
            inserted += data?.length || 0;
        }
        return { inserted };
    }
};
exports.QuestionsService = QuestionsService;
exports.QuestionsService = QuestionsService = __decorate([
    (0, common_1.Injectable)()
], QuestionsService);
//# sourceMappingURL=questions.service.js.map