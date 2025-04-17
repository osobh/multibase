-- Sample Security Policies for Supabase
-- This file contains examples of Row Level Security (RLS) policies for common use cases

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create policies for the users table
-- Users can only see and update their own data
CREATE POLICY "Users can view their own data" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Create policies for the profiles table
-- Users can see all profiles but only update their own
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policies for the posts table
-- Public posts are viewable by everyone
-- Private posts are only viewable by the author
CREATE POLICY "Public posts are viewable by everyone" 
  ON public.posts 
  FOR SELECT 
  USING (is_public = true);

CREATE POLICY "Private posts are viewable by the author" 
  ON public.posts 
  FOR SELECT 
  USING (auth.uid() = author_id AND is_public = false);

CREATE POLICY "Posts are editable by the author" 
  ON public.posts 
  FOR UPDATE 
  USING (auth.uid() = author_id);

CREATE POLICY "Posts are deletable by the author" 
  ON public.posts 
  FOR DELETE 
  USING (auth.uid() = author_id);

CREATE POLICY "Users can create posts as themselves" 
  ON public.posts 
  FOR INSERT 
  WITH CHECK (auth.uid() = author_id);

-- Create policies for the comments table
-- Comments on public posts are viewable by everyone
-- Comments on private posts are only viewable by the post author and comment author
CREATE POLICY "Comments on public posts are viewable by everyone" 
  ON public.comments 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = comments.post_id AND posts.is_public = true
    )
  );

CREATE POLICY "Comments on private posts are viewable by the post author and comment author" 
  ON public.comments 
  FOR SELECT 
  USING (
    auth.uid() = author_id OR 
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = comments.post_id AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Comments are editable by the author" 
  ON public.comments 
  FOR UPDATE 
  USING (auth.uid() = author_id);

CREATE POLICY "Comments are deletable by the author or the post author" 
  ON public.comments 
  FOR DELETE 
  USING (
    auth.uid() = author_id OR 
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = comments.post_id AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can create comments as themselves" 
  ON public.comments 
  FOR INSERT 
  WITH CHECK (auth.uid() = author_id);

-- Example of a policy for a multi-tenant application
-- Each tenant can only access their own data
CREATE POLICY "Tenants can only access their own data" 
  ON public.tenant_data 
  USING (tenant_id = auth.jwt() -> 'tenant_id');

-- Example of a policy for role-based access
-- Admins can see all data, regular users can only see their own
CREATE POLICY "Admins can see all data" 
  ON public.sensitive_data 
  FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Users can only see their own data" 
  ON public.sensitive_data 
  FOR SELECT 
  USING (
    auth.jwt() ->> 'role' != 'admin' AND 
    user_id = auth.uid()
  );

-- Example of time-based policies
-- Data is only accessible during business hours
CREATE POLICY "Data is only accessible during business hours" 
  ON public.business_data 
  FOR SELECT 
  USING (
    EXTRACT(HOUR FROM NOW()) BETWEEN 9 AND 17 AND
    EXTRACT(DOW FROM NOW()) BETWEEN 1 AND 5
  );

-- Example of location-based policies
-- Data is only accessible from certain IP ranges
-- Note: This requires additional setup to capture client IP
CREATE POLICY "Data is only accessible from certain IP ranges" 
  ON public.location_restricted_data 
  FOR SELECT 
  USING (
    client_ip() <<= '192.168.1.0/24'
  );

-- Example of data masking policies
-- Sensitive data is masked for regular users
CREATE POLICY "Sensitive data is masked for regular users" 
  ON public.customer_data 
  FOR SELECT 
  USING (true)
  WITH CHECK (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE masked_data = true
    END
  );

-- Example of hierarchical access policies
-- Managers can see data for their direct reports
CREATE POLICY "Managers can see data for their direct reports" 
  ON public.employee_data 
  FOR SELECT 
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.manager_id = auth.uid() AND employees.id = employee_data.employee_id
    )
  );

-- Example of data classification policies
-- Users can only access data with a classification level less than or equal to their clearance
CREATE POLICY "Users can only access data with appropriate clearance" 
  ON public.classified_data 
  FOR SELECT 
  USING (
    data_classification <= (auth.jwt() ->> 'clearance_level')::int
  );

-- Example of dynamic policies using stored procedures
-- This allows for more complex policy logic
CREATE OR REPLACE FUNCTION public.check_access(record_id uuid)
RETURNS boolean AS $$
DECLARE
  has_access boolean;
