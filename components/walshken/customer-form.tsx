"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type Action = "sign-in" | "sign-up" | "sign-out" | "request" | "profile" | "password";

export function CustomerForm({ action, children, label, to, enabled = true, compact = false }: {
  action: Action; children?: ReactNode; label: string; to?: string; enabled?: boolean; compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || pending) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setNotice(undefined);
    try {
      const response = await fetch(`/api/customer/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (to) {
        window.location.assign(to);
        return;
      }
      setNotice({ text: result.message || "Saved.", error: false });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Please try again.", error: true });
    } finally {
      setPending(false);
    }
  }

  return <form className={compact ? "customer-sign-out" : "customer-form"} method="post" action={`/api/customer/${action}`} onSubmit={submit}>
    {children}
    <button type="submit" className={compact ? "btn btn-outline btn-small" : "btn btn-blue"} disabled={pending || !enabled}>
      {pending ? "Please wait…" : label}
    </button>
    {notice && <p className={notice.error ? "form-error" : "form-success"} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
  </form>;
}
