import type { DirectoryUser, Role, UserRow } from "@repo/shared";

import { api } from "./client";

export interface UserQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: Role;
  isActive?: "true" | "false";
}

export const listUsers = (query: UserQuery) =>
  api.page<UserRow>("/users", query as Record<string, unknown>);

export const listDirectory = (): Promise<DirectoryUser[]> => api.get<DirectoryUser[]>("/users/directory");

export const createUser = (body: { name: string; email: string; role: Role; password: string }) =>
  api.post<UserRow>("/users", body);

export const updateUser = (
  id: string,
  body: { name?: string; role?: Role; isActive?: boolean; password?: string },
) => api.patch<UserRow>(`/users/${id}`, body);
