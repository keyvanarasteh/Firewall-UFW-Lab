<script lang="ts">
  import RuleTable from "$lib/components/RuleTable.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import { LABS } from "$lib/data/labs";
  import { labProgress } from "$lib/progress.svelte";
  import { firewall } from "$lib/ufw/firewall.svelte";

  let selectedId = $state(LABS[0].id);
  let showHints = $state(false);

  const lab = $derived(LABS.find((l) => l.id === selectedId)!);
  const checks = $derived.by(() => {
    void firewall.revision;
    return lab.check(firewall);
  });
  const passed = $derived(checks.filter((c) => c.ok).length);
  const complete = $derived(passed === checks.length);

  $effect(() => {
    if (complete) labProgress.markDone(lab.id);
  });

  function start() {
    firewall.factoryReset();
    firewall.banner();
    firewall.lines.push({ kind: "info", text: `— ${lab.title} başladı. ufw fabrika ayarlarına döndü. —` });
    showHints = false;
  }
</script>

<header>
  <h1>Lablar</h1>
  <p class="muted">Senaryoyu okuyun, terminalde komutları yazın. Kontroller gerçek zamanlı olarak simüle edilen paketlerle doğrulanır.</p>
</header>

<div class="layout">
  <nav class="list">
    {#each LABS as l (l.id)}
      <button class:sel={l.id === selectedId} onclick={() => ((selectedId = l.id), (showHints = false))}>
        <span class="lvl lvl-{l.level}">{l.level}</span>
        <span class="t">{l.title}</span>
        {#if labProgress.done.includes(l.id)}<span class="done" title="Tamamlandı">✓</span>{/if}
      </button>
    {/each}
    <p class="muted prog">{labProgress.done.length} / {LABS.length} tamamlandı</p>
  </nav>

  <div class="main">
    <section class="panel detail">
      <div class="top">
        <div>
          <h2>{lab.title}</h2>
          <p class="scenario">{lab.scenario}</p>
        </div>
        <button onclick={start} title="ufw'yi sıfırlar (kurallar silinir)">↺ Labı sıfırla ve başlat</button>
      </div>

      <div class="cols">
        <div>
          <h3>Görevler</h3>
          <ol class="tasks">
            {#each lab.tasks as t (t)}<li>{t}</li>{/each}
          </ol>

          <button class="ghost hint-toggle" onclick={() => (showHints = !showHints)}>{showHints ? "İpuçlarını gizle" : "İpuçlarını göster"}</button>
          {#if showHints}
            <ul class="hints">
              {#each lab.hints as h (h)}
                <li><code>{h}</code><button title="Terminalde çalıştır" onclick={() => firewall.run(h.includes("enable") && !h.includes("--force") ? h + " --force" : h)}>▶</button></li>
              {/each}
            </ul>
          {/if}
        </div>

        <div>
          <h3>Kontroller <span class="score" class:ok={complete}>{passed}/{checks.length}</span></h3>
          <ul class="checks">
            {#each checks as c (c.label)}
              <li class:ok={c.ok}><span class="ico">{c.ok ? "✔" : "○"}</span>{c.label}</li>
            {/each}
          </ul>
          <div class="bar"><div style:width="{(passed / checks.length) * 100}%" class:ok={complete}></div></div>
          {#if complete}<p class="congrats">Tebrikler — lab tamamlandı! 🎉</p>{/if}
        </div>
      </div>
    </section>

    <div class="work">
      <Terminal height="360px" />
      <section class="panel">
        <h3>Kurallar</h3>
        <RuleTable showV6={false} />
      </section>
    </div>
  </div>
</div>

<style>
  header {
    margin-bottom: 16px;
  }

  header p {
    margin: 6px 0 0;
  }

  .layout {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 16px;
    align-items: start;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .list button {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
    text-align: left;
    padding: 10px 12px;
    background: var(--panel);
  }

  .list button.sel {
    border-color: var(--accent);
  }

  .lvl {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    grid-column: 1;
  }

  .lvl-Başlangıç {
    color: var(--ok);
  }
  .lvl-Orta {
    color: var(--reject);
  }
  .lvl-İleri {
    color: var(--drop);
  }

  .t {
    grid-column: 1;
    font-weight: 600;
  }

  .done {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: center;
    color: var(--ok);
    font-weight: 700;
  }

  .prog {
    font-size: 12px;
    margin: 6px 4px;
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }

  h2 {
    font-size: 18px;
  }

  h3 {
    font-size: 13px;
    margin: 16px 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scenario {
    margin: 8px 0 0;
    line-height: 1.6;
    max-width: 780px;
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .tasks {
    margin: 0;
    padding-left: 20px;
    line-height: 1.8;
  }

  .hint-toggle {
    margin-top: 10px;
    font-size: 12px;
  }

  .hints {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hints li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 4px 4px 10px;
  }

  .hints code {
    font-size: 12px;
    color: var(--accent);
  }

  .hints button {
    padding: 1px 8px;
    font-size: 11px;
  }

  .score {
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--panel-2);
    border: 1px solid var(--border);
  }

  .score.ok {
    color: var(--ok);
    border-color: var(--ok);
  }

  .checks {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .checks li {
    display: flex;
    gap: 8px;
    color: var(--muted);
  }

  .checks li.ok {
    color: var(--text);
  }

  .checks .ico {
    width: 16px;
  }

  .checks li.ok .ico {
    color: var(--ok);
  }

  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-2);
    margin-top: 14px;
    overflow: hidden;
  }

  .bar div {
    height: 100%;
    background: var(--accent);
    transition: width 0.3s;
  }

  .bar div.ok {
    background: var(--ok);
  }

  .congrats {
    color: var(--ok);
    font-weight: 600;
  }

  .work {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 16px;
    align-items: start;
  }

  .work h3 {
    margin-top: 0;
  }

  @media (max-width: 1200px) {
    .work,
    .cols {
      grid-template-columns: 1fr;
    }
  }
</style>
