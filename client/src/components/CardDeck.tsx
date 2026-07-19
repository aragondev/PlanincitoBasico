import { CARD_VALUES, type CardValue } from "@planincito/shared";
import { PokerCard } from "./PokerCard";

type Props = {
  selected: CardValue | undefined;
  disabled: boolean;
  hint?: string;
  onSelect: (value: CardValue) => void;
};

export function CardDeck({ selected, disabled, hint, onSelect }: Props) {
  return (
    <section className="deck" aria-label="Mazo de cartas">
      <div className="deck__cards">
        {CARD_VALUES.map((value) => (
          <PokerCard
            key={value}
            value={value}
            selected={selected === value}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hint && <p className="deck__hint">{hint}</p>}
    </section>
  );
}
