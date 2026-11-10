import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabase } from '../../config/supabase.config';
import { chunk, fetchAll, ID_CHUNK_SIZE } from '../../common/db/query.util';
import {
  CreateQuestionDto,
  CsvRowDto,
  UpdateQuestionDto,
} from './dto/question.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csvParser = require('csv-parser');
import { Readable } from 'stream';

/** The authenticated caller, as attached by SupabaseAuthGuard. */
export interface Requester {
  id: string;
  role?: string;
  subject?: string;
}

/** Columns a client may ever write. Anything else is server-owned. */
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
] as const;

@Injectable()
export class QuestionsService {
  // ── Authorisation ───────────────────────────────────────────────────────────

  /**
   * A teacher scoped to one subject may only touch that subject's questions.
   *
   * `findAll` has always narrowed reads this way, but every write path
   * (`update`, `remove`, `duplicate`, `approve`, `reject`, and the bulk
   * variants) took only an id — so a Physics teacher could edit or delete the
   * Chemistry bank by guessing or reading ids from a shared test.
   */
  private scopedSubject(user?: Requester): string | null {
    if (!user) return null;
    if (user.role !== 'teacher') return null; // admins are unrestricted
    if (!user.subject || user.subject === 'All') return null;
    return user.subject;
  }

  /** Throws unless the caller may write to every one of `ids`. */
  private async assertCanWriteAll(
    ids: string[],
    user?: Requester,
  ): Promise<void> {
    const subject = this.scopedSubject(user);
    if (!subject || !ids.length) return;

    for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('questions')
        .select('id, subject')
        .in('id', idChunk);

      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) !== idChunk.length) {
        throw new NotFoundException('Question not found');
      }
      // Case-insensitive: the bank stores "Physics", tokens sometimes carry "physics".
      if (
        data.some(
          (q) => String(q.subject).toLowerCase() !== subject.toLowerCase(),
        )
      ) {
        throw new ForbiddenException(
          `You can only modify ${subject} questions.`,
        );
      }
    }
  }

  /** Strips everything that is not a client-writable column. */
  private pickWritable(
    body: Partial<CreateQuestionDto> | Record<string, any>,
  ): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of WRITABLE_COLUMNS) {
      if (body?.[key] !== undefined) out[key] = body[key];
    }
    return out;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  /** List all active questions with optional filters */
  async findAll(
    filters: {
      subject?: string;
      difficulty?: string;
      q_type?: string;
      topic?: string;
      search?: string;
      review_status?: string;
      page?: number;
      limit?: number;
      exclude_subjective?: string;
    },
    user?: Requester,
  ) {
    const page = Math.max(Number(filters.page) || 1, 1);
    // Cap the page size — 5000 covers the largest realistic question bank
    // while still bounding what a single request can allocate.
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 5000);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Enforce Subject-Based Access Control
    const scoped = this.scopedSubject(user);
    const subject = scoped ?? filters.subject;

    let query = supabase
      .from('questions')
      .select(
        'id, subject, topic, subtopic, difficulty, q_type, question_text, options, correct_answer, marks, created_at, image_url, review_status, source',
        { count: 'exact' },
      )
      .eq('is_active', true)
      .range(from, to)
      .order('created_at', { ascending: false });

    // Only approved questions are usable by default; the review queue asks for
    // 'pending' explicitly, and 'all' is available for an unfiltered browse.
    if (filters.review_status === 'all') {
      // no filter
    } else if (filters.review_status) {
      query = query.eq('review_status', filters.review_status);
    } else {
      query = query.eq('review_status', 'approved');
    }

    if (subject) query = query.ilike('subject', this.escapeLike(subject));
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
    if (filters.q_type) {
      query = query.eq('q_type', filters.q_type);
    } else if (filters.exclude_subjective === 'true') {
      query = query.neq('q_type', 'subjective');
    }
    if (filters.topic)
      query = query.ilike('topic', `%${this.escapeLike(filters.topic)}%`);
    if (filters.search)
      query = query.ilike(
        'question_text',
        `%${this.escapeLike(filters.search)}%`,
      );

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

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

  /** Neutralises PostgREST LIKE wildcards so a search for "100%" is not a prefix match. */
  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, (m) => `\\${m}`);
  }

  /**
   * Questions awaiting manual verification — the QA queue for the AI pipeline.
   * Extraction is good but not perfect, so nothing reaches a live test until a
   * human has confirmed the text and answer key.
   */
  async getReviewQueue(
    filters: { subject?: string; page?: number; limit?: number },
    user?: Requester,
  ) {
    return this.findAll({ ...filters, review_status: 'pending' }, user);
  }

  /** Get one question (includes correct_answer — teacher only) */
  async findOne(id: string, user?: Requester) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Question not found');

    const subject = this.scopedSubject(user);
    if (
      subject &&
      String(data.subject).toLowerCase() !== subject.toLowerCase()
    ) {
      throw new ForbiddenException(`You can only view ${subject} questions.`);
    }
    return data;
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  /** Create one question — hand-written questions need no review. */
  async create(body: CreateQuestionDto, user: Requester) {
    const scoped = this.scopedSubject(user);
    if (scoped && String(body.subject).toLowerCase() !== scoped.toLowerCase()) {
      throw new ForbiddenException(`You can only create ${scoped} questions.`);
    }

    // Server-owned columns are set last so the payload cannot override them.
    const { data, error } = await supabase
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
    if (error) throw new Error(error.message);
    return data;
  }

  /** Edit a question */
  async update(id: string, body: UpdateQuestionDto, user?: Requester) {
    await this.assertCanWriteAll([id], user);

    const patch = this.pickWritable(body);
    // A scoped teacher must not be able to move a question out of their subject.
    const scoped = this.scopedSubject(user);
    if (
      scoped &&
      patch.subject &&
      String(patch.subject).toLowerCase() !== scoped.toLowerCase()
    ) {
      throw new ForbiddenException(
        `You can only file questions under ${scoped}.`,
      );
    }

    const { data, error } = await supabase
      .from('questions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Question not found');
    return data;
  }

  /** Soft-delete: set is_active = false */
  async remove(id: string, user?: Requester) {
    await this.assertCanWriteAll([id], user);

    const { error } = await supabase
      .from('questions')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { message: 'Question deleted successfully' };
  }

  /** Duplicate a question */
  async duplicate(id: string, user: Requester) {
    await this.assertCanWriteAll([id], user);

    const { data: original } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (!original) throw new NotFoundException('Question not found');

    // Drop identity/audit columns rather than carrying them onto the copy.
    const {
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      reviewed_by: _reviewedBy,
      reviewed_at: _reviewedAt,
      ...rest
    } = original;

    const { data, error } = await supabase
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

    if (error) throw new Error(error.message);
    return data;
  }

  /** Approve a question (optionally correcting it in the same call). */
  async approve(
    id: string,
    reviewer: Requester,
    corrections?: UpdateQuestionDto,
  ) {
    await this.assertCanWriteAll([id], reviewer);

    const payload: Record<string, any> = {
      ...this.pickWritable(corrections || {}),
      review_status: 'approved',
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('questions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Question not found');
    return data;
  }

  /** Reject a question — kept for audit, but hidden from the bank. */
  async reject(id: string, reviewer: Requester) {
    await this.assertCanWriteAll([id], reviewer);

    const { data, error } = await supabase
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

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Question not found');
    return data;
  }

  /** Approve many at once — the common case after skimming a freshly parsed PDF. */
  async bulkApprove(ids: string[], reviewer: Requester) {
    if (!ids?.length) return { approved: 0 };
    await this.assertCanWriteAll(ids, reviewer);

    let approved = 0;
    for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('questions')
        .update({
          review_status: 'approved',
          reviewed_by: reviewer.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', idChunk)
        .select('id');

      if (error) throw new Error(error.message);
      approved += data?.length || 0;
    }
    return { approved };
  }

  /** Soft-delete many questions in one call (bulk selection in the Question Bank). */
  async bulkRemove(ids: string[], user?: Requester) {
    if (!ids?.length) return { deleted: 0 };
    await this.assertCanWriteAll(ids, user);

    let deleted = 0;
    for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('questions')
        .update({ is_active: false })
        .in('id', idChunk)
        .select('id');

      if (error) throw new Error(error.message);
      deleted += data?.length || 0;
    }
    return { deleted };
  }

  /**
   * Soft-delete every question whose content is stored as an image
   * (i.e. `image_url IS NOT NULL`). These are typically PDF-extracted
   * questions where the question body is the image itself rather than text.
   *
   * The operation is paged via `fetchAll` so it is not capped at Supabase's
   * 1000-row `db-max-rows` default, and the resulting id list is chunked so
   * no single UPDATE URL grows past PostgREST's URL-length limit.
   */
  async deleteImageQuestions(user?: Requester): Promise<{ deleted: number }> {
    // 1. Collect the ids of every active image question.
    const rows = await fetchAll<{ id: string; subject: string }>(() =>
      supabase
        .from('questions')
        .select('id, subject')
        .eq('is_active', true)
        .not('image_url', 'is', null)
        .neq('image_url', ''),
    );

    if (!rows.length) return { deleted: 0 };

    const ids = rows.map((r) => r.id);

    // 2. Honour subject-scoped access for teachers without redundant DB reads.
    const scoped = this.scopedSubject(user);
    if (
      scoped &&
      rows.some((q) => String(q.subject).toLowerCase() !== scoped.toLowerCase())
    ) {
      throw new ForbiddenException(`You can only modify ${scoped} questions.`);
    }

    // 3. Soft-delete in chunks to avoid URL-length errors.
    let deleted = 0;
    for (const idChunk of chunk(ids, ID_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('questions')
        .update({ is_active: false })
        .in('id', idChunk)
        .select('id');

      if (error) throw new Error(error.message);
      deleted += data?.length || 0;
    }

    return { deleted };
  }

  // ── CSV import ──────────────────────────────────────────────────────────────

  /** Validation shared by preview and confirm so a valid preview is never dropped on save. */
  private validateCsvRow(row: any): string[] {
    const problems: string[] = [];
    if (!String(row?.question_text || '').trim())
      problems.push('question is required');

    const answer = row?.correct_answer;
    const validIndex = (value: any) =>
      value !== null &&
      value !== '' &&
      Number.isInteger(Number(value)) &&
      Number(value) >= 0;
    let answerValid = false;
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      if ('index' in answer) {
        answerValid = validIndex(answer.index);
      } else if ('indices' in answer) {
        answerValid =
          Array.isArray(answer.indices) &&
          answer.indices.length > 0 &&
          answer.indices.every((index: any) => validIndex(index));
      } else if ('value' in answer) {
        answerValid =
          (typeof answer.value === 'number' && Number.isFinite(answer.value)) ||
          (typeof answer.value === 'string' && answer.value.trim().length > 0);
      }
    }
    if (!answerValid) problems.push('correct must be A, B, C or D');

    const difficulty = String(row?.difficulty || 'medium')
      .trim()
      .toLowerCase();
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      problems.push('difficulty must be easy, medium or hard');
    }
    if (!String(row?.subject || '').trim())
      problems.push('subject is required');
    if (!String(row?.topic || '').trim()) problems.push('topic is required');
    return problems;
  }

  /** Parse CSV file and return preview rows (does not save to DB yet) */
  async parseCSV(fileBuffer: Buffer, maxRows = 2000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(fileBuffer.toString('utf8'));
      const parser = csvParser();

      parser
        .on('data', (row: any) => {
          // Stop accumulating past the cap rather than buffering an entire
          // arbitrarily large upload in memory.
          if (results.length >= maxRows) return;

          // Expected CSV columns: question,optA,optB,optC,optD,correct,difficulty,subject,topic
          const correctIndex = ['A', 'B', 'C', 'D'].indexOf(
            String(row.correct || '')
              .trim()
              .toUpperCase(),
          );
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

  /** Confirm CSV parse — bulk insert valid rows to DB */
  async bulkInsert(rows: CsvRowDto[], user: Requester) {
    const scoped = this.scopedSubject(user);

    // The preview round-trips through the browser, so re-derive `valid` here
    // rather than trusting the flag that came back with the payload.
    const validRows = (rows || [])
      .filter((r) => this.validateCsvRow(r).length === 0)
      .map((r) => {
        if (
          scoped &&
          String(r.subject).toLowerCase() !== scoped.toLowerCase()
        ) {
          throw new ForbiddenException(
            `You can only import ${scoped} questions.`,
          );
        }
        return {
          ...this.pickWritable(r),
          created_by: user.id,
          is_active: true,
          // CSV rows are author-supplied and already previewed in the UI, so they
          // go straight in as approved — unlike PDF extraction, nothing was guessed.
          source: 'csv',
          review_status: 'approved',
        };
      });

    if (!validRows.length) return { inserted: 0 };

    let inserted = 0;
    for (const batch of chunk(validRows, 500)) {
      const { data, error } = await supabase
        .from('questions')
        .insert(batch)
        .select('id');
      if (error) throw new Error(error.message);
      inserted += data?.length || 0;
    }
    return { inserted };
  }
}
