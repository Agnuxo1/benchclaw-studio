#!/bin/bash
# Publishes the read-only replay site to the gh-pages branch (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=$(mktemp -d)
node scripts/build-static.mjs "$OUT/site"
git -C "$OUT/site" init -q -b gh-pages
git -C "$OUT/site" add -A
git -C "$OUT/site" -c user.name="Francisco Angulo de Lafuente" -c user.email="lareliquia.angulo@gmail.com" commit -q -m "Replay site $(git rev-parse --short HEAD)"
git -C "$OUT/site" push -q -f "$(git remote get-url origin)" gh-pages
rm -rf "$OUT"
echo "pushed gh-pages"
