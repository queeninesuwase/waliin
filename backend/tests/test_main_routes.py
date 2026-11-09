from main import app


def openapi_tags():
    tags = set()
    for operations in app.openapi()["paths"].values():
        for operation in operations.values():
            tags.update(operation.get("tags", []))
    return tags


def test_notification_routes_are_registered():
    paths = app.openapi()["paths"]
    assert any(path.startswith("/notifications") for path in paths)


def test_request_routers_are_registered():
    tags = openapi_tags()
    assert "Resource Requests" in tags
    assert "Request Items" in tags
    assert "Request Follow Ups" in tags
