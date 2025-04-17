# Supabase Secure Self-Hosting Deployment Manager

This repository provides a robust, secure, and reproducible workflow for creating and managing self-hosted Supabase deployments using Docker Compose.

---

## Directory Structure

All Supabase deployments are created inside a dedicated `projects/` directory.  
Each deployment is isolated in its own subdirectory:

---

## File Descriptions

- **setup_secure_supabase.sh**: Main setup script. Orchestrates project creation, prompts for credentials, generates keys, and starts Docker Compose.
- **supabase_manager.py**: Project management CLI. Handles create, start, stop, reset, status, and list commands for deployments.
- **supabase_setup.py**: Python project generator. Creates the directory structure and all config/template files for a new deployment.
- **generate_keys.py**: Generates secure API keys and updates the `.env` file for each deployment.
- **requirements.txt**: Python dependencies required for the management scripts.
- **sample_security_policies.sql**: Example Row Level Security (RLS) policies for your database.
- **security_checklist.md**: Security best practices and checklist for your deployment.
- **vector.yml**: Default Vector logging configuration template.
- **update_security.py**: (If present) Script for updating security settings or policies.
- **test_security.py**: (If present) Script for testing security policies or deployment.
- **README.md**: This documentation file.
- **.gitignore**: Ensures secrets and environment files in `projects/` are not committed to version control.

**Project directories** (under `/projects/<project-name>/`) contain:
- `docker-compose.yml`, `.env`, `volumes/`, `sample_security_policies.sql`, `security_checklist.md`, and a project-specific `README.md`.

---

```
/projects
  /myproject
    docker-compose.yml
    .env
    volumes/
    sample_security_policies.sql
    security_checklist.md
    README.md
```

**Note:**  
The `projects/` directory is included in `.gitignore` to ensure that secrets and environment files are never committed to version control.

---

## Quick Start

### 1. Prerequisites

- Python 3.7+
- Docker and Docker Compose
- Python dependencies (install with):
  ```
  pip install -r requirements.txt
  ```

### 2. Create a New Supabase Deployment

Run the setup script from the root directory:

```bash
./setup_secure_supabase.sh <project-name> [base-port]
```

- You will be prompted for dashboard credentials (username and password).
- Secure API keys will be generated automatically.
- All files will be created in `projects/<project-name>/`.

### 3. Start and Manage Your Deployment

```bash
cd projects/<project-name>
docker compose up -d
```

To stop services:

```bash
docker compose down
```

---

## Security Model

- **Secrets and environment files** are kept out of version control by default (`projects/` is in `.gitignore`).
- Each deployment includes:
  - `security_checklist.md` — follow this for best practices.
  - `sample_security_policies.sql` — example Row Level Security (RLS) policies.
- You are prompted to set custom dashboard credentials at setup time.
- Secure API keys are generated for each deployment.

---

## Project Management

- All management commands (`create`, `start`, `stop`, `reset`, `status`, `list`) are available via `supabase_manager.py`.
- Example:  
  ```bash
  python supabase_manager.py list
  python supabase_manager.py start <project-name>
  ```

---

## Updating and Customizing

- To update a deployment, re-run the setup script or use the management commands.
- You can customize the generated files in each project directory as needed.
- For advanced configuration, edit the generated `docker-compose.yml` or `.env` in your project directory.

---

## Example Usage

```bash
# Create a new deployment
./setup_secure_supabase.sh myproject

# Start the deployment
cd projects/myproject
docker compose up -d

# Stop the deployment
docker compose down
```

---

## Additional Notes

- All persistent data and configuration for each deployment is stored under `projects/<project-name>/volumes/`.
- The root directory contains only scripts, templates, and documentation — never secrets.
- For more information on securing your deployment, see `projects/<project-name>/security_checklist.md`.

---

## License

See [LICENSE](LICENSE) for details.
