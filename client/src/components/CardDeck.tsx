import { CARD_VALUES, type CardValue } from "@planincito/shared";
import { cardAriaLabel, cardLabel } from "./PokerCard";

type Props = {
  selected: CardValue | undefined;
  disabled: boolean;
  hint?: string;
  onSelect: (value: CardValue) => void;
};

/** Mazo fijo al pie de la pantalla; se desplaza en horizontal si no cabe. */
export function CardDeck({ selected, disabled, hint, onSelect }: Props) {
  return (
    <section className="deck" aria-label="Mazo de cartas">
      {hint && <p className="deck__hint">{hint}</p>}
      <div className="deck__cards">
        {CARD_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`deck__card${selected === value ? " deck__card--selected" : ""}`}
            aria-pressed={selected === value}
            aria-label={cardAriaLabel(value)}
            disabled={disabled}
            onClick={() => onSelect(value)}
          >
            {cardLabel(value)}
          </button>
        ))}
      </div>
    </section>
  );
}
