import { save } from "@tauri-apps/plugin-dialog";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Bold,
  Copy,
  FolderInput,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Pilcrow,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { designApi } from "../lib/designApi";
import type { NoteDesignContent } from "../types/designs";
import { ExportMenu } from "./ExportMenu";
import { MoveCopyDesignDialog } from "./MoveCopyDesignDialog";
import { RenameDialog } from "./RenameDialog";

type NoteEditorViewProps = {
  project: string;
  fileName: string;
  initialContent: NoteDesignContent;
  onBack: () => void;
  onDesignMoved: (
    project: string,
    fileName: string,
    initialContent: NoteDesignContent,
  ) => void;
};

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type PendingAction = "rename" | "duplicate" | "move" | null;

function wrapNoteContent(content: JSONContent): NoteDesignContent {
  return {
    type: "banguesesdraw-note",
    version: 1,
    content: content as NoteDesignContent["content"],
  };
}

export function NoteEditorView({
  project,
  fileName,
  initialContent,
  onBack,
  onDesignMoved,
}: NoteEditorViewProps) {
  const [savedContent, setSavedContent] = useState<NoteDesignContent>(initialContent);
  const [draftContent, setDraftContent] = useState<NoteDesignContent>(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isFileActionRunning, setIsFileActionRunning] = useState(false);
  const title = useMemo(() => fileName.replace(/\.bdnote$/, ""), [fileName]);
  const isBusy = saveStatus === "saving" || isFileActionRunning;

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent.content as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": "Note body",
        class: "note-prosemirror",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const nextContent = wrapNoteContent(updatedEditor.getJSON());
      setDraftContent(nextContent);
      setSaveStatus(
        JSON.stringify(nextContent.content) === JSON.stringify(savedContent.content)
          ? "saved"
          : "unsaved",
      );
    },
  });

  const saveNow = useCallback(async () => {
    if (!editor) {
      return draftContent;
    }

    const nextContent = wrapNoteContent(editor.getJSON());
    setSaveStatus("saving");
    setError(null);

    try {
      const design = await designApi.writeDesign(project, fileName, nextContent);
      const saved = design.content as NoteDesignContent;
      setSavedContent(saved);
      setDraftContent(saved);
      setSaveStatus("saved");
      return saved;
    } catch (saveError) {
      setSaveStatus("error");
      setError(String(saveError));
      throw saveError;
    }
  }, [draftContent, editor, fileName, project]);

  useEffect(() => {
    if (saveStatus !== "unsaved") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveNow().catch(() => undefined);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [saveNow, saveStatus]);

  const handleBack = useCallback(async () => {
    if (isBusy) {
      return;
    }

    if (saveStatus !== "unsaved") {
      onBack();
      return;
    }

    try {
      await saveNow();
      onBack();
    } catch {
      return;
    }
  }, [isBusy, onBack, saveNow, saveStatus]);

  const handleRename = useCallback(
    async (name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestContent = saveStatus === "unsaved" ? await saveNow() : draftContent;
        const design = await designApi.renameDesign(project, fileName, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestContent);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [draftContent, fileName, onDesignMoved, project, saveNow, saveStatus],
  );

  const handleDuplicate = useCallback(
    async (targetProject: string, name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestContent = saveStatus === "unsaved" ? await saveNow() : draftContent;
        const design = targetProject === project
          ? await designApi.duplicateDesign(project, fileName, name)
          : await designApi.copyDesign(project, fileName, targetProject, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestContent);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [draftContent, fileName, onDesignMoved, project, saveNow, saveStatus],
  );

  const handleMove = useCallback(
    async (targetProject: string, name: string) => {
      setIsFileActionRunning(true);

      try {
        const latestContent = saveStatus === "unsaved" ? await saveNow() : draftContent;
        const design = await designApi.moveDesign(project, fileName, targetProject, name);
        setPendingAction(null);
        onDesignMoved(design.project, design.fileName, latestContent);
      } finally {
        setIsFileActionRunning(false);
      }
    },
    [draftContent, fileName, onDesignMoved, project, saveNow, saveStatus],
  );

  const handleExport = useCallback(async () => {
    const targetPath = await save({
      title: "Export DesignBuddy note",
      defaultPath: fileName,
      filters: [{ name: "DesignBuddy note", extensions: ["bdnote"] }],
    });

    if (typeof targetPath !== "string") {
      return;
    }

    setIsFileActionRunning(true);
    setError(null);

    try {
      if (saveStatus === "unsaved") {
        await saveNow();
      }
      await designApi.exportDesign(project, fileName, targetPath);
    } catch (exportError) {
      setError(String(exportError));
    } finally {
      setIsFileActionRunning(false);
    }
  }, [fileName, project, saveNow, saveStatus]);

  const toolbarButton = (
    label: string,
    isActive: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      className={isActive ? "active" : undefined}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={!editor || isBusy}
    >
      {icon}
    </button>
  );

  return (
    <div className="editor-view note-editor-view">
      <header className="editor-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => void handleBack()}
          aria-label="Back to library"
          title="Back to library"
          disabled={isBusy}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <span>{project}</span>
          <strong>{title}</strong>
        </div>
        <div className="save-cluster">
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("rename")}
            aria-label="Rename note"
            title="Rename note"
            disabled={isBusy}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("duplicate")}
            aria-label="Duplicate note"
            title="Duplicate note"
            disabled={isBusy}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPendingAction("move")}
            aria-label="Move note"
            title="Move note"
            disabled={isBusy}
          >
            <FolderInput size={16} />
          </button>
          <ExportMenu
            disabled={isBusy}
            items={[
              {
                id: "designbuddy-note",
                label: "DesignBuddy note",
                description: ".bdnote",
                onSelect: () => void handleExport(),
              },
            ]}
          />
          <span className={`save-status ${saveStatus}`}>{saveStatus}</span>
          <button
            type="button"
            className="save-button"
            onClick={() => void saveNow()}
            disabled={isBusy}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </header>
      {error ? <div className="save-error">{error}</div> : null}
      <main className="note-editor-shell">
        <div className="note-toolbar" aria-label="Text formatting">
          {toolbarButton(
            "Paragraph",
            editor?.isActive("paragraph") ?? false,
            () => editor?.chain().focus().setParagraph().run(),
            <Pilcrow size={16} />,
          )}
          {toolbarButton(
            "Heading 1",
            editor?.isActive("heading", { level: 1 }) ?? false,
            () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
            <Heading1 size={16} />,
          )}
          {toolbarButton(
            "Heading 2",
            editor?.isActive("heading", { level: 2 }) ?? false,
            () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            <Heading2 size={16} />,
          )}
          <span className="note-toolbar-separator" aria-hidden="true" />
          {toolbarButton(
            "Bold",
            editor?.isActive("bold") ?? false,
            () => editor?.chain().focus().toggleBold().run(),
            <Bold size={16} />,
          )}
          {toolbarButton(
            "Italic",
            editor?.isActive("italic") ?? false,
            () => editor?.chain().focus().toggleItalic().run(),
            <Italic size={16} />,
          )}
          <span className="note-toolbar-separator" aria-hidden="true" />
          {toolbarButton(
            "Bullet list",
            editor?.isActive("bulletList") ?? false,
            () => editor?.chain().focus().toggleBulletList().run(),
            <List size={16} />,
          )}
          {toolbarButton(
            "Numbered list",
            editor?.isActive("orderedList") ?? false,
            () => editor?.chain().focus().toggleOrderedList().run(),
            <ListOrdered size={16} />,
          )}
        </div>
        <section className="note-page">
          <EditorContent editor={editor} />
        </section>
      </main>
      {pendingAction === "rename" ? (
        <RenameDialog
          title="Rename note"
          inputLabel="Note name"
          initialName={title}
          submitLabel="Rename"
          onCancel={() => setPendingAction(null)}
          onSubmit={handleRename}
        />
      ) : null}
      {pendingAction === "duplicate" ? (
        <MoveCopyDesignDialog
          mode="copy"
          sourceProject={project}
          initialName={`${title} Copy`}
          onCancel={() => setPendingAction(null)}
          onSubmit={handleDuplicate}
        />
      ) : null}
      {pendingAction === "move" ? (
        <MoveCopyDesignDialog
          mode="move"
          sourceProject={project}
          initialName={title}
          onCancel={() => setPendingAction(null)}
          onSubmit={handleMove}
        />
      ) : null}
    </div>
  );
}
