import { APP_PROFILES, findApp } from "./apps";
import { addrMatches, isV6, isValidAddr, isValidPortSpec, portMatches } from "./net";
import type {
  Action,
  Direction,
  Evaluation,
  FlowStep,
  LogLevel,
  Packet,
  Policy,
  Proto,
  Rule,
  TermLine,
} from "./types";

const STORAGE_KEY = "ufw-lab-state-v1";
export const HOST_IP = "10.0.0.5";
export const HOST_IFACE = "eth0";

/** Well-known service names ufw resolves through /etc/services */
const SERVICES: Record<string, { port: string; proto: Proto }> = {
  ssh: { port: "22", proto: "tcp" },
  http: { port: "80", proto: "tcp" },
  https: { port: "443", proto: "tcp" },
  smtp: { port: "25", proto: "tcp" },
  telnet: { port: "23", proto: "tcp" },
  ftp: { port: "21", proto: "tcp" },
  mysql: { port: "3306", proto: "tcp" },
  postgresql: { port: "5432", proto: "tcp" },
  dns: { port: "53", proto: "any" },
  domain: { port: "53", proto: "any" },
};

/** Simulated listening sockets for `ss -tulpn` */
export const LISTENING = [
  { proto: "tcp", addr: "0.0.0.0:22", proc: "sshd" },
  { proto: "tcp", addr: "0.0.0.0:80", proc: "nginx" },
  { proto: "tcp", addr: "0.0.0.0:443", proc: "nginx" },
  { proto: "tcp", addr: "0.0.0.0:3306", proc: "mysqld" },
  { proto: "tcp", addr: "0.0.0.0:25", proc: "master" },
  { proto: "udp", addr: "0.0.0.0:53", proc: "systemd-resolve" },
];

interface PersistedState {
  enabled: boolean;
  defaults: { incoming: Policy; outgoing: Policy; routed: Policy | "disabled" };
  logging: LogLevel;
  rules: Rule[];
  nextId: number;
  logs: string[];
}

interface Pending {
  prompt: string;
  run: () => string[];
}

function initialState(): PersistedState {
  return {
    enabled: false,
    defaults: { incoming: "deny", outgoing: "allow", routed: "disabled" },
    logging: "low",
    rules: [],
    nextId: 1,
    logs: [],
  };
}

