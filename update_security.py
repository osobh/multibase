#!/usr/bin/env python3
"""
Supabase Security Update Tool

This script updates existing Supabase deployments with enhanced security settings.
"""

import os
import sys
import argparse
import random
import string
from pathlib import Path
import re
import shutil
from datetime import datetime

def check_project_exists(project_path):
    """Check if a project directory exists and is a Supabase project."""
    project_dir = Path(project_path)
    
    if not project_dir.exists() or not project_dir.is_dir():
        return False
    
    # Check for key files that indicate a Supabase project
    docker_compose = project_dir / "docker-compose.yml"
    env_file = project_dir / ".env"
    volumes_dir = project_dir / "volumes"
    
    return docker_compose.exists() and env_file.exists() and volumes_dir.exists()

def get_dashboard_credentials(project_name):
    """Prompt user for dashboard credentials"""
    print("\nSetup Dashboard Access Credentials")
    print("-" * 40)
    username = input("Enter dashboard username (min 4 chars) [supabase]: ").strip()
    if not username:
        username = "supabase"
    while len(username) < 4:
        print("Username must be at least 4 characters")
        username = input("Enter dashboard username: ").strip()
    
    password = input(f"Enter dashboard password (min 8 chars) [{project_name}]: ").strip()
    if not password:
        password = project_name
    while len(password) < 8:
        print("Password must be at least 8 characters")
        password = input("Enter dashboard password: ").strip()
    
    print(f"\nDashboard credentials set: {username} / {'*' * len(password)}")
    return {
        'username': username,
        'password': password
    }

def update_env_file(project_path, dashboard_credentials):
    """Update the .env file with new security settings."""
    env_path = Path(project_path) / ".env"
    
    if not env_path.exists():
        print(f"Error: .env file not found in {project_path}")
        return False
    
    # Create a backup of the original .env file
    backup_path = env_path.with_suffix(f".env.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}")
    shutil.copy2(env_path, backup_path)
    print(f"Created backup of .env file: {backup_path}")
    
    # Read the current .env file
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    # Update dashboard credentials
    env_content = re.sub(
        r'DASHBOARD_USERNAME=.*',
        f'DASHBOARD_USERNAME={dashboard_credentials["username"]}',
        env_content
    )
    env_content = re.sub(
        r'DASHBOARD_PASSWORD=.*',
        f'DASHBOARD_PASSWORD={dashboard_credentials["password"]}',
        env_content
    )
    
    # Update email and phone auth settings
    env_content = re.sub(
        r'ENABLE_EMAIL_AUTOCONFIRM=.*',
        'ENABLE_EMAIL_AUTOCONFIRM=true',
        env_content
    )
    env_content = re.sub(
        r'ENABLE_PHONE_SIGNUP=.*',
        'ENABLE_PHONE_SIGNUP=false',
        env_content
    )
    env_content = re.sub(
        r'ENABLE_PHONE_AUTOCONFIRM=.*',
        'ENABLE_PHONE_AUTOCONFIRM=false',
        env_content
    )
    
    # Write the updated .env file
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print("Updated .env file with new security settings")
    return True

def update_kong_config(project_path):
    """Update the Kong configuration with security enhancements."""
    kong_path = Path(project_path) / "volumes" / "api" / "kong.yml"
    
    if not kong_path.exists():
        print(f"Error: Kong configuration file not found at {kong_path}")
        return False
    
    # Create a backup of the original kong.yml file
    backup_path = kong_path.with_suffix(f".yml.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}")
    shutil.copy2(kong_path, backup_path)
    print(f"Created backup of Kong configuration: {backup_path}")
    
    # Read the current kong.yml file
    with open(kong_path, 'r') as f:
        kong_content = f.read()
    
    # Check if rate limiting is already configured
    if "rate-limiting" not in kong_content:
        # Add rate limiting to auth-v1 service
        kong_content = kong_content.replace(
            "  - name: auth-v1\n    url: http://auth:9999/verify\n    routes:\n      - name: auth-v1-route\n        paths:\n          - /auth/v1/verify\n    plugins:\n      - name: cors",
            "  - name: auth-v1\n    url: http://auth:9999/verify\n    routes:\n      - name: auth-v1-route\n        paths:\n          - /auth/v1/verify\n    plugins:\n      - name: cors\n        config:\n          origins: [\"http://localhost:*\"]\n          methods: [\"GET\", \"POST\", \"PUT\", \"DELETE\", \"OPTIONS\"]\n          headers: [\"Authorization\", \"Content-Type\"]\n          credentials: true\n      - name: rate-limiting\n        config:\n          minute: 100\n          policy: local"
        )
    
    # Write the updated kong.yml file
    with open(kong_path, 'w') as f:
        f.write(kong_content)
    
    print("Updated Kong configuration with security enhancements")
    return True

