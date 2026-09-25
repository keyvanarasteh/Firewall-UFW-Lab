<script lang="ts">
  import Terminal from "$lib/components/Terminal.svelte";
  import { CHEATSHEET, CHEATSHEET_SOURCE, RELATED_GUIDES, TROUBLESHOOTING } from "$lib/data/cheatsheet";
  import { openExternal } from "$lib/open";
  import { firewall } from "$lib/ufw/firewall.svelte";

  let query = $state("");
  let showTr = $state(true);
  let copied = $state<string | null>(null);

  const sections = $derived(
    CHEATSHEET.map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        const q = query.trim().toLowerCase();
        return !q || i.cmd.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q) || i.tr.toLowerCase().includes(q);
      }),
    })).filter((s) => s.items.length > 0),
  );

  async function copy(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      copied = cmd;
      setTimeout(() => (copied = null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  // inline `code` in troubleshooting text
  const parts = (s: string) => s.split(/`([^`]+)`/g);
</script>

<header>
  <div>
    <h1>UFW Cheatsheet</h1>
    <p class="muted">
      Quick reference for managing firewall rules with UFW on Linux — kaynak:
      <a href={CHEATSHEET_SOURCE} onclick={(e) => (e.preventDefault(), openExternal(CHEATSHEET_SOURCE))}>linuxize.com/cheatsheet/ufw</a>
    </p>
  </div>
  <div class="tools">
    <input type="search" placeholder="Komut ara… (ör. limit, 3306, profile)" bind:value={query} />
    <label><input type="checkbox" bind:checked={showTr} /> Türkçe açıklama</label>
  </div>
</header>

<div class="layout">
  <div class="sections">
    {#each sections as s (s.id)}
      <section class="panel">
        <h2>{s.title}</h2>
        <p class="muted intro">{s.intro}</p>
        <table>
          <thead><tr><th>Command</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {#each s.items as item (item.cmd)}
              <tr>
                <td><code>{item.cmd}</code></td>
                <td>
                  {item.desc}
                  {#if showTr}<div class="tr">{item.tr}</div>{/if}
                </td>
                <td class="act">
                  <button title="Lab terminalinde çalıştır" onclick={() => firewall.run(item.cmd)}>▶</button>
                  <button title="Kopyala" onclick={() => copy(item.cmd)}>{copied === item.cmd ? "✓" : "⧉"}</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {:else}
      <p class="muted">"{query}" için sonuç yok.</p>
    {/each}

    {#if !query}
      <section class="panel">
        <h2>Troubleshooting</h2>
        <p class="muted intro">Quick checks for common UFW issues.</p>
        <table>
          <thead><tr><th>Issue</th><th>Check</th></tr></thead>
          <tbody>
            {#each TROUBLESHOOTING as t (t.issue)}
              <tr>
                <td>{t.issue}</td>
                <td>
                  {#each parts(t.check) as p, i (i)}{#if i % 2}<code>{p}</code>{:else}{p}{/if}{/each}
                  {#if showTr}<div class="tr">{t.tr}</div>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Related Guides</h2>
        <p class="muted intro">Use these guides for full UFW workflows.</p>
        <table>
          <tbody>
            {#each RELATED_GUIDES as g (g.url)}
              <tr>
                <td><a href={g.url} onclick={(e) => (e.preventDefault(), openExternal(g.url))}>{g.title}</a></td>
                <td class="muted">{g.desc}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}
  </div>

  <aside>
    <div class="sticky">
      <p class="muted hint">▶ ile çalıştırılan komutlar bu terminale gider.</p>
      <Terminal height="calc(100vh - 190px)" />
    </div>
  </aside>
</div>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  header p {
    margin: 6px 0 0;
  }

  .tools {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .tools input[type="search"] {
    width: 300px;
  }

  .tools label {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--muted);
    font-size: 12px;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 440px;
    gap: 16px;
    align-items: start;
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h2 {
    font-size: 16px;
  }

  .intro {
    margin: 4px 0 10px;
    font-size: 12.5px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    color: var(--muted);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    vertical-align: top;
  }

  td:first-child {
    width: 46%;
  }

  td code {
    font-size: 12.5px;
    color: var(--accent);
  }

  .tr {
    color: var(--muted);
    font-size: 12px;
    margin-top: 2px;
  }

  .act {
    width: 84px;
    white-space: nowrap;
    text-align: right;
  }

  .act button {
    padding: 2px 8px;
    font-size: 12px;
  }

  .sticky {
    position: sticky;
    top: 0;
  }

  .hint {
    margin: 0 0 8px;
    font-size: 12px;
  }

  @media (max-width: 1150px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
