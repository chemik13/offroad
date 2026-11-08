#!/usr/bin/env python3
"""Inline src/engine.js into src/app.html -> index.html (single self-contained page)."""
from pathlib import Path
root = Path(__file__).parent
app = (root / "src/app.html").read_text(encoding="utf-8")
engine = (root / "src/engine.js").read_text(encoding="utf-8")
assert "/*ENGINE*/" in app
import subprocess, datetime
n = int(subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip() or 0) + 1
version = f"1.{n} · {datetime.datetime.now().strftime('%d.%m.%Y %H:%M')}"
(root / "index.html").write_text(app.replace("/*ENGINE*/", engine).replace("/*VERSION*/", version), encoding="utf-8")
print("version", version)
print("built index.html")
