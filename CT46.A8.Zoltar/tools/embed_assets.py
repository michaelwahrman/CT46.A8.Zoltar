#!/usr/bin/env python3
"""CT46.A3.Zoltar - rebuild the embedded-asset scripts (Linux / WSL):
    python3 tools/embed_assets.py
  assets/zoltar_assets.js  <- assets/zoltar_title.webp, assets/fortune_card_back.webp
  assets/zoltar_fonts.js   <- fonts/Metamorphous-Regular.ttf (button font)
Embedded so the page works when opened directly from disk (file://)."""
import base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
def b64(p): return base64.b64encode((root / p).read_bytes()).decode()
(root / 'assets' / 'zoltar_assets.js').write_text(
    "// CT46.A1.Zoltar - embedded art so the page works when opened directly from disk (file://).\n"
    "// Regenerate with tools/embed_assets.py if the .webp files change.\n"
    "window.ZOLTAR_ASSETS = {\n"
    f"  title: 'data:image/webp;base64,{b64('assets/zoltar_title.webp')}',\n"
    f"  cardBack: 'data:image/webp;base64,{b64('assets/fortune_card_back.webp')}'\n}};\n")
(root / 'assets' / 'zoltar_fonts.js').write_text(
    "// CT46.A3.Zoltar - embedded font (SIL OFL, licence in fonts/). Regenerate with tools/embed_assets.py.\n"
    "window.ZOLTAR_FONTS = {\n"
    f"  'Metamorphous': '{b64('fonts/Metamorphous-Regular.ttf')}'\n}};\n")
print('wrote assets/zoltar_assets.js, assets/zoltar_fonts.js')
