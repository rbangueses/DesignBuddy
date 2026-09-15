use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub name: String,
    pub design_count: usize,
    pub visible_in_presentation_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub project_count: usize,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreArtifactPreview {
    pub project: String,
    pub file_name: String,
    pub kind: DesignKind,
    pub conflicts_with_existing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreview {
    pub artifacts: Vec<RestoreArtifactPreview>,
    pub invalid_file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RestoreConflictResolution {
    Copy,
    Replace,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreArtifact {
    pub project: String,
    pub file_name: String,
    pub conflict_resolution: RestoreConflictResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub added_count: usize,
    pub copied_count: usize,
    pub replaced_count: usize,
    pub skipped_count: usize,
    pub invalid_file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ProjectMetadata {
    #[serde(default)]
    visible_in_presentation_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DesignKind {
    Excalidraw,
    Mermaid,
    Note,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesignSummary {
    pub project: String,
    pub name: String,
    pub file_name: String,
    pub kind: DesignKind,
    pub updated_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesignScene {
    pub project: String,
    pub name: String,
    pub file_name: String,
    pub kind: DesignKind,
    pub content: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiagramNotes {
    pub text: String,
}

#[derive(Debug, Error)]
pub enum DesignError {
    #[error("invalid name: {0}")]
    InvalidName(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("already exists: {0}")]
    AlreadyExists(String),
    #[error("invalid design file: {0}")]
    InvalidDesignFile(String),
    #[error("invalid backup target: {0}")]
    InvalidBackupTarget(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub fn empty_scene() -> Value {
    json!({
        "type": "excalidraw",
        "version": 2,
        "source": "banguesesdraw",
        "elements": [],
        "appState": {},
        "files": {}
    })
}

const EXCALIDRAW_EXTENSION: &str = "excalidraw";
const MERMAID_EXTENSION: &str = "mmd";
const NOTE_EXTENSION: &str = "bdnote";
const DIAGRAM_NOTES_SUFFIX: &str = ".designbuddy-notes.json";
const PROJECT_METADATA_FILE: &str = ".designbuddy-project.json";
const LEGACY_PROJECT_METADATA_FILE: &str = ".banguesesdraw-project.json";

fn empty_mermaid_source() -> Value {
    json!({ "source": "flowchart LR\n" })
}

fn empty_note() -> Value {
    json!({
        "type": "banguesesdraw-note",
        "version": 1,
        "content": {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph"
                }
            ]
        }
    })
}

fn extension_for_kind(kind: &DesignKind) -> &'static str {
    match kind {
        DesignKind::Excalidraw => EXCALIDRAW_EXTENSION,
        DesignKind::Mermaid => MERMAID_EXTENSION,
        DesignKind::Note => NOTE_EXTENSION,
    }
}

fn kind_from_path(path: &Path) -> Option<DesignKind> {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some(EXCALIDRAW_EXTENSION) => Some(DesignKind::Excalidraw),
        Some(MERMAID_EXTENSION) => Some(DesignKind::Mermaid),
        Some(NOTE_EXTENSION) => Some(DesignKind::Note),
        _ => None,
    }
}

fn ensure_root(root: &Path) -> Result<(), DesignError> {
    fs::create_dir_all(root)?;
    Ok(())
}

fn validate_name(name: &str) -> Result<String, DesignError> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
    {
        return Err(DesignError::InvalidName(name.to_string()));
    }

    Ok(trimmed.to_string())
}

fn design_file_name_for_kind(name: &str, kind: &DesignKind) -> Result<String, DesignError> {
    let clean = validate_name(name)?;
    let suffix = format!(".{}", extension_for_kind(kind));
    if clean.ends_with(&suffix) {
        Ok(clean)
    } else {
        Ok(format!("{clean}{suffix}"))
    }
}

fn design_file_name(name: &str) -> Result<String, DesignError> {
    let clean = validate_name(name)?;
    if kind_from_path(Path::new(&clean)).is_some() {
        Ok(clean)
    } else {
        design_file_name_for_kind(&clean, &DesignKind::Excalidraw)
    }
}

fn design_name_from_file(file_name: &str) -> String {
    match kind_from_path(Path::new(file_name)) {
        Some(kind) => file_name
            .strip_suffix(&format!(".{}", extension_for_kind(&kind)))
            .unwrap_or(file_name)
            .to_string(),
        None => file_name.to_string(),
    }
}

fn design_name_from_path(path: &Path) -> Result<String, DesignError> {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| DesignError::InvalidName(path.display().to_string()))?;

    validate_name(stem)
}

fn project_path(root: &Path, project: &str) -> Result<PathBuf, DesignError> {
    Ok(root.join(validate_name(project)?))
}

fn project_metadata_path(project_path: &Path) -> PathBuf {
    project_path.join(PROJECT_METADATA_FILE)
}

fn legacy_project_metadata_path(project_path: &Path) -> PathBuf {
    project_path.join(LEGACY_PROJECT_METADATA_FILE)
}

fn read_project_metadata(project_path: &Path) -> Result<ProjectMetadata, DesignError> {
    let path = project_metadata_path(project_path);
    if path.exists() {
        return Ok(serde_json::from_str(&fs::read_to_string(path)?)?);
    }

    let legacy_path = legacy_project_metadata_path(project_path);
    if legacy_path.exists() {
        let metadata = serde_json::from_str(&fs::read_to_string(&legacy_path)?)?;
        write_project_metadata(project_path, &metadata)?;
        let _ = fs::remove_file(legacy_path);
        return Ok(metadata);
    }

    Ok(ProjectMetadata::default())
}

fn write_project_metadata(
    project_path: &Path,
    metadata: &ProjectMetadata,
) -> Result<(), DesignError> {
    fs::write(
        project_metadata_path(project_path),
        serde_json::to_string_pretty(metadata)?,
    )?;
    Ok(())
}

fn design_path(root: &Path, project: &str, file_name: &str) -> Result<PathBuf, DesignError> {
    let project_dir = project_path(root, project)?;
    let file_name = design_file_name(file_name)?;
    Ok(project_dir.join(file_name))
}

fn design_path_for_kind(
    root: &Path,
    project: &str,
    name: &str,
    kind: &DesignKind,
) -> Result<PathBuf, DesignError> {
    let project_dir = project_path(root, project)?;
    let file_name = design_file_name_for_kind(name, kind)?;
    Ok(project_dir.join(file_name))
}

fn unique_design_path(
    root: &Path,
    project: &str,
    preferred_name: &str,
    kind: &DesignKind,
) -> Result<PathBuf, DesignError> {
    let project_dir = project_path(root, project)?;
    if !project_dir.exists() {
        return Err(DesignError::NotFound(project.to_string()));
    }

    let preferred_name = validate_name(preferred_name)?;
    let first = project_dir.join(design_file_name_for_kind(&preferred_name, kind)?);
    if !first.exists() {
        return Ok(first);
    }

    for index in 1.. {
        let candidate_name = if index == 1 {
            format!("{preferred_name} Copy")
        } else {
            format!("{preferred_name} Copy {index}")
        };
        let candidate = project_dir.join(design_file_name_for_kind(&candidate_name, kind)?);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    unreachable!("unique design name search is unbounded");
}

fn modified_ms(path: &Path) -> u128 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn is_design_file(path: &Path) -> bool {
    kind_from_path(path).is_some()
}

fn diagram_notes_path(path: &Path) -> Result<PathBuf, DesignError> {
    let parent = path
        .parent()
        .ok_or_else(|| DesignError::InvalidName(path.display().to_string()))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| DesignError::InvalidName(path.display().to_string()))?;
    Ok(parent.join(format!(".{file_name}{DIAGRAM_NOTES_SUFFIX}")))
}

fn is_diagram_notes_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with('.') && name.ends_with(DIAGRAM_NOTES_SUFFIX))
}

fn copy_diagram_notes(source: &Path, target: &Path) -> Result<(), DesignError> {
    let source_notes = diagram_notes_path(source)?;
    let target_notes = diagram_notes_path(target)?;
    if target_notes.exists() {
        fs::remove_file(&target_notes)?;
    }
    if source_notes.exists() {
        fs::copy(source_notes, target_notes)?;
    }
    Ok(())
}

fn move_diagram_notes(source: &Path, target: &Path) -> Result<(), DesignError> {
    let source_notes = diagram_notes_path(source)?;
    let target_notes = diagram_notes_path(target)?;
    if target_notes.exists() {
        fs::remove_file(&target_notes)?;
    }
    if source_notes.exists() {
        fs::rename(source_notes, target_notes)?;
    }
    Ok(())
}

fn project_summary(path: &Path) -> Result<ProjectSummary, DesignError> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| DesignError::InvalidName(path.display().to_string()))?
        .to_string();
    let design_count = fs::read_dir(path)?
        .filter_map(Result::ok)
        .filter(|entry| is_design_file(&entry.path()))
        .count();
    let metadata = read_project_metadata(path)?;

    Ok(ProjectSummary {
        name,
        design_count,
        visible_in_presentation_mode: metadata.visible_in_presentation_mode,
    })
}

