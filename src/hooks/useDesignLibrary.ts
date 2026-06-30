import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { designApi } from "../lib/designApi";
import type { DesignScene, DesignSummary, ProjectSummary } from "../types/designs";

type UseDesignLibraryResult = {
  projects: ProjectSummary[];
  designs: DesignSummary[];
  filteredDesigns: DesignSummary[];
  selectedProject: string | null;
  filter: string;
  isLoading: boolean;
  isDesignsLoading: boolean;
  error: string | null;
  setSelectedProject: (project: string) => void;
  setFilter: (filter: string) => void;
  refresh: () => Promise<void>;
  createProject: (name: string) => Promise<ProjectSummary>;
  renameProject: (oldName: string, newName: string) => Promise<ProjectSummary>;
  duplicateProject: (sourceName: string, targetName: string) => Promise<ProjectSummary>;
  deleteProject: (name: string) => Promise<void>;
  createDesign: (name: string) => Promise<DesignScene | null>;
  renameDesign: (oldFileName: string, newName: string) => Promise<DesignSummary | null>;
  duplicateDesign: (
    sourceFileName: string,
    targetName: string,
  ) => Promise<DesignSummary | null>;
  deleteDesign: (fileName: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useDesignLibrary(): UseDesignLibraryResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDesignsLoading, setIsDesignsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProjectRef = useRef<string | null>(null);
  const designLoadRequestRef = useRef(0);

  const transitionSelectedProject = useCallback((project: string | null) => {
    if (selectedProjectRef.current === project) {
      return false;
    }

    designLoadRequestRef.current += 1;
    selectedProjectRef.current = project;
    setSelectedProject(project);
    setDesigns([]);
    setIsDesignsLoading(Boolean(project));

    return true;
  }, []);

  const loadProjects = useCallback(async (preferredProject?: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedProjects = await designApi.listProjects();
      const resolvedProject =
        preferredProject && loadedProjects.some((project) => project.name === preferredProject)
          ? preferredProject
          : selectedProjectRef.current &&
              loadedProjects.some(
                (project) => project.name === selectedProjectRef.current,
              )
            ? selectedProjectRef.current
            : loadedProjects[0]?.name ?? null;

      setProjects(loadedProjects);
      transitionSelectedProject(resolvedProject);
    } catch (loadError) {
      setProjects([]);
      transitionSelectedProject(null);
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [transitionSelectedProject]);

  const loadDesigns = useCallback(async (project: string | null) => {
    const requestId = designLoadRequestRef.current + 1;
    designLoadRequestRef.current = requestId;

    if (!project) {
      setDesigns([]);
      setIsDesignsLoading(false);
      return;
    }

    setError(null);
    setDesigns([]);
    setIsDesignsLoading(true);

    try {
      const loadedDesigns = await designApi.listDesigns(project);

      if (designLoadRequestRef.current !== requestId) {
        return;
      }

      setDesigns(loadedDesigns);
    } catch (loadError) {
      if (designLoadRequestRef.current !== requestId) {
        return;
      }

      setDesigns([]);
      setError(getErrorMessage(loadError));
    } finally {
      if (designLoadRequestRef.current === requestId) {
        setIsDesignsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadDesigns(selectedProject);
  }, [loadDesigns, selectedProject]);

  const filteredDesigns = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return designs;
    }

    return designs.filter((design) => design.name.toLowerCase().includes(query));
  }, [designs, filter]);

  const selectProject = useCallback(
    (project: string) => {
      transitionSelectedProject(project);
    },
    [transitionSelectedProject],
  );

  const runProjectAction = useCallback(
    async <T,>(action: () => Promise<T>) => {
      setError(null);

      try {
        return await action();
      } catch (actionError) {
        setError(getErrorMessage(actionError));
        throw actionError;
      }
    },
    [],
  );

  const withProject = useCallback(
    async <T,>(callback: (project: string) => Promise<T>) => {
      if (!selectedProject) {
        return null;
      }

      setError(null);

      try {
        return await callback(selectedProject);
      } catch (actionError) {
        setError(getErrorMessage(actionError));
        throw actionError;
      }
    },
    [selectedProject],
  );

  return {
    projects,
    designs,
    filteredDesigns,
    selectedProject,
    filter,
    isLoading,
    isDesignsLoading,
    error,
    setSelectedProject: selectProject,
    setFilter,
    refresh: loadProjects,
    createProject: (name) =>
      runProjectAction(async () => {
        const project = await designApi.createProject(name);
        transitionSelectedProject(project.name);
        await loadProjects(project.name);
        return project;
      }),
    renameProject: (oldName, newName) =>
      runProjectAction(async () => {
        const project = await designApi.renameProject(oldName, newName);
        const shouldSelectProject = selectedProjectRef.current === oldName;

        if (shouldSelectProject) {
          transitionSelectedProject(project.name);
        }

        await loadProjects(shouldSelectProject ? project.name : undefined);
        return project;
      }),
    duplicateProject: (sourceName, targetName) =>
      runProjectAction(async () => {
        const project = await designApi.duplicateProject(sourceName, targetName);
        transitionSelectedProject(project.name);
        await loadProjects(project.name);
        return project;
      }),
    deleteProject: (name) =>
      runProjectAction(async () => {
        const shouldResetSelection = selectedProjectRef.current === name;
        const preferredProject = shouldResetSelection ? undefined : selectedProjectRef.current;
        await designApi.deleteProject(name);

        if (shouldResetSelection) {
          transitionSelectedProject(null);
        }

        await loadProjects(preferredProject);
      }),
    createDesign: async (name) =>
      withProject(async (project) => {
        const design = await designApi.createDesign(project, name);
        await loadDesigns(project);
        return design;
      }),
    renameDesign: async (oldFileName, newName) =>
      withProject(async (project) => {
        const design = await designApi.renameDesign(project, oldFileName, newName);
        await loadDesigns(project);
        return design;
      }),
    duplicateDesign: async (sourceFileName, targetName) =>
      withProject(async (project) => {
        const design = await designApi.duplicateDesign(
          project,
          sourceFileName,
          targetName,
        );
        await loadDesigns(project);
        return design;
      }),
    deleteDesign: async (fileName) => {
      await withProject(async (project) => {
        await designApi.deleteDesign(project, fileName);
        await loadDesigns(project);
      });
    },
  };
}