/** Split a command line into tokens, honouring "double" and 'single' quotes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const pad = (s: string, n: number) => (s.length >= n ? s + " " : s.padEnd(n));

class UfwError extends Error {}

export class Firewall {
  enabled = $state(false);
  defaults = $state<PersistedState["defaults"]>({ incoming: "deny", outgoing: "allow", routed: "disabled" });
  logging = $state<LogLevel>("low");
  rules = $state<Rule[]>([]);
  logs = $state<string[]>([]);
  lines = $state<TermLine[]>([]);
  history = $state<string[]>([]);
  pending = $state<Pending | null>(null);
  /** bumps on every state change so views can react / animate */
  revision = $state(0);

  #nextId = 1;
  #limitHits = new Map<string, number[]>();

  constructor() {
    this.load();
    if (this.lines.length === 0) this.banner();
  }

  // ---------------------------------------------------------------- state

  /** Rules in the order `ufw status numbered` shows them: IPv4 first, then IPv6. */
  get ordered(): Rule[] {
    return [...this.rules.filter((r) => !r.v6), ...this.rules.filter((r) => r.v6)];
  }

  load() {
    const s = { ...initialState(), ...this.#read() };
    this.enabled = s.enabled;
    this.defaults = s.defaults;
    this.logging = s.logging;
    this.rules = s.rules;
    this.logs = s.logs;
    this.#nextId = s.nextId;
  }

  #read(): Partial<PersistedState> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }

  save() {
    this.revision++;
    const s: PersistedState = {
      enabled: this.enabled,
      defaults: this.defaults,
      logging: this.logging,
      rules: this.rules,
      nextId: this.#nextId,
      logs: this.logs.slice(-300),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable: state stays in memory */
    }
  }

  /** Wipe everything back to a freshly installed ufw (used by labs). */
  factoryReset() {
    const s = initialState();
    this.enabled = s.enabled;
    this.defaults = s.defaults;
    this.logging = s.logging;
    this.rules = [];
    this.logs = [];
    this.#nextId = 1;
    this.#limitHits.clear();
    this.pending = null;
    this.save();
  }

  banner() {
    this.lines = [
      { kind: "info", text: "UFW Lab simülasyon terminali — lab@ufw-lab (10.0.0.5, eth0)" },
      { kind: "info", text: "Komutlar gerçek ufw sözdizimini kullanır. 'help' yazarak listeyi görün." },
    ];
  }

  // ---------------------------------------------------------------- terminal

  run(line: string) {
    const trimmed = line.trim();
    this.lines.push({ kind: "cmd", text: trimmed });
    if (!trimmed) return;

    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      if (/^y(es)?$/i.test(trimmed)) this.#print(p.run());
      else this.#print(["Aborted"]);
      this.save();
      return;
    }

    this.history.push(trimmed);
    try {
      this.#print(this.#dispatch(tokenize(trimmed)));
    } catch (e) {
      this.lines.push({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    }
    this.save();
  }

  #print(out: string[]) {
    for (const t of out) this.lines.push({ kind: "out", text: t });
    if (this.pending) this.lines.push({ kind: "out", text: this.pending.prompt });
    if (this.lines.length > 800) this.lines.splice(0, this.lines.length - 800);
  }

  #dispatch(tok: string[]): string[] {
    let sudo = false;
    if (tok[0] === "sudo") {
      sudo = true;
      tok = tok.slice(1);
    }
    const [cmd, ...args] = tok;
    switch (cmd) {
      case undefined:
        return [];
      case "help":
        return HELP;
      case "clear":
        this.lines = [];
        return [];
      case "history":
        return this.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`);
      case "whoami":
        return [sudo ? "root" : "lab"];
      case "ss":
        return this.#ss();
      case "systemctl":
        return this.#systemctl(args);
      case "cat":
      case "less":
        return this.#cat(args[0], sudo);
      case "tail":
        return this.#tail(args, sudo);
      case "iptables":
        return this.#iptables(args, sudo);
      case "ufw":
        return this.#ufw(args, sudo);
      default:
        throw new UfwError(`${cmd}: command not found (lab içinde yalnızca ufw ve birkaç yardımcı komut simüle edilir)`);
    }
  }

  #requireRoot(sudo: boolean) {
    if (!sudo) throw new UfwError("ERROR: You need to be root to run this script");
  }

  #ufw(args: string[], sudo: boolean): string[] {
    const force = args.includes("--force");
    args = args.filter((a) => a !== "--force" && a !== "--dry-run");
    const [sub, ...rest] = args;

    // `ufw status` is allowed without sudo in the lab, to match the cheatsheet
    if (sub === "status") return this.status(rest[0]);
    if (sub === undefined || sub === "help" || sub === "--help") return UFW_USAGE;
    if (sub === "version" || sub === "--version") return ["ufw 0.36.2", "Copyright 2008-2023 Canonical Ltd."];
    if (sub === "app") return this.#app(rest);

    this.#requireRoot(sudo);

    switch (sub) {
      case "enable":
        return this.#confirm(force, "Command may disrupt existing ssh connections. Proceed with operation (y|n)?", () => {
          this.enabled = true;
          return ["Firewall is active and enabled on system startup"];
        });
      case "disable":
        this.enabled = false;
        return ["Firewall stopped and disabled on system startup"];
      case "reload":
        return this.enabled ? ["Firewall reloaded"] : ["Firewall not enabled (skipping reload)"];
      case "reset":
        return this.#confirm(force, "Resetting all rules to installed defaults. Proceed with operation (y|n)?", () => {
          const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
          const d = `${stamp.slice(0, 8)}_${stamp.slice(8)}`;
          const wasEnabled = this.enabled;
          this.enabled = false;
          this.rules = [];
          this.defaults = { incoming: "deny", outgoing: "allow", routed: "disabled" };
          this.logging = "low";
          return [
            ...(wasEnabled ? ["Firewall stopped and disabled on system startup"] : []),
            `Backing up 'user.rules' to '/etc/ufw/user.rules.${d}'`,
            `Backing up 'before.rules' to '/etc/ufw/before.rules.${d}'`,
            `Backing up 'after.rules' to '/etc/ufw/after.rules.${d}'`,
            `Backing up 'user6.rules' to '/etc/ufw/user6.rules.${d}'`,
            `Backing up 'before6.rules' to '/etc/ufw/before6.rules.${d}'`,
            `Backing up 'after6.rules' to '/etc/ufw/after6.rules.${d}'`,
          ];
        });
      case "default":
        return this.#default(rest);
      case "logging":
        return this.#setLogging(rest[0]);
      case "delete":
        return this.#delete(rest, force);
      case "insert": {
        const pos = Number(rest[0]);
        if (!Number.isInteger(pos) || pos < 1 || pos > this.ordered.length)
          throw new UfwError(`ERROR: Invalid position '${rest[0] ?? ""}'`);
        return this.#addRule(rest.slice(1), pos);
      }
      case "show":
        if (rest[0] === "added") return this.#showAdded();
        if (rest[0] === "listening") return this.#ss();
        throw new UfwError(`ERROR: Unsupported report '${rest[0] ?? ""}'`);
      case "allow":
      case "deny":
      case "reject":
      case "limit":
        return this.#addRule(args);
      default:
        throw new UfwError(`ERROR: Invalid syntax\n\nUsage: ufw COMMAND\n(Tüm komutlar için: ufw help)`);
    }
  }

  #confirm(force: boolean, prompt: string, run: () => string[]): string[] {
    if (force) return run();
    this.pending = { prompt, run };
    return [];
  }

  // ---------------------------------------------------------------- status

  status(mode?: string): string[] {
    if (mode !== undefined && mode !== "verbose" && mode !== "numbered")
      throw new UfwError(`ERROR: Invalid syntax`);
    if (!this.enabled) return ["Status: inactive"];

    const out = ["Status: active"];
    if (mode === "verbose") {
      const lvl = this.logging === "off" ? "off" : `on (${this.logging})`;
      out.push(
        `Logging: ${lvl}`,
        `Default: ${this.defaults.incoming} (incoming), ${this.defaults.outgoing} (outgoing), ${this.defaults.routed} (routed)`,
        "New profiles: skip",
      );
    }
    const rules = this.ordered;
    if (rules.length === 0) return out;

    const numbered = mode === "numbered";
    const prefix = numbered ? "     " : "";
    out.push("", `${prefix}To                         Action      From`, `${prefix}--                         ------      ----`);
    rules.forEach((r, i) => {
      const n = numbered ? `[${String(i + 1).padStart(2)}] ` : "";
      const act = r.action.toUpperCase() + (mode || r.direction === "out" ? ` ${r.direction.toUpperCase()}` : "");
      out.push(`${n}${pad(ruleTo(r), 27)}${pad(act, 12)}${ruleFrom(r)}${r.comment ? `                   # ${r.comment}` : ""}`);
    });
    return out;
  }

  #showAdded(): string[] {
    const seen = new Set<string>();
    const out = ["Added user rules (see 'ufw status' for running firewall):"];
    for (const r of this.rules) {
      const c = ruleCommand(r);
      if (!seen.has(c)) out.push(c);
      seen.add(c);
    }
    if (out.length === 1) out.push("(None)");
    return out;
  }

  // ---------------------------------------------------------------- policy & logging

  #default(args: string[]): string[] {
    const [policy, dir = "incoming"] = args;
    if (policy !== "allow" && policy !== "deny" && policy !== "reject")
      throw new UfwError("ERROR: Unsupported policy");
    const key = { incoming: "incoming", outgoing: "outgoing", routed: "routed", in: "incoming", out: "outgoing" }[dir] as
      | "incoming"
      | "outgoing"
      | "routed"
      | undefined;
    if (!key) throw new UfwError(`ERROR: Unsupported direction '${dir}'`);
    this.defaults[key] = policy;
    return [`Default ${key} policy changed to '${policy}'`, "(be sure to update your rules accordingly)"];
  }

  #setLogging(level?: string): string[] {
    if (level === "on") {
      if (this.logging === "off") this.logging = "low";
      return ["Logging enabled"];
    }
    if (level === "off") {
      this.logging = "off";
      return ["Logging disabled"];
    }
    if (level === "low" || level === "medium" || level === "high" || level === "full") {
      this.logging = level;
      return ["Logging enabled"];
    }
    throw new UfwError("ERROR: Invalid log level");
  }

  // ---------------------------------------------------------------- rules

  /** Parse `[allow|deny|reject|limit] [in|out] [on IF] <spec> [comment 'x']` into rule tuples. */
  parseRule(args: string[]): Omit<Rule, "id">[] {
    const tok = [...args];
    const action = tok.shift() as Action;
    if (!["allow", "deny", "reject", "limit"].includes(action)) throw new UfwError("ERROR: Invalid syntax");

    let direction: Direction = "in";
    if (tok[0] === "in" || tok[0] === "out") direction = tok.shift() as Direction;

    let iface: string | undefined;
    let comment: string | undefined;
    const ci = tok.indexOf("comment");
    if (ci >= 0) {
      comment = tok[ci + 1];
      tok.splice(ci, 2);
    }
    if (tok[0] === "on") {
      iface = tok[1];
      if (!iface) throw new UfwError("ERROR: Invalid interface");
      tok.splice(0, 2);
    }
    if (tok.length === 0) throw new UfwError("ERROR: Invalid syntax");

    let from = "any";
    let to = "any";
    let port: string | null = null;
    let proto: Proto = "any";
    let app: string | undefined;

    const extended = ["from", "to", "proto", "port", "app"].includes(tok[0]);
    if (!extended) {
      if (tok.length !== 1) throw new UfwError("ERROR: Wrong number of arguments");
      const simple = tok[0];
      const profile = findApp(simple);
      const [p, pr] = simple.split("/");
      if (profile) {
        app = profile.name;
      } else if (SERVICES[simple.toLowerCase()]) {
        ({ port, proto } = SERVICES[simple.toLowerCase()]);
      } else if (isValidPortSpec(p)) {
        port = p;
        if (pr !== undefined) {
          if (pr !== "tcp" && pr !== "udp") throw new UfwError(`ERROR: Unsupported protocol '${pr}'`);
          proto = pr;
        }
        if ((p.includes(":") || p.includes(",")) && proto === "any")
          throw new UfwError("ERROR: Must specify 'tcp' or 'udp' with multiple ports");
      } else {
        throw new UfwError(`ERROR: Could not find a profile matching '${simple}'`);
      }
    } else {
      while (tok.length) {
        const key = tok.shift()!;
        const val = tok.shift();
        if (val === undefined) throw new UfwError("ERROR: Invalid syntax");
        switch (key) {
          case "from":
            if (!isValidAddr(val)) throw new UfwError(`ERROR: Bad source address`);
            from = val;
            break;
          case "to":
            if (!isValidAddr(val)) throw new UfwError(`ERROR: Bad destination address`);
            to = val;
            break;
          case "port":
            if (!isValidPortSpec(val)) throw new UfwError("ERROR: Bad port");
            port = val;
            break;
          case "proto":
            if (val !== "tcp" && val !== "udp") throw new UfwError(`ERROR: Unsupported protocol '${val}'`);
            proto = val;
            break;
          case "app": {
            const profile = findApp(val);
            if (!profile) throw new UfwError(`ERROR: Could not find a profile matching '${val}'`);
            app = profile.name;
            break;
          }
          default:
            throw new UfwError("ERROR: Invalid syntax");
        }
      }
      if (port && (port.includes(":") || port.includes(",")) && proto === "any")
        throw new UfwError("ERROR: Must specify 'tcp' or 'udp' with multiple ports");
    }

    if (app) {
      const [p, pr] = findApp(app)!.ports.split("/");
      port = p;
      proto = (pr as Proto) ?? "any";
    }

    const base = { action, direction, from, to, port, proto, app, iface, comment };
    const fams = [from, to].filter((a) => a !== "any");
    if (fams.length === 0) return [{ ...base, v6: false }, { ...base, v6: true }];
    const v6 = isV6(fams[0]);
    if (fams.some((a) => isV6(a) !== v6)) throw new UfwError("ERROR: Invalid address family (IPv4 ve IPv6 karıştırılamaz)");
    return [{ ...base, v6 }];
  }

  #addRule(args: string[], position?: number): string[] {
    const parsed = this.parseRule(args);
    const out: string[] = [];
    for (const nr of parsed) {
      const suffix = nr.v6 ? " (v6)" : "";
      const existing = this.rules.find((r) => sameTuple(r, nr));
      if (existing) {
        if (existing.action === nr.action && existing.comment === nr.comment) {
          out.push(`Skipping adding existing rule${suffix}`);
        } else {
          existing.action = nr.action;
          existing.comment = nr.comment;
          out.push(`Rule updated${suffix}`);
        }
        continue;
      }
      const rule: Rule = { ...nr, id: this.#nextId++ };
      if (position !== undefined) {
        const target = this.ordered[position - 1];
        const sameFam = this.rules.filter((r) => r.v6 === rule.v6);
        // position counts within the numbered list; for the twin family insert at the family start
        const anchor = target.v6 === rule.v6 ? target : sameFam[0];
        const idx = anchor ? this.rules.indexOf(anchor) : this.rules.length;
        this.rules.splice(idx, 0, rule);
        out.push(`Rule inserted${suffix}`);
      } else {
        this.rules.push(rule);
        out.push(`Rule added${suffix}`);
      }
    }
    return out;
  }

  #delete(args: string[], force: boolean): string[] {
    if (args.length === 1 && /^\d+$/.test(args[0])) {
      const n = Number(args[0]);
      const rule = this.ordered[n - 1];
      if (!rule) throw new UfwError("ERROR: Could not find rule '" + n + "'");
      const doIt = () => {
        this.rules = this.rules.filter((r) => r.id !== rule.id);
        return [`Rule deleted${rule.v6 ? " (v6)" : ""}`];
      };
      if (force) return doIt();
      this.pending = {
        prompt: `Deleting:\n ${ruleCommand(rule).replace(/^ufw /, "")}${rule.v6 ? " (v6)" : ""}\nProceed with operation (y|n)?`,
        run: doIt,
      };
      return [];
    }
    const parsed = this.parseRule(args);
    const out: string[] = [];
    for (const nr of parsed) {
      const suffix = nr.v6 ? " (v6)" : "";
      const hit = this.rules.find((r) => sameTuple(r, nr) && r.action === nr.action);
      if (hit) {
        this.rules = this.rules.filter((r) => r.id !== hit.id);
        out.push(`Rule deleted${suffix}`);
      } else {
        out.push(`Could not delete non-existent rule${suffix}`);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- app profiles

  #app(args: string[]): string[] {
    const [sub, name] = args;
    if (sub === "list") return ["Available applications:", ...APP_PROFILES.map((a) => `  ${a.name}`)];
    if (sub === "info") {
      const a = name ? findApp(name) : undefined;
      if (!a) throw new UfwError(`ERROR: Could not find profile '${name ?? ""}'`);
      const multi = a.ports.includes(",");
      return [
        `Profile: ${a.name}`,
        `Title: ${a.title}`,
        `Description: ${a.description}`,
        "",
        multi ? "Ports:" : "Port:",
        `  ${a.ports}`,
      ];
    }
    if (sub === "update" || sub === "default") return ["Rules updated for profile '" + (name ?? "") + "'"];
    throw new UfwError("ERROR: Invalid syntax");
  }

  // ---------------------------------------------------------------- helper shell commands

  #ss(): string[] {
    const out = ["Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process"];
    for (const l of LISTENING)
      out.push(`${pad(l.proto, 6)}${pad(l.proto === "udp" ? "UNCONN" : "LISTEN", 7)}0      128    ${pad(l.addr, 20)}0.0.0.0:*         users:(("${l.proc}"))`);
    return out;
  }

  #systemctl(args: string[]): string[] {
    if (args[0] !== "status" || args[1] !== "ufw") throw new UfwError("Lab içinde yalnızca: systemctl status ufw");
    return [
      "● ufw.service - Uncomplicated firewall",
      "     Loaded: loaded (/lib/systemd/system/ufw.service; enabled; vendor preset: enabled)",
      `     Active: ${this.enabled ? "active (exited)" : "inactive (dead)"}`,
      "       Docs: man:ufw(8)",
      "    Process: 412 ExecStart=/lib/ufw/ufw-init start quiet (code=exited, status=0/SUCCESS)",
      "   Main PID: 412 (code=exited, status=0/SUCCESS)",
    ];
  }

  #cat(path: string | undefined, sudo: boolean): string[] {
    switch (path) {
      case "/etc/ufw/user.rules":
        this.#requireRoot(sudo);
        return this.userRules(false);
      case "/etc/ufw/user6.rules":
        this.#requireRoot(sudo);
        return this.userRules(true);
      case "/etc/default/ufw":
        return ["IPV6=yes", `DEFAULT_INPUT_POLICY="${policyTarget(this.defaults.incoming)}"`, `DEFAULT_OUTPUT_POLICY="${policyTarget(this.defaults.outgoing)}"`, 'DEFAULT_FORWARD_POLICY="DROP"', 'DEFAULT_APPLICATION_POLICY="SKIP"', "MANAGE_BUILTINS=no", 'IPT_SYSCTL=/etc/ufw/sysctl.conf'];
      case "/etc/ufw/ufw.conf":
        return ["# /etc/ufw/ufw.conf", `ENABLED=${this.enabled ? "yes" : "no"}`, `LOGLEVEL=${this.logging}`];
      case "/var/log/ufw.log":
        this.#requireRoot(sudo);
        return this.logs.length ? this.logs : [];
      default:
        throw new UfwError(`cat: ${path ?? ""}: No such file or directory (desteklenen: /etc/ufw/user.rules, /etc/ufw/user6.rules, /etc/default/ufw, /etc/ufw/ufw.conf, /var/log/ufw.log)`);
    }
  }

  #tail(args: string[], sudo: boolean): string[] {
    const path = args.find((a) => a.startsWith("/"));
    const out = this.#cat(path, sudo);
    return out.slice(-10);
  }

  #iptables(args: string[], sudo: boolean): string[] {
    this.#requireRoot(sudo);
    const chain = args.find((a) => a.startsWith("ufw")) ?? "ufw-user-input";
    const dir: Direction = chain.endsWith("output") ? "out" : "in";
    const out = [`Chain ${chain} (1 references)`, "target     prot opt source               destination"];
    if (!this.enabled) return [`iptables: No chain/target/match by that name. (ufw inactive)`];
    for (const r of this.rules.filter((r) => !r.v6 && r.direction === dir))
      for (const line of iptablesFor(r)) out.push(line);
    return out;
  }

  /** Render /etc/ufw/user.rules (or user6.rules) in the format ufw writes it. */
  userRules(v6: boolean): string[] {
    const p = v6 ? "ufw6" : "ufw";
    const out = [
      "*filter",
      `:${p}-user-input - [0:0]`,
      `:${p}-user-output - [0:0]`,
      `:${p}-user-forward - [0:0]`,
      `:${p}-user-limit - [0:0]`,
      `:${p}-user-limit-accept - [0:0]`,
      "### RULES ###",
      "",
    ];
    for (const r of this.rules.filter((r) => r.v6 === v6)) {
      out.push(`### tuple ### ${tupleString(r)}`);
      out.push(...iptablesFor(r, v6), "");
    }
    out.push(
      "### END RULES ###",
      "",
      "### LOGGING ###",
      `-A ${p}-user-limit -m limit --limit 3/minute -j LOG --log-prefix "[UFW LIMIT BLOCK] "`,
      `-A ${p}-user-limit -j REJECT`,
      `-A ${p}-user-limit-accept -j ACCEPT`,
      "### END LOGGING ###",
      "COMMIT",
    );
    return out;
  }

  // ---------------------------------------------------------------- packet evaluation

  /** Walk a packet through the netfilter / ufw chain structure. */
  evaluate(pkt: Packet, record = true): Evaluation {
    const steps: FlowStep[] = [];
    const inbound = pkt.direction === "in";
    const suffix = inbound ? "input" : "output";
    const p6 = isV6(pkt.src) || isV6(pkt.dst) ? "ufw6" : "ufw";
    const policy = inbound ? this.defaults.incoming : this.defaults.outgoing;

    steps.push({
      chain: inbound ? "PREROUTING → routing" : "local process → routing",
      note: inbound ? `${pkt.iface} arayüzüne geldi, hedef yerel makine (${pkt.dst})` : `yerel süreç ${pkt.dst} adresine paket gönderiyor`,
      result: "pass",
    });

    const finish = (verdict: Evaluation["verdict"], matchedRule?: Rule, logTag?: string): Evaluation => {
      let log: string | undefined;
      if (logTag && record) {
        log = kernLog(logTag, pkt);
        this.logs.push(log);
        this.save();
      }
      return { steps, verdict, matchedRule, log };
    };

    if (!this.enabled) {
      steps.push({ chain: inbound ? "INPUT" : "OUTPUT", note: "ufw pasif: ufw zincirleri yüklü değil, iptables politikası ACCEPT", result: "ACCEPT" });
      return finish("ACCEPT");
    }

    steps.push({ chain: inbound ? "INPUT" : "OUTPUT", note: `filter tablosu → ${p6}-before-logging-${suffix}`, result: "pass" });
    steps.push({ chain: `${p6}-before-logging-${suffix}`, note: "ön loglama kancası (varsayılan boş)", result: "pass" });

    // ---- before.rules
    const before = `${p6}-before-${suffix}`;
    if (pkt.iface === "lo") {
      steps.push({ chain: before, note: `-${inbound ? "i" : "o"} lo -j ACCEPT (loopback her zaman serbest)`, result: "ACCEPT" });
      return finish("ACCEPT");
    }
    if (pkt.established) {
      steps.push({ chain: before, note: "-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT", result: "ACCEPT" });
      return finish("ACCEPT");
    }
    if (inbound && pkt.proto === "icmp") {
      steps.push({ chain: before, note: "-p icmp --icmp-type echo-request -j ACCEPT (before.rules ping'e izin verir!)", result: "ACCEPT" });
      return finish("ACCEPT");
    }
    if (inbound && pkt.proto === "udp" && pkt.sport === 67 && pkt.dport === 68) {
      steps.push({ chain: before, note: "-p udp --sport 67 --dport 68 -j ACCEPT (DHCP istemcisi)", result: "ACCEPT" });
      return finish("ACCEPT");
    }
    steps.push({ chain: before, note: "loopback / ESTABLISHED / ICMP / DHCP değil → devam", result: "pass" });

    // ---- user.rules
    const user = `${p6}-user-${suffix}`;
    const candidates = this.ordered.filter((r) => r.direction === pkt.direction);
    for (const r of candidates) {
      if (!ruleMatches(r, pkt)) continue;
      const num = this.ordered.indexOf(r) + 1;
      if (r.action === "limit") {
        const key = `${r.id}|${pkt.src}`;
        const now = Date.now();
        const hits = (this.#limitHits.get(key) ?? []).filter((t) => now - t < 30_000);
        hits.push(now);
        if (record) this.#limitHits.set(key, hits);
        if (hits.length >= 6) {
          steps.push({ chain: user, note: `kural [${num}] ${ruleCommand(r)} — 30 sn içinde ${hits.length}. bağlantı → ${p6}-user-limit`, result: "REJECT", ruleId: r.id });
          return finish("REJECT", r, this.logging !== "off" ? "UFW LIMIT BLOCK" : undefined);
        }
        steps.push({ chain: user, note: `kural [${num}] ${ruleCommand(r)} — 30 sn içinde ${hits.length}/6 bağlantı → limit-accept`, result: "ACCEPT", ruleId: r.id });
        return finish("ACCEPT", r, ["medium", "high", "full"].includes(this.logging) ? "UFW ALLOW" : undefined);
      }
      const verdict = r.action === "allow" ? "ACCEPT" : r.action === "deny" ? "DROP" : "REJECT";
      steps.push({ chain: user, note: `kural [${num}] eşleşti: ${ruleCommand(r)}`, result: verdict, ruleId: r.id });
      const logTag =
        verdict === "ACCEPT"
          ? ["medium", "high", "full"].includes(this.logging) ? "UFW ALLOW" : undefined
          : ["high", "full"].includes(this.logging) ? "UFW BLOCK" : undefined;
      return finish(verdict, r, logTag);
    }
    steps.push({ chain: user, note: `${candidates.length} kural kontrol edildi, eşleşme yok`, result: "pass" });

    // ---- after.rules
    const after = `${p6}-after-${suffix}`;
    const noisy =
      inbound &&
      ((pkt.proto === "udp" && [137, 138, 67, 68].includes(pkt.dport)) || (pkt.proto === "tcp" && [139, 445].includes(pkt.dport)));
    if (noisy) {
      steps.push({ chain: after, note: `port ${pkt.dport} (NetBIOS/SMB/DHCP gürültüsü) → ufw-skip-to-policy (loglanmadan)`, result: "skip" });
    } else {
      steps.push({ chain: after, note: "after.rules özel durumlar: eşleşme yok", result: "pass" });
      steps.push({
        chain: `${p6}-after-logging-${suffix}`,
        note: policy !== "allow" && this.logging !== "off" ? `-j LOG --log-prefix "[UFW BLOCK] "` : "loglama yok",
        result: "pass",
      });
      steps.push({ chain: `${p6}-reject-${suffix}`, note: "reject kancası (varsayılan boş)", result: "pass" });
      steps.push({ chain: `${p6}-track-${suffix}`, note: inbound ? "boş" : "yeni giden bağlantılar conntrack ile izlenir", result: "pass" });
    }

    const verdict = policy === "allow" ? "ACCEPT" : policy === "deny" ? "DROP" : "REJECT";
    steps.push({
      chain: `policy (${inbound ? "incoming" : "outgoing"})`,
      note: `varsayılan politika: default ${policy} ${inbound ? "incoming" : "outgoing"}`,
      result: verdict,
    });
    const logTag =
      verdict !== "ACCEPT" && !noisy && this.logging !== "off"
        ? "UFW BLOCK"
        : verdict === "ACCEPT" && ["high", "full"].includes(this.logging)
          ? "UFW ALLOW"
          : undefined;
    return finish(verdict, undefined, logTag);
  }
}

