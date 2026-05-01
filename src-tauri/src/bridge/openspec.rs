use super::*;
use super::shared::*;

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

pub fn execute_archive_command(
    repo_path: impl AsRef<Path>,
    change_name: String,
) -> Result<CommandResult, BridgeError> {
    let (canonical_repo, _) = require_openspec_repo(repo_path.as_ref())?;
    let args = vec!["archive".to_string(), change_name, "--yes".to_string()];
    let output = run_command_with_fallbacks(
        &canonical_repo,
        "openspec",
        &args,
        CommandExecutionOptions::default(),
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let archived = archive_command_changed_files(&stdout, &stderr);

    Ok(CommandResult {
        stdout,
        stderr,
        status_code: output.status_code,
        success: output.success && archived,
    })
}

pub(super) fn archive_command_changed_files(stdout: &str, stderr: &str) -> bool {
    let combined = format!(
        "{stdout}
{stderr}"
    );
    !(combined.contains("Aborted. No files were changed.")
        || combined.contains("failed for header")
        || combined.contains("No files were changed"))
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
    run_bridge_task(move || execute_archive_command(repo_path, change_name)).await
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
