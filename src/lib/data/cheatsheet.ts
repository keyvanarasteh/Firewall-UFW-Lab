/**
 * UFW Cheatsheet — source: https://linuxize.com/cheatsheet/ufw/ (Dejan Panovski, Linuxize)
 * Commands and descriptions are reproduced from the original; Turkish notes are added for the lab.
 */
export interface CheatItem {
  cmd: string;
  desc: string;
  tr: string;
}

export interface CheatSection {
  id: string;
  title: string;
  intro: string;
  items: CheatItem[];
}

export const CHEATSHEET_SOURCE = "https://linuxize.com/cheatsheet/ufw/";

export const CHEATSHEET: CheatSection[] = [
  {
    id: "basic",
    title: "Basic Commands",
    intro: "Start with status and firewall state.",
    items: [
      { cmd: "ufw status", desc: "Show firewall status and rules", tr: "Güvenlik duvarı durumunu ve kuralları göster" },
      { cmd: "ufw status verbose", desc: "Show detailed status and defaults", tr: "Ayrıntılı durum ve varsayılan politikalar" },
      { cmd: "sudo ufw enable", desc: "Enable UFW", tr: "UFW'yi etkinleştir" },
      { cmd: "sudo ufw disable", desc: "Disable UFW", tr: "UFW'yi devre dışı bırak" },
      { cmd: "sudo ufw reload", desc: "Reload rules", tr: "Kuralları yeniden yükle" },
      { cmd: "sudo ufw reset", desc: "Reset UFW to defaults", tr: "UFW'yi varsayılanlara sıfırla" },
    ],
  },
  {
    id: "defaults",
    title: "Default Policies",
    intro: "Set default inbound and outbound behavior.",
    items: [
      { cmd: "sudo ufw default deny incoming", desc: "Deny all incoming by default", tr: "Gelen tüm trafiği varsayılan olarak reddet" },
      { cmd: "sudo ufw default allow outgoing", desc: "Allow all outgoing by default", tr: "Giden tüm trafiğe varsayılan olarak izin ver" },
      { cmd: "sudo ufw default deny outgoing", desc: "Deny all outgoing by default", tr: "Giden tüm trafiği varsayılan olarak reddet" },
      { cmd: "sudo ufw default allow incoming", desc: "Allow all incoming (not recommended on servers)", tr: "Gelen tüm trafiğe izin ver (sunucularda önerilmez)" },
    ],
  },
  {
    id: "allow-deny",
    title: "Allow and Deny Rules",
    intro: "Allow or block traffic by port and protocol.",
    items: [
      { cmd: "sudo ufw allow 22", desc: "Allow port 22 (TCP and UDP)", tr: "22 numaralı porta izin ver (TCP ve UDP)" },
      { cmd: "sudo ufw allow 80/tcp", desc: "Allow HTTP over TCP", tr: "TCP üzerinden HTTP'ye izin ver" },
      { cmd: "sudo ufw allow 443/tcp", desc: "Allow HTTPS over TCP", tr: "TCP üzerinden HTTPS'e izin ver" },
      { cmd: "sudo ufw deny 25", desc: "Deny SMTP port 25", tr: "SMTP portu 25'i engelle (sessizce düşür)" },
      { cmd: "sudo ufw reject 23", desc: "Reject Telnet connections", tr: "Telnet bağlantılarını reddet (karşı tarafa bildirir)" },
      { cmd: "sudo ufw limit 22/tcp", desc: "Rate-limit SSH connections", tr: "SSH bağlantılarını hız sınırına tabi tut (30 sn'de 6)" },
    ],
  },
  {
    id: "manage",
    title: "Rule Management",
    intro: "List, delete, and clean specific rules.",
    items: [
      { cmd: "sudo ufw status numbered", desc: "List rules with numbers", tr: "Kuralları numaralı listele" },
      { cmd: "sudo ufw delete allow 80/tcp", desc: "Delete matching rule", tr: "Eşleşen kuralı sil" },
      { cmd: "sudo ufw delete 3", desc: "Delete rule by number", tr: "Numarasıyla kural sil" },
      { cmd: "sudo ufw delete deny 25", desc: "Delete a deny rule", tr: "Bir deny kuralını sil" },
    ],
  },
  {
    id: "ip",
    title: "IP-Based Rules",
    intro: "Allow or deny traffic from specific hosts and networks.",
    items: [
      { cmd: "sudo ufw allow from 203.0.113.10", desc: "Allow all traffic from one IP", tr: "Tek bir IP'den gelen tüm trafiğe izin ver" },
      { cmd: "sudo ufw deny from 203.0.113.10", desc: "Block all traffic from one IP", tr: "Tek bir IP'den gelen tüm trafiği engelle" },
      { cmd: "sudo ufw allow from 203.0.113.10 to any port 22", desc: "Allow SSH from one IP", tr: "Tek bir IP'den SSH'a izin ver" },
      { cmd: "sudo ufw allow from 10.0.0.0/24 to any port 3306", desc: "Allow MySQL from a subnet", tr: "Bir alt ağdan MySQL'e izin ver" },
      { cmd: "sudo ufw deny from 198.51.100.0/24 to any port 22 proto tcp", desc: "Deny TCP SSH from subnet", tr: "Bir alt ağdan TCP SSH'ı engelle" },
    ],
  },
  {
    id: "apps",
    title: "Application Profiles",
    intro: "Use service profiles from /etc/ufw/applications.d/.",
    items: [
      { cmd: "sudo ufw app list", desc: "List available application profiles", tr: "Mevcut uygulama profillerini listele" },
      { cmd: 'sudo ufw app info "Nginx Full"', desc: "Show ports/protocols for profile", tr: "Profilin port/protokollerini göster" },
      { cmd: 'sudo ufw allow "OpenSSH"', desc: "Allow profile rules", tr: "Profil kurallarına izin ver" },
      { cmd: 'sudo ufw deny "Nginx HTTP"', desc: "Deny profile rules", tr: "Profil kurallarını engelle" },
      { cmd: 'sudo ufw delete allow "OpenSSH"', desc: "Remove allowed profile", tr: "İzin verilen profili kaldır" },
    ],
  },
  {
    id: "logging",
    title: "Logging",
    intro: "Control and inspect UFW logging.",
    items: [
      { cmd: "sudo ufw logging on", desc: "Enable logging", tr: "Loglamayı aç" },
      { cmd: "sudo ufw logging off", desc: "Disable logging", tr: "Loglamayı kapat" },
      { cmd: "sudo ufw logging low", desc: "Set low log level", tr: "Düşük log seviyesi" },
      { cmd: "sudo ufw logging medium", desc: "Set medium log level", tr: "Orta log seviyesi" },
      { cmd: "sudo ufw logging high", desc: "Set high log level", tr: "Yüksek log seviyesi" },
    ],
  },
  {
    id: "server",
    title: "Common Server Setup",
    intro: "Baseline rules for a web server.",
    items: [
      { cmd: "sudo ufw default deny incoming", desc: "Deny incoming by default", tr: "Gelenleri varsayılan olarak reddet" },
      { cmd: "sudo ufw default allow outgoing", desc: "Allow outgoing by default", tr: "Gidenlere varsayılan olarak izin ver" },
      { cmd: "sudo ufw allow OpenSSH", desc: "Keep SSH access", tr: "SSH erişimini koru" },
      { cmd: "sudo ufw allow 80/tcp", desc: "Allow HTTP", tr: "HTTP'ye izin ver" },
      { cmd: "sudo ufw allow 443/tcp", desc: "Allow HTTPS", tr: "HTTPS'e izin ver" },
      { cmd: "sudo ufw enable", desc: "Activate firewall", tr: "Güvenlik duvarını etkinleştir" },
      { cmd: "sudo ufw status verbose", desc: "Verify active rules", tr: "Etkin kuralları doğrula" },
    ],
  },
];

