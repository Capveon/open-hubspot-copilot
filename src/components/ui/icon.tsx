const PATHS = {
  mute: "M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z",
  end: "M6.6 10.8c3.9-3.9 10.9-3.9 14.8 0l.9.9c.4.4.4 1 0 1.4l-1.8 1.8c-.4.4-1 .4-1.4 0l-1.6-1.6c-2.1-1.1-4.6-1.1-6.7 0L9 14.9c-.4.4-1 .4-1.4 0L5.8 13.1c-.4-.4-.4-1 0-1.4l.8-.9Z",
  call: "M6.6 10.8c-.4-.4-.4-1 0-1.4l1.8-1.8c.4-.4 1-.4 1.4 0l1.6 1.6c2.1 1.1 4.6 1.1 6.7 0l1.6-1.6c.4-.4 1-.4 1.4 0l1.8 1.8c.4.4.4 1 0 1.4l-.9.9c-3.9 3.9-10.9 3.9-14.8 0l-.6-.9Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  label,
  size = 22,
}: {
  name: IconName;
  label: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false">
      <title>{label}</title>
      <path fill="currentColor" d={PATHS[name]} />
    </svg>
  );
}
