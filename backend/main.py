from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from routers import fault
from routers import priority_list
from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.dashboard import router as dashboard_router
from routers.equipment import router as equipment_router
from routers.fault_assessment import router as fault_assessment_router
from routers import (
    notification,
    repair_verification_record,
    repair_work,
    request_follow_ups,
    request_items,
    resource_requests,
)
from routers.maintenance_report import router as maintenance_report_router
from services.errors import ServiceError


app = FastAPI(
    title="Waliin",
    description=(
        "Backend API for tracking medical equipment lifecycles in Ethiopian hospitals"
    ),
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(dashboard_router)
app.include_router(equipment_router)
app.include_router(priority_list.router)
app.include_router(fault_assessment_router)
app.include_router(repair_verification_record.router)
app.include_router(maintenance_report_router)
app.include_router(repair_work.router)
app.include_router(fault.router)
app.include_router(notification.router)
app.include_router(resource_requests.router)
app.include_router(request_items.router)
app.include_router(request_follow_ups.router)


@app.exception_handler(ServiceError)
def service_error_handler(request: Request, error: ServiceError):
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": error.message},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
