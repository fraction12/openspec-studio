use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::{
    cmp, env,
    ffi::{OsStr, OsString},
    fs,
    io::{self, Read},
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

fn studio_runner_session_secret() -> &'static Mutex<Option<String>> {
    STUDIO_RUNNER_SESSION_SECRET.get_or_init(|| Mutex::new(None))
}

fn studio_runner_process() -> &'static Mutex<Option<StudioRunnerProcess>> {
    STUDIO_RUNNER_PROCESS.get_or_init(|| Mutex::new(None))
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
pub struct BridgeErrorDto {
    pub code: String,
    pub message: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerLifecycleRequest {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "endpoint", default)]
    pub endpoint: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StudioRunnerDispatchValidation {
    pub state: String,
    #[serde(rename = "checkedAt")]
    pub checked_at: Option<String>,
    #[serde(rename = "issueCount")]
    pub issue_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BridgeError {
    InvalidRepository {
        path: String,
        reason: String,
    },
    InvalidCommand {
        reason: String,
    },
    CommandNotFound {
        program: String,
    },
    CommandStartFailed {
        program: String,
        message: String,
    },
    CommandTimedOut {
        program: String,
        timeout_ms: u128,
    },
    CommandOutputExceeded {
        program: String,
        stream: String,
        max_bytes: usize,
    },
    CommandOutputReadTimedOut {
        program: String,
    },
    PathOutsideOpenSpec {
        path: String,
    },
    Io {
        path: String,
        message: String,
    },
    RunnerRequest {
        message: String,
    },
}

impl BridgeError {
    fn code(&self) -> &'static str {
        match self {
            Self::InvalidRepository { .. } => "invalid_repository",
            Self::InvalidCommand { .. } => "invalid_command",
            Self::CommandNotFound { .. } => "command_not_found",
            Self::CommandStartFailed { .. } => "command_start_failed",
            Self::CommandTimedOut { .. } => "command_timeout",
            Self::CommandOutputExceeded { .. } => "command_output_too_large",
            Self::CommandOutputReadTimedOut { .. } => "command_output_read_timeout",
            Self::PathOutsideOpenSpec { .. } => "path_outside_openspec",
            Self::Io { .. } => "io_error",
            Self::RunnerRequest { .. } => "runner_request_failed",
        }
    }

    fn message(&self) -> String {
        match self {
            Self::InvalidRepository { path, reason } => {
                format!("Invalid OpenSpec repository '{}': {}", path, reason)
            }
            Self::InvalidCommand { reason } => format!("Invalid OpenSpec command: {}", reason),
            Self::CommandNotFound { program } => {
                format!("Command '{}' was not found on PATH", program)
            }
            Self::CommandStartFailed { program, message } => {
                format!("Command '{}' could not be started: {}", program, message)
            }
            Self::CommandTimedOut {
                program,
                timeout_ms,
            } => format!("Command '{}' timed out after {}ms", program, timeout_ms),
            Self::CommandOutputExceeded {
                program,
                stream,
                max_bytes,
            } => format!(
                "Command '{}' exceeded the {} output limit of {} bytes",
                program, stream, max_bytes
            ),
            Self::CommandOutputReadTimedOut { program } => format!(
                "Command '{}' exited but output readers did not finish",
                program
            ),
            Self::PathOutsideOpenSpec { path } => {
                format!(
                    "Path '{}' is outside the selected repo's openspec/ directory",
                    path
                )
            }
            Self::Io { path, message } => format!("I/O error for '{}': {}", path, message),
            Self::RunnerRequest { message } => message.clone(),
        }
    }
}

impl From<BridgeError> for BridgeErrorDto {
    fn from(error: BridgeError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.message(),
        }
    }
}

pub fn validate_repository(
    repo_path: impl AsRef<Path>,
) -> Result<RepositoryValidation, BridgeError> {
    let canonical_repo = canonicalize_existing_dir(repo_path.as_ref())?;
    let openspec_candidate = canonical_repo.join("openspec");
    let openspec_path = if openspec_candidate.is_dir() {
        Some(canonicalize_path(&openspec_candidate)?)
    } else {
        None
    };

    Ok(RepositoryValidation {
        name: canonical_repo
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| canonical_repo.to_string_lossy().into_owned()),
        path: path_to_string(&canonical_repo),
        has_openspec: openspec_path.is_some(),
        openspec_path: openspec_path.as_ref().map(|path| path_to_string(path)),
    })
}

pub fn execute_local_command(
    repo_path: impl AsRef<Path>,
    program: &str,
    args: &[String],
) -> Result<CommandResult, BridgeError> {
    let (canonical_repo, _) = require_openspec_repo(repo_path.as_ref())?;
    let output = run_command_with_fallbacks(
        &canonical_repo,
        program,
        args,
        CommandExecutionOptions::default(),
    )?;

    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        status_code: output.status_code,
        success: output.success,
    })
}

pub fn read_openspec_artifact(
    repo_path: impl AsRef<Path>,
    artifact_path: impl AsRef<Path>,
) -> Result<ArtifactFile, BridgeError> {
    let (canonical_repo, openspec_root) = require_openspec_repo(repo_path.as_ref())?;
    let requested_path = if artifact_path.as_ref().is_absolute() {
        artifact_path.as_ref().to_path_buf()
    } else {
        canonical_repo.join(artifact_path.as_ref())
    };
    let canonical_artifact = canonicalize_path(&requested_path)?;

    if !canonical_artifact.starts_with(&openspec_root) {
        return Err(BridgeError::PathOutsideOpenSpec {
            path: path_to_string(&canonical_artifact),
        });
    }

    let contents = fs::read_to_string(&canonical_artifact).map_err(|error| BridgeError::Io {
        path: path_to_string(&canonical_artifact),
        message: error.to_string(),
    })?;
    let relative_path = canonical_artifact
        .strip_prefix(&canonical_repo)
        .map(normalize_relative_path)
        .unwrap_or_else(|_| path_to_string(&canonical_artifact));

    Ok(ArtifactFile {
        path: path_to_string(&canonical_artifact),
        relative_path,
        contents,
    })
}

pub fn list_openspec_files(
    repo_path: impl AsRef<Path>,
) -> Result<Vec<OpenSpecFileRecord>, BridgeError> {
    list_openspec_files_with_options(
        repo_path,
        OpenSpecFileListOptions {
            include_content: Some(true),
        },
    )
}

pub fn list_openspec_file_metadata(
    repo_path: impl AsRef<Path>,
) -> Result<Vec<OpenSpecFileRecord>, BridgeError> {
    list_openspec_files_with_options(
        repo_path,
        OpenSpecFileListOptions {
            include_content: Some(false),
        },
    )
}

