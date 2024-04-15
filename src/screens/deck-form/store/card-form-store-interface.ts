import { CardFormType } from "./deck-form-store.ts";
import { TextField } from "mobx-form-lite";
import { DeckSpeakFieldEnum } from "../../../../functions/db/deck/decks-with-cards-schema.ts";

export type CardInnerScreenType = "cardPreview" | "cardType" | "example" | null;

export interface CardFormStoreInterface {
  cardForm?: CardFormType | null;
  onSaveCard: () => void;
  onBackCard: () => void;
  cardInnerScreen: TextField<CardInnerScreenType>;
  isSending: boolean;
  markCardAsRemoved?: () => void;

  form?: {
    speakingCardsLocale: TextField<string | null>;
    speakingCardsField: TextField<DeckSpeakFieldEnum | null>;
  };

  // Navigation next and previous card
  isPreviousCardVisible?: boolean;
  isNextCardVisible?: boolean;
  onPreviousCard?: () => void;
  onNextCard?: () => void;
}
