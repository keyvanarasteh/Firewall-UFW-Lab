import { HOST_IFACE, HOST_IP, type Firewall } from "$lib/ufw/firewall.svelte";
import type { Packet, PacketProto, Verdict } from "$lib/ufw/types";

export interface Check {
  label: string;
  ok: boolean;
}

export interface Lab {
  id: string;
  level: "Başlangıç" | "Orta" | "İleri";
  title: string;
  scenario: string;
  tasks: string[];
  hints: string[];
  check: (fw: Firewall) => Check[];
}

function probe(fw: Firewall, src: string, dport: number, proto: PacketProto = "tcp", direction: "in" | "out" = "in"): Verdict {
  const pkt: Packet = {
    direction,
    src: direction === "in" ? src : HOST_IP,
    dst: direction === "in" ? HOST_IP : src,
    sport: 50000,
    dport,
    proto,
    established: false,
    iface: HOST_IFACE,
  };
  return fw.evaluate(pkt, false).verdict;
}

const hasRule = (fw: Firewall, pred: (r: Firewall["rules"][number]) => boolean) => fw.rules.some(pred);

export const LABS: Lab[] = [
  {
    id: "lab1",
    level: "Başlangıç",
    title: "Lab 1 — İlk güvenlik duvarı",
    scenario: "Yeni kurulmuş bir Ubuntu sunucusu. SSH ile bağlısınız ve kendinizi dışarıda bırakmadan güvenlik duvarını açmanız gerekiyor.",
    tasks: [
      "Varsayılan politikayı gelen trafik için deny, giden için allow yapın",
      "SSH'a (OpenSSH profili veya 22/tcp) izin verin",
      "UFW'yi etkinleştirin",
    ],
    hints: ["sudo ufw default deny incoming", "sudo ufw default allow outgoing", "sudo ufw allow OpenSSH", "sudo ufw enable"],
    check: (fw) => [
      { label: "default deny incoming", ok: fw.defaults.incoming === "deny" },
      { label: "default allow outgoing", ok: fw.defaults.outgoing === "allow" },
      { label: "İnternetten SSH (22/tcp) erişilebilir", ok: probe(fw, "198.51.100.7", 22) === "ACCEPT" },
      { label: "UFW aktif", ok: fw.enabled },
      { label: "Rastgele port (8080/tcp) engelli", ok: probe(fw, "198.51.100.7", 8080) !== "ACCEPT" },
    ],
  },
  {
    id: "lab2",
    level: "Başlangıç",
    title: "Lab 2 — Web sunucusu",
    scenario: "Nginx kuruldu. HTTP ve HTTPS dışarıya açılmalı; SMTP (25) sessizce düşürülmeli, Telnet (23) ise reddedilmeli.",
    tasks: ["80/tcp ve 443/tcp'ye izin verin", "25 numaralı portu deny ile engelleyin", "23 numaralı portu reject ile reddedin", "UFW aktif olsun"],
    hints: ["sudo ufw allow 80/tcp", "sudo ufw allow 443/tcp", "sudo ufw deny 25", "sudo ufw reject 23", "sudo ufw enable"],
    check: (fw) => [
      { label: "HTTP (80/tcp) → ACCEPT", ok: probe(fw, "203.0.113.50", 80) === "ACCEPT" },
      { label: "HTTPS (443/tcp) → ACCEPT", ok: probe(fw, "203.0.113.50", 443) === "ACCEPT" },
      { label: "SMTP (25) → DROP (deny kuralı)", ok: probe(fw, "203.0.113.50", 25) === "DROP" && hasRule(fw, (r) => r.action === "deny" && r.port === "25") },
      { label: "Telnet (23) → REJECT", ok: probe(fw, "203.0.113.50", 23) === "REJECT" },
      { label: "UFW aktif", ok: fw.enabled },
    ],
  },
  {
    id: "lab3",
    level: "Orta",
    title: "Lab 3 — IP tabanlı erişim",
    scenario: "Veritabanı (MySQL 3306) yalnızca iç ağ 10.0.0.0/24'ten erişilebilir olmalı. 203.0.113.10 adresi saldırgan — tamamen engellenmeli.",
    tasks: [
      "10.0.0.0/24 alt ağından 3306'ya izin verin",
      "İnternetten 3306 kapalı kalsın",
      "203.0.113.10'dan gelen her şeyi engelleyin (web dahil!)",
      "Web (80/tcp) diğerleri için açık olsun",
    ],
    hints: [
      "sudo ufw allow from 10.0.0.0/24 to any port 3306",
      "sudo ufw allow 80/tcp",
      "sudo ufw insert 1 deny from 203.0.113.10",
      "sudo ufw status numbered",
    ],
    check: (fw) => [
      { label: "10.0.0.20 → 3306 ACCEPT", ok: probe(fw, "10.0.0.20", 3306) === "ACCEPT" },
      { label: "198.51.100.7 → 3306 engelli", ok: probe(fw, "198.51.100.7", 3306) !== "ACCEPT" },
      { label: "203.0.113.10 → 80 engelli (kural sırası!)", ok: probe(fw, "203.0.113.10", 80) !== "ACCEPT" },
      { label: "203.0.113.10 → 22 engelli", ok: probe(fw, "203.0.113.10", 22) !== "ACCEPT" },
      { label: "198.51.100.7 → 80 ACCEPT", ok: probe(fw, "198.51.100.7", 80) === "ACCEPT" },
      { label: "UFW aktif", ok: fw.enabled },
    ],
  },
  {
    id: "lab4",
    level: "Orta",
    title: "Lab 4 — Brute-force'a karşı SSH",
    scenario: "Loglarda SSH brute-force denemeleri görülüyor. SSH'ı düz allow yerine rate-limit ile koruyun ve logları orta seviyeye çıkarın.",
    tasks: ["22/tcp için limit kuralı ekleyin", "22 için düz allow kuralı kalmasın", "Loglama seviyesi medium", "UFW aktif"],
    hints: ["sudo ufw limit 22/tcp", "sudo ufw delete allow OpenSSH", "sudo ufw logging medium", "sudo ufw enable"],
    check: (fw) => [
      { label: "22/tcp için LIMIT kuralı", ok: hasRule(fw, (r) => r.action === "limit" && r.port === "22") },
      { label: "22 için ALLOW kuralı yok", ok: !hasRule(fw, (r) => r.action === "allow" && (r.port === "22" || r.app === "OpenSSH") && r.from === "any") },
      { label: "Logging: medium", ok: fw.logging === "medium" },
      { label: "UFW aktif", ok: fw.enabled },
    ],
  },
  {
    id: "lab5",
    level: "İleri",
    title: "Lab 5 — Çıkış (egress) filtreleme",
    scenario: "Sıkı güvenlik politikası: sunucu dışarıya yalnızca DNS (53/udp), HTTP/HTTPS ve NTP (123/udp) ile konuşabilir. Gelenlerde yalnızca SSH açık.",
    tasks: [
      "default deny outgoing",
      "Giden 53/udp, 80/tcp, 443/tcp, 123/udp'ye izin verin",
      "Gelen SSH'a izin verin, UFW aktif",
    ],
    hints: ["sudo ufw default deny outgoing", "sudo ufw allow out 53/udp", "sudo ufw allow out 80/tcp", "sudo ufw allow out 443/tcp", "sudo ufw allow out 123/udp", "sudo ufw allow OpenSSH"],
    check: (fw) => [
      { label: "default deny outgoing", ok: fw.defaults.outgoing === "deny" },
      { label: "Giden DNS 53/udp ACCEPT", ok: probe(fw, "1.1.1.1", 53, "udp", "out") === "ACCEPT" },
      { label: "Giden HTTPS 443/tcp ACCEPT", ok: probe(fw, "93.184.216.34", 443, "tcp", "out") === "ACCEPT" },
      { label: "Giden NTP 123/udp ACCEPT", ok: probe(fw, "162.159.200.1", 123, "udp", "out") === "ACCEPT" },
      { label: "Giden SMTP 25/tcp engelli", ok: probe(fw, "93.184.216.34", 25, "tcp", "out") !== "ACCEPT" },
      { label: "Gelen SSH ACCEPT", ok: probe(fw, "198.51.100.7", 22) === "ACCEPT" },
      { label: "UFW aktif", ok: fw.enabled },
    ],
  },
];
