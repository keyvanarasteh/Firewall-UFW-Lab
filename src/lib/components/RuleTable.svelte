<script lang="ts">
  import { firewall, ruleFrom, ruleTo } from "$lib/ufw/firewall.svelte";

  let {
    highlight,
    showV6 = true,
    editable = true,
  }: { highlight?: number; showV6?: boolean; editable?: boolean } = $props();

  const rows = $derived(firewall.ordered.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => showV6 || !r.v6));

  function remove(n: number) {
    firewall.run(`sudo ufw --force delete ${n}`);
  }
</script>

{#if rows.length === 0}
  <div class="empty">Henüz kural yok. Terminalden <code>sudo ufw allow OpenSSH</code> gibi bir kural ekleyin.</div>
{:else}
  <table>
    <thead>
      <tr><th>#</th><th>To</th><th>Action</th><th>From</th>{#if editable}<th></th>{/if}</tr>
    </thead>
    <tbody>
      {#each rows as { r, n } (r.id)}
        <tr class:hit={highlight === r.id}>
          <td class="num">{n}</td>
          <td>{ruleTo(r)}</td>
          <td><span class="act a-{r.action}">{r.action.toUpperCase()} {r.direction.toUpperCase()}</span></td>
          <td>{ruleFrom(r)}{#if r.comment}<span class="muted"> # {r.comment}</span>{/if}</td>
          {#if editable}
            <td class="del"><button class="ghost" title="Kuralı sil (ufw delete {n})" onclick={() => remove(n)}>✕</button></td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 12.5px;
  }

  th {
    text-align: left;
    color: var(--muted);
    font-weight: 500;
    font-family: var(--sans);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 6px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }

  tr.hit td {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }

  .num {
    color: var(--muted);
    width: 32px;
  }

  .act {
    font-weight: 700;
  }

  .del {
    width: 36px;
    text-align: right;
  }

  .del button {
    padding: 0 6px;
    border: none;
    color: var(--muted);
  }

  .del button:hover {
    color: var(--drop);
  }

  .empty {
    color: var(--muted);
    padding: 12px 0;
  }
</style>
