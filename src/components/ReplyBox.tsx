"use client";

import { useState } from "react";
import { renderScript } from "@/lib/scripts";

type Script = { id: string; title: string; body: string };

export function ReplyBox({
  action, scripts, values, disabled,
}: {
  action: (formData: FormData) => Promise<void>;
  scripts: Script[];
  values: Record<string, string>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form action={action} className="space-y-2">
      <select
        className="input"
        value=""
        onChange={(e) => {
          const s = scripts.find((x) => x.id === e.target.value);
          if (s) setText(renderScript(s.body, values));
        }}
      >
        <option value="">Insert a saved script…</option>
        {scripts.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <textarea name="text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" required disabled={disabled} />
      <button className="btn w-full sm:w-auto" disabled={disabled}>Send via Messenger</button>
      <p className="muted text-xs">Sending a personal reply pauses the auto-replies for this conversation. Huwag maglagay ng clinical notes dito.</p>
    </form>
  );
}