pub fn list_openspec_files_with_options(
    repo_path: impl AsRef<Path>,
    options: OpenSpecFileListOptions,
) -> Result<Vec<OpenSpecFileRecord>, BridgeError> {
    let (canonical_repo, openspec_root) = require_openspec_repo(repo_path.as_ref())?;
    let mut records = Vec::new();
    let include_content = options.include_content.unwrap_or(false);

    collect_openspec_files(
        &canonical_repo,
        &openspec_root,
        &openspec_root,
        include_content,
        &mut records,
    )?;
    records.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(records)
}

pub fn inspect_openspec_git_status(
    repo_path: impl AsRef<Path>,
) -> Result<OpenSpecGitStatus, BridgeError> {
    let (canonical_repo, _) = require_openspec_repo(repo_path.as_ref())?;
    let args = vec![
        "status".to_string(),
        "--porcelain".to_string(),
        "--".to_string(),
        "openspec".to_string(),
    ];

    match run_command_with_fallbacks(
        &canonical_repo,
        "git",
        &args,
        CommandExecutionOptions::default(),
    ) {
        Ok(output) if output.success => {
            let entries = parse_git_status_entries(&String::from_utf8_lossy(&output.stdout));

            Ok(OpenSpecGitStatus {
                available: true,
                dirty_count: entries.len(),
                entries,
                message: None,
            })
        }
        Ok(output) => Ok(OpenSpecGitStatus {
            available: false,
            dirty_count: 0,
            entries: Vec::new(),
            message: Some(first_non_empty_output(&output.stderr, &output.stdout)),
        }),
        Err(BridgeError::CommandNotFound { .. }) => Ok(OpenSpecGitStatus {
            available: false,
            dirty_count: 0,
            entries: Vec::new(),
            message: Some("Git was not found on PATH".to_string()),
        }),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn validate_repo(repo_path: String) -> Result<RepositoryValidation, BridgeErrorDto> {
    run_bridge_task(move || validate_repository(repo_path)).await
}

#[tauri::command]
pub async fn pick_repository_folder(
    app: tauri::AppHandle,
) -> Result<Option<String>, BridgeErrorDto> {
    run_bridge_task(move || {
        app.dialog()
            .file()
            .blocking_pick_folder()
            .map(|folder| {
                folder
                    .into_path()
                    .map(|path| path_to_string(&path))
                    .map_err(|error| BridgeError::Io {
                        path: "selected folder".to_string(),
                        message: error.to_string(),
                    })
            })
            .transpose()
    })
    .await
}

#[tauri::command]
pub async fn run_openspec_command(
    repo_path: String,
    args: Vec<String>,
) -> Result<CommandResult, BridgeErrorDto> {
    validate_openspec_args(&args).map_err(BridgeErrorDto::from)?;
    run_bridge_task(move || execute_local_command(repo_path, "openspec", &args)).await
}

#[tauri::command]
pub async fn archive_change(
    repo_path: String,
    change_name: String,
) -> Result<CommandResult, BridgeErrorDto> {
    validate_archive_change_name(&change_name).map_err(BridgeErrorDto::from)?;
    run_bridge_task(move || {
        execute_local_command(
            repo_path,
            "openspec",
            &["archive".to_string(), change_name, "--yes".to_string()],
        )
    })
    .await
}

#[tauri::command]
pub async fn read_openspec_artifact_file(
    repo_path: String,
    artifact_path: String,
) -> Result<ArtifactFile, BridgeErrorDto> {
    run_bridge_task(move || read_openspec_artifact(repo_path, artifact_path)).await
}

#[tauri::command]
pub async fn list_openspec_file_records(
    repo_path: String,
) -> Result<Vec<OpenSpecFileRecord>, BridgeErrorDto> {
    run_bridge_task(move || list_openspec_files(repo_path)).await
}

#[tauri::command]
pub async fn list_openspec_file_metadata_records(
    repo_path: String,
) -> Result<Vec<OpenSpecFileRecord>, BridgeErrorDto> {
    run_bridge_task(move || list_openspec_file_metadata(repo_path)).await
}

#[tauri::command]
pub async fn list_openspec_file_records_with_options(
    repo_path: String,
    options: OpenSpecFileListOptions,
) -> Result<Vec<OpenSpecFileRecord>, BridgeErrorDto> {
    run_bridge_task(move || list_openspec_files_with_options(repo_path, options)).await
}

#[tauri::command]
pub async fn get_openspec_git_status(
    repo_path: String,
) -> Result<OpenSpecGitStatus, BridgeErrorDto> {
    run_bridge_task(move || inspect_openspec_git_status(repo_path)).await
}

#[tauri::command]
pub async fn configure_studio_runner_session_secret(
    secret: String,
) -> Result<StudioRunnerSessionSecretResponse, BridgeErrorDto> {
    run_bridge_task(move || configure_runner_session_secret(secret)).await
}

#[tauri::command]
pub async fn clear_studio_runner_session_secret(
) -> Result<StudioRunnerSessionSecretResponse, BridgeErrorDto> {
    run_bridge_task(clear_runner_session_secret).await
}

#[tauri::command]
pub async fn start_studio_runner(
    request: StudioRunnerLifecycleRequest,
) -> Result<StudioRunnerLifecycleResponse, BridgeErrorDto> {
    run_bridge_task(move || start_runner_process(request)).await
}

#[tauri::command]
pub async fn stop_studio_runner() -> Result<StudioRunnerLifecycleResponse, BridgeErrorDto> {
    run_bridge_task(stop_runner_process).await
}

#[tauri::command]
pub async fn check_studio_runner_status(
    settings: StudioRunnerSettings,
) -> Result<StudioRunnerStatus, BridgeErrorDto> {
    run_bridge_task(move || check_runner_status(settings)).await
}

#[tauri::command]
pub async fn dispatch_studio_runner_event(
    settings: StudioRunnerSettings,
    request: StudioRunnerDispatchRequest,
) -> Result<StudioRunnerDispatchResponse, BridgeErrorDto> {
    run_bridge_task(move || dispatch_runner_event(settings, request)).await
}

fn configure_runner_session_secret(
    secret: String,
) -> Result<StudioRunnerSessionSecretResponse, BridgeError> {
    let trimmed = secret.trim().to_string();
    if trimmed.is_empty() {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner session secret cannot be empty.".to_string(),
        });
    }

    let mut current =
        studio_runner_session_secret()
            .lock()
            .map_err(|_| BridgeError::RunnerRequest {
                message: "Studio Runner session secret store is unavailable.".to_string(),
            })?;
    *current = Some(trimmed);

    Ok(StudioRunnerSessionSecretResponse { configured: true })
}

fn clear_runner_session_secret() -> Result<StudioRunnerSessionSecretResponse, BridgeError> {
    let mut current =
        studio_runner_session_secret()
            .lock()
            .map_err(|_| BridgeError::RunnerRequest {
                message: "Studio Runner session secret store is unavailable.".to_string(),
            })?;
    *current = None;

    Ok(StudioRunnerSessionSecretResponse { configured: false })
}

