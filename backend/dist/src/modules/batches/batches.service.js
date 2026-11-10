"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const query_util_1 = require("../../common/db/query.util");
let BatchesService = class BatchesService {
    async assertCanManage(batchId, user) {
        const { data: batch } = await supabase_config_1.supabase
            .from('batches')
            .select('id, name, created_by')
            .eq('id', batchId)
            .single();
        if (!batch)
            throw new common_1.NotFoundException('Batch not found');
        if (user.role !== 'admin' && batch.created_by !== user.id) {
            throw new common_1.ForbiddenException('This batch belongs to another teacher.');
        }
        return batch;
    }
    async findAll(user) {
        let query = supabase_config_1.supabase
            .from('batches')
            .select('id, name, subject_focus, created_at, created_by, batch_students(count)')
            .order('created_at', { ascending: false });
        if (user.role !== 'admin')
            query = query.eq('created_by', user.id);
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        return data;
    }
    async create(body, user) {
        const { data, error } = await supabase_config_1.supabase
            .from('batches')
            .insert({
            name: body.name.trim(),
            subject_focus: body.subject_focus ?? null,
            created_by: user.id,
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async findOne(id, user) {
        await this.assertCanManage(id, user);
        const { data, error } = await supabase_config_1.supabase
            .from('batches')
            .select('id, name, subject_focus, created_at, batch_students(student_id, joined_at, users(id, full_name, email))')
            .eq('id', id)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('Batch not found');
        return data;
    }
    async update(id, body, user) {
        await this.assertCanManage(id, user);
        const patch = {};
        if (body.name !== undefined)
            patch.name = body.name.trim();
        if (body.subject_focus !== undefined)
            patch.subject_focus = body.subject_focus;
        if (!Object.keys(patch).length)
            throw new common_1.BadRequestException('Nothing to update.');
        const { data, error } = await supabase_config_1.supabase
            .from('batches')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async remove(id, user) {
        await this.assertCanManage(id, user);
        await supabase_config_1.supabase.from('batch_students').delete().eq('batch_id', id);
        const { error } = await supabase_config_1.supabase.from('batches').delete().eq('id', id);
        if (error)
            throw new Error(error.message);
        return { message: 'Batch deleted successfully' };
    }
    async getStudents(batchId, user) {
        await this.assertCanManage(batchId, user);
        return (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
            .from('batch_students')
            .select('student_id, joined_at, users(id, full_name, email)')
            .eq('batch_id', batchId)
            .order('joined_at', { ascending: true }));
    }
    async addStudent(batchId, studentId, user) {
        await this.assertCanManage(batchId, user);
        const { data: student } = await supabase_config_1.supabase
            .from('users')
            .select('id, role')
            .eq('id', studentId)
            .single();
        if (!student)
            throw new common_1.NotFoundException('Student not found');
        if (student.role !== 'student') {
            throw new common_1.BadRequestException('Only student accounts can be added to a batch.');
        }
        const { data: existing, error: lookupError } = await supabase_config_1.supabase
            .from('batch_students')
            .select('*')
            .eq('batch_id', batchId)
            .eq('student_id', studentId)
            .maybeSingle();
        if (lookupError)
            throw new Error(lookupError.message);
        if (existing)
            return existing;
        const { data, error } = await supabase_config_1.supabase
            .from('batch_students')
            .insert({ batch_id: batchId, student_id: studentId })
            .select()
            .maybeSingle();
        if (error)
            throw new Error(error.message);
        return (data ?? { batch_id: batchId, student_id: studentId, alreadyMember: true });
    }
    async removeStudent(batchId, studentId, user) {
        await this.assertCanManage(batchId, user);
        const { error } = await supabase_config_1.supabase
            .from('batch_students')
            .delete()
            .eq('batch_id', batchId)
            .eq('student_id', studentId);
        if (error)
            throw new Error(error.message);
        return { message: 'Student removed from batch' };
    }
};
exports.BatchesService = BatchesService;
exports.BatchesService = BatchesService = __decorate([
    (0, common_1.Injectable)()
], BatchesService);
//# sourceMappingURL=batches.service.js.map