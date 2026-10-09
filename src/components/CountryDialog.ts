interface ShowOptions {
  /** Country name, shown as the title. */
  name: string;
  /** Whether the country is currently marked visited. */
  visited: boolean;
  /** Called with the chosen state when the user picks a button. */
  onChoose: (visited: boolean) => void;
}

const CLOSE_MS = 240;

/**
 * Small, reusable confirmation dialog: "Have you visited this country?" with
 * Visited / Not yet choices. Minimal dark-glass card over a dimmed backdrop,
 * animated open/close, focus-trapped and keyboard operable (Tab, Enter, Esc).
 *
 * Reused across countries: {@link show} populates and opens it, choosing a
 * button fires `onChoose` and closes; closing any other way changes nothing.
 */
export class CountryDialog {
  private readonly backdrop: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly stateEl: HTMLElement;
  private readonly yesBtn: HTMLButtonElement;
  private readonly noBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  private onChoose: ((visited: boolean) => void) | null = null;
  private lastFocused: HTMLElement | null = null;
  private closeTimer = 0;
  private isOpen = false;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "cdialog-backdrop";
    this.backdrop.hidden = true;
    this.backdrop.innerHTML = `
      <div class="cdialog" role="dialog" aria-modal="true" aria-labelledby="cdialog-title">
        <button type="button" class="cdialog-close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <p class="cdialog-state" hidden></p>
        <h2 class="cdialog-title" id="cdialog-title"></h2>
        <p class="cdialog-q">Have you visited this country?</p>
        <div class="cdialog-actions">
          <button type="button" class="cdialog-btn cdialog-btn--yes">Visited</button>
          <button type="button" class="cdialog-btn cdialog-btn--no">Not yet</button>
        </div>
      </div>`;
    parent.appendChild(this.backdrop);

    this.titleEl = this.backdrop.querySelector(".cdialog-title")!;
    this.stateEl = this.backdrop.querySelector(".cdialog-state")!;
    this.yesBtn = this.backdrop.querySelector(".cdialog-btn--yes")!;
    this.noBtn = this.backdrop.querySelector(".cdialog-btn--no")!;
    this.closeBtn = this.backdrop.querySelector(".cdialog-close")!;

    this.yesBtn.addEventListener("click", () => this.choose(true));
    this.noBtn.addEventListener("click", () => this.choose(false));
    this.closeBtn.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.backdrop.addEventListener("keydown", this.onKeyDown);
  }

  show(opts: ShowOptions): void {
    this.onChoose = opts.onChoose;
    this.titleEl.textContent = opts.name;

    if (opts.visited) {
      this.stateEl.hidden = false;
      this.stateEl.innerHTML =
        `<span class="cdialog-check" aria-hidden="true">✓</span> Currently marked as visited`;
    } else {
      this.stateEl.hidden = true;
    }
    this.yesBtn.classList.toggle("is-current", opts.visited);
    this.noBtn.classList.toggle("is-current", !opts.visited);

    this.lastFocused = document.activeElement as HTMLElement | null;
    window.clearTimeout(this.closeTimer);
    this.backdrop.hidden = false;
    void this.backdrop.offsetWidth; // reflow so the open transition runs
    this.backdrop.classList.add("is-open");
    this.isOpen = true;
    this.yesBtn.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.onChoose = null;
    this.backdrop.classList.remove("is-open");
    this.closeTimer = window.setTimeout(() => {
      this.backdrop.hidden = true;
    }, CLOSE_MS);
    this.lastFocused?.focus?.();
  }

  private choose(visited: boolean): void {
    this.onChoose?.(visited);
    this.close();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== "Tab") return;
    // Trap focus among the three controls (DOM order).
    const focusable: HTMLElement[] = [this.closeBtn, this.yesBtn, this.noBtn];
    const i = focusable.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!e.shiftKey && i === focusable.length - 1) {
      e.preventDefault();
      focusable[0].focus();
    }
  };
}