fn has_runner_session_secret() -> Result<bool, BridgeError> {
    Ok(studio_runner_session_secret()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner session secret store is unavailable.".to_string(),
        })?
        .as_deref()
        .is_some_and(|secret| !secret.trim().is_empty()))
}

fn get_runner_session_secret() -> Result<String, BridgeError> {
    studio_runner_session_secret()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner session secret store is unavailable.".to_string(),
        })?
        .clone()
        .filter(|secret| !secret.trim().is_empty())
        .ok_or_else(|| BridgeError::RunnerRequest {
            message: "Studio Runner session secret is not configured for this app session."
                .to_string(),
        })
}

fn check_runner_status(settings: StudioRunnerSettings) -> Result<StudioRunnerStatus, BridgeError> {
    reap_finished_runner_process()?;
    let endpoint = normalize_runner_endpoint(&settings.endpoint)?;
    let mut managed = managed_runner_snapshot()?;

    if endpoint.is_empty() || !has_runner_session_secret()? {
        return Ok(StudioRunnerStatus {
            configured: false,
            reachable: false,
            status: "not-configured".to_string(),
            endpoint: if endpoint.is_empty() {
                runner_snapshot_endpoint(managed.as_ref())
            } else {
                Some(endpoint.clone())
            },
            runner_endpoint: runner_snapshot_endpoint(managed.as_ref()),
            runner_repo_path: runner_snapshot_repo_path(managed.as_ref()),
            status_code: None,
            message: "Studio Runner endpoint and session secret are required.".to_string(),
            response_body: None,
            managed: if endpoint.is_empty() {
                managed.is_some()
            } else {
                runner_managed_for_endpoint(managed.as_ref(), &endpoint)
            },
            pid: if endpoint.is_empty() {
                managed.as_ref().map(|process| process.pid)
            } else {
                runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint)
            },
        });
    }

    let health_endpoint = runner_health_endpoint(&endpoint);
    let client = reqwest::blocking::Client::builder()
        .timeout(DEFAULT_RUNNER_HTTP_TIMEOUT)
        .build()
        .map_err(|error| BridgeError::RunnerRequest {
            message: error.to_string(),
        })?;

    match client.get(&health_endpoint).send() {
        Ok(response) => {
            let status_code = response.status().as_u16();
            let success = response.status().is_success();
            let body = read_bounded_runner_response(response)?;
            if success && !runner_managed_for_endpoint(managed.as_ref(), &endpoint) {
                managed =
                    recover_managed_runner_from_endpoint(&endpoint, settings.repo_path.as_deref())?;
            }
            Ok(StudioRunnerStatus {
                configured: true,
                reachable: success,
                status: if success { "reachable" } else { "unavailable" }.to_string(),
                endpoint: Some(endpoint.clone()),
                runner_endpoint: runner_snapshot_endpoint(managed.as_ref()),
                runner_repo_path: runner_snapshot_repo_path(managed.as_ref()),
                status_code: Some(status_code),
                message: if success {
                    "Studio Runner health endpoint responded.".to_string()
                } else {
                    format!("Studio Runner health check returned HTTP {}", status_code)
                },
                response_body: body,
                managed: runner_managed_for_endpoint(managed.as_ref(), &endpoint),
                pid: runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint),
            })
        }
        Err(error) => Ok(StudioRunnerStatus {
            configured: true,
            reachable: false,
            status: "unavailable".to_string(),
            endpoint: Some(endpoint.clone()),
            runner_endpoint: runner_snapshot_endpoint(managed.as_ref()),
            runner_repo_path: runner_snapshot_repo_path(managed.as_ref()),
            status_code: None,
            message: error.to_string(),
            response_body: None,
            managed: runner_managed_for_endpoint(managed.as_ref(), &endpoint),
            pid: runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint),
        }),
    }
}

fn runner_process_path() -> OsString {
    let mut entries: Vec<PathBuf> = STANDARD_COMMAND_DIRS.iter().map(PathBuf::from).collect();

    if let Some(existing_path) = env::var_os("PATH") {
        entries.extend(env::split_paths(&existing_path));
    }

    env::join_paths(entries).unwrap_or_else(|_| {
        env::var_os("PATH").unwrap_or_else(|| OsString::from(STANDARD_COMMAND_DIRS.join(":")))
    })
}

fn studio_runner_program(repo_path: &Path) -> PathBuf {
    std::env::var_os("OPENSPEC_STUDIO_RUNNER_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| repo_path.join("bin/symphony"))
}

fn runner_process_is_active(process: &mut StudioRunnerProcess) -> Result<bool, BridgeError> {
    if let Some(child) = process.child.as_mut() {
        if child
            .try_wait()
            .map_err(|error| BridgeError::RunnerRequest {
                message: error.to_string(),
            })?
            .is_none()
        {
            return Ok(true);
        }
        process.child = None;
    }

    Ok(runner_process_command(process.pid).is_some())
}

fn start_runner_process(
    request: StudioRunnerLifecycleRequest,
) -> Result<StudioRunnerLifecycleResponse, BridgeError> {
    reap_finished_runner_process()?;
    let secret = get_runner_session_secret()?;
    let repo_path = canonicalize_runner_dir(&request.repo_path, "Studio Runner repository")?;
    let workflow_path = repo_path.join("WORKFLOW.md");
    if !workflow_path.is_file() {
        return Err(BridgeError::RunnerRequest {
            message: format!(
                "Studio Runner workflow file was not found at {}.",
                workflow_path.display()
            ),
        });
    }

    let endpoint = normalize_runner_endpoint(
        request
            .endpoint
            .as_deref()
            .unwrap_or("http://127.0.0.1:4000/api/v1/studio-runner/events"),
    )?;
    if endpoint.is_empty() {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner endpoint is required.".to_string(),
        });
    }
    let port = runner_endpoint_port(&endpoint)?;

    let mut store = studio_runner_process()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner process store is unavailable.".to_string(),
        })?;

    if let Some(existing) = store.as_mut() {
        if runner_process_is_active(existing)? {
            if existing.endpoint == endpoint
                && (existing.repo_path == repo_path || existing.child.is_none())
            {
                return Ok(StudioRunnerLifecycleResponse {
                    started: false,
                    endpoint: existing.endpoint.clone(),
                    port: existing.port,
                    pid: Some(existing.pid),
                    message: "Studio Runner is already managed by Studio.".to_string(),
                });
            }
            return Err(BridgeError::RunnerRequest {
                message: "A managed Studio Runner is already running for a different repository or endpoint. Stop it before starting another.".to_string(),
            });
        }
        *store = None;
    }

    let mut command = Command::new(studio_runner_program(&repo_path));
    command
        .arg("--i-understand-that-this-will-be-running-without-the-usual-guardrails")
        .arg("--port")
        .arg(port.to_string())
        .arg(&workflow_path)
        .current_dir(&repo_path)
        .env("STUDIO_RUNNER_SIGNING_SECRET", secret)
        .env("PATH", runner_process_path())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let child = command
        .spawn()
        .map_err(|error| BridgeError::RunnerRequest {
            message: format!("Studio Runner could not be started: {}", error),
        })?;
    let pid = child.id();
    let mut process = StudioRunnerProcess {
        child: Some(child),
        pid,
        endpoint: endpoint.clone(),
        port,
        repo_path: repo_path.clone(),
    };

    match wait_for_runner_health(&endpoint, DEFAULT_RUNNER_STARTUP_TIMEOUT) {
        Ok(()) => {
            *store = Some(process);
            Ok(StudioRunnerLifecycleResponse {
                started: true,
                endpoint,
                port,
                pid: Some(pid),
                message: "Studio Runner started and passed health check.".to_string(),
            })
        }
        Err(error) => {
            terminate_runner_process(pid, process.child.as_mut());
            Err(error)
        }
    }
}

