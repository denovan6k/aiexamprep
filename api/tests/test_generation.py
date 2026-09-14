from app.services import llm as llm_module
from app.services.generation import generate_questions


def test_generate_questions_skips_fallback_when_provider_fails(monkeypatch) -> None:
    import app.services.generation as generation

    monkeypatch.setattr(generation, "is_llm_configured", lambda: False)

    def _fail_llm(*_args, **_kwargs):
        llm_module._record_llm_degradation("AI provider unavailable")
        return None

    monkeypatch.setattr(generation, "llm_json", _fail_llm)
    chunks = [
        {
            "id": "topic:photosynthesis",
            "material_title": "General topic: photosynthesis",
            "text": (
                "General-knowledge quiz request for the topic: photosynthesis. "
                "Create 10 exam-style questions. If a fact is uncertain, keep the question broad, "
                "avoid niche claims, and include concise explanations."
            ),
        }
    ]

    questions = generate_questions(
        chunks,
        count=2,
        question_types=["mcq"],
        difficulty="medium",
        topic_label="photosynthesis",
    )

    assert questions == []


def test_fallback_questions_ignore_pdf_artifacts_and_transition_words(monkeypatch) -> None:
    import app.services.generation as generation

    monkeypatch.setattr(generation, "is_llm_configured", lambda: False)
    monkeypatch.setattr(generation, "llm_json", lambda *args, **kwargs: None)
    chunks = [
        {
            "id": "chunk-1",
            "material_title": "Stacks",
            "text": (
                "\uf071 pop() removes the node at the tail of the linked list. "
                "Alternatively, we can extend the array by allocating a larger backing store. "
                "A stack data structure supports last-in first-out access through push and pop operations."
            ),
        }
    ]

    questions = generate_questions(
        chunks,
        count=2,
        question_types=["mcq"],
        difficulty="medium",
        topic_label="Stacks",
    )

    assert questions
    joined = " ".join(
        [question["prompt"] for question in questions]
        + [option["text"] for question in questions for option in question.get("options") or []]
    )
    assert "\uf071" not in joined
    assert "Alternatively" not in joined
    assert "Consequently" not in joined


def test_clean_generated_mcq_infers_blank_correct_answers_from_explanation() -> None:
    import app.services.generation as generation

    question = {
        "type": "mcq",
        "prompt": "What is the time complexity of the size() method in the Tree ADT?",
        "options": [
            {"id": "a", "text": "O(n)"},
            {"id": "b", "text": "O(log n)"},
            {"id": "c", "text": "O(1)"},
            {"id": "d", "text": "O(c_v)"},
        ],
        "correct_answers": [""],
        "explanation": "According to the performance table, size runs in constant time, O(1).",
        "topic": "Tree ADT Performance",
        "difficulty": "medium",
        "source_refs": [],
    }

    cleaned = generation._clean_generated_question(question)

    assert cleaned is not None
    assert cleaned["correct_answers"] == ["c"]
