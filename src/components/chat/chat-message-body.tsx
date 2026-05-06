"use client";

import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<]+[^.,)\s\]]?)/gi;

/** Renders chat text with clickable https links (Stripe checkout, FitHub, etc.). */
export function ChatMessageBody(props: { text: string; linkClassName?: string }) {
  const { text, linkClassName } = props;
  const parts = text.split(URL_RE);
  return (
    <p className="mt-1 min-w-0 max-w-full whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//i)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={
                linkClassName
                  ? `${linkClassName} inline-block max-w-full break-all`
                  : "inline-block max-w-full break-all font-medium text-[#FF9A4A] underline decoration-[#FF9A4A]/40 underline-offset-2 hover:text-[#FFB574]"
              }
            >
              {part}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