fn stop_runner_process() -> Result<StudioRunnerLifecycleResponse, BridgeError> {
    let mut store = studio_runner_process()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner process store is unavailable.".to_string(),
        })?;
    let Some(mut process) = store.take() else {
        return Ok(StudioRunnerLifecycleResponse {
            started: false,
            endpoint: String::new(),
            port: 0,
            pid: None,
            message: "No Studio-managed runner is running.".to_string(),
        });
    };
    let endpoint = process.endpoint.clone();
    let port = process.port;
    let pid = process.pid;
    terminate_runner_process(pid, process.child.as_mut());
    Ok(StudioRunnerLifecycleResponse {
        started: false,
        endpoint,
        port,
        pid: Some(pid),
        message: "Studio Runner stopped.".to_string(),
    })
}

fn dispatch_runner_event(
    settings: StudioRunnerSettings,
    request: StudioRunnerDispatchRequest,
) -> Result<StudioRunnerDispatchResponse, BridgeError> {
    let endpoint = normalize_runner_endpoint(&settings.endpoint)?;
    let signing_secret = get_runner_session_secret()?;
    if endpoint.is_empty() {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner endpoint is required.".to_string(),
        });
    }
    validate_runner_dispatch_request(&request)?;
    let event_id = request.event_id.clone();
    let payload = build_runner_dispatch_payload(&request)?;
    let body = serde_json::to_vec(&payload).map_err(|error| BridgeError::RunnerRequest {
        message: error.to_string(),
    })?;
    let timestamp = unix_timestamp_seconds()?;
    let signature = sign_runner_body(&signing_secret, &event_id, timestamp, &body)?;
    let client = reqwest::blocking::Client::builder()
        .timeout(DEFAULT_RUNNER_HTTP_TIMEOUT)
        .build()
        .map_err(|error| BridgeError::RunnerRequest {
            message: error.to_string(),
        })?;
    let response = client
        .post(&endpoint)
        .header("content-type", "application/json")
        .header("webhook-id", &event_id)
        .header("webhook-timestamp", timestamp.to_string())
        .header("webhook-signature", signature)
        .body(body)
        .send()
        .map_err(|error| BridgeError::RunnerRequest {
            message: error.to_string(),
        })?;
    let status_code = response.status().as_u16();
    let body = read_bounded_runner_response(response)?;
    let run_id = body.as_deref().and_then(extract_run_id);
    let accepted = status_code == 202;

    Ok(StudioRunnerDispatchResponse {
        event_id,
        status_code,
        accepted,
        message: if accepted {
            "Studio Runner accepted the build request.".to_string()
        } else {
            format!("Studio Runner returned HTTP {}", status_code)
        },
        response_body: body,
        run_id,
    })
}

fn validate_runner_dispatch_request(
    request: &StudioRunnerDispatchRequest,
) -> Result<(), BridgeError> {
    validate_runner_event_id(&request.event_id)?;
    if request.repo_path.trim().is_empty() || request.repo_name.trim().is_empty() {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner dispatch requires repository identity.".to_string(),
        });
    }
    validate_change_name(&request.change_name).map_err(|_| BridgeError::RunnerRequest {
        message: "Studio Runner dispatch requires a valid change name.".to_string(),
    })?;
    if !matches!(request.validation.state.as_str(), "pass" | "fail" | "stale") {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner dispatch validation state is invalid.".to_string(),
        });
    }
    if request.artifact_paths.iter().any(|path| {
        path.trim().is_empty()
            || path.contains('\0')
            || path.contains("..")
            || !path.starts_with("openspec/changes/")
    }) {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner dispatch artifact paths must stay under openspec/changes/."
                .to_string(),
        });
    }

    Ok(())
}

fn build_runner_dispatch_payload(
    request: &StudioRunnerDispatchRequest,
) -> Result<serde_json::Value, BridgeError> {
    Ok(serde_json::json!({
        "id": request.event_id,
        "type": "build.requested",
        "source": "openspec-studio",
        "time": unix_timestamp_seconds()?.to_string(),
        "data": {
            "runner": "studio-runner",
            "repoPath": request.repo_path,
            "repoName": request.repo_name,
            "gitRef": request.git_ref,
            "change": request.change_name,
            "artifactPaths": request.artifact_paths,
            "validation": {
                "state": request.validation.state,
                "checkedAt": request.validation.checked_at,
                "issueCount": request.validation.issue_count,
            },
            "requestedBy": request.requested_by,
        }
    }))
}

fn normalize_runner_endpoint(endpoint: &str) -> Result<String, BridgeError> {
    let endpoint = endpoint.trim().trim_end_matches('/');
    if endpoint.is_empty() {
        return Ok(String::new());
    }

    let parsed = url::Url::parse(endpoint).map_err(|error| BridgeError::RunnerRequest {
        message: format!("Invalid Studio Runner endpoint: {}", error),
    })?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner endpoint must use http or https.".to_string(),
        });
    }
    if !matches!(parsed.host_str(), Some("localhost") | Some("127.0.0.1"))
        || parsed.port().is_none()
    {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner endpoint must be local localhost/127.0.0.1 with an explicit port for this alpha.".to_string(),
        });
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err(BridgeError::RunnerRequest {
            message: "Studio Runner endpoint must not include userinfo.".to_string(),
        });
    }

    Ok(parsed.to_string().trim_end_matches('/').to_string())
}

fn runner_endpoint_port(endpoint: &str) -> Result<u16, BridgeError> {
    url::Url::parse(endpoint)
        .ok()
        .and_then(|url| url.port())
        .ok_or_else(|| BridgeError::RunnerRequest {
            message: "Studio Runner endpoint must include an explicit port.".to_string(),
        })
}

fn runner_health_endpoint(event_endpoint: &str) -> String {
    event_endpoint
        .strip_suffix("/events")
        .map(|base| format!("{}/health", base))
        .unwrap_or_else(|| format!("{}/health", event_endpoint.trim_end_matches('/')))
}

