#!/usr/bin/env python3
"""Generate server-only credentials for a NEW deployment. Never overwrite keys."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder = root / 'secrets'
key_path = folder / 'keys.yaml'
meet_path = folder / 'meet-keys.yaml'
if os.geteuid() != 0:
    raise SystemExit('Run with sudo: sudo python3 scripts/init-secrets.py')
if key_path.exists() or meet_path.exists():
    raise SystemExit('Existing credentials found. Refusing to overwrite them.')
folder.mkdir(mode=0o700, exist_ok=True)
folder.chmod(0o700)
key = 'API' + secrets.token_hex(10)
secret = secrets.token_urlsafe(48)
body = (key + ': ' + secret + '\n').encode()
for target, uid, mode in [(key_path, 0, 0o600), (meet_path, 1000, 0o400)]:
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        os.fchown(fd, uid, uid)
        os.write(fd, body)
    finally:
        os.close(fd)
print('Created protected credentials under secrets/. No credential values printed.')
