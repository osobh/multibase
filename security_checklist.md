# Supabase Security Checklist

This checklist provides guidance on securing your self-hosted Supabase deployment. Follow these recommendations to ensure your deployment is properly secured.

## Critical Security Steps

- [x] **Generate secure API keys** (Automatically done by setup script)
- [x] **Set custom dashboard credentials** (Prompted during setup)
- [ ] **Configure SMTP settings** for email authentication
- [ ] **Enable Row Level Security (RLS)** on all tables
- [ ] **Create appropriate security policies** for each table
- [ ] **Set up proper authentication** for your application

## Database Security

- [ ] **Review default roles and permissions**
- [ ] **Implement Row Level Security (RLS)** on all tables
  ```sql
  ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
  ```
- [ ] **Create security policies** for each table
  ```sql
  CREATE POLICY "Users can view their own data" ON your_table
    FOR SELECT
    USING (auth.uid() = user_id);
  ```
- [ ] **Restrict public access** to sensitive tables
- [ ] **Use prepared statements** in your application code
- [ ] **Regularly backup your database**

## Authentication Security

- [ ] **Configure SMTP settings** for email authentication
  ```
  SMTP_ADMIN_EMAIL=admin@yourdomain.com
  SMTP_HOST=your-smtp-server.com
  SMTP_PORT=587
  SMTP_USER=your-smtp-username
  SMTP_PASS=your-smtp-password
  SMTP_SENDER_NAME=Your App Name
  ```
- [ ] **Set appropriate password policies**
- [ ] **Enable email verification** for new accounts
- [ ] **Implement MFA** for sensitive applications
- [ ] **Review and restrict third-party OAuth providers**

## API Security

- [ ] **Keep your API keys secure** and never expose them in client-side code
- [ ] **Use the anon key** for unauthenticated public access
- [ ] **Use the service key** only for trusted server environments
- [ ] **Implement proper CORS settings** if needed
- [ ] **Rate limit API requests** to prevent abuse

## Storage Security

- [ ] **Set up RLS policies** for storage buckets
  ```sql
  CREATE POLICY "Public profiles are viewable by everyone" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'public-profiles');
  ```
- [ ] **Restrict file uploads** by type and size
- [ ] **Scan uploaded files** for malware if handling user uploads
- [ ] **Set appropriate CORS policies** for storage buckets

## Network Security

- [ ] **Use HTTPS** for all communications
- [ ] **Set up a firewall** to restrict access to your server
- [ ] **Use a reverse proxy** like Nginx for additional security
- [ ] **Implement IP whitelisting** for admin access
- [ ] **Monitor for suspicious activity**

## Regular Maintenance

- [ ] **Keep Supabase components updated** to the latest versions
- [ ] **Regularly review security policies** as your application evolves
- [ ] **Monitor logs** for suspicious activity
- [ ] **Perform regular security audits**
- [ ] **Test your security measures** with penetration testing

## Additional Resources

- [Supabase Security Documentation](https://supabase.com/docs/guides/auth/security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [Row Level Security in PostgreSQL](https://supabase.com/docs/guides/auth/row-level-security)
