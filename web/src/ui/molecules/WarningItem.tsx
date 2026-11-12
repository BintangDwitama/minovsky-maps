export interface WarningItemProps {
  code: string;
  message: string;
  active: boolean;
  locatable: boolean;
  onSelect(): void;
}

export function WarningItem({ code, message, active, locatable, onSelect }: WarningItemProps) {
  return (
    <button
      type="button"
      className="warning-item"
      aria-pressed={active}
      title={locatable ? 'Show on board' : undefined}
      onClick={onSelect}
    >
      <span className="warning-item__code">{code}</span>
      {message}
    </button>
  );
}
