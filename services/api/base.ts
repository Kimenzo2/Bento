import { supabase } from '../supabaseClient';

export interface BaseEntity {
    id: string;
    created_at?: string;
    updated_at?: string;
}

export class BaseApiService<T extends BaseEntity> {
    protected table: string;

    constructor(table: string) {
        this.table = table;
    }

    async getAll(): Promise<T[]> {
        const { data, error } = await supabase
            .from(this.table)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async getById(id: string): Promise<T | null> {
        const { data, error } = await supabase
            .from(this.table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async create(item: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
        const { data, error } = await supabase
            .from(this.table)
            .insert(item)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async update(id: string, updates: Partial<T>): Promise<T> {
        const { data, error } = await supabase
            .from(this.table)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(this.table)
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}
