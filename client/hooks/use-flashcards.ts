"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/lib/pagination";
import {
  createManualFlashcardDeck,
  getFlashcardDeck,
  listDeckCards,
  listFlashcardDecks,
  populateManualFlashcardDeck,
  reviewFlashcard,
  updateManualFlashcardDeck,
  type FlashcardDeckCreateInput,
  type FlashcardDeckPopulateInput,
  type FlashcardDeckUpdateInput
} from "@/lib/study";

import { isAuthenticated, useAuthToken } from "./use-auth-token";

export function useFlashcardDecksQuery(params: ListParams = {}) {
  const token = useAuthToken();
  const normalized = { limit: 12, offset: 0, ...params };
  return useQuery({
    queryKey: [...queryKeys.flashcards.decks(), normalized],
    queryFn: () => listFlashcardDecks(token!, normalized),
    enabled: isAuthenticated(token)
  });
}

export function useFlashcardDeckQuery(deckId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.flashcards.deck(deckId!),
    queryFn: () => getFlashcardDeck(token!, deckId!),
    enabled: isAuthenticated(token) && Boolean(deckId)
  });
}

export function useDeckCardsQuery(deckId: string | null) {
  const token = useAuthToken();
  return useQuery({
    queryKey: queryKeys.flashcards.cards(deckId!),
    queryFn: () => listDeckCards(token!, deckId!),
    enabled: isAuthenticated(token) && Boolean(deckId)
  });
}

export function useReviewFlashcardMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      deckId,
      cardId,
      confidence
    }: {
      deckId: string;
      cardId: string;
      confidence: "again" | "known";
    }) => reviewFlashcard(token!, deckId, cardId, confidence),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.deck(variables.deckId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.cards(variables.deckId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.all });
    }
  });
}

export function useCreateManualFlashcardDeckMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FlashcardDeckCreateInput) => createManualFlashcardDeck(token!, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.decks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.deck(data.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.cards(data.id) });
    }
  });
}

export function useUpdateManualFlashcardDeckMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deckId, input }: { deckId: string; input: FlashcardDeckUpdateInput }) =>
      updateManualFlashcardDeck(token!, deckId, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.decks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.deck(data.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.cards(data.id) });
    }
  });
}

export function usePopulateManualFlashcardDeckMutation() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      deckId,
      input
    }: {
      deckId: string;
      input: FlashcardDeckPopulateInput;
    }) => populateManualFlashcardDeck(token!, deckId, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.decks() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.deck(data.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.flashcards.cards(data.id) });
    }
  });
}
