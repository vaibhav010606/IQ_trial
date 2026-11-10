import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { supabase } from '../../config/supabase.config';
import {
  verifySupabaseToken,
  TokenVerificationError,
} from '../auth/supabase-jwt';

const SUBJECT_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const subjectCache = new Map<string, { subject: string; expiresAt: number }>();

function pruneSubjectCache(now: number) {
  for (const [key, val] of subjectCache.entries()) {
    if (val.expiresAt <= now) {
      subjectCache.delete(key);
    }
  }
}

/**
 * SupabaseAuthGuard
 * Validates the Bearer JWT token on every protected route.
 * The token signature is cryptographically verified (see common/auth/supabase-jwt.ts)
 * before any claim is trusted, then the role is loaded from public.users.
 * Attaches the full user object (id, email, role, full_name) to req.user.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header. Format: "Bearer <token>"',
      );
    }

    const token = authHeader.slice('Bearer '.length);

    let identity: Awaited<ReturnType<typeof verifySupabaseToken>>;
    try {
      identity = await verifySupabaseToken(token);
    } catch (e) {
      throw new UnauthorizedException(
        e instanceof TokenVerificationError
          ? e.message
          : 'Invalid or malformed token.',
      );
    }

    // ── Fetch the user's role from public.users table (service role = no RLS) ──
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('full_name, role')
      .eq('id', identity.userId)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedException(
        'User profile not found. Contact support.',
      );
    }

    // A teacher's subject scopes what they may edit, so it is read from
    // app_metadata, which only the service role can write. user_metadata is
    // editable by the user themselves (supabase.auth.updateUser) — trusting it
    // let a teacher set their subject to "All" and step outside their scope.
    // The user_metadata fallback only serves accounts created before the move;
    // scripts/backfill_subject_app_metadata.js migrates them.
    let subject = identity.appMetadata?.subject;
    if (!subject) {
      const cached = subjectCache.get(identity.userId);
      if (cached && cached.expiresAt > Date.now()) {
        subject = cached.subject;
      } else {
        const { data } = await supabase.auth.admin.getUserById(identity.userId);
        subject =
          data?.user?.app_metadata?.subject ||
          data?.user?.user_metadata?.subject ||
          'All';
        const now = Date.now();
        if (subjectCache.size >= MAX_CACHE_ENTRIES) {
          pruneSubjectCache(now);
          if (subjectCache.size >= MAX_CACHE_ENTRIES) {
            const firstKey = subjectCache.keys().next().value;
            if (firstKey) subjectCache.delete(firstKey);
          }
        }
        subjectCache.set(identity.userId, {
          subject,
          expiresAt: now + SUBJECT_CACHE_TTL_MS,
        });
      }
    }

    // Attach user info to the request — accessible via @CurrentUser() decorator
    request.user = {
      id: identity.userId,
      email: identity.email,
      role: profile.role,
      full_name: profile.full_name,
      subject,
    };

    return true;
  }
}