BEGIN
  -- Complex logic to determine access
  SELECT EXISTS (
    SELECT 1 FROM public.access_control
    WHERE user_id = auth.uid() AND resource_id = record_id
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Dynamic access control" 
  ON public.protected_resources 
  FOR SELECT 
  USING (public.check_access(id));

-- Example of policies for file storage
-- Users can only access their own files
CREATE POLICY "Users can access their own files" 
  ON storage.objects 
  FOR SELECT 
  USING (auth.uid()::text = owner);

CREATE POLICY "Users can upload their own files" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (auth.uid()::text = owner);

CREATE POLICY "Users can update their own files" 
  ON storage.objects 
  FOR UPDATE 
  USING (auth.uid()::text = owner);

CREATE POLICY "Users can delete their own files" 
  ON storage.objects 
  FOR DELETE 
  USING (auth.uid()::text = owner);

-- Example of policies for shared resources
-- Resources can be accessed by their owner or anyone they're shared with
CREATE POLICY "Resources can be accessed by owner or shared users" 
  ON public.shared_resources 
  FOR SELECT 
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.resource_shares
      WHERE resource_shares.resource_id = shared_resources.id
      AND resource_shares.shared_with_id = auth.uid()
    )
  );

-- Example of policies for audit logging
-- All changes are logged with user information
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by
  ) VALUES (
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    TG_OP,
    CASE 
      WHEN TG_OP = 'INSERT' THEN NULL
      ELSE to_jsonb(OLD)
    END,
    CASE 
      WHEN TG_OP = 'DELETE' THEN NULL
      ELSE to_jsonb(NEW)
    END,
    auth.uid()
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the audit trigger to tables
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- Example of implementing a soft delete policy
-- Records are never truly deleted, just marked as deleted
CREATE POLICY "Soft deleted records are hidden" 
  ON public.soft_delete_table 
  FOR SELECT 
  USING (deleted_at IS NULL);

CREATE POLICY "Only admins can see deleted records" 
  ON public.soft_delete_table 
  FOR SELECT 
  USING (
    deleted_at IS NOT NULL AND
    auth.jwt() ->> 'role' = 'admin'
  );

-- Instead of allowing DELETE, use UPDATE to set deleted_at
CREATE POLICY "Users can soft delete their own records" 
  ON public.soft_delete_table 
  FOR UPDATE 
  USING (
    auth.uid() = user_id AND
    (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  );

-- Example of implementing a data retention policy
-- Data older than a certain date is automatically archived
CREATE POLICY "Users can only see data within retention period" 
  ON public.time_sensitive_data 
  FOR SELECT 
  USING (
    created_at > (CURRENT_DATE - INTERVAL '1 year')
  );

-- Example of implementing a data anonymization policy
-- Personal data is anonymized for certain users
CREATE POLICY "Personal data is anonymized for non-admins" 
  ON public.personal_data 
  FOR SELECT 
  USING (true)
  WITH CHECK (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'admin' THEN true
      ELSE anonymized = true
    END
  );

-- Example of implementing a data export policy
-- Only certain users can export data
CREATE POLICY "Only authorized users can export data" 
  ON public.exportable_data 
  FOR SELECT 
  USING (
    auth.jwt() ->> 'can_export' = 'true'
  );

-- Example of implementing a data import policy
-- Only certain users can import data
CREATE POLICY "Only authorized users can import data" 
  ON public.importable_data 
  FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'can_import' = 'true'
  );

-- Example of implementing a data quality policy
-- Data must meet certain quality standards
CREATE POLICY "Data must meet quality standards" 
  ON public.quality_controlled_data 
  FOR INSERT 
  WITH CHECK (
    quality_score >= 0.8
  );

-- Example of implementing a data ownership transfer policy
-- Only the owner can transfer ownership
CREATE POLICY "Only the owner can transfer ownership" 
  ON public.transferable_data 
  FOR UPDATE 
  USING (
    auth.uid() = owner_id AND
    OLD.owner_id != NEW.owner_id
  );

-- Example of implementing a data access request policy
-- Users can request access to data they don't own
CREATE POLICY "Users can request access to data" 
  ON public.access_requests 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = requester_id
  );

-- Example of implementing a data access approval policy
-- Only owners can approve access requests
CREATE POLICY "Only owners can approve access requests" 
  ON public.access_requests 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.protected_data
      WHERE protected_data.id = access_requests.data_id
      AND protected_data.owner_id = auth.uid()
    ) AND
    OLD.status = 'pending' AND
    NEW.status IN ('approved', 'rejected')
  );
