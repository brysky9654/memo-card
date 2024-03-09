import { observer } from "mobx-react-lite";
import { useReviewStore } from "./store/review-store-context.tsx";
import { useMount } from "../../lib/react/use-mount.ts";
import { deckListStore } from "../../store/deck-list-store.ts";
import { DeckFinished } from "./deck-finished.tsx";
import { Review } from "./review.tsx";
import React from "react";
import { Hint } from "../../ui/hint.tsx";
import { t } from "../../translations/t.ts";
import { WantMoreCardsButton } from "./want-more-cards-button.tsx";
import { Flex } from "../../ui/flex.tsx";

export const RepeatAllScreen = observer(() => {
  const reviewStore = useReviewStore();

  useMount(() => {
    reviewStore.startAllRepeatReview(deckListStore.myDecks);
  });

  if (reviewStore.isFinished) {
    return (
      <DeckFinished
        type={"repeat_all"}
        newCardsCount={deckListStore.newCardsCount}
      />
    );
  } else if (reviewStore.currentCardId) {
    return <Review />;
  }

  return (
    <Flex direction={"column"} gap={8}>
      <Hint>{t("no_cards_to_review_all")}</Hint>
      {deckListStore.newCardsCount > 0 ? (
        <Hint>
          <WantMoreCardsButton newCardsCount={deckListStore.newCardsCount} />
        </Hint>
      ) : null}
    </Flex>
  );
});
