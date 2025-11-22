import { supabase } from './supabase'
import type { BookProject } from '../types'

/**
 * Save a project to Supabase
 */
export const saveProject = async (project: BookProject) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Insert or update project
    const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .upsert({
            id: project.id,
            user_id: user.id,
            title: project.title,
            synopsis: project.synopsis,
            style: project.style,
            tone: project.tone,
            target_audience: project.targetAudience,
            is_branching: project.isBranching,
            brand_profile: project.brandProfile,
            style_guide: project.styleGuide,
            character_sheets: project.characterSheets,
            status: 'draft',
        })
        .select()
        .single()

    if (projectError) throw projectError

    // Save chapters and pages
    for (const chapter of project.chapters) {
        const { data: chapterData, error: chapterError } = await supabase
            .from('chapters')
            .upsert({
                id: chapter.id,
                project_id: project.id,
                title: chapter.title,
                chapter_number: project.chapters.indexOf(chapter) + 1,
            })
            .select()
            .single()

        if (chapterError) throw chapterError

        // Save pages
        for (const page of chapter.pages) {
            const { error: pageError } = await supabase
                .from('pages')
                .upsert({
                    id: page.id,
                    chapter_id: chapter.id,
                    project_id: project.id,
                    page_number: page.pageNumber,
                    text: page.text,
                    image_prompt: page.imagePrompt,
                    image_url: page.imageUrl,
                    layout_type: page.layoutType,
                    choices: page.choices,
                })

            if (pageError) throw pageError
        }
    }

    // Save characters
    for (const character of project.characters) {
        const { error: characterError } = await supabase
            .from('characters')
            .upsert({
                id: character.id,
                project_id: project.id,
                name: character.name,
                description: character.description,
                visual_traits: character.visualTraits,
                reference_image_url: character.imageUrl,
            })

        if (characterError) throw characterError
    }

    return projectData
}

/**
 * Load a project from Supabase
 */
export const loadProject = async (projectId: string): Promise<BookProject | null> => {
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
      *,
      chapters (
        *,
        pages (*)
      ),
      characters (*)
    `)
        .eq('id', projectId)
        .single()

    if (projectError) throw projectError
    if (!project) return null

    // Transform to BookProject format
    return {
        id: project.id,
        title: project.title,
        synopsis: project.synopsis || '',
        style: project.style as any,
        tone: project.tone as any,
        targetAudience: project.target_audience || '',
        isBranching: project.is_branching,
        brandProfile: project.brand_profile,
        styleGuide: project.style_guide,
        characterSheets: project.character_sheets,
        chapters: project.chapters.map((ch: any) => ({
            id: ch.id,
            title: ch.title,
            pages: ch.pages.map((p: any) => ({
                id: p.id,
                pageNumber: p.page_number,
                text: p.text || '',
                imagePrompt: p.image_prompt || '',
                imageUrl: p.image_url,
                layoutType: p.layout_type,
                choices: p.choices || [],
            })),
        })),
        characters: project.characters.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            visualTraits: c.visual_traits,
            imageUrl: c.reference_image_url,
        })),
        createdAt: new Date(project.created_at),
    }
}

/**
 * Get all projects for current user
 */
export const getUserProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string) => {
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

    if (error) throw error
}

/**
 * Upload image to Supabase Storage
 */
export const uploadImage = async (
    base64Image: string,
    projectId: string,
    pageNumber: number
): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Convert base64 to blob
    const base64Data = base64Image.split(',')[1]
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then(r => r.blob())

    const fileName = `${user.id}/${projectId}/page-${pageNumber}.png`

    const { data, error } = await supabase.storage
        .from('page-images')
        .upload(fileName, blob, {
            upsert: true,
            contentType: 'image/png',
        })

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('page-images')
        .getPublicUrl(fileName)

    return publicUrl
}

/**
 * Track generation usage
 */
export const trackGeneration = async (
    type: 'blueprint' | 'character' | 'style_guide' | 'image' | 'pdf',
    projectId?: string,
    tokensUsed?: number
) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('generations').insert({
        user_id: user.id,
        project_id: projectId,
        type,
        tokens_used: tokensUsed,
    })
}

/**
 * Update user subscription
 */
export const updateSubscription = async (
    tier: 'spark' | 'creator' | 'studio' | 'empire',
    months: number = 1
) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + months)

    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_tier: tier,
            subscription_expires_at: expiresAt.toISOString(),
        })
        .eq('id', user.id)

    if (error) throw error
}

/**
 * Record payment transaction
 */
export const recordTransaction = async (
    paystackReference: string,
    amount: number,
    tier: 'spark' | 'creator' | 'studio' | 'empire',
    months: number = 1
) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        paystack_reference: paystackReference,
        amount,
        currency: 'USD',
        status: 'pending',
        subscription_tier: tier,
        subscription_months: months,
    })

    if (error) throw error
}
