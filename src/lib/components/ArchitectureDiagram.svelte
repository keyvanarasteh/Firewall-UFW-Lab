<script lang="ts">
  import { firewall } from "$lib/ufw/firewall.svelte";

  type Key = keyof typeof INFO;

  const INFO = {
    user: {
      title: "Kullanıcı / yönetici",
      body: "sudo ufw allow 22/tcp gibi komutlar yazılır. ufw, iptables sözdizimini gizleyen basit bir önyüzdür (Uncomplicated FireWall).",
    },
    cli: {
      title: "ufw (Python CLI)",
      body: "Komutu ayrıştırır, kuralı bir 'tuple' olarak user.rules dosyasına yazar ve güvenlik duvarı aktifse iptables-restore ile çekirdeğe yükler. Ayarlar: /etc/default/ufw, /etc/ufw/ufw.conf, profiller: /etc/ufw/applications.d/.",
    },
    before: {
      title: "/etc/ufw/before.rules",
      body: "Kullanıcı kurallarından ÖNCE çalışır: loopback, RELATED/ESTABLISHED bağlantılar, INVALID paketlerin düşürülmesi, ICMP (ping) ve DHCP izinleri burada. Bu yüzden 'ufw deny' ile ping engellenmez — before.rules'ta düzenlemek gerekir.",
    },
    user_rules: {
      title: "/etc/ufw/user.rules",
      body: "ufw allow/deny/limit ile eklediğiniz kurallar. Sıra önemlidir: ilk eşleşen kural kazanır. 'ufw insert N' ile araya kural eklenir.",
    },
    after: {
      title: "/etc/ufw/after.rules",
      body: "Kullanıcı kurallarından SONRA çalışır: NetBIOS, SMB ve DHCP broadcast gürültüsünü loglamadan politikaya gönderir. Ardından after-logging zinciri [UFW BLOCK] loglarını yazar.",
    },
    backend: {
      title: "iptables-restore (nft / legacy)",
      body: "Kural dosyaları iptables-restore ile yüklenir. Modern dağıtımlarda iptables-nft kullanılır; kurallar aslında nftables altyapısında 'ip filter' tablosuna yazılır.",
    },
    netfilter: {
      title: "Netfilter (çekirdek)",
      body: "Paketler çekirdekteki kancalardan (hook) geçer: PREROUTING → yönlendirme kararı → INPUT (yerel) veya FORWARD (geçiş) → OUTPUT → POSTROUTING. ufw, filter tablosunun INPUT / OUTPUT / FORWARD zincirlerine kendi zincirlerini bağlar.",
    },
    nic: {
      title: "Ağ arayüzü (eth0)",
      body: "Paketler NIC'ten çekirdeğe girer ve buradan çıkar. ufw 'on eth0' ile kuralları belirli bir arayüze bağlayabilir.",
    },
  } as const;

  let selected = $state<Key>("netfilter");

  const inRules = $derived(firewall.rules.filter((r) => r.direction === "in" && !r.v6).length);
  const outRules = $derived(firewall.rules.filter((r) => r.direction === "out" && !r.v6).length);

  const inputChains = $derived([
    { name: "ufw-before-logging-input", file: "before" as Key, note: "log kancası" },
    { name: "ufw-before-input", file: "before" as Key, note: "lo · ESTABLISHED · ICMP · DHCP" },
    { name: "ufw-user-input", file: "user_rules" as Key, note: `${inRules} kullanıcı kuralı` },
    { name: "ufw-after-input", file: "after" as Key, note: "NetBIOS/SMB gürültüsü" },
    { name: "ufw-after-logging-input", file: "after" as Key, note: firewall.logging === "off" ? "log kapalı" : "[UFW BLOCK]" },
    { name: "ufw-reject-input", file: "after" as Key, note: "reject kancası" },
    { name: "ufw-track-input", file: "after" as Key, note: "conntrack" },
    { name: `policy: ${firewall.defaults.incoming}`, file: "cli" as Key, note: "/etc/default/ufw" },
  ]);
</script>

