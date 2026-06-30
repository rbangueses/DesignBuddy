pub mod designs;

use designs::{DesignScene, DesignSummary, ProjectSummary};
use serde_json::Value;
use std::path::PathBuf;

fn designs_root() -> PathBuf {
    PathBuf::from("/Users/rbangueses/Documents/BanguesesDraw/Designs")
}

#[tauri::command]
fn list_projects() -> Result<Vec<ProjectSummary>, String> {
    designs::list_projects(&designs_root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_project(name: String) -> Result<ProjectSummary, String> {
    designs::create_project(&designs_root(), &name).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_project(old_name: String, new_name: String) -> Result<ProjectSummary, String> {
    designs::rename_project(&designs_root(), &old_name, &new_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn duplicate_project(source_name: String, target_name: String) -> Result<ProjectSummary, String> {
    designs::duplicate_project(&designs_root(), &source_name, &target_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_project(name: String) -> Result<(), String> {
    designs::delete_project(&designs_root(), &name).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_designs(project: String) -> Result<Vec<DesignSummary>, String> {
    designs::list_designs(&designs_root(), &project).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_design(project: String, name: String) -> Result<DesignScene, String> {
    designs::create_design(&designs_root(), &project, &name).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_design(project: String, file_name: String) -> Result<DesignScene, String> {
    designs::read_design(&designs_root(), &project, &file_name).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_design(project: String, file_name: String, content: Value) -> Result<DesignScene, String> {
    designs::write_design(&designs_root(), &project, &file_name, &content)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_design(
    project: String,
    old_file_name: String,
    new_name: String,
) -> Result<DesignSummary, String> {
    designs::rename_design(&designs_root(), &project, &old_file_name, &new_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn duplicate_design(
    project: String,
    source_file_name: String,
    target_name: String,
) -> Result<DesignSummary, String> {
    designs::duplicate_design(&designs_root(), &project, &source_file_name, &target_name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_design(project: String, file_name: String) -> Result<(), String> {
    designs::delete_design(&designs_root(), &project, &file_name).map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
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
            delete_design
        ])
        .run(tauri::generate_context!())
        .expect("error while running BanguesesDraw");
}
