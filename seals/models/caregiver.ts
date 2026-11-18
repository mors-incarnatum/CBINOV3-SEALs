import type { User } from "./user";

export interface Caregiver extends User {
    role: "CAREGIVER";
}
