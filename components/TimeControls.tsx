import type { TimeMode } from "@/lib/time";

const OPTIONS: Array<{ value: TimeMode; label: string }> = [
  { value: "eastern", label: "Eastern" },
  { value: "local", label: "Local" },
  { value: "shanghai", label: "Shanghai" },
  { value: "utc", label: "UTC" },
];

export function TimeControls({
  value,
  onChange,
}: {
  value: TimeMode;
  onChange: (mode: TimeMode) => void;
}) {
  return (
    <fieldset className="time-controls">
      <legend>Display time zone</legend>
      <div className="segmented" role="group" aria-label="Display time zone">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
