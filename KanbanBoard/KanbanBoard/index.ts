import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { KanbanBoardView, IKanbanTask } from "./components/KanbanBoardView";

/** Custom events declared in the manifest. */
interface IKanbanEvents {
    OnTaskMoved?: () => void;
    OnCardSelected?: () => void;
}

export class KanbanBoard implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged!: () => void;
    private context!: ComponentFramework.Context<IInputs>;

    // Output state
    private movedTaskId = "";
    private movedFromStatus = "";
    private movedToStatus = "";
    private selectedTaskId = "";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;
        // Receive allocatedWidth/Height whenever the Canvas control is resized
        context.mode.trackContainerResize(true);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        this.context = context;
        const ds = context.parameters.tasks;

        // Load any additional pages (safe no-op when everything is already loaded)
        if (!ds.loading && ds.paging.hasNextPage) {
            ds.paging.loadNextPage();
        }

        const statuses = (context.parameters.StatusList.raw ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        const tasks: IKanbanTask[] = ds.sortedRecordIds.map((id) => {
            const r = ds.records[id];
            return {
                id: this.text(r, "taskId") || id,
                title: this.text(r, "title"),
                status: this.text(r, "taskStatus"),
                assignee: this.text(r, "assignee"),
                estimatedHours: Number(r.getValue("estimatedHours") ?? 0) || 0,
                actualHours: Number(r.getValue("actualHours") ?? 0) || 0,
                dueDate: r.getFormattedValue("dueDate") ?? "",
                deadlineStatus: this.text(r, "deadlineStatus"),
            };
        });

        const width = context.mode.allocatedWidth;
        const height = context.mode.allocatedHeight;

        return React.createElement(KanbanBoardView, {
            tasks,
            statuses,
            width: width > 0 ? width : 0,
            height: height > 0 ? height : 0,
            loading: ds.loading,
            onMove: this.handleMove,
            onSelect: this.handleSelect,
        });
    }

    public getOutputs(): IOutputs {
        return {
            MovedTaskId: this.movedTaskId,
            MovedFromStatus: this.movedFromStatus,
            MovedToStatus: this.movedToStatus,
            SelectedTaskId: this.selectedTaskId,
        };
    }

    public destroy(): void {
        // React is unmounted by the framework for virtual controls; nothing to clean up.
    }

    // ---------- helpers ----------

    private text(record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord, col: string): string {
        const formatted = record.getFormattedValue(col);
        if (formatted) return formatted;

        const raw = record.getValue(col);
        if (raw === null || raw === undefined) return "";
        if (typeof raw === "string") return raw;
        if (typeof raw === "number" || typeof raw === "boolean") return raw.toString();
        if (raw instanceof Date) return raw.toISOString();
        return "";
    }

    private readonly handleMove = (taskId: string, from: string, to: string): void => {
        this.movedTaskId = taskId;
        this.movedFromStatus = from;
        this.movedToStatus = to;
        this.notifyOutputChanged();
        (this.context.events as unknown as IKanbanEvents).OnTaskMoved?.();
    };

    private readonly handleSelect = (taskId: string): void => {
        this.selectedTaskId = taskId;
        this.notifyOutputChanged();
        (this.context.events as unknown as IKanbanEvents).OnCardSelected?.();
    };
}