fn validate_scene(value: &Value) -> Result<(), DesignError> {
    if !value.is_object() {
        return Err(DesignError::InvalidDesignFile(
            "scene must be a JSON object".to_string(),
        ));
    }

    if value.get("type").and_then(Value::as_str) != Some("excalidraw") {
        return Err(DesignError::InvalidDesignFile(
            "missing type=excalidraw".to_string(),
        ));
    }

    if !value.get("elements").is_some_and(Value::is_array) {
        return Err(DesignError::InvalidDesignFile(
            "missing elements array".to_string(),
        ));
    }

    if !value.get("appState").is_some_and(Value::is_object) {
        return Err(DesignError::InvalidDesignFile(
            "missing appState object".to_string(),
        ));
    }

    if !value.get("files").is_some_and(Value::is_object) {
        return Err(DesignError::InvalidDesignFile(
            "missing files object".to_string(),
        ));
    }

    Ok(())
}

fn validate_mermaid(value: &Value) -> Result<(), DesignError> {
    match value.get("source").and_then(Value::as_str) {
        Some(source) if source.trim_start().starts_with("flowchart ") => Ok(()),
        Some(_) => Err(DesignError::InvalidDesignFile(
            "mermaid source must start with a flowchart declaration".to_string(),
        )),
        None => Err(DesignError::InvalidDesignFile(
            "missing mermaid source".to_string(),
        )),
    }
}

fn validate_note(value: &Value) -> Result<(), DesignError> {
    if !value.is_object() {
        return Err(DesignError::InvalidDesignFile(
            "note must be a JSON object".to_string(),
        ));
    }

    if value.get("type").and_then(Value::as_str) != Some("banguesesdraw-note") {
        return Err(DesignError::InvalidDesignFile(
            "missing type=banguesesdraw-note".to_string(),
        ));
    }

    let content = value
        .get("content")
        .ok_or_else(|| DesignError::InvalidDesignFile("missing note content".to_string()))?;

    if !content.is_object() || content.get("type").and_then(Value::as_str) != Some("doc") {
        return Err(DesignError::InvalidDesignFile(
            "note content must be a TipTap document".to_string(),
        ));
    }

    Ok(())
}

fn validate_content(kind: &DesignKind, value: &Value) -> Result<(), DesignError> {
    match kind {
        DesignKind::Excalidraw => validate_scene(value),
        DesignKind::Mermaid => validate_mermaid(value),
        DesignKind::Note => validate_note(value),
    }
}

pub fn list_projects(root: &Path) -> Result<Vec<ProjectSummary>, DesignError> {
    ensure_root(root)?;
    let mut projects = fs::read_dir(root)?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .map(|entry| project_summary(&entry.path()))
        .collect::<Result<Vec<_>, _>>()?;
    projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(projects)
}

pub fn create_project(root: &Path, name: &str) -> Result<ProjectSummary, DesignError> {
    ensure_root(root)?;
    let path = project_path(root, name)?;
    if path.exists() {
        return Err(DesignError::AlreadyExists(name.to_string()));
    }

    fs::create_dir(&path)?;
    write_project_metadata(&path, &ProjectMetadata::default())?;
    project_summary(&path)
}

pub fn rename_project(
    root: &Path,
    old_name: &str,
    new_name: &str,
) -> Result<ProjectSummary, DesignError> {
    let old_path = project_path(root, old_name)?;
    let new_path = project_path(root, new_name)?;
    if !old_path.exists() {
        return Err(DesignError::NotFound(old_name.to_string()));
    }
    if new_path.exists() {
        return Err(DesignError::AlreadyExists(new_name.to_string()));
    }

    fs::rename(old_path, &new_path)?;
    project_summary(&new_path)
}

pub fn delete_project(root: &Path, name: &str) -> Result<(), DesignError> {
    let path = project_path(root, name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(name.to_string()));
    }

    fs::remove_dir_all(path)?;
    Ok(())
}

