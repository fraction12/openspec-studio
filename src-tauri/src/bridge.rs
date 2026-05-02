use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::{
    cmp, env,
    ffi::{OsStr, OsString},
    fs,
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

const DEFAULT_COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_MAX_COMMAND_OUTPUT_BYTES: usize = 1024 * 1024;
const DEFAULT_RUNNER_HTTP_TIMEOUT: Duration = Duration::from_secs(5);
const DEFAULT_RUNNER_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_MAX_RUNNER_RESPONSE_BYTES: usize = 64 * 1024;
const COMMAND_TERMINATION_GRACE: Duration = Duration::from_millis(200);
const OUTPUT_READER_DRAIN_TIMEOUT: Duration = Duration::from_millis(500);
const STANDARD_COMMAND_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/opt/local/bin",
    "/usr/bin",
    "/bin",
];

static STUDIO_RUNNER_SESSION_SECRET: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static STUDIO_RUNNER_PROCESS: OnceLock<Mutex<Option<StudioRunnerProcess>>> = OnceLock::new();
static STUDIO_RUNNER_EVENT_STREAM: OnceLock<Mutex<Option<StudioRunnerEventStreamHandle>>> =
    OnceLock::new();

fn studio_runner_session_secret() -> &'static Mutex<Option<String>> {
    STUDIO_RUNNER_SESSION_SECRET.get_or_init(|| Mutex::new(None))
}

fn studio_runner_process() -> &'static Mutex<Option<StudioRunnerProcess>> {
    STUDIO_RUNNER_PROCESS.get_or_init(|| Mutex::new(None))
}

