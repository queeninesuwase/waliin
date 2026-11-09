from models import FaultAssessment


def new_assessment(data, **kw):
    values = dict(
        fault_id=data["fault"].fault_id,
        assessed_by=data["engineer"].user_id,
        findings="Probe cable broken",
        condition="faulty",
        recommended_action="Replace cable",
        severity_factor=3,
        clinical_criticality=3,
        backup_available=False,
        history_factor=1,
        priority_score=9,
        rule_priority_level="high",
        priority_level="high",
        priority_explanation="Same as rule level",
        rule_version="v1",
    )
    values.update(kw)
    return FaultAssessment(**values)


def test_score_and_level_are_plain_columns(table):
    c = table("fault_assessments").c
    assert c.priority_score.computed is None and not c.priority_score.nullable
    assert c.rule_priority_level.computed is None and not c.rule_priority_level.nullable


def test_assessment_constraints(checks, foreign_keys, table):
    assert {
        "fault_assessments_severity_factor_check",
        "fault_assessments_clinical_criticality_check",
        "fault_assessments_history_factor_check",
        "fault_assessments_priority_score_check",
        "fault_assessments_rule_priority_level_check",
        "fault_assessments_priority_level_check",
        "ck_assessment_explanation",
    } <= checks("fault_assessments")
    assert foreign_keys("fault_assessments")["fk_assessment_engineer"] == [
        "users.user_id",
        "users.role",
    ]
    assert {i.name: i.unique for i in table("fault_assessments").indexes}[
        "uq_assessment_current"
    ]


def test_assessment_is_saved(db, data):
    a = new_assessment(data)
    db.add(a)
    db.flush()
    assert a in data["fault"].assessments and a.is_current


def test_severity_out_of_range_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_assessment(data, severity_factor=5)))


def test_criticality_out_of_range_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_assessment(data, clinical_criticality=0)))


def test_score_out_of_range_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_assessment(data, priority_score=13)))


def test_empty_explanation_is_refused(db, data, refused):
    assert refused(lambda: db.add(new_assessment(data, priority_explanation="   ")))


def test_only_one_current_assessment_per_fault(db, data, refused):
    db.add(new_assessment(data))
    db.flush()
    assert refused(lambda: db.add(new_assessment(data)))


def test_old_assessment_can_be_kept_as_not_current(db, data):
    old = new_assessment(data)
    db.add(old)
    db.flush()
    old.is_current = False
    db.add(
        new_assessment(
            data,
            priority_score=10,
            rule_priority_level="critical",
            priority_level="critical",
        )
    )
    db.flush()


def test_nurse_cannot_assess(db, data, refused):
    assert refused(
        lambda: db.add(new_assessment(data, assessed_by=data["nurse"].user_id))
    )