pub fn set_project_visibility(
    root: &Path,
    name: &str,
    visible_in_presentation_mode: bool,
) -> Result<ProjectSummary, DesignError> {
    let path = project_path(root, name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(name.to_string()));
    }

    write_project_metadata(
        &path,
        &ProjectMetadata {
            visible_in_presentation_mode,
        },
    )?;
    project_summary(&path)
}

pub fn backup_library(root: &Path, target: &Path) -> Result<BackupResult, DesignError> {
    ensure_root(root)?;

    if target.starts_with(root) {
        return Err(DesignError::InvalidBackupTarget(
            "Choose a backup folder outside the live design library.".to_string(),
        ));
    }

    fs::create_dir_all(target)?;

    let mut project_count = 0;
    let mut file_count = 0;

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let source_project = entry.path();
        let target_project = target.join(entry.file_name());
        fs::create_dir_all(&target_project)?;
        project_count += 1;

        for project_entry in fs::read_dir(source_project)? {
            let project_entry = project_entry?;
            if !project_entry.file_type()?.is_file() {
                continue;
            }

            let source_path = project_entry.path();
            let file_name = project_entry.file_name();
            let file_name_text = file_name.to_string_lossy();
            let is_metadata = file_name_text == PROJECT_METADATA_FILE
                || file_name_text == LEGACY_PROJECT_METADATA_FILE;
            if is_metadata || is_design_file(&source_path) || is_diagram_notes_file(&source_path) {
                fs::copy(&source_path, target_project.join(file_name))?;
                file_count += 1;
            }
        }
    }

    Ok(BackupResult {
        project_count,
        file_count,
    })
}

fn read_design_content(path: &Path, kind: &DesignKind) -> Result<Value, DesignError> {
    let content = match kind {
        DesignKind::Excalidraw | DesignKind::Note => serde_json::from_str(&fs::read_to_string(path)?)?,
        DesignKind::Mermaid => json!({ "source": fs::read_to_string(path)? }),
    };
    validate_content(kind, &content)?;
    Ok(content)
}

fn read_backup_project_metadata(project_path: &Path) -> Result<ProjectMetadata, DesignError> {
    for path in [
        project_path.join(PROJECT_METADATA_FILE),
        project_path.join(LEGACY_PROJECT_METADATA_FILE),
    ] {
        if path.exists() {
            return Ok(serde_json::from_str(&fs::read_to_string(path)?)?);
        }
    }
    Ok(ProjectMetadata::default())
}

/// Lists valid backup artifacts without changing the live library.
pub fn scan_backup(root: &Path, source: &Path) -> Result<RestorePreview, DesignError> {
    ensure_root(root)?;
    if !source.is_dir() || source.starts_with(root) {
        return Err(DesignError::InvalidBackupTarget("Choose a backup folder outside the live design library.".to_string()));
    }

    let mut artifacts = Vec::new();
    let mut invalid_file_count = 0;
    for project_entry in fs::read_dir(source)? {
        let project_entry = project_entry?;
        if !project_entry.file_type()?.is_dir() { continue; }
        let project = match project_entry.file_name().into_string().ok().and_then(|name| validate_name(&name).ok()) {
            Some(name) => name,
            None => { invalid_file_count += 1; continue; }
        };
        for file_entry in fs::read_dir(project_entry.path())? {
            let file_entry = file_entry?;
            if !file_entry.file_type()?.is_file() { continue; }
            let path = file_entry.path();
            let Some(kind) = kind_from_path(&path) else { continue; };
            let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else { invalid_file_count += 1; continue; };
            if design_file_name(file_name).is_err() || read_design_content(&path, &kind).is_err() {
                invalid_file_count += 1;
                continue;
            }
            artifacts.push(RestoreArtifactPreview {
                conflicts_with_existing: root.join(&project).join(file_name).exists(),
                project: project.clone(), file_name: file_name.to_string(), kind,
            });
        }
    }
    artifacts.sort_by(|a, b| (a.project.to_lowercase(), a.file_name.to_lowercase()).cmp(&(b.project.to_lowercase(), b.file_name.to_lowercase())));
    Ok(RestorePreview { artifacts, invalid_file_count })
}

/// Restores only explicitly selected, previously previewed backup artifacts.
pub fn restore_backup(root: &Path, source: &Path, artifacts: &[RestoreArtifact]) -> Result<RestoreResult, DesignError> {
    let preview = scan_backup(root, source)?;
    let valid = preview.artifacts.into_iter().map(|item| ((item.project.clone(), item.file_name.clone()), item)).collect::<std::collections::HashMap<_, _>>();
    let mut result = RestoreResult { added_count: 0, copied_count: 0, replaced_count: 0, skipped_count: 0, invalid_file_count: preview.invalid_file_count };
    for item in artifacts {
        let key = (item.project.clone(), item.file_name.clone());
        let Some(preview_item) = valid.get(&key) else { result.skipped_count += 1; continue; };
        let source_file = source.join(&item.project).join(&item.file_name);
        let content = read_design_content(&source_file, &preview_item.kind)?;
        let project_dir = root.join(&item.project);
        let new_project = !project_dir.exists();
        fs::create_dir_all(&project_dir)?;
        if new_project {
            let metadata = read_backup_project_metadata(&source.join(&item.project))?;
            write_project_metadata(&project_dir, &metadata)?;
        }
        let existing = project_dir.join(&item.file_name).exists();
        if existing && matches!(item.conflict_resolution, RestoreConflictResolution::Skip) { result.skipped_count += 1; continue; }
        let target = if existing && matches!(item.conflict_resolution, RestoreConflictResolution::Copy) {
            unique_design_path(root, &item.project, &design_name_from_file(&item.file_name), &preview_item.kind)?
        } else { project_dir.join(&item.file_name) };
        let tmp = target.with_extension(format!("{}.restore-tmp", extension_for_kind(&preview_item.kind)));
        match preview_item.kind { DesignKind::Mermaid => fs::write(&tmp, content["source"].as_str().unwrap_or_default())?, _ => fs::write(&tmp, serde_json::to_string_pretty(&content)?)? }
        fs::rename(tmp, &target)?;
        copy_diagram_notes(&source_file, &target)?;
        if existing { if matches!(item.conflict_resolution, RestoreConflictResolution::Replace) { result.replaced_count += 1; } else { result.copied_count += 1; } } else { result.added_count += 1; }
    }
    Ok(result)
}

