"""Slows down password guessing (security requirement 5.1, Rate limits).

5 failed sign-ins for the same email and IP address within 15 minutes block
that email and IP for 15 minutes. The counts are kept in memory, per server
process, and reset when the server restarts.
"""

import threading
import time

MAX_FAILURES = 5
WINDOW_SECONDS = 15 * 60
BLOCK_SECONDS = 15 * 60


class LoginLimiter:
    def __init__(
        self,
        max_failures=MAX_FAILURES,
        window_seconds=WINDOW_SECONDS,
        block_seconds=BLOCK_SECONDS,
        clock=time.monotonic,
    ):
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self.block_seconds = block_seconds
        self.clock = clock
        self._failures = {}  # (email, ip) -> times of recent failures
        self._blocked_until = {}  # (email, ip) -> time the block ends
        self._lock = threading.Lock()

    def _key(self, email, ip):
        return (email.strip().lower(), ip or "unknown")

    def is_blocked(self, email, ip):
        key = self._key(email, ip)
        with self._lock:
            until = self._blocked_until.get(key)
            if until is None:
                return False
            if self.clock() < until:
                return True
            del self._blocked_until[key]
            return False

    def record_failure(self, email, ip):
        key = self._key(email, ip)
        now = self.clock()
        with self._lock:
            recent = [
                t for t in self._failures.get(key, []) if now - t < self.window_seconds
            ]
            recent.append(now)
            if len(recent) >= self.max_failures:
                self._blocked_until[key] = now + self.block_seconds
                self._failures.pop(key, None)
            else:
                self._failures[key] = recent

    def reset(self, email, ip):
        """Called after a successful sign-in."""
        key = self._key(email, ip)
        with self._lock:
            self._failures.pop(key, None)
            self._blocked_until.pop(key, None)

    def clear(self):
        """Forget everything (used by the tests)."""
        with self._lock:
            self._failures.clear()
            self._blocked_until.clear()


# One limiter shared by the whole app.
login_limiter = LoginLimiter()

# Separate limiter for "forgot password" requests (same limits).
reset_limiter = LoginLimiter()
