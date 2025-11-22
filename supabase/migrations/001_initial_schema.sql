-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('spark', 'creator', 'studio', 'empire');
CREATE TYPE generation_type AS ENUM ('blueprint', 'character', 'style_guide', 'image', 'pdf');
CREATE TYPE project_status AS ENUM ('draft', 'generating', 'completed', 'archived');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier subscription_tier DEFAULT 'spark',
    subscription_expires_at TIMESTAMPTZ,
    total_books_created INTEGER DEFAULT 0,
    total_pages_generated INTEGER DEFAULT 0,
    total_images_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    synopsis TEXT,
    style TEXT NOT NULL, -- ArtStyle enum value
    tone TEXT NOT NULL, -- BookTone enum value
    target_audience TEXT,
    page_count INTEGER DEFAULT 12,
    is_branching BOOLEAN DEFAULT FALSE,
    status project_status DEFAULT 'draft',
    
    -- JSON metadata
    brand_profile JSONB,
    style_guide JSONB,
    character_sheets JSONB[],
    color_palette JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Chapters table
CREATE TABLE public.chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(project_id, chapter_number)
);

-- Pages table
CREATE TABLE public.pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    
    -- Content
    text TEXT,
    image_prompt TEXT,
    image_url TEXT, -- Supabase Storage URL
    layout_type TEXT NOT NULL DEFAULT 'full-bleed',
    
    -- Interactive features
    choices JSONB, -- Array of {text, targetPageNumber}
    
    -- Metadata
    scene_description TEXT,
    character_action TEXT,
    mood TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(project_id, page_number)
);

-- Characters table
CREATE TABLE public.characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    description TEXT,
    
    -- Visual identity
    visual_traits JSONB,
    visual_identity JSONB,
    reference_image_url TEXT, -- Supabase Storage URL
    style_enforcement TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(project_id, name)
);

-- Generation history (for tracking API usage and billing)
CREATE TABLE public.generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    
    type generation_type NOT NULL,
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),
    
    -- Request/Response metadata
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Paystack details
    paystack_reference TEXT UNIQUE NOT NULL,
    paystack_transaction_id TEXT,
    
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending', -- pending, success, failed
    
    -- Subscription details
    subscription_tier subscription_tier,
    subscription_months INTEGER DEFAULT 1,
    
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX idx_pages_project_id ON public.pages(project_id);
CREATE INDEX idx_pages_chapter_id ON public.pages(chapter_id);
CREATE INDEX idx_pages_page_number ON public.pages(page_number);

CREATE INDEX idx_characters_project_id ON public.characters(project_id);

CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Projects: Users can only access their own projects
CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- Chapters: Users can access chapters of their projects
CREATE POLICY "Users can view own chapters" ON public.chapters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = chapters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own chapters" ON public.chapters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = chapters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own chapters" ON public.chapters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = chapters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own chapters" ON public.chapters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = chapters.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Pages: Users can access pages of their projects
CREATE POLICY "Users can view own pages" ON public.pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pages.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own pages" ON public.pages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pages.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own pages" ON public.pages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pages.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own pages" ON public.pages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pages.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Characters: Users can access characters of their projects
CREATE POLICY "Users can view own characters" ON public.characters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = characters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own characters" ON public.characters
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = characters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own characters" ON public.characters
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = characters.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own characters" ON public.characters
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = characters.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Generations: Users can only see their own generation history
CREATE POLICY "Users can view own generations" ON public.generations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" ON public.generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_projects
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_pages
    BEFORE UPDATE ON public.pages
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_transactions
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to increment user stats
CREATE OR REPLACE FUNCTION public.increment_user_stats(
    p_user_id UUID,
    p_books INTEGER DEFAULT 0,
    p_pages INTEGER DEFAULT 0,
    p_images INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        total_books_created = total_books_created + p_books,
        total_pages_generated = total_pages_generated + p_pages,
        total_images_generated = total_images_generated + p_images
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
