"""Approval policy for actions proposed by AI agents.

Rule of thumb: reading public information and producing drafts/suggestions is low risk.
Anything that changes the outside world (messages, products, prices, orders) or touches
sensitive data must be explicitly approved by an authorised human, and every decision
is written to the audit log.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass


class ActionType(enum.StrEnum):
    READ_PUBLIC_CONTENT = "read_public_content"
    GENERATE_DRAFT = "generate_draft"
    CLASSIFY_LEAD = "classify_lead"
    SEND_MESSAGE = "send_message"
    MODIFY_PRODUCT = "modify_product"
    CHANGE_PRICE = "change_price"
    MODIFY_ORDER = "modify_order"
    ACCESS_SENSITIVE_DATA = "access_sensitive_data"
    DELETE_DATA = "delete_data"


class RiskLevel(enum.StrEnum):
    LOW = "low"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass(frozen=True)
class PolicyRule:
    risk: RiskLevel
    requires_approval: bool
    label: str


POLICY: dict[ActionType, PolicyRule] = {
    ActionType.READ_PUBLIC_CONTENT: PolicyRule(RiskLevel.LOW, False, "Четене на публично съдържание"),
    ActionType.GENERATE_DRAFT: PolicyRule(RiskLevel.LOW, False, "Генериране на чернова"),
    ActionType.CLASSIFY_LEAD: PolicyRule(RiskLevel.LOW, False, "Класификация на запитване"),
    ActionType.SEND_MESSAGE: PolicyRule(RiskLevel.HIGH, True, "Изпращане на съобщение"),
    ActionType.MODIFY_PRODUCT: PolicyRule(RiskLevel.HIGH, True, "Промяна на продукт"),
    ActionType.CHANGE_PRICE: PolicyRule(RiskLevel.CRITICAL, True, "Промяна на цена"),
    ActionType.MODIFY_ORDER: PolicyRule(RiskLevel.CRITICAL, True, "Промяна на поръчка"),
    ActionType.ACCESS_SENSITIVE_DATA: PolicyRule(RiskLevel.CRITICAL, True, "Достъп до чувствителни данни"),
    ActionType.DELETE_DATA: PolicyRule(RiskLevel.CRITICAL, True, "Изтриване на данни"),
}


@dataclass(frozen=True)
class PolicyDecision:
    action: ActionType
    risk: RiskLevel
    requires_approval: bool
    reason: str


def evaluate(action: ActionType | str) -> PolicyDecision:
    """Unknown action types are treated as critical and always require approval (fail closed)."""
    try:
        action_type = ActionType(action)
    except ValueError:
        return PolicyDecision(
            action=ActionType.ACCESS_SENSITIVE_DATA,
            risk=RiskLevel.CRITICAL,
            requires_approval=True,
            reason=f"Unknown action '{action}' — denied by default until explicitly approved",
        )
    rule = POLICY[action_type]
    reason = "Explicit human approval required" if rule.requires_approval else "Allowed: no external side effects"
    return PolicyDecision(action_type, rule.risk, rule.requires_approval, reason)
