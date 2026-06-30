pub mod designs;

use designs::{DesignScene, DesignSummary, ProjectSummary};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn designs_root_from_documents(documents_dir: &Path) -> PathBuf {
    documents_dir.join("BanguesesDraw").join("Designs")
}

fn designs_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let documents_dir = app
        .path()
        .document_dir()
        .map_err(|error| format!("Could not find Documents directory: {error}"))?;

    Ok(designs_root_from_documents(&documents_dir))
}

#[tauri::command]
fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    designs::list_projects(&designs_root(&app)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_project(app: tauri::AppHandle, name: String) -> Result<ProjectSummary, String> {
    designs::create_project(&designs_root(&app)?, &name).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_project(
    app: tauri::AppHandle,
    old_name: String,
    new_name: String,
) -> Result<ProjectSummary, String> {
    designs::rename_project(&designs_root(&app)?, &old_name, &new_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn duplicate_project(
    app: tauri::AppHandle,
    source_name: String,
    target_name: String,
) -> Result<ProjectSummary, String> {
    designs::duplicate_project(&designs_root(&app)?, &source_name, &target_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_project(app: tauri::AppHandle, name: String) -> Result<(), String> {
    designs::delete_project(&designs_root(&app)?, &name).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_designs(app: tauri::AppHandle, project: String) -> Result<Vec<DesignSummary>, String> {
    designs::list_designs(&designs_root(&app)?, &project).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_design(
    app: tauri::AppHandle,
    project: String,
    name: String,
) -> Result<DesignScene, String> {
    designs::create_design(&designs_root(&app)?, &project, &name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn read_design(
    app: tauri::AppHandle,
    project: String,
    file_name: String,
) -> Result<DesignScene, String> {
    designs::read_design(&designs_root(&app)?, &project, &file_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn write_design(
    app: tauri::AppHandle,
    project: String,
    file_name: String,
    content: Value,
) -> Result<DesignScene, String> {
    designs::write_design(&designs_root(&app)?, &project, &file_name, &content)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_design(
    app: tauri::AppHandle,
    project: String,
    old_file_name: String,
    new_name: String,
) -> Result<DesignSummary, String> {
    designs::rename_design(&designs_root(&app)?, &project, &old_file_name, &new_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn duplicate_design(
    app: tauri::AppHandle,
    project: String,
    source_file_name: String,
    target_name: String,
) -> Result<DesignSummary, String> {
    designs::duplicate_design(&designs_root(&app)?, &project, &source_file_name, &target_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_design(app: tauri::AppHandle, project: String, file_name: String) -> Result<(), String> {
    designs::delete_design(&designs_root(&app)?, &project, &file_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn import_design(
    app: tauri::AppHandle,
    project: String,
    source_path: String,
) -> Result<DesignSummary, String> {
    designs::import_design(&designs_root(&app)?, &project, &PathBuf::from(source_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_design(
    app: tauri::AppHandle,
    project: String,
    file_name: String,
    target_path: String,
) -> Result<(), String> {
    designs::export_design(
        &designs_root(&app)?,
        &project,
        &file_name,
        &PathBuf::from(target_path),
    )
    .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            create_project,
            rename_project,
            duplicate_project,
            delete_project,
            list_designs,
            create_design,
            read_design,
            write_design,
            rename_design,
            duplicate_design,
            delete_design,
            import_design,
            export_design
        ])
        .run(tauri::generate_context!())
        .expect("error while running BanguesesDraw");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn stores_designs_under_the_current_users_documents_directory() {
        let documents_dir = Path::new("Documents");

        assert_eq!(
            designs_root_from_documents(documents_dir),
            PathBuf::from("Documents").join("BanguesesDraw").join("Designs"),
        );
    }
}
