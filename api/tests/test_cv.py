from __future__ import annotations

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select

from conftest import register_user
from app.models import CvTailoring, UsageEvent


def _mock_tailoring(monkeypatch, calls: list[dict] | None = None) -> None:
    def fake_llm_json(*args, **kwargs):  # noqa: ANN002, ANN003
        if calls is not None:
            calls.append(kwargs)
        return {
            "contact": {
                "name": "Ada Student",
                "email": "ada@example.com",
                "phone": "555-0101",
                "location": "Boston, MA",
                "linkedin": "linkedin.com/in/ada",
            },
            "summary": "Software engineer focused on Python APIs and reliable data workflows.",
            "skills": ["Python", "FastAPI", "SQLAlchemy"],
            "experience": [
                {
                    "title": "Backend Engineer",
                    "company": "Prep Labs",
                    "dates": "2024-present",
                    "bullets": ["Built FastAPI services for document processing."],
                }
            ],
            "education": [
                {
                    "degree": "BSc Computer Science",
                    "institution": "Example University",
                    "dates": "2023",
                    "details": "",
                }
            ],
            "certifications": [],
            "ats_keywords_matched": ["Python", "FastAPI"],
        }

    monkeypatch.setattr("app.services.cv_generation.llm_json", fake_llm_json)


def test_cv_upload_tailor_and_download(client: TestClient, db_session, monkeypatch) -> None:
    _mock_tailoring(monkeypatch)
    headers, _user = register_user(client, email="cv-flow@example.com")

    upload_response = client.post(
        "/cv/documents",
        headers=headers,
        files={
            "file": (
                "ada-cv.txt",
                (
                    b"Ada Student\nada@example.com\nBackend Engineer at Prep Labs\n"
                    b"Built FastAPI services for document processing."
                ),
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201, upload_response.text
    cv_document = upload_response.json()
    assert cv_document["status"] == "processed"
    assert "Backend Engineer" in cv_document["extracted_text_preview"]

    tailoring_response = client.post(
        "/cv/tailorings",
        headers=headers,
        json={
            "cv_document_id": cv_document["id"],
            "job_title": "API Engineer",
            "company": "Acme",
            "job_description": (
                "We need a Python API engineer with FastAPI, SQLAlchemy, "
                "document processing, and production backend experience."
            ),
        },
    )

    assert tailoring_response.status_code == 201, tailoring_response.text
    tailoring = tailoring_response.json()
    assert tailoring["status"] == "completed"
    assert tailoring["tailored_sections"]["contact"]["name"] == "Ada Student"
    assert tailoring["tailored_sections"]["ats_keywords_matched"] == ["Python", "FastAPI"]

    download_response = client.get(
        f"/cv/tailorings/{tailoring['id']}/download",
        headers=headers,
    )
    assert download_response.status_code == 200
    assert download_response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert download_response.content.startswith(b"PK")

    events = db_session.scalars(
        select(UsageEvent.event_type).where(UsageEvent.event_type.in_(["cv_upload", "cv_tailoring"]))
    ).all()
    assert events.count("cv_upload") == 1
    assert events.count("cv_tailoring") == 1


def test_cv_documents_and_tailorings_are_user_scoped(
    client: TestClient,
    monkeypatch,
) -> None:
    _mock_tailoring(monkeypatch)
    owner_headers, _owner = register_user(client, email="cv-owner@example.com")
    other_headers, _other = register_user(client, email="cv-other@example.com")

    upload_response = client.post(
        "/cv/documents",
        headers=owner_headers,
        files={
            "file": (
                "owner-cv.txt",
                b"Owner User\nowner@example.com\nBuilt Python backend APIs.",
                "text/plain",
            )
        },
    )
    assert upload_response.status_code == 201
    cv_document_id = upload_response.json()["id"]

    assert client.get(f"/cv/documents/{cv_document_id}", headers=other_headers).status_code == 404
    tailoring_response = client.post(
        "/cv/tailorings",
        headers=other_headers,
        json={
            "cv_document_id": cv_document_id,
            "job_description": "Python backend role requiring API design and SQLAlchemy experience.",
        },
    )
    assert tailoring_response.status_code == 404


def test_cv_tailoring_requires_processed_document(client: TestClient, db_session) -> None:
    headers, user = register_user(client, email="cv-processing@example.com")
    from app.models import CvDocument

    document = CvDocument(
        user_id=UUID(user["id"]),
        title="Failed CV",
        file_name="failed.txt",
        file_type="text/plain",
        storage_path="missing.txt",
        status="failed",
        error_message="No text could be extracted.",
    )
    db_session.add(document)
    db_session.commit()

    response = client.post(
        "/cv/tailorings",
        headers=headers,
        json={
            "cv_document_id": str(document.id),
            "job_description": "Python backend role requiring API design and SQLAlchemy experience.",
        },
    )

    assert response.status_code == 409


def test_cv_tailoring_passes_selected_model(client: TestClient, db_session, monkeypatch) -> None:
    calls: list[dict] = []
    _mock_tailoring(monkeypatch, calls)
    headers, _user = register_user(client, email="cv-model@example.com")

    upload_response = client.post(
        "/cv/documents",
        headers=headers,
        files={
            "file": (
                "model-cv.txt",
                b"Model User\nmodel@example.com\nBuilt Java and Angular applications.",
                "text/plain",
            )
        },
    )
    assert upload_response.status_code == 201, upload_response.text

    response = client.post(
        "/cv/tailorings",
        headers=headers,
        json={
            "cv_document_id": upload_response.json()["id"],
            "job_title": "Full Stack Developer",
            "company": "Randstad",
            "job_description": "Role needs Java, Angular, TypeScript, CI/CD, and backend API experience.",
            "model": "google/gemma-4-26b-a4b-it:free",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["model"] == "google/gemma-4-26b-a4b-it:free"
    assert calls[-1]["model"] == "google/gemma-4-26b-a4b-it:free"
    tailoring = db_session.get(CvTailoring, UUID(response.json()["id"]))
    assert tailoring is not None
    assert tailoring.model == "google/gemma-4-26b-a4b-it:free"
