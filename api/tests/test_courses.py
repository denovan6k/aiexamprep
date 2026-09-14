from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from conftest import register_user


def test_course_crud_flow(client: TestClient) -> None:
    headers, _user = register_user(client, email="courses@example.com")

    list_response = client.get("/courses", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json() == []

    create_response = client.post(
        "/courses",
        headers=headers,
        json={
            "title": "Biology 201",
            "description": "Cell biology and genetics",
            "exam_date": "2026-12-15T14:30:00Z",
        },
    )
    assert create_response.status_code == 201
    created_course = create_response.json()
    course_id = UUID(created_course["id"])
    assert created_course["title"] == "Biology 201"
    assert created_course["description"] == "Cell biology and genetics"
    assert created_course["exam_date"].startswith("2026-12-15T14:30:00")
    assert created_course["created_at"]
    assert created_course["updated_at"]

    get_response = client.get(f"/courses/{course_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == str(course_id)

    patch_response = client.patch(
        f"/courses/{course_id}",
        headers=headers,
        json={
            "title": "Biology 202",
            "description": None,
        },
    )
    assert patch_response.status_code == 200
    updated_course = patch_response.json()
    assert updated_course["id"] == str(course_id)
    assert updated_course["title"] == "Biology 202"
    assert updated_course["description"] is None
    assert updated_course["exam_date"].startswith("2026-12-15T14:30:00")

    list_after_create_response = client.get("/courses", headers=headers)
    assert list_after_create_response.status_code == 200
    assert [course["id"] for course in list_after_create_response.json()] == [str(course_id)]

    delete_response = client.delete(f"/courses/{course_id}", headers=headers)
    assert delete_response.status_code == 204
    assert delete_response.content == b""

    get_after_delete_response = client.get(f"/courses/{course_id}", headers=headers)
    assert get_after_delete_response.status_code == 404
    assert (
        get_after_delete_response.json()["error"]["message"]
        == f"Course {course_id} was not found."
    )


def test_missing_course_returns_404(client: TestClient) -> None:
    headers, _user = register_user(client, email="missing-course@example.com")
    course_id = uuid4()

    get_response = client.get(f"/courses/{course_id}", headers=headers)
    patch_response = client.patch(
        f"/courses/{course_id}", headers=headers, json={"title": "Missing"}
    )
    delete_response = client.delete(f"/courses/{course_id}", headers=headers)

    assert get_response.status_code == 404
    assert patch_response.status_code == 404
    assert delete_response.status_code == 404
    assert get_response.json()["error"]["message"] == f"Course {course_id} was not found."
