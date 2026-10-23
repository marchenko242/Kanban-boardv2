import * as React from "react";

export interface IKanbanTask {
  id: string;
  title: string;
  status: string;
  assignee: string;
  estimatedHours: number;
  actualHours: number;
  dueDate: string;
  deadlineStatus: string;
}

export interface IKanbanBoardViewProps {
  tasks: IKanbanTask[];
  statuses: string[];
  width: number;
  height: number;
  loading: boolean;
  onMove: (taskId: string, from: string, to: string) => void;
  onSelect: (taskId: string) => void;
}

const slug = (s: unknown): string =>
  (typeof s === "string" ? s : "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

interface IColumn {
  name: string;
  droppable: boolean;
  items: IKanbanTask[];
}

export const KanbanBoardView: React.FC<IKanbanBoardViewProps> = ({
  tasks, statuses, width, height, loading, onMove, onSelect,
}) => {
  // Optimistic moves: taskId -> target status, until the dataset confirms it
  const [pending, setPending] = React.useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);

  // Drop optimistic entries once the server data reflects the change
  React.useEffect(() => {
    setPending((prev) => {
      let changed = false;
      const next = { ...prev };
      tasks.forEach((t) => {
        if (next[t.id] !== undefined && next[t.id] === t.status) {
          delete next[t.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  const columns = React.useMemo<IColumn[]>(() => {
    const cols: IColumn[] = statuses.map((s) => ({ name: s, droppable: true, items: [] }));
    const other: IColumn = { name: "Other", droppable: false, items: [] };
    tasks.forEach((t) => {
      const status = pending[t.id] ?? t.status;
      const target = cols.find((c) => c.name === status);
      (target ?? other).items.push({ ...t, status });
    });
    if (other.items.length > 0) cols.push(other);
    return cols;
  }, [tasks, statuses, pending]);

  const handleDrop = (e: React.DragEvent, target: IColumn): void => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setOverColumn(null);
    setDraggingId(null);
    if (!id || !target.droppable) return;

    const task = columns.flatMap((c) => c.items).find((t) => t.id === id);
    if (!task || task.status === target.name) return;

    const from = task.status;
    setPending((p) => ({ ...p, [id]: target.name }));
    onMove(id, from, target.name);

    // Safety net: if the Power Fx Patch never confirms, revert the card after 10s
    window.setTimeout(() => {
      setPending((p) => {
        if (p[id] !== target.name) return p;
        const next = { ...p };
        delete next[id];
        return next;
      });
    }, 10000);
  };

  const rootStyle: React.CSSProperties = {
    width: width > 0 ? `${width}px` : "100%",
    height: height > 0 ? `${height}px` : "100%",
  };

  return (
    <div className="kb-root" style={rootStyle}>
      {loading && <div className="kb-loading">Loading tasks…</div>}
      <div className="kb-board">
        {columns.map((col) => (
          <section
            key={col.name}
            className={[
              "kb-column",
              `kb-column--${slug(col.name)}`,
              overColumn === col.name && col.droppable ? "kb-column--over" : "",
            ].join(" ")}
            onDragOver={(e) => {
              if (!col.droppable) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overColumn !== col.name) setOverColumn(col.name);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverColumn((c) => (c === col.name ? null : c));
              }
            }}
            onDrop={(e) => handleDrop(e, col)}
          >
            <header className="kb-column__header">
              <span className="kb-column__dot" />
              <span className="kb-column__title">{col.name}</span>
              <span className="kb-column__count">{col.items.length}</span>
            </header>

            <div className="kb-column__body" role="list">
              {col.items.map((t) => {
                const pct = t.estimatedHours > 0
                  ? Math.min(100, Math.round((t.actualHours / t.estimatedHours) * 100))
                  : 0;
                const overBudget = t.estimatedHours > 0 && t.actualHours > t.estimatedHours;
                return (
                  <article
                    key={t.id}
                    role="listitem"
                    tabIndex={0}
                    draggable
                    className={`kb-card ${draggingId === t.id ? "kb-card--dragging" : ""}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(t.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverColumn(null);
                    }}
                    onClick={() => onSelect(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSelect(t.id);
                    }}
                  >
                    <div className="kb-card__title">{t.title}</div>

                    {t.deadlineStatus && (
                      <span className={`kb-chip kb-chip--${slug(t.deadlineStatus)}`}>
                        {t.deadlineStatus}
                      </span>
                    )}

                    {t.estimatedHours > 0 && (
                      <div className="kb-hours">
                        <div className="kb-hours__bar">
                          <div
                            className={`kb-hours__fill ${overBudget ? "kb-hours__fill--over" : ""}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="kb-hours__label">
                          {t.actualHours}/{t.estimatedHours}h
                        </span>
                      </div>
                    )}

                    <footer className="kb-card__footer">
                      <span className="kb-avatar" title={t.assignee}>
                        {t.assignee ? initials(t.assignee) : "?"}
                      </span>
                      {t.dueDate && <span className="kb-card__due">📅 {t.dueDate}</span>}
                    </footer>
                  </article>
                );
              })}
              {col.items.length === 0 && <div className="kb-empty">Drop tasks here</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};