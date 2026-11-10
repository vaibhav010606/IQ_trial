export interface VerifiedIdentity {
    userId: string;
    email: string;
    metadata: Record<string, any>;
    appMetadata: Record<string, any>;
}
export declare class TokenVerificationError extends Error {
}
export declare function verifySupabaseToken(rawToken: string): Promise<VerifiedIdentity>;
