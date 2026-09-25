<script lang="ts">
  import { tick } from "svelte";
  import { firewall } from "$lib/ufw/firewall.svelte";

  let { height = "100%", placeholder = "sudo ufw status verbose" }: { height?: string; placeholder?: string } = $props();

  let input = $state("");
  let histIdx = $state(-1);
  let screen: HTMLDivElement;
  let field: HTMLInputElement;

  const COMPLETIONS = [
    "sudo ufw status verbose",
    "sudo ufw status numbered",
    "sudo ufw enable",
    "sudo ufw disable",
    "sudo ufw reload",
    "sudo ufw reset",
    "sudo ufw default deny incoming",
    "sudo ufw default allow outgoing",
    "sudo ufw allow OpenSSH",
    "sudo ufw allow 80/tcp",
    "sudo ufw allow 443/tcp",
    "sudo ufw limit 22/tcp",
    "sudo ufw app list",
    "sudo ufw logging medium",
    "sudo ufw show added",
    "sudo cat /etc/ufw/user.rules",
    "sudo tail /var/log/ufw.log",
    "ss -tulpn",
    "systemctl status ufw",
  ];

  $effect(() => {
    void firewall.lines.length;
    tick().then(() => screen?.scrollTo({ top: screen.scrollHeight }));
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    firewall.run(input);
    input = "";
    histIdx = -1;
  }

  function onKey(e: KeyboardEvent) {
    const h = firewall.history;
    if (e.key === "ArrowUp" && h.length) {
      e.preventDefault();
      histIdx = histIdx < 0 ? h.length - 1 : Math.max(0, histIdx - 1);
      input = h[histIdx];
    } else if (e.key === "ArrowDown" && histIdx >= 0) {
      e.preventDefault();
      histIdx = histIdx + 1 >= h.length ? -1 : histIdx + 1;
      input = histIdx < 0 ? "" : h[histIdx];
    } else if (e.key === "Tab") {
      e.preventDefault();
      const match = COMPLETIONS.find((c) => c.startsWith(input) && c !== input);
      if (match) input = match;
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      firewall.lines = [];
    }
  }

  export function focus() {
    field?.focus();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="term" style:height onclick={() => field.focus()}>
  <div class="bar">
    <span class="dots"><i></i><i></i><i></i></span>
    <span>lab@ufw-lab: ~</span>
    <button class="ghost clear" onclick={() => (firewall.lines = [])}>clear</button>
  </div>
  <div class="screen" bind:this={screen}>
    {#each firewall.lines as line, i (i)}
      {#if line.kind === "cmd"}
        <div class="cmd"><span class="prompt">lab@ufw-lab:~$</span> {line.text}</div>
      {:else}
        <div class={line.kind}>{line.text}</div>
      {/if}
    {/each}
    <form onsubmit={submit} class="input-row">
      <span class="prompt">{firewall.pending ? ">" : "lab@ufw-lab:~$"}</span>
      <input
        bind:this={field}
        bind:value={input}
        onkeydown={onKey}
        spellcheck="false"
        autocomplete="off"
        placeholder={firewall.pending ? "y / n" : placeholder}
        aria-label="Terminal komutu"
      />
    </form>
  </div>
</div>

<style>
  .term {
    background: var(--term-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--mono);
    font-size: 12.5px;
    color: #cfd8e3;
    min-height: 200px;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    background: #121820;
    border-bottom: 1px solid #1f2933;
    color: #7d8a97;
    font-size: 11.5px;
  }

  .dots {
    display: flex;
    gap: 5px;
  }

  .dots i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff5f57;
  }
  .dots i:nth-child(2) {
    background: #febc2e;
  }
  .dots i:nth-child(3) {
    background: #28c840;
  }

  .clear {
    margin-left: auto;
    padding: 1px 8px;
    font-size: 11px;
    color: #7d8a97;
    border-color: #26313c;
  }

  .screen {
    flex: 1;
    overflow: auto;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .prompt {
    color: #3ddc84;
    font-weight: 600;
  }

  .cmd {
    color: #fff;
  }

  .err {
    color: #ff6b6b;
  }

  .info {
    color: #82aaff;
  }

  .input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .input-row input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 0;
    color: #fff;
    font-family: var(--mono);
    font-size: 12.5px;
  }

  .input-row input:focus {
    outline: none;
  }
</style>
