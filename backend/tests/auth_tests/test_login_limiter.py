from security.login_limiter import LoginLimiter


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def new_limiter():
    clock = FakeClock()
    return LoginLimiter(
        max_failures=5, window_seconds=900, block_seconds=900, clock=clock
    ), clock


def test_four_failures_do_not_block():
    limiter, _ = new_limiter()
    for _ in range(4):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is False


def test_fifth_failure_blocks():
    limiter, _ = new_limiter()
    for _ in range(5):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is True


def test_block_ends_after_15_minutes():
    limiter, clock = new_limiter()
    for _ in range(5):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    clock.now += 900
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is False


def test_old_failures_are_forgotten():
    limiter, clock = new_limiter()
    for _ in range(4):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    clock.now += 901
    limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is False


def test_email_case_does_not_matter():
    limiter, _ = new_limiter()
    for _ in range(5):
        limiter.record_failure("Abebe@Hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is True


def test_other_ip_is_not_blocked():
    limiter, _ = new_limiter()
    for _ in range(5):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.2") is False


def test_reset_after_success():
    limiter, _ = new_limiter()
    for _ in range(4):
        limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    limiter.reset("abebe@hospital.et", "10.0.0.1")
    limiter.record_failure("abebe@hospital.et", "10.0.0.1")
    assert limiter.is_blocked("abebe@hospital.et", "10.0.0.1") is False
