import { observer } from "mobx-react-lite";
import { Screen } from "../shared/screen.tsx";
import { useBackButton } from "../../lib/platform/use-back-button.ts";
import { useAiMassCreationStore } from "./store/ai-mass-creation-store-provider.tsx";
import { useMainButton } from "../../lib/platform/use-main-button.ts";
import { List } from "../../ui/list.tsx";
import { ListHeader } from "../../ui/list-header.tsx";
import { assert } from "../../lib/typescript/assert.ts";
import { css, cx } from "@emotion/css";
import { reset } from "../../ui/reset.ts";
import { theme } from "../../ui/theme.tsx";
import React from "react";
import { t } from "../../translations/t.ts";
import { screenStore } from "../../store/screen-store.ts";
import { useProgress } from "../../lib/platform/use-progress.tsx";
import { CardNumber } from "../../ui/card-number.tsx";
import { translateAddCards } from "./translations.ts";

export const CardsGeneratedScreen = observer(() => {
  const store = useAiMassCreationStore();
  assert(store.massCreationForm);
  const screen = screenStore.screen;
  assert(screen.type === "aiMassCreation");

  useBackButton(() => {
    store.onQuitBack();
  });

  useMainButton(
    () => {
      assert(store.massCreationForm);
      const count = store.massCreationForm.cards.value.length;
      return translateAddCards(count);
    },
    () => {
      store.submitMassCreationForm();
    },
  );

  useProgress(() => store.addCardsMultipleRequest.isLoading);

  return (
    <Screen
      title={t("cards_add")}
      subtitle={
        screen.deckTitle ? (
          <div className={css({ textAlign: "center", fontSize: 14 })}>
            {t("deck")}{" "}
            <button
              onClick={() => {
                store.onQuitToDeck();
              }}
              className={cx(
                reset.button,
                css({ fontSize: "inherit", color: theme.linkColor }),
              )}
            >
              {screen.deckTitle}
            </button>
          </div>
        ) : undefined
      }
    >
      <div>
        <ListHeader text={t("ai_cards_by_ai")} />
        <List
          items={store.massCreationForm.cards.value.map((card, i) => ({
            onClick: () => {
              assert(store.massCreationForm);
              store.massCreationForm.selectedCardIndex.onChange(i);
            },
            text: (
              <div>
                <div>
                  <CardNumber number={i + 1} />
                  {card.front}
                </div>
                <div
                  className={css({
                    color: theme.hintColor,
                    fontSize: 14,
                  })}
                >
                  {card.back}
                </div>
              </div>
            ),
            right: store.canDeleteGeneratedCard ? (
              <button
                className={cx(
                  reset.button,
                  css({ paddingTop: 4, fontSize: 16 }),
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  store.deleteGeneratedCard(i);
                }}
              >
                <i
                  className={cx(
                    "mdi mdi-delete-circle mdi-24px",
                    css({ color: theme.danger }),
                  )}
                />
              </button>
            ) : undefined,
          }))}
        />
      </div>
    </Screen>
  );
});