pub fn duplicate_project(
    root: &Path,
    source_name: &str,
    target_name: &str,
) -> Result<ProjectSummary, DesignError> {
    let source = project_path(root, source_name)?;
    let target = project_path(root, target_name)?;
    if !source.exists() {
        return Err(DesignError::NotFound(source_name.to_string()));
    }
    if target.exists() {
        return Err(DesignError::AlreadyExists(target_name.to_string()));
    }

    fs::create_dir(&target)?;
    let metadata = read_project_metadata(&source)?;
    write_project_metadata(&target, &metadata)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        if entry.file_type()?.is_file()
            && (is_design_file(&entry.path()) || is_diagram_notes_file(&entry.path()))
        {
            fs::copy(entry.path(), target.join(entry.file_name()))?;
        }
    }

    project_summary(&target)
}

pub fn list_designs(root: &Path, project: &str) -> Result<Vec<DesignSummary>, DesignError> {
    let project_dir = project_path(root, project)?;
    if !project_dir.exists() {
        return Err(DesignError::NotFound(project.to_string()));
    }

    let mut designs = fs::read_dir(&project_dir)?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_file())
        .filter(|entry| is_design_file(&entry.path()))
        .map(|entry| {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let kind = kind_from_path(&entry.path()).ok_or_else(|| {
                DesignError::InvalidDesignFile(entry.path().display().to_string())
            })?;
            Ok(DesignSummary {
                project: project.to_string(),
                name: design_name_from_file(&file_name),
                file_name,
                kind,
                updated_at_ms: modified_ms(&entry.path()),
            })
        })
        .collect::<Result<Vec<_>, DesignError>>()?;
    designs.sort_by(|a, b| b.updated_at_ms.cmp(&a.updated_at_ms));
    Ok(designs)
}

pub fn create_design(
    root: &Path,
    project: &str,
    name: &str,
    kind: DesignKind,
) -> Result<DesignScene, DesignError> {
    let path = design_path_for_kind(root, project, name, &kind)?;
    if path.exists() {
        return Err(DesignError::AlreadyExists(name.to_string()));
    }

    let content = match kind {
        DesignKind::Excalidraw => empty_scene(),
        DesignKind::Mermaid => empty_mermaid_source(),
        DesignKind::Note => empty_note(),
    };
    write_design(
        root,
        project,
        path.file_name().unwrap().to_string_lossy().as_ref(),
        &content,
    )
}

pub fn read_design(
    root: &Path,
    project: &str,
    file_name: &str,
) -> Result<DesignScene, DesignError> {
    let path = design_path(root, project, file_name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(file_name.to_string()));
    }

    let kind = kind_from_path(&path)
        .ok_or_else(|| DesignError::InvalidDesignFile(file_name.to_string()))?;
    let content = match kind {
        DesignKind::Excalidraw => {
            let content: Value = serde_json::from_str(&fs::read_to_string(&path)?)?;
            validate_scene(&content)?;
            content
        }
        DesignKind::Mermaid => {
            let content = json!({ "source": fs::read_to_string(&path)? });
            validate_mermaid(&content)?;
            content
        }
        DesignKind::Note => {
            let content: Value = serde_json::from_str(&fs::read_to_string(&path)?)?;
            validate_note(&content)?;
            content
        }
    };
    let file_name = path.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignScene {
        project: project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        content,
    })
}

pub fn write_design(
    root: &Path,
    project: &str,
    file_name: &str,
    content: &Value,
) -> Result<DesignScene, DesignError> {
    let path = design_path(root, project, file_name)?;
    let kind = kind_from_path(&path)
        .ok_or_else(|| DesignError::InvalidDesignFile(file_name.to_string()))?;
    validate_content(&kind, content)?;
    let parent = path
        .parent()
        .ok_or_else(|| DesignError::InvalidName(file_name.to_string()))?;
    if !parent.exists() {
        return Err(DesignError::NotFound(project.to_string()));
    }

    let tmp_path = path.with_extension(format!("{}.tmp", extension_for_kind(&kind)));
    match kind {
        DesignKind::Excalidraw | DesignKind::Note => {
            fs::write(&tmp_path, serde_json::to_string_pretty(content)?)?
        }
        DesignKind::Mermaid => {
            let source = content
                .get("source")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    DesignError::InvalidDesignFile("missing mermaid source".to_string())
                })?;
            fs::write(&tmp_path, source)?;
        }
    }
    fs::rename(&tmp_path, &path)?;
    read_design(
        root,
        project,
        path.file_name().unwrap().to_string_lossy().as_ref(),
    )
}

pub fn read_diagram_notes(
    root: &Path,
    project: &str,
    file_name: &str,
) -> Result<DiagramNotes, DesignError> {
    let path = design_path(root, project, file_name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(file_name.to_string()));
    }

    let notes_path = diagram_notes_path(&path)?;
    if !notes_path.exists() {
        return Ok(DiagramNotes::default());
    }

    Ok(serde_json::from_str(&fs::read_to_string(notes_path)?)?)
}

pub fn write_diagram_notes(
    root: &Path,
    project: &str,
    file_name: &str,
    text: &str,
) -> Result<DiagramNotes, DesignError> {
    let path = design_path(root, project, file_name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(file_name.to_string()));
    }

    let notes = DiagramNotes { text: text.to_string() };
    let notes_path = diagram_notes_path(&path)?;
    let tmp_path = notes_path.with_extension("json.tmp");
    fs::write(&tmp_path, serde_json::to_string_pretty(&notes)?)?;
    fs::rename(tmp_path, notes_path)?;
    Ok(notes)
}

pub fn rename_design(
    root: &Path,
    project: &str,
    old_file_name: &str,
    new_name: &str,
) -> Result<DesignSummary, DesignError> {
    let old_path = design_path(root, project, old_file_name)?;
    let kind = kind_from_path(&old_path)
        .ok_or_else(|| DesignError::InvalidDesignFile(old_file_name.to_string()))?;
    let new_path = design_path_for_kind(root, project, new_name, &kind)?;
    if !old_path.exists() {
        return Err(DesignError::NotFound(old_file_name.to_string()));
    }
    if new_path.exists() {
        return Err(DesignError::AlreadyExists(new_name.to_string()));
    }

    fs::rename(&old_path, &new_path)?;
    move_diagram_notes(&old_path, &new_path)?;
    let file_name = new_path.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignSummary {
        project: project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        updated_at_ms: modified_ms(&new_path),
    })
}

pub fn duplicate_design(
    root: &Path,
    project: &str,
    source_file_name: &str,
    target_name: &str,
) -> Result<DesignSummary, DesignError> {
    let source = design_path(root, project, source_file_name)?;
    let kind = kind_from_path(&source)
        .ok_or_else(|| DesignError::InvalidDesignFile(source_file_name.to_string()))?;
    let target = design_path_for_kind(root, project, target_name, &kind)?;
    if !source.exists() {
        return Err(DesignError::NotFound(source_file_name.to_string()));
    }
    if target.exists() {
        return Err(DesignError::AlreadyExists(target_name.to_string()));
    }

    fs::copy(&source, &target)?;
    copy_diagram_notes(&source, &target)?;
    let file_name = target.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignSummary {
        project: project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        updated_at_ms: modified_ms(&target),
    })
}

