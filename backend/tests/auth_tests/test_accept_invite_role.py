import re

from models import UserRole
from services import invitation_service

PASSWORD = "maternity ward monitor"


def test_accept_invite_returns_the_role(client, db, accounts, emails):
    invitation_service.invite_user(
        db,
        accounts["manager"],
        "hana@hospital.et",
        UserRole.CLINICAL_STAFF,
        accounts["nurse"].department_id,
    )
    body = emails[-1].get_body(preferencelist=("plain",)).get_content()
    token = re.search(r"token=([\w-]+)", body).group(1)
    response = client.post(
        "/auth/accept-invite",
        json={
            "token": token,
            "full_name": "Hana Girma",
            "password": PASSWORD,
            "confirm_password": PASSWORD,
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "clinical_staff"
