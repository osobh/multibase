#!/usr/bin/env python3
"""
Supabase Security Test Script

This script tests the security of a Supabase deployment by checking various security settings.
"""

import os
import sys
import argparse
import requests
import json
import re
from pathlib import Path
import socket
import time

def check_port_open(host, port, timeout=2):
    """Check if a port is open on the given host."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    result = sock.connect_ex((host, port))
    sock.close()
    return result == 0

def check_env_file(project_path):
    """Check the .env file for security issues."""
    env_path = Path(project_path) / ".env"
    
    if not env_path.exists():
        print("❌ .env file not found")
        return False
    
    print("\n🔍 Checking .env file...")
    issues = []
    
    # Read the .env file
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    # Check for default credentials
    if "DASHBOARD_USERNAME=supabase" in env_content and "DASHBOARD_PASSWORD=supabase" in env_content:
        issues.append("Default dashboard credentials (supabase/supabase) are being used")
    
    # Check for default JWT secret
    jwt_secret_match = re.search(r'JWT_SECRET=([^\n]+)', env_content)
    if jwt_secret_match:
        jwt_secret = jwt_secret_match.group(1)
        if len(jwt_secret) < 32:
            issues.append(f"JWT secret is too short ({len(jwt_secret)} chars, should be at least 32)")
    else:
        issues.append("JWT_SECRET not found in .env file")
    
    # Check for default API keys
    if "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" in env_content:
        issues.append("Default API keys are being used")
    
    # Check for email autoconfirm in development
    if "ENABLE_EMAIL_AUTOCONFIRM=false" in env_content:
        issues.append("Email autoconfirm is disabled, which may cause issues in development")
    
    # Check for phone auth (should be disabled by default)
    if "ENABLE_PHONE_SIGNUP=true" in env_content:
        issues.append("Phone authentication is enabled, which may pose security risks")
    
    # Report findings
    if issues:
        print("❌ Security issues found in .env file:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ No security issues found in .env file")
        return True

def check_kong_config(project_path):
    """Check the Kong configuration for security issues."""
    kong_path = Path(project_path) / "volumes" / "api" / "kong.yml"
    
    if not kong_path.exists():
        print("❌ Kong configuration file not found")
        return False
    
    print("\n🔍 Checking Kong configuration...")
    issues = []
    
    # Read the Kong configuration
    with open(kong_path, 'r') as f:
        kong_content = f.read()
    
    # Check for rate limiting
    if "rate-limiting" not in kong_content:
        issues.append("Rate limiting is not configured")
    
    # Check for CORS configuration
    if "cors" in kong_content:
        if "origins" not in kong_content:
            issues.append("CORS is configured but origins are not specified")
    else:
        issues.append("CORS is not configured")
    
    # Report findings
    if issues:
        print("❌ Security issues found in Kong configuration:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ No security issues found in Kong configuration")
        return True

def check_api_security(project_path):
    """Check the API security by making requests to the API."""
    env_path = Path(project_path) / ".env"
    
    if not env_path.exists():
        print("❌ .env file not found")
        return False
    
    # Read the .env file to get the API port
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    # Extract the Kong HTTP port
    kong_port_match = re.search(r'KONG_HTTP_PORT=(\d+)', env_content)
    if not kong_port_match:
        print("❌ KONG_HTTP_PORT not found in .env file")
        return False
    
    kong_port = int(kong_port_match.group(1))
    
    # Check if the API is running
    if not check_port_open('localhost', kong_port):
        print(f"❌ API not running on port {kong_port}")
        return False
    
    print(f"\n🔍 Checking API security on port {kong_port}...")
    issues = []
    
    # Test rate limiting
    try:
        print("  Testing rate limiting...")
        for i in range(110):  # Make 110 requests to trigger rate limiting
            response = requests.get(f"http://localhost:{kong_port}/rest/v1/", timeout=1)
            if response.status_code == 429:
                print(f"  ✅ Rate limiting triggered after {i+1} requests")
                break
            time.sleep(0.05)  # Small delay to avoid overwhelming the server
        else:
            issues.append("Rate limiting not triggered after 110 requests")
    except requests.exceptions.RequestException as e:
        print(f"  ⚠️ Error testing rate limiting: {e}")
    
    # Test CORS headers
    try:
        print("  Testing CORS headers...")
        response = requests.options(
            f"http://localhost:{kong_port}/rest/v1/",
            headers={"Origin": "http://example.com"},
            timeout=1
        )
        if "Access-Control-Allow-Origin" in response.headers:
            print("  ✅ CORS headers are present")
        else:
            issues.append("CORS headers are not present")
    except requests.exceptions.RequestException as e:
        print(f"  ⚠️ Error testing CORS headers: {e}")
    
    # Report findings
    if issues:
        print("❌ Security issues found in API:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ No security issues found in API")
        return True

def check_security_checklist(project_path):
    """Check if the security checklist file exists and has been updated."""
    checklist_path = Path(project_path) / "security_checklist.md"
    
    if not checklist_path.exists():
        print("❌ Security checklist file not found")
        return False
    
    print("\n🔍 Checking security checklist...")
    
    # Read the checklist file
    with open(checklist_path, 'r') as f:
        checklist_content = f.read()
    
    # Count the number of checked items
    checked_items = checklist_content.count("- [x]")
    total_items = checklist_content.count("- [")
    
    print(f"  Security checklist completion: {checked_items}/{total_items} items checked")
    
    if checked_items < 5:
        print("❌ Security checklist has too few items checked")
        return False
    else:
        print("✅ Security checklist has been reviewed")
        return True

def test_security(args):
    """Test the security of a Supabase deployment."""
    project_path = args.project_path
    
    if not os.path.exists(project_path) or not os.path.isdir(project_path):
        print(f"Error: Project directory '{project_path}' does not exist.")
        return False
    
    print(f"Testing security for Supabase project: {os.path.basename(project_path)}")
    print("=" * 50)
    
    # Run security checks
    env_secure = check_env_file(project_path)
    kong_secure = check_kong_config(project_path)
    api_secure = check_api_security(project_path) if args.test_api else True
    checklist_reviewed = check_security_checklist(project_path)
    
    # Summarize results
    print("\n" + "=" * 50)
    print("Security Test Results:")
    print("=" * 50)
    print(f"Environment Variables: {'✅ Secure' if env_secure else '❌ Issues Found'}")
    print(f"Kong Configuration: {'✅ Secure' if kong_secure else '❌ Issues Found'}")
    if args.test_api:
        print(f"API Security: {'✅ Secure' if api_secure else '❌ Issues Found'}")
    print(f"Security Checklist: {'✅ Reviewed' if checklist_reviewed else '❌ Not Reviewed'}")
    
    # Overall assessment
    all_secure = env_secure and kong_secure and api_secure and checklist_reviewed
    print("\nOverall Assessment:")
    if all_secure:
        print("✅ Your Supabase deployment appears to be properly secured!")
    else:
        print("❌ Security issues were found. Please address them before deploying to production.")
    
    return all_secure

def setup_parser():
    """Set up the argument parser."""
    parser = argparse.ArgumentParser(description="Supabase Security Test Tool")
    parser.add_argument("project_path", help="Path to the Supabase project to test")
    parser.add_argument("--skip-api", dest="test_api", action="store_false",
                      help="Skip API security tests (useful if the API is not running)")
    return parser

def main():
    """Main entry point for the Supabase security test tool."""
    parser = setup_parser()
    args = parser.parse_args()
    
    if test_security(args):
        return 0
    else:
        return 1

if __name__ == "__main__":
    sys.exit(main())
