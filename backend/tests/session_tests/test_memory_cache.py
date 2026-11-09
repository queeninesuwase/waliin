from repositories import session_repository
from repositories.session_repository import MemoryCache


def test_values_expire(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(session_repository.time, "monotonic", lambda: clock[0])
    cache = MemoryCache()
    cache.set("key", "value", ex=60)
    assert cache.get("key") == "value"
    clock[0] += 60
    assert cache.get("key") is None


def test_sets_add_remove_and_expire(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(session_repository.time, "monotonic", lambda: clock[0])
    cache = MemoryCache()
    cache.sadd("user", "a")
    cache.sadd("user", "b")
    cache.srem("user", "a")
    assert cache.smembers("user") == {"b"}
    cache.expire("user", 10)
    clock[0] += 10
    assert cache.smembers("user") == set()


def test_delete_counts_only_existing_keys():
    cache = MemoryCache()
    cache.set("one", "1")
    assert cache.delete("one", "missing") == 1
    assert cache.get("one") is None


def test_no_redis_url_uses_the_memory_cache(monkeypatch):
    monkeypatch.setattr(session_repository.settings, "redis_url", "")
    assert isinstance(session_repository.connect(), MemoryCache)


def test_redis_url_uses_redis(monkeypatch):
    calls = {}

    def from_url(url, **options):
        calls["url"] = url
        calls["options"] = options
        return "redis-client"

    monkeypatch.setattr(session_repository.settings, "redis_url", "rediss://cache:6379")
    monkeypatch.setattr(session_repository.settings, "redis_tls_verify", False)
    monkeypatch.setattr(session_repository.redis.Redis, "from_url", from_url)
    assert session_repository.connect() == "redis-client"
    assert calls["url"] == "rediss://cache:6379"
    assert calls["options"] == {"decode_responses": True, "ssl_cert_reqs": None}