fn sign_runner_body(
    secret: &str,
    event_id: &str,
    timestamp: u64,
    body: &[u8],
) -> Result<String, BridgeError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|error| {
        BridgeError::RunnerRequest {
            message: error.to_string(),
        }
    })?;
    mac.update(event_id.as_bytes());
    mac.update(b".");
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);
    let digest = mac.finalize().into_bytes();
    Ok(format!("v1,{}", general_purpose::STANDARD.encode(digest)))
}

fn unix_timestamp_seconds() -> Result<u64, BridgeError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| BridgeError::RunnerRequest {
            message: error.to_string(),
        })
}

fn validate_runner_event_id(event_id: &str) -> Result<(), BridgeError> {
    if event_id.starts_with("evt_")
        && event_id.len() <= 96
        && event_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        Ok(())
    } else {
        Err(BridgeError::RunnerRequest {
            message: "Invalid Studio Runner event id.".to_string(),
        })
    }
}

fn wait_for_runner_health(endpoint: &str, timeout: Duration) -> Result<(), BridgeError> {
    let deadline = Instant::now() + timeout;
    let health_endpoint = runner_health_endpoint(endpoint);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(600))
        .build()
        .map_err(|error| BridgeError::RunnerRequest {
            message: error.to_string(),
        })?;

    let mut last_error = String::new();
    while Instant::now() < deadline {
        match client.get(&health_endpoint).send() {
            Ok(response) if response.status().is_success() => return Ok(()),
            Ok(response) => last_error = format!("HTTP {}", response.status().as_u16()),
            Err(error) => last_error = error.to_string(),
        }
        thread::sleep(Duration::from_millis(150));
    }

    Err(BridgeError::RunnerRequest {
        message: format!("Studio Runner did not become reachable: {}", last_error),
    })
}

fn reap_finished_runner_process() -> Result<(), BridgeError> {
    let mut store = studio_runner_process()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner process store is unavailable.".to_string(),
        })?;
    if let Some(process) = store.as_mut() {
        if let Some(child) = process.child.as_mut() {
            if child
                .try_wait()
                .map_err(|error| BridgeError::RunnerRequest {
                    message: error.to_string(),
                })?
                .is_some()
            {
                process.child = None;
            }
        }
    }
    Ok(())
}

fn managed_runner_snapshot() -> Result<Option<StudioRunnerProcessSnapshot>, BridgeError> {
    let store = studio_runner_process()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner process store is unavailable.".to_string(),
        })?;
    Ok(store.as_ref().map(|process| StudioRunnerProcessSnapshot {
        pid: process.pid,
        endpoint: process.endpoint.clone(),
        repo_path: process.repo_path.clone(),
    }))
}

#[derive(Debug, Clone)]
struct StudioRunnerProcessSnapshot {
    pid: u32,
    endpoint: String,
    repo_path: PathBuf,
}

fn runner_managed_for_endpoint(
    snapshot: Option<&StudioRunnerProcessSnapshot>,
    endpoint: &str,
) -> bool {
    snapshot
        .map(|process| process.endpoint == endpoint)
        .unwrap_or(false)
}

fn runner_managed_pid_for_endpoint(
    snapshot: Option<&StudioRunnerProcessSnapshot>,
    endpoint: &str,
) -> Option<u32> {
    snapshot
        .filter(|process| process.endpoint == endpoint)
        .map(|process| process.pid)
}

fn runner_snapshot_endpoint(snapshot: Option<&StudioRunnerProcessSnapshot>) -> Option<String> {
    snapshot.map(|process| process.endpoint.clone())
}

fn runner_snapshot_repo_path(snapshot: Option<&StudioRunnerProcessSnapshot>) -> Option<String> {
    snapshot.map(|process| path_to_string(&process.repo_path))
}

fn recover_managed_runner_from_endpoint(
    endpoint: &str,
    expected_repo_path: Option<&str>,
) -> Result<Option<StudioRunnerProcessSnapshot>, BridgeError> {
    let port = runner_endpoint_port(endpoint)?;
    let Some(pid) = runner_listener_pid(port) else {
        return managed_runner_snapshot();
    };
    let recovered_repo_path = recovered_runner_repo_path(pid, expected_repo_path)?;
    if recovered_repo_path.is_none() {
        return managed_runner_snapshot();
    }
    let recovered_repo_path = recovered_repo_path.expect("checked above");

    let mut store = studio_runner_process()
        .lock()
        .map_err(|_| BridgeError::RunnerRequest {
            message: "Studio Runner process store is unavailable.".to_string(),
        })?;

    if let Some(existing) = store.as_ref() {
        if existing.endpoint != endpoint {
            return Ok(Some(StudioRunnerProcessSnapshot {
                pid: existing.pid,
                endpoint: existing.endpoint.clone(),
                repo_path: existing.repo_path.clone(),
            }));
        }
    }

    *store = Some(StudioRunnerProcess {
        child: None,
        pid,
        endpoint: endpoint.to_string(),
        port,
        repo_path: recovered_repo_path.clone(),
    });

    Ok(Some(StudioRunnerProcessSnapshot {
        pid,
        endpoint: endpoint.to_string(),
        repo_path: recovered_repo_path,
    }))
}

fn runner_listener_pid(port: u16) -> Option<u32> {
    #[cfg(unix)]
    {
        let output = Command::new("/usr/sbin/lsof")
            .args(["-nP", &format!("-iTCP:{port}"), "-sTCP:LISTEN", "-t"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .find_map(|line| line.trim().parse::<u32>().ok())
    }
    #[cfg(not(unix))]
    {
        let _ = port;
        None
    }
}

fn recovered_runner_repo_path(
    pid: u32,
    expected_repo_path: Option<&str>,
) -> Result<Option<PathBuf>, BridgeError> {
    let Some(command) = runner_process_command(pid) else {
        return Ok(None);
    };
    if !(command.contains("bin/symphony") || command.contains("/symphony ")) {
        return Ok(None);
    }

    if let Some(expected_repo_path) = expected_repo_path {
        let expected = canonicalize_runner_dir(expected_repo_path, "Studio Runner repository")?;
        if command.contains(&path_to_string(&expected)) {
            return Ok(Some(expected));
        }
        return Ok(None);
    }

    Ok(command
        .split_whitespace()
        .find(|part| part.ends_with("/WORKFLOW.md"))
        .and_then(|workflow_path| Path::new(workflow_path).parent())
        .map(Path::to_path_buf))
}

fn runner_process_command(pid: u32) -> Option<String> {
    #[cfg(unix)]
    {
        let output = Command::new("/bin/ps")
            .args(["-p", &pid.to_string(), "-o", "command="])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        Some(String::from_utf8_lossy(&output.stdout).into_owned())
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        None
    }
}

fn canonicalize_runner_dir(path: &str, label: &str) -> Result<PathBuf, BridgeError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(BridgeError::RunnerRequest {
            message: format!("{} path is required.", label),
        });
    }
    let canonical = fs::canonicalize(trimmed).map_err(|error| BridgeError::RunnerRequest {
        message: format!("{} path is invalid: {}", label, error),
    })?;
    if !canonical.is_dir() {
        return Err(BridgeError::RunnerRequest {
            message: format!("{} path must be a directory.", label),
        });
    }
    Ok(canonical)
}

