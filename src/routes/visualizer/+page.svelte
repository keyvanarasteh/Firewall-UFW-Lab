<script lang="ts">
  import ArchitectureDiagram from "$lib/components/ArchitectureDiagram.svelte";
  import PacketFlow from "$lib/components/PacketFlow.svelte";
  import RuleTable from "$lib/components/RuleTable.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import { firewall, HOST_IFACE, HOST_IP } from "$lib/ufw/firewall.svelte";
  import type { Evaluation, Packet } from "$lib/ufw/types";

  interface Preset {
    label: string;
    pkt: Partial<Packet>;
  }

  const PRESETS: Preset[] = [
    { label: "SSH — internetten", pkt: { direction: "in", src: "198.51.100.7", dport: 22, proto: "tcp" } },
    { label: "HTTP — ziyaretçi", pkt: { direction: "in", src: "198.51.100.7", dport: 80, proto: "tcp" } },
    { label: "HTTPS — ziyaretçi", pkt: { direction: "in", src: "198.51.100.7", dport: 443, proto: "tcp" } },
    { label: "MySQL — iç ağ", pkt: { direction: "in", src: "10.0.0.20", dport: 3306, proto: "tcp" } },
    { label: "MySQL — internet", pkt: { direction: "in", src: "198.51.100.7", dport: 3306, proto: "tcp" } },
    { label: "Saldırgan 203.0.113.10", pkt: { direction: "in", src: "203.0.113.10", dport: 80, proto: "tcp" } },
    { label: "Telnet (23)", pkt: { direction: "in", src: "198.51.100.7", dport: 23, proto: "tcp" } },
    { label: "Ping (ICMP)", pkt: { direction: "in", src: "198.51.100.7", dport: 0, proto: "icmp" } },
    { label: "NetBIOS 137/udp", pkt: { direction: "in", src: "10.0.0.30", dport: 137, proto: "udp" } },
    { label: "Yanıt paketi (ESTABLISHED)", pkt: { direction: "in", src: "93.184.216.34", dport: 51514, sport: 443, proto: "tcp", established: true } },
    { label: "IPv6 SSH", pkt: { direction: "in", src: "2001:db8::7", dst: "2001:db8::5", dport: 22, proto: "tcp" } },
    { label: "Loopback", pkt: { direction: "in", src: "127.0.0.1", dst: "127.0.0.1", dport: 5432, proto: "tcp", iface: "lo" } },
    { label: "Giden DNS 53/udp", pkt: { direction: "out", dst: "1.1.1.1", dport: 53, proto: "udp" } },
    { label: "Giden HTTPS", pkt: { direction: "out", dst: "93.184.216.34", dport: 443, proto: "tcp" } },
    { label: "Giden SMTP 25", pkt: { direction: "out", dst: "93.184.216.34", dport: 25, proto: "tcp" } },
  ];

  let tab = $state<"flow" | "arch">("flow");

  let packet = $state<Packet>({
    direction: "in",
    src: "198.51.100.7",
    dst: HOST_IP,
    sport: 51000,
    dport: 22,
    proto: "tcp",
    established: false,
    iface: HOST_IFACE,
  });

  let evaluation = $state<Evaluation | null>(null);
  let events = $state<{ t: string; pkt: Packet; verdict: string; rule?: string }[]>([]);

  function applyPreset(p: Preset) {
    const dir = p.pkt.direction ?? "in";
    packet = {
      direction: dir,
      src: dir === "in" ? (p.pkt.src ?? "198.51.100.7") : HOST_IP,
      dst: dir === "in" ? (p.pkt.dst ?? HOST_IP) : (p.pkt.dst ?? "1.1.1.1"),
      sport: p.pkt.sport ?? 40000 + Math.floor(Math.random() * 20000),
      dport: p.pkt.dport ?? 22,
      proto: p.pkt.proto ?? "tcp",
      established: p.pkt.established ?? false,
      iface: p.pkt.iface ?? HOST_IFACE,
    };
    send();
  }

  function setDirection(d: "in" | "out") {
    if (d === packet.direction) return;
    packet.direction = d;
    [packet.src, packet.dst] = [packet.dst, packet.src];
  }

  function send() {
    const snapshot = $state.snapshot(packet) as Packet;
    const ev = firewall.evaluate(snapshot);
    evaluation = ev;
    events.unshift({
      t: new Date().toLocaleTimeString("tr-TR"),
      pkt: snapshot,
      verdict: ev.verdict,
      rule: ev.matchedRule ? `[${firewall.ordered.indexOf(ev.matchedRule) + 1}]` : "policy",
    });
    events = events.slice(0, 60);
  }

  function burst() {
    let i = 0;
    const t = setInterval(() => {
      packet.sport = 40000 + Math.floor(Math.random() * 20000);
      send();
      if (++i >= 8) clearInterval(t);
    }, 250);
  }

  const recentLogs = $derived(firewall.logs.slice(-8).reverse());
</script>

<header>
  <div>
    <h1>Görselleştirme</h1>
    <p class="muted">Bir paket oluşturun ve netfilter → ufw zincirlerinden adım adım nasıl geçtiğini izleyin.</p>
  </div>
  <div class="tabs">
    <button class:on={tab === "flow"} onclick={() => (tab = "flow")}>Paket akışı</button>
    <button class:on={tab === "arch"} onclick={() => (tab = "arch")}>UFW mimarisi</button>
  </div>
</header>

