use super::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BridgeErrorDto {
    pub code: String,
    pub message: String,
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

    pub(super) fn message(&self) -> String {
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

pub(super) async fn run_bridge_task<T, F>(task: F) -> Result<T, BridgeErrorDto>
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

pub(super) fn validate_openspec_args(args: &[String]) -> Result<(), BridgeError> {
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

pub(super) fn validate_archive_change_name(change_name: &str) -> Result<(), BridgeError> {
    validate_change_name(change_name).map_err(|_| BridgeError::InvalidCommand {
        reason: format!("invalid archive change name '{}'", change_name),
    })
}

pub(super) fn validate_change_name(change_name: &str) -> Result<(), BridgeError> {
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

pub(super) fn require_openspec_repo(repo_path: &Path) -> Result<(PathBuf, PathBuf), BridgeError> {
    let validation = openspec::validate_repository(repo_path)?;
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

pub(super) fn canonicalize_existing_dir(path: &Path) -> Result<PathBuf, BridgeError> {
    let canonical = canonicalize_path(path)?;
    if !canonical.is_dir() {
        return Err(BridgeError::InvalidRepository {
            path: path_to_string(&canonical),
            reason: "path is not a directory".to_string(),
        });
    }

    Ok(canonical)
}

pub(super) fn canonicalize_path(path: &Path) -> Result<PathBuf, BridgeError> {
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
pub(super) struct CommandExecutionOptions {
    pub(super) timeout: Duration,
    pub(super) max_output_bytes: usize,
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
pub(super) struct BoundedCommandOutput {
    pub(super) stdout: Vec<u8>,
    pub(super) stderr: Vec<u8>,
    pub(super) status_code: Option<i32>,
    pub(super) success: bool,
}

pub(super) fn run_command_with_fallbacks(
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

pub(super) fn terminate_runner_process(pid: u32, child: Option<&mut Child>) {
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

pub(super) fn terminate_pid_gracefully(pid: u32) {
    #[cfg(unix)]
    terminate_pid(pid, libc::SIGTERM);
}

pub(super) fn terminate_pid_forcefully(pid: u32) {
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

pub(super) fn command_candidates(program: &str) -> Vec<PathBuf> {
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

pub(super) fn child_path_entries(candidate: &Path, existing_path: Option<&OsStr>) -> Vec<PathBuf> {
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

pub(super) fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

pub(super) fn parse_git_status_entries(output: &str) -> Vec<String> {
    output
        .lines()
        .map(str::trim_end)
        .filter(|line| !line.trim().is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

pub(super) fn first_non_empty_output(stderr: &[u8], stdout: &[u8]) -> String {
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

pub(super) fn collect_openspec_files(
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

pub(super) fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
