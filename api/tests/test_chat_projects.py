import uuid
import pytest
from fastapi import status

from app.models import ChatProject, ChatThread, User
from app.services.chat import _effective_material_ids, _project_instructions
from helpers import register_user


def test_project_crud_and_ownership(client, db_session):
    headers, user = register_user(client, email="project-owner@example.com")

    # 1. Create project
    create_resp = client.post(
        "/chat/projects",
        json={"name": "Physics 101", "description": "Physics notes & problem sets", "instructions": "Be precise with math."},
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    data = create_resp.json()
    project_id = data["id"]
    assert data["name"] == "Physics 101"
    assert data["instructions"] == "Be precise with math."
    assert data["starred"] is False
    assert data["archived"] is False

    # 2. List projects
    list_resp = client.get("/chat/projects", headers=headers)
    assert list_resp.status_code == status.HTTP_200_OK
    assert len(list_resp.json()) == 1

    # 3. Get single project
    get_resp = client.get(f"/chat/projects/{project_id}", headers=headers)
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["id"] == project_id

    # 4. Update project
    patch_resp = client.patch(
        f"/chat/projects/{project_id}",
        json={"starred": True, "name": "Physics 101 Advanced"},
        headers=headers,
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.json()["starred"] is True
    assert patch_resp.json()["name"] == "Physics 101 Advanced"

    # 5. Delete project
    del_resp = client.delete(f"/chat/projects/{project_id}", headers=headers)
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    # 6. Verify 404 after deletion
    get_after_del = client.get(f"/chat/projects/{project_id}", headers=headers)
    assert get_after_del.status_code == status.HTTP_404_NOT_FOUND


def test_bulk_thread_actions(client, db_session):
    headers, user = register_user(client, email="bulk-user@example.com")

    # Create project
    p_resp = client.post("/chat/projects", json={"name": "Test Project"}, headers=headers)
    project_id = p_resp.json()["id"]

    # Create 3 threads
    t1 = client.post("/chat/threads", json={"title": "Thread 1"}, headers=headers).json()["id"]
    t2 = client.post("/chat/threads", json={"title": "Thread 2"}, headers=headers).json()["id"]
    t3 = client.post("/chat/threads", json={"title": "Thread 3"}, headers=headers).json()["id"]

    # Bulk pin t1 and t2
    bulk_pin = client.post(
        "/chat/threads/bulk",
        json={"thread_ids": [t1, t2], "action": "pin"},
        headers=headers,
    )
    assert bulk_pin.status_code == status.HTTP_200_OK
    assert bulk_pin.json() == {"updated": 2, "failed": 0}

    # Verify t1 is pinned
    thread_1_data = client.get(f"/chat/threads", headers=headers).json()
    t1_obj = next(t for t in thread_1_data if t["id"] == t1)
    assert t1_obj["pinned"] is True

    # Bulk move t1 and t3 to project
    bulk_move = client.post(
        "/chat/threads/bulk",
        json={"thread_ids": [t1, t3], "action": "move_to_project", "project_id": project_id},
        headers=headers,
    )
    assert bulk_move.status_code == status.HTTP_200_OK
    assert bulk_move.json() == {"updated": 2, "failed": 0}

    # Verify project_id is updated
    thread_1_data = client.get(f"/chat/threads", headers=headers).json()
    t1_obj = next(t for t in thread_1_data if t["id"] == t1)
    assert t1_obj["project_id"] == project_id

    # Bulk delete t2
    bulk_del = client.post(
        "/chat/threads/bulk",
        json={"thread_ids": [t2], "action": "delete"},
        headers=headers,
    )
    assert bulk_del.status_code == status.HTTP_200_OK
    assert bulk_del.json() == {"updated": 1, "failed": 0}


def test_project_context_and_instructions(client, db_session):
    headers, user = register_user(client, email="proj-context@example.com")
    user_id = uuid.UUID(user["id"])

    mat_proj = uuid.uuid4()
    mat_thread = uuid.uuid4()

    proj = ChatProject(
        id=uuid.uuid4(),
        user_id=user_id,
        name="Physics Project",
        instructions="Always respond in LaTeX.",
        material_ids=[str(mat_proj)],
    )
    db_session.add(proj)

    thread = ChatThread(
        id=uuid.uuid4(),
        user_id=user_id,
        title="Physics Question",
        project_id=proj.id,
        material_ids=[str(mat_thread)],
    )
    db_session.add(thread)
    db_session.commit()

    # Effective material_ids should place project material first, then thread material
    effective = _effective_material_ids(db_session, thread)
    assert len(effective) == 2
    assert list(effective) == [mat_proj, mat_thread]

    # Project instructions should be fetched
    instructions = _project_instructions(db_session, thread)
    assert instructions == "Always respond in LaTeX."
