"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseMock = exports.SupabaseMock = void 0;
class SupabaseMock {
    results = new Map();
    calls = [];
    reset() {
        this.results.clear();
        this.calls = [];
    }
    queueResult(table, result) {
        if (!this.results.has(table))
            this.results.set(table, []);
        this.results.get(table).push(result);
        return this;
    }
    nextResult(table) {
        const queue = this.results.get(table);
        if (!queue?.length)
            return { data: null, error: null };
        return queue.shift();
    }
    from(table) {
        const self = this;
        let currentOp = 'select';
        let payload;
        let columns;
        const settle = () => {
            self.calls.push({ table, op: currentOp, payload, columns });
            const result = self.nextResult(table);
            return Promise.resolve({
                data: result.data ?? null,
                error: result.error ?? null,
                count: result.count ?? null,
            });
        };
        const builder = {
            select: (cols, opts) => {
                if (typeof cols === 'string')
                    columns = cols;
                if (opts?.head)
                    currentOp = 'count';
                return builder;
            },
            insert: (rows) => {
                currentOp = 'insert';
                payload = rows;
                return builder;
            },
            update: (row) => {
                currentOp = 'update';
                payload = row;
                return builder;
            },
            upsert: (rows) => {
                currentOp = 'upsert';
                payload = rows;
                return builder;
            },
            delete: () => {
                currentOp = 'delete';
                return builder;
            },
            eq: () => builder,
            neq: () => builder,
            in: () => builder,
            is: () => builder,
            or: () => builder,
            ilike: () => builder,
            like: () => builder,
            lt: () => builder,
            gt: () => builder,
            lte: () => builder,
            gte: () => builder,
            order: () => builder,
            range: () => builder,
            limit: () => builder,
            single: () => settle(),
            maybeSingle: () => settle(),
            then: (resolve, reject) => settle().then(resolve, reject),
        };
        return builder;
    }
    storage = {
        from: () => ({
            upload: jest.fn().mockResolvedValue({ data: { path: 'x' }, error: null }),
            getPublicUrl: jest
                .fn()
                .mockReturnValue({ data: { publicUrl: 'https://cdn.test/x.png' } }),
        }),
    };
    auth = {
        admin: {
            signOut: jest.fn().mockResolvedValue({ error: null }),
            updateUserById: jest.fn().mockResolvedValue({ error: null }),
            createUser: jest
                .fn()
                .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
            deleteUser: jest.fn().mockResolvedValue({ error: null }),
        },
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn(),
        resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
        getUser: jest.fn(),
    };
}
exports.SupabaseMock = SupabaseMock;
exports.supabaseMock = new SupabaseMock();
//# sourceMappingURL=supabase-mock.js.map