import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadAppData, saveAppData } from "./storage";
import type { AppData, Note, Page, Task, TasksByDate } from "./types";

type EditTarget =
  | { kind: "task"; date: string; id: string; value: string }
  | { kind: "note"; id: string; value: string }
  | null;

interface ModalState {
  open: boolean;
  kind: "task" | "note";
  value: string;
  targetDate: string;
}

const EMPTY_MODAL: ModalState = {
  open: false,
  kind: "task",
  value: "",
  targetDate: "",
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId(): string {
  return crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/)[0] || "（空内容）";
}

function autoResize(element: HTMLTextAreaElement | null): void {
  if (!element) return;
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

export default function App() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDate(today), [today]);

  const [page, setPage] = useState<Page>("todo");
  const [tasks, setTasks] = useState<TasksByDate>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [floatingMode, setFloatingMode] = useState(false);

  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen("toggle-floating-mode", () => {
      setFloatingMode((current) => {
        const next = !current;

        setEditTarget(null);
        setModal(EMPTY_MODAL);
        setPage("todo");
        setSelectedTaskId(null);

        void getCurrentWindow().setAlwaysOnTop(next);

        return next;
      });
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void loadAppData().then((data) => {
      setTasks(data.tasks ?? {});
      setNotes(data.notes ?? []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(() => {
      const data: AppData = { tasks, notes };

      void saveAppData(data)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [tasks, notes, loaded]);

  useEffect(() => {
    if (modal.open) {
      window.setTimeout(() => {
        modalTextareaRef.current?.focus();
        autoResize(modalTextareaRef.current);
      }, 0);
    }
  }, [modal.open]);

  useEffect(() => {
    if (editTarget) {
      window.setTimeout(() => {
        editTextareaRef.current?.focus();
        const textarea = editTextareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
          autoResize(textarea);
        }
      }, 0);
    }
  }, [editTarget]);

  const displayedTasks = page === "calendar"
    ? tasks[selectedDate] ?? []
    : tasks[todayStr] ?? [];

  const activeTasks = displayedTasks.filter((task) => !task.done);
  const completedTasks = displayedTasks.filter((task) => task.done);
  const keyboardTaskOrder = [...activeTasks, ...completedTasks];

  useEffect(() => {
    if (page === "note") {
      setSelectedTaskId(null);
      return;
    }

    if (
      selectedTaskId &&
      keyboardTaskOrder.some((task) => task.id === selectedTaskId)
    ) {
      return;
    }

    setSelectedTaskId(keyboardTaskOrder[0]?.id ?? null);
  }, [page, selectedDate, tasks, selectedTaskId]);

  const openNewModal = useCallback(() => {
    setEditTarget(null);

    setModal({
      open: true,
      kind: page === "note" ? "note" : "task",
      value: "",
      targetDate: page === "calendar" ? selectedDate : todayStr,
    });
  }, [page, selectedDate, todayStr]);

  const closeModal = useCallback(() => {
    setModal(EMPTY_MODAL);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditTarget(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editTarget) return;

    if (!editTarget.value.trim()) {
      setEditTarget(null);
      return;
    }

    if (editTarget.kind === "task") {
      setTasks((current) => ({
        ...current,
        [editTarget.date]: (current[editTarget.date] ?? []).map((task) =>
          task.id === editTarget.id
            ? { ...task, text: editTarget.value }
            : task,
        ),
      }));
    } else {
      setNotes((current) =>
        current.map((note) =>
          note.id === editTarget.id
            ? { ...note, text: editTarget.value }
            : note,
        ),
      );
    }

    setEditTarget(null);
  }, [editTarget]);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (keyboardTaskOrder.length === 0) return;

      const currentIndex = keyboardTaskOrder.findIndex(
        (task) => task.id === selectedTaskId,
      );

      const startIndex = currentIndex === -1
        ? direction === 1 ? -1 : 0
        : currentIndex;

      const nextIndex = Math.max(
        0,
        Math.min(keyboardTaskOrder.length - 1, startIndex + direction),
      );

      const nextTask = keyboardTaskOrder[nextIndex];
      setSelectedTaskId(nextTask.id);

      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(`[data-task-id="${nextTask.id}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 0);
    },
    [keyboardTaskOrder, selectedTaskId],
  );

  const startEditingSelectedTask = useCallback(() => {
    if (!selectedTaskId) return;

    const date = page === "calendar" ? selectedDate : todayStr;
    const task = (tasks[date] ?? []).find((item) => item.id === selectedTaskId);
    if (!task) return;

    setEditTarget({
      kind: "task",
      date,
      id: task.id,
      value: task.text,
    });
  }, [page, selectedDate, selectedTaskId, tasks, todayStr]);

  const deleteTask = useCallback((date: string, id: string) => {
    setTasks((current) => ({
      ...current,
      [date]: (current[date] ?? []).filter((task) => task.id !== id),
    }));
  }, []);

  const deleteSelectedTask = useCallback(() => {
    if (!selectedTaskId) return;
    const date = page === "calendar" ? selectedDate : todayStr;
    deleteTask(date, selectedTaskId);
  }, [deleteTask, page, selectedDate, selectedTaskId, todayStr]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        if (editTarget) {
          event.preventDefault();
          cancelEditing();
          return;
        }

        if (modal.open) {
          event.preventDefault();
          closeModal();
        }

        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();

        if (!modal.open && !editTarget) {
          openNewModal();
        }

        return;
      }

      if (modal.open || editTarget || isTyping) return;

      if (!floatingMode && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();

        const pageOrder: Page[] = ["note", "todo", "calendar"];
        const currentIndex = pageOrder.indexOf(page);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          (currentIndex + direction + pageOrder.length) % pageOrder.length;
        const nextPage = pageOrder[nextIndex];

        setPage(nextPage);
        setSelectedTaskId(null);

        if (nextPage === "calendar") {
          setSelectedDate(todayStr);
        }

        return;
      }

      if (page === "note") return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.code === "Space") {
        event.preventDefault();
        startEditingSelectedTask();
      } else if (event.key === "Delete") {
        event.preventDefault();
        deleteSelectedTask();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelEditing,
    closeModal,
    deleteSelectedTask,
    editTarget,
    floatingMode,
    modal.open,
    moveSelection,
    openNewModal,
    page,
    startEditingSelectedTask,
  ]);

  function submitModal(event?: FormEvent) {
    event?.preventDefault();

    if (!modal.value.trim()) return;

    if (modal.kind === "note") {
      setNotes((current) => [
        ...current,
        {
          id: createId(),
          text: modal.value,
          createdAt: new Date().toISOString(),
        },
      ]);
    } else {
      const task: Task = {
        id: createId(),
        text: modal.value,
        done: false,
        createdAt: new Date().toISOString(),
      };

      setTasks((current) => ({
        ...current,
        [modal.targetDate]: [...(current[modal.targetDate] ?? []), task],
      }));

      setSelectedTaskId(task.id);
    }

    closeModal();
  }

  function handleModalKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitModal();
    }
  }

  function handleEditKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveEdit();
    }
  }

  function toggleTask(date: string, id: string) {
    setTasks((current) => ({
      ...current,
      [date]: (current[date] ?? []).map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }));
  }

  function copyToTomorrow() {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    const copiedTasks = (tasks[todayStr] ?? []).map<Task>((task) => ({
      ...task,
      id: createId(),
      done: false,
      createdAt: new Date().toISOString(),
    }));

    setTasks((current) => ({
      ...current,
      [tomorrowStr]: [...(current[tomorrowStr] ?? []), ...copiedTasks],
    }));
  }

  function startTaskEdit(date: string, task: Task) {
    setSelectedTaskId(task.id);
    setEditTarget({
      kind: "task",
      date,
      id: task.id,
      value: task.text,
    });
  }

  function startNoteEdit(note: Note) {
    setEditTarget({
      kind: "note",
      id: note.id,
      value: note.text,
    });
  }

  function deleteNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  function switchPage(nextPage: Page) {
    saveEdit();
    closeModal();
    setPage(nextPage);

    if (nextPage === "calendar") {
      setSelectedDate(todayStr);
    }
  }

  function renderInlineEditor() {
    if (!editTarget) return null;

    return (
      <div className="editor-wrap">
        <textarea
          ref={editTextareaRef}
          className="inline-editor"
          value={editTarget.value}
          onChange={(event) => {
            setEditTarget({ ...editTarget, value: event.target.value });
            autoResize(event.currentTarget);
          }}
          onKeyDown={handleEditKeyDown}
          onBlur={saveEdit}
        />
        <div className="shortcut-hint">Ctrl/⌘ + Enter 保存，Esc 取消</div>
      </div>
    );
  }

  function renderTaskCard(task: Task, date: string, compact = false) {
    const isEditing =
      editTarget?.kind === "task" &&
      editTarget.id === task.id &&
      editTarget.date === date;

    const selected = selectedTaskId === task.id;

    return (
      <article
        key={task.id}
        data-task-id={task.id}
        className={[
          "task-card",
          compact ? "task-card-compact" : "",
          selected ? "selected-card" : "",
        ].join(" ")}
        title="双击编辑"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button,input,textarea")) return;
          setSelectedTaskId(task.id);
        }}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest("button,input,textarea")) return;
          startTaskEdit(date, task);
        }}
      >
        {!compact && (
          <input
            type="checkbox"
            checked={task.done}
            onChange={() => toggleTask(date, task.id)}
            aria-label={task.done ? "标记为未完成" : "标记为已完成"}
          />
        )}

        <div className="card-content">
          {isEditing ? (
            renderInlineEditor()
          ) : (
            <div className={task.done ? "card-line completed-text" : "card-line"}>
              {firstLine(task.text)}
            </div>
          )}
        </div>

        <button
          className="delete-button"
          onClick={() => deleteTask(date, task.id)}
        >
          删除
        </button>
      </article>
    );
  }

  function renderCalendar() {
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    return (
      <>
        <div className="calendar-header">{year}年{month + 1}月</div>

        <div className="calendar-grid">
          {["日", "一", "二", "三", "四", "五", "六"].map((name) => (
            <div className="weekday" key={name}>{name}</div>
          ))}

          {Array.from({ length: firstDay }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const dateStr = formatDate(new Date(year, month, day));
            const hasTasks = (tasks[dateStr] ?? []).length > 0;

            return (
              <button
                key={dateStr}
                className={
                  selectedDate === dateStr
                    ? "calendar-day calendar-day-selected"
                    : "calendar-day"
                }
                onClick={() => {
                  saveEdit();
                  setSelectedDate(dateStr);
                  setSelectedTaskId(tasks[dateStr]?.[0]?.id ?? null);
                }}
              >
                {day}
                {hasTasks && <span className="task-dot" />}
              </button>
            );
          })}
        </div>

        <section className="calendar-tasks">
          <h3>{selectedDate} 的待办</h3>

          <div className="card-list">
            {(tasks[selectedDate] ?? []).length === 0 ? (
              <div className="empty-state">当天暂无待办</div>
            ) : (
              (tasks[selectedDate] ?? []).map((task) =>
                renderTaskCard(task, selectedDate, true),
              )
            )}
          </div>
        </section>
      </>
    );
  }

  function startWindowDrag(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;

    if (target.closest("button, input, textarea, a")) {
      return;
    }

    void getCurrentWindow().startDragging();
  }

  function minimizeWindow() {
    void getCurrentWindow().minimize();
  }

  function toggleMaximizeWindow() {
    void getCurrentWindow().toggleMaximize();
  }

  function closeWindow() {
    void getCurrentWindow().close();
  }

  return (
    <div className={floatingMode ? "app-shell floating-mode" : "app-shell"}>
      <header
        className="topbar"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      >
        <div className="title-area" data-tauri-drag-region>
          <h1 data-tauri-drag-region>
            {page === "todo" ? "待办" : page === "note" ? "笔记" : "日历"}
          </h1>
          <div className={`save-state save-${saveState}`} data-tauri-drag-region>
            {saveState === "saving"
              ? "正在保存…"
              : saveState === "error"
                ? "保存失败"
                : "已保存到本机"}
          </div>
        </div>

        <div className="desktop-shortcuts" data-tauri-drag-region>
          ←→ 切换　↑↓ 选择　空格编辑　Delete 删除
        </div>

        <div className="window-controls">
          <button
            type="button"
            className="window-control"
            onClick={minimizeWindow}
            title="最小化"
            aria-label="最小化"
          >
            —
          </button>
          <button
            type="button"
            className="window-control"
            onClick={toggleMaximizeWindow}
            title="最大化/还原"
            aria-label="最大化或还原"
          >
            □
          </button>
          <button
            type="button"
            className="window-control window-close"
            onClick={closeWindow}
            title="关闭"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
      </header>

      <main className="content-area">
        {page === "todo" && (
          <section className="section-stack">
            <div className="section-heading normal-only">
              <h2>进行中（{todayStr}）</h2>
              <button className="secondary-button" onClick={copyToTomorrow}>
                复制到明日
              </button>
            </div>

            <div className="card-list">
              {activeTasks.map((task) => renderTaskCard(task, todayStr))}
              {activeTasks.length === 0 && (
                <div className="empty-state">暂无进行中的待办</div>
              )}
            </div>

            <h2 className="completed-heading normal-only">已完成</h2>

            <div className="card-list completed-list normal-only">
              {completedTasks.map((task) => renderTaskCard(task, todayStr))}
              {completedTasks.length === 0 && (
                <div className="empty-state">暂无已完成待办</div>
              )}
            </div>
          </section>
        )}

        {page === "note" && (
          <section className="card-list">
            {notes.length === 0 ? (
              <div className="empty-state">暂无笔记</div>
            ) : (
              notes.map((note) => {
                const isEditing =
                  editTarget?.kind === "note" && editTarget.id === note.id;

                return (
                  <article
                    key={note.id}
                    className="note-card"
                    title="双击编辑"
                    onDoubleClick={(event) => {
                      if ((event.target as HTMLElement).closest("button,textarea")) return;
                      startNoteEdit(note);
                    }}
                  >
                    <div className="card-content">
                      {isEditing ? (
                        renderInlineEditor()
                      ) : (
                        <div className="card-line">{firstLine(note.text)}</div>
                      )}
                    </div>

                    <button
                      className="delete-button"
                      onClick={() => deleteNote(note.id)}
                    >
                      删除
                    </button>
                  </article>
                );
              })
            )}
          </section>
        )}

        {page === "calendar" && (
          <section className="calendar-section">{renderCalendar()}</section>
        )}
      </main>

      <button
        className="floating-add"
        onClick={openNewModal}
        title="新建（Ctrl/⌘ + N）"
        aria-label="新建"
      >
        +
      </button>

      <nav className="bottom-nav">
        <button
          className={page === "note" ? "nav-active" : ""}
          onClick={() => switchPage("note")}
        >
          笔记
        </button>
        <button
          className={page === "todo" ? "nav-active" : ""}
          onClick={() => switchPage("todo")}
        >
          待办
        </button>
        <button
          className={page === "calendar" ? "nav-active" : ""}
          onClick={() => switchPage("calendar")}
        >
          日历
        </button>
      </nav>

      {modal.open && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}>
          <form className="modal-card" onSubmit={submitModal}>
            <h2>{modal.kind === "note" ? "新建笔记" : "添加任务"}</h2>

            <textarea
              ref={modalTextareaRef}
              className="modal-textarea"
              value={modal.value}
              placeholder={modal.kind === "note" ? "输入笔记内容…" : "输入任务…"}
              onChange={(event) => {
                setModal((current) => ({
                  ...current,
                  value: event.target.value,
                }));
                autoResize(event.currentTarget);
              }}
              onKeyDown={handleModalKeyDown}
            />

            <div className="shortcut-hint">
              Ctrl/⌘ + Enter 保存，Esc 取消
            </div>

            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={closeModal}>
                取消
              </button>
              <button type="submit" className="primary-button">
                确定
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
