import type { ColorKey, WordClass } from "@/lib/board";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ProfileMemberRole = "editor" | "viewer";
type Table<Row, Required extends keyof Row, Relations extends Relationship[] = []> = {
    Row: Row;
    Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
    Update: Partial<Row>;
    Relationships: Relations;
};
type Relationship = {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
};
type ProfileRelation<Name extends string, One extends boolean = false> = {
    foreignKeyName: Name;
    columns: ["profile_id"];
    isOneToOne: One;
    referencedRelation: "profiles";
    referencedColumns: ["id"];
};

export type ProfileRow = { id: string; owner_id: string; name: string; revision: number };
export type ProfileMembershipRow = {
    profile_id: string;
    user_id: string;
    role: ProfileMemberRole;
};
export type BoardRow = {
    profile_id: string;
    id: string;
    name: string;
    short_name: string;
    color_key: ColorKey;
    icon_name: string | null;
    is_built_in: boolean;
    grid_override: Json | null;
    pages: Json;
};
export type TileRow = {
    profile_id: string;
    id: string;
    kind: "word" | "folder";
    label: string;
    spoken_text: string | null;
    icon_name: string | null;
    media_id: string | null;
    language: string | null;
    is_quick_phrase: boolean;
    category_id: string;
    target_board_id: string | null;
    color_key: ColorKey | null;
    word_class: WordClass | null;
    is_custom: boolean;
};
export type WordRow = {
    profile_id: string;
    id: string;
    label: string;
    spoken_text: string | null;
    icon_name: string | null;
    media_id: string | null;
    language: string | null;
    category_id: string;
    color_key: ColorKey | null;
    word_class: WordClass | null;
    is_custom: boolean;
    is_quick_phrase: boolean;
};
export type ProfileSettingsRow = {
    profile_id: string;
    catalog_order: string[];
    grid_config: Json;
    tile_appearance: Json;
    speech_config: Json;
    access_config: Json;
    feature_flags: Json;
};

/** Schema contract for 20261117000100_board_models.sql + 20261117000200_w07_revisions_media_and_flags.sql + 20261118000100_words_schema.sql (normalized to omit Timestamps and publish_profile_snapshot) */
export type Database = {
    public: {
        Tables: {
            profiles: Table<ProfileRow, "name">;
            profile_memberships: Table<
                ProfileMembershipRow,
                "profile_id" | "user_id",
                [ProfileRelation<"profile_memberships_profile_id_fkey">]
            >;
            boards: Table<
                BoardRow,
                "profile_id" | "id" | "name" | "short_name" | "color_key",
                [ProfileRelation<"boards_profile_id_fkey">]
            >;
            tiles: Table<
                TileRow,
                "profile_id" | "id" | "label" | "category_id",
                [
                    ProfileRelation<"tiles_profile_id_fkey">,
                    {
                        foreignKeyName: "tiles_profile_id_category_id_fkey";
                        columns: ["profile_id", "category_id"];
                        isOneToOne: false;
                        referencedRelation: "boards";
                        referencedColumns: ["profile_id", "id"];
                    },
                    {
                        foreignKeyName: "tiles_profile_id_target_board_id_fkey";
                        columns: ["profile_id", "target_board_id"];
                        isOneToOne: false;
                        referencedRelation: "boards";
                        referencedColumns: ["profile_id", "id"];
                    },
                ]
            >;
            profile_settings: Table<
                ProfileSettingsRow,
                "profile_id",
                [ProfileRelation<"profile_settings_profile_id_fkey", true>]
            >;
            words: Table<
                WordRow,
                "profile_id" | "id" | "label" | "category_id",
                [
                    ProfileRelation<"words_profile_id_fkey">,
                    {
                        foreignKeyName: "words_profile_id_category_id_fkey";
                        columns: ["profile_id", "category_id"];
                        isOneToOne: false;
                        referencedRelation: "boards";
                        referencedColumns: ["profile_id", "id"];
                    },
                ]
            >;
        };
        Views: { [_ in never]: never };
        Functions: { [_ in never]: never };
        Enums: {
            profile_member_role: ProfileMemberRole;
            tile_kind: "word" | "folder";
            board_color: ColorKey;
            word_class: WordClass;
        };
        CompositeTypes: { [_ in never]: never };
    };
};
export type TableName = keyof Database["public"]["Tables"];
export type Row<Name extends TableName> = Database["public"]["Tables"][Name]["Row"];
export type Insert<Name extends TableName> = Database["public"]["Tables"][Name]["Insert"];
export type Update<Name extends TableName> = Database["public"]["Tables"][Name]["Update"];
