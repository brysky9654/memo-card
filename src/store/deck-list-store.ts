import { action, makeAutoObservable, runInAction, when } from "mobx";
import {
  addDeckToMineRequest,
  addFolderToMineRequest,
  deckWithCardsRequest,
  deleteFolderRequest,
  duplicateDeckRequest,
  duplicateFolderRequest,
  getFolderWithDecksCards,
  getSharedDeckRequest,
  myInfoRequest,
  removeDeckFromMineRequest,
} from "../api/api.ts";
import { type MyInfoResponse } from "../../functions/my-info.ts";
import {
  type DeckCardDbType,
  type DeckWithCardsDbType,
} from "../../functions/db/deck/decks-with-cards-schema.ts";
import { screenStore } from "./screen-store.ts";
import {
  CardReviewType,
  type CardToReviewDbType,
} from "../../functions/db/deck/get-cards-to-review-db.ts";
import { assert } from "../lib/typescript/assert.ts";
import { ReviewStore } from "../screens/deck-review/store/review-store.ts";
import { reportHandledError } from "../lib/rollbar/rollbar.tsx";
import { BooleanToggle } from "mobx-form-lite";
import { userStore } from "./user-store.ts";
import { showConfirm } from "../lib/platform/show-confirm.ts";
import { t } from "../translations/t.ts";
import { canDuplicateDeckOrFolder } from "../../shared/access/can-duplicate-deck-or-folder.ts";
import { hapticImpact } from "../lib/platform/telegram/haptics.ts";
import { FolderWithDecksWithCards } from "../../functions/db/folder/get-folder-with-decks-with-cards-db.ts";
import { type FolderWithDeckIdDbType } from "../../functions/db/folder/schema.ts";
import { CatalogFolderDbType } from "../../functions/db/folder/get-public-folders-with-decks-db.ts";
import {
  notifyPaymentFailed,
  notifyPaymentSuccess,
} from "../screens/shared/notify-payment.ts";
import { RequestStore } from "../lib/mobx-request/request-store.ts";
import { notifyError } from "../screens/shared/snackbar/snackbar.tsx";

export enum StartParamType {
  RepeatAll = "repeat_all",
  DeckCatalog = "catalog",
  Pro = "pro",
  Components = "ui_kit",
  WalletPaymentSuccessful = "wp_success",
  WalletPaymentFailed = "wp_fail",
  Debug = "debug",
  Break = "break",
}

export type DeckCardDbTypeWithType = DeckCardDbType & {
  type: CardReviewType;
};

export type DeckWithCardsWithReviewType = DeckWithCardsDbType & {
  cardsToReview: DeckCardDbTypeWithType[];
};

export type DeckListItem = {
  id: number;
  cardsToReview: DeckCardDbTypeWithType[];
  name: string;
  description: string | null;
} & (
  | {
      type: "deck";
    }
  | {
      type: "folder";
      decks: DeckWithCardsWithReviewType[];
      authorId: number;
      shareId: string;
    }
);

const collapsedDecksLimit = 3;

export class DeckListStore {
  myInfo?: Exclude<MyInfoResponse, "plans" | "user">;
  myInfoRequest = new RequestStore(myInfoRequest, {
    staleWhileRevalidate: true,
  });

  isAppLoading = false;
  isStartParamHandled = false;

  skeletonLoaderData = { publicCount: 3, myDecksCount: 3 };

  deckWithCardsRequest = new RequestStore(deckWithCardsRequest);
  isMyDecksExpanded = new BooleanToggle(false);

  catalogFolder?: FolderWithDecksWithCards;
  getFolderWithDecksCards = new RequestStore(getFolderWithDecksCards);

  constructor() {
    makeAutoObservable(
      this,
      { searchDeckById: false, hasFolderInMine: false },
      { autoBind: true },
    );
  }

  get isCatalogItemLoading() {
    return (
      this.deckWithCardsRequest.isLoading ||
      this.getFolderWithDecksCards.isLoading
    );
  }

  loadFirstTime(startParam?: string) {
    this.load();
    this.handleStartParam(startParam);
  }

  private addFolder(folder: FolderWithDecksWithCards) {
    assert(this.myInfo);
    if (
      this.myInfo.folders.find((myFolder) => myFolder.folder_id === folder.id)
    ) {
      screenStore.go({ type: "folderPreview", folderId: folder.id });
      return;
    }

    for (const deck of folder.decks) {
      // Push new folders
      this.myInfo.folders.push({
        deck_id: deck.id,
        folder_id: folder.id,
        folder_author_id: folder.author_id,
        folder_description: folder.description,
        folder_share_id: folder.share_id,
        folder_title: folder.title,
      });
      // Push new decks
      this.myInfo.myDecks.push(deck);
      // Push new cards
      this.myInfo.cardsToReview = this.myInfo.cardsToReview.concat(
        deck.deck_card.map((card) => ({
          id: card.id,
          deck_id: deck.id,
          type: "new",
        })),
      );
    }
    screenStore.go({ type: "folderPreview", folderId: folder.id });
  }

  addCardOptimistic(card: DeckCardDbType) {
    const deck = this.searchDeckById(card.deck_id);
    if (!deck || !this.myInfo) {
      return;
    }
    deck.deck_card.push(card);
    this.myInfo.cardsToReview.push({
      ...card,
      type: "new",
    });
  }

  async openFolderFromCatalog(folderWithoutDecks: CatalogFolderDbType) {
    assert(this.myInfo);
    if (
      this.myInfo.folders.find(
        (myFolder) => myFolder.folder_id === folderWithoutDecks.id,
      )
    ) {
      screenStore.go({
        type: "folderPreview",
        folderId: folderWithoutDecks.id,
      });
      return;
    }

    this.catalogFolder = {
      ...folderWithoutDecks,
      decks: [],
    };
    screenStore.go({ type: "folderPreview", folderId: this.catalogFolder.id });

    const result = await this.getFolderWithDecksCards.execute(
      folderWithoutDecks.id,
    );
    if (result.status === "error") {
      notifyError({
        e: result.error,
        info: `Error while retrieving folder: ${folderWithoutDecks.id}`,
      });
      return;
    }

    const { folder } = result.data;
    runInAction(() => {
      this.catalogFolder = folder;
    })
  }

  get canReview() {
    const deck = this.selectedDeck;
    if (!deck) {
      return false;
    }

    return (
      deck.cardsToReview.length > 0 || screenStore.screen.type === "deckPublic"
    );
  }

  startDeckReview(reviewStore: ReviewStore) {
    if (!this.canReview) {
      return;
    }

    assert(this.selectedDeck, "No selected deck for review");
    if (screenStore.screen.type === "deckPublic") {
      this.addDeckToMine(this.selectedDeck.id);
    }

    reviewStore.startDeckReview(this.selectedDeck);
  }

  addDeckToMine(deckId: number) {
    return addDeckToMineRequest({
      deckId,
    })
      .then(() => {
        this.load();
      })
      .catch((error) => {
        reportHandledError("Error while adding deck to mine", error, {
          deckId,
        });
      });
  }

  addFolderToMine(folderId: number) {
    return addFolderToMineRequest({
      folderId,
    })
      .then(
        action(() => {
          this.catalogFolder = undefined;
          this.load();
        }),
      )
      .catch((error) => {
        reportHandledError("Error while adding folder to mine", error, {
          folderId,
        });
      });
  }

  get canEditDeck() {
    const deck = this.selectedDeck;
    if (!deck) {
      return false;
    }
    return deck.author_id === userStore.myId || userStore.isAdmin;
  }

  async openDeckFromCatalog(deck: DeckWithCardsDbType, isMine: boolean) {
    assert(this.myInfo);
    if (isMine) {
      screenStore.go({ type: "deckMine", deckId: deck.id });
      return;
    }
    if (!this.publicDecks.find((publicDeck) => publicDeck.id === deck.id)) {
      this.myInfo.publicDecks.push(deck);
    }
    screenStore.go({ type: "deckPublic", deckId: deck.id });

    const result = await this.deckWithCardsRequest.execute(deck.id);
    if (result.status === "error") {
      notifyError({ e: result.error, info: `Error opening deck: ${deck.id}` });
      return;
    }
    this.replaceDeck(result.data);
  }

  goDeckById(deckId: number) {
    if (!this.myInfo) {
      return null;
    }
    const myDeck = this.myInfo.myDecks.find((deck) => deck.id === deckId);
    if (myDeck) {
      screenStore.go({ type: "deckMine", deckId });
      return;
    }
    const publicDeck = this.publicDecks.find((deck) => deck.id === deckId);
    if (publicDeck) {
      screenStore.go({ type: "deckPublic", deckId });
      return;
    }
  }

  searchDeckById(deckId: number) {
    if (!this.myInfo) {
      return null;
    }
    const decksToSearch = this.myInfo.myDecks.concat(this.publicDecks);
    return decksToSearch.find((deck) => deck.id === deckId);
  }

  reviewFolder(reviewStore: ReviewStore) {
    const folder = this.selectedFolder;
    assert(folder, "Folder should be selected before review");

    if (folder.id === this.catalogFolder?.id) {
      this.addFolderToMine(folder.id);
    }

    reviewStore.startFolderReview(folder.decks);
  }

  get selectedFolder() {
    const screen = screenStore.screen;
    if (screen.type !== "folderPreview" || !this.myInfo) {
      return null;
    }

    if (this.catalogFolder?.id === screen.folderId) {
      const decksWithCardsToReview = this.catalogFolder.decks.map((deck) => ({
        ...deck,
        cardsToReview: deck.deck_card.map((card) => ({
          ...card,
          type: "new" as const,
        })),
      }));

      return {
        type: "folder" as const,
        decks: decksWithCardsToReview,
        cardsToReview: decksWithCardsToReview.reduce<DeckCardDbTypeWithType[]>(
          (acc, deck) => acc.concat(deck.cardsToReview),
          [],
        ),
        shareId: this.catalogFolder.share_id,
        authorId: this.catalogFolder.author_id,
        name: this.catalogFolder.title,
        id: this.catalogFolder.id,
        description: this.catalogFolder.description,
      };
    }

    const folder = this.myFoldersAsDecks.find(
      (folder) => folder.id === screen.folderId,
    );

    if (!folder) {
      return null;
    }
    assert(folder.type === "folder", "folder is not folder type");

    return folder;
  }

  get canEditFolder() {
    const folder = this.selectedFolder;
    if (!folder) {
      return false;
    }
    if (!this.hasFolderInMine(folder.id)) {
      return false;
    }

    return folder.authorId === userStore.myId || userStore.isAdmin;
  }

  hasFolderInMine(folderId: number) {
    return !!this.myFoldersAsDecks.find(({ id }) => id === folderId);
  }

  get canDuplicateSelectedFolder() {
    const folder = this.selectedFolder;
    if (!folder) {
      return false;
    }
    const user = userStore.user;
    if (!user) {
      return false;
    }

    return canDuplicateDeckOrFolder(
      user,
      { author_id: folder.authorId },
      userStore.plans,
    );
  }

  get canDuplicateSelectedDeck() {
    const deck = this.selectedDeck;
    if (!deck) {
      return false;
    }
    const user = userStore.user;
    if (!user) {
      return false;
    }

    return canDuplicateDeckOrFolder(
      user,
      { author_id: deck.author_id },
      userStore.plans,
    );
  }

  get isFolderReviewVisible() {
    return this.selectedFolder
      ? this.selectedFolder.cardsToReview.length > 0
      : false;
  }

  get selectedDeck(): DeckWithCardsWithReviewType | null {
    const screen = screenStore.screen;
    const isSelectedDeckVisible =
      screen.type === "deckPublic" || screen.type === "deckMine";
    if (!isSelectedDeckVisible) {
      return null;
    }
    if (!screen.deckId || !this.myInfo) {
      return null;
    }

    const deck = this.searchDeckById(screen.deckId);
    if (!deck) {
      return null;
    }

    const cardsToReview =
      screen.type === "deckPublic"
        ? deck.deck_card.map((card) => ({ ...card, type: "new" as const }))
        : getCardsToReview(deck, this.myInfo.cardsToReview);

    return {
      ...deck,
      cardsToReview: cardsToReview,
    };
  }

  replaceDeck(deck: DeckWithCardsDbType, addToMine = false) {
    if (!this.myInfo) {
      return;
    }
    const deckMineIndex = this.myInfo.myDecks.findIndex(
      (myDeck) => myDeck.id === deck.id,
    );
    if (deckMineIndex !== -1) {
      this.myInfo.myDecks[deckMineIndex] = deck;
      return;
    }

    const deckPublicIndex = this.myInfo.publicDecks.findIndex(
      (publicDeck) => publicDeck.id === deck.id,
    );
    if (deckPublicIndex !== -1) {
      this.myInfo.publicDecks[deckPublicIndex] = deck;
      return;
    }

    if (addToMine) {
      this.myInfo.myDecks.push(deck);
    }
  }

  updateDeckCardInputMode(deckId: number, cardInputModeId: string | null) {
    const deck = this.searchDeckById(deckId);
    if (!deck) {
      return null;
    }
    deck.card_input_mode_id = cardInputModeId;
  }

  get publicDecks() {
    if (!this.myInfo) {
      return [];
    }
    const myDeckIds = this.myInfo.myDecks.map((deck) => deck.id);
    return this.myInfo.publicDecks.filter(
      (publicDeck) => !myDeckIds.includes(publicDeck.id),
    );
  }

  get myDecks(): DeckWithCardsWithReviewType[] {
    if (!this.myInfo) {
      return [];
    }
    const cardsToReview = this.myInfo.cardsToReview;

    return this.myInfo.myDecks.map((deck) => ({
      ...deck,
      cardsToReview: getCardsToReview(deck, cardsToReview),
    }));
  }

  get myDecksWithoutFolder(): DeckListItem[] {
    // filter my decks if they are not in this.myInfo.folders
    const decksWithinFolder =
      this.myInfo?.folders.map((folder) => folder.deck_id) ?? [];

    return this.myDecks
      .filter((deck) => !decksWithinFolder.includes(deck.id))
      .map((deck) => ({
        ...deck,
        type: "deck",
      }));
  }

  get myFoldersAsDecks(): DeckListItem[] {
    if (!this.myInfo || this.myInfo.folders.length === 0) {
      return [];
    }

    const myDecks: DeckWithCardsWithReviewType[] = this.myDecks;

    const map = new Map<
      number,
      {
        folderName: string;
        folderDescription: string | null;
        folderAuthorId: number;
        folderShareId: string;
        decks: DeckWithCardsWithReviewType[];
      }
    >();

    this.myInfo.folders.forEach((folder) => {
      const mapItem = map.get(folder.folder_id) ?? {
        folderName: folder.folder_title,
        folderDescription: folder.folder_description,
        folderAuthorId: folder.folder_author_id,
        folderShareId: folder.folder_share_id,
        decks: [],
      };
      const deck = myDecks.find((deck) => deck.id === folder.deck_id);
      if (deck) {
        mapItem.decks.push(deck);
      }
      map.set(folder.folder_id, mapItem);
    });

    return Array.from(map.entries()).map(([folderId, mapItem]) => ({
      id: folderId,
      decks: mapItem.decks,
      cardsToReview: mapItem.decks.reduce<DeckCardDbTypeWithType[]>(
        (acc, deck) => acc.concat(deck.cardsToReview),
        [],
      ),
      type: "folder",
      name: mapItem.folderName,
      shareId: mapItem.folderShareId,
      description: mapItem.folderDescription,
      authorId: mapItem.folderAuthorId,
    }));
  }

  get shouldShowMyDecksToggle() {
    return this.myDecks.length > collapsedDecksLimit;
  }

  get myDeckItemsVisible(): DeckListItem[] {
    const sortedListItems = this.myFoldersAsDecks
      .concat(this.myDecksWithoutFolder)
      .sort((a, b) => {
        // sort decks by cardsToReview count with type 'repeat' first, then with type 'new'
        const aRepeatCount = a.cardsToReview.filter(
          (card) => card.type === "repeat",
        ).length;

        const bRepeatCount = b.cardsToReview.filter(
          (card) => card.type === "repeat",
        ).length;

        if (aRepeatCount !== bRepeatCount) {
          return bRepeatCount - aRepeatCount;
        }

        const aNewCount = a.cardsToReview.length - aRepeatCount;
        const bNewCount = b.cardsToReview.length - bRepeatCount;
        if (aNewCount !== bNewCount) {
          return bNewCount - aNewCount;
        }
        return a.name.localeCompare(b.name);
      });

    if (this.isMyDecksExpanded.value) {
      return sortedListItems;
    }
    return sortedListItems.slice(0, collapsedDecksLimit);
  }

  get areAllDecksReviewed() {
    return (
      this.myDecks.length > 0 &&
      this.myDecks.every((deck) => deck.cardsToReview.length === 0)
    );
  }

  get newCardsCount() {
    return this.myDecks.reduce((acc, deck) => {
      return (
        acc + deck.cardsToReview.filter((card) => card.type === "new").length
      );
    }, 0);
  }

  deleteFolder() {
    const folder = this.selectedFolder;
    if (!folder) {
      return;
    }

    hapticImpact("heavy");
    this.isAppLoading = true;

    deleteFolderRequest(folder.id)
      .then(() => myInfoRequest())
      .then(
        action((result) => {
          this.myInfo = result;
          screenStore.go({ type: "main" });
        }),
      )
      .catch((e) => {
        reportHandledError(`Unable to remove deck ${folder.id}`, e);
      })
      .finally(
        action(() => {
          this.isAppLoading = false;
        }),
      );
  }

  removeDeck() {
    const deck = this.selectedDeck;
    if (!deck) {
      return;
    }

    hapticImpact("heavy");
    this.isAppLoading = true;

    removeDeckFromMineRequest({ deckId: deck.id })
      .then(() => myInfoRequest())
      .then(
        action((result) => {
          this.myInfo = result;
          screenStore.go({ type: "main" });
        }),
      )
      .catch((e) => {
        reportHandledError(`Unable to remove deck ${deck.id}`, e);
      })
      .finally(
        action(() => {
          this.isAppLoading = false;
        }),
      );
  }

  updateFolders(body: FolderWithDeckIdDbType[]) {
    if (!this.myInfo) {
      return;
    }
    this.myInfo.folders = body;
  }

  updateCardsToReview(body: CardToReviewDbType[]) {
    if (!this.myInfo) {
      return;
    }
    this.myInfo.cardsToReview = body;
  }

  async load() {
    const result = await this.myInfoRequest.execute();
    if (result.status === "error") {
      return;
    }
    runInAction(() => {
      this.myInfo = result.data;
    });
    userStore.setUser(result.data.user, result.data.plans);
  }

  async onDuplicateDeck(deckId: number) {
    const isConfirmed = await showConfirm(t("duplicate_deck_confirm"));
    if (!isConfirmed) {
      return;
    }

    hapticImpact("heavy");
    runInAction(() => {
      this.isAppLoading = true;
    });
    duplicateDeckRequest(deckId)
      .then(() => {
        screenStore.go({ type: "main" });
      })
      .finally(
        action(() => {
          this.isAppLoading = false;
        }),
      );
  }

  async onDuplicateFolder(folderId: number) {
    const isConfirmed = await showConfirm(t("duplicate_folder_confirm"));
    if (!isConfirmed) {
      return;
    }

    hapticImpact("heavy");
    runInAction(() => {
      this.isAppLoading = true;
    });
    duplicateFolderRequest(folderId)
      .then(() => {
        screenStore.go({ type: "main" });
      })
      .finally(
        action(() => {
          this.isAppLoading = false;
        }),
      );
  }

  async handleStartParam(startParam?: string) {
    if (this.isStartParamHandled) {
      return;
    }
    this.isStartParamHandled = true;
    if (!startParam) {
      return;
    }

    if (startParam === StartParamType.RepeatAll) {
      this.isAppLoading = true;
      when(() => !!this.myInfo)
        .then(() => {
          screenStore.go({ type: "reviewAll" });
        })
        .finally(
          action(() => {
            this.isAppLoading = false;
          }),
        );
    } else if (startParam === StartParamType.DeckCatalog) {
      screenStore.go({ type: "deckCatalog" });
    } else if (startParam === StartParamType.WalletPaymentSuccessful) {
      this.startCheckingUserWithPlanStatus();
    } else if (startParam === StartParamType.WalletPaymentFailed) {
      notifyPaymentFailed();
    } else if (startParam === StartParamType.Debug) {
      screenStore.go({ type: "debug" });
    } else if (startParam === StartParamType.Components) {
      screenStore.go({ type: "componentCatalog" });
    } else if (startParam === StartParamType.Break) {
      throw new Error("Test exception for debugging");
    } else if (startParam === StartParamType.Pro) {
      screenStore.go({ type: "plans" });
    } else {
      this.isAppLoading = true;
      await when(() => !!this.myInfo);

      getSharedDeckRequest(startParam)
        .then(
          action((sharedDeckResponse) => {
            if ("deck" in sharedDeckResponse) {
              const deck = sharedDeckResponse.deck;
              assert(this.myInfo);
              if (this.myInfo.myDecks.find((myDeck) => myDeck.id === deck.id)) {
                screenStore.go({ type: "deckMine", deckId: deck.id });
                return;
              }

              if (
                this.publicDecks.find((publicDeck) => publicDeck.id === deck.id)
              ) {
                this.replaceDeck(deck);
                screenStore.go({
                  type: "deckPublic",
                  deckId: deck.id,
                });
                return;
              }

              this.myInfo.publicDecks.push(deck);
              screenStore.go({ type: "deckPublic", deckId: deck.id });
            }

            if ("folder" in sharedDeckResponse) {
              const folder = sharedDeckResponse.folder;
              this.addFolder(folder);
            }
          }),
        )
        .catch((e) => {
          reportHandledError("Error while retrieving shared deck", e, {
            shareId: startParam,
          });
        })
        .finally(
          action(() => {
            this.isAppLoading = false;
          }),
        );
    }
  }

  private startCheckingUserWithPlanStatus() {
    if (userStore.isPaid) {
      this.isAppLoading = false;
      notifyPaymentSuccess();
      return;
    }

    this.isAppLoading = true;
    userStore.fetchActivePlans();
    setTimeout(
      action(() => {
        this.startCheckingUserWithPlanStatus();
      }),
      2000,
    );
  }
}

const getCardsToReview = (
  deck: DeckWithCardsDbType,
  cardsToReview: CardToReviewDbType[],
) => {
  const map = new Map<number, CardReviewType>();

  cardsToReview.forEach((cardToReview) => {
    if (cardToReview.deck_id == deck.id) {
      map.set(cardToReview.id, cardToReview.type);
    }
  });

  return deck.deck_card
    .filter((card) => map.has(card.id))
    .map((card) => ({
      ...card,
      type: map.get(card.id)!,
    }))
    .slice()
    .sort((card) => (card.type === "repeat" ? -1 : 1));
};

export const deckListStore = new DeckListStore();
