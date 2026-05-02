use super::shared::*;
use super::*;

#[tauri::command]
pub async fn start_studio_runner_event_stream(
    app: AppHandle,
    request: StudioRunnerStreamRequest,
) -> Result<StudioRunnerStreamResponse, BridgeErrorDto> {
    start_runner_event_stream(app, request).map_err(BridgeErrorDto::from)
}

#[tauri::command]
pub async fn stop_studio_runner_event_stream() -> Result<StudioRunnerStreamResponse, BridgeErrorDto>
{
    stop_runner_event_stream().map_err(BridgeErrorDto::from)
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
pub async fn restart_studio_runner(
    mut request: StudioRunnerLifecycleRequest,
) -> Result<StudioRunnerLifecycleResponse, BridgeErrorDto> {
    request.restart = true;
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

fn start_runner_event_stream(
    app: AppHandle,
    request: StudioRunnerStreamRequest,
) -> Result<StudioRunnerStreamResponse, BridgeError> {
    let endpoint = normalize_runner_stream_endpoint(&request.endpoint)?;
    stop_runner_event_stream_for_replacement()?;

    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = stop.clone();
    let thread_endpoint = endpoint.clone();
    let repo_path = request.repo_path.clone();
    let thread_app = app.clone();
    let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);

    thread::spawn(move || {
        if let Err(error) = run_runner_event_stream(
            thread_app.clone(),
            &thread_endpoint,
            repo_path,
            thread_stop,
            Some(ready_tx),
        ) {
            let _ = thread_app.emit("studio-runner-stream-error", error.message());
        }
    });

    match ready_rx.recv_timeout(DEFAULT_RUNNER_HTTP_TIMEOUT) {
        Ok(Ok(())) => {}
        Ok(Err(message)) => {
            stop.store(true, Ordering::SeqCst);
            return Err(BridgeError::RunnerRequest { message });
        }
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
            stop.store(true, Ordering::SeqCst);
            return Err(BridgeError::RunnerRequest {
                message: "Studio Runner stream did not become ready before timeout.".to_string(),
            });
        }
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
            stop.store(true, Ordering::SeqCst);
            return Err(BridgeError::RunnerRequest {
                message: "Studio Runner stream ended before it became ready.".to_string(),
            });
        }
    }

    let mut store =
        studio_runner_event_stream()
            .lock()
            .map_err(|_| BridgeError::RunnerRequest {
                message: "Studio Runner stream store is unavailable.".to_string(),
            })?;
    *store = Some(StudioRunnerEventStreamHandle {
        endpoint: endpoint.clone(),
        stop,
    });

    Ok(StudioRunnerStreamResponse {
        streaming: true,
        endpoint,
        message: "Studio Runner event stream connected.".to_string(),
    })
}

fn stop_runner_event_stream() -> Result<StudioRunnerStreamResponse, BridgeError> {
    let mut store =
        studio_runner_event_stream()
            .lock()
            .map_err(|_| BridgeError::RunnerRequest {
                message: "Studio Runner stream store is unavailable.".to_string(),
            })?;
    if let Some(handle) = store.take() {
        handle.stop.store(true, Ordering::SeqCst);
        return Ok(StudioRunnerStreamResponse {
            streaming: false,
            endpoint: handle.endpoint,
            message: "Studio Runner event stream stopped.".to_string(),
        });
    }

    Ok(StudioRunnerStreamResponse {
        streaming: false,
        endpoint: String::new(),
        message: "Studio Runner event stream was not running.".to_string(),
    })
}

fn stop_runner_event_stream_for_replacement() -> Result<(), BridgeError> {
    let mut store =
        studio_runner_event_stream()
            .lock()
            .map_err(|_| BridgeError::RunnerRequest {
                message: "Studio Runner stream store is unavailable.".to_string(),
            })?;
    if let Some(handle) = store.take() {
        handle.stop.store(true, Ordering::SeqCst);
    }
    Ok(())
}

