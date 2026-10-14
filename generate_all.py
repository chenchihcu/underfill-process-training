#!/usr/bin/env python3
"""One-click generator for all Underfill documentation."""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

OUTPUT_DIR = 'Outputs'
MEDIA_DIR = 'extracted_images'


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def run_script(name: str, extra_args: list[str] | None = None) -> bool:
    args = [sys.executable, name]
    if extra_args:
        args.extend(extra_args)
    log.info(f'Running: {" ".join(args)}')
    rc = os.system(' '.join(args))
    if rc != 0:
        log.error(f'{name} failed (exit code {rc})')
        return False
    return True


def main() -> None:
    ensure_dir(OUTPUT_DIR)

    scripts = [
        ('generate_ultimate_wi.py', ['--media', MEDIA_DIR, '--output', os.path.join(OUTPUT_DIR, 'Underfill_作業標準書.docx')]),
    ]

    success = 0
    for script, args in scripts:
        if run_script(script, args):
            success += 1

    log.info(f'Done: {success}/{len(scripts)} scripts succeeded')
    return 0 if success == len(scripts) else 1


if __name__ == '__main__':
    sys.exit(main())
