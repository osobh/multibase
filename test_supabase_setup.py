#!/usr/bin/env python3
"""
Test script for debugging Supabase setup issues.
"""

import os
import sys
from pathlib import Path
from supabase_setup import SupabaseProjectGenerator

def main():
    print("Starting test...")
    
    # Create a test project in a specific location
    project_path = "test_output/testproject6"
    print(f"Creating project at: {project_path}")
    
    # Create the parent directory
    parent_dir = Path("test_output")
    parent_dir.mkdir(exist_ok=True)
    print(f"Parent directory created: {parent_dir}")
    
    try:
        print("Before initializing generator...")
        
        # Initialize the generator with debug mode
        print("Creating SupabaseProjectGenerator...")
        generator = SupabaseProjectGenerator(project_path)
        print(f"Generator initialized.")
        print(f"Project dir: {generator.project_dir}")
        print(f"Project name: {generator.project_name}")
        print(f"Base port: {generator.base_port}")
        print(f"CORS origins config: {generator.cors_origins_config}")
        print(f"Origin: {generator.origin}")
        
        # Check if the project directory exists before running
        project_dir_before = Path(project_path)
        if project_dir_before.exists():
            print(f"Project directory already exists before running: {project_dir_before}")
        else:
            print(f"Project directory does not exist before running: {project_dir_before}")
        
        # Run the generator
        print("Running generator...")
        generator.run()
        print("Generator completed.")
        
        # Check if the project directory exists
        project_dir = Path(project_path)
        if project_dir.exists():
            print(f"Project directory exists: {project_dir}")
            
            # List files in the project directory
            print("Files in project directory:")
            for item in project_dir.iterdir():
                print(f"  {item}")
                
                # If it's a directory, list its contents too
                if item.is_dir():
                    print(f"    Contents of {item}:")
                    for subitem in item.iterdir():
                        print(f"      {subitem}")
        else:
            print(f"Project directory does not exist: {project_dir}")
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    print("Test completed.")

if __name__ == "__main__":
    main()