fn run_runner_event_stream(
    app: AppHandle,
    endpoint: &str,
    fallback_repo_path: Option<String>,
    stop: Arc<AtomicBool>,
    ready: Option<std::sync::mpsc::SyncSender<Result<(), String>>>,
) -> Result<(), BridgeError> {
    let client = reqwest::blocking::Client::builder()
        .timeout(None)
        .build()
        .map_err(|error| {
            let message = format!("Studio Runner stream client could not be created: {error}");
            if let Some(sender) = ready.as_ref() {
                let _ = sender.send(Err(message.clone()));
            }
            BridgeError::RunnerRequest { message }
        })?;
    let response = client.get(endpoint).send().map_err(|error| {
        let message = format!("Studio Runner stream request failed: {error}");
        if let Some(sender) = ready.as_ref() {
            let _ = sender.send(Err(message.clone()));
        }
        BridgeError::RunnerRequest { message }
    })?;

    if !response.status().is_success() {
        let message = format!(
            "Studio Runner stream returned HTTP {}",
            response.status().as_u16()
        );
        if let Some(sender) = ready.as_ref() {
            let _ = sender.send(Err(message.clone()));
        }
        return Err(BridgeError::RunnerRequest { message });
    }

    if let Some(sender) = ready {
        let _ = sender.send(Ok(()));
    }

    let mut reader = BufReader::new(response);
    let mut event_name = "runner.update".to_string();
    let mut data_lines: Vec<String> = Vec::new();
    let mut frame_bytes = 0usize;
    let mut line = String::new();

    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        line.clear();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|error| BridgeError::RunnerRequest {
                message: format!("Studio Runner stream read failed: {error}"),
            })?;
        if bytes == 0 {
            break;
        }
        if line.len() > 64 * 1024 {
            return Err(BridgeError::RunnerRequest {
                message: "Studio Runner stream frame exceeded the maximum line size.".to_string(),
            });
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            if !data_lines.is_empty() {
                let data = data_lines.join("\n");
                let event =
                    parse_runner_stream_event(&event_name, &data, fallback_repo_path.as_deref())?;
                let _ = app.emit("studio-runner-event", event);
            }
            event_name = "runner.update".to_string();
            data_lines.clear();
            frame_bytes = 0;
            continue;
        }
        if trimmed.starts_with(':') {
            continue;
        }
        if let Some(value) = trimmed.strip_prefix("event:") {
            event_name = value.trim().to_string();
            continue;
        }
        if let Some(value) = trimmed.strip_prefix("data:") {
            let value = value.trim_start();
            frame_bytes = frame_bytes.saturating_add(value.len());
            if frame_bytes > 64 * 1024 {
                return Err(BridgeError::RunnerRequest {
                    message: "Studio Runner stream frame exceeded the maximum data size."
                        .to_string(),
                });
            }
            data_lines.push(value.to_string());
        }
    }

    Ok(())
}

