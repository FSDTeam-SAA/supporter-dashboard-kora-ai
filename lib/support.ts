"use client";
// Data layer for the Support workspace. Every call goes through /support-experience.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "./axios";
import { errorMessage } from "./format";

export type Doc = Record<string, unknown> & { _id: string };

export interface SupportContext {
  role: "supporter" | "support_lead";
  teamLead: boolean;
  name: string;
  email: string;
  title: string;
  memberId: string;
  permissions: string[];
  members: { _id: string; user_id: string; name: string; email: string; title?: string; status?: string }[];
}

export interface KoraMessage {
  _id?: string;
  role: "user" | "kora" | "system";
  content: string;
  createdAt?: string;
}
export interface Conversation {
  _id: string;
  title: string;
  folder_id?: string | null;
  pinned?: boolean;
  status?: string;
  lastMessageAt?: string;
  updatedAt?: string;
  messages?: KoraMessage[];
}

export type Preferences = Record<string, string | number | boolean>;

export const supportPath = (path: string) => `/support-experience${path}`;

export async function getSupport<T>(path: string): Promise<T> {
  return (await api.get(supportPath(path))).data.data as T;
}

export function useSupport<T>(path: string, enabled = true, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ["support", path],
    queryFn: () => getSupport<T>(path),
    enabled,
    refetchInterval,
  });
}

export function useSupportMutation<T = Doc>() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: async ({
      path,
      method = "post",
      body,
    }: {
      path: string;
      method?: "post" | "patch" | "put" | "delete";
      body?: unknown;
    }) => (await api.request({ url: supportPath(path), method, data: body })).data.data as T,
    onSuccess: () => {
      q.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export const time = (s?: string | Date) =>
  s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

export const date = (s?: string | Date) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";

export const greeting = (d = new Date()) =>
  d.getHours() < 12 ? "Good morning" : d.getHours() < 18 ? "Good afternoon" : "Good evening";

export const firstName = (name?: string) => String(name || "").trim().split(/\s+/)[0] || "there";