pub fn copy_design(
    root: &Path,
    source_project: &str,
    source_file_name: &str,
    target_project: &str,
    target_name: &str,
) -> Result<DesignSummary, DesignError> {
    let source = design_path(root, source_project, source_file_name)?;
    let kind = kind_from_path(&source)
        .ok_or_else(|| DesignError::InvalidDesignFile(source_file_name.to_string()))?;
    let target = design_path_for_kind(root, target_project, target_name, &kind)?;
    if !project_path(root, target_project)?.exists() {
        return Err(DesignError::NotFound(target_project.to_string()));
    }
    if !source.exists() {
        return Err(DesignError::NotFound(source_file_name.to_string()));
    }
    if target.exists() {
        return Err(DesignError::AlreadyExists(target_name.to_string()));
    }

    fs::copy(&source, &target)?;
    copy_diagram_notes(&source, &target)?;
    let file_name = target.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignSummary {
        project: target_project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        updated_at_ms: modified_ms(&target),
    })
}

pub fn move_design(
    root: &Path,
    source_project: &str,
    source_file_name: &str,
    target_project: &str,
    target_name: &str,
) -> Result<DesignSummary, DesignError> {
    let source = design_path(root, source_project, source_file_name)?;
    let kind = kind_from_path(&source)
        .ok_or_else(|| DesignError::InvalidDesignFile(source_file_name.to_string()))?;
    let target = design_path_for_kind(root, target_project, target_name, &kind)?;
    if !project_path(root, target_project)?.exists() {
        return Err(DesignError::NotFound(target_project.to_string()));
    }
    if !source.exists() {
        return Err(DesignError::NotFound(source_file_name.to_string()));
    }
    if target.exists() {
        return Err(DesignError::AlreadyExists(target_name.to_string()));
    }

    fs::rename(&source, &target)?;
    move_diagram_notes(&source, &target)?;
    let file_name = target.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignSummary {
        project: target_project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        updated_at_ms: modified_ms(&target),
    })
}

pub fn import_design(
    root: &Path,
    project: &str,
    source_path: &Path,
) -> Result<DesignSummary, DesignError> {
    if !source_path.is_file() {
        return Err(DesignError::NotFound(source_path.display().to_string()));
    }

    let kind = kind_from_path(source_path)
        .ok_or_else(|| DesignError::InvalidDesignFile(source_path.display().to_string()))?;
    let content = match kind {
        DesignKind::Excalidraw => {
            let content: Value = serde_json::from_str(&fs::read_to_string(source_path)?)?;
            validate_scene(&content)?;
            content
        }
        DesignKind::Mermaid => {
            let content = json!({ "source": fs::read_to_string(source_path)? });
            validate_mermaid(&content)?;
            content
        }
        DesignKind::Note => {
            let content: Value = serde_json::from_str(&fs::read_to_string(source_path)?)?;
            validate_note(&content)?;
            content
        }
    };

    let preferred_name = design_name_from_path(source_path)?;
    let target = unique_design_path(root, project, &preferred_name, &kind)?;
    match kind {
        DesignKind::Excalidraw | DesignKind::Note => {
            fs::write(&target, serde_json::to_string_pretty(&content)?)?
        }
        DesignKind::Mermaid => {
            let source = content
                .get("source")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    DesignError::InvalidDesignFile("missing mermaid source".to_string())
                })?;
            fs::write(&target, source)?;
        }
    }

    let file_name = target.file_name().unwrap().to_string_lossy().to_string();
    Ok(DesignSummary {
        project: project.to_string(),
        name: design_name_from_file(&file_name),
        file_name,
        kind,
        updated_at_ms: modified_ms(&target),
    })
}

pub fn export_design(
    root: &Path,
    project: &str,
    file_name: &str,
    target_path: &Path,
) -> Result<(), DesignError> {
    let source = design_path(root, project, file_name)?;
    if !source.exists() {
        return Err(DesignError::NotFound(file_name.to_string()));
    }

    let kind = kind_from_path(&source)
        .ok_or_else(|| DesignError::InvalidDesignFile(file_name.to_string()))?;
    let content = match kind {
        DesignKind::Excalidraw => {
            let content: Value = serde_json::from_str(&fs::read_to_string(&source)?)?;
            validate_scene(&content)?;
            content
        }
        DesignKind::Mermaid => {
            let content = json!({ "source": fs::read_to_string(&source)? });
            validate_mermaid(&content)?;
            content
        }
        DesignKind::Note => {
            let content: Value = serde_json::from_str(&fs::read_to_string(&source)?)?;
            validate_note(&content)?;
            content
        }
    };

    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            return Err(DesignError::NotFound(parent.display().to_string()));
        }
    }

    match kind {
        DesignKind::Excalidraw | DesignKind::Note => {
            fs::write(target_path, serde_json::to_string_pretty(&content)?)?
        }
        DesignKind::Mermaid => {
            let source = content
                .get("source")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    DesignError::InvalidDesignFile("missing mermaid source".to_string())
                })?;
            fs::write(target_path, source)?;
        }
    }
    Ok(())
}

pub fn export_drawio(target_path: &Path, content: &str) -> Result<(), DesignError> {
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            return Err(DesignError::NotFound(parent.display().to_string()));
        }
    }

    fs::write(target_path, content)?;
    Ok(())
}

