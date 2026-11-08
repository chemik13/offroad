#!/usr/bin/env python3
"""Inline src/engine.js into src/app.html -> index.html (single self-contained page)."""
from pathlib import Path
root = Path(__file__).parent
app = (root / "src/app.html").read_text(encoding="utf-8")
engine = (root / "src/engine.js").read_text(encoding="utf-8")
assert "/*ENGINE*/" in app
(root / "index.html").write_text(app.replace("/*ENGINE*/", engine), encoding="utf-8")
print("built index.html")
