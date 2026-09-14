from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from cryptography.fernet import Fernet, InvalidToken


PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"
PASSWORD_HASH_ITERATIONS = 260_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_BYTES)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("ascii"),
        PASSWORD_HASH_ITERATIONS,
    ).hex()
    return f"{PASSWORD_HASH_ALGORITHM}${PASSWORD_HASH_ITERATIONS}${salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, expected_hash = stored_hash.split("$", 3)
        iterations = int(iterations_text)
    except ValueError:
        return False

    if algorithm != PASSWORD_HASH_ALGORITHM:
        return False

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("ascii"),
        iterations,
    ).hex()
    return hmac.compare_digest(candidate_hash, expected_hash)


def create_access_token() -> str:
    return secrets.token_urlsafe(32)


def create_secure_token() -> str:
    return secrets.token_urlsafe(32)


def create_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_otp(code: str, *, email: str, purpose: str, secret: str) -> str:
    payload = f"{purpose}:{email.strip().lower()}:{code}".encode()
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def verify_token(token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), stored_hash)


def _fernet(secret: str) -> Fernet:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str, *, secret: str) -> str:
    return _fernet(secret).encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str, *, secret: str) -> str:
    try:
        return _fernet(secret).decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt stored secret.") from exc