pub fn delete_design(root: &Path, project: &str, file_name: &str) -> Result<(), DesignError> {
    let path = design_path(root, project, file_name)?;
    if !path.exists() {
        return Err(DesignError::NotFound(file_name.to_string()));
    }

    let notes_path = diagram_notes_path(&path)?;
    fs::remove_file(path)?;
    if notes_path.exists() {
        fs::remove_file(notes_path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(label: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("banguesesdraw-{label}-{stamp}"))
    }

    #[test]
    fn creates_and_lists_projects() {
        let root = test_root("projects");
        let project = create_project(&root, "Client Sketches").unwrap();
        assert_eq!(project.name, "Client Sketches");
        assert_eq!(project.design_count, 0);

        let projects = list_projects(&root).unwrap();
        assert_eq!(projects, vec![project]);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_path_traversal_names() {
        let root = test_root("traversal");
        let err = create_project(&root, "../bad").unwrap_err();
        assert!(matches!(err, DesignError::InvalidName(_)));
    }

    #[test]
    fn refuses_project_name_conflicts() {
        let root = test_root("conflict");
        create_project(&root, "Plans").unwrap();
        let err = create_project(&root, "Plans").unwrap_err();
        assert!(matches!(err, DesignError::AlreadyExists(_)));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stores_project_presentation_visibility() {
        let root = test_root("project-presentation-visibility");
        let project = create_project(&root, "Reference").unwrap();

        assert!(!project.visible_in_presentation_mode);

        let updated = set_project_visibility(&root, "Reference", true).unwrap();
        assert!(updated.visible_in_presentation_mode);

        let projects = list_projects(&root).unwrap();
        assert_eq!(projects[0].name, "Reference");
        assert!(projects[0].visible_in_presentation_mode);

        let duplicated = duplicate_project(&root, "Reference", "Reference Copy").unwrap();
        assert!(duplicated.visible_in_presentation_mode);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migrates_legacy_project_metadata_filename() {
        let root = test_root("legacy-project-metadata");
        let project_path = root.join("Reference");
        fs::create_dir_all(&project_path).unwrap();
        fs::write(
            project_path.join(".banguesesdraw-project.json"),
            r#"{"visibleInPresentationMode":true}"#,
        )
        .unwrap();

        let projects = list_projects(&root).unwrap();

        assert_eq!(projects[0].name, "Reference");
        assert!(projects[0].visible_in_presentation_mode);
        assert!(project_path.join(".designbuddy-project.json").exists());
        assert!(!project_path.join(".banguesesdraw-project.json").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backs_up_design_library_to_a_selected_folder() {
        let root = test_root("backup-source");
        let backup_root = test_root("backup-target");
        create_project(&root, "Reference").unwrap();
        set_project_visibility(&root, "Reference", true).unwrap();
        create_design(&root, "Reference", "Flow", DesignKind::Excalidraw).unwrap();
        create_design(&root, "Reference", "Routing", DesignKind::Mermaid).unwrap();
        fs::write(root.join("Reference").join("notes.md"), "# local notes\n").unwrap();

        let result = backup_library(&root, &backup_root).unwrap();

        assert_eq!(result.project_count, 1);
        assert_eq!(result.file_count, 3);
        assert!(backup_root
            .join("Reference")
            .join("Flow.excalidraw")
            .exists());
        assert!(backup_root.join("Reference").join("Routing.mmd").exists());
        assert!(backup_root
            .join("Reference")
            .join(PROJECT_METADATA_FILE)
            .exists());
        assert!(!backup_root.join("Reference").join("notes.md").exists());

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(backup_root).unwrap();
    }

    #[test]
    fn previews_and_restores_only_selected_backup_files_without_overwriting_by_default() {
        let root = test_root("restore-live");
        let backup_root = test_root("restore-backup");
        create_project(&root, "App").unwrap();
        create_design(&root, "App", "Flow", DesignKind::Excalidraw).unwrap();

        fs::create_dir_all(backup_root.join("App")).unwrap();
        let restored_scene = json!({
            "type": "excalidraw", "version": 2, "source": "test",
            "elements": [{"id": "backup", "type": "ellipse"}], "appState": {}, "files": {}
        });
        fs::write(
            backup_root.join("App").join("Flow.excalidraw"),
            serde_json::to_string(&restored_scene).unwrap(),
        ).unwrap();
        fs::write(
            backup_root
                .join("App")
                .join(".Flow.excalidraw.designbuddy-notes.json"),
            r#"{"text":"Restored context."}"#,
        )
        .unwrap();
        fs::write(backup_root.join("App").join("New.mmd"), "flowchart LR\n  A --> B\n").unwrap();
        fs::write(backup_root.join("App").join("Broken.excalidraw"), "{}").unwrap();

        let preview = scan_backup(&root, &backup_root).unwrap();
        assert_eq!(preview.artifacts.len(), 2);
        assert_eq!(preview.invalid_file_count, 1);
        assert!(preview.artifacts.iter().any(|item| item.file_name == "Flow.excalidraw" && item.conflicts_with_existing));

        let result = restore_backup(&root, &backup_root, &[
            RestoreArtifact { project: "App".to_string(), file_name: "Flow.excalidraw".to_string(), conflict_resolution: RestoreConflictResolution::Copy },
            RestoreArtifact { project: "App".to_string(), file_name: "New.mmd".to_string(), conflict_resolution: RestoreConflictResolution::Copy },
        ]).unwrap();
        assert_eq!(result.copied_count, 1);
        assert_eq!(result.added_count, 1);
        assert_eq!(read_design(&root, "App", "Flow Copy.excalidraw").unwrap().content["elements"][0]["id"], "backup");
        assert_eq!(
            read_diagram_notes(&root, "App", "Flow Copy.excalidraw")
                .unwrap()
                .text,
            "Restored context.",
        );
        assert!(root.join("App").join("New.mmd").exists());

        let replaced = restore_backup(&root, &backup_root, &[
            RestoreArtifact { project: "App".to_string(), file_name: "Flow.excalidraw".to_string(), conflict_resolution: RestoreConflictResolution::Replace },
        ]).unwrap();
        assert_eq!(replaced.replaced_count, 1);
        assert_eq!(read_design(&root, "App", "Flow.excalidraw").unwrap().content["elements"][0]["id"], "backup");
        assert_eq!(
            read_diagram_notes(&root, "App", "Flow.excalidraw")
                .unwrap()
                .text,
            "Restored context.",
        );

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(backup_root).unwrap();
    }

    #[test]
    fn rejects_backup_targets_inside_the_live_library() {
        let root = test_root("backup-target-validation");
        create_project(&root, "Reference").unwrap();

        let err = backup_library(&root, &root.join("Backup")).unwrap_err();

        assert!(matches!(err, DesignError::InvalidBackupTarget(_)));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renames_duplicates_and_deletes_projects() {
        let root = test_root("project-lifecycle");
        create_project(&root, "Original").unwrap();
        create_design(&root, "Original", "Home", DesignKind::Excalidraw).unwrap();

        let duplicated = duplicate_project(&root, "Original", "Original Copy").unwrap();
        assert_eq!(duplicated.name, "Original Copy");
        assert_eq!(duplicated.design_count, 1);
        assert!(root.join("Original Copy").join("Home.excalidraw").exists());

        let renamed = rename_project(&root, "Original Copy", "Archive").unwrap();
        assert_eq!(renamed.name, "Archive");
        assert_eq!(renamed.design_count, 1);
        assert!(!root.join("Original Copy").exists());
        assert!(root.join("Archive").exists());

        delete_project(&root, "Archive").unwrap();
        let projects = list_projects(&root).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "Original");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_reads_writes_and_lists_designs() {
        let root = test_root("designs");
        create_project(&root, "App").unwrap();
        let created = create_design(&root, "App", "First Flow", DesignKind::Excalidraw).unwrap();
        assert_eq!(created.file_name, "First Flow.excalidraw");
        assert_eq!(created.kind, DesignKind::Excalidraw);
        assert_eq!(created.content["type"], "excalidraw");

        let updated = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [{"id": "box-1", "type": "rectangle"}],
            "appState": {},
            "files": {}
        });
        write_design(&root, "App", "First Flow.excalidraw", &updated).unwrap();

        let read = read_design(&root, "App", "First Flow.excalidraw").unwrap();
        assert_eq!(read.content["elements"][0]["id"], "box-1");

        let designs = list_designs(&root, "App").unwrap();
        assert_eq!(designs.len(), 1);
        assert_eq!(designs[0].name, "First Flow");
        assert_eq!(designs[0].kind, DesignKind::Excalidraw);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lists_excalidraw_and_mermaid_designs() {
        let root = test_root("mixed-designs");
        create_project(&root, "Architecture").unwrap();
        create_design(&root, "Architecture", "Canvas", DesignKind::Excalidraw).unwrap();
        create_design(&root, "Architecture", "Flow", DesignKind::Mermaid).unwrap();

        let designs = list_designs(&root, "Architecture").unwrap();
        let kinds = designs
            .iter()
            .map(|design| (design.file_name.as_str(), design.kind.clone()))
            .collect::<Vec<_>>();

        assert!(kinds.contains(&("Canvas.excalidraw", DesignKind::Excalidraw)));
        assert!(kinds.contains(&("Flow.mmd", DesignKind::Mermaid)));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_and_writes_mermaid_source() {
        let root = test_root("mermaid-read-write");
        create_project(&root, "Architecture").unwrap();
        let design = create_design(&root, "Architecture", "Routing", DesignKind::Mermaid).unwrap();

        assert_eq!(design.kind, DesignKind::Mermaid);
        assert_eq!(design.content, json!({ "source": "flowchart LR\n" }));

        let updated = write_design(
            &root,
            "Architecture",
            "Routing.mmd",
            &json!({ "source": "flowchart LR\n  A[Start] --> B[Done]\n" }),
        )
        .unwrap();

        assert_eq!(updated.kind, DesignKind::Mermaid);
        assert_eq!(
            updated.content,
            json!({ "source": "flowchart LR\n  A[Start] --> B[Done]\n" })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_and_writes_rich_text_notes() {
        let root = test_root("note-read-write");
        create_project(&root, "Discovery").unwrap();
        let design = create_design(&root, "Discovery", "Meeting notes", DesignKind::Note).unwrap();

        assert_eq!(design.kind, DesignKind::Note);
        assert_eq!(design.file_name, "Meeting notes.bdnote");
        assert_eq!(design.content["type"], "banguesesdraw-note");

        let updated = json!({
            "type": "banguesesdraw-note",
            "version": 1,
            "content": {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": "Bold idea",
                                "marks": [{ "type": "bold" }]
                            }
                        ]
                    }
                ]
            }
        });
        write_design(&root, "Discovery", "Meeting notes.bdnote", &updated).unwrap();

        let read = read_design(&root, "Discovery", "Meeting notes.bdnote").unwrap();
        assert_eq!(read.content, updated);

        let designs = list_designs(&root, "Discovery").unwrap();
        assert_eq!(designs.len(), 1);
        assert_eq!(designs[0].kind, DesignKind::Note);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_and_exports_mermaid_source() {
        let root = test_root("mermaid-import-export");
        create_project(&root, "Architecture").unwrap();
        let external = root.join("external.mmd");
        let exported = root.join("exported.mmd");
        fs::write(&external, "flowchart TD\n  A[Start] --> B[Done]\n").unwrap();

        let imported = import_design(&root, "Architecture", &external).unwrap();
        assert_eq!(imported.kind, DesignKind::Mermaid);
        assert_eq!(imported.file_name, "external.mmd");

        export_design(&root, "Architecture", "external.mmd", &exported).unwrap();
        assert_eq!(
            fs::read_to_string(&exported).unwrap(),
            "flowchart TD\n  A[Start] --> B[Done]\n"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn ignores_markdown_files_in_project_directories() {
        let root = test_root("ignore-markdown");
        create_project(&root, "Discovery").unwrap();
        create_design(&root, "Discovery", "Sketch", DesignKind::Excalidraw).unwrap();
        fs::write(root.join("Discovery").join("notes.md"), "# Local notes\n").unwrap();

        let designs = list_designs(&root, "Discovery").unwrap();

        assert_eq!(designs.len(), 1);
        assert_eq!(designs[0].file_name, "Sketch.excalidraw");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_design_name_conflicts() {
        let root = test_root("design-conflicts");
        create_project(&root, "Ideas").unwrap();
        create_design(&root, "Ideas", "Sketch", DesignKind::Excalidraw).unwrap();
        create_design(&root, "Ideas", "Other", DesignKind::Excalidraw).unwrap();

        let rename_err = rename_design(&root, "Ideas", "Sketch.excalidraw", "Other").unwrap_err();
        assert!(matches!(rename_err, DesignError::AlreadyExists(_)));

        let duplicate_err =
            duplicate_design(&root, "Ideas", "Sketch.excalidraw", "Other").unwrap_err();
        assert!(matches!(duplicate_err, DesignError::AlreadyExists(_)));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_invalid_scenes_on_write_and_read() {
        let root = test_root("invalid-scene");
        create_project(&root, "App").unwrap();

        let missing_app_state = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [],
            "files": {}
        });
        let write_err =
            write_design(&root, "App", "Broken.excalidraw", &missing_app_state).unwrap_err();
        assert!(matches!(write_err, DesignError::InvalidDesignFile(_)));

        let invalid_on_disk = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [],
            "appState": [],
            "files": {}
        });
        fs::write(
            root.join("App").join("Broken.excalidraw"),
            serde_json::to_string_pretty(&invalid_on_disk).unwrap(),
        )
        .unwrap();

        let read_err = read_design(&root, "App", "Broken.excalidraw").unwrap_err();
        assert!(matches!(read_err, DesignError::InvalidDesignFile(_)));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn write_design_replaces_content_and_removes_temp_file() {
        let root = test_root("write-replace");
        create_project(&root, "App").unwrap();
        create_design(&root, "App", "Flow", DesignKind::Excalidraw).unwrap();

        let first = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [{"id": "first", "type": "rectangle"}],
            "appState": {},
            "files": {}
        });
        write_design(&root, "App", "Flow.excalidraw", &first).unwrap();

        let second = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [{"id": "second", "type": "ellipse"}],
            "appState": {},
            "files": {}
        });
        let written = write_design(&root, "App", "Flow.excalidraw", &second).unwrap();
        assert_eq!(written.content["elements"][0]["id"], "second");
        assert!(!root.join("App").join("Flow.excalidraw.tmp").exists());

        let raw = fs::read_to_string(root.join("App").join("Flow.excalidraw")).unwrap();
        assert!(raw.contains("\"second\""));
        assert!(!raw.contains("\"first\""));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn duplicate_project_ignores_non_scene_files() {
        let root = test_root("duplicate-project-filter");
        create_project(&root, "Source").unwrap();
        create_design(&root, "Source", "Scene", DesignKind::Excalidraw).unwrap();
        fs::write(root.join("Source").join("notes.txt"), "ignore me").unwrap();
        fs::write(root.join("Source").join("Scene.excalidraw.tmp"), "temp").unwrap();

        let duplicated = duplicate_project(&root, "Source", "Copy").unwrap();
        assert_eq!(duplicated.design_count, 1);
        assert!(root.join("Copy").join("Scene.excalidraw").exists());
        assert!(!root.join("Copy").join("notes.txt").exists());
        assert!(!root.join("Copy").join("Scene.excalidraw.tmp").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_duplicate_and_delete_designs_preserve_originals() {
        let root = test_root("rename-duplicate");
        create_project(&root, "Ideas").unwrap();
        create_project(&root, "Reference").unwrap();
        create_project(&root, "Archive").unwrap();
        create_design(&root, "Ideas", "Sketch", DesignKind::Excalidraw).unwrap();
        write_diagram_notes(&root, "Ideas", "Sketch.excalidraw", "Capture open questions.").unwrap();

        let renamed = rename_design(&root, "Ideas", "Sketch.excalidraw", "Sketch v2").unwrap();
        assert_eq!(renamed.file_name, "Sketch v2.excalidraw");
        assert_eq!(
            read_diagram_notes(&root, "Ideas", "Sketch v2.excalidraw").unwrap().text,
            "Capture open questions.",
        );
        assert!(!root
            .join("Ideas")
            .join(".Sketch.excalidraw.designbuddy-notes.json")
            .exists());

        let copied = copy_design(
            &root,
            "Ideas",
            "Sketch v2.excalidraw",
            "Reference",
            "Shared sketch",
        )
        .unwrap();
        assert_eq!(copied.project, "Reference");
        assert_eq!(
            read_diagram_notes(&root, "Reference", "Shared sketch.excalidraw")
                .unwrap()
                .text,
            "Capture open questions.",
        );

        let moved = move_design(
            &root,
            "Reference",
            "Shared sketch.excalidraw",
            "Archive",
            "Shared sketch",
        )
        .unwrap();
        assert_eq!(moved.project, "Archive");
        assert!(!root.join("Reference").join("Shared sketch.excalidraw").exists());
        assert!(!root
            .join("Reference")
            .join(".Shared sketch.excalidraw.designbuddy-notes.json")
            .exists());
        assert_eq!(
            read_diagram_notes(&root, "Archive", "Shared sketch.excalidraw")
                .unwrap()
                .text,
            "Capture open questions.",
        );

        let duplicated = duplicate_design(&root, "Ideas", "Sketch v2.excalidraw", "Copy").unwrap();
        assert_eq!(duplicated.file_name, "Copy.excalidraw");
        assert_eq!(
            read_diagram_notes(&root, "Ideas", "Copy.excalidraw").unwrap().text,
            "Capture open questions.",
        );

        delete_design(&root, "Ideas", "Copy.excalidraw").unwrap();
        assert!(!root
            .join("Ideas")
            .join(".Copy.excalidraw.designbuddy-notes.json")
            .exists());
        let designs = list_designs(&root, "Ideas").unwrap();
        assert_eq!(designs.len(), 1);
        assert_eq!(designs[0].file_name, "Sketch v2.excalidraw");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn exports_a_design_to_a_chosen_path() {
        let root = test_root("export");
        let target = root.join("Flow Export.excalidraw");
        create_project(&root, "App").unwrap();

        let scene = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [{"id": "box-1", "type": "rectangle"}],
            "appState": {},
            "files": {}
        });
        write_design(&root, "App", "Flow.excalidraw", &scene).unwrap();

        export_design(&root, "App", "Flow.excalidraw", &target).unwrap();

        let exported: Value = serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        assert_eq!(exported["elements"][0]["id"], "box-1");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn exports_drawio_content_to_a_chosen_path() {
        let root = test_root("export-drawio");
        fs::create_dir_all(&root).unwrap();
        let target = root.join("Flow.drawio");

        export_drawio(&target, "<mxfile></mxfile>").unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "<mxfile></mxfile>");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_a_design_into_the_selected_project_with_a_conflict_safe_name() {
        let root = test_root("import");
        let external_root = test_root("external-import");
        fs::create_dir_all(&external_root).unwrap();
        create_project(&root, "App").unwrap();
        create_design(&root, "App", "Flow", DesignKind::Excalidraw).unwrap();

        let source = external_root.join("Flow.excalidraw");
        let scene = json!({
            "type": "excalidraw",
            "version": 2,
            "source": "test",
            "elements": [{"id": "imported", "type": "ellipse"}],
            "appState": {},
            "files": {}
        });
        fs::write(&source, serde_json::to_string_pretty(&scene).unwrap()).unwrap();

        let imported = import_design(&root, "App", &source).unwrap();

        assert_eq!(imported.name, "Flow Copy");
        assert_eq!(imported.file_name, "Flow Copy.excalidraw");
        let read = read_design(&root, "App", &imported.file_name).unwrap();
        assert_eq!(read.content["elements"][0]["id"], "imported");

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(external_root).unwrap();
    }

    #[test]
    fn rejects_invalid_import_files() {
        let root = test_root("invalid-import");
        let external_root = test_root("invalid-external-import");
        fs::create_dir_all(&external_root).unwrap();
        create_project(&root, "App").unwrap();

        let source = external_root.join("Broken.excalidraw");
        fs::write(&source, "{\"type\":\"not-excalidraw\"}").unwrap();

        let err = import_design(&root, "App", &source).unwrap_err();
        assert!(matches!(err, DesignError::InvalidDesignFile(_)));

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(external_root).unwrap();
    }
}