{#if tab === "arch"}
  <ArchitectureDiagram />
{:else}
  <div class="grid">
    <section class="panel builder">
      <h3>Paket oluştur</h3>
      <div class="seg">
        <button class:on={packet.direction === "in"} onclick={() => setDirection("in")}>Gelen (in)</button>
        <button class:on={packet.direction === "out"} onclick={() => setDirection("out")}>Giden (out)</button>
      </div>
      <label>Kaynak IP <input bind:value={packet.src} /></label>
      <label>Hedef IP <input bind:value={packet.dst} /></label>
      <div class="two">
        <label>Protokol
          <select bind:value={packet.proto}>
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
            <option value="icmp">icmp</option>
          </select>
        </label>
        <label>Hedef port <input type="number" min="0" max="65535" bind:value={packet.dport} disabled={packet.proto === "icmp"} /></label>
      </div>
      <div class="two">
        <label>Arayüz
          <select bind:value={packet.iface}>
            <option value="eth0">eth0</option>
            <option value="eth1">eth1</option>
            <option value="lo">lo</option>
          </select>
        </label>
        <label>Kaynak port <input type="number" min="1" max="65535" bind:value={packet.sport} /></label>
      </div>
      <label class="check"><input type="checkbox" bind:checked={packet.established} /> ESTABLISHED bağlantının parçası</label>

      <div class="actions">
        <button class="primary" onclick={send}>Paketi gönder ▶</button>
        <button onclick={burst} title="30 saniye içinde 8 bağlantı — limit kuralını test eder">Burst ×8</button>
      </div>

      <h4>Hazır senaryolar</h4>
      <div class="presets">
        {#each PRESETS as p (p.label)}
          <button onclick={() => applyPreset(p)}>{p.label}</button>
        {/each}
      </div>
    </section>

    <section class="panel flowpanel">
      {#if evaluation}
        <PacketFlow {evaluation} packet={events[0]?.pkt ?? packet} />
      {:else}
        <div class="placeholder">
          <p>Henüz paket gönderilmedi.</p>
          <p class="muted">Soldan bir hazır senaryo seçin veya <b>Paketi gönder</b>'e basın.</p>
          {#if !firewall.enabled}
            <p class="warn">ufw şu an <b>inactive</b> — tüm paketler kabul edilir. Terminalden <code>sudo ufw enable</code> çalıştırın.</p>
          {/if}
        </div>
      {/if}
    </section>

    <section class="side">
      <div class="panel">
        <h3>Paket olayları</h3>
        <ul class="events">
          {#each events as e, i (i + e.t + e.pkt.sport)}
            <li>
              <span class="pill v-{e.verdict}">{e.verdict}</span>
              <code>{e.pkt.direction} {e.pkt.proto} {e.pkt.src} → {e.pkt.dst}{e.pkt.proto !== "icmp" ? ":" + e.pkt.dport : ""}</code>
              <span class="muted">{e.rule}</span>
            </li>
          {:else}
            <li class="muted">—</li>
          {/each}
        </ul>
      </div>
      <div class="panel">
        <h3>/var/log/ufw.log <span class="muted">({firewall.logging})</span></h3>
        <div class="logs">
          {#each recentLogs as l, i (i + l)}
            <div class:blk={l.includes("BLOCK")}>{l}</div>
          {:else}
            <div class="muted">Log yok. Engellenen paketler logging açıkken burada görünür.</div>
          {/each}
        </div>
      </div>
    </section>
  </div>

  <div class="bottom">
    <section class="panel">
      <h3>Aktif kurallar</h3>
      <RuleTable highlight={evaluation?.matchedRule?.id} />
    </section>
    <Terminal height="300px" placeholder="kuralları buradan değiştirip paketi yeniden gönderin" />
  </div>
{/if}

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 18px;
  }

  header p {
    margin: 6px 0 0;
  }

  .tabs,
  .seg {
    display: flex;
    gap: 4px;
    background: var(--bg-2);
    padding: 4px;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .tabs button,
  .seg button {
    border: none;
    background: transparent;
    color: var(--muted);
  }

  .tabs button.on,
  .seg button.on {
    background: var(--panel-2);
    color: var(--accent);
    box-shadow: 0 0 0 1px var(--border);
  }

  .seg button {
    flex: 1;
  }

  .grid {
    display: grid;
    grid-template-columns: 290px minmax(380px, 1fr) 340px;
    gap: 16px;
    align-items: start;
  }

  h3 {
    font-size: 14px;
    margin-bottom: 12px;
  }

  h4 {
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 18px 0 8px;
  }

  .builder {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .builder h3 {
    margin-bottom: 0;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }

  label input,
  label select {
    font-family: var(--mono);
    font-size: 12.5px;
    width: 100%;
  }

  .check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .check input {
    width: auto;
  }

  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions .primary {
    flex: 1;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .presets button {
    font-size: 11.5px;
    padding: 4px 8px;
  }

  .flowpanel {
    min-height: 420px;
  }

  .placeholder {
    display: grid;
    place-content: center;
    text-align: center;
    min-height: 380px;
  }

  .placeholder p {
    margin: 4px 0;
  }

  .warn {
    color: var(--reject);
    margin-top: 14px !important;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 260px;
    overflow: auto;
    font-size: 11.5px;
  }

  .events li {
    display: grid;
    grid-template-columns: 70px 1fr auto;
    gap: 8px;
    align-items: center;
  }

  .events .pill {
    justify-content: center;
    font-size: 10.5px;
  }

  .events code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logs {
    font-family: var(--mono);
    font-size: 10.5px;
    line-height: 1.5;
    max-height: 240px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    word-break: break-all;
  }

  .logs .blk {
    color: var(--drop);
  }

  .bottom {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
    align-items: start;
  }

  @media (max-width: 1250px) {
    .grid {
      grid-template-columns: 280px 1fr;
    }
    .side {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .bottom {
      grid-template-columns: 1fr;
    }
  }
</style>
