# UFW Lab — Firewall Laboratuvarı

Tauri v2 + SvelteKit (Svelte 5) + TypeScript ile yazılmış, UFW (Uncomplicated Firewall) öğrenme laboratuvarı.

## Çalıştırma

```bash
npm install
npm run tauri dev      # masaüstü uygulaması
npm run tauri build    # paket (deb/rpm/AppImage)
```

## Sayfalar

| Sayfa | İçerik |
|---|---|
| Genel Bakış | Durum kartları, aktif kurallar, hızlı komutlar |
| Terminal | Gerçek `ufw` sözdizimiyle simülasyon (status/verbose/numbered, allow/deny/reject/limit, insert, delete, app profilleri, logging, reset, `user.rules` çıktısı) |
| Görselleştirme | Paket akışı: PREROUTING → INPUT → `ufw-before-*` → `ufw-user-*` → `ufw-after-*` → policy, adım adım animasyon; UFW mimari diyagramı (CLI → rules dosyaları → iptables/nft → netfilter kancaları) |
| Lablar | 5 senaryo, simüle paketlerle canlı doğrulama |
| Cheatsheet | [linuxize.com/cheatsheet/ufw](https://linuxize.com/cheatsheet/ufw/) içeriği + Türkçe açıklamalar, tek tıkla terminalde çalıştırma |
| Gerçek Sistem | Rust `host_query` komutu ile makinedeki gerçek ufw'yi **salt-okunur** sorgulama (sudo -n / pkexec) |

## Yapı

- `src/lib/ufw/firewall.svelte.ts` — UFW motoru: komut ayrıştırıcı, kural modeli, paket değerlendirme
- `src/lib/components/` — Terminal, RuleTable, PacketFlow, ArchitectureDiagram
- `src/lib/data/` — cheatsheet ve lab tanımları
- `src-tauri/src/lib.rs` — beyaz listeli, salt-okunur host sorguları
