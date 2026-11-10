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
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
dotenv.config({ path: (0, path_1.resolve)(__dirname, '.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
async function seed() {
    console.log('🌱 Seeding demo users...');
    const usersToCreate = [
        {
            email: 'teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Robert Chen',
            role: 'teacher',
            subject: 'All',
        },
        {
            email: 'student@edu.com',
            password: 'student123',
            full_name: 'Alex Johnson',
            role: 'student',
        },
        {
            email: 'physics_teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Alan Physics',
            role: 'teacher',
            subject: 'Physics',
        },
        {
            email: 'chemistry_teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Marie Chem',
            role: 'teacher',
            subject: 'Chemistry',
        },
        {
            email: 'maths_teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Euler Maths',
            role: 'teacher',
            subject: 'Mathematics',
        },
        {
            email: 'zoology_teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Jane Zoology',
            role: 'teacher',
            subject: 'Biology',
        },
        {
            email: 'botany_teacher@edu.com',
            password: 'teacher123',
            full_name: 'Dr. Gregor Botany',
            role: 'teacher',
            subject: 'Biology',
        },
        {
            email: 'admin@edu.com',
            password: 'admin123',
            full_name: 'Super Admin',
            role: 'admin',
        },
    ];
    for (const u of usersToCreate) {
        console.log(`Processing ${u.email}...`);
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: u.subject ? { subject: u.subject } : {},
        });
        let userId = authData?.user?.id;
        if (authError) {
            const errMsg = authError.message || '';
            if (errMsg.includes('already exists') || errMsg.includes('already registered') || errMsg.includes('already been registered')) {
                console.log(`⚠️ User ${u.email} already exists in auth. Fetching ID...`);
                const { data: existingUsers } = await supabase.auth.admin.listUsers();
                const existing = existingUsers?.users?.find((x) => x.email === u.email);
                if (existing) {
                    userId = existing.id;
                    await supabase.auth.admin.updateUserById(userId, {
                        password: u.password,
                        user_metadata: u.subject ? { subject: u.subject } : {}
                    });
                    console.log(`✅ Password & metadata updated for ${u.email}`);
                }
            }
            else {
                console.error('❌ Error creating', u.email, 'in Auth:', authError.message);
                continue;
            }
        }
        else {
            console.log(`✅ Created ${u.email} in Auth.`);
        }
        if (!userId) {
            console.error(`❌ Could not resolve ID for ${u.email}`);
            continue;
        }
        const { error: dbError } = await supabase
            .from('users')
            .upsert({
            id: userId,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
        }, { onConflict: 'id' });
        if (dbError) {
            console.error('❌ Error upserting', u.email, 'to public.users:', dbError.message);
        }
        else {
            console.log(`✅ Upserted ${u.email} into public.users table.`);
        }
    }
    console.log('🎉 Seeding complete! You can now log in.');
}
seed();
//# sourceMappingURL=seed.js.map