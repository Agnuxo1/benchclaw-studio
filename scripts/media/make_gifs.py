"""Animated README figures. Architecture is drawn from the code structure; charts only from experiments/E01/summary.json.

Usage: python scripts/media/make_gifs.py [--summary experiments/E01/summary.json] [--out docs/media]
"""
import argparse, json, math
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from matplotlib.animation import FuncAnimation, PillowWriter

BG, PANEL, INK, MUTED, GREEN, LIME, RED, AMBER = "#0f1712", "#18241c", "#eef4ee", "#93a597", "#76b900", "#c2ed8c", "#e06767", "#e0b452"
TIERS = [("lightning", "Nemotron 3.5 Lightning", "30B · 3B active"), ("super", "Nemotron 3 Super", "120B · 12B active"), ("ultra", "Nemotron 3 Ultra", "550B · 55B active")]
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK, "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED})


def box(ax, x, y, w, h, title, sub="", color=PANEL, edge=MUTED, alpha=1.0, lw=1.4):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.025", fc=color, ec=edge, lw=lw, alpha=alpha))
    ax.text(x + w / 2, y + h * (0.62 if sub else 0.5), title, ha="center", va="center", fontsize=11, weight="bold", alpha=alpha)
    if sub:
        ax.text(x + w / 2, y + h * 0.3, sub, ha="center", va="center", fontsize=8.5, color=MUTED, alpha=alpha)


def arrow(ax, a, b, color=MUTED, alpha=1.0):
    ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="-|>", color=color, lw=1.8, alpha=alpha))


