"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PdfProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfProcessorService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const supabase_config_1 = require("../../config/supabase.config");
const query_util_1 = require("../../common/db/query.util");
const question_dto_1 = require("./dto/question.dto");
const uploads_gateway_1 = require("./uploads.gateway");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const SUPPORTED_EXAM_TYPES = ['jee', 'neet', 'cbse', 'general'];
const EXTRACT_TIMEOUT_MS = 5 * 60 * 1000;
const CLASSIFY_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CHILD_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_QUESTIONS_PER_RUN = 500;
const STALE_TEMP_AGE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_QUESTION_TYPE = 'single_correct';
const PLACEHOLDER_OPTIONS = ['A', 'B', 'C', 'D'];
let PdfProcessorService = PdfProcessorService_1 = class PdfProcessorService {
    uploadsGateway;
    logger = new common_1.Logger(PdfProcessorService_1.name);
    scriptsDir = path.resolve(process.cwd(), 'scripts', 'pdf-processor');
    pythonBin = process.env.PYTHON_BIN ||
        (process.platform === 'win32' ? 'python' : 'python3');
    constructor(uploadsGateway) {
        this.uploadsGateway = uploadsGateway;
    }
    async onModuleInit() {
        const tempRoot = path.resolve(process.cwd(), 'temp');
        let entries;
        try {
            entries = await fs_1.promises.readdir(tempRoot);
        }
        catch {
            return;
        }
        const cutoff = Date.now() - STALE_TEMP_AGE_MS;
        let removed = 0;
        for (const entry of entries) {
            const target = path.join(tempRoot, entry);
            try {
                const stat = await fs_1.promises.stat(target);
                if (!stat.isDirectory() || stat.mtimeMs > cutoff)
                    continue;
                await fs_1.promises.rm(target, { recursive: true, force: true });
                removed += 1;
            }
            catch {
            }
        }
        if (removed)
            this.logger.log(`Cleared ${removed} stale PDF run director(ies).`);
    }
    async processPdf(fileBuffer, teacherId, examType = 'jee') {
        if (!fileBuffer?.length)
            throw new common_1.BadRequestException('No PDF file provided.');
        if (!this.looksLikePdf(fileBuffer)) {
            throw new common_1.BadRequestException('That file is not a PDF.');
        }
        const exam = this.resolveExamType(examType);
        const runId = (0, crypto_1.randomUUID)();
        const report = (stage, message, percent, extra = {}) => {
            try {
                this.uploadsGateway.emitProgress(teacherId, {
                    runId,
                    stage,
                    message,
                    percent,
                    ...extra,
                });
            }
            catch {
            }
        };
        const tempDir = path.resolve(process.cwd(), 'temp', runId);
        const outputDir = path.join(tempDir, 'output');
        const pdfPath = path.join(tempDir, 'exam.pdf');
        try {
            await fs_1.promises.mkdir(outputDir, { recursive: true });
            await fs_1.promises.writeFile(pdfPath, fileBuffer);
            this.logger.log(`Starting PDF Processing Run: ${runId}`);
            report('queued', 'Preparing your document…', 2);
            report('extracting', 'Slicing question images from the PDF…', 10);
            await this.runScript('extract.py', [pdfPath, '--output-dir', outputDir, '--dpi', '200'], EXTRACT_TIMEOUT_MS);
            report('classifying', 'Classifying subjects and topics with AI…', 35);
            await this.runScript('classify.py', [outputDir, '--pdf', pdfPath, '--exam', exam], CLASSIFY_TIMEOUT_MS);
            const manifestPath = path.join(outputDir, 'manifest_classified.json');
            const manifest = await this.readManifest(manifestPath);
            this.logger.log(`Parsed ${manifest.length} questions from manifest.`);
            const dbRows = [];
            const typeCounts = {};
            const bucket = 'question-images';
            const uploadable = manifest.filter((m) => m.classified_path).length || 1;
            let uploadedSoFar = 0;
            report('uploading-images', `Uploading ${uploadable} question image(s)…`, 55, {
                processed: manifest.length,
            });
            for (const item of manifest) {
                if (!item.classified_path)
                    continue;
                const absoluteImagePath = this.resolveInside(outputDir, item.classified_path);
                if (!absoluteImagePath) {
                    this.logger.warn(`Skipping manifest entry with suspicious path: ${item.classified_path}`);
                    continue;
                }
                if (!(await this.exists(absoluteImagePath)))
                    continue;
                const storagePath = `${runId}/${item.classified_path.replace('classified/', '')}`;
                const imageBuffer = await fs_1.promises.readFile(absoluteImagePath);
                const { error: uploadError } = await supabase_config_1.supabase.storage
                    .from(bucket)
                    .upload(storagePath, imageBuffer, {
                    contentType: 'image/png',
                    cacheControl: '31536000',
                    upsert: false,
                });
                if (uploadError) {
                    this.logger.error(`Failed to upload ${storagePath}: ${uploadError.message}`);
                    continue;
                }
                uploadedSoFar += 1;
                report('uploading-images', `Uploaded ${uploadedSoFar} of ${uploadable} images…`, 55 + Math.round((uploadedSoFar / uploadable) * 30));
                const { data: publicUrlData } = supabase_config_1.supabase.storage
                    .from(bucket)
                    .getPublicUrl(storagePath);
                const qType = this.resolveQuestionType(item.question_type);
                typeCounts[qType] = (typeCounts[qType] || 0) + 1;
                dbRows.push({
                    subject: item.subject,
                    topic: item.topic,
                    subtopic: null,
                    difficulty: item.difficulty || 'medium',
                    q_type: qType,
                    question_text: item.extracted_text || 'See attached image.',
                    image_url: publicUrlData.publicUrl,
                    options: qType === 'numerical' ? [] : PLACEHOLDER_OPTIONS,
                    correct_answer: this.buildCorrectAnswer(qType, item),
                    marks: 4,
                    is_active: true,
                    created_by: teacherId,
                    source: 'pdf',
                    review_status: 'pending',
                });
            }
            report('saving', 'Saving questions to the review queue…', 90);
            const insertedCount = await (0, query_util_1.insertInBatches)(dbRows, (batch) => supabase_config_1.supabase.from('questions').insert(batch));
            this.logger.log(`Run ${runId} complete. Inserted ${insertedCount} questions. ` +
                `Types: ${JSON.stringify(typeCounts)}`);
            report('complete', `Done — ${insertedCount} question(s) added to the review queue.`, 100, {
                processed: manifest.length,
                inserted: insertedCount,
                byType: typeCounts,
            });
            return {
                success: true,
                processed: manifest.length,
                inserted: insertedCount,
                byType: typeCounts,
                runId,
            };
        }
        catch (error) {
            this.logger.error(`PDF Processing failed: ${error?.message}`);
            report('failed', 'Processing failed.', -1, { error: error?.message });
            if (error instanceof common_1.BadRequestException)
                throw error;
            throw new common_1.InternalServerErrorException('Failed to process PDF.');
        }
        finally {
            fs_1.promises.rm(tempDir, { recursive: true, force: true }).catch((err) => this.logger.warn(`Failed to cleanup temp dir ${tempDir}: ${err?.message}`));
        }
    }
    resolveExamType(value) {
        const normalised = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!normalised)
            return 'jee';
        if (!SUPPORTED_EXAM_TYPES.includes(normalised)) {
            throw new common_1.BadRequestException(`Unsupported exam type. Expected one of: ${SUPPORTED_EXAM_TYPES.join(', ')}.`);
        }
        return normalised;
    }
    looksLikePdf(buffer) {
        return (buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-');
    }
    resolveQuestionType(value) {
        const normalised = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (question_dto_1.QUESTION_TYPES.includes(normalised))
            return normalised;
        if (normalised) {
            this.logger.warn(`Unrecognised question_type "${normalised}"; storing as ${DEFAULT_QUESTION_TYPE}.`);
        }
        return DEFAULT_QUESTION_TYPE;
    }
    buildCorrectAnswer(qType, item) {
        const indices = Array.isArray(item?.answer_indices)
            ? item.answer_indices
            : [];
        const value = item?.answer_value ?? null;
        if (qType === 'multi_correct')
            return { indices };
        if (qType === 'numerical')
            return { value: value ?? item?.raw_answer ?? null };
        return { index: indices.length ? indices[0] : 0 };
    }
    async runScript(script, args, timeoutMs) {
        const safeScript = path.basename(script);
        const scriptPath = path.join(this.scriptsDir, safeScript);
        this.logger.log(`Executing: ${script} ${args.join(' ')}`);
        try {
            await execFileAsync(this.pythonBin, [scriptPath, ...args], {
                timeout: timeoutMs,
                maxBuffer: MAX_CHILD_OUTPUT_BYTES,
                shell: false,
                windowsHide: true,
            });
        }
        catch (e) {
            if (e?.killed || e?.signal === 'SIGTERM') {
                throw new Error(`${script} timed out after ${Math.round(timeoutMs / 1000)}s`);
            }
            this.logger.error(`${script} failed: ${e?.stderr || e?.message}`);
            throw new Error(`${script} failed`);
        }
    }
    async readManifest(manifestPath) {
        if (!(await this.exists(manifestPath))) {
            throw new Error('Classification manifest not found. Python script failed.');
        }
        let parsed;
        try {
            parsed = JSON.parse(await fs_1.promises.readFile(manifestPath, 'utf8'));
        }
        catch (e) {
            throw new Error(`Classification manifest is not valid JSON: ${e?.message}`);
        }
        if (!Array.isArray(parsed))
            throw new Error('Classification manifest is not an array.');
        if (parsed.length > MAX_QUESTIONS_PER_RUN) {
            throw new common_1.BadRequestException(`That paper produced ${parsed.length} questions, above the ${MAX_QUESTIONS_PER_RUN} per-upload limit. Split it into smaller files.`);
        }
        return parsed;
    }
    resolveInside(root, relative) {
        if (!relative || typeof relative !== 'string')
            return null;
        if (path.isAbsolute(relative))
            return null;
        const parts = relative.split(/[\/\\]/);
        if (parts.includes('..'))
            return null;
        const resolved = path.resolve(root, relative);
        const prefix = path.resolve(root) + path.sep;
        return resolved.startsWith(prefix) ? resolved : null;
    }
    async exists(target) {
        try {
            await fs_1.promises.access(target);
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.PdfProcessorService = PdfProcessorService;
exports.PdfProcessorService = PdfProcessorService = PdfProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [uploads_gateway_1.UploadsGateway])
], PdfProcessorService);
//# sourceMappingURL=pdf-processor.service.js.map