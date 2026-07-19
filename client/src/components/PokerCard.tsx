import type { CardValue } from "@planincito/shared";

export function cardLabel(value: CardValue): string {
  return value === "coffee" ? "☕" : value;
}

export function cardAriaLabel(value: CardValue): string {
  if (value === "coffee") return "Pausa";
  if (value === "?") return "Sin estimación";
  return `${value} puntos`;
}

type Props = {
  value: CardValue;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (value: CardValue) => void;
};

export function PokerCard({ value, selected = false, disabled = false, onSelect }: Props) {
  if (!onSelect) {
    return (
      <span className="card card--static" aria-label={cardAriaLabel(value)}>
        {cardLabel(value)}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`card${selected ? " card--selected" : ""}`}
      aria-pressed={selected}
      aria-label={cardAriaLabel(value)}
      disabled={disabled}
      onClick={() => onSelect(value)}
    >
      {cardLabel(value)}
    </button>
  );
}
