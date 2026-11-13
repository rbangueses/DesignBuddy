import { ChevronDown, Download, FileCode2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ExportMenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: "download" | "file-code";
  onSelect: () => void;
};

type ExportMenuProps = {
  disabled?: boolean;
  items: ExportMenuItem[];
  tooltip?: string;
};

function ExportMenuIcon({ icon }: { icon: ExportMenuItem["icon"] }) {
  if (icon === "file-code") {
    return <FileCode2 size={16} />;
  }

  return <Download size={16} />;
}

export function ExportMenu({ disabled = false, items, tooltip }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className={`export-menu-wrap editor-header-tooltip${isOpen ? " is-open" : ""}`}
      data-tooltip={tooltip}
      ref={menuRef}
    >
      <button
        type="button"
        className="export-menu-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <Download size={16} />
        Export
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="export-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
            >
              <ExportMenuIcon icon={item.icon} />
              <span>
                <strong>{item.label}</strong>
                {item.description ? <small>{item.description}</small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