fn read_bounded_runner_response(
    response: reqwest::blocking::Response,
) -> Result<Option<String>, BridgeError> {
    let mut reader = response;
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let remaining = DEFAULT_MAX_RUNNER_RESPONSE_BYTES + 1 - bytes.len();
        if remaining == 0 {
            return Err(BridgeError::RunnerRequest {
                message: "Studio Runner response exceeded the maximum response size.".to_string(),
            });
        }
        let read_limit = cmp::min(buffer.len(), remaining);
        let read_len =
            reader
                .read(&mut buffer[..read_limit])
                .map_err(|error| BridgeError::RunnerRequest {
                    message: error.to_string(),
                })?;
        if read_len == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read_len]);
        if bytes.len() > DEFAULT_MAX_RUNNER_RESPONSE_BYTES {
            return Err(BridgeError::RunnerRequest {
                message: "Studio Runner response exceeded the maximum response size.".to_string(),
            });
        }
    }

    if bytes.is_empty() {
        return Ok(None);
    }
    Ok(Some(String::from_utf8_lossy(&bytes).into_owned()))
}

fn extract_run_id(body: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(body).ok()?;
    value
        .get("run_id")
        .or_else(|| value.get("runId"))
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
}

async fn run_bridge_task<T, F>(task: F) -> Result<T, BridgeErrorDto>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, BridgeError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| BridgeErrorDto {
            code: "bridge_task_failed".to_string(),
            message: error.to_string(),
        })?
        .map_err(BridgeErrorDto::from)
}

fn validate_openspec_args(args: &[String]) -> Result<(), BridgeError> {
    match args {
        [command, all, json] if command == "validate" && all == "--all" && json == "--json" => {
            Ok(())
        }
        [command, change_flag, change_name, json]
            if command == "status" && change_flag == "--change" && json == "--json" =>
        {
            validate_change_name(change_name)
        }
        _ => Err(BridgeError::InvalidCommand {
            reason: "unsupported openspec command shape".to_string(),
        }),
    }
}

fn validate_archive_change_name(change_name: &str) -> Result<(), BridgeError> {
    validate_change_name(change_name).map_err(|_| BridgeError::InvalidCommand {
        reason: format!("invalid archive change name '{}'", change_name),
    })
}

fn validate_change_name(change_name: &str) -> Result<(), BridgeError> {
    let trimmed = change_name.trim();

    if trimmed.is_empty() {
        return Err(BridgeError::InvalidCommand {
            reason: "expected a change name to archive".to_string(),
        });
    }

    if trimmed != change_name
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains('\0')
        || trimmed == "."
        || trimmed == ".."
        || trimmed.starts_with('-')
    {
        return Err(BridgeError::InvalidCommand {
            reason: format!("invalid change name '{}'", change_name),
        });
    }

    Ok(())
}

fn require_openspec_repo(repo_path: &Path) -> Result<(PathBuf, PathBuf), BridgeError> {
    let validation = validate_repository(repo_path)?;
    let canonical_repo = PathBuf::from(&validation.path);
    let Some(openspec_path) = validation.openspec_path else {
        return Err(BridgeError::InvalidRepository {
            path: validation.path,
            reason: "no openspec/ directory was found".to_string(),
        });
    };

    let openspec_root = PathBuf::from(openspec_path);
    if !openspec_root.starts_with(&canonical_repo) {
        return Err(BridgeError::InvalidRepository {
            path: path_to_string(&canonical_repo),
            reason: "openspec/ resolves outside the selected repository".to_string(),
        });
    }

    Ok((canonical_repo, openspec_root))
}

fn canonicalize_existing_dir(path: &Path) -> Result<PathBuf, BridgeError> {
    let canonical = canonicalize_path(path)?;
    if !canonical.is_dir() {
        return Err(BridgeError::InvalidRepository {
            path: path_to_string(&canonical),
            reason: "path is not a directory".to_string(),
        });
    }

    Ok(canonical)
}

fn canonicalize_path(path: &Path) -> Result<PathBuf, BridgeError> {
    fs::canonicalize(path).map_err(|error| BridgeError::Io {
        path: path_to_string(path),
        message: error.to_string(),
    })
}

