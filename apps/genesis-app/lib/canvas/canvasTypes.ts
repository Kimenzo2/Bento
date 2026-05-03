/*
 * GENESIS DATA MAP — discovered Phase 0
 *
 * Books table:    books
 *   id:           string (UUID)
 *   title:        string
 *   synopsis:     string
 *   cover_image:  string | null
 *   project_data: JSONB → BookProject
 *   user_id:      string (FK → auth.users)
 *
 * Pages:          NOT a separate table — stored inside project_data
 *   Path:         project_data.chapters[].pages[]
 *   id:           string
 *   pageNumber:   number (sequence)
 *   text:         string (story text)
 *   imagePrompt:  string (visual description / AI prompt)
 *   imageUrl:     string | undefined (Supabase Storage URL, base64, or external)
 *   layoutType:   string
 *   choices:      { text, targetPageNumber }[] (branching)
 *
 * Image URL pattern:
 *   Bucket: page-images (public)
 *   Path:   {userId}/{bookId}/page-{pageNumber}.{png|jpg}
 *   URL:    {VITE_SUPABASE_URL}/storage/v1/object/public/page-images/{path}
 *
 * Realm: NOT stored per book — UI-level concept only
 */

import type { Node, Edge } from '@xyflow/react';

export interface SceneNodeData extends Record<string, unknown> {
  pageId: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  isImageOutdated: boolean;
  onEdit: (pageNumber: number) => void;
}

export type SceneNode = Node<SceneNodeData, 'sceneNode'>;
export type SceneEdge = Edge;

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalOffset: number;
  startX: number;
  startY: number;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  nodeWidth: 240,
  nodeHeight: 300,
  horizontalGap: 80,
  verticalOffset: 40,
  startX: 80,
  startY: 80,
};