export interface TroubleItem {
  issue: string;
  check: string;
  tr: string;
}

export const TROUBLESHOOTING: TroubleItem[] = [
  { issue: "SSH access lost after enable", check: "Ensure `OpenSSH` is allowed before `ufw enable`", tr: "ufw enable öncesinde OpenSSH'a izin verildiğinden emin olun" },
  { issue: "Rule did not apply", check: "Run `sudo ufw reload` and re-check with `ufw status numbered`", tr: "sudo ufw reload çalıştırın, ufw status numbered ile kontrol edin" },
  { issue: "Service still unreachable", check: "Confirm service is listening (`ss -tulpn`) and port/protocol match", tr: "Servisin dinlediğini (ss -tulpn) ve port/protokolün eşleştiğini doğrulayın" },
  { issue: "Rules conflict", check: "Check order with `ufw status numbered` and delete/re-add as needed", tr: "Sırayı ufw status numbered ile kontrol edin, gerekirse silip yeniden ekleyin" },
  { issue: "UFW not active at boot", check: "Verify service state with `systemctl status ufw`", tr: "Servis durumunu systemctl status ufw ile doğrulayın" },
];

export const RELATED_GUIDES = [
  { title: "How to Set Up a Firewall with UFW on Ubuntu 20.04", desc: "Full UFW setup on Ubuntu 20.04", url: "https://linuxize.com/post/how-to-setup-a-firewall-with-ufw-on-ubuntu-20-04/" },
  { title: "How to Set Up a Firewall with UFW on Ubuntu 18.04", desc: "UFW setup on Ubuntu 18.04", url: "https://linuxize.com/post/how-to-setup-a-firewall-with-ufw-on-ubuntu-18-04/" },
  { title: "How to Set Up a Firewall with UFW on Debian 10", desc: "UFW setup on Debian 10", url: "https://linuxize.com/post/how-to-setup-a-firewall-with-ufw-on-debian-10/" },
  { title: "How to List and Delete UFW Firewall Rules", desc: "Rule management and cleanup", url: "https://linuxize.com/post/how-to-list-and-delete-ufw-firewall-rules/" },
];
