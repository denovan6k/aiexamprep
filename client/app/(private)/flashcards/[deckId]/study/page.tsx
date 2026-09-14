import { FlashcardStudyPage } from "@/components/flashcards/flashcard-study-page";

export default async function FlashcardStudyRoute({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  return <FlashcardStudyPage deckId={deckId} />;
}
