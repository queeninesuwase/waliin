from datetime import datetime, timedelta, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from repositories.maintenance_report_repository import (
    MaintenanceReportRepository,
)
from schemas.maintenance_report import (
    DowntimeSummary,
    FaultSummary,
    MaintenanceReportSummary,
    PriorityBreakdown,
    RepairSummary,
    ResourceRequestSummary,
)


class MaintenanceReportService:
    def __init__(
        self,
        repository: MaintenanceReportRepository | None = None,
    ):
        self.repository = repository or MaintenanceReportRepository()

    def get_summary(self, db: Session) -> MaintenanceReportSummary:
        fault_summary = self.repository.get_fault_summary(db)
        priority_breakdown = self.repository.get_priority_breakdown(db)
        downtime_summary = self.repository.get_downtime_summary(db)
        repair_summary = self.repository.get_repair_summary(db)
        resource_request_summary = self.repository.get_resource_request_summary(db)

        return MaintenanceReportSummary(
            faults=FaultSummary(**fault_summary),
            priorities=PriorityBreakdown(**priority_breakdown),
            downtime=DowntimeSummary(**downtime_summary),
            repairs=RepairSummary(**repair_summary),
            resource_requests=ResourceRequestSummary(**resource_request_summary),
        )

    def _format_duration(self, duration: timedelta) -> str:
        total_seconds = int(duration.total_seconds())

        if total_seconds <= 0:
            return "0 hours"

        days, remainder = divmod(total_seconds, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes = remainder // 60

        parts = []

        if days:
            parts.append(f"{days} day{'s' if days != 1 else ''}")

        if hours:
            parts.append(f"{hours} hour{'s' if hours != 1 else ''}")

        if minutes:
            parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")

        return " ".join(parts)

    def _build_snapshot(
        self,
        summary: MaintenanceReportSummary,
    ) -> str:
        parts = []

        parts.append(
            f"There are currently {summary.faults.open_faults} open "
            f"faults out of {summary.faults.total_faults} recorded faults."
        )

        high_attention_faults = summary.priorities.critical + summary.priorities.high

        if high_attention_faults > 0:
            parts.append(
                f"{high_attention_faults} active faults are classified "
                "as critical or high priority and require close attention."
            )
        else:
            parts.append(
                "There are currently no critical or high-priority active faults."
            )

        if summary.downtime.equipment_still_down > 0:
            parts.append(
                f"{summary.downtime.equipment_still_down} equipment "
                "items are currently recorded as still down."
            )
        else:
            parts.append("No equipment is currently recorded as still down.")

        if summary.repairs.equipment_returned_to_service > 0:
            parts.append(
                f"{summary.repairs.equipment_returned_to_service} "
                "fault cases have resulted in equipment being returned "
                "to service."
            )

        if summary.resource_requests.pending_requests > 0:
            parts.append(
                f"{summary.resource_requests.pending_requests} "
                "resource requests are still pending."
            )

        return " ".join(parts)

    def _section_table(
        self,
        rows: list[list[str | int]],
    ) -> Table:
        table = Table(
            rows,
            colWidths=[100 * mm, 65 * mm],
        )

        table.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#76072F"),
                    ),
                    (
                        "TEXTCOLOR",
                        (0, 0),
                        (-1, 0),
                        colors.white,
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "Helvetica-Bold",
                    ),
                    (
                        "FONTNAME",
                        (0, 1),
                        (0, -1),
                        "Helvetica-Bold",
                    ),
                    (
                        "BACKGROUND",
                        (0, 1),
                        (-1, -1),
                        colors.HexColor("#FBF9F5"),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.5,
                        colors.HexColor("#D8C3CA"),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                ]
            )
        )

        return table

    def _equipment_table(
        self,
        rows: list[list[str]],
    ) -> Table:
        table = Table(
            rows,
            colWidths=[48 * mm, 117 * mm],
        )

        table.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (0, -1),
                        colors.HexColor("#F3E3E8"),
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (0, -1),
                        "Helvetica-Bold",
                    ),
                    (
                        "TEXTCOLOR",
                        (0, 0),
                        (-1, -1),
                        colors.HexColor("#263346"),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8C3CA"),
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                    (
                        "LEFTPADDING",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                ]
            )
        )

        return table

    def generate_pdf(self, db: Session) -> bytes:
        summary = self.get_summary(db)
        active_faults = self.repository.get_active_fault_details(db)

        buffer = BytesIO()

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title="Waliin Maintenance Report",
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "WaliinTitle",
            parent=styles["Title"],
            textColor=colors.HexColor("#263346"),
            alignment=TA_CENTER,
            fontSize=20,
            spaceAfter=8,
        )

        subtitle_style = ParagraphStyle(
            "WaliinSubtitle",
            parent=styles["Normal"],
            textColor=colors.HexColor("#7B8796"),
            alignment=TA_CENTER,
            fontSize=9,
            leading=13,
        )

        section_style = ParagraphStyle(
            "WaliinSection",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#263346"),
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        )

        body_style = ParagraphStyle(
            "WaliinBody",
            parent=styles["BodyText"],
            textColor=colors.HexColor("#4C5968"),
            fontSize=9,
            leading=14,
        )

        equipment_heading_style = ParagraphStyle(
            "EquipmentHeading",
            parent=styles["Heading3"],
            textColor=colors.HexColor("#76072F"),
            fontSize=11,
            leading=14,
            spaceBefore=4,
            spaceAfter=4,
        )

        elements = []

        generated_at = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")

        elements.append(
            Paragraph(
                "Waliin Maintenance Report",
                title_style,
            )
        )

        elements.append(
            Paragraph(
                "Medical Equipment Maintenance and Downtime Summary",
                subtitle_style,
            )
        )

        elements.append(
            Paragraph(
                f"Generated: {generated_at}",
                subtitle_style,
            )
        )

        elements.append(Spacer(1, 7 * mm))

        elements.append(
            Paragraph(
                "Report overview",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                "This report provides a current snapshot of medical "
                "equipment faults, maintenance priorities, downtime, "
                "repair activity, return-to-service outcomes, and "
                "resource requests recorded in Waliin.",
                body_style,
            )
        )

        elements.append(Spacer(1, 4 * mm))

        elements.append(
            Paragraph(
                "Current maintenance snapshot",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                self._build_snapshot(summary),
                body_style,
            )
        )

        elements.append(Spacer(1, 6 * mm))

        elements.append(
            Paragraph(
                "Fault overview",
                section_style,
            )
        )

        elements.append(
            self._section_table(
                [
                    ["Fault metric", "Value"],
                    [
                        "Total recorded faults",
                        summary.faults.total_faults,
                    ],
                    [
                        "Open faults",
                        summary.faults.open_faults,
                    ],
                    [
                        "Closed faults",
                        summary.faults.closed_faults,
                    ],
                ]
            )
        )

        elements.append(Spacer(1, 5 * mm))

        elements.append(
            Paragraph(
                "Maintenance priority breakdown",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                "Priority levels indicate how urgently active equipment "
                "faults require maintenance attention.",
                body_style,
            )
        )

        elements.append(Spacer(1, 3 * mm))

        elements.append(
            self._section_table(
                [
                    ["Priority level", "Active faults"],
                    [
                        "Critical",
                        summary.priorities.critical,
                    ],
                    [
                        "High",
                        summary.priorities.high,
                    ],
                    [
                        "Medium",
                        summary.priorities.medium,
                    ],
                    [
                        "Low",
                        summary.priorities.low,
                    ],
                ]
            )
        )

        elements.append(Spacer(1, 7 * mm))

        elements.append(
            Paragraph(
                "Active equipment faults",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                "The following equipment currently has an active fault. "
                "Equipment is shown with its maintenance status, priority, "
                "downtime, reported issue, and priority context.",
                body_style,
            )
        )

        elements.append(Spacer(1, 4 * mm))

        if active_faults:
            for index, fault in enumerate(active_faults, start=1):
                equipment_name = fault["equipment_name"]
                asset_tag = fault["asset_tag"]
                department = fault["department_name"]

                status = fault["fault_status"].replace("_", " ").title()

                priority = fault["priority_level"]

                priority_display = priority.title() if priority else "Not yet assessed"

                score = fault["priority_score"]

                score_display = str(score) if score is not None else "Not yet assessed"

                downtime = fault["downtime"]

                downtime_display = (
                    self._format_duration(downtime)
                    if downtime is not None
                    else "No downtime recorded"
                )

                description = fault["description"] or "No fault description provided."

                explanation = (
                    fault["priority_explanation"]
                    or "Priority assessment not yet available."
                )

                reported_at = fault["reported_at"]

                reported_display = (
                    reported_at.strftime("%d %B %Y, %H:%M")
                    if reported_at
                    else "Not available"
                )

                still_down = fault["still_down"]

                availability = (
                    "Still out of service"
                    if still_down
                    else "Not currently recorded as down"
                )

                elements.append(
                    Paragraph(
                        f"{index}. {equipment_name} ({asset_tag})",
                        equipment_heading_style,
                    )
                )

                elements.append(
                    self._equipment_table(
                        [
                            [
                                "Equipment",
                                equipment_name,
                            ],
                            [
                                "Asset tag",
                                asset_tag,
                            ],
                            [
                                "Department",
                                department,
                            ],
                            [
                                "Reported",
                                reported_display,
                            ],
                            [
                                "Fault status",
                                status,
                            ],
                            [
                                "Priority",
                                priority_display,
                            ],
                            [
                                "Priority score",
                                score_display,
                            ],
                            [
                                "Current availability",
                                availability,
                            ],
                            [
                                "Downtime",
                                downtime_display,
                            ],
                        ]
                    )
                )

                elements.append(Spacer(1, 2 * mm))

                elements.append(
                    Paragraph(
                        f"<b>Reported issue:</b> {description}",
                        body_style,
                    )
                )

                elements.append(Spacer(1, 1 * mm))

                elements.append(
                    Paragraph(
                        f"<b>Priority context:</b> {explanation}",
                        body_style,
                    )
                )

                elements.append(Spacer(1, 6 * mm))

        else:
            elements.append(
                Paragraph(
                    "There are currently no active equipment faults.",
                    body_style,
                )
            )

        elements.append(
            Paragraph(
                "Equipment downtime",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                "Downtime measures how long equipment affected by "
                "reported faults has remained unavailable for normal "
                "service.",
                body_style,
            )
        )

        elements.append(Spacer(1, 3 * mm))

        elements.append(
            self._section_table(
                [
                    ["Downtime metric", "Value"],
                    [
                        "Equipment still down",
                        summary.downtime.equipment_still_down,
                    ],
                    [
                        "Total recorded downtime",
                        self._format_duration(summary.downtime.total_downtime),
                    ],
                    [
                        "Average downtime",
                        self._format_duration(summary.downtime.average_downtime),
                    ],
                ]
            )
        )

        elements.append(Spacer(1, 5 * mm))

        elements.append(
            Paragraph(
                "Repair and return-to-service activity",
                section_style,
            )
        )

        elements.append(
            self._section_table(
                [
                    ["Repair metric", "Value"],
                    [
                        "Repairs completed",
                        summary.repairs.repairs_completed,
                    ],
                    [
                        "Equipment returned to service",
                        summary.repairs.equipment_returned_to_service,
                    ],
                ]
            )
        )

        elements.append(Spacer(1, 5 * mm))

        elements.append(
            Paragraph(
                "Resource requests",
                section_style,
            )
        )

        elements.append(
            Paragraph(
                "Resource requests represent maintenance needs that "
                "require additional parts, services, or other resources.",
                body_style,
            )
        )

        elements.append(Spacer(1, 3 * mm))

        elements.append(
            self._section_table(
                [
                    ["Request status", "Requests"],
                    [
                        "Pending",
                        summary.resource_requests.pending_requests,
                    ],
                    [
                        "Resolved",
                        summary.resource_requests.resolved_requests,
                    ],
                ]
            )
        )

        elements.append(Spacer(1, 8 * mm))

        elements.append(
            Paragraph(
                "This report reflects the current data available in "
                "Waliin at the time it was generated.",
                subtitle_style,
            )
        )

        document.build(elements)

        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes
