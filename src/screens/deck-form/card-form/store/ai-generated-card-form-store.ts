import { createCardSideField } from "../../deck-form/store/deck-form-store.ts";
import { RequestStore } from "../../../../lib/mobx-request/request-store.ts";
import { makeAutoObservable } from "mobx";
import { formTouchAll, isFormValid } from "mobx-form-lite";
import { screenStore } from "../../../../store/screen-store.ts";
import { assert } from "../../../../lib/typescript/assert.ts";
import { notifyError } from "../../../shared/snackbar/snackbar.tsx";
import { aiSingleCardGenerateRequest } from "../../../../api/api.ts";
import { deckListStore } from "../../../../store/deck-list-store.ts";
import { createCachedCardInputModesRequest } from "../../../../api/create-cached-card-input-modes-request.ts";

export class AiGeneratedCardFormStore {
  form = {
    prompt: createCardSideField(""),
  };
  cardInputModesRequest = createCachedCardInputModesRequest();
  aiSingleCardGenerateRequest = new RequestStore(aiSingleCardGenerateRequest);

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async submit() {
    if (!isFormValid(this.form)) {
      formTouchAll(this.form);
      return;
    }

    const result = await this.aiSingleCardGenerateRequest.execute({
      text: this.form.prompt.value,
      deckId: this.deckId,
    });

    if (result.status === "error") {
      notifyError({
        e: result.error,
        info: "Error while generating single card",
      });
      return;
    }

    if (!result.data.data) {
      notifyError(false, { message: result.data.error });
      return;
    }

    const { card } = result.data.data;
    deckListStore.addCardOptimistic(card);
    screenStore.goOnce({
      type: "deckForm",
      deckId: card.deck_id,
      cardId: card.id,
    });
  }

  get deckId() {
    const { screen } = screenStore;

    assert(
      screen.type === "cardQuickAddForm" || screen.type === "deckForm",
      "Screen does not have deckId",
    );
    assert(screen.deckId);

    return screen.deckId;
  }

  get isSaveLoading() {
    return (
      this.aiSingleCardGenerateRequest.isLoading ||
      this.cardInputModesRequest.isLoading
    );
  }
}
