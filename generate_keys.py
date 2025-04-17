#!/usr/bin/env python3
"""
Supabase Key Generator

This script generates secure API keys and JWT secrets for Supabase deployments.
It can also update existing .env files with new keys.
"""

import os
import sys
import argparse
import random
import string
import base64
import json
import hmac
import hashlib
import time
from pathlib import Path
import re
from datetime import datetime, timedelta
import shutil

def generate_random_string(length=32):
    """Generate a secure random string of specified length."""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))

def generate_jwt_secret(length=48):
    """Generate a secure JWT secret."""
    return generate_random_string(length)

def create_jwt_token(payload, secret, algorithm="HS256"):
    """Create a JWT token with the given payload and secret."""
    # Create header
    header = {"alg": algorithm, "typ": "JWT"}
    header_json = json.dumps(header, separators=(",", ":")).encode()
    header_b64 = base64.urlsafe_b64encode(header_json).decode().rstrip("=")
    
    # Create payload
    payload_json = json.dumps(payload, separators=(",", ":")).encode()
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode().rstrip("=")
    
    # Create signature
    signature_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(secret.encode(), signature_input, hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    # Combine to create JWT
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def generate_anon_key(jwt_secret):
    """Generate an anonymous API key."""
    # Set expiry to a far future date (10 years from now)
    exp = int((datetime.now() + timedelta(days=3650)).timestamp())
    
    # Create payload for anon key
    payload = {
        "role": "anon",
        "iss": "supabase",
        "iat": int(time.time()),
        "exp": exp
    }
    
    return create_jwt_token(payload, jwt_secret)

def generate_service_key(jwt_secret):
    """Generate a service role API key."""
    # Set expiry to a far future date (10 years from now)
    exp = int((datetime.now() + timedelta(days=3650)).timestamp())
    
    # Create payload for service role key
    payload = {
        "role": "service_role",
        "iss": "supabase",
        "iat": int(time.time()),
        "exp": exp
    }
    
    return create_jwt_token(payload, jwt_secret)

def update_env_file(env_path, jwt_secret, anon_key, service_key):
    """Update an existing .env file with new keys."""
    if not os.path.exists(env_path):
        print(f"Error: .env file not found at {env_path}")
        return False
    
    # Create a backup of the original .env file
    backup_path = f"{env_path}.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    shutil.copy2(env_path, backup_path)
    print(f"Created backup of .env file: {backup_path}")
    
    # Read the current .env file
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    # Update JWT secret and API keys
    env_content = re.sub(
        r'JWT_SECRET=.*',
        f'JWT_SECRET={jwt_secret}',
        env_content
    )
    env_content = re.sub(
        r'ANON_KEY=.*',
        f'ANON_KEY={anon_key}',
        env_content
    )
    env_content = re.sub(
        r'SERVICE_ROLE_KEY=.*',
        f'SERVICE_ROLE_KEY={service_key}',
        env_content
    )
    
    # Write the updated .env file
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print(f"Updated .env file with new keys: {env_path}")
    return True

def generate_keys(args):
    """Generate new keys and optionally update an .env file."""
    # Generate JWT secret
    jwt_secret = generate_jwt_secret()
    
    # Generate API keys
    anon_key = generate_anon_key(jwt_secret)
    service_key = generate_service_key(jwt_secret)
    
    # Display the generated keys
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

def setup_parser():
    """Set up the argument parser."""
    parser = argparse.ArgumentParser(description="Supabase Key Generator")
    parser.add_argument("--env-file", "-e", help="Path to .env file to update with new keys")
    return parser

def main():
    """Main entry point for the Supabase key generator."""
    parser = setup_parser()
    args = parser.parse_args()
    
    return generate_keys(args)

if __name__ == "__main__":
    sys.exit(main())