fn command_error(program: &str, error: io::Error) -> BridgeError {
    if error.kind() == io::ErrorKind::NotFound {
        BridgeError::CommandNotFound {
            program: program.to_string(),
        }
    } else {
        BridgeError::CommandStartFailed {
            program: program.to_string(),
            message: error.to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct CommandExecutionOptions {
    timeout: Duration,
    max_output_bytes: usize,
}

impl Default for CommandExecutionOptions {
    fn default() -> Self {
        Self {
            timeout: DEFAULT_COMMAND_TIMEOUT,
            max_output_bytes: DEFAULT_MAX_COMMAND_OUTPUT_BYTES,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BoundedCommandOutput {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    status_code: Option<i32>,
    success: bool,
}

fn run_command_with_fallbacks(
    canonical_repo: &Path,
    program: &str,
    args: &[String],
    options: CommandExecutionOptions,
) -> Result<BoundedCommandOutput, BridgeError> {
    let candidates = command_candidates(program);
    let mut not_found = false;

    for candidate in candidates {
        let mut command = Command::new(&candidate);
        command
            .args(args)
            .current_dir(canonical_repo)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(path) = child_path_for_candidate(&candidate) {
            command.env("PATH", path);
        }

        prepare_command_for_tree_termination(&mut command);

        match run_bounded_command(command, program, options) {
            Ok(Ok(output)) => return Ok(output),
            Ok(Err(error)) => return Err(error),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                not_found = true;
            }
            Err(error) => return Err(command_error(program, error)),
        }
    }

    if not_found {
        Err(BridgeError::CommandNotFound {
            program: program.to_string(),
        })
    } else {
        Err(BridgeError::CommandStartFailed {
            program: program.to_string(),
            message: "no command candidates were available".to_string(),
        })
    }
}

fn run_bounded_command(
    mut command: Command,
    program: &str,
    options: CommandExecutionOptions,
) -> Result<Result<BoundedCommandOutput, BridgeError>, io::Error> {
    let mut child = command.spawn()?;
    let child_id = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_overflow = Arc::new(AtomicBool::new(false));
    let stderr_overflow = Arc::new(AtomicBool::new(false));
    let mut stdout_handle = stdout
        .map(|reader| read_bounded(reader, options.max_output_bytes, stdout_overflow.clone()));
    let mut stderr_handle = stderr
        .map(|reader| read_bounded(reader, options.max_output_bytes, stderr_overflow.clone()));
    let start = Instant::now();

    let status = loop {
        if stdout_overflow.load(Ordering::SeqCst) {
            terminate_child_tree(&mut child, child_id);
            let _ = receive_output(stdout_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            let _ = receive_output(stderr_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            return Ok(Err(BridgeError::CommandOutputExceeded {
                program: program.to_string(),
                stream: "stdout".to_string(),
                max_bytes: options.max_output_bytes,
            }));
        }

        if stderr_overflow.load(Ordering::SeqCst) {
            terminate_child_tree(&mut child, child_id);
            let _ = receive_output(stdout_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            let _ = receive_output(stderr_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            return Ok(Err(BridgeError::CommandOutputExceeded {
                program: program.to_string(),
                stream: "stderr".to_string(),
                max_bytes: options.max_output_bytes,
            }));
        }

        if start.elapsed() >= options.timeout {
            terminate_child_tree(&mut child, child_id);
            let _ = receive_output(stdout_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            let _ = receive_output(stderr_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT);
            return Ok(Err(BridgeError::CommandTimedOut {
                program: program.to_string(),
                timeout_ms: options.timeout.as_millis(),
            }));
        }

        if let Some(status) = child.try_wait()? {
            break status;
        }

        thread::sleep(Duration::from_millis(10));
    };

    terminate_process_group_gracefully(child_id);

    let stdout = match receive_output(stdout_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT) {
        Ok(stdout) => stdout,
        Err(error) if error.kind() == io::ErrorKind::TimedOut => {
            terminate_process_group_forcefully(child_id);
            return Ok(Err(BridgeError::CommandOutputReadTimedOut {
                program: program.to_string(),
            }));
        }
        Err(error) => return Ok(Err(command_error(program, error))),
    };
    let stderr = match receive_output(stderr_handle.take(), OUTPUT_READER_DRAIN_TIMEOUT) {
        Ok(stderr) => stderr,
        Err(error) if error.kind() == io::ErrorKind::TimedOut => {
            terminate_process_group_forcefully(child_id);
            return Ok(Err(BridgeError::CommandOutputReadTimedOut {
                program: program.to_string(),
            }));
        }
        Err(error) => return Ok(Err(command_error(program, error))),
    };

    if stdout_overflow.load(Ordering::SeqCst) {
        return Ok(Err(BridgeError::CommandOutputExceeded {
            program: program.to_string(),
            stream: "stdout".to_string(),
            max_bytes: options.max_output_bytes,
        }));
    }

    if stderr_overflow.load(Ordering::SeqCst) {
        return Ok(Err(BridgeError::CommandOutputExceeded {
            program: program.to_string(),
            stream: "stderr".to_string(),
            max_bytes: options.max_output_bytes,
        }));
    }

    Ok(Ok(BoundedCommandOutput {
        stdout,
        stderr,
        status_code: status.code(),
        success: status.success(),
    }))
}

fn prepare_command_for_tree_termination(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;

        command.process_group(0);
    }
}

fn terminate_child_tree(child: &mut Child, child_id: u32) {
    terminate_process_group_gracefully(child_id);
    let _ = child.kill();

    if wait_child_for(child, COMMAND_TERMINATION_GRACE).is_some() {
        return;
    }

    terminate_process_group_forcefully(child_id);
    let _ = child.kill();
    let _ = wait_child_for(child, COMMAND_TERMINATION_GRACE);
}

fn terminate_runner_process(pid: u32, child: Option<&mut Child>) {
    if let Some(child) = child {
        let _ = child.kill();
        if wait_child_for(child, COMMAND_TERMINATION_GRACE).is_some() {
            return;
        }
        let _ = child.kill();
        let _ = wait_child_for(child, COMMAND_TERMINATION_GRACE);
        return;
    }

    terminate_pid_gracefully(pid);
    thread::sleep(COMMAND_TERMINATION_GRACE);
    terminate_pid_forcefully(pid);
}

fn wait_child_for(child: &mut Child, timeout: Duration) -> Option<()> {
    let start = Instant::now();

    while start.elapsed() < timeout {
        match child.try_wait() {
            Ok(Some(_)) => return Some(()),
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(_) => return Some(()),
        }
    }

    None
}

fn terminate_process_group_gracefully(child_id: u32) {
    #[cfg(unix)]
    terminate_process_group(child_id, libc::SIGTERM);
}

fn terminate_process_group_forcefully(child_id: u32) {
    #[cfg(unix)]
    terminate_process_group(child_id, libc::SIGKILL);
}

fn terminate_pid_gracefully(pid: u32) {
    #[cfg(unix)]
    terminate_pid(pid, libc::SIGTERM);
}

fn terminate_pid_forcefully(pid: u32) {
    #[cfg(unix)]
    terminate_pid(pid, libc::SIGKILL);
}

#[cfg(unix)]
fn terminate_process_group(child_id: u32, signal: i32) {
    unsafe {
        libc::kill(-(child_id as libc::pid_t), signal);
    }
}

#[cfg(unix)]
fn terminate_pid(pid: u32, signal: i32) {
    unsafe {
        libc::kill(pid as libc::pid_t, signal);
    }
}

fn read_bounded<R>(mut reader: R, max_bytes: usize, overflow: Arc<AtomicBool>) -> OutputReader
where
    R: Read + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();

    thread::spawn(move || {
        let result: io::Result<Vec<u8>> = (|| {
            let mut output = Vec::new();
            let mut buffer = [0u8; 8192];

            loop {
                let bytes_read = reader.read(&mut buffer)?;
                if bytes_read == 0 {
                    return Ok(output);
                }

                let available = max_bytes.saturating_sub(output.len());
                if bytes_read > available {
                    output.extend_from_slice(&buffer[..available]);
                    overflow.store(true, Ordering::SeqCst);
                    return Ok(output);
                }

                output.extend_from_slice(&buffer[..bytes_read]);
            }
        })();

        let _ = sender.send(result);
    });

    OutputReader { receiver }
}

fn receive_output(handle: Option<OutputReader>, timeout: Duration) -> io::Result<Vec<u8>> {
    match handle {
        Some(handle) => handle.receive(timeout),
        None => Ok(Vec::new()),
    }
}

struct OutputReader {
    receiver: Receiver<io::Result<Vec<u8>>>,
}

impl OutputReader {
    fn receive(self, timeout: Duration) -> io::Result<Vec<u8>> {
        self.receiver.recv_timeout(timeout).unwrap_or_else(|error| {
            Err(match error {
                mpsc::RecvTimeoutError::Timeout => io::Error::new(
                    io::ErrorKind::TimedOut,
                    "output reader did not finish before timeout",
                ),
                mpsc::RecvTimeoutError::Disconnected => {
                    io::Error::new(io::ErrorKind::Other, "output reader disconnected")
                }
            })
        })
    }
}

fn command_candidates(program: &str) -> Vec<PathBuf> {
    let program_path = Path::new(program);

    if program_path.is_absolute() || program.contains(std::path::MAIN_SEPARATOR) {
        return vec![program_path.to_path_buf()];
    }

    let mut candidates = std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths)
                .map(|path| path.join(program))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for path in STANDARD_COMMAND_DIRS {
        let candidate = Path::new(path).join(program);

        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }

    candidates
}

fn child_path_for_candidate(candidate: &Path) -> Option<OsString> {
    std::env::join_paths(child_path_entries(
        candidate,
        std::env::var_os("PATH").as_deref(),
    ))
    .ok()
}

fn child_path_entries(candidate: &Path, existing_path: Option<&OsStr>) -> Vec<PathBuf> {
    let mut entries = Vec::new();

    if let Some(parent) = candidate.parent() {
        push_unique_path(&mut entries, parent.to_path_buf());
    }

    for path in STANDARD_COMMAND_DIRS {
        push_unique_path(&mut entries, PathBuf::from(path));
    }

    if let Some(existing_path) = existing_path {
        for path in std::env::split_paths(existing_path) {
            push_unique_path(&mut entries, path);
        }
    }

    entries
}

fn push_unique_path(entries: &mut Vec<PathBuf>, path: PathBuf) {
    if path.as_os_str().is_empty() || entries.contains(&path) {
        return;
    }

    entries.push(path);
}

fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn parse_git_status_entries(output: &str) -> Vec<String> {
    output
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.trim().is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn first_non_empty_output(stderr: &[u8], stdout: &[u8]) -> String {
    let stderr = String::from_utf8_lossy(stderr).trim().to_string();
    if !stderr.is_empty() {
        return stderr;
    }

    let stdout = String::from_utf8_lossy(stdout).trim().to_string();
    if !stdout.is_empty() {
        return stdout;
    }

    "Git status is unavailable for this repository".to_string()
}

fn collect_openspec_files(
    canonical_repo: &Path,
    openspec_root: &Path,
    current_dir: &Path,
    include_content: bool,
    records: &mut Vec<OpenSpecFileRecord>,
) -> Result<(), BridgeError> {
    for entry in fs::read_dir(current_dir).map_err(|error| BridgeError::Io {
        path: path_to_string(current_dir),
        message: error.to_string(),
    })? {
        let entry = entry.map_err(|error| BridgeError::Io {
            path: path_to_string(current_dir),
            message: error.to_string(),
        })?;
        let path = entry.path();
        let symlink_metadata = fs::symlink_metadata(&path).map_err(|error| BridgeError::Io {
            path: path_to_string(&path),
            message: error.to_string(),
        })?;
        let file_type = symlink_metadata.file_type();
        let is_symlink = file_type.is_symlink();

        if is_symlink {
            let relative_path = path
                .strip_prefix(canonical_repo)
                .map(normalize_relative_path)
                .unwrap_or_else(|_| path_to_string(&path));
            let modified_time_ms = symlink_metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis());
            let read_error = fs::metadata(&path).err().map(|error| error.to_string());

            records.push(OpenSpecFileRecord {
                path: relative_path,
                kind: "symlink".to_string(),
                modified_time_ms,
                file_size: Some(symlink_metadata.len()),
                content: None,
                read_error,
            });
            continue;
        }

        let canonical_path = canonicalize_path(&path)?;

        if !canonical_path.starts_with(openspec_root) {
            continue;
        }

        let metadata = fs::metadata(&canonical_path).map_err(|error| BridgeError::Io {
            path: path_to_string(&canonical_path),
            message: error.to_string(),
        })?;
        let relative_path = canonical_path
            .strip_prefix(canonical_repo)
            .map(normalize_relative_path)
            .unwrap_or_else(|_| path_to_string(&canonical_path));
        let modified_time_ms = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis());
        let file_size = metadata.is_file().then_some(metadata.len());

        if metadata.is_dir() {
            records.push(OpenSpecFileRecord {
                path: relative_path,
                kind: "directory".to_string(),
                modified_time_ms,
                file_size: None,
                content: None,
                read_error: None,
            });
            collect_openspec_files(
                canonical_repo,
                openspec_root,
                &canonical_path,
                include_content,
                records,
            )?;
        } else if metadata.is_file() {
            let (content, read_error) = if include_content
                && canonical_path
                    .extension()
                    .is_some_and(|extension| extension == "md")
            {
                match fs::read_to_string(&canonical_path) {
                    Ok(content) => (Some(content), None),
                    Err(error) => (None, Some(error.to_string())),
                }
            } else {
                (None, None)
            };

            records.push(OpenSpecFileRecord {
                path: relative_path,
                kind: "file".to_string(),
                modified_time_ms,
                file_size,
                content,
                read_error,
            });
        }
    }

    Ok(())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::{
        fs,
        path::PathBuf,
        process,
        sync::mpsc,
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

    #[cfg(unix)]
    fn write_executable(path: &Path, contents: &str) {
        fs::write(path, contents).expect("script should be written");
        fs::set_permissions(path, fs::Permissions::from_mode(0o755))
            .expect("script should be executable");
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
        clear_runner_session_secret().expect("secret should start clear");
        let (endpoint, rx, handle) =
            mock_runner_response(202, r#"{"run_id":"run_demo"}"#.to_string());
        configure_runner_session_secret("secret".to_string()).expect("secret should configure");
        let response = dispatch_runner_event(
            StudioRunnerSettings {
                endpoint,
                repo_path: None,
            },
            runner_request("evt_mock"),
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
python3 -u - "$port" "$PWD/WORKFLOW.md" <<'PY'
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

        let response = start_runner_process(StudioRunnerLifecycleRequest {
            repo_path: path_to_string(&runner_repo),
            endpoint: Some("http://127.0.0.1:45123/api/v1/studio-runner/events".to_string()),
        })
        .expect("runner should start and pass health");
        assert!(response.started);
        assert_eq!(response.port, 45123);
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
            endpoint: "http://127.0.0.1:45124/api/v1/studio-runner/events".to_string(),
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
            check_runner_status(StudioRunnerSettings {
                endpoint: response.endpoint.clone(),
                repo_path: Some(path_to_string(&runner_repo)),
            })
            .expect("detached managed runner should recover")
        };
        assert!(recovered_status.reachable);
        assert!(recovered_status.managed);
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
        assert_eq!(stopped.port, 45123);

        if let Some(value) = previous_bin {
            std::env::set_var("OPENSPEC_STUDIO_RUNNER_BIN", value);
        } else {
            std::env::remove_var("OPENSPEC_STUDIO_RUNNER_BIN");
        }
        reset_studio_runner_process_for_test();
        cleanup(runner_repo);
    }

    #[test]
    fn runner_dispatch_requires_session_secret() {
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
