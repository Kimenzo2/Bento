import { invoke } from '@tauri-apps/api/core';

export interface ObjectRow {
	id: string;
	type: string;
	layout: string;
	name: string | null;
	icon: string | null;
	cover: string | null;
	isFavorite: boolean;
	isArchived: boolean;
	isDeleted: boolean;
	createdAt: number;
	updatedAt: number;
	spaceId: string | null;
	details: string | null;
}

export interface BlockRow {
	id: string;
	objectId: string;
	parentId?: string | null;
	type: string;
	content: string;
	fields: string;
	align: number;
	bgColor: string;
	position: number;
	createdAt: number;
	updatedAt: number;
}

export interface BlockAddResult {
	blockId: string;
	objectId: string;
}

export interface ObjectMeta {
	id: string;
	isFavorite: boolean;
	isArchived: boolean;
	createdAt: string;
	updatedAt: string;
}

/**
 * Error class for adapter-level failures.
 * Preserves the original backend error message for debugging.
 */
export class AdapterError extends Error {
	constructor(
		public readonly operation: string,
		message: string,
		public readonly cause?: unknown,
	) {
		super(`[${operation}] ${message}`);
		this.name = 'AdapterError';
	}
}

/**
 * Creates a typed CRUD adapter for any app using the local-store backend.
 * Each item in an app is stored as a single local-store object.
 * The app's data is stored as JSON in the object's `details` field.
 *
 * All methods return typed errors via AdapterError so callers can handle
 * failures gracefully instead of crashing.
 *
 * Apps can store data in two patterns:
 * 1. **Single-object** — whole app state is one object's `details` JSON.
 *    Use `getById(id)` / `replace(id, data)` / `remove(id)`.
 * 2. **Multi-object** — each item is its own object.
 *    Use `getByType()` / `create(item)` / `remove(id)`.
 */
export function createAppAdapter<T extends Record<string, any>>(objectType: string) {
	return {
		objectType,

		/** Fetch a single object by its UUID (single-object pattern) */
		async getById(id: string): Promise<(ObjectMeta & T) | null> {
			try {
				const rows = await invoke<ObjectRow[]>('local_store_get_objects', {
					typeFilter: objectType,
					layoutFilter: null,
				});
				const row = rows.find((r) => r.id === id);
				if (!row) return null;
				try {
					return {
						id: row.id,
						isFavorite: row.isFavorite,
						isArchived: row.isArchived,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
						...JSON.parse(row.details || '{}'),
					} as unknown as (ObjectMeta & T);
				} catch {
					return {
						id: row.id,
						isFavorite: row.isFavorite,
						isArchived: row.isArchived,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
					} as unknown as (ObjectMeta & T);
				}
			} catch (err) {
				throw new AdapterError('getById', `Failed to fetch ${objectType} object ${id}`, err);
			}
		},

		/** Fetch all objects of this type (multi-object pattern) */
		async getByType(): Promise<(ObjectMeta & T)[]> {
			return this.getAll();
		},

		/** Fetch all objects of this type from the backend */
		async getAll(): Promise<(ObjectMeta & T)[]> {
			try {
				const rows = await invoke<ObjectRow[]>('local_store_get_objects', {
					typeFilter: objectType,
					layoutFilter: null,
				});
				return rows.map((r) => {
					try {
						return {
							id: r.id,
							isFavorite: r.isFavorite,
							isArchived: r.isArchived,
							createdAt: r.createdAt,
							updatedAt: r.updatedAt,
							...JSON.parse(r.details || '{}'),
						} as unknown as (ObjectMeta & T);
					} catch {
						// Corrupted details JSON — return object with empty details
						return {
							id: r.id,
							isFavorite: r.isFavorite,
							isArchived: r.isArchived,
							createdAt: r.createdAt,
							updatedAt: r.updatedAt,
						} as unknown as (ObjectMeta & T);
					}
				});
			} catch (err) {
				throw new AdapterError('getAll', `Failed to fetch ${objectType} objects`, err);
			}
		},

		/** Create a new object and return its ID */
		async create(data: T, id?: string): Promise<string> {
			const objectId = id ?? crypto.randomUUID();
			try {
				await invoke('local_store_create_object', { objectId, objectType });
				if (Object.keys(data).length > 0) {
					await invoke('local_store_update_object', {
						params: {
							id: objectId,
							details: data as any,
						},
					});
				}
				return objectId;
			} catch (err) {
				throw new AdapterError('create', `Failed to create ${objectType} object`, err);
			}
		},

		/** Update an object's details (merges with existing) */
		async update(id: string, data: Partial<T>): Promise<void> {
			try {
				const rows = await invoke<ObjectRow[]>('local_store_get_objects', {
					typeFilter: objectType,
					layoutFilter: null,
				});
				const existing = rows.find((r) => r.id === id);
				const currentDetails = existing
					? (() => { try { return JSON.parse(existing.details || '{}'); } catch { return {}; } })()
					: {};
				const merged = { ...currentDetails, ...data };
				await invoke('local_store_update_object', {
					params: {
						id,
						details: merged as any,
					},
				});
			} catch (err) {
				throw new AdapterError('update', `Failed to update ${objectType} object ${id}`, err);
			}
		},

		/** Replace an object's details entirely */
		async replace(id: string, data: T): Promise<void> {
			try {
				await invoke('local_store_update_object', {
					params: {
						id,
						details: data as any,
					},
				});
			} catch (err) {
				throw new AdapterError('replace', `Failed to replace ${objectType} object ${id}`, err);
			}
		},

		/** Archive/delete an object */
		async remove(id: string): Promise<void> {
			try {
				await invoke('local_store_delete_object', { objectId: id });
			} catch (err) {
				throw new AdapterError('remove', `Failed to delete ${objectType} object ${id}`, err);
			}
		},

		/** Toggle favorite */
		async toggleFavorite(id: string): Promise<void> {
			try {
				await invoke('local_store_toggle_favorite', { objectId: id });
			} catch (err) {
				throw new AdapterError('toggleFavorite', `Failed to toggle favorite on ${objectType} object ${id}`, err);
			}
		},

		/** Search objects by query */
		async search(query: string): Promise<(ObjectMeta & T)[]> {
			try {
				const rows = await invoke<ObjectRow[]>('local_store_search_objects', {
					query,
					typeFilter: objectType,
				});
				return rows.map((r) => {
					try {
						return {
							id: r.id,
							isFavorite: r.isFavorite,
							isArchived: r.isArchived,
							createdAt: r.createdAt,
							updatedAt: r.updatedAt,
							...JSON.parse(r.details || '{}'),
						} as unknown as (ObjectMeta & T);
					} catch {
						return {
							id: r.id,
							isFavorite: r.isFavorite,
							isArchived: r.isArchived,
							createdAt: r.createdAt,
							updatedAt: r.updatedAt,
						} as unknown as (ObjectMeta & T);
					}
				});
			} catch (err) {
				throw new AdapterError('search', `Failed to search ${objectType} objects`, err);
			}
		},
	};
}
