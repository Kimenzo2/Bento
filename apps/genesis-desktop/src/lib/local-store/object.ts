// ═══════════════════════════════════════════════════════════════════════
// ANYTYPE OBJECT / RELATION TYPES — Verified Transcription from anytype-ts
// Source: src/ts/interface/object.ts + src/ts/interface/block/dataview.ts
// ═══════════════════════════════════════════════════════════════════════
// TRANSCRIPTION RULE: Copied verbatim. Only environment changes:
//   - Removed React import (MouseEvent from 'react')
//   - Removed I.* namespace self-references
//   - Re-exported ObjectLayout, RelationType from block.ts for clarity
// ═══════════════════════════════════════════════════════════════════════

import {
	type Block,
	type Sort,
	type Filter,
	type FilterCondition,
	type FilterOperator,
	type FilterQuickOption,
	ObjectLayout,
	RelationType,
	type ViewRelation,
	type View,
	ViewType,
	SortType,
	BlockHAlign,
} from './block';

// ─── ObjectLayout ─────────────────────────────────────────────────────
// Re-exported from block.ts for convenience.
// Source: interface/object.ts — enum ObjectLayout
// Note: For Notes, use Layout.Note. For Tasks, use Layout.Task.

export { ObjectLayout, RelationType };

// ─── Detail Interface ─────────────────────────────────────────────────
// Source: interface/object.ts — represents an object's property/relation value
// Constructed from Anytype's detail store pattern (src/ts/store/detail.ts)

export interface ObjectDetail {
	id: string;
	details: Record<string, any>;
};

// ─── RelationScope ────────────────────────────────────────────────────
// Source: interface/object.ts — enum RelationScope

export enum RelationScope {
	Object             = 0,
	Type               = 1,
	SetOfTheSameType   = 2,
	ObjectsOfTheSameType = 3,
	Library            = 4,
}

// ─── ObjectFlag ───────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectFlag

export enum ObjectFlag {
	DeleteEmpty    = 0,
	SelectTemplate = 2,
}

// ─── ObjectOrigin ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum ObjectOrigin

export enum ObjectOrigin {
	None              = 0,
	Clipboard         = 1,
	DragAndDrop       = 2,
	Import            = 3,
	Webclipper        = 4,
	SharingExtension  = 5,
	Usecase           = 6,
	Builtin           = 7,
	Bookmark          = 8,
	Api               = 9,
}

// ─── ImageKind ────────────────────────────────────────────────────────
// Source: interface/object.ts — enum ImageKind

export enum ImageKind {
	Basic              = 0,
	Cover              = 1,
	Icon               = 2,
	AutomaticallyAdded = 3,
}

// ─── LayoutFormat ─────────────────────────────────────────────────────
// Source: interface/object.ts — enum LayoutFormat

export enum LayoutFormat {
	Page = 0,
	List = 1,
}

// ─── FeaturedRelationLayout ───────────────────────────────────────────
// Source: interface/object.ts — enum FeaturedRelationLayout

export enum FeaturedRelationLayout {
	Inline = 0,
	Column = 1,
}

// ─── FilterCondition ──────────────────────────────────────────────────
// Re-export from block.ts

export type { FilterCondition };

// ─── FilterOperator ───────────────────────────────────────────────────
// Re-export from block.ts

export type { FilterOperator };

// ─── FilterQuickOption ────────────────────────────────────────────────
// Re-export from block.ts

export type { FilterQuickOption };

// ─── SortType ─────────────────────────────────────────────────────────
// Re-export from block.ts

export { SortType };

// ─── ViewType ─────────────────────────────────────────────────────────
// Re-export from block.ts

export { ViewType };

// ─── BlockHAlign ──────────────────────────────────────────────────────
// Re-export from block.ts

export { BlockHAlign };

// ─── Object Tree Structure ────────────────────────────────────────────
// Convenience types built from Anytype's patterns

export interface ObjectTree {
	objectId: string;
	typeId: string;
	layout: ObjectLayout;
	name: string;
	icon: string;
	cover: string;
	blocks: Block[];
	isArchived: boolean;
	isDeleted: boolean;
	createdAt: number;
	updatedAt: number;
	spaceId: string;
	relations: Record<string, any>;
}

export interface ObjectSummary {
	id: string;
	name: string;
	layout: ObjectLayout;
	icon: string;
	snippet: string;
	createdAt: number;
	updatedAt: number;
	isArchived: boolean;
	isDeleted: boolean;
	typeId?: string;
}

// ─── Relation helpers ─────────────────────────────────────────────────
// Derived from Anytype's relation system

export interface Relation {
	id: string;
	key: string;
	name: string;
	type: RelationType;
	objectId: string;
	spaceId: string;
	isReadonly?: boolean;
	isHidden?: boolean;
}

export interface RelationValue {
	relationKey: string;
	value: any;
	format?: RelationType;
}

// ─── Task-specific relations (from Anytype's Task layout) ─────────────
// These relation keys match what Anytype uses for Task objects

export const TASK_RELATION_KEYS = {
	DUE_DATE: 'dueDate',
	PRIORITY: 'priority',
	STATUS: 'status',
	TAGS: 'tags',
	ASSIGNEE: 'assignee',
	ESTIMATED_TIME: 'estimatedTime',
	COMPLETED_TIME: 'completedTime',
	REPEAT: 'repeat',
	RELATED_OBJECTS: 'relatedObjects',
} as const;

// ─── Journal-specific relation ────────────────────────────────────────

export const JOURNAL_RELATION_KEYS = {
	DATE: 'date',
	MOOD: 'mood',
	WEATHER: 'weather',
	TAGS: 'tags',
} as const;
