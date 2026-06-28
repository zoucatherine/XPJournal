import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface StickyNoteRecord {
  id: string;
  content: string;
  color: string;
  posX: number;
  posY: number;
  sizeW: number | null;
  sizeH: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStickyNoteInput {
  id: string;
  content?: string;
  color?: string;
  posX?: number;
  posY?: number;
  sizeW?: number | null;
  sizeH?: number | null;
}

export interface UpdateStickyNoteInput {
  content?: string;
  color?: string;
  posX?: number;
  posY?: number;
  sizeW?: number | null;
  sizeH?: number | null;
}

export const NOTES_QUERY_KEY = ["notes"] as const;

export async function listNotes(): Promise<StickyNoteRecord[]> {
  return customFetch<StickyNoteRecord[]>("/api/notes", { method: "GET" });
}

export async function createNote(input: CreateStickyNoteInput): Promise<StickyNoteRecord> {
  return customFetch<StickyNoteRecord>("/api/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateNote(id: string, input: UpdateStickyNoteInput): Promise<StickyNoteRecord> {
  return customFetch<StickyNoteRecord>(`/api/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteNote(id: string): Promise<void> {
  return customFetch<void>(`/api/notes/${id}`, { method: "DELETE" });
}

export function useListNotes(
  options?: Omit<UseQueryOptions<StickyNoteRecord[]>, "queryKey" | "queryFn">,
) {
  return useQuery<StickyNoteRecord[]>({
    queryKey: NOTES_QUERY_KEY,
    queryFn: listNotes,
    ...options,
  });
}

export function useCreateNote(
  options?: UseMutationOptions<StickyNoteRecord, unknown, CreateStickyNoteInput>,
) {
  const queryClient = useQueryClient();
  return useMutation<StickyNoteRecord, unknown, CreateStickyNoteInput>({
    mutationFn: createNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
    ...options,
  });
}

export function useUpdateNote(
  options?: UseMutationOptions<StickyNoteRecord, unknown, { id: string; input: UpdateStickyNoteInput }>,
) {
  const queryClient = useQueryClient();
  return useMutation<StickyNoteRecord, unknown, { id: string; input: UpdateStickyNoteInput }>({
    mutationFn: ({ id, input }) => updateNote(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
    ...options,
  });
}

export function useDeleteNote(
  options?: UseMutationOptions<void, unknown, string>,
) {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY }),
    ...options,
  });
}