pub(super) fn parse_runner_stream_event(
    event_name: &str,
    data: &str,
    fallback_repo_path: Option<&str>,
) -> Result<StudioRunnerStreamEvent, BridgeError> {
    let payload: serde_json::Value =
        serde_json::from_str(data).map_err(|error| BridgeError::RunnerRequest {
            message: format!("Studio Runner stream event was not valid JSON: {error}"),
        })?;
    let object = payload
        .as_object()
        .ok_or_else(|| BridgeError::RunnerRequest {
            message: "Studio Runner stream event payload must be an object.".to_string(),
        })?;

    let repo_change_key = read_json_string(object, "repoChangeKey")
        .or_else(|| read_json_string(object, "repo_change_key"));
    let repo_path = read_json_string(object, "repoPath")
        .or_else(|| read_json_string(object, "repo_path"))
        .or_else(|| {
            repo_change_key
                .as_deref()
                .and_then(repo_path_from_repo_change_key)
        })
        .or_else(|| fallback_repo_path.map(str::to_string));
    let change_name = read_json_string(object, "changeName")
        .or_else(|| read_json_string(object, "change"))
        .or_else(|| {
            repo_change_key
                .as_deref()
                .and_then(change_name_from_repo_change_key)
        });

    Ok(StudioRunnerStreamEvent {
        event_name: event_name.to_string(),
        event_id: read_json_string(object, "eventId")
            .or_else(|| read_json_string(object, "event_id")),
        repo_path,
        repo_change_key,
        change_name,
        status: read_json_string(object, "status"),
        run_id: read_json_string(object, "runId").or_else(|| read_json_string(object, "run_id")),
        recorded_at: read_json_string(object, "recordedAt")
            .or_else(|| read_json_string(object, "recorded_at")),
        workspace_path: read_json_string(object, "workspacePath")
            .or_else(|| read_json_string(object, "workspace_path")),
        workspace_status: read_json_string(object, "workspaceStatus")
            .or_else(|| read_json_string(object, "workspace_status")),
        workspace_created_at: read_json_string(object, "workspaceCreatedAt")
            .or_else(|| read_json_string(object, "workspace_created_at")),
        workspace_updated_at: read_json_string(object, "workspaceUpdatedAt")
            .or_else(|| read_json_string(object, "workspace_updated_at")),
        session_id: read_json_string(object, "sessionId")
            .or_else(|| read_json_string(object, "session_id")),
        source_repo_path: read_json_string(object, "sourceRepoPath")
            .or_else(|| read_json_string(object, "source_repo_path")),
        base_commit_sha: read_json_string(object, "baseCommitSha")
            .or_else(|| read_json_string(object, "base_commit_sha")),
        branch_name: read_json_string(object, "branchName")
            .or_else(|| read_json_string(object, "branch_name")),
        commit_sha: read_json_string(object, "commitSha")
            .or_else(|| read_json_string(object, "commit_sha")),
        pr_url: read_json_string(object, "prUrl").or_else(|| read_json_string(object, "pr_url")),
        pr_state: read_json_string(object, "prState")
            .or_else(|| read_json_string(object, "pr_state")),
        pr_merged_at: read_json_string(object, "prMergedAt")
            .or_else(|| read_json_string(object, "pr_merged_at")),
        pr_closed_at: read_json_string(object, "prClosedAt")
            .or_else(|| read_json_string(object, "pr_closed_at")),
        cleanup_eligible: read_json_bool(object, "cleanupEligible")
            .or_else(|| read_json_bool(object, "cleanup_eligible")),
        cleanup_reason: read_json_string(object, "cleanupReason")
            .or_else(|| read_json_string(object, "cleanup_reason")),
        cleanup_status: read_json_string(object, "cleanupStatus")
            .or_else(|| read_json_string(object, "cleanup_status")),
        cleanup_error: read_json_string(object, "cleanupError")
            .or_else(|| read_json_string(object, "cleanup_error")),
        execution_log_entries: read_json_value(object, "executionLogEntries")
            .or_else(|| read_json_value(object, "execution_log_entries"))
            .or_else(|| read_json_value(object, "executionLogs"))
            .or_else(|| read_json_value(object, "execution_logs")),
        error: read_json_string(object, "error"),
        message: read_json_string(object, "message"),
    })
}

fn read_json_bool(object: &serde_json::Map<String, serde_json::Value>, key: &str) -> Option<bool> {
    object.get(key)?.as_bool()
}