def architecture(out):
    fig = plt.figure(figsize=(10, 5.2), dpi=100, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    # (frame index → which tier lights up, and its outcome) tells the ladder story: Lightning fails, Super passes.
    states = [None] * 6 + [("lightning", "run")] * 8 + [("lightning", "fail")] * 6 + [("super", "run")] * 8 + [("super", "pass")] * 14

    def draw(i):
        ax.clear(); ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
        ax.text(0.03, 0.93, "BenchClaw Studio · auto-tier ladder", fontsize=15, weight="bold")
        ax.text(0.03, 0.875, "Cheapest NVIDIA Nemotron first. Escalate only when deterministic checks fail.", fontsize=9.5, color=MUTED)
        box(ax, 0.03, 0.42, 0.15, 0.2, "Browser", "task · tools · profile")
        box(ax, 0.23, 0.42, 0.17, 0.2, "Studio API", "Node 22 · CSP · caps")
        box(ax, 0.23, 0.12, 0.17, 0.17, "EnigmAgent vault", "key never model-visible", edge=AMBER)
        arrow(ax, (0.18, 0.52), (0.23, 0.52)); arrow(ax, (0.315, 0.29), (0.315, 0.42), AMBER)
        st = states[i % len(states)]
        for k, (tier, label, size) in enumerate(TIERS):
            y = 0.66 - k * 0.24
            edge, fill = MUTED, PANEL
            if st and st[0] == tier:
                edge = {"run": AMBER, "fail": RED, "pass": GREEN}[st[1]]
            if st and st[1] == "pass" and tier == "super":
                fill = "#1f3a12"
            if st and ((st[0] == "super" and tier == "lightning") or (st[0] == "super" and st[1] == "pass" and tier == "lightning")):
                edge = RED
            dim = 0.35 if (st and st[1] == "pass" and tier == "ultra") else 1.0
            box(ax, 0.47, y, 0.24, 0.17, label, size + " · Token Factory", color=fill, edge=edge, alpha=dim, lw=2.2)
            arrow(ax, (0.40, 0.52), (0.47, y + 0.085), alpha=dim * 0.8)
        if st:
            tier, phase = st
            y = 0.66 - [t[0] for t in TIERS].index(tier) * 0.24
            if phase == "run":
                t = (i % 8) / 8
                ax.add_patch(plt.Circle((0.40 + 0.07 * t, 0.52 + (y + 0.085 - 0.52) * t), 0.012, color=AMBER))
            mark = {"run": "…", "fail": "✗ checks failed", "pass": "✓ checks pass"}[phase]
            ax.text(0.72, y + 0.085, mark, fontsize=10, va="center", color={"run": AMBER, "fail": RED, "pass": GREEN}[phase], weight="bold")
        if st and st == ("super", "pass"):
            box(ax, 0.775, 0.06, 0.2, 0.2, "Evidence report", "checks · receipts · hash", color="#1f3a12", edge=GREEN)
            arrow(ax, (0.71, 0.48), (0.82, 0.26), GREEN)
            ax.text(0.875, 0.30, "Ultra not called", ha="center", fontsize=9, color=MUTED)
        ax.text(0.03, 0.015, "Illustrative flow. Same task, inputs, tools, limits and validator for every tier. Costs from provider-reported tokens × published price.", fontsize=8.5, color=MUTED)

    anim = FuncAnimation(fig, draw, frames=len(states), interval=160)
    anim.save(out / "architecture.gif", writer=PillowWriter(fps=6))
    plt.close(fig)


def tier_bars(summary, out):
    by = summary["byTier"]; tiers = [t for t in TIERS if t[0] in by]
    metrics = [("Tasks passed", lambda b: 100 * (b["passRate"]["mean"] or 0), lambda b: 100 * (b["passRate"]["sd"] or 0), "{:.0f}%"),
               ("Mean run time (s)", lambda b: (b["durationMs"]["mean"] or 0) / 1000, lambda b: (b["durationMs"]["sd"] or 0) / 1000, "{:.1f}s"),
               ("Cost per run (US$)", lambda b: b["costUSD"]["mean"] or 0, lambda b: 0, "${:.4f}")]
    fig, axes = plt.subplots(1, 3, figsize=(11, 4.4), dpi=100, facecolor=BG)
    fig.subplots_adjust(bottom=0.16, wspace=0.28)
    frames = 24

    def draw(i):
        f = min(1, (i + 1) / (frames - 6))
        f = 1 - (1 - f) ** 3
        for ax, (title, val, err, fmt) in zip(axes, metrics):
            ax.clear(); ax.set_facecolor(BG)
            for s in ax.spines.values(): s.set_visible(False)
            vals = [val(by[t[0]]) for t in tiers]; errs = [err(by[t[0]]) for t in tiers]
            colors = [LIME, GREEN, "#4f7f12"]
            ax.bar(range(len(tiers)), [v * f for v in vals], color=colors[:len(tiers)], width=0.62, yerr=[e * f for e in errs] if any(errs) else None, ecolor=MUTED, capsize=4)
            top = max([v + e for v, e in zip(vals, errs)] + [1e-9]) * 1.18
            ax.set_ylim(0, top); ax.set_yticks([])
            ax.set_xticks(range(len(tiers))); ax.set_xticklabels([t[1].replace("Nemotron ", "") for t in tiers], fontsize=9.5)
            ax.set_title(title, fontsize=11.5, color=INK, pad=10)
            for k, (v, e) in enumerate(zip(vals, errs)):
                ax.text(k + 0.33, v * f + top * 0.02, fmt.format(v * f), ha="left", fontsize=10, color=INK, weight="bold")
        fig.suptitle(f"{summary.get('label', 'E01')} · {len(summary['seeds'])} seeds × {len(summary['tasks'])} tasks × {len(summary['profiles'])} profiles per tier · real Nebius Token Factory runs", fontsize=10, color=MUTED, y=0.03)

    anim = FuncAnimation(fig, draw, frames=frames, interval=80)
    anim.save(out / "tiers.gif", writer=PillowWriter(fps=12))
    plt.close(fig)


def policy_bars(summary, out):
    pol = summary.get("policies") or {}
    if "ladder" not in pol:
        return
    rows = [("Always Ultra", dict(pol["always_ultra"])), ("Always Super", dict(pol["always_super"])), ("Auto-tier ladder", dict(pol["ladder"]))]
    paired = summary.get('pairedCostComparisons', {})
    if 'ladder_vs_always_ultra' in paired:
        rows[0][1]['costUSD'] = paired['ladder_vs_always_ultra']['controlMeanUSD']
        rows[2][1]['costUSD'] = paired['ladder_vs_always_ultra']['ladderMeanUSD']
    if 'ladder_vs_always_super' in paired:
        rows[1][1]['costUSD'] = paired['ladder_vs_always_super']['controlMeanUSD']
    fig, ax = plt.subplots(figsize=(10, 3.6), dpi=100, facecolor=BG)
    fig.subplots_adjust(left=0.17, right=0.98)
    frames = 26
    maxc = max((r[1]["costUSD"] or 0) for r in rows) * 1.35 or 1

    def draw(i):
        f = 1 - (1 - min(1, (i + 1) / (frames - 6))) ** 3
        ax.clear(); ax.set_facecolor(BG)
        for s in ax.spines.values(): s.set_visible(False)
        for k, (name, p) in enumerate(rows):
            c = p["costUSD"] or 0
            ax.barh(k, c * f, color=[MUTED, "#4f7f12", GREEN][k], height=0.55)
            ax.text(c * f + maxc * 0.01, k, f"${c * f:.4f} per task · {100 * p['passRate']['mean']:.0f}% passed", va="center", fontsize=10.5, color=INK)
        ax.set_yticks(range(3)); ax.set_yticklabels([r[0] for r in rows], fontsize=11); ax.set_xticks([]); ax.set_xlim(0, maxc * 1.6)
        coverage = paired.get('ladder_vs_always_ultra')
        title = (f"Matched cost: {coverage['knownPairs']}/{coverage['totalCells']} cells; success: all {coverage['totalCells']} cells"
                 if coverage else 'Routing policy on the same recorded grid: cost per task and success')
        ax.set_title(title, fontsize=12, color=INK, loc="left")

    anim = FuncAnimation(fig, draw, frames=frames, interval=80)
    anim.save(out / "policy.gif", writer=PillowWriter(fps=12))
    plt.close(fig)


def budget_bars(base, alt, out):
    """Pass rate per tier at two output-token budgets (E01 vs E02), grouped bars with seed SD."""
    tiers = [t for t in TIERS if t[0] in base["byTier"] and t[0] in alt["byTier"]]
    labels = [f"{base.get('maxTokens') or 2048:,} output tokens", f"{alt.get('maxTokens'):,} output tokens"]
    fig, ax = plt.subplots(figsize=(10, 4.2), dpi=100, facecolor=BG)
    frames = 26

    def draw(i):
        f = 1 - (1 - min(1, (i + 1) / (frames - 6))) ** 3
        ax.clear(); ax.set_facecolor(BG)
        for s in ax.spines.values(): s.set_visible(False)
        for j, (summ, color) in enumerate(((base, MUTED), (alt, GREEN))):
            vals = [100 * summ["byTier"][t[0]]["passRate"]["mean"] for t in tiers]
            errs = [100 * (summ["byTier"][t[0]]["passRate"]["sd"] or 0) for t in tiers]
            xs = [k + (j - 0.5) * 0.36 for k in range(len(tiers))]
            ax.bar(xs, [v * f for v in vals], width=0.34, color=color, yerr=[e * f for e in errs], ecolor=INK, capsize=3, label=labels[j])
            for x, v, e in zip(xs, vals, errs):
                ax.text(x, (v + e) * f + 3, f"{v * f:.0f}%", ha="center", fontsize=10, color=INK, weight="bold")
        ax.set_ylim(0, 130); ax.set_yticks([]); ax.set_xticks(range(len(tiers))); ax.set_xticklabels([t[1] for t in tiers], fontsize=10.5)
        ax.legend(frameon=False, labelcolor=INK, loc="upper left", fontsize=9.5, ncol=2)
        ax.set_title("Tasks passed per tier: reasoning models need room to answer", fontsize=12, color=INK, loc="left")

    anim = FuncAnimation(fig, draw, frames=frames, interval=80)
    anim.save(out / "budget.gif", writer=PillowWriter(fps=12))
    plt.close(fig)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--summary"); ap.add_argument("--compare"); ap.add_argument("--out", default="docs/media")
    ap.add_argument("--no-architecture", action="store_true"); ap.add_argument("--label")
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    if not a.no_architecture:
        architecture(out)
    if a.summary:
        s = json.loads(Path(a.summary).read_text(encoding="utf8")); s["label"] = a.label or s.get("label", "E01")
        tier_bars(s, out); policy_bars(s, out)
        if a.compare:
            budget_bars(s, json.loads(Path(a.compare).read_text(encoding="utf8")), out)
    print("written", sorted(p.name for p in out.glob("*.gif")))
