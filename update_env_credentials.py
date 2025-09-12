#!/usr/bin/env python3
"""
Update dashboard credentials in a generated Supabase project.

- Updates `projects/<project>/.env` keys: `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`
- Updates `projects/<project>/volumes/api/kong.yml` basic auth credentials for the
  `DASHBOARD` consumer to keep it consistent with the .env

Usage:
  python3 update_env_credentials.py --project-name <name> --username <u> --password <p>
"""
from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
from pathlib import Path

ENV_USER_KEY = "DASHBOARD_USERNAME"
ENV_PASS_KEY = "DASHBOARD_PASSWORD"


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed reading {path}: {e}")


def _write_text_backup(path: Path, content: str) -> None:
    # Backup existing file first
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak.{timestamp}")
    if path.exists():
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Created backup: {backup}")
    path.write_text(content, encoding="utf-8")


def update_env(env_path: Path, username: str, password: str) -> None:
    if not env_path.exists():
        raise FileNotFoundError(f".env not found at {env_path}")

    original = _read_text(env_path)

    def upsert_line(text: str, key: str, value: str) -> str:
        pattern = re.compile(rf"^(?:#\s*)?{re.escape(key)}=.*$", re.MULTILINE)
        replacement = f"{key}={value}"
        if pattern.search(text):
            return pattern.sub(replacement, text)
        # Append if not present
        sep = "\n" if text.endswith("\n") else "\n"
        return text + sep + replacement + "\n"

    updated = upsert_line(original, ENV_USER_KEY, username)
    updated = upsert_line(updated, ENV_PASS_KEY, password)

    if updated != original:
        _write_text_backup(env_path, updated)
        print(f"Updated .env credentials at: {env_path}")
    else:
        print(".env already up-to-date.")


def update_kong_credentials(kong_path: Path, username: str, password: str) -> None:
    if not kong_path.exists():
        print(f"Warning: Kong config not found, skipping: {kong_path}")
        return

    content = _read_text(kong_path)

    # Try to scope edits strictly inside basicauth_credentials block
    start_idx = content.find("basicauth_credentials:")
    if start_idx == -1:
        print("Warning: basicauth_credentials block not found in kong.yml; no changes made.")
        return

    # Heuristically end the block at the next top-level key (services:)
    end_marker = "\nservices:"
    end_rel = content.find(end_marker, start_idx)
    if end_rel == -1:
        # Fallback: end of file
        end_idx = len(content)
    else:
        end_idx = end_rel

    head = content[:start_idx]
    block = content[start_idx:end_idx]
    tail = content[end_idx:]

    # Replace only username/password lines inside this block (DASHBOARD consumer)
    # Keep indentation intact by replacing the entire line after the colon.
    # Use a function replacement to avoid backreference issues when the value starts with a digit.
    block_updated = re.sub(
        r"^(\s*username:\s*).*$",
        lambda m: m.group(1) + username,
        block,
        flags=re.MULTILINE,
    )
    block_updated = re.sub(
        r"^(\s*password:\s*).*$",
        lambda m: m.group(1) + password,
        block_updated,
        flags=re.MULTILINE,
    )

    if block_updated != block:
        new_content = head + block_updated + tail
        _write_text_backup(kong_path, new_content)
        print(f"Updated Kong basic-auth credentials at: {kong_path}")
    else:
        print("Kong credentials already up-to-date or patterns not found.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Update dashboard credentials for a Supabase project")
    parser.add_argument("--project-name", required=True, help="Project name under projects/<name>")
    parser.add_argument("--username", required=True, help="Dashboard username")
    parser.add_argument("--password", required=True, help="Dashboard password")

    args = parser.parse_args(argv)

    project_path = Path("projects") / args.project_name
    env_path = project_path / ".env"
    kong_path = project_path / "volumes" / "api" / "kong.yml"

    try:
        update_env(env_path, args.username, args.password)
        update_kong_credentials(kong_path, args.username, args.password)
        return 0
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 2
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