// -------------------------------------------------------------------- pure helpers

function policyTarget(p: Policy) {
  return p === "allow" ? "ACCEPT" : p === "deny" ? "DROP" : "REJECT";
}

function sameTuple(a: Omit<Rule, "id">, b: Omit<Rule, "id">) {
  return (
    a.direction === b.direction &&
    a.from === b.from &&
    a.to === b.to &&
    a.port === b.port &&
    a.proto === b.proto &&
    (a.app ?? "") === (b.app ?? "") &&
    (a.iface ?? "") === (b.iface ?? "") &&
    a.v6 === b.v6
  );
}

export function ruleMatches(r: Rule, pkt: Packet): boolean {
  if (r.direction !== pkt.direction) return false;
  if (r.v6 !== (isV6(pkt.src) || isV6(pkt.dst))) return false;
  if (r.iface && r.iface !== pkt.iface) return false;
  if (r.proto !== "any" && r.proto !== pkt.proto) return false;
  if (r.port !== null) {
    if (pkt.proto === "icmp") return false;
    if (!portMatches(r.port, pkt.dport)) return false;
  }
  return addrMatches(r.from, pkt.src) && addrMatches(r.to, pkt.dst);
}

function anywhere(r: Rule) {
  return r.v6 ? "Anywhere (v6)" : "Anywhere";
}