fn read_json_string(
    object: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<String> {
    object.get(key)?.as_str().map(str::to_string)
}

fn read_json_value(
    object: &serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<serde_json::Value> {
    object.get(key).cloned()
}

fn repo_path_from_repo_change_key(value: &str) -> Option<String> {
    value.split_once("::").map(|(repo, _)| repo.to_string())
}

fn change_name_from_repo_change_key(value: &str) -> Option<String> {
    value.split_once("::").map(|(_, change)| change.to_string())
}

pub(super) fn normalize_runner_stream_endpoint(endpoint: &str) -> Result<String, BridgeError> {
    let normalized = normalize_runner_endpoint(endpoint)?;
    let mut parsed = url::Url::parse(&normalized).map_err(|error| BridgeError::RunnerRequest {
        message: format!("Invalid Studio Runner stream endpoint: {error}"),
    })?;
    parsed.set_path("/api/v1/studio-runner/events/stream");
    parsed.set_query(None);
    parsed.set_fragment(None);
    Ok(parsed.to_string())
}

pub(super) fn configure_runner_session_secret(
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

pub(super) fn clear_runner_session_secret() -> Result<StudioRunnerSessionSecretResponse, BridgeError>
{
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

pub(super) fn check_runner_status(
    settings: StudioRunnerSettings,
) -> Result<StudioRunnerStatus, BridgeError> {
    reap_finished_runner_process()?;
    let endpoint = normalize_runner_endpoint(&settings.endpoint)?;
    let mut managed = managed_runner_snapshot()?;

    if endpoint.is_empty() || !has_runner_session_secret()? {
        let ownership = runner_status_ownership(managed.as_ref(), &endpoint, false)?;
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
            managed: runner_status_is_studio_owned(&ownership),
            pid: runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint).or_else(|| {
                if endpoint.is_empty() {
                    managed.as_ref().map(|process| process.pid)
                } else {
                    None
                }
            }),
            can_stop: runner_status_can_stop(&ownership),
            can_restart: runner_status_can_restart(&ownership),
            ownership,
        });
    }

    if !runner_managed_for_endpoint(managed.as_ref(), &endpoint) {
        managed = recover_managed_runner_from_endpoint(&endpoint, settings.repo_path.as_deref())?;
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
            let ownership = runner_status_ownership(managed.as_ref(), &endpoint, success)?;
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
                managed: runner_status_is_studio_owned(&ownership),
                pid: runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint),
                can_stop: runner_status_can_stop(&ownership),
                can_restart: runner_status_can_restart(&ownership),
                ownership,
            })
        }
        Err(error) => {
            let ownership = runner_status_ownership(managed.as_ref(), &endpoint, false)?;
            Ok(StudioRunnerStatus {
                configured: true,
                reachable: false,
                status: "unavailable".to_string(),
                endpoint: Some(endpoint.clone()),
                runner_endpoint: runner_snapshot_endpoint(managed.as_ref()),
                runner_repo_path: runner_snapshot_repo_path(managed.as_ref()),
                status_code: None,
                message: error.to_string(),
                response_body: None,
                managed: runner_status_is_studio_owned(&ownership),
                pid: runner_managed_pid_for_endpoint(managed.as_ref(), &endpoint),
                can_stop: runner_status_can_stop(&ownership),
                can_restart: runner_status_can_restart(&ownership),
                ownership,
            })
        }
    }
}

pub(super) fn runner_process_path() -> OsString {
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

    Ok(runner_listener_pid(process.port) == Some(process.pid)
        && runner_process_command(process.pid).is_some())
}

pub(super) fn start_runner_process(
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
            if request.restart {
                terminate_runner_process(existing.pid, existing.child.as_mut());
                *store = None;
            } else if existing.endpoint == endpoint && existing.repo_path == repo_path {
                return Ok(StudioRunnerLifecycleResponse {
                    started: false,
                    endpoint: existing.endpoint.clone(),
                    port: existing.port,
                    pid: Some(existing.pid),
                    message: "Studio Runner is already managed by Studio.".to_string(),
                });
            } else {
                return Err(BridgeError::RunnerRequest {
                    message: "A managed Studio Runner is already running for a different repository or endpoint. Stop it before starting another.".to_string(),
                });
            }
        } else {
            *store = None;
        }
    }

    if request.restart {
        terminate_matching_runner_listener(port, &repo_path)?;
    } else if let Some(pid) = runner_listener_pid(port) {
        let Some(command) = runner_process_command(pid) else {
            return Err(BridgeError::RunnerRequest {
                message: format!("Port {port} is already in use. Stop it or choose another Studio Runner endpoint."),
            });
        };
        let expected = path_to_string(&repo_path);
        if !(command.contains("bin/symphony") || command.contains("/symphony "))
            || !command.contains(&expected)
        {
            return Err(BridgeError::RunnerRequest {
                message: format!(
                    "Port {port} is already in use by a non-matching process. Stop it or choose another Studio Runner endpoint."
                ),
            });
        }
        return Err(BridgeError::RunnerRequest {
            message: format!("A Studio Runner is already listening on port {port}. Use Restart Runner so Studio can replace it with the current session secret."),
        });
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
        recovered: false,
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

pub(super) fn stop_runner_process() -> Result<StudioRunnerLifecycleResponse, BridgeError> {
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

pub(super) fn dispatch_runner_event(
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
            "Studio Runner accepted the event.".to_string()
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

pub(super) fn normalize_runner_endpoint(endpoint: &str) -> Result<String, BridgeError> {
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

pub(super) fn runner_health_endpoint(event_endpoint: &str) -> String {
    event_endpoint
        .strip_suffix("/events")
        .map(|base| format!("{}/health", base))
        .unwrap_or_else(|| format!("{}/health", event_endpoint.trim_end_matches('/')))
}

pub(super) fn sign_runner_body(
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

pub(super) fn wait_for_runner_health(endpoint: &str, timeout: Duration) -> Result<(), BridgeError> {
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
        if process.child.is_none() && runner_listener_pid(process.port) != Some(process.pid) {
            *store = None;
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
        recovered: process.recovered || process.child.is_none(),
    }))
}

#[derive(Debug, Clone)]
struct StudioRunnerProcessSnapshot {
    pid: u32,
    endpoint: String,
    repo_path: PathBuf,
    recovered: bool,
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
                recovered: existing.recovered || existing.child.is_none(),
            }));
        }
    }

    *store = Some(StudioRunnerProcess {
        child: None,
        pid,
        endpoint: endpoint.to_string(),
        port,
        repo_path: recovered_repo_path.clone(),
        recovered: true,
    });

    Ok(Some(StudioRunnerProcessSnapshot {
        pid,
        endpoint: endpoint.to_string(),
        repo_path: recovered_repo_path,
        recovered: true,
    }))
}

