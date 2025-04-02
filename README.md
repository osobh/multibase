# Multibase: Multi-Instance Supabase Self-Hosting Tool

Multibase is a tool that makes it easy to create and manage multiple Supabase instances on a single host. Each instance runs with its own isolated network, unique container names, and dedicated ports.

## Overview

Setting up multiple self-hosted Supabase instances is challenging due to container name conflicts, port conflicts, and resource sharing issues. Multibase solves these problems by:

1. Creating uniquely named containers for each project
2. Assigning custom port ranges that don't conflict
3. Setting up isolated Docker networks
4. Creating proper volume management for database persistence
5. Customizing environment variables for each instance

## Quick Start

```bash
# Create a new Supabase instance named "paydownr" using port 8080 as the base port
./create_new_supabase.sh paydownr 8080

# Create another instance named "robomovie" using port 8282 as the base port
./create_new_supabase.sh robomovie 8282
```

## Port Allocation
When you provide a base port (e.g., 8080), the script automatically calculates other necessary ports:
ServiceFormulaExample (base: 8080)Example (base: 8282)Kong HTTP APIbase_port80808282Kong HTTPS APIbase_port + 44385238725PostgreSQLbase_port + 5432 - 800055125714Connection Poolerbase_port + 6543 - 800066236825Studio Dashboardbase_port + 3000 - 800030803282Analyticsbase_port - 408040004202
Features
Container Naming
All containers are named using the pattern supabase-{service}-{project_name}, such as:

supabase-db-projectA
supabase-studio-projectB

The only exception is the realtime service, which uses: realtime-dev.{project_name}-realtime

## Network Isolation
Each Supabase project gets its own Docker network named {project_name}-network, ensuring complete isolation between projects.
Volume Management
Database volumes are renamed to {project_name}_db-config to prevent conflicts between projects.
Configuration Customization

Each project has customized ports in the .env file
Default organization and project names match your project name
Dashboard password is set to your project name for easy access

```bash

./create_new_supabase.sh <project-name> [base-port]

```

The source .env step is critical as it ensures all the environment variables are loaded into your current shell, which Docker Compose needs to properly substitute values in the configuration.
Accessing Services

After starting, you can access:

Studio dashboard: http://localhost:<studio-port>
API endpoint: http://localhost:<http-port>
PostgreSQL: Connect on port <postgres-port>
Analytics dashboard: Available on port <analytics-port>

## Resetting an Instance
Each project includes a reset script that removes all data and lets you start fresh:
```bash
cd <project-name>
./reset.sh
```
## Customization
The script creates several files in your project directory:

docker-compose.yml: Main configuration with ports and container settings
docker-compose.override.yml: Network isolation settings
.env: Environment variables with all custom ports
reset.sh: Helper script to reset the environment
README.md: Project-specific instructions

You can customize any of these files to meet your specific requirements.
Requirements

Docker and Docker Compose installed
Basic knowledge of Supabase and Docker
Sufficient system resources to run multiple Supabase instances

## Troubleshooting

### Port Conflicts
If you see errors like port is already allocated, choose a different base port that doesn't conflict with other services on your system.
Container Name Conflicts

If container name conflicts occur, ensure you don't have existing containers with the same names. You can run docker ps -a to check existing containers.

### Memory/CPU Issues
Running multiple Supabase instances can be resource-intensive. Make sure your host has sufficient RAM and CPU capacity.

### License
This project is available under the MIT License. See the LICENSE file for details.