export function ruleTo(r: Rule): string {
  const v6 = r.v6 ? " (v6)" : "";
  let s: string;
  if (r.app) s = r.to === "any" ? r.app + v6 : `${r.to} ${r.app}`;
  else if (r.port) {
    const p = r.port + (r.proto !== "any" ? `/${r.proto}` : "");
    s = r.to === "any" ? p + v6 : `${r.to} ${p}`;
  } else s = r.to === "any" ? anywhere(r) : r.to + (r.proto !== "any" ? `/${r.proto}` : "");
  return r.iface && r.direction === "in" ? `${s} on ${r.iface}` : s;
}

export function ruleFrom(r: Rule): string {
  const s = r.from === "any" ? anywhere(r) : r.from;
  return r.iface && r.direction === "out" ? `${s} on ${r.iface}` : s;
}

/** Reconstruct the canonical `ufw ...` command for a rule. */
export function ruleCommand(r: Rule): string {
  const parts = ["ufw", r.action];
  if (r.direction === "out") parts.push("out");
  if (r.iface) parts.push("on", r.iface);
  const simple = r.from === "any" && r.to === "any" && !r.iface;
  if (r.app && simple) parts.push(r.app.includes(" ") ? `'${r.app}'` : r.app);
  else if (simple && r.port) parts.push(r.port + (r.proto !== "any" ? `/${r.proto}` : ""));
  else {
    if (r.from !== "any" || (!r.port && r.to === "any" && !r.app)) parts.push("from", r.from);
    if (r.to !== "any" || r.port || r.app) parts.push("to", r.to);
    if (r.app) parts.push("app", r.app.includes(" ") ? `'${r.app}'` : r.app);
    else if (r.port) parts.push("port", r.port);
    if (!r.app && r.proto !== "any") parts.push("proto", r.proto);
  }
  if (r.comment) parts.push("comment", `'${r.comment}'`);
  return parts.join(" ");
}