<div class="arch">
  <div class="stack">
    <button class="layer" class:sel={selected === "user"} onclick={() => (selected = "user")}>
      <span class="tag">1</span>
      <div><strong>Kullanıcı</strong><code>$ sudo ufw allow 22/tcp</code></div>
    </button>
    <div class="arrow">▼</div>
    <button class="layer cli" class:sel={selected === "cli"} onclick={() => (selected = "cli")}>
      <span class="tag">2</span>
      <div><strong>ufw CLI</strong><code>/usr/sbin/ufw · /etc/default/ufw · applications.d</code></div>
    </button>
    <div class="arrow">▼ yazar</div>
    <div class="files">
      <button class="file" class:sel={selected === "before"} onclick={() => (selected = "before")}>before.rules</button>
      <button class="file user" class:sel={selected === "user_rules"} onclick={() => (selected = "user_rules")}>
        user.rules <small>{firewall.rules.filter((r) => !r.v6).length} kural</small>
      </button>
      <button class="file" class:sel={selected === "after"} onclick={() => (selected = "after")}>after.rules</button>
    </div>
    <div class="arrow">▼ iptables-restore</div>
    <button class="layer" class:sel={selected === "backend"} onclick={() => (selected = "backend")}>
      <span class="tag">3</span>
      <div><strong>iptables / nftables</strong><code>filter tablosu: INPUT → ufw-* zincirleri</code></div>
    </button>
    <div class="arrow">▼ çekirdeğe yükler</div>
    <button class="layer kernel" class:sel={selected === "netfilter"} onclick={() => (selected = "netfilter")}>
      <span class="tag">4</span>
      <div><strong>Linux çekirdeği — Netfilter</strong><code>{firewall.enabled ? "ufw zincirleri yüklü" : "ufw pasif — zincirler boş"}</code></div>
    </button>
  </div>

  <div class="right">
    <div class="panel">
      <h3>Netfilter kancaları</h3>
      <svg viewBox="0 0 640 230" class="hooks" role="img" aria-label="Netfilter paket yolu">
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="var(--muted)" />
          </marker>
        </defs>
        <!-- paths -->
        <g stroke="var(--muted)" stroke-width="1.6" fill="none" marker-end="url(#ah)">
          <path d="M70 185 H112" />
          <path d="M192 185 H232" />
          <path d="M292 185 H388" />
          <path d="M468 185 H510" />
          <path d="M262 165 V108" />
          <path d="M262 68 V40 H292" />
          <path d="M372 40 H410 V60" />
          <path d="M440 100 V165" />
          <path d="M590 185 H620" />
        </g>
        <text x="330" y="176" class="lbl">FORWARD</text>

        <g class="node nic" role="button" tabindex="0" onclick={() => (selected = "nic")} onkeydown={(e) => e.key === "Enter" && (selected = "nic")}>
          <rect x="6" y="168" width="64" height="34" rx="6" /><text x="38" y="189">eth0</text>
        </g>
        <g class="node"><rect x="112" y="168" width="80" height="34" rx="6" /><text x="152" y="189">PREROUTING</text></g>
        <g class="node route">
          <polygon points="262,165 292,185 262,205 232,185" /><text x="262" y="222" class="lbl">routing</text>
        </g>
        <g class="node ufw" class:off={!firewall.enabled} role="button" tabindex="0" onclick={() => (selected = "netfilter")} onkeydown={(e) => e.key === "Enter" && (selected = "netfilter")}>
          <rect x="222" y="68" width="80" height="40" rx="6" /><text x="262" y="86">INPUT</text><text x="262" y="100" class="small">ufw-*-input</text>
        </g>
        <g class="node proc"><rect x="292" y="22" width="80" height="36" rx="6" /><text x="332" y="44">yerel süreç</text></g>
        <g class="node ufw" class:off={!firewall.enabled}>
          <rect x="400" y="60" width="80" height="40" rx="6" /><text x="440" y="78">OUTPUT</text><text x="440" y="92" class="small">ufw-*-output</text>
        </g>
        <g class="node"><rect x="388" y="168" width="80" height="34" rx="6" /><text x="428" y="189">FORWARD</text></g>
        <g class="node"><rect x="510" y="168" width="80" height="34" rx="6" /><text x="550" y="189">POSTROUTING</text></g>
      </svg>
      <p class="muted small-text">Mavi kutular ufw'nin zincir bağladığı noktalar. Gelen paketler <b>INPUT</b>, sunucunun başlattığı bağlantılar <b>OUTPUT</b> kancasından geçer.</p>
    </div>

    <div class="panel">
      <h3>INPUT içindeki ufw zincir sırası</h3>
      <ol class="chain">
        {#each inputChains as c, i (c.name)}
          <li>
            <button class:sel={selected === c.file} class:user={c.file === "user_rules"} onclick={() => (selected = c.file)}>
              <span class="idx">{i + 1}</span>
              <code>{c.name}</code>
              <span class="note">{c.note}</span>
            </button>
          </li>
        {/each}
      </ol>
      <p class="muted small-text">Giden trafik için aynı yapı <code>*-output</code> zincirleriyle, IPv6 için <code>ufw6-*</code> zincirleriyle tekrarlanır ({outRules} giden kural).</p>
    </div>

    <div class="panel info">
      <h3>{INFO[selected].title}</h3>
      <p>{INFO[selected].body}</p>
    </div>
  </div>
</div>

<style>
  .arch {
    display: grid;
    grid-template-columns: minmax(280px, 380px) 1fr;
    gap: 20px;
    align-items: start;
  }

  .stack {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .layer {
    display: flex;
    gap: 12px;
    align-items: center;
    text-align: left;
    padding: 12px 14px;
    background: var(--panel);
    border-radius: var(--radius);
  }

  .layer div {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .layer code {
    font-size: 11.5px;
    color: var(--muted);
  }

  .layer.kernel {
    border-color: color-mix(in srgb, var(--accent-2) 60%, var(--border));
  }

  .tag {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--panel-2);
    border: 1px solid var(--border);
    font-size: 12px;
    color: var(--muted);
    flex: none;
  }

  .sel {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 1px var(--accent);
  }

  .arrow {
    text-align: center;
    color: var(--muted);
    font-size: 11px;
    padding: 4px 0;
  }

  .files {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .file {
    font-family: var(--mono);
    font-size: 11.5px;
    padding: 10px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .file.user {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }

  .file small {
    color: var(--muted);
    font-size: 10px;
  }

  .right {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h3 {
    font-size: 14px;
    margin-bottom: 10px;
  }

  .hooks {
    width: 100%;
    height: auto;
  }

  .hooks text {
    fill: var(--text);
    font-size: 11px;
    text-anchor: middle;
    font-family: var(--mono);
  }

  .hooks .small {
    font-size: 9px;
    fill: var(--muted);
  }

  .hooks .lbl {
    fill: var(--muted);
    font-size: 10px;
  }

  .node rect,
  .node polygon {
    fill: var(--panel-2);
    stroke: var(--border);
    stroke-width: 1.4;
  }

  .node.ufw rect {
    fill: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
    stroke: var(--accent);
  }

  .node.ufw.off rect {
    fill: var(--panel-2);
    stroke: var(--border);
    stroke-dasharray: 4 3;
  }

  .node.proc rect {
    stroke: var(--accent-2);
  }

  .node[role="button"] {
    cursor: pointer;
  }

  .small-text {
    font-size: 12px;
    margin: 8px 0 0;
  }

  .chain {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chain button {
    width: 100%;
    display: grid;
    grid-template-columns: 24px 220px 1fr;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 6px 10px;
  }

  .chain button.user {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }

  .idx {
    color: var(--muted);
    font-size: 11px;
  }

  .chain code {
    font-size: 12px;
  }

  .note {
    color: var(--muted);
    font-size: 12px;
  }

  .info p {
    margin: 0;
    line-height: 1.6;
  }

  @media (max-width: 1100px) {
    .arch {
      grid-template-columns: 1fr;
    }
  }
</style>
