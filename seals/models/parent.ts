import type { User } from "./user";

export interface Parent extends User {
    role: "PARENT";
}
