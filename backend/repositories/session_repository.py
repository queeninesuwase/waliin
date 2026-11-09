import json
import threading
import time

import redis

from config import settings

SESSION_PREFIX = "waliin:session:"
USER_PREFIX = "waliin:user-sessions:"


class MemoryCache:
    def __init__(self):
        self._values = {}
        self._expires = {}
        self._lock = threading.Lock()

    def _alive(self, key):
        expires = self._expires.get(key)
        if expires is not None and time.monotonic() >= expires:
            self._values.pop(key, None)
            self._expires.pop(key, None)
        return key in self._values

    def _set_expiry(self, key, seconds):
        if seconds is None:
            self._expires.pop(key, None)
        else:
            self._expires[key] = time.monotonic() + seconds

    def set(self, key, value, ex=None):
        with self._lock:
            self._values[key] = value
            self._set_expiry(key, ex)

    def get(self, key):
        with self._lock:
            return self._values.get(key) if self._alive(key) else None

    def delete(self, *keys):
        with self._lock:
            removed = 0
            for key in keys:
                if self._alive(key):
                    removed += 1
                self._values.pop(key, None)
                self._expires.pop(key, None)
            return removed

    def sadd(self, key, member):
        with self._lock:
            if not self._alive(key):
                self._values[key] = set()
            self._values[key].add(member)

    def srem(self, key, member):
        with self._lock:
            if self._alive(key):
                self._values[key].discard(member)

    def smembers(self, key):
        with self._lock:
            return set(self._values[key]) if self._alive(key) else set()

    def expire(self, key, seconds):
        with self._lock:
            if self._alive(key):
                self._set_expiry(key, seconds)


def connect():
    if not settings.redis_url:
        return MemoryCache()
    options = {"decode_responses": True}
    if settings.redis_url.startswith("rediss://") and not settings.redis_tls_verify:
        options["ssl_cert_reqs"] = None
    return redis.Redis.from_url(settings.redis_url, **options)


cache = connect()


def save_session(token_hash, data, seconds):
    cache.set(SESSION_PREFIX + token_hash, json.dumps(data), ex=seconds)
    user_key = USER_PREFIX + data["user_id"]
    cache.sadd(user_key, token_hash)
    cache.expire(user_key, settings.session_max_hours * 3600)


def get_session(token_hash):
    raw = cache.get(SESSION_PREFIX + token_hash)
    return json.loads(raw) if raw else None


def delete_session(token_hash, user_id):
    cache.srem(USER_PREFIX + str(user_id), token_hash)
    return cache.delete(SESSION_PREFIX + token_hash)


def delete_sessions_for_user(user_id):
    user_key = USER_PREFIX + str(user_id)
    keys = [SESSION_PREFIX + token_hash for token_hash in cache.smembers(user_key)]
    removed = cache.delete(*keys) if keys else 0
    cache.delete(user_key)
    return removed
