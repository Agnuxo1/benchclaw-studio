"""Deploy the public demo to a Hugging Face Docker Space (code, public assets and recorded showcase only).

Usage: python scripts/deploy/hf_space.py [--space Agnuxo/benchclaw-studio]
The Nebius key is never handled here; the operator adds NEBIUS_API_KEY as a Space secret.
"""
import argparse, json, os, shutil, tempfile
from pathlib import Path
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[2]
SHIP = ["Dockerfile", "package.json", "package-lock.json", "LICENSE", "server", "public", "vendor", "showcase"]
HEAD = """---
title: BenchClaw Studio
emoji: 🦀
colorFrom: green
colorTo: gray
sdk: docker
app_port: 4328
pinned: false
license: mit
short_description: Cheapest NVIDIA Nemotron that passes your checks
---

# BenchClaw Studio

Run bounded agent tasks on NVIDIA Nemotron through Nebius Token Factory. Deterministic checks decide pass/fail, and the auto-tier ladder escalates from Lightning to Super to Ultra only when the checks fail.

Source, tests and reproduction steps: https://github.com/Agnuxo1/benchclaw-studio
"""

ap = argparse.ArgumentParser(); ap.add_argument("--space", default="Agnuxo/benchclaw-studio"); a = ap.parse_args()
api = HfApi()
api.create_repo(a.space, repo_type="space", space_sdk="docker", exist_ok=True, private=False)
origin = "https://" + a.space.lower().replace("/", "-").replace("_", "-") + ".hf.space"
variables = {"STUDIO_PUBLIC_ORIGIN": origin, "STUDIO_INFERENCE_ENABLED": "1", "STUDIO_MAX_RUNS": "300", "STUDIO_MAX_RUNS_PER_OWNER": "6", "STUDIO_MAX_TOTAL_TOKENS": "2000000"}
prices = ROOT / "experiments" / "prices.json"
if prices.exists():
    variables["STUDIO_PRICES"] = json.dumps(json.loads(prices.read_text(encoding="utf8"))["prices"])
for k, v in variables.items():
    api.add_space_variable(a.space, k, v)
with tempfile.TemporaryDirectory() as tmp:
    t = Path(tmp)
    for name in SHIP:
        src = ROOT / name
        (shutil.copytree(src, t / name) if src.is_dir() else shutil.copy2(src, t / name))
    (t / "README.md").write_text(HEAD, encoding="utf8")
    api.upload_folder(repo_id=a.space, repo_type="space", folder_path=tmp, commit_message="Deploy BenchClaw Studio", delete_patterns=["server/*", "public/*", "showcase/*"])
print("space:", f"https://huggingface.co/spaces/{a.space}", "app:", origin)
