from __future__ import annotations

from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ICON = ROOT / "static" / "favicon-source.png"
DESKTOP_ICON = ROOT / "static" / "favicon.png"


def main() -> None:
    if not SOURCE_ICON.exists():
        raise SystemExit(f"Missing source icon: {SOURCE_ICON}")

    shutil.copyfile(SOURCE_ICON, DESKTOP_ICON)
    print(f"Wrote {DESKTOP_ICON}")


if __name__ == "__main__":
    main()
