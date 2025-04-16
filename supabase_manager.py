#!/usr/bin/env python3
"""
Supabase Manager Utility

This script provides a command-line interface for managing Supabase projects.
It offers commands for creating, starting, stopping, and resetting projects.
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path
import socket
import psutil
import time
import json

try:
    from supabase_setup import SupabaseProjectGenerator
except ImportError:
    # If the module is not installed, use the local file
    print("Warning: supabase_setup module not found. Using local file.")
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("supabase_setup", "./supabase_setup.py")
        if spec and spec.loader:
            supabase_setup = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(supabase_setup)
            SupabaseProjectGenerator = supabase_setup.SupabaseProjectGenerator
        else:
            raise ImportError("Could not load supabase_setup.py")
    except Exception as e:
        print(f"Error loading supabase_setup.py: {e}")
        print("Please ensure supabase_setup.py is in the current directory.")
        sys.exit(1)

def find_used_ports():
    """Find all currently used ports."""
    used_ports = set()
    
    # Check listening ports using psutil
    for conn in psutil.net_connections(kind='inet'):
        if conn.status == 'LISTEN':
            used_ports.add(conn.laddr.port)
    
    return used_ports

def check_project_exists(project_name):
    """Check if a project directory exists."""
    project_dir = Path(project_name)
    return project_dir.exists() and project_dir.is_dir()

def create_project(args):
    """Create a new Supabase project."""
    if check_project_exists(args.project_name):
        print(f"Error: Project directory '{args.project_name}' already exists.")
        return 1

    # Create a project with the given name and base port
    try:
        generator = SupabaseProjectGenerator(args.project_name, args.base_port)
        generator.run()
        return 0
    except Exception as e:
        print(f"Error creating project: {e}")
        return 1

def start_project(args):
    """Start an existing Supabase project."""
    if not check_project_exists(args.project_name):
        print(f"Error: Project directory '{args.project_name}' does not exist.")
        return 1

    # Change to the project directory
    os.chdir(args.project_name)

    # Run docker compose up
    try:
        cmd = ["docker", "compose", "up", "-d"]
        if args.verbose:
            subprocess.run(cmd)
        else:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        print(f"Project '{args.project_name}' started successfully.")
        
        # Load port information from the .env file
        env_path = Path(".env")
        if env_path.exists():
            ports = {}
            with open(env_path, 'r') as f:
                for line in f:
                    if "PORT=" in line:
                        try:
                            key, value = line.strip().split('=', 1)
                            if key == "KONG_HTTP_PORT":
                                ports["api"] = value
                            elif key == "STUDIO_PORT":
                                ports["studio"] = value
                            elif key == "POSTGRES_PORT":
                                ports["postgres"] = value
                        except ValueError:
                            continue
            
            # Display access URLs
            if "studio" in ports and "api" in ports:
                print("\nYou can access:")
                print(f"- Studio dashboard: http://localhost:{ports['studio']}")
                print(f"- API endpoint: http://localhost:{ports['api']}")
                if "postgres" in ports:
                    print(f"- PostgreSQL on port: {ports['postgres']}")
        return 0
    except Exception as e:
        print(f"Error starting project: {e}")
        return 1

def stop_project(args):
    """Stop a running Supabase project."""
    if not check_project_exists(args.project_name):
        print(f"Error: Project directory '{args.project_name}' does not exist.")
        return 1

    # Change to the project directory
    os.chdir(args.project_name)

    # Run docker compose down
    try:
        cmd = ["docker", "compose", "down"]
        if not args.volumes:
            cmd.append("-v")
        
        if args.verbose:
            subprocess.run(cmd)
        else:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        print(f"Project '{args.project_name}' stopped successfully.")
        return 0
    except Exception as e:
        print(f"Error stopping project: {e}")
        return 1

def reset_project(args):
    """Reset a Supabase project by removing database data."""
    if not check_project_exists(args.project_name):
        print(f"Error: Project directory '{args.project_name}' does not exist.")
        return 1

    # Change to the project directory
    os.chdir(args.project_name)

    # Run the reset script if it exists
    reset_script = Path("reset.sh")
    if reset_script.exists():
        try:
            subprocess.run(["sh", "./reset.sh"], check=True)
            print(f"Project '{args.project_name}' reset successfully.")
            return 0
        except subprocess.CalledProcessError as e:
            print(f"Error executing reset script: {e}")
            return 1
    
    # Manual reset if script doesn't exist
    try:
        # Stop the containers first
        subprocess.run(["docker", "compose", "down", "-v"], 
                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Remove database data
        db_data_dir = Path("volumes/db/data")
        if db_data_dir.exists():
            subprocess.run(["rm", "-rf", str(db_data_dir)])
        
        # Recreate directory
        db_data_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Project '{args.project_name}' reset successfully.")
        return 0
    except Exception as e:
        print(f"Error resetting project: {e}")
        return 1

def status_project(args):
    """Check the status of a Supabase project."""
    if not check_project_exists(args.project_name):
        print(f"Error: Project directory '{args.project_name}' does not exist.")
        return 1

    # Change to the project directory
    os.chdir(args.project_name)

    # Run docker compose ps
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"Error checking project status: {result.stderr}")
            return 1
        
        # Parse the JSON output
        containers = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            try:
                container = json.loads(line)
                containers.append(container)
            except json.JSONDecodeError:
                print(f"Warning: Could not parse container info: {line}")
        
        # Display service status
        print(f"Status of project '{args.project_name}':")
        print("-" * 80)
        print(f"{'Service':<30} {'Status':<15} {'Health':<15} {'Ports':<20}")
        print("-" * 80)
        
        for container in containers:
            name = container.get('Name', 'unknown').replace(f"{args.project_name}-", "")
            status = container.get('State', 'unknown')
            health = container.get('Health', 'N/A')
            ports = container.get('Ports', '')
            
            print(f"{name:<30} {status:<15} {health:<15} {ports:<20}")
        
        return 0
    except Exception as e:
        print(f"Error checking project status: {e}")
        return 1

def list_projects(args):
    """List all Supabase projects in the current directory."""
    projects = []
    
    # Find all directories with a docker-compose.yml file
    for item in os.listdir('.'):
        if os.path.isdir(item) and os.path.exists(os.path.join(item, 'docker-compose.yml')):
            # Check if it's likely a Supabase project
            if os.path.exists(os.path.join(item, 'volumes')) and os.path.exists(os.path.join(item, '.env')):
                projects.append(item)
    
    if not projects:
        print("No Supabase projects found in the current directory.")
        return 0
    
    print("Supabase projects:")
    print("-" * 50)
    for project in projects:
        # Check if project is running
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "--services", "--filter", "status=running"],
                cwd=project,
                capture_output=True,
                text=True
            )
            is_running = result.returncode == 0 and result.stdout.strip() != ""
            status = "Running" if is_running else "Stopped"
        except Exception:
            status = "Unknown"
        
        print(f"{project:<30} {status}")
    
    return 0

def setup_parser():
    """Set up the argument parser."""
    parser = argparse.ArgumentParser(description="Supabase Project Manager")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Create command
    create_parser = subparsers.add_parser("create", help="Create a new Supabase project")
    create_parser.add_argument("project_name", help="Name for the new project")
    create_parser.add_argument("--base-port", "-p", type=int, help="Base port for services")
    
    # Start command
    start_parser = subparsers.add_parser("start", help="Start a Supabase project")
    start_parser.add_argument("project_name", help="Name of the project to start")
    start_parser.add_argument("--verbose", "-v", action="store_true", help="Show verbose output")
    
    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop a Supabase project")
    stop_parser.add_argument("project_name", help="Name of the project to stop")
    stop_parser.add_argument("--keep-volumes", "-k", dest="volumes", action="store_true",
                           help="Keep volumes when stopping")
    stop_parser.add_argument("--verbose", "-v", action="store_true", help="Show verbose output")
    
    # Reset command
    reset_parser = subparsers.add_parser("reset", help="Reset a Supabase project")
    reset_parser.add_argument("project_name", help="Name of the project to reset")
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Check status of a Supabase project")
    status_parser.add_argument("project_name", help="Name of the project to check")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List all Supabase projects")
    
    return parser

def main():
    """Main entry point for the Supabase project manager."""
    parser = setup_parser()
    args = parser.parse_args()
    
    if args.command == "create":
        return create_project(args)
    elif args.command == "start":
        return start_project(args)
    elif args.command == "stop":
        return stop_project(args)
    elif args.command == "reset":
        return reset_project(args)
    elif args.command == "status":
        return status_project(args)
    elif args.command == "list":
        return list_projects(args)
    else:
        parser.print_help()
        return 0

if __name__ == "__main__":
    sys.exit(main())
