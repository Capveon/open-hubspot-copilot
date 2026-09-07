"use client";

import { Brand } from "./ui/brand";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * One bar, three things: the wordmark (which is home), where you are, who you are.
 * Nothing else belongs up here — a control that lands you back on the page you are
 * already looking at is not navigation.
 */
type Desk = { label: string } | null;

const SetDesk = createContext<(desk: Desk) => void>(() => {});

/** Live desk: full-bleed bar carrying the queue you are working, three panes own the rest. */
export function useDeskChrome(label: string) {
  const set = useContext(SetDesk);
  useEffect(() => {
    set({ label });
    return () => set(null);
  }, [label, set]);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [desk, setDesk] = useState<Desk>(null);
  const signedOut = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  return (
    <SetDesk.Provider value={setDesk}>
      <div className={desk ? "shell shell--desk" : "shell"}>
        <header className="bar">
          <div className="bar__in">
            {signedOut ? (
              <span className="bar__brand">
                <Brand product />
              </span>
            ) : (
              <Link href="/" className="bar__brand" aria-label="Home">
                <Brand product />
              </Link>
            )}
            {desk ? <span className="bar__ctx">{desk.label}</span> : null}
            {signedOut ? null : (
              <div className="bar__right">
                <UserButton />
              </div>
            )}
          </div>
        </header>
        {children}
      </div>
    </SetDesk.Provider>
  );
}
