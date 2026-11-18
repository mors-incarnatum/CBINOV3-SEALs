"use client";
import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import {
    uid,
    type Tile,
    type CellKey,
    type ColorKey,
    type WordClass,
    type LanguageTag,
} from "@/lib/board";
import { mediaRepository, validateAndProcessPhoto } from "@/services/storage/mediaRepository";
import { useSentenceContext } from "./useBoardShellViewModel";

export interface TileEditorTarget {
    boardId: string;
    page?: number;
    cell?: CellKey;
    tile?: Tile;
    multi?: boolean;
    onClose: () => void;
}

export function useTileEditorViewModel(target: TileEditorTarget) {
    const tiles = useBoardStore(s => s.tiles);
    const boards = useBoardStore(s => s.boards);
    const order = useBoardStore(s => s.catalogOrder);
    const activeProfileId = useBoardStore(s => s.activeProfileId);
    const upsert = useBoardStore(s => s.upsertTile);
    const assign = useBoardStore(s => s.assignSlot);
    const add = useBoardStore(s => s.addWordsToCatalog);
    const createCatalog = useBoardStore(s => s.createCatalog);
    const sentence = useSentenceContext();

    const [tab, setTab] = useState(
        target.tile?.kind === "folder" ? "folder" : target.tile ? "custom" : "existing",
    );
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [picked, setPicked] = useState<string[]>([]);
    const [preview, setPreview] = useState<Tile>(
        target.tile ?? {
            id: `custom-${uid()}`,
            kind: "word",
            label: "",
            spokenText: "",
            language: "fil",
            categoryId: target.boardId === "home" ? order[0] : target.boardId,
            iconName: null,
            mediaId: null,
            isCustom: true,
        },
    );
    const [folderName, setFolderName] = useState("");
    const [cropSquare, setCropSquare] = useState(true);
    const [photoError, setPhotoError] = useState("");
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const uncommittedMediaIds = useRef<Set<string>>(new Set());
    const profileIdRef = useRef(activeProfileId);

    useEffect(() => {
        profileIdRef.current = activeProfileId;
    }, [activeProfileId]);

    useEffect(() => {
        const pendingMediaIds = uncommittedMediaIds.current;
        return () => {
            for (const id of pendingMediaIds) {
                void mediaRepository.removeMedia(profileIdRef.current, id);
            }
            pendingMediaIds.clear();
        };
    }, []);

    const patch = (value: Partial<Tile>) => setPreview(p => ({ ...p, ...value }));

    const removeUncommittedMedia = (mediaId: string | null | undefined) => {
        if (mediaId && uncommittedMediaIds.current.has(mediaId)) {
            void mediaRepository.removeMedia(activeProfileId, mediaId);
            uncommittedMediaIds.current.delete(mediaId);
        }
    };

    const saveTile = (tile: Tile) => {
        if (tile.mediaId) {
            uncommittedMediaIds.current.delete(tile.mediaId);
        }
        upsert(tile);
        if (target.cell) {
            assign(target.boardId, target.page ?? 0, target.cell, tile.id);
        } else {
            add(target.boardId, [tile.id]);
        }
        target.onClose();
    };

    const words = Object.values(tiles).filter(
        t =>
            t.kind === "word" &&
            t.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
            (filter === "all" ||
                t.categoryId === filter ||
                boards[filter]?.pages.some(p => Object.values(p.cells).some(c => c?.tileId === t.id))),
    );

    const uploadPhoto = async (file: File | null | undefined) => {
        if (!file) return;
        setPhotoError("");
        setUploadingPhoto(true);
        try {
            const processed = await validateAndProcessPhoto(file, cropSquare);
            if (!processed.ok) {
                setPhotoError(processed.error);
                return;
            }
            const newMediaId = `media-${uid()}`;
            const saved = await mediaRepository.saveMedia(activeProfileId, newMediaId, processed.data.blob, {
                mimeType: processed.data.mimeType,
                width: processed.data.width,
                height: processed.data.height,
            });
            if (!saved.ok) {
                setPhotoError(saved.error ?? "Failed to save photo.");
                return;
            }
            removeUncommittedMedia(preview.mediaId);
            uncommittedMediaIds.current.add(newMediaId);
            patch({ mediaId: newMediaId });
        } finally {
            setUploadingPhoto(false);
        }
    };

    const removePhoto = () => {
        setPhotoError("");
        removeUncommittedMedia(preview.mediaId);
        patch({ mediaId: null });
    };

    return {
        state: {
            tab,
            query,
            filter,
            picked,
            preview,
            folderName,
            words,
            catalogs: order.map(id => boards[id]).filter(Boolean),
            canSave: preview.label.trim().length > 0,
            cropSquare,
            photoError,
            uploadingPhoto,
        },
        actions: {
            setTab,
            setQuery,
            setFilter,
            setFolderName,
            setCropSquare,
            patch,
            setColor: (colorKey: ColorKey) => patch({ colorKey }),
            setWordClass: (wordClass: WordClass) => patch({ wordClass }),
            setLanguage: (language: LanguageTag) => patch({ language }),
            uploadPhoto,
            removePhoto,
            chooseWord: (tile: Tile) => {
                setPreview(tile);
                if (target.multi) {
                    setPicked(ids =>
                        ids.includes(tile.id) ? ids.filter(id => id !== tile.id) : [...ids, tile.id],
                    );
                }
            },
            saveExisting: () => {
                if (target.multi) {
                    add(target.boardId, picked);
                    target.onClose();
                } else if (preview.label) {
                    saveTile(preview);
                }
            },
            saveCustom: () => {
                if (preview.label.trim()) {
                    const { targetBoardId: _ignoredTarget, ...rest } = preview;
                    void _ignoredTarget;
                    saveTile({ ...rest, label: preview.label.trim(), kind: "word" });
                }
            },
            chooseFolder: (id: string) => {
                const b = boards[id];
                setPreview({
                    id: `folder-${uid()}`,
                    kind: "folder",
                    label: b.name,
                    categoryId: id,
                    targetBoardId: id,
                    iconName: b.iconName,
                });
            },
            saveFolder: () => {
                if (preview.kind === "folder") saveTile(preview);
            },
            createFolder: () => {
                if (!folderName.trim()) return;
                const id = createCatalog({
                    name: folderName,
                    colorKey: preview.colorKey ?? "teal",
                    iconName: null,
                });
                if (!id) return;
                setPreview({
                    id: `folder-${uid()}`,
                    kind: "folder",
                    label: folderName.trim(),
                    categoryId: id,
                    targetBoardId: id,
                    iconName: null,
                });
                setFolderName("");
            },
            testSpeak: () => sentence.actions.testSpeak(preview.spokenText || preview.label),
        },
    };
}
