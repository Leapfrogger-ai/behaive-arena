"use client";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setStatus("error");
      setMsg(error.message);
    } else {
      setStatus("sent");
      setMsg("Check your email for a magic link.");
    }
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          required
          placeholder="researcher@lab.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #242a37",
            background: "#0f1218",
            color: "#e6e8ee",
            width: "100%",
            maxWidth: 360,
          }}
        />
        <div style={{ marginTop: 12 }}>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #3a4a6a",
              background: "#1d3a5f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Send magic link
          </button>
        </div>
      </form>
      {status !== "idle" && (
        <p className={status === "error" ? "muted" : undefined}>{msg}</p>
      )}
    </main>
  );
}