fn studio_runner_event_stream() -> &'static Mutex<Option<StudioRunnerEventStreamHandle>> {
    STUDIO_RUNNER_EVENT_STREAM.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RepositoryValidation {
    pub path: String,
    pub name: String,
    pub has_openspec: bool,
    pub openspec_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub status_code: Option<i32>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArtifactFile {
    pub path: String,
    pub relative_path: String,
    pub contents: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenSpecFileRecord {
    pub path: String,
    pub kind: String,
    pub modified_time_ms: Option<u128>,
    pub file_size: Option<u64>,
    pub content: Option<String>,
    pub read_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct OpenSpecFileListOptions {
    pub include_content: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenSpecGitStatus {
    pub available: bool,
    pub dirty_count: usize,
    pub entries: Vec<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerSettings {
    pub endpoint: String,
    #[serde(rename = "repoPath", default)]
    pub repo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerSessionSecretResponse {
    pub configured: bool,
}

#[derive(Debug)]
struct StudioRunnerProcess {
    child: Option<Child>,
    pid: u32,
    endpoint: String,
    port: u16,
    repo_path: PathBuf,
    recovered: bool,
}

#[derive(Debug)]
struct StudioRunnerEventStreamHandle {
    endpoint: String,
    stop: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerStreamRequest {
    pub endpoint: String,
    #[serde(rename = "repoPath", default)]
    pub repo_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerStreamResponse {
    pub streaming: bool,
    pub endpoint: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerStreamEvent {
    pub event_name: String,
    pub event_id: Option<String>,
    pub repo_path: Option<String>,
    pub repo_change_key: Option<String>,
    pub change_name: Option<String>,
    pub status: Option<String>,
    pub run_id: Option<String>,
    pub recorded_at: Option<String>,
    pub workspace_path: Option<String>,
    pub workspace_status: Option<String>,
    pub workspace_created_at: Option<String>,
    pub workspace_updated_at: Option<String>,
    pub session_id: Option<String>,
    pub source_repo_path: Option<String>,
    pub base_commit_sha: Option<String>,
    pub branch_name: Option<String>,
    pub commit_sha: Option<String>,
    pub pr_url: Option<String>,
    pub pr_state: Option<String>,
    pub pr_merged_at: Option<String>,
    pub pr_closed_at: Option<String>,
    pub cleanup_eligible: Option<bool>,
    pub cleanup_reason: Option<String>,
    pub cleanup_status: Option<String>,
    pub cleanup_error: Option<String>,
    pub execution_log_entries: Option<serde_json::Value>,
    pub error: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerLifecycleRequest {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "endpoint", default)]
    pub endpoint: Option<String>,
    #[serde(default)]
    pub restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerLifecycleResponse {
    pub started: bool,
    pub endpoint: String,
    pub port: u16,
    pub pid: Option<u32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerStatus {
    pub configured: bool,
    pub reachable: bool,
    pub status: String,
    pub endpoint: Option<String>,
    pub runner_endpoint: Option<String>,
    pub runner_repo_path: Option<String>,
    pub status_code: Option<u16>,
    pub message: String,
    pub response_body: Option<String>,
    pub managed: bool,
    pub pid: Option<u32>,
    pub ownership: String,
    pub can_stop: bool,
    pub can_restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioRunnerDispatchResponse {
    pub event_id: String,
    pub status_code: u16,
    pub accepted: bool,
    pub message: String,
    pub response_body: Option<String>,
    pub run_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerDispatchRequest {
    #[serde(rename = "eventId")]
    pub event_id: String,
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "repoName")]
    pub repo_name: String,
    #[serde(rename = "changeName")]
    pub change_name: String,
    #[serde(rename = "artifactPaths")]
    pub artifact_paths: Vec<String>,
    pub validation: StudioRunnerDispatchValidation,
    #[serde(rename = "gitRef")]
    pub git_ref: String,
    #[serde(rename = "requestedBy")]
    pub requested_by: String,
    #[serde(rename = "runnerModel")]
    pub runner_model: Option<String>,
    #[serde(rename = "runnerEffort")]
    pub runner_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerDispatchValidation {
    pub state: String,
    #[serde(rename = "checkedAt")]
    pub checked_at: Option<String>,
    #[serde(rename = "issueCount")]
    pub issue_count: usize,
}

pub(crate) mod openspec;
pub(crate) mod shared;
pub(crate) mod studio_runner;

#[cfg(test)]
mod tests {
    use super::openspec::*;
    use super::shared::*;
    use super::studio_runner::*;
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::{
        fs,
        path::PathBuf,
        process::{self, Child, Command, Stdio},
        sync::{mpsc, Mutex, OnceLock},
        thread,
        time::{SystemTime, UNIX_EPOCH},
    };
    use tiny_http::{Header, Response, Server};

    fn temp_repo(name: &str, with_openspec: bool) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after Unix epoch")
            .as_nanos();
        let repo =
            std::env::temp_dir().join(format!("openspec-studio-{name}-{}-{nanos}", process::id()));
        fs::create_dir_all(&repo).expect("temp repo should be created");

        if with_openspec {
            fs::create_dir_all(repo.join("openspec"))
                .expect("openspec directory should be created");
        }

        repo
    }

    fn cleanup(path: PathBuf) {
        let _ = fs::remove_dir_all(path);
    }

    fn reset_studio_runner_process_for_test() {
        if let Ok(mut store) = studio_runner_process().lock() {
            if let Some(mut process) = store.take() {
                terminate_runner_process(process.pid, process.child.as_mut());
            }
        }
    }

    fn runner_lifecycle_test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn lock_runner_bridge_state_for_test() -> std::sync::MutexGuard<'static, ()> {
        runner_lifecycle_test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[cfg(unix)]
    fn write_executable(path: &Path, contents: &str) {
        fs::write(path, contents).expect("script should be written");
        fs::set_permissions(path, fs::Permissions::from_mode(0o755))
            .expect("script should be executable");
    }

    #[cfg(unix)]
    fn spawn_custom_health_server(port: u16) -> Child {
        Command::new("python3")
            .arg("-u")
            .arg("-c")
            .arg(
                r#"
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
port = int(sys.argv[1])
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/v1/studio-runner/health':
            self.send_response(200)
            self.send_header('content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *args):
        pass
HTTPServer(('127.0.0.1', port), Handler).serve_forever()
"#,
            )
            .arg(port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("custom health server should start")
    }

    #[test]
    fn derives_runner_stream_endpoint_from_events_endpoint() {
        let endpoint =
            normalize_runner_stream_endpoint("http://127.0.0.1:4000/api/v1/studio-runner/events")
                .unwrap();
        assert_eq!(
            endpoint,
            "http://127.0.0.1:4000/api/v1/studio-runner/events/stream"
        );
    }

    #[test]
    fn parses_runner_stream_event_payload() {
        let event = parse_runner_stream_event(
            "runner.completed",
            r#"{"eventId":"evt_demo","runId":"run_demo","repoChangeKey":"/repo/demo::add-stream","status":"completed","branchName":"studio/add-stream","commitSha":"abcdef123456","prUrl":"https://github.com/example/repo/pull/1","workspacePath":"/tmp/work","workspaceStatus":"ready","workspaceCreatedAt":"2026-04-29T11:59:00Z","workspaceUpdatedAt":"2026-04-29T12:00:30Z","sessionId":"session_demo","sourceRepoPath":"/repo/source","baseCommitSha":"111111122222","prState":"open","prMergedAt":null,"prClosedAt":null,"cleanupEligible":true,"cleanupReason":"completed","cleanupStatus":"pending","cleanupError":null,"executionLogEntries":[{"recordedAt":"2026-04-29T12:00:01Z","level":"info","source":"agent","message":"Agent finished."}],"recordedAt":"2026-04-29T12:00:00Z"}"#,
            None,
        )
        .unwrap();

        assert_eq!(event.event_name, "runner.completed");
        assert_eq!(event.event_id.as_deref(), Some("evt_demo"));
        assert_eq!(event.repo_path.as_deref(), Some("/repo/demo"));
        assert_eq!(event.change_name.as_deref(), Some("add-stream"));
        assert_eq!(
            event.pr_url.as_deref(),
            Some("https://github.com/example/repo/pull/1")
        );
        assert_eq!(event.workspace_status.as_deref(), Some("ready"));
        assert_eq!(
            event.workspace_created_at.as_deref(),
            Some("2026-04-29T11:59:00Z")
        );
        assert_eq!(
            event.workspace_updated_at.as_deref(),
            Some("2026-04-29T12:00:30Z")
        );
        assert_eq!(event.source_repo_path.as_deref(), Some("/repo/source"));
        assert_eq!(event.base_commit_sha.as_deref(), Some("111111122222"));
        assert_eq!(event.pr_state.as_deref(), Some("open"));
        assert_eq!(event.cleanup_eligible, Some(true));
        assert_eq!(event.cleanup_reason.as_deref(), Some("completed"));
        assert_eq!(event.cleanup_status.as_deref(), Some("pending"));
        let execution_entries = event
            .execution_log_entries
            .as_ref()
            .and_then(serde_json::Value::as_array)
            .expect("execution entries should be preserved");
        assert_eq!(execution_entries.len(), 1);
        assert_eq!(
            execution_entries[0]
                .get("message")
                .and_then(serde_json::Value::as_str),
            Some("Agent finished.")
        );
    }

    fn runner_request(event_id: &str) -> StudioRunnerDispatchRequest {
        StudioRunnerDispatchRequest {
            event_id: event_id.to_string(),
            repo_path: "/tmp/openspec-studio".to_string(),
            repo_name: "openspec-studio".to_string(),
            change_name: "add-runner".to_string(),
            artifact_paths: vec![
                "openspec/changes/add-runner/proposal.md".to_string(),
                "openspec/changes/add-runner/tasks.md".to_string(),
            ],
            validation: StudioRunnerDispatchValidation {
                state: "pass".to_string(),
                checked_at: Some("2026-04-29T12:00:00.000Z".to_string()),
                issue_count: 0,
            },
            git_ref: "local".to_string(),
            requested_by: "local-user".to_string(),
            runner_model: None,
            runner_effort: None,
        }
    }

    fn mock_runner_response(
        status_code: u16,
        body: String,
    ) -> (
        String,
        mpsc::Receiver<(String, Vec<(String, String)>, String)>,
        thread::JoinHandle<()>,
    ) {
        let server = Server::http("127.0.0.1:0").expect("mock runner should bind");
        let endpoint = format!(
            "http://127.0.0.1:{}/api/v1/studio-runner/events",
            server
                .server_addr()
                .to_ip()
                .expect("mock runner should bind to tcp")
                .port()
        );
        let (tx, rx) = mpsc::channel();
        let handle = thread::spawn(move || {
            let mut request = server.recv().expect("mock runner should receive request");
            let mut request_body = String::new();
            request
                .as_reader()
                .read_to_string(&mut request_body)
                .expect("request body should be readable");
            let headers = request
                .headers()
                .iter()
                .map(|header| {
                    (
                        header.field.as_str().to_string(),
                        header.value.as_str().to_string(),
                    )
                })
                .collect::<Vec<_>>();
            tx.send((request.url().to_string(), headers, request_body))
                .expect("captured request should be sent");
            let response = Response::from_string(body)
                .with_status_code(status_code)
                .with_header(
                    Header::from_bytes(&b"content-type"[..], &b"application/json"[..]).unwrap(),
                );
            request
                .respond(response)
                .expect("mock response should send");
        });

        (endpoint, rx, handle)
    }

    #[test]
    fn signs_runner_body_with_standard_webhooks_message() {
        let signature = sign_runner_body(
            "secret",
            "evt_demo",
            1_714_000_000,
            br#"{"type":"build.requested"}"#,
        )
        .expect("signature should be created");

        assert!(signature.starts_with("v1,"));
        assert_eq!(signature, "v1,bfnTTaozpRBENwyatlSmXfjGN2VC4vUYM23PsFmqlFs=");
    }

    #[test]
    fn runner_endpoint_is_limited_to_localhost() {
        assert!(
            normalize_runner_endpoint("http://127.0.0.1:4000/api/v1/studio-runner/events").is_ok()
        );
        assert!(
            normalize_runner_endpoint("https://localhost:4000/api/v1/studio-runner/events").is_ok()
        );
        assert!(matches!(
            normalize_runner_endpoint("https://example.com/api/v1/studio-runner/events"),
            Err(BridgeError::RunnerRequest { .. })
        ));
        assert!(matches!(
            normalize_runner_endpoint("http://localhost:4000@evil.com/api/v1/studio-runner/events"),
            Err(BridgeError::RunnerRequest { .. })
        ));
        assert!(matches!(
            normalize_runner_endpoint("http://localhost/api/v1/studio-runner/events"),
            Err(BridgeError::RunnerRequest { .. })
        ));
    }

    #[test]
    fn builds_runner_payload_in_bridge_and_dispatches_signed_request() {
        let _guard = lock_runner_bridge_state_for_test();
        clear_runner_session_secret().expect("secret should start clear");
        let (endpoint, rx, handle) =
            mock_runner_response(202, r#"{"run_id":"run_demo"}"#.to_string());
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let mut request = runner_request("evt_mock");
        request.runner_model = Some("gpt-custom".to_string());
        request.runner_effort = Some("high".to_string());
        let response = dispatch_runner_event(
            StudioRunnerSettings {
                endpoint,
                repo_path: None,
            },
            request,
        )
        .expect("dispatch should succeed");

        assert!(response.accepted);
        assert_eq!(response.run_id.as_deref(), Some("run_demo"));
        let (url, headers, body) = rx.recv().expect("mock request should be captured");
        handle.join().expect("mock runner thread should finish");
        assert_eq!(url, "/api/v1/studio-runner/events");
        assert!(headers
            .iter()
            .any(|(name, value)| name.eq_ignore_ascii_case("webhook-id") && value == "evt_mock"));
        assert!(headers
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case("webhook-timestamp")));
        assert!(headers.iter().any(
            |(name, value)| name.eq_ignore_ascii_case("webhook-signature")
                && value.starts_with("v1,")
        ));

        let payload: serde_json::Value =
            serde_json::from_str(&body).expect("payload should be valid json");
        assert_eq!(payload["id"], "evt_mock");
        assert_eq!(payload["type"], "build.requested");
        assert_eq!(payload["source"], "openspec-studio");
        assert_eq!(payload["data"]["change"], "add-runner");
        assert_eq!(payload["data"]["runnerModel"], "gpt-custom");
        assert_eq!(payload["data"]["runnerEffort"], "high");
        assert!(payload["data"].get("proposal").is_none());
    }

    #[test]
    fn runner_process_path_prefers_standard_tool_dirs() {
        let path = runner_process_path();
        let entries: Vec<PathBuf> = env::split_paths(&path).collect();
        assert_eq!(entries.first(), Some(&PathBuf::from("/opt/homebrew/bin")));
        assert!(entries.contains(&PathBuf::from("/usr/bin")));
    }

    #[cfg(unix)]
    #[test]
    fn starts_and_stops_managed_studio_runner_process() {
        let _guard = lock_runner_bridge_state_for_test();
        reset_studio_runner_process_for_test();
        clear_runner_session_secret().expect("secret should start clear");
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let runner_repo = temp_repo("runner-lifecycle", false);
        fs::write(runner_repo.join("WORKFLOW.md"), "# Workflow\n")
            .expect("workflow should be written");
        let bin_dir = runner_repo.join("bin");
        fs::create_dir_all(&bin_dir).expect("bin dir should be created");
        let runner_bin = bin_dir.join("symphony");
        write_executable(
            &runner_bin,
            r#"#!/bin/sh
port=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--port" ]; then
    shift
    port="$1"
  fi
  shift
done
exec python3 -u - "$port" "$PWD/WORKFLOW.md" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys
port = int(sys.argv[1])
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/v1/studio-runner/health':
            self.send_response(200)
            self.send_header('content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *args):
        pass
HTTPServer(('127.0.0.1', port), Handler).serve_forever()
PY
"#,
        );
        let previous_bin = std::env::var_os("OPENSPEC_STUDIO_RUNNER_BIN");
        std::env::set_var("OPENSPEC_STUDIO_RUNNER_BIN", &runner_bin);

        let listener =
            std::net::TcpListener::bind("127.0.0.1:0").expect("ephemeral port should bind");
        let port = listener
            .local_addr()
            .expect("local addr should exist")
            .port();
        drop(listener);
        let endpoint = format!("http://127.0.0.1:{port}/api/v1/studio-runner/events");

        let response = start_runner_process(StudioRunnerLifecycleRequest {
            repo_path: path_to_string(&runner_repo),
            endpoint: Some(endpoint.clone()),
            restart: false,
        })
        .expect("runner should start and pass health");
        assert!(response.started);
        assert_eq!(response.port, port);
        let status = check_runner_status(StudioRunnerSettings {
            endpoint: response.endpoint.clone(),
            repo_path: Some(path_to_string(&runner_repo)),
        })
        .expect("status should be available");
        assert!(status.reachable);
        assert!(status.managed);
        assert_eq!(status.pid, response.pid);
        assert_eq!(
            status.runner_endpoint.as_deref(),
            Some(response.endpoint.as_str())
        );

        let other_endpoint_status = check_runner_status(StudioRunnerSettings {
            endpoint: format!("http://127.0.0.1:{}/api/v1/studio-runner/events", port + 1),
            repo_path: Some(path_to_string(&runner_repo)),
        })
        .expect("other endpoint status should be reported");
        assert!(!other_endpoint_status.managed);
        assert_eq!(other_endpoint_status.pid, None);
        assert_eq!(
            other_endpoint_status.runner_endpoint.as_deref(),
            Some(response.endpoint.as_str())
        );

        let recovered_status = {
            let mut store = studio_runner_process()
                .lock()
                .expect("runner process store should lock");
            if let Some(process) = store.as_mut() {
                process.child = None;
            }
            drop(store);
            clear_runner_session_secret().expect("secret should clear before recovery check");
            check_runner_status(StudioRunnerSettings {
                endpoint: response.endpoint.clone(),
                repo_path: Some(path_to_string(&runner_repo)),
            })
            .expect("detached managed runner should recover without session secret")
        };
        assert!(recovered_status.reachable);
        assert!(recovered_status.managed);
        assert_eq!(recovered_status.ownership, "recovered");
        assert!(recovered_status.can_stop);
        assert!(recovered_status.can_restart);
        assert_eq!(recovered_status.pid, response.pid);
        assert_eq!(
            recovered_status.runner_repo_path.as_deref(),
            Some(
                path_to_string(
                    &canonicalize_runner_dir(&path_to_string(&runner_repo), "test runner repo")
                        .expect("runner repo should canonicalize")
                )
                .as_str()
            )
        );

        let stopped = stop_runner_process().expect("runner should stop");
        assert_eq!(stopped.port, port);

        if let Some(value) = previous_bin {
            std::env::set_var("OPENSPEC_STUDIO_RUNNER_BIN", value);
        } else {
            std::env::remove_var("OPENSPEC_STUDIO_RUNNER_BIN");
        }
        reset_studio_runner_process_for_test();
        cleanup(runner_repo);
    }

    #[cfg(unix)]
    #[test]
    fn reports_custom_runner_as_status_only_and_refuses_replacement() {
        let _guard = lock_runner_bridge_state_for_test();
        reset_studio_runner_process_for_test();
        clear_runner_session_secret().expect("secret should start clear");
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let runner_repo = temp_repo("custom-runner-status", false);
        fs::write(runner_repo.join("WORKFLOW.md"), "# Workflow\n")
            .expect("workflow should be written");

        let listener =
            std::net::TcpListener::bind("127.0.0.1:0").expect("ephemeral port should bind");
        let port = listener
            .local_addr()
            .expect("local addr should exist")
            .port();
        drop(listener);
        let endpoint = format!("http://127.0.0.1:{port}/api/v1/studio-runner/events");
        let mut child = spawn_custom_health_server(port);
        wait_for_runner_health(&endpoint, DEFAULT_RUNNER_STARTUP_TIMEOUT)
            .expect("custom runner health should become reachable");

        let status = check_runner_status(StudioRunnerSettings {
            endpoint: endpoint.clone(),
            repo_path: Some(path_to_string(&runner_repo)),
        })
        .expect("custom runner status should be available");
        assert!(status.reachable);
        assert!(!status.managed);
        assert_eq!(status.ownership, "custom");
        assert!(!status.can_stop);
        assert!(!status.can_restart);

        let restart = start_runner_process(StudioRunnerLifecycleRequest {
            repo_path: path_to_string(&runner_repo),
            endpoint: Some(endpoint),
            restart: true,
        });
        assert!(matches!(restart, Err(BridgeError::RunnerRequest { .. })));

        terminate_runner_process(child.id(), Some(&mut child));
        reset_studio_runner_process_for_test();
        cleanup(runner_repo);
    }

    #[test]
    fn runner_dispatch_requires_session_secret() {
        let _guard = lock_runner_bridge_state_for_test();
        clear_runner_session_secret().expect("secret should clear");
        let result = dispatch_runner_event(
            StudioRunnerSettings {
                endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events".to_string(),
                repo_path: None,
            },
            runner_request("evt_no_secret"),
        );

        assert!(matches!(result, Err(BridgeError::RunnerRequest { .. })));
    }

    #[test]
    fn runner_dispatch_reports_non_accepted_status() {
        let _guard = lock_runner_bridge_state_for_test();
        clear_runner_session_secret().expect("secret should start clear");
        let (endpoint, _rx, handle) =
            mock_runner_response(409, r#"{"error":"duplicate"}"#.to_string());
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let response = dispatch_runner_event(
            StudioRunnerSettings {
                endpoint,
                repo_path: None,
            },
            runner_request("evt_conflict"),
        )
        .expect("dispatch should return bounded response metadata");
        handle.join().expect("mock runner thread should finish");

        assert!(!response.accepted);
        assert_eq!(response.status_code, 409);
        assert_eq!(
            response.response_body.as_deref(),
            Some(r#"{"error":"duplicate"}"#)
        );
    }

    #[test]
    fn runner_dispatch_rejects_oversized_response() {
        let _guard = lock_runner_bridge_state_for_test();
        clear_runner_session_secret().expect("secret should start clear");
        let (endpoint, _rx, handle) =
            mock_runner_response(202, "x".repeat(DEFAULT_MAX_RUNNER_RESPONSE_BYTES + 1));
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let result = dispatch_runner_event(
            StudioRunnerSettings {
                endpoint,
                repo_path: None,
            },
            runner_request("evt_large"),
        );
        handle.join().expect("mock runner thread should finish");

        assert!(matches!(result, Err(BridgeError::RunnerRequest { .. })));
    }

    #[test]
    fn derives_runner_health_endpoint_from_events_endpoint() {
        assert_eq!(
            runner_health_endpoint("http://127.0.0.1:4000/api/v1/studio-runner/events"),
            "http://127.0.0.1:4000/api/v1/studio-runner/health"
        );
    }

    #[test]
    fn validate_repository_detects_openspec_directory() {
        let repo = temp_repo("valid", true);

        let validation = validate_repository(&repo).expect("valid repo should be inspected");

        assert!(validation.has_openspec);
        assert_eq!(
            PathBuf::from(validation.path),
            fs::canonicalize(&repo).expect("repo should canonicalize")
        );
        assert_eq!(
            validation.openspec_path.map(PathBuf::from),
            Some(fs::canonicalize(repo.join("openspec")).expect("openspec should canonicalize"))
        );

        cleanup(repo);
    }

    #[test]
    fn validate_repository_reports_missing_openspec_without_creating_it() {
        let repo = temp_repo("missing-openspec", false);

        let validation = validate_repository(&repo).expect("repo should still be inspected");

        assert!(!validation.has_openspec);
        assert!(validation.openspec_path.is_none());
        assert!(!repo.join("openspec").exists());

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn execute_local_command_uses_selected_repo_and_captures_output() {
        let repo = temp_repo("command-cwd", true);
        let args = Vec::new();

        let result = execute_local_command(&repo, "pwd", &args).expect("pwd should run");

        assert!(result.success);
        assert_eq!(result.status_code, Some(0));
        assert_eq!(
            result.stdout.trim(),
            fs::canonicalize(&repo)
                .expect("repo should canonicalize")
                .to_string_lossy()
        );

        cleanup(repo);
    }

    #[test]
    fn execute_local_command_reports_missing_program() {
        let repo = temp_repo("missing-cli", true);
        let args = Vec::new();
        let program = "openspec-studio-definitely-missing-cli";

        let error =
            execute_local_command(&repo, program, &args).expect_err("program should be missing");

        assert!(matches!(
            error,
            BridgeError::CommandNotFound { program: missing } if missing == program
        ));

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn run_command_with_fallbacks_times_out_and_maps_error() {
        let repo = temp_repo("command-timeout", true);
        let script = repo.join("slow-command");
        write_executable(&script, "#!/bin/sh\nsleep 2\n");

        let error = run_command_with_fallbacks(
            &repo,
            &path_to_string(&script),
            &[],
            CommandExecutionOptions {
                timeout: Duration::from_millis(50),
                max_output_bytes: DEFAULT_MAX_COMMAND_OUTPUT_BYTES,
            },
        )
        .expect_err("slow command should time out");

        assert!(matches!(
            error,
            BridgeError::CommandTimedOut {
                program,
                timeout_ms: 50
            } if program == path_to_string(&script)
        ));

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn run_command_with_fallbacks_bounds_stdout() {
        let repo = temp_repo("command-output-limit", true);
        let script = repo.join("noisy-command");
        write_executable(&script, "#!/bin/sh\nprintf abcdefghijklmnop\n");

        let error = run_command_with_fallbacks(
            &repo,
            &path_to_string(&script),
            &[],
            CommandExecutionOptions {
                timeout: Duration::from_secs(1),
                max_output_bytes: 8,
            },
        )
        .expect_err("noisy command should exceed stdout bound");

        assert!(matches!(
            error,
            BridgeError::CommandOutputExceeded {
                program,
                stream,
                max_bytes: 8
            } if program == path_to_string(&script) && stream == "stdout"
        ));

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn run_command_with_fallbacks_times_out_descendant_stdio_without_hanging() {
        let repo = temp_repo("command-timeout-tree", true);
        let script = repo.join("slow-tree-command");
        write_executable(&script, "#!/bin/sh\n(sleep 5) &\nwait\n");
        let started = Instant::now();

        let error = run_command_with_fallbacks(
            &repo,
            &path_to_string(&script),
            &[],
            CommandExecutionOptions {
                timeout: Duration::from_millis(50),
                max_output_bytes: DEFAULT_MAX_COMMAND_OUTPUT_BYTES,
            },
        )
        .expect_err("command tree should time out");

        assert!(matches!(error, BridgeError::CommandTimedOut { .. }));
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "timeout path should not wait for descendant sleep"
        );

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn run_command_with_fallbacks_reaps_descendant_stdio_after_parent_exits() {
        let repo = temp_repo("command-orphan-stdio", true);
        let script = repo.join("orphan-stdio-command");
        write_executable(&script, "#!/bin/sh\n(sleep 5) &\nprintf done\n");
        let started = Instant::now();

        let result = run_command_with_fallbacks(
            &repo,
            &path_to_string(&script),
            &[],
            CommandExecutionOptions {
                timeout: Duration::from_secs(2),
                max_output_bytes: DEFAULT_MAX_COMMAND_OUTPUT_BYTES,
            },
        )
        .expect("command should return without waiting for descendant sleep");

        assert!(result.success);
        assert_eq!(String::from_utf8_lossy(&result.stdout), "done");
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "successful command should not hang on descendant stdio"
        );

        cleanup(repo);
    }

    #[test]
    fn command_candidates_include_standard_macos_install_paths() {
        let candidates = command_candidates("openspec");

        assert!(candidates.contains(&PathBuf::from("/opt/homebrew/bin/openspec")));
        assert!(candidates.contains(&PathBuf::from("/usr/local/bin/openspec")));
    }

    #[test]
    fn child_path_entries_include_candidate_dir_before_limited_desktop_path() {
        let entries = child_path_entries(
            Path::new("/opt/homebrew/bin/openspec"),
            Some(OsStr::new("/usr/bin:/bin")),
        );

        assert_eq!(entries.first(), Some(&PathBuf::from("/opt/homebrew/bin")));
        assert!(entries.contains(&PathBuf::from("/usr/local/bin")));
        assert!(entries.contains(&PathBuf::from("/usr/bin")));
        assert!(entries.contains(&PathBuf::from("/bin")));
    }

    #[test]
    fn command_candidates_preserve_explicit_program_paths() {
        let program = "/tmp/custom-openspec";

        assert_eq!(command_candidates(program), vec![PathBuf::from(program)]);
    }

    #[cfg(unix)]
    #[test]
    fn execute_local_command_adds_candidate_dir_for_launcher_dependencies() {
        let repo = temp_repo("launcher-path", true);
        let bin_dir = repo.join("bin");
        let openspec_path = bin_dir.join("openspec");
        let node_path = bin_dir.join("node");
        fs::create_dir_all(&bin_dir).expect("bin dir should be created");
        fs::write(
            &openspec_path,
            "#!/usr/bin/env node\nconsole.log('launcher dependency resolved')\n",
        )
        .expect("openspec launcher should be written");
        fs::write(&node_path, "#!/bin/sh\necho launcher dependency resolved\n")
            .expect("node shim should be written");
        fs::set_permissions(&openspec_path, fs::Permissions::from_mode(0o755))
            .expect("openspec launcher should be executable");
        fs::set_permissions(&node_path, fs::Permissions::from_mode(0o755))
            .expect("node shim should be executable");

        let result = execute_local_command(&repo, &path_to_string(&openspec_path), &[])
            .expect("launcher should resolve node from its own directory");

        assert!(result.success);
        assert_eq!(result.stdout.trim(), "launcher dependency resolved");

        cleanup(repo);
    }

    #[test]
    fn execute_local_command_rejects_repo_without_openspec() {
        let repo = temp_repo("invalid-command-repo", false);
        let args = Vec::new();

        let error =
            execute_local_command(&repo, "openspec", &args).expect_err("repo should be rejected");

        assert!(matches!(error, BridgeError::InvalidRepository { .. }));

        cleanup(repo);
    }

    #[test]
    fn archive_command_changed_files_rejects_zero_exit_no_file_archive() {
        assert!(!archive_command_changed_files(
            "change MODIFIED failed for header
Aborted. No files were changed.",
            ""
        ));
    }

    #[test]
    fn archive_command_changed_files_accepts_normal_archive_output() {
        assert!(archive_command_changed_files("Archived demo change", ""));
    }

    #[test]
    fn validate_archive_change_name_accepts_simple_change_names() {
        validate_archive_change_name("improve-desktop-ux-uat")
            .expect("simple change names should be valid");
        validate_archive_change_name("2026-04-27-demo_change")
            .expect("dated change names should be valid");
    }

    #[test]
    fn validate_archive_change_name_rejects_path_like_or_flag_values() {
        for change_name in [
            "",
            " ../demo",
            "../demo",
            "archive/demo",
            "--help",
            "demo/name",
        ] {
            assert!(
                matches!(
                    validate_archive_change_name(change_name),
                    Err(BridgeError::InvalidCommand { .. })
                ),
                "{change_name:?} should be rejected"
            );
        }
    }

    #[test]
    fn validate_openspec_args_accepts_product_command_shapes() {
        validate_openspec_args(&["validate".into(), "--all".into(), "--json".into()])
            .expect("validation command shape should be allowed");
        validate_openspec_args(&[
            "status".into(),
            "--change".into(),
            "improve-desktop-ux".into(),
            "--json".into(),
        ])
        .expect("status command shape should be allowed");
    }

    #[test]
    fn validate_openspec_args_rejects_extra_flags_and_unsafe_change_names() {
        for args in [
            vec!["validate".into(), "--all".into()],
            vec![
                "validate".into(),
                "--all".into(),
                "--json".into(),
                "--watch".into(),
            ],
            vec!["status".into(), "--json".into()],
            vec![
                "status".into(),
                "--change".into(),
                "../demo".into(),
                "--json".into(),
            ],
            vec!["list".into(), "--json".into()],
            vec!["show".into(), "demo".into(), "--json".into()],
        ] {
            assert!(
                matches!(
                    validate_openspec_args(&args),
                    Err(BridgeError::InvalidCommand { .. })
                ),
                "{args:?} should be rejected"
            );
        }
    }

    #[test]
    fn read_openspec_artifact_reads_existing_artifact_under_repo_openspec() {
        let repo = temp_repo("artifact-read", true);
        let artifact_path = repo.join("openspec/changes/demo/proposal.md");
        fs::create_dir_all(artifact_path.parent().expect("artifact should have parent"))
            .expect("artifact parent should be created");
        fs::write(&artifact_path, "# Demo\n").expect("artifact should be written");

        let artifact = read_openspec_artifact(&repo, "openspec/changes/demo/proposal.md")
            .expect("artifact should be readable");

        assert_eq!(artifact.contents, "# Demo\n");
        assert_eq!(artifact.relative_path, "openspec/changes/demo/proposal.md");
        assert_eq!(
            PathBuf::from(artifact.path),
            fs::canonicalize(&artifact_path).expect("artifact should canonicalize")
        );

        cleanup(repo);
    }

    #[test]
    fn read_openspec_artifact_rejects_files_outside_openspec() {
        let repo = temp_repo("artifact-outside", true);
        fs::write(repo.join("README.md"), "not an artifact")
            .expect("outside file should be written");

        let error = read_openspec_artifact(&repo, "README.md")
            .expect_err("outside file should be rejected");

        assert!(matches!(error, BridgeError::PathOutsideOpenSpec { .. }));

        cleanup(repo);
    }

    #[test]
    fn list_openspec_files_returns_relative_records_with_markdown_contents() {
        let repo = temp_repo("file-list", true);
        let proposal_path = repo.join("openspec/changes/demo/proposal.md");
        let data_path = repo.join("openspec/changes/demo/data.json");
        fs::create_dir_all(proposal_path.parent().expect("proposal should have parent"))
            .expect("proposal parent should be created");
        fs::write(&proposal_path, "# Demo\n").expect("proposal should be written");
        fs::write(&data_path, "{}").expect("data should be written");

        let records = list_openspec_files(&repo).expect("openspec files should be listed");

        assert!(records.iter().any(|record| {
            record.path == "openspec/changes/demo"
                && record.kind == "directory"
                && record.content.is_none()
        }));
        assert!(records.iter().any(|record| {
            record.path == "openspec/changes/demo/proposal.md"
                && record.kind == "file"
                && record.content.as_deref() == Some("# Demo\n")
                && record.modified_time_ms.is_some()
                && record.file_size == Some(7)
                && record.read_error.is_none()
        }));
        assert!(records.iter().any(|record| {
            record.path == "openspec/changes/demo/data.json"
                && record.kind == "file"
                && record.content.is_none()
                && record.file_size == Some(2)
        }));

        cleanup(repo);
    }

    #[test]
    fn list_openspec_file_metadata_skips_markdown_content() {
        let repo = temp_repo("file-metadata-list", true);
        let proposal_path = repo.join("openspec/changes/demo/proposal.md");
        fs::create_dir_all(proposal_path.parent().expect("proposal should have parent"))
            .expect("proposal parent should be created");
        fs::write(&proposal_path, "# Demo\n").expect("proposal should be written");

        let records =
            list_openspec_file_metadata(&repo).expect("openspec metadata should be listed");
        let proposal = records
            .iter()
            .find(|record| record.path == "openspec/changes/demo/proposal.md")
            .expect("proposal record should exist");

        assert_eq!(proposal.kind, "file");
        assert_eq!(proposal.file_size, Some(7));
        assert!(proposal.modified_time_ms.is_some());
        assert!(proposal.content.is_none());
        assert!(proposal.read_error.is_none());

        cleanup(repo);
    }

    #[test]
    fn list_openspec_files_reports_markdown_read_errors() {
        let repo = temp_repo("file-read-error", true);
        let proposal_path = repo.join("openspec/changes/demo/proposal.md");
        fs::create_dir_all(proposal_path.parent().expect("proposal should have parent"))
            .expect("proposal parent should be created");
        fs::write(&proposal_path, [0xff, 0xfe, 0xfd]).expect("invalid utf8 should be written");

        let records = list_openspec_files(&repo).expect("openspec files should be listed");
        let proposal = records
            .iter()
            .find(|record| record.path == "openspec/changes/demo/proposal.md")
            .expect("proposal record should exist");

        assert_eq!(proposal.kind, "file");
        assert!(proposal.content.is_none());
        assert!(
            proposal
                .read_error
                .as_deref()
                .is_some_and(|message| message.contains("UTF-8") || message.contains("utf-8")),
            "read error should explain invalid UTF-8: {:?}",
            proposal.read_error
        );

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn list_openspec_files_does_not_recurse_into_symlinked_directories() {
        let repo = temp_repo("file-symlink-loop", true);
        let proposal_path = repo.join("openspec/proposal.md");
        fs::write(&proposal_path, "# Root\n").expect("proposal should be written");
        std::os::unix::fs::symlink(repo.join("openspec"), repo.join("openspec/self"))
            .expect("symlink should be created");

        let records = list_openspec_files(&repo).expect("openspec files should be listed");

        assert!(records.iter().any(|record| {
            record.path == "openspec/self"
                && record.kind == "symlink"
                && record.content.is_none()
                && record.read_error.is_none()
        }));
        assert!(!records
            .iter()
            .any(|record| record.path.starts_with("openspec/self/")));

        cleanup(repo);
    }

    #[cfg(unix)]
    #[test]
    fn list_openspec_files_records_broken_and_external_symlinks() {
        let repo = temp_repo("file-symlink-broken-external", true);
        fs::write(repo.join("README.md"), "outside").expect("external target should be written");
        std::os::unix::fs::symlink(
            repo.join("openspec/missing.md"),
            repo.join("openspec/broken-link"),
        )
        .expect("broken symlink should be created");
        std::os::unix::fs::symlink(repo.join("README.md"), repo.join("openspec/external-link"))
            .expect("external symlink should be created");

        let records = list_openspec_files(&repo).expect("openspec files should be listed");
        let broken = records
            .iter()
            .find(|record| record.path == "openspec/broken-link")
            .expect("broken symlink should be recorded");
        let external = records
            .iter()
            .find(|record| record.path == "openspec/external-link")
            .expect("external symlink should be recorded");

        assert_eq!(broken.kind, "symlink");
        assert!(broken.read_error.is_some());
        assert_eq!(external.kind, "symlink");
        assert!(external.read_error.is_none());
        assert!(!records
            .iter()
            .any(|record| record.path.starts_with("openspec/external-link/")));

        cleanup(repo);
    }

    #[test]
    fn parse_git_status_entries_preserves_porcelain_columns_and_ignores_blank_lines() {
        assert_eq!(
            parse_git_status_entries(
                " M openspec/changes/demo/tasks.md\n\n?? openspec/specs/demo/spec.md\n"
            ),
            vec![
                " M openspec/changes/demo/tasks.md".to_string(),
                "?? openspec/specs/demo/spec.md".to_string(),
            ]
        );
    }
}
