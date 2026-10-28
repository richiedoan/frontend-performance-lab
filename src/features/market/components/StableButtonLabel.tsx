/** Reserve the widest translated state without exposing hidden labels to assistive tech. */
export function StableButtonLabel({
  active,
  labels,
}: {
  active: string;
  labels: readonly string[];
}) {
  return (
    <span className="stable-button-label">
      {labels.map((label) => (
        <span key={label} aria-hidden="true" className="stable-button-reserve">
          {label}
        </span>
      ))}
      <span>{active}</span>
    </span>
  );
}
