<script lang="ts">
  import { firewall, ruleCommand, ruleMatches } from "$lib/ufw/firewall.svelte";
  import { isV6 } from "$lib/ufw/net";
  import type { Evaluation, Packet } from "$lib/ufw/types";

  let { evaluation, packet, speed = 380 }: { evaluation: Evaluation | null; packet: Packet; speed?: number } = $props();

  let shown = $state(0);

  // replay the walk every time a new evaluation arrives
  $effect(() => {
    if (!evaluation) return;
    shown = 0;
    const total = evaluation.steps.length;
    const t = setInterval(() => {
      shown++;
      if (shown >= total) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  });

  const inbound = $derived(packet.direction === "in");
  const p6 = $derived(isV6(packet.src) || isV6(packet.dst) ? "ufw6" : "ufw");
  const sfx = $derived(inbound ? "input" : "output");

  const nodes = $derived([
    { chain: inbound ? "PREROUTING → routing" : "local process → routing", kind: "kernel" },
    { chain: inbound ? "INPUT" : "OUTPUT", kind: "kernel" },
    { chain: `${p6}-before-logging-${sfx}`, kind: "before" },
    { chain: `${p6}-before-${sfx}`, kind: "before" },
    { chain: `${p6}-user-${sfx}`, kind: "user" },
    { chain: `${p6}-after-${sfx}`, kind: "after" },
    { chain: `${p6}-after-logging-${sfx}`, kind: "after" },
    { chain: `${p6}-reject-${sfx}`, kind: "after" },
    { chain: `${p6}-track-${sfx}`, kind: "after" },
    { chain: `policy (${inbound ? "incoming" : "outgoing"})`, kind: "policy" },
  ]);

  const visible = $derived(evaluation ? evaluation.steps.slice(0, shown) : []);
  const done = $derived(!!evaluation && shown >= evaluation.steps.length);
  const current = $derived(visible.at(-1));

  function stepFor(chain: string) {
    return visible.find((s) => s.chain === chain);
  }

  const userRules = $derived(
    firewall.ordered.filter((r) => r.direction === packet.direction && r.v6 === (isV6(packet.src) || isV6(packet.dst))),
  );
  const matchedIdx = $derived(evaluation?.matchedRule ? userRules.findIndex((r) => r.id === evaluation!.matchedRule!.id) : -1);
  const userReached = $derived(!!stepFor(`${p6}-user-${sfx}`));

  // position of the packet token on the wire (0..1)
  const progress = $derived(evaluation ? Math.min(1, shown / Math.max(1, evaluation.steps.length)) : 0);
  const verdictColor = $derived(
    !done || !evaluation ? "var(--accent)" : evaluation.verdict === "ACCEPT" ? "var(--ok)" : evaluation.verdict === "DROP" ? "var(--drop)" : "var(--reject)",
  );
  const srcLabel = $derived(inbound ? packet.src : `${packet.src} (bu sunucu)`);
  const dstLabel = $derived(inbound ? `${packet.dst}:${packet.proto === "icmp" ? "icmp" : packet.dport}` : `${packet.dst}:${packet.dport}`);
</script>

<div class="flow">
  <svg viewBox="0 0 600 90" class="wire" role="img" aria-label="Paketin yolu">
    <rect x="4" y="22" width="150" height="46" rx="8" class="host" />
    <text x="79" y="42" class="h">{inbound ? "Kaynak" : "Sunucu (kaynak)"}</text>
    <text x="79" y="58" class="m">{srcLabel}</text>

    <path d="M154 45 H446" class="line" />

    <g transform="translate(300 45)">
      <path d="M0 -30 -22 -21v14c0 13 9 23 22 27 13-4 22-14 22-27v-14z" class="shield" class:on={firewall.enabled} />
      <text y="4" class="fw">ufw</text>
    </g>

    <rect x="446" y="22" width="150" height="46" rx="8" class="host" />
    <text x="521" y="42" class="h">{inbound ? "Hedef servis" : "Uzak hedef"}</text>
    <text x="521" y="58" class="m">{dstLabel}</text>

    {#if evaluation}
      {@const x = done && evaluation.verdict !== "ACCEPT" ? 262 : 170 + progress * 262}
      <circle cx={x} cy="45" r="8" fill={verdictColor} class="pkt" />
      {#if done}
        <text x={x} y="82" class="verdict" fill={verdictColor}>{evaluation.verdict}</text>
      {/if}
    {/if}
  </svg>

  <ol class="chain">
    {#each nodes as n, i (n.chain)}
      {@const s = stepFor(n.chain)}
      {@const isCur = current?.chain === n.chain && !done}
      <li class="node {n.kind}" class:reached={!!s} class:current={isCur} class:skipped={done && !s}>
        <div class="rail">
          <span class="bullet {s && s.result !== 'pass' && s.result !== 'skip' ? 'v-' + s.result : ''}"></span>
          {#if i < nodes.length - 1}<span class="stem"></span>{/if}
        </div>
        <div class="body">
          <div class="head">
            <code>{n.chain}</code>
            {#if s}
              {#if s.result === "pass"}
                <span class="res pass">↓ devam</span>
              {:else if s.result === "skip"}
                <span class="res skip">⤳ skip-to-policy</span>
              {:else}
                <span class="res pill v-{s.result}">{s.result}</span>
              {/if}
            {/if}
          </div>
          {#if s}<div class="note">{s.note}</div>{/if}

          {#if n.kind === "user" && userReached}
            <ul class="rules">
              {#each userRules as r, ri (r.id)}
                {@const checked = matchedIdx < 0 || ri <= matchedIdx}
                <li class:match={ri === matchedIdx} class:checked class:nomatch={checked && ri !== matchedIdx}>
                  <span class="mark">{ri === matchedIdx ? "●" : checked ? (ruleMatches(r, packet) ? "○" : "✕") : "·"}</span>
                  <code>[{firewall.ordered.indexOf(r) + 1}] {ruleCommand(r).replace(/^ufw /, "")}</code>
                </li>
              {:else}
                <li class="nomatch"><span class="mark">∅</span><span>bu yön için kullanıcı kuralı yok</span></li>
              {/each}
            </ul>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .flow {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .wire {
    width: 100%;
    height: auto;
  }

  .host {
    fill: var(--panel-2);
    stroke: var(--border);
  }

  .wire text {
    text-anchor: middle;
    font-family: var(--mono);
  }

  .h {
    fill: var(--muted);
    font-size: 10px;
  }

  .m {
    fill: var(--text);
    font-size: 11.5px;
  }

  .line {
    stroke: var(--border);
    stroke-width: 3;
    stroke-dasharray: 6 5;
  }

  .shield {
    fill: var(--panel-2);
    stroke: var(--muted);
    stroke-width: 2;
  }

  .shield.on {
    fill: color-mix(in srgb, var(--accent) 22%, var(--panel-2));
    stroke: var(--accent);
  }

  .fw {
    fill: var(--text);
    font-size: 11px;
    font-weight: 700;
  }

  .pkt {
    transition:
      cx 0.35s ease,
      fill 0.3s;
    filter: drop-shadow(0 0 6px currentColor);
  }

  .verdict {
    font-size: 11px;
    font-weight: 700;
    text-anchor: middle;
  }

  .chain {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .node {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 10px;
    opacity: 0.38;
    transition: opacity 0.25s;
  }

  .node.reached {
    opacity: 1;
  }

  .node.skipped {
    opacity: 0.22;
  }

  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .bullet {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--panel);
    margin-top: 4px;
    flex: none;
  }

  .reached .bullet {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 40%, var(--panel));
  }

  .bullet.v-ACCEPT {
    background: var(--ok);
    border-color: var(--ok);
    box-shadow: 0 0 10px var(--ok);
  }

  .bullet.v-DROP {
    background: var(--drop);
    border-color: var(--drop);
    box-shadow: 0 0 10px var(--drop);
  }

  .bullet.v-REJECT {
    background: var(--reject);
    border-color: var(--reject);
    box-shadow: 0 0 10px var(--reject);
  }

  .current .bullet {
    animation: pulse 0.6s ease-in-out infinite alternate;
  }

  @keyframes pulse {
    to {
      transform: scale(1.35);
      box-shadow: 0 0 12px var(--accent);
    }
  }

  .stem {
    width: 2px;
    flex: 1;
    min-height: 12px;
    background: var(--border);
  }

  .reached .stem {
    background: color-mix(in srgb, var(--accent) 50%, var(--border));
  }

  .body {
    padding-bottom: 10px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .head code {
    font-size: 12.5px;
    font-weight: 600;
  }

  .kernel .head code {
    color: var(--accent-2);
  }

  .user .head code {
    color: var(--accent);
  }

  .res {
    font-size: 11px;
  }

  .res.pass,
  .res.skip {
    color: var(--muted);
  }

  .note {
    color: var(--muted);
    font-size: 12px;
    margin-top: 2px;
    font-family: var(--mono);
  }

  .rules {
    list-style: none;
    margin: 6px 0 0;
    padding: 6px 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
  }

  .rules li {
    display: flex;
    gap: 8px;
    color: var(--muted);
  }

  .rules li.nomatch {
    text-decoration-color: var(--muted);
  }

  .rules li.match {
    color: var(--text);
    font-weight: 700;
  }

  .rules li:not(.checked) {
    opacity: 0.45;
  }

  .mark {
    width: 12px;
    text-align: center;
  }

  .match .mark {
    color: var(--accent);
  }
</style>
