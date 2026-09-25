use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
struct HostOutput {
    command: String,
    ok: bool,
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

/// Read-only queries against the real host firewall. Only a fixed whitelist of
/// commands can run; the frontend never passes arbitrary arguments.
fn query_args(kind: &str) -> Option<(&'static [&'static str], bool)> {
    Some(match kind {
        "status" => (&["ufw", "status", "verbose"], true),
        "numbered" => (&["ufw", "status", "numbered"], true),
        "added" => (&["ufw", "show", "added"], true),
        "apps" => (&["ufw", "app", "list"], true),
        "version" => (&["ufw", "version"], false),
        "listening" => (&["ss", "-tulpn"], false),
        _ => return None,
    })
}

#[tauri::command]
async fn host_query(kind: String, elevate: bool) -> Result<HostOutput, String> {
    let (args, needs_root) = query_args(&kind).ok_or_else(|| format!("unknown query '{kind}'"))?;

    let mut argv: Vec<&str> = Vec::new();
    if needs_root {
        if elevate {
            argv.push("pkexec");
        } else {
            argv.extend(["sudo", "-n"]);
        }
    }
    argv.extend_from_slice(args);
    let command = argv.join(" ");

    tauri::async_runtime::spawn_blocking(move || {
        match Command::new(argv[0]).args(&argv[1..]).env("LC_ALL", "C").output() {
            Ok(out) => Ok(HostOutput {
                command,
                ok: out.status.success(),
                code: out.status.code(),
                stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
            }),
            Err(e) => Err(format!("{}: {e}", argv[0])),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![host_query])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
