from models import Department


def test_departments_has_all_columns(table):
    assert set(table("departments").c.keys()) == {
        "department_id",
        "department_name",
        "description",
        "responsible_engineer_id",
        "responsible_engineer_role",
        "is_active",
        "created_at",
    }


def test_responsible_engineer_is_role_checked(foreign_keys):
    assert foreign_keys("departments")["fk_dept_engineer"] == [
        "users.user_id",
        "users.role",
    ]


def test_department_name_is_unique(uniques):
    assert "departments_department_name_key" in uniques("departments")


def test_engineer_can_be_responsible(db, data):
    data["dept"].responsible_engineer_id = data["engineer"].user_id
    db.flush()
    db.refresh(data["dept"])
    assert data["dept"].responsible_engineer.email == "abebe@hospital.et"


def test_nurse_cannot_be_responsible_engineer(data, refused):
    assert refused(
        lambda: setattr(data["dept"], "responsible_engineer_id", data["nurse"].user_id)
    )


def test_duplicate_department_name_is_refused(db, data, refused):
    assert refused(lambda: db.add(Department(department_name="Maternity")))


def test_department_lists_its_users(data):
    emails = {u.email for u in data["dept"].users}
    assert emails == {"abebe@hospital.et", "tigist@hospital.et"}