function tupleString(r: Rule): string {
  const net = r.v6 ? "::/0" : "0.0.0.0/0";
  const from = r.from === "any" ? net : r.from;
  const to = r.to === "any" ? net : r.to;
  const dir = r.direction + (r.iface ? `_${r.iface}` : "");
  const app = r.app ? ` ${r.app.replace(/ /g, "%20")} -` : "";
  return `${r.action} ${r.proto} ${r.port ?? "any"} ${to} any ${from}${app} ${dir}${r.comment ? ` comment=${r.comment}` : ""}`;
}

/** The iptables lines ufw generates for a rule inside ufw-user-{input,output}. */
export function iptablesFor(r: Rule, v6 = r.v6): string[] {
  const chain = `${v6 ? "ufw6" : "ufw"}-user-${r.direction === "in" ? "input" : "output"}`;
  const protos = r.port && r.proto === "any" ? ["tcp", "udp"] : r.proto === "any" ? [null] : [r.proto];
  const target = { allow: "ACCEPT", deny: "DROP", reject: "REJECT", limit: "" }[r.action];
  const out: string[] = [];
  for (const p of protos) {
    const m: string[] = [`-A ${chain}`];
    if (r.iface) m.push(r.direction === "in" ? `-i ${r.iface}` : `-o ${r.iface}`);
    if (p) m.push(`-p ${p}`);
    if (r.from !== "any") m.push(`-s ${r.from}`);
    if (r.to !== "any") m.push(`-d ${r.to}`);
    if (r.port) m.push(r.port.includes(",") || r.port.includes(":") ? `-m multiport --dports ${r.port}` : `--dport ${r.port}`);
    const match = m.join(" ");
    if (r.action === "limit") {
      out.push(`${match} -m conntrack --ctstate NEW -m recent --set`);
      out.push(`${match} -m conntrack --ctstate NEW -m recent --update --seconds 30 --hitcount 6 -j ${v6 ? "ufw6" : "ufw"}-user-limit`);
      out.push(`${match} -j ${v6 ? "ufw6" : "ufw"}-user-limit-accept`);
    } else {
      out.push(`${match} -j ${target}${r.action === "reject" && p === "tcp" ? " --reject-with tcp-reset" : ""}`);
    }
  }
  return out;
}

