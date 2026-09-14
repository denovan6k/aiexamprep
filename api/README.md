# Knorvex API

FastAPI backend for Knorvex.

## Local tests

From this directory:

```bash
pip install -e ".[dev]"
python -m pytest tests/ -q
```

Tests run against in-memory **SQLite** and do not need Postgres, Docker, or `psycopg` installed locally. `tests/conftest.py` sets `DATABASE_URL=sqlite://` before importing the app so your `api/.env` Postgres URL is not used during pytest.

To run a single file or test:

```bash
python -m pytest tests/test_quizzes.py -q
python -m pytest tests/test_quizzes.py::test_mcq_scores_zero_based_correct_answer_index -q
```

For production-like runs against Postgres, use Docker Compose and run pytest inside the API container once that service is defined in compose.
