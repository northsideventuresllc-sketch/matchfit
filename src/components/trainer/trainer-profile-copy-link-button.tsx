"use client";

import { useState } from "react";

type Props = {
  /** Absolute or relative URL to copy (e.g. current profile URL). */
  url: string;
  className?: string;
};

export function TrainerProfileCopyLinkButton(props: Props) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  async function copy() {
    setErr(false);
    try {
      await navigator.clipboard.writeText(props.url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      setErr(true);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={props.className}
      aria-label="Copy profile link"
    >
      {err ? "Copy failed" : done ? "Copied!" : "Copy link"}
    </button>
  );
}
