#!/usr/bin/env python3
"""
Traverse a MinIO bucket and generate studies.json
for the iSyntax viewer.

Expected bucket layout:
  <stackId>/<folderId>/<studyId>/...

Objects with .dts or .off extensions are ignored.

Usage:
  python generate_studies.py [--output <path>]

Requires:
  pip install minio
"""

import json
import argparse
import sys
from pathlib import Path

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    sys.exit("minio package not found. Run:  pip install minio")

# ── Configuration ────────────────────────────────────────────────────────────
MINIO_ENDPOINT  = "localhost:9000"
MINIO_ACCESS    = "admin"
MINIO_SECRET    = "password"
MINIO_SECURE    = False          # set True if TLS is enabled
BUCKET_NAME     = "ispacs-cloud-udm-studies"
DEFAULT_OUTPUT  = Path(__file__).parent / "src" / "studies2.json"
# ─────────────────────────────────────────────────────────────────────────────


def list_study_stack_pairs(client: "Minio", bucket: str) -> list[dict]:
    """
    Walk the bucket and return a deduplicated list of
    {"studyId": ..., "stackId": ...} dicts.

    Bucket layout:
        <stackId>/<folderId>/<studyId>/...
    """
    IGNORE_EXTENSIONS = {".dts", ".off"}

    def should_ignore(name: str) -> bool:
        return Path(name.rstrip("/")).suffix.lower() in IGNORE_EXTENSIONS

    seen: set[tuple[str, str]] = set()
    result: list[dict] = []

    print(f"Listing top-level stack prefixes in bucket '{bucket}' ...")

    # Level 1 – stackId prefixes
    for stack_obj in client.list_objects(bucket, recursive=False):
        stack_name: str = stack_obj.object_name   # e.g. "PR3/"
        if should_ignore(stack_name):
            continue
        stack_id = stack_name.rstrip("/")
        if not stack_id:
            continue

        print(f"  Stack: {stack_id}")

        # Level 2 – folderId prefixes inside this stack
        for folder_obj in client.list_objects(bucket, prefix=stack_name, recursive=False):
            folder_name: str = folder_obj.object_name  # e.g. "PR3/folder1/"
            if should_ignore(folder_name):
                continue
            folder_id = folder_name[len(stack_name):].rstrip("/").split("/")[0]
            if not folder_id:
                continue

            print(f"    Folder: {folder_id}")

            # Level 3 – studyId prefixes inside this folder
            folder_prefix = f"{stack_name}{folder_id}/"
            for study_obj in client.list_objects(bucket, prefix=folder_prefix, recursive=False):
                study_name: str = study_obj.object_name  # e.g. "PR3/folder1/2.16.840.../"
                if should_ignore(study_name):
                    continue
                study_id = study_name[len(folder_prefix):].rstrip("/").split("/")[0]
                if not study_id:
                    continue

                print(f"      Study: {study_id}")
                key = (study_id, stack_id)
                if key not in seen:
                    seen.add(key)
                    result.append({"studyId": study_id, "stackId": stack_id})

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate studies.json from MinIO bucket")
    parser.add_argument(
        "--output", "-o",
        default=str(DEFAULT_OUTPUT),
        help=f"Output path for studies.json (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--endpoint", default=MINIO_ENDPOINT,
        help=f"MinIO endpoint host:port (default: {MINIO_ENDPOINT})",
    )
    parser.add_argument(
        "--access-key", default=MINIO_ACCESS,
        help="MinIO access key",
    )
    parser.add_argument(
        "--secret-key", default=MINIO_SECRET,
        help="MinIO secret key",
    )
    parser.add_argument(
        "--secure", action="store_true", default=MINIO_SECURE,
        help="Use TLS (HTTPS)",
    )
    parser.add_argument(
        "--bucket", default=BUCKET_NAME,
        help=f"Bucket name (default: {BUCKET_NAME})",
    )
    args = parser.parse_args()

    client = Minio(
        args.endpoint,
        access_key=args.access_key,
        secret_key=args.secret_key,
        secure=args.secure,
    )

    # Verify bucket exists
    try:
        if not client.bucket_exists(args.bucket):
            sys.exit(f"Bucket '{args.bucket}' does not exist.")
    except S3Error as e:
        sys.exit(f"Error connecting to MinIO: {e}")

    pairs = list_study_stack_pairs(client, args.bucket)

    if not pairs:
        print("WARNING: No study/stack pairs found in bucket.")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pairs, indent=2), encoding="utf-8")

    print(f"\nWrote {len(pairs)} entries to {output_path}")
    for entry in pairs:
        print(f"  studyId={entry['studyId']}  stackId={entry['stackId']}")


if __name__ == "__main__":
    main()
