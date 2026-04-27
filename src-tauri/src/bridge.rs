use serde::{Deserialize, Serialize};
use std::{
    ffi::{OsStr, OsString},
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Output},
    time::UNIX_EPOCH,
};

const ALLOWED_OPENSPEC_COMMANDS: &[&str] = &["list", "show", "status", "validate"];
const STANDARD_COMMAND_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/opt/local/bin",
    "/usr/bin",
    "/bin",
];

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
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BridgeErrorDto {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BridgeError {
    InvalidRepository { path: String, reason: String },
    InvalidCommand { reason: String },
    CommandNotFound { program: String },
    CommandStartFailed { program: String, message: String },
    PathOutsideOpenSpec { path: String },
    Io { path: String, message: String },
}

impl BridgeError {
    fn code(&self) -> &'static str {
        match self {
            Self::InvalidRepository { .. } => "invalid_repository",
            Self::InvalidCommand { .. } => "invalid_command",
            Self::CommandNotFound { .. } => "command_not_found",
            Self::CommandStartFailed { .. } => "command_start_failed",
            Self::PathOutsideOpenSpec { .. } => "path_outside_openspec",
            Self::Io { .. } => "io_error",
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
            Self::PathOutsideOpenSpec { path } => {
                format!(
                    "Path '{}' is outside the selected repo's openspec/ directory",
                    path
                )
            }
            Self::Io { path, message } => format!("I/O error for '{}': {}", path, message),
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
    let output = run_command_with_fallbacks(&canonical_repo, program, args)?;

    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        status_code: output.status.code(),
        success: output.status.success(),
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
    let (canonical_repo, openspec_root) = require_openspec_repo(repo_path.as_ref())?;
    let mut records = Vec::new();

    collect_openspec_files(
        &canonical_repo,
        &openspec_root,
        &openspec_root,
        &mut records,
    )?;
    records.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(records)
}

#[tauri::command]
pub fn validate_repo(repo_path: String) -> Result<RepositoryValidation, BridgeErrorDto> {
    validate_repository(repo_path).map_err(BridgeErrorDto::from)
}

#[tauri::command]
pub fn pick_repository_folder() -> Result<Option<String>, BridgeErrorDto> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"set selectedFolder to choose folder with prompt "Choose an OpenSpec repository folder"
POSIX path of selectedFolder"#;
        let output = Command::new("/usr/bin/osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|source| BridgeError::CommandStartFailed {
                program: "osascript".to_string(),
                message: source.to_string(),
            })?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok((!path.is_empty()).then_some(path));
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || output.status.code() == Some(1) {
            return Ok(None);
        }

        Err(BridgeErrorDto {
            code: "dialog_failed".to_string(),
            message: stderr.trim().to_string(),
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn run_openspec_command(
    repo_path: String,
    args: Vec<String>,
) -> Result<CommandResult, BridgeErrorDto> {
    validate_openspec_args(&args).map_err(BridgeErrorDto::from)?;
    execute_local_command(repo_path, "openspec", &args).map_err(BridgeErrorDto::from)
}

#[tauri::command]
pub fn archive_change(
    repo_path: String,
    change_name: String,
) -> Result<CommandResult, BridgeErrorDto> {
    validate_archive_change_name(&change_name).map_err(BridgeErrorDto::from)?;
    execute_local_command(
        repo_path,
        "openspec",
        &["archive".to_string(), change_name, "--yes".to_string()],
    )
    .map_err(BridgeErrorDto::from)
}

#[tauri::command]
pub fn read_openspec_artifact_file(
    repo_path: String,
    artifact_path: String,
) -> Result<ArtifactFile, BridgeErrorDto> {
    read_openspec_artifact(repo_path, artifact_path).map_err(BridgeErrorDto::from)
}

#[tauri::command]
pub fn list_openspec_file_records(
    repo_path: String,
) -> Result<Vec<OpenSpecFileRecord>, BridgeErrorDto> {
    list_openspec_files(repo_path).map_err(BridgeErrorDto::from)
}

fn validate_openspec_args(args: &[String]) -> Result<(), BridgeError> {
    let Some(command) = args.first() else {
        return Err(BridgeError::InvalidCommand {
            reason: "expected an openspec subcommand".to_string(),
        });
    };

    if !ALLOWED_OPENSPEC_COMMANDS.contains(&command.as_str()) {
        return Err(BridgeError::InvalidCommand {
            reason: format!("unsupported subcommand '{}'", command),
        });
    }

    Ok(())
}

fn validate_archive_change_name(change_name: &str) -> Result<(), BridgeError> {
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
            reason: format!("invalid archive change name '{}'", change_name),
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

fn run_command_with_fallbacks(
    canonical_repo: &Path,
    program: &str,
    args: &[String],
) -> Result<Output, BridgeError> {
    let candidates = command_candidates(program);
    let mut not_found = false;

    for candidate in candidates {
        let mut command = Command::new(&candidate);
        command.args(args).current_dir(canonical_repo);

        if let Some(path) = child_path_for_candidate(&candidate) {
            command.env("PATH", path);
        }

        match command.output() {
            Ok(output) => return Ok(output),
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

fn collect_openspec_files(
    canonical_repo: &Path,
    openspec_root: &Path,
    current_dir: &Path,
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

        if metadata.is_dir() {
            records.push(OpenSpecFileRecord {
                path: relative_path,
                kind: "directory".to_string(),
                modified_time_ms,
                content: None,
            });
            collect_openspec_files(canonical_repo, openspec_root, &canonical_path, records)?;
        } else if metadata.is_file() {
            let content = if canonical_path
                .extension()
                .is_some_and(|extension| extension == "md")
            {
                fs::read_to_string(&canonical_path).ok()
            } else {
                None
            };

            records.push(OpenSpecFileRecord {
                path: relative_path,
                kind: "file".to_string(),
                modified_time_ms,
                content,
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
    use std::{
        fs,
        os::unix::fs::PermissionsExt,
        path::PathBuf,
        process,
        time::{SystemTime, UNIX_EPOCH},
    };

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
        for change_name in ["", " ../demo", "../demo", "archive/demo", "--help", "demo/name"] {
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
        }));
        assert!(records.iter().any(|record| {
            record.path == "openspec/changes/demo/data.json"
                && record.kind == "file"
                && record.content.is_none()
        }));

        cleanup(repo);
    }
}
