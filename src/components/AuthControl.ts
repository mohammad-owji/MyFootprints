import type { User } from "@/storage/firebase";

interface AuthControlOptions {
  onSignIn: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
}

/**
 * Minimal sign-in control shown in a screen corner. Renders a "Sign in" button
 * when signed out and the user's avatar + a "Sign out" action when signed in.
 * Purely presentational: it reports intent via callbacks and is told the user
 * via {@link setUser}.
 */
export class AuthControl {
  readonly el: HTMLDivElement;
  private busy = false;

  constructor(private readonly opts: AuthControlOptions) {
    this.el = document.createElement("div");
    this.el.className = "auth-control";
    this.setUser(null);
  }

  setUser(user: User | null): void {
    this.busy = false;
    this.el.innerHTML = user ? this.signedInMarkup(user) : this.signedOutMarkup();
    this.wire(user);
  }

  private signedOutMarkup(): string {
    return `
      <button type="button" class="auth-btn" aria-label="Sign in to sync your countries">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path fill="currentColor" d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 12c-4.2 0-8 2.2-8 5v1h16v-1c0-2.8-3.8-5-8-5z"/>
        </svg>
        <span>Sign in</span>
      </button>`;
  }

  private signedInMarkup(user: User): string {
    const name = user.displayName || user.email || "Signed in";
    const initial = (name.trim()[0] || "?").toUpperCase();
    const avatar = user.photoURL
      ? `<img class="auth-avatar" src="${user.photoURL}" alt="" referrerpolicy="no-referrer" />`
      : `<span class="auth-avatar auth-avatar--letter" aria-hidden="true">${initial}</span>`;
    return `
      ${avatar}
      <span class="auth-name" title="${name}">${name}</span>
      <button type="button" class="auth-signout" aria-label="Sign out">Sign out</button>`;
  }

  private wire(user: User | null): void {
    if (user) {
      this.el
        .querySelector<HTMLButtonElement>(".auth-signout")
        ?.addEventListener("click", () => this.run(this.opts.onSignOut));
    } else {
      this.el
        .querySelector<HTMLButtonElement>(".auth-btn")
        ?.addEventListener("click", () => this.run(this.opts.onSignIn));
    }
  }

  private async run(action: () => void | Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } catch (err) {
      // Popup closed, blocked, or network error: let the user try again.
      console.error("Auth action failed:", err);
      this.busy = false;
    }
  }
}
