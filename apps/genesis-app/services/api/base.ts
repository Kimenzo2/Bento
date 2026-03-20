/**
 * @module BaseApiService
 * @description Base API service with ENFORCED security, validation, and resilience
 *
 * ALL database operations go through the middleware layer which enforces:
 * - Input validation via Zod schemas
 * - Security checks (XSS, SQLi, path traversal)
 * - Circuit breaker for resilience
 * - Rate limiting
 * - Audit logging
 */

import { type ZodSchema, z } from 'zod';
import { type AppError, type Result, isOk } from '../errorHandler';
import { logger } from '../logger';
import { supabase } from '../supabaseClient';
import { apiMiddleware, secureDelete, secureMutation, secureQuery } from './middleware';
import { UuidSchema } from './schemas';

export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Result unwrapper - extracts data or throws
 * Use this for backwards compatibility with existing code that expects throws
 */
function unwrapOrThrow<T>(result: Result<T, AppError>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

export class BaseApiService<T extends BaseEntity> {
  protected table: string;

  constructor(table: string) {
    this.table = table;
  }

  /**
   * Get all records - ENFORCED through middleware
   */
  async getAll(): Promise<T[]> {
    const result = await secureQuery<{ data: T[] | null; error: Error | null }>(
      this.table,
      async () => {
        const response = await supabase
          .from(this.table)
          .select('*')
          .order('created_at', { ascending: false });
        return response;
      }
    );

    const response = unwrapOrThrow(result);
    if (response.error) throw response.error;
    return response.data || [];
  }

  /**
   * Get by ID - ENFORCED with UUID validation
   */
  async getById(id: string): Promise<T | null> {
    // Validate ID format first
    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      logger.warn('Invalid ID format rejected', { id, table: this.table });
      throw new Error('Invalid ID format');
    }

    const result = await secureQuery<{ data: T | null; error: Error | null }>(
      this.table,
      async () => {
        const response = await supabase.from(this.table).select('*').eq('id', id).single();
        return response;
      }
    );

    const response = unwrapOrThrow(result);
    if (response.error) throw response.error;
    return response.data;
  }

  /**
   * Create record - ENFORCED with input validation
   */
  async create(item: Omit<T, 'id' | 'created_at' | 'updated_at'>, schema?: ZodSchema): Promise<T> {
    // Use provided schema or a permissive one
    const validationSchema = schema || z.record(z.string(), z.unknown());

    const result = await secureMutation(
      this.table,
      async () => {
        const response = await supabase.from(this.table).insert(item).select().single();
        return response;
      },
      validationSchema,
      item
    );

    const response = unwrapOrThrow(result) as { data: T | null; error: Error | null };
    if (response.error) throw response.error;
    return response.data!;
  }

  /**
   * Update record - ENFORCED with ID and input validation
   */
  async update(id: string, updates: Partial<T>, schema?: ZodSchema): Promise<T> {
    // Validate ID format
    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      throw new Error('Invalid ID format');
    }

    // Use provided schema or a permissive one
    const validationSchema = schema || z.record(z.string(), z.unknown());

    const result = await secureMutation(
      this.table,
      async () => {
        const response = await supabase
          .from(this.table)
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        return response;
      },
      validationSchema,
      updates
    );

    const response = unwrapOrThrow(result) as { data: T | null; error: Error | null };
    if (response.error) throw response.error;
    return response.data!;
  }

  /**
   * Delete record - ENFORCED with ID validation
   */
  async delete(id: string): Promise<void> {
    const result = await secureDelete(
      this.table,
      async () => {
        const response = await supabase.from(this.table).delete().eq('id', id);
        return response;
      },
      id
    );

    const response = unwrapOrThrow(result) as { error: Error | null };
    if (response.error) throw response.error;
  }

  /**
   * Get middleware stats for monitoring
   */
  getMiddlewareStats() {
    return {
      circuitBreakers: apiMiddleware.getCircuitBreakerStats(),
      recentAudit: apiMiddleware.getAuditLogs(10),
      securityViolations: apiMiddleware.getSecurityViolations(),
    };
  }
}