fn runner_status_ownership(
    snapshot: Option<&StudioRunnerProcessSnapshot>,
    endpoint: &str,
    reachable: bool,
) -> Result<String, BridgeError> {
    if let Some(process) =
        snapshot.filter(|process| endpoint.is_empty() || process.endpoint == endpoint)
    {
        return Ok(if process.recovered {
            "recovered"
        } else {
            "managed"
        }
        .to_string());
    }

    if endpoint.is_empty() {
        return Ok("offline".to_string());
    }

    let port = runner_endpoint_port(endpoint)?;
    if runner_listener_pid(port).is_some() {
        return Ok(if reachable { "custom" } else { "occupied" }.to_string());
    }

    Ok("offline".to_string())
}

fn runner_status_is_studio_owned(ownership: &str) -> bool {
    matches!(ownership, "managed" | "recovered")
}

fn runner_status_can_stop(ownership: &str) -> bool {
    runner_status_is_studio_owned(ownership)
}

fn runner_status_can_restart(ownership: &str) -> bool {
    runner_status_is_studio_owned(ownership)
}

fn terminate_matching_runner_listener(
    port: u16,
    expected_repo_path: &Path,
) -> Result<(), BridgeError> {
    let Some(pid) = runner_listener_pid(port) else {
        return Ok(());
    };
    let expected = path_to_string(expected_repo_path);
    let Some(command) = runner_process_command(pid) else {
        return Ok(());
    };
    if !(command.contains("bin/symphony") || command.contains("/symphony "))
        || !command.contains(&expected)
    {
        return Err(BridgeError::RunnerRequest {
            message: format!(
                "Port {port} is already in use by a non-matching process. Stop it or choose another Studio Runner endpoint."
            ),
        });
    }
    terminate_pid_gracefully(pid);
    thread::sleep(COMMAND_TERMINATION_GRACE);
    if runner_listener_pid(port) == Some(pid) {
        terminate_pid_forcefully(pid);
        thread::sleep(COMMAND_TERMINATION_GRACE);
    }
    if runner_listener_pid(port).is_some() {
        return Err(BridgeError::RunnerRequest {
            message: format!("Port {port} is still in use after stopping the stale Studio Runner."),
        });
    }
    Ok(())
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

pub(super) fn canonicalize_runner_dir(path: &str, label: &str) -> Result<PathBuf, BridgeError> {
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
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("run_id")
                .or_else(|| value.get("runId"))
                .and_then(|run_id| run_id.as_str())
                .map(ToString::to_string)
        })
}
