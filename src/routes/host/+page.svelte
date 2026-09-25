<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { isTauri } from "$lib/open";

  interface HostOutput {
    command: string;
    ok: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
  }

  const QUERIES = [
    { kind: "status", label: "ufw status verbose", root: true },
    { kind: "numbered", label: "ufw status numbered", root: true },
    { kind: "added", label: "ufw show added", root: true },
    { kind: "apps", label: "ufw app list", root: true },
    { kind: "version", label: "ufw version", root: false },
    { kind: "listening", label: "ss -tulpn", root: false },
  ];

  let elevate = $state(false);
  let busy = $state<string | null>(null);
  let result = $state<HostOutput | null>(null);
  let error = $state<string | null>(null);

  async function run(kind: string) {
    busy = kind;
    error = null;
    try {
      result = await invoke<HostOutput>("host_query", { kind, elevate });
    } catch (e) {
      error = String(e);
      result = null;
    } finally {
      busy = null;
    }
  }
</script>

<header>
  <h1>Gerçek Sistem</h1>
  <p class="muted">
    Bu makinedeki gerçek UFW'yi <b>salt-okunur</b> olarak sorgular. Uygulama kural ekleyemez veya silemez — denemeler için simülasyonu
    kullanın.
  </p>
</header>

{#if !isTauri()}
  <div class="panel warn">Bu sayfa yalnızca Tauri masaüstü uygulamasında çalışır (<code>npm run tauri dev</code>).</div>
{:else}
  <section class="panel">
    <div class="controls">
      {#each QUERIES as q (q.kind)}
        <button onclick={() => run(q.kind)} disabled={busy !== null}>
          {busy === q.kind ? "…" : "▶"} <code>{q.label}</code>{#if q.root}<span class="root">root</span>{/if}
        </button>
      {/each}
    </div>
    <label class="elev">
      <input type="checkbox" bind:checked={elevate} />
      <span><code>pkexec</code> ile yetki yükselt (polkit parola penceresi açılır). Kapalıyken <code>sudo -n</code> denenir.</span>
    </label>
  </section>

  {#if error}
    <div class="panel err">{error}</div>
  {/if}

  {#if result}
    <section class="panel out">
      <div class="head">
        <code>$ {result.command}</code>
        <span class="pill {result.ok ? 'v-ACCEPT' : 'v-DROP'}">exit {result.code ?? "?"}</span>
      </div>
      {#if result.stdout}<pre>{result.stdout}</pre>{/if}
      {#if result.stderr}<pre class="stderr">{result.stderr}</pre>{/if}
      {#if !result.ok && /root|password|sudo/i.test(result.stderr)}
        <p class="muted">İpucu: ufw root yetkisi ister. <b>pkexec</b> seçeneğini açıp tekrar deneyin.</p>
      {/if}
    </section>
  {/if}
{/if}

<style>
  header {
    margin-bottom: 16px;
  }

  header p {
    margin: 6px 0 0;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .controls button {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .root {
    font-size: 10px;
    color: var(--reject);
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 0 4px;
  }

  .elev {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 14px;
    color: var(--muted);
    font-size: 12.5px;
  }

  .out,
  .err {
    margin-top: 16px;
  }

  .err,
  .warn {
    color: var(--reject);
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  pre {
    margin: 0;
    background: var(--term-bg);
    color: #cfd8e3;
    padding: 12px;
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.5;
    overflow: auto;
  }

  .stderr {
    color: #ff8a80;
    margin-top: 8px;
  }
</style>
