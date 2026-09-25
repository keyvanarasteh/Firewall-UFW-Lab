<script lang="ts">
  import RuleTable from "$lib/components/RuleTable.svelte";
  import { LABS } from "$lib/data/labs";
  import { labProgress } from "$lib/progress.svelte";
  import { firewall } from "$lib/ufw/firewall.svelte";

  const v4 = $derived(firewall.rules.filter((r) => !r.v6));
  const counts = $derived({
    allow: v4.filter((r) => r.action === "allow").length,
    deny: v4.filter((r) => r.action === "deny").length,
    reject: v4.filter((r) => r.action === "reject").length,
    limit: v4.filter((r) => r.action === "limit").length,
  });
  const blocked = $derived(firewall.logs.filter((l) => l.includes("BLOCK")).length);

  const quick = [
    "sudo ufw status verbose",
    "sudo ufw enable --force",
    "sudo ufw disable",
    "sudo ufw allow OpenSSH",
    "sudo ufw default deny incoming",
    "sudo ufw logging medium",
  ];

  const modules = [
    { href: "/terminal", title: "Terminal", desc: "Gerçek ufw sözdizimiyle kural ekleyin, silin, sıralayın; user.rules çıktısını görün." },
    { href: "/visualizer", title: "Görselleştirme", desc: "Paketleri netfilter → ufw zincirlerinden adım adım geçirin; mimari diyagramı inceleyin." },
    { href: "/labs", title: "Lablar", desc: `${LABS.length} senaryo: ilk kurulum, web sunucusu, IP filtreleme, rate-limit, egress.` },
    { href: "/cheatsheet", title: "Cheatsheet", desc: "Linuxize UFW cheatsheet'i — her komut tek tıkla lab terminalinde çalışır." },
    { href: "/host", title: "Gerçek Sistem", desc: "Bu makinedeki gerçek ufw durumunu salt-okunur olarak sorgulayın (Tauri/Rust)." },
  ];
</script>

<header>
  <h1>UFW Laboratuvarı</h1>
  <p class="muted">
    UFW (Uncomplicated Firewall), Linux'ta iptables/nftables kurallarını yönetmek için basit bir önyüzdür. Bu lab, gerçek sisteme
    dokunmadan UFW'yi güvenle denemeniz için simüle edilmiş bir sunucu (<code>10.0.0.5</code>) sağlar.
  </p>
</header>

<div class="stats">
  <div class="panel stat">
    <span class="label">Durum</span>
    <span class="value" class:v-ACCEPT={firewall.enabled} class:v-DROP={!firewall.enabled}>{firewall.enabled ? "active" : "inactive"}</span>
  </div>
  <div class="panel stat">
    <span class="label">Varsayılan politika</span>
    <span class="value small">in: <b class="a-{firewall.defaults.incoming}">{firewall.defaults.incoming}</b> · out: <b class="a-{firewall.defaults.outgoing}">{firewall.defaults.outgoing}</b></span>
  </div>
  <div class="panel stat">
    <span class="label">IPv4 kuralları</span>
    <span class="value">{v4.length}</span>
    <span class="bars">
      {#each Object.entries(counts) as [k, n] (k)}
        {#if n}<span class="a-{k}" title="{k}: {n}">{k} {n}</span>{/if}
      {/each}
    </span>
  </div>
  <div class="panel stat">
    <span class="label">Engellenen (log)</span>
    <span class="value">{blocked}</span>
    <span class="bars muted">logging: {firewall.logging}</span>
  </div>
  <div class="panel stat">
    <span class="label">Lab ilerlemesi</span>
    <span class="value">{labProgress.done.length}/{LABS.length}</span>
  </div>
</div>

<div class="grid">
  <section class="modules">
    {#each modules as m (m.href)}
      <a class="panel module" href={m.href}>
        <strong>{m.title} →</strong>
        <span class="muted">{m.desc}</span>
      </a>
    {/each}
  </section>

  <section class="panel">
    <div class="row">
      <h3>Aktif kurallar</h3>
      <a href="/terminal">Terminalde düzenle</a>
    </div>
    <RuleTable showV6={false} />
    <h3 class="qa">Hızlı komutlar</h3>
    <div class="quick">
      {#each quick as q (q)}
        <button onclick={() => firewall.run(q)}><code>{q}</code></button>
      {/each}
    </div>
    <p class="muted small">Çıktıları Terminal sayfasında görebilirsiniz.</p>
  </section>
</div>

<section class="panel how">
  <h3>UFW bir paketi nasıl değerlendirir?</h3>
  <ol>
    <li><b>before.rules</b> — loopback, ESTABLISHED/RELATED bağlantılar, ICMP ve DHCP önce kabul edilir.</li>
    <li><b>user.rules</b> — sizin kurallarınız <i>yukarıdan aşağıya</i> denenir; <b>ilk eşleşen kazanır</b>.</li>
    <li><b>after.rules</b> — gürültülü broadcast trafiği loglanmadan politikaya gönderilir.</li>
    <li><b>Varsayılan politika</b> — hiçbir kural eşleşmezse <code>default deny/allow/reject</code> uygulanır, gerekirse <code>[UFW BLOCK]</code> loglanır.</li>
  </ol>
  <a href="/visualizer">Bunu canlı izleyin →</a>
</section>

<style>
  header {
    margin-bottom: 20px;
    max-width: 900px;
  }

  header h1 {
    font-size: 24px;
  }

  header p {
    line-height: 1.6;
    margin: 8px 0 0;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  .value {
    font-size: 22px;
    font-weight: 700;
    font-family: var(--mono);
  }

  .value.small {
    font-size: 14px;
    font-weight: 500;
  }

  .bars {
    display: flex;
    gap: 8px;
    font-size: 11px;
    font-family: var(--mono);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1.3fr;
    gap: 16px;
    align-items: start;
  }

  .modules {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .module {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-decoration: none;
    color: var(--text);
    transition: border-color 0.15s;
  }

  .module:hover {
    border-color: var(--accent);
  }

  .module strong {
    color: var(--accent);
  }

  .module span {
    font-size: 12.5px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .row a {
    font-size: 12px;
  }

  h3 {
    font-size: 14px;
  }

  .qa {
    margin: 18px 0 8px;
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .quick code {
    font-size: 11.5px;
  }

  .small {
    font-size: 12px;
  }

  .how {
    margin-top: 16px;
  }

  .how ol {
    line-height: 1.8;
    margin: 10px 0;
  }

  @media (max-width: 1150px) {
    .stats {
      grid-template-columns: repeat(3, 1fr);
    }
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
