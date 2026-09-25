<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { firewall } from "$lib/ufw/firewall.svelte";

  let { children } = $props();

  const nav = [
    { href: "/", label: "Genel Bakış", icon: "◈" },
    { href: "/terminal", label: "Terminal", icon: "❯" },
    { href: "/visualizer", label: "Görselleştirme", icon: "⇶" },
    { href: "/labs", label: "Lablar", icon: "⚑" },
    { href: "/cheatsheet", label: "Cheatsheet", icon: "☰" },
    { href: "/host", label: "Gerçek Sistem", icon: "⌂" },
  ];

  const isActive = (href: string) => (href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href));
</script>

<div class="shell">
  <aside>
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
          <path d="M16 2 4 7v8c0 7.5 5.1 13.4 12 15 6.9-1.6 12-7.5 12-15V7z" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M9 12h14M9 16h14M9 20h14M13 12v4M19 16v4M15 20v4" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </div>
      <div>
        <div class="title">UFW Lab</div>
        <div class="sub">Firewall Laboratuvarı</div>
      </div>
    </div>

    <nav>
      {#each nav as item (item.href)}
        <a href={item.href} class:active={isActive(item.href)}>
          <span class="icon">{item.icon}</span>{item.label}
        </a>
      {/each}
    </nav>

    <div class="status">
      <div class="row">
        <span class="dot" class:on={firewall.enabled}></span>
        <strong>{firewall.enabled ? "active" : "inactive"}</strong>
      </div>
      <div class="kv"><span>incoming</span><code class="a-{firewall.defaults.incoming}">{firewall.defaults.incoming}</code></div>
      <div class="kv"><span>outgoing</span><code class="a-{firewall.defaults.outgoing}">{firewall.defaults.outgoing}</code></div>
      <div class="kv"><span>kurallar</span><code>{firewall.rules.length}</code></div>
      <div class="kv"><span>logging</span><code>{firewall.logging}</code></div>
      <div class="host">lab@ufw-lab · 10.0.0.5</div>
    </div>
  </aside>

  <main>
    {@render children()}
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100vh;
  }

  aside {
    background: var(--bg-2);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 12px;
    gap: 20px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 6px;
  }

  .logo {
    color: var(--accent);
    display: grid;
  }

  .title {
    font-weight: 700;
    font-size: 16px;
  }

  .sub {
    font-size: 11px;
    color: var(--muted);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  nav a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--muted);
    text-decoration: none;
    font-weight: 500;
  }

  nav a:hover {
    background: var(--panel);
    color: var(--text);
  }

  nav a.active {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
  }

  .icon {
    width: 18px;
    text-align: center;
  }

  .status {
    margin-top: auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--drop);
    box-shadow: 0 0 8px var(--drop);
  }

  .dot.on {
    background: var(--ok);
    box-shadow: 0 0 8px var(--ok);
  }

  .kv {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
  }

  .host {
    margin-top: 4px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }

  main {
    overflow: auto;
    padding: 24px 28px;
  }
</style>
