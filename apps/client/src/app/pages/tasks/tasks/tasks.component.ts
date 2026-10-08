import { Component, HostListener, ChangeDetectionStrategy } from "@angular/core";
import { createTask, LostarkTask } from "../../../model/lostark-task";
import { TaskFrequency } from "../../../model/task-frequency";
import { TaskScope } from "../../../model/task-scope";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { NzMessageService } from "ng-zorro-antd/message";
import { Clipboard } from "@angular/cdk/clipboard";
import { NzModalService } from "ng-zorro-antd/modal";
import { TextQuestionPopupComponent } from "../../../components/text-question-popup/text-question-popup/text-question-popup.component";
import { filter } from "rxjs/operators";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { TasksService } from "../../../core/database/services/tasks.service";
import { AuthService } from "../../../core/database/services/auth.service";
import { distinctUntilChanged, map, merge, Subject, tap } from "rxjs";
import { customTasksExport, ilvlRangeValidator, nextTaskIndex, parseTasksImport } from "../task-input";
import { importErrorMessage } from "../../../core/import-errors";

/** The part of NgModel the table inputs use to show the saved value again after a rejected edit. */
interface ResettableModel {
  reset(value?: unknown): void;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

@Component({
  selector: "lostark-helper-tasks",
  templateUrl: "./tasks.component.html",
  styleUrls: ["./tasks.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class TasksComponent {
  public TaskFrequency = TaskFrequency;
  public TaskScope = TaskScope;

  private optimisticTasks$ = new Subject<LostarkTask[]>();

  public tasks$ = merge(
    this.optimisticTasks$,
    this.tasksService.tasks$
  ).pipe(
    map(tasks => tasks.sort((a, b) => a.index - b.index)),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    tap(tasks => this.currentTasks = tasks)
  );

  /** The last task list shown, for the new task's index and the import's duplicate check. */
  private currentTasks: LostarkTask[] = [];

  /** True while a new task is being written, so a second click on Add does nothing. */
  public saving = false;

  /** The task just added, highlighted for a few seconds. */
  public highlightKey: string | null = null;

  public form = this.fb.group({
    label: ["", [Validators.required, Validators.pattern(/\S/)]],
    frequency: [TaskFrequency.DAILY],
    scope: [TaskScope.CHARACTER],
    amount: [null, [Validators.required, Validators.min(1)]],
    minIlvl: [null, [Validators.required, Validators.min(0), Validators.max(9999)]],
    maxIlvl: [null, [Validators.required, Validators.min(0), Validators.max(9999)]],
    iconPath: [null]
  }, { validators: ilvlRangeValidator });

  public uid$ = this.authService.uid$;

  public icons = [
    "abyssal-dungeon.webp",
    "abyssal-raid.webp",
    "legion_raid.png",
    "chaos-dungeon.webp",
    "chaos_gate.png",
    "daily.webp",
    "ghostship.png",
    "guardian.png",
    "island.webp",
    "pirate_coin.png",
    "rapport.webp",
    "sylmael.png",
    "gold.png",
    "weekly.webp",
    "anguished.png",
    "rift_piece.png",
    "t1_cube.png",
    "t2_bossrush.png",
    "t2_cube.png",
    "t3_bossrush.png",
    "t3_cube.png",
    "adventure_quest.webp",
    "amethyst_shard.webp",
    "chain_quest.webp",
    "co-op_quest.webp",
    "crystal.webp",
    "dungeon.webp",
    "dungeon_quest.webp",
    "event_quest.webp",
    "main_quest.webp",
    "normal_quest.webp",
    "normal_quest_end.webp",
    "normal_quest_start.webp",
    "stronghold_quest.webp",
    "sudden_quest.webp",
    "trade_skill_tool.webp",
    "world_quest.webp",
    "world_tree_leaves.webp",
    "guild.webp",
    "cardpack.png"
  ];

  public tableHeight!: number;

  constructor(private tasksService: TasksService,
              private fb: UntypedFormBuilder,
              private message: NzMessageService,
              private clipboard: Clipboard,
              private modal: NzModalService,
              private authService: AuthService) {
    this.setTableHeight();
  }

  @HostListener("window:resize")
  setTableHeight(): void {
    const computed = window.innerHeight
      - 64 - 48 - 64 - 56 // Page Layout
      - 72 // nz-page-title
      - 245; //Form w/card
    this.tableHeight = Math.max(computed, 300);
  }

  addTask(uid: string): void {
    if (this.saving) {
      return;
    }
    const formData = this.form.getRawValue();
    const task = createTask(
      formData.label.trim(),
      formData.minIlvl,
      formData.frequency,
      formData.scope,
      formData.amount,
      formData.maxIlvl,
      formData.iconPath,
      { custom: true, index: nextTaskIndex(this.currentTasks) }
    );
    task.authorId = uid;
    this.saving = true;
    this.tasksService.addTask(task).subscribe({
      next: key => {
        this.saving = false;
        this.form.reset({
          frequency: TaskFrequency.DAILY,
          scope: TaskScope.CHARACTER
        });
        this.message.success("Custom task added to the list");
        this.showNewTask(key);
      },
      error: (e: unknown) => {
        this.saving = false;
        this.message.error(`The task was not added: ${(e as Error).message || e}`);
      }
    });
  }

  /** Scrolls the table to the task just added once it is listed, and highlights it for a few seconds. */
  private showNewTask(key: string): void {
    this.highlightKey = key;
    let tries = 0;
    const scroll = () => {
      const row = document.querySelector(`tr[data-task-key="${key}"]`);
      if (row) {
        row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (tries++ < 20) {
        setTimeout(scroll, 150);
      }
    };
    setTimeout(scroll);
    setTimeout(() => {
      if (this.highlightKey === key) {
        this.highlightKey = null;
      }
    }, 4000);
  }

  dropTask(tasks: LostarkTask[], event: CdkDragDrop<LostarkTask[]>): void {
    const tasksClone = [...tasks];
    moveItemInArray(tasksClone, event.previousIndex, event.currentIndex);
    const newTasks = tasksClone.map((task, i) => {
      task.index = i;
      return task;
    });
    this.optimisticTasks$.next(newTasks);
    this.tasksService.updateIndexes(newTasks);
  }

  /** Arrow Up or Down on a row's grip moves the row one place, as a drop would, and keeps the grip focused. */
  moveByKeyboard(tasks: LostarkTask[], index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= tasks.length) {
      return;
    }
    const key = tasks[index].$key;
    this.dropTask(tasks, { previousIndex: index, currentIndex: target } as CdkDragDrop<LostarkTask[]>);
    setTimeout(() => document.querySelector<HTMLElement>(`.drag-handle[data-task-key="${key}"]`)?.focus());
  }

  /**
   * The dragged row's preview is a copy of the row outside the table, so its cells lose the
   * column widths. The placeholder left in the table still has them: copy them over.
   */
  matchPreviewCells(): void {
    const placeholder = document.querySelector("tr.cdk-drag-placeholder");
    const preview = document.querySelector("tr.cdk-drag-preview");
    if (!placeholder || !preview) {
      return;
    }
    const widths = [...placeholder.children].map(cell => cell.getBoundingClientRect().width);
    [...preview.children].forEach((cell, i) => (cell as HTMLElement).style.width = `${widths[i]}px`);
  }

  setTrackAll(tasks: LostarkTask[], track: boolean): void {
    this.tasksService.setTrackAll(tasks, track);
  }

  updateTask(task: LostarkTask): void {
    this.tasksService.updateTask(task);
  }

  /**
   * Saves a name, repetitions or item level edited in the table. A blank name, a blank number or a
   * number below the minimum is not saved: the saved value shows again.
   */
  saveTaskField(task: LostarkTask, field: "label" | "amount" | "minIlvl" | "maxIlvl", value: unknown, model: ResettableModel): void {
    if (field === "label") {
      const label = typeof value === "string" ? value.trim() : "";
      if (!label) {
        model.reset(task.label);
        return;
      }
      if (label !== value) {
        model.reset(label);
      }
      task.label = label;
    } else {
      const min = field === "amount" ? 1 : 0;
      if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
        model.reset(task[field]);
        return;
      }
      task[field] = value;
    }
    this.updateTask(task);
  }

  removeTask(task: LostarkTask): void {
    this.tasksService.removeTask(task);
  }

  exportTasks(tasks: LostarkTask[]): void {
    this.clipboard.copy(JSON.stringify(customTasksExport(tasks)));
    this.message.success("Custom tasks copied to your clipboard");
  }

  importTasks(uid: string): void {
    this.modal.create({
      nzTitle: "Import tasks",
      nzContent: TextQuestionPopupComponent,
      nzData: {
        placeholder: "Paste your exported tasks here"
      },
      nzFooter: null
    }).afterClose
      .pipe(
        // Closing the popup without submitting gives no text
        filter((text): text is string => !!text)
      )
      .subscribe(text => {
        const result = parseTasksImport(text, this.currentTasks, uid);
        if (!result.ok) {
          this.message.error(importErrorMessage(result.errors), { nzDuration: 10000 });
          return;
        }
        const summary = `Imported ${plural(result.tasks.length, "task")}, skipped ${plural(result.skipped, "duplicate")}.`;
        if (result.tasks.length === 0) {
          this.message.info(summary);
          return;
        }
        this.tasksService.importTasks(result.tasks).subscribe({
          next: () => this.message.success(summary),
          error: (e: unknown) => this.message.error(`The tasks were not imported: ${(e as Error).message || e}`)
        });
      });
  }

  trackByTask(index: number, task: LostarkTask): string | undefined {
    return task.$key;
  }
}
