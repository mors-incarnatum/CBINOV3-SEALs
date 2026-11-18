export type UserRole = "PARENT" | "CHILD" | "CAREGIVER";

/** Shared domain data; authentication credentials belong to Supabase Auth. */
export interface User {
    id: string;
    name: string;
    /** Children may not have their own email address. */
    email: string | null;
    role: UserRole;
}
