<script lang="ts">
  import RuleTable from "$lib/components/RuleTable.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import { firewall } from "$lib/ufw/firewall.svelte";

  let view = $state<"table" | "status" | "user.rules">("table");
  const statusOut = $derived.by(() => {
    void firewall.revision;
    return firewall.status("verbose").join("\n");
  });
  const userRulesOut = $derived.by(() => {
    void firewall.revision;
    return firewall.userRules(false).join("\n");
  });
</script>

<header>
  <h1>Terminal</h1>
  <p class="muted">
    Gerçek <code>ufw</code> sözdizimiyle çalışan simülasyon. <kbd>↑</kbd>/<kbd>↓</kbd> geçmiş, <kbd>Tab</kbd> tamamlama,
    <kbd>Ctrl+L</kbd> temizle. Değişiklikler tüm sayfalarda paylaşılır.
  </p>
</header>

<div class="grid">
  <Terminal height="calc(100vh - 150px)" />

  <section class="panel">
    <div class="tabs">
      <button class:on={view === "table"} onclick={() => (view = "table")}>Kurallar</button>
      <button class:on={view === "status"} onclick={() => (view = "status")}>status verbose</button>
      <button class:on={view === "user.rules"} onclick={() => (view = "user.rules")}>/etc/ufw/user.rules</button>
    </div>
    {#if view === "table"}
      <RuleTable />
    {:else if view === "status"}
      <pre>{statusOut}</pre>
    {:else}
      <pre>{userRulesOut}</pre>
      <p class="muted small">ufw her kuralı bir <code>### tuple ###</code> satırı ve karşılık gelen iptables komutları olarak saklar.</p>
    {/if}
  </section>
</div>

<style>
  header {
    margin-bottom: 16px;
  }

  header p {
    margin: 6px 0 0;
  }

  kbd {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 5px;
    font-size: 11px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 16px;
    align-items: start;
  }

  .panel {
    max-height: calc(100vh - 150px);
    overflow: auto;
  }

  .tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .tabs button {
    font-size: 12px;
  }

  .tabs button.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
    overflow: auto;
  }

  .small {
    font-size: 12px;
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