def create_security_checklist(project_path):
    """Create a security checklist file."""
    project_name = Path(project_path).name
    checklist_path = Path(project_path) / "security_checklist.md"
    
    checklist_content = f"""# Security Checklist for {project_name}

This checklist provides guidance on securing your Supabase deployment.

## Critical Security Items

- [x] Dashboard credentials have been customized
- [ ] JWT secret has been changed from default
- [ ] API keys have been rotated
- [ ] Database password has been changed
- [ ] SMTP server has been configured (if using email auth)

## Network Security

- [ ] Firewall rules are in place to restrict access
- [ ] SSL/TLS is configured for production
- [x] Rate limiting is enabled
- [x] CORS is properly configured

## Database Security

- [ ] Row-level security policies are in place
- [ ] Connection pooler is properly configured
- [ ] Database backups are configured
- [ ] Postgres roles have appropriate permissions

## Authentication

- [x] Email autoconfirm is enabled for development
- [x] Phone authentication is disabled (unless needed)
- [ ] Anonymous access is restricted
- [ ] JWT expiry is set appropriately

## Storage

- [ ] File size limits are configured
- [ ] Storage permissions are properly set
- [ ] S3 configuration is secure (if using S3)

## Monitoring

- [ ] Logging is properly configured
- [ ] Analytics server is secured
- [ ] Alerts are set up for suspicious activity

## Before Going to Production

1. Change all default passwords and secrets
2. Configure proper SSL/TLS
3. Set up database backups
4. Review and update RLS policies
5. Configure proper SMTP server
6. Review API key permissions
7. Set up monitoring and alerts
"""
    
    with open(checklist_path, 'w') as f:
        f.write(checklist_content)
    
    print(f"Created security checklist: {checklist_path}")
    return True

def update_project_security(project_path):
    """Update the security settings for a Supabase project."""
    if not check_project_exists(project_path):
        print(f"Error: {project_path} is not a valid Supabase project")
        return False
    
    project_name = Path(project_path).name
    print(f"\nUpdating security for Supabase project: {project_name}")
    print("=" * 50)
    
    # Get dashboard credentials
    dashboard_credentials = get_dashboard_credentials(project_name)
    
    # Update .env file
    if not update_env_file(project_path, dashboard_credentials):
        return False
    
    # Update Kong configuration
    if not update_kong_config(project_path):
        return False
    
    # Create security checklist
    if not create_security_checklist(project_path):
        return False
    
    print("\nSecurity update completed successfully!")
    print("\nNext Steps:")
    print("1. Review the security_checklist.md file")
    print("2. Restart your Supabase deployment:")
    print(f"   cd {project_path} && docker compose down && docker compose up -d")
    print("3. Test the updated security settings")
    
    return True

def setup_parser():
    """Set up the argument parser."""
    parser = argparse.ArgumentParser(description="Supabase Security Update Tool")
    parser.add_argument("project_path", help="Path to the Supabase project to update")
    return parser

def main():
    """Main entry point for the Supabase security update tool."""
    parser = setup_parser()
    args = parser.parse_args()
    
    if update_project_security(args.project_path):
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())
