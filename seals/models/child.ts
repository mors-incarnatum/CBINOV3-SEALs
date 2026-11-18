import type { User } from "./user";

export interface Child extends User {
    role: "CHILD";
}
