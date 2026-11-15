import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useRef, useState } from "react";
import packageJson from "../../package.json";
import { designApi } from "../lib/designApi";
import { UpdateReviewDialog } from "./UpdateReviewDialog";

/** Checks quietly once per launch; update installation always remains user initiated. */
export function UpdateNotification({ visible = true }: { visible?: boolean }) {
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const updateRef = useRef<Update | null>(null);

  function replaceUpdate(update: Update | null) {
    const previousUpdate = updateRef.current;
    updateRef.current = update;
    setAvailableUpdate(update);
    if (previousUpdate && previousUpdate !== update) {
      void previousUpdate.close().catch(() => undefined);
    }
  }

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      void check({ timeout: 20_000 })
        .then((update) => {
          if (!disposed && update) {
            replaceUpdate(update);
          } else {
            void update?.close().catch(() => undefined);
          }
        })
        // A background availability check must never block opening the app.
        .catch(() => undefined);
    }, 1_200);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      void updateRef.current?.close().catch(() => undefined);
    };
  }, []);

  function dismiss() {
    setIsReviewOpen(false);
    replaceUpdate(null);
    setStatus(null);
  }

  async function installUpdate() {
    const update = updateRef.current;
    if (!update) return;

    setIsInstalling(true);
    setStatus(`Backing up your library before installing ${update.version}…`);

    try {
      const backup = await designApi.backupBeforeUpdate(update.version);
      setStatus(
        `Backup complete (${backup.fileCount} ${backup.fileCount === 1 ? "file" : "files"}). Downloading ${update.version}…`,
      );
      let contentLength = 0;
      let downloadedBytes = 0;
      await update.download((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          downloadedBytes = 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (contentLength > 0) {
            setStatus(
              `Downloading ${update.version} (${Math.min(100, Math.round((downloadedBytes / contentLength) * 100))}%)…`,
            );
          }
        }
      }, { timeout: 120_000 });
      setStatus(`Installing ${update.version}…`);
      await update.install();
      replaceUpdate(null);
      setStatus(`Version ${update.version} is installed. Restarting DesignBuddy…`);
      await designApi.restartApp();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Update was not installed: ${error.message}`
          : "Update was not installed. Your current version is still available.",
      );
    } finally {
      setIsInstalling(false);
    }
  }

  if (!visible) {
    return null;
  }

  const label = availableUpdate
    ? `Update ${availableUpdate.version} available`
    : `DesignBuddy ${packageJson.version}`;

  return (
    <>
      <aside
        className={`app-version ${availableUpdate ? "app-version-update-available" : ""}`}
        aria-live="polite"
      >
        {availableUpdate ? <span aria-hidden="true" className="app-version-dot" /> : null}
        <button
          type="button"
          className="app-version-control"
          onClick={() => setIsReviewOpen(true)}
          aria-label={availableUpdate ? `${label}. Review update.` : `View release notes for ${label}.`}
        >
          {label}
        </button>
      </aside>
      {isReviewOpen ? (
        <UpdateReviewDialog
          update={availableUpdate}
          releaseNotes={availableUpdate?.body}
          status={status}
          isInstalling={isInstalling}
          onCancel={dismiss}
          onInstall={() => void installUpdate()}
        />
      ) : null}
    </>
  );
}