function kernLog(tag: string, p: Packet): string {
  const d = new Date();
  const ts = d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(",", "");
  const io = p.direction === "in" ? `IN=${p.iface} OUT=` : `IN= OUT=${p.iface}`;
  const ports = p.proto === "icmp" ? "TYPE=8 CODE=0" : `SPT=${p.sport} DPT=${p.dport}`;
  const flags = p.proto === "tcp" ? " WINDOW=64240 RES=0x00 SYN URGP=0" : "";
  return `${ts} ufw-lab kernel: [UFW ${tag.replace("UFW ", "")}] ${io} SRC=${p.src} DST=${p.dst} LEN=60 TTL=64 PROTO=${p.proto.toUpperCase()} ${ports}${flags}`;
}

const HELP = [
  "Desteklenen komutlar:",
  "  sudo ufw status [verbose|numbered]      sudo ufw enable | disable | reload | reset",
  "  sudo ufw default allow|deny|reject incoming|outgoing|routed",
  "  sudo ufw allow|deny|reject|limit [in|out] [on IF] PORT[/tcp|udp] | SERVICE | APP",
  "  sudo ufw allow from ADDR [to ADDR] [port P] [proto tcp|udp] [comment 'x']",
  "  sudo ufw insert N <kural>              sudo ufw delete N | delete <kural>",
  "  sudo ufw app list | app info NAME      sudo ufw logging on|off|low|medium|high|full",
  "  sudo ufw show added",
  "Yardımcılar: ss -tulpn, systemctl status ufw, sudo cat /etc/ufw/user.rules,",
  "  sudo tail /var/log/ufw.log, sudo iptables -L ufw-user-input, history, clear",
  "Onay isteyen komutlar (enable, reset, delete N) için 'y' yazın veya --force ekleyin.",
];

const UFW_USAGE = [
  "Usage: ufw COMMAND",
  "",
  "Commands:",
  " enable                          enables the firewall",
  " disable                         disables the firewall",
  " default ARG                     set default policy",
  " logging LEVEL                   set logging to LEVEL",
  " allow ARGS                      add allow rule",
  " deny ARGS                       add deny rule",
  " reject ARGS                     add reject rule",
  " limit ARGS                      add limit rule",
  " delete RULE|NUM                 delete RULE",
  " insert NUM RULE                 insert RULE at NUM",
  " reload                          reload firewall",
  " reset                           reset firewall",
  " status                          show firewall status",
  " status numbered                 show firewall status as numbered list of RULES",
  " status verbose                  show verbose firewall status",
  " show ARG                        show firewall report",
  " version                         display version information",
  "",
  "Application profile commands:",
  " app list                        list application profiles",
  " app info PROFILE                show information on PROFILE",
];

export const firewall = new Firewall();
