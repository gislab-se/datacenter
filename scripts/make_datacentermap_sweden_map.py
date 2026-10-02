"""Bygg om underlaget för den statiska datacenterkartan med Node.js."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
if __name__ == "__main__":
    subprocess.run(["node", str(ROOT / "scripts/build_datacenter_data.cjs")], cwd=ROOT, check=True)
    print("Karta:", ROOT / "outputs/maps/datacentermap_sweden_interactive_map.html")