const KEY = "ufw-lab-progress-v1";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

class LabProgress {
  done = $state<string[]>(read());

  markDone(id: string) {
    if (this.done.includes(id)) return;
    this.done.push(id);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.done));
    } catch {
      /* ignore */
    }
  }
}

export const labProgress = new LabProgress();
