export type Action = "allow" | "deny" | "reject" | "limit";
export type Direction = "in" | "out";
export type Proto = "tcp" | "udp" | "any";
export type PacketProto = "tcp" | "udp" | "icmp";
export type Policy = "allow" | "deny" | "reject";
export type LogLevel = "off" | "low" | "medium" | "high" | "full";

export interface Rule {
  id: number;
  action: Action;
  direction: Direction;
  /** "any" or IPv4/IPv6 address / CIDR */
  from: string;
  to: string;
  /** null = all ports; "22", "8000:8100", "80,443" */
  port: string | null;
  proto: Proto;
  /** application profile name, if the rule was created from one */
  app?: string;
  iface?: string;
  v6: boolean;
  comment?: string;
}

export interface Packet {
  direction: Direction;
  src: string;
  dst: string;
  sport: number;
  dport: number;
  proto: PacketProto;
  /** true = part of an existing connection (conntrack ESTABLISHED) */
  established: boolean;
  iface: string;
}

export type Verdict = "ACCEPT" | "DROP" | "REJECT";

export interface FlowStep {
  chain: string;
  note: string;
  /** step outcome: "pass" continues to next chain */
  result: "pass" | Verdict | "skip";
  ruleId?: number;
}

export interface Evaluation {
  steps: FlowStep[];
  verdict: Verdict;
  matchedRule?: Rule;
  log?: string;
}

export interface TermLine {
  kind: "cmd" | "out" | "err" | "info";
  text: string;
}
