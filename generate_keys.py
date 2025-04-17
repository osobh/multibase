#!/usr/bin/env python3
"""
Supabase API Key Generator

This script generates secure JWT secrets and API keys for Supabase.
It can update an existing .env file with the new keys.
"""

import os
import sys
import argparse
import secrets
import string
import jwt
import datetime
import re
from pathlib import Path

def generate_jwt_secret(length=40):
    """Generate a secure random string for JWT secret."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_jwt_token(secret, role, expiry_years=10):
    """Generate a JWT token with the given role and expiry."""
    now = datetime.datetime.now()
    iat = int(now.timestamp())
    exp = int((now + datetime.timedelta(days=365 * expiry_years)).timestamp())
    
    payload = {
        "role": role,
        "iss": "supabase",
        "iat": iat,
        "exp": exp
    }
    
    return jwt.encode(payload, secret, algorithm="HS256")

def update_env_file(env_file, jwt_secret, anon_key, service_key):
    """Update the .env file with the new keys."""
    if not os.path.exists(env_file):
        print(f"Error: .env file not found at {env_file}")
        return False
    
    # Create a backup of the original .env file
    backup_file = f"{env_file}.bak.{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    try:
        with open(env_file, 'r') as f:
            original_content = f.read()
        
        with open(backup_file, 'w') as f:
            f.write(original_content)
        
        # Update the keys in the content
        updated_content = re.sub(
            r'^JWT_SECRET=.*$',
            f'JWT_SECRET={jwt_secret}',
            original_content,
            flags=re.MULTILINE
        )
        
        updated_content = re.sub(
            r'^ANON_KEY=.*$',
            f'ANON_KEY={anon_key}',
            updated_content,
            flags=re.MULTILINE
        )
        
        updated_content = re.sub(
            r'^SERVICE_ROLE_KEY=.*$',
            f'SERVICE_ROLE_KEY={service_key}',
            updated_content,
            flags=re.MULTILINE
        )
        
        # Write the updated content back to the .env file
        with open(env_file, 'w') as f:
            f.write(updated_content)
        
        print(f"Created backup of .env file: {backup_file}")
        print(f"Updated .env file with new keys: {env_file}")
        return True
    
    except Exception as e:
        print(f"Error updating .env file: {e}")
        return False

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Generate secure API keys for Supabase")
    parser.add_argument("--env-file", help="Path to .env file to update")
    parser.add_argument("--jwt-length", type=int, default=40, help="Length of JWT secret")
    parser.add_argument("--expiry-years", type=int, default=10, help="Expiry in years for JWT tokens")
    
    args = parser.parse_args()
    
    # Generate JWT secret
    jwt_secret = generate_jwt_secret(args.jwt_length)
    
    # Generate API keys
    anon_key = generate_jwt_token(jwt_secret, "anon", args.expiry_years)
    service_key = generate_jwt_token(jwt_secret, "service_role", args.expiry_years)
    
    # Print the generated keys
    print("\nGenerated Keys:")
    print("=" * 50)
    print(f"JWT Secret: {jwt_secret}")
    print("-" * 50)
    print(f"Anon Key: {anon_key}")
    print("-" * 50)
    print(f"Service Role Key: {service_key}")
    print("=" * 50)
    
    # Update .env file if specified
    if args.env_file:
        update_env_file(args.env_file, jwt_secret, anon_key, service_key)
        print("\nNext Steps:")
        print("1. Restart your Supabase deployment to apply the new keys:")
        print(f"   cd {os.path.dirname(args.env_file)} && docker compose down && docker compose up -d")
        print("2. Update your client applications with the new API keys")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
