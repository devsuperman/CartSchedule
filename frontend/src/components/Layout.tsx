import type { PropsWithChildren } from "react";

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-header__title">CartSchedule</span>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
