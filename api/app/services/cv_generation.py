"""ATS-safe CV tailoring generation."""
from __future__ import annotations

import re
from typing import Any

from app.schemas.cv import CvTailoredSections
from app.services.extraction import normalize_extracted_text
from app.services.llm import LlmOverride, clear_llm_degradation, get_llm_degradation, is_llm_configured, llm_json

SYSTEM_PROMPT = """You tailor CVs for applicant tracking systems.
Return only valid JSON using this schema:
{
  "contact": {"name": "", "email": "", "phone": "", "location": "", "linkedin": ""},
  "summary": "",
  "skills": ["..."],
  "experience": [{"title": "", "company": "", "dates": "", "bullets": ["..."]}],
  "education": [{"degree": "", "institution": "", "dates": "", "details": ""}],
  "certifications": ["..."],
  "ats_keywords_matched": ["..."]
}
Rules:
- Preserve factual content from the source CV. Do not invent employers, titles, dates, degrees, certifications, metrics, or credentials.
- Mirror important job-description keywords naturally in the summary, skills, and bullets without keyword stuffing.
- Use standard content for Professional Summary, Skills, Experience, Education, and Certifications.
- Keep bullets short, scannable, and action-oriented. Prefer metrics only when present in the source CV.
- Do not use tables, columns, graphics, unusual section names, markdown, or HTML."""


def _clean_string(value: Any) -> str:
    text = normalize_extracted_text(str(value or ""))
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[*_`#>\[\]]+", "", text)
    return text.strip()


def _clean_list(value: Any, *, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = [_clean_string(item) for item in value]
    return [item for item in cleaned if item][:limit]


def normalize_tailored_sections(payload: dict[str, Any] | None) -> CvTailoredSections | None:
    if not isinstance(payload, dict):
        return None
    contact = payload.get("contact") if isinstance(payload.get("contact"), dict) else {}
    experience = []
    for item in payload.get("experience") or []:
        if not isinstance(item, dict):
            continue
        experience.append(
            {
                "title": _clean_string(item.get("title")),
                "company": _clean_string(item.get("company")),
                "dates": _clean_string(item.get("dates")),
                "bullets": _clean_list(item.get("bullets"), limit=5),
            }
        )
    education = []
    for item in payload.get("education") or []:
        if not isinstance(item, dict):
            continue
        education.append(
            {
                "degree": _clean_string(item.get("degree")),
                "institution": _clean_string(item.get("institution")),
                "dates": _clean_string(item.get("dates")),
                "details": _clean_string(item.get("details")),
            }
        )
    return CvTailoredSections(
        contact={
            "name": _clean_string(contact.get("name")),
            "email": _clean_string(contact.get("email")),
            "phone": _clean_string(contact.get("phone")),
            "location": _clean_string(contact.get("location")),
            "linkedin": _clean_string(contact.get("linkedin")),
        },
        summary=_clean_string(payload.get("summary")),
        skills=_clean_list(payload.get("skills"), limit=24),
        experience=experience[:8],
        education=education[:5],
        certifications=_clean_list(payload.get("certifications"), limit=10),
        ats_keywords_matched=_clean_list(payload.get("ats_keywords_matched"), limit=30),
    )


def _fallback_sections(source_cv: str, job_description: str) -> CvTailoredSections:
    lines = [line.strip() for line in source_cv.splitlines() if line.strip()]
    name = lines[0][:120] if lines else ""
    email_match = re.search(r"[\w.\-+]+@[\w.\-]+\.\w+", source_cv)
    phone_match = re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", source_cv)
    jd_terms = re.findall(r"\b[A-Za-z][A-Za-z+#.\-]{3,}\b", job_description)
    keywords = list(dict.fromkeys(term for term in jd_terms if term.lower() not in {"with", "from", "that", "this", "will", "have"}))[:12]
    summary_source = " ".join(lines[1:5])[:420] if len(lines) > 1 else source_cv[:420]
    return CvTailoredSections(
        contact={"name": name, "email": email_match.group(0) if email_match else "", "phone": phone_match.group(0) if phone_match else "", "location": "", "linkedin": ""},
        summary=summary_source or "Experienced candidate with background aligned to the role requirements.",
        skills=keywords,
        experience=[{"title": "Experience", "company": "", "dates": "", "bullets": lines[1:6] or [summary_source]}],
        education=[],
        certifications=[],
        ats_keywords_matched=keywords,
    )


def generate_tailored_cv(
    source_cv: str,
    job_description: str,
    *,
    job_title: str | None = None,
    company: str | None = None,
    model: str | None = None,
    override: LlmOverride | None = None,
) -> CvTailoredSections:
    source = normalize_extracted_text(source_cv)[:30000]
    description = normalize_extracted_text(job_description)[:30000]
    clear_llm_degradation()
    result = llm_json(
        SYSTEM_PROMPT,
        "Source CV:\n"
        f"{source}\n\nJob title: {job_title or ''}\nCompany: {company or ''}\n\n"
        f"Job description:\n{description}",
        model=model,
        override=override,
    )
    sections = normalize_tailored_sections(result)
    if sections is not None:
        return sections
    degradation = get_llm_degradation()
    if degradation is not None or is_llm_configured(override=override):
        detail = ""
        if degradation:
            detail = str(degradation.get("detail") or degradation.get("message") or "").strip()
        message = detail or "The AI provider could not generate a tailored CV. Please try again."
        raise ValueError(message)
    return _fallback_sections(source, description)
