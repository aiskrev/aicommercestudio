"""Synthetic accounts and contracts for the browser tests of the legal workflows. NEVER for production.

`python -m app.cli legal-e2e-seed` (with E2E_ACCOUNT_PASSWORD set) creates verified accounts with a workspace and, where
the scenario needs one, a completed purchase with the acceptance recorded exactly as the checkout records it. It
makes no call to Stripe and refuses to run in production. All e-mail addresses are `*.legal-e2e@example.com`.

The scenarios (the account names the Playwright specs use):
  consumer   a consumer with an active subscription concluded 3 days ago (in the withdrawal period, early start asked)
  business   a business customer with an active subscription concluded 3 days ago
  expired    a consumer whose subscription was concluded 40 days ago
  layout     a consumer contract used only by the layout and accessibility specs (never submitted)
  unknown    an active subscription with no recorded checkout (kind and date of conclusion unknown)
  canceled   a consumer with a cancelled subscription (erasure anonymises, it does not delete)
  plain      an account with no billing at all (erasure deletes it)
  shopper, rights, rights2   accounts with no billing, for the order review and the data-rights tests
  pastdue    a consumer whose subscription is past due (erasure is blocked)
  ending     a consumer whose active subscription ends at the period end (erasure is blocked)
  opencheckout  a consumer with a checkout that is still open (erasure is blocked)
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import legal
from app.accounts.models import CustomerAccount
from app.billing.models import BillingCheckout, BillingCustomer, BillingOffer, BillingSubscription
from app.compliance.service import Acceptance, record_acceptance
from app.config import get_settings
from app.models import utcnow
from app.security import hash_password
from app.workspace.entitlements import workspace_for

DOMAIN = "legal-e2e@example.com"
SCENARIOS = {
    # name: (kind, days since completion or None, subscription status or None, cancel_at_period_end, checkout state)
    "consumer": ("consumer", 3, "active", False, "complete"),
    "business": ("business", 3, "active", False, "complete"),
    "expired": ("consumer", 40, "active", False, "complete"),
    "unknown": ("consumer", None, "active", False, None),
    "layout": ("consumer", 3, "active", False, "complete"),
    "canceled": ("consumer", 40, "canceled", False, "complete"),
    "plain": (None, None, None, False, None),
    "shopper": (None, None, None, False, None),
    "rights": (None, None, None, False, None),
    "rights2": (None, None, None, False, None),
    "pastdue": ("consumer", 3, "past_due", False, "complete"),
    "ending": ("consumer", 3, "active", True, "complete"),
    "opencheckout": ("consumer", None, None, False, "open"),
}


def email_of(name: str) -> str:
    return f"{name}.{DOMAIN}"


def _free(db: Session, column, wanted: str) -> str:
    """The synthetic Stripe id, or a suffixed one when an earlier run erased the account and its records stayed."""
    candidate, n = wanted, 1
    while db.scalar(select(column).where(column == candidate)) is not None:
        n += 1
        candidate = f"{wanted}_{n}"
    return candidate


def seed(db: Session, password: str) -> list[str]:
    settings = get_settings()
    if settings.is_production:
        raise RuntimeError("legal-e2e-seed is for tests only and refuses to run in production")
    if not db.get(BillingOffer, "pro_monthly"):
        db.add(
            BillingOffer(
                key="pro_monthly",
                kind="subscription",
                plan_key="pro",
                billing_interval="month",
                stripe_price_id="price_e2e_synthetic",
                currency="eur",
                amount_minor=2900,
                requires_scope=False,
                approved_at=utcnow(),
            )
        )
        db.flush()
    created: list[str] = []
    for name, (kind, days, state, ending, checkout_state) in SCENARIOS.items():
        email = email_of(name)
        if db.scalar(select(CustomerAccount).where(CustomerAccount.email == email)):
            continue
        account = CustomerAccount(
            email=email,
            password_hash=hash_password(password),
            privacy_notice_version=legal.version("privacy"),
            email_verified_at=utcnow(),
            locale="bg",
        )
        db.add(account)
        db.flush()
        workspace = workspace_for(db, account.id)
        if kind is not None:
            db.add(
                BillingCustomer(
                    workspace_id=workspace.id,
                    stripe_customer_id=_free(db, BillingCustomer.stripe_customer_id, f"cus_e2e_{name}"),
                    billing_owner_account_id=account.id,
                )
            )
            db.flush()
            if checkout_state is not None:  # a contract can also exist without any recorded checkout (old data)
                session_id = _free(db, BillingCheckout.stripe_session_id, f"cs_e2e_{name}")
                checkout = BillingCheckout(
                    workspace_id=workspace.id,
                    offer_key="pro_monthly",
                    stripe_session_id=session_id,
                    status=checkout_state,
                    completed_at=utcnow() - timedelta(days=days)
                    if days is not None and checkout_state == "complete"
                    else None,
                )
                db.add(checkout)
                db.flush()
                record_acceptance(
                    db,
                    checkout.id,
                    Acceptance(
                        terms=legal.version("terms"),
                        subscription_terms=legal.version("subscription_terms"),
                        order_acceptance=legal.version("order_acceptance"),
                        privacy=legal.version("privacy"),
                        customer_kind=kind,
                        early_start=kind == "consumer" and name == "consumer",
                        early_start_version=legal.version("early_start") if name == "consumer" else None,
                    ),
                    "bg",
                )
            if state is not None:
                db.add(
                    BillingSubscription(
                        stripe_subscription_id=_free(db, BillingSubscription.stripe_subscription_id, f"sub_e2e_{name}"),
                        workspace_id=workspace.id,
                        offer_key="pro_monthly",
                        status=state,
                        cancel_at_period_end=ending,
                        current_period_end=utcnow() + timedelta(days=27),
                        synced_at=utcnow(),
                    )
                )
        created.append(email)
    db.commit()
    return created
