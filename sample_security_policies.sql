-- Supabase Sample Security Policies
-- This file contains example Row Level Security (RLS) policies for common use cases.
-- Modify these examples to fit your specific schema and requirements.

-- Enable Row Level Security on all tables
-- =======================================

-- Enable RLS on a profiles table
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on a posts table
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on a comments table
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on a todos table
ALTER TABLE IF EXISTS public.todos ENABLE ROW LEVEL SECURITY;

-- Basic Security Policies
-- ======================

-- 1. Users can view their own profiles
CREATE POLICY IF NOT EXISTS "Users can view their own profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can update their own profiles
CREATE POLICY IF NOT EXISTS "Users can update their own profiles"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Users can view their own posts
CREATE POLICY IF NOT EXISTS "Users can view their own posts"
  ON public.posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Users can create their own posts
CREATE POLICY IF NOT EXISTS "Users can create their own posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can update their own posts
CREATE POLICY IF NOT EXISTS "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Users can delete their own posts
CREATE POLICY IF NOT EXISTS "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Advanced Security Policies
-- =========================

-- 1. Public posts are visible to everyone
CREATE POLICY IF NOT EXISTS "Public posts are visible to everyone"
  ON public.posts
  FOR SELECT
  USING (is_public = true);

-- 2. Users can view comments on their posts
CREATE POLICY IF NOT EXISTS "Users can view comments on their posts"
  ON public.comments
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.posts WHERE id = public.comments.post_id
    )
  );

-- 3. Users can view comments they created
CREATE POLICY IF NOT EXISTS "Users can view comments they created"
  ON public.comments
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Users can create comments on public posts
CREATE POLICY IF NOT EXISTS "Users can create comments on public posts"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE id = public.comments.post_id AND is_public = true
    )
  );

-- 5. Users can create comments on their own posts
CREATE POLICY IF NOT EXISTS "Users can create comments on their own posts"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE id = public.comments.post_id AND user_id = auth.uid()
    )
  );

-- Role-Based Security Policies
-- ===========================

-- 1. Admins can view all profiles
CREATE POLICY IF NOT EXISTS "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 2. Admins can update all profiles
CREATE POLICY IF NOT EXISTS "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 3. Admins can view all posts
CREATE POLICY IF NOT EXISTS "Admins can view all posts"
  ON public.posts
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 4. Admins can update all posts
CREATE POLICY IF NOT EXISTS "Admins can update all posts"
  ON public.posts
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- 5. Admins can delete all posts
CREATE POLICY IF NOT EXISTS "Admins can delete all posts"
  ON public.posts
  FOR DELETE
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Storage Bucket Policies
-- ======================

-- 1. Users can view their own files
CREATE POLICY IF NOT EXISTS "Users can view their own files"
  ON storage.objects
  FOR SELECT
  USING (auth.uid()::text = owner);

-- 2. Users can upload their own files
CREATE POLICY IF NOT EXISTS "Users can upload their own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (auth.uid()::text = owner);

-- 3. Users can update their own files
CREATE POLICY IF NOT EXISTS "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  USING (auth.uid()::text = owner);

-- 4. Users can delete their own files
CREATE POLICY IF NOT EXISTS "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (auth.uid()::text = owner);

-- 5. Public files are viewable by everyone
CREATE POLICY IF NOT EXISTS "Public files are viewable by everyone"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public');

-- Todo App Example
-- ===============

-- 1. Users can view their own todos
CREATE POLICY IF NOT EXISTS "Users can view their own todos"
  ON public.todos
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can create their own todos
CREATE POLICY IF NOT EXISTS "Users can create their own todos"
  ON public.todos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own todos
CREATE POLICY IF NOT EXISTS "Users can update their own todos"
  ON public.todos
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Users can delete their own todos
CREATE POLICY IF NOT EXISTS "Users can delete their own todos"
  ON public.todos
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Users can view shared todos
CREATE POLICY IF NOT EXISTS "Users can view shared todos"
  ON public.todos
  FOR SELECT
  USING (
    auth.uid() = ANY(shared_with)
  );

-- 6. Users can update shared todos
CREATE POLICY IF NOT EXISTS "Users can update shared todos"
  ON public.todos
  FOR UPDATE
  USING (
    auth.uid() = ANY(shared_with)
  );

-- Note: These are example policies. You should adapt them to your specific
-- database schema and application requirements.
