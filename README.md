# Supabase Setup Tools

This repository contains Python tools for easily creating and managing self-hosted Supabase deployments using Docker.

## Features

- **Automatic port allocation**: Finds available ports for different services
- **Complete configuration**: Sets up all Supabase services with proper configuration
- **Project isolation**: Each project has its own Docker network and volumes
- **Easy management**: Simple commands to create, start, stop, and reset projects

## Requirements

- Python 3.6+
- Docker and Docker Compose
- `psutil` Python package (for port detection)

## Installation

1. Download both Python files to your computer:
   - `supabase_setup.py`: Core module for creating Supabase projects
   - `supabase_manager.py`: Command-line tool for managing projects

2. Install required dependencies:
   ```bash
   pip install psutil
   ```

3. Make the manager script executable:
   ```bash
   chmod +x supabase_manager.py
   ```

## Usage

### Creating a New Project

```bash
./supabase_manager.py create myproject
```

This creates a new Supabase project with automatically assigned ports. You can also specify a base port:

```bash
./supabase_manager.py create myproject --base-port 5000
```

### Starting a Project

```bash
./supabase_manager.py start myproject
```

To see detailed output during startup:

```bash
./supabase_manager.py start myproject --verbose
```

### Checking Project Status

```bash
./supabase_manager.py status myproject
```

### Stopping a Project

```bash
./supabase_manager.py stop myproject
```

By default, this removes volumes. To keep volumes:

```bash
./supabase_manager.py stop myproject --keep-volumes
```

### Resetting a Project

This stops the project and resets the database data:

```bash
./supabase_manager.py reset myproject
```

### Listing All Projects

```bash
./supabase_manager.py list
```

## Project Structure

Each created project has the following structure:

```
myproject/
├── docker-compose.yml
├── .env
├── README.md
├── reset.sh
└── volumes/
    ├── analytics/
    │   └── entrypoint.sh
    ├── api/
    │   └── kong.yml
    ├── db/
    │   ├── _supabase.sql
    │   ├── data/
    │   ├── init/
    │   │   └── setup.sql
    │   └── logs.sql
    ├── functions/
    │   ├── hello/
    │   │   └── index.ts
    │   └── main/
    │       └── index.ts
    ├── logs/
    │   └── vector.yml
    ├── pooler/
    │   └── pooler.exs
    └── storage/
        └── stub/
```

## Accessing Supabase Services

Once your project is running, you can access:

- **Studio Dashboard**: `http://localhost:<studio_port>`
- **API Endpoint**: `http://localhost:<kong_http_port>`
- **PostgreSQL Database**: Connect to `localhost:<postgres_port>` with username `postgres` and password from your `.env` file

Default login credentials for the Studio:
- Username: `supabase`
- Password: Your project name

## Environment Variables

The `.env` file contains all configuration for your Supabase instance. Key variables:

- `POSTGRES_PASSWORD`: PostgreSQL database password
- `JWT_SECRET`: Secret key for JWT tokens
- `ANON_KEY`/`SERVICE_ROLE_KEY`: API access keys
- `STUDIO_PORT`, `KONG_HTTP_PORT`, etc.: Port configurations

## Customizing Your Setup

### Adding Migrations

Add SQL files to `volumes/db/init/` to run them during database initialization.

### Edge Functions

Create new functions by adding directories under `volumes/functions/`:

```bash
mkdir -p myproject/volumes/functions/my-function
```

Then add an `index.ts` file with your function code.

### Storage Rules

Edit storage rules through the Studio interface after starting your project.

## Troubleshooting

### Port Conflicts

If you see an error like "port is already allocated", use the manager to recreate the project with different ports:

```bash
./supabase_manager.py create myproject --base-port 6000
```

### Database Connection Issues

If services can't connect to the database, try resetting the project:

```bash
./supabase_manager.py reset myproject
```

### Container Health Checks

Check the status of your containers:

```bash
./supabase_manager.py status myproject
```

Or view detailed logs:

```bash
cd myproject
docker compose logs -f
```

## Advanced Usage

### Docker Compose Overrides

You can create a `docker-compose.override.yml` file in your project directory to customize the Docker Compose configuration.

### Custom SQL Initialization

Add custom SQL initialization scripts to `volumes/db/init/` to run them during database initialization.

### External Database

To use an external PostgreSQL database instead of the included container, modify the connection settings in the `.env` file.

## Contributing

Feel free to submit issues or pull requests to improve these tools.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
