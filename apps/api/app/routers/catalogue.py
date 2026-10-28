"""Public, read-only service catalogue (published content only).

Every response is built from publication snapshots (app/catalogue/public.py); drafts, archived
entries, unpublished edits and admin metadata are unreachable from here. Responses carry an ETag
and `Cache-Control: public, max-age=60, stale-while-revalidate=300`; `If-None-Match` answers 304.
"""

from __future__ import annotations

import hashlib
import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status
from pydantic import BaseModel

from app.catalogue import api_schemas as out
from app.catalogue import public
from app.catalogue.api_schemas import KEY_PATTERN
from app.config import get_settings
from app.deps import DbSession, client_ip, enforce_rate_limit
from app.errors import ApiError
from app.i18n import Locale, request_locale
from app.models import SLUG_PATTERN

CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"
MAX_LIMIT = 100


def catalogue_rate_limit(request: Request) -> None:
    settings = get_settings()
    window = settings.catalogue_rate_window_seconds
    enforce_rate_limit(f"catalogue:{client_ip(request)}", settings.catalogue_rate_limit, window)
    enforce_rate_limit("catalogue:global", settings.catalogue_global_rate_limit, window)


router = APIRouter(prefix="/api/public/catalogue", tags=["catalogue"], dependencies=[Depends(catalogue_rate_limit)])

LocaleQuery = Annotated[
    Literal["bg", "en"] | None,
    Query(description="Response language; defaults to the Accept-Language header, then bg."),
]
Limit = Annotated[int, Query(ge=1, le=MAX_LIMIT, description=f"Page size (1–{MAX_LIMIT}).")]
Offset = Annotated[int, Query(ge=0, le=10_000)]
KeyPath = Annotated[str, Path(pattern=KEY_PATTERN, description="Stable key, e.g. `devops_sre`.")]
SlugPath = Annotated[str, Path(pattern=SLUG_PATTERN, max_length=80, description="Slug in the requested locale.")]


def _locale(request: Request, locale: str | None) -> Locale:
    return "en" if locale == "en" else "bg" if locale == "bg" else request_locale(request)


def _only(*allowed: str):
    """Reject unknown query parameters instead of ignoring them (a typo must not change results)."""

    def check(request: Request) -> None:
        unknown = sorted(set(request.query_params) - set(allowed))
        if unknown:
            raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown parameter: {unknown[0]}", "invalid_filter")

    return Depends(check)


def _respond(request: Request, response: Response, model: BaseModel):
    """Attach validators; answer 304 when the client already has this exact representation."""
    body = json.dumps(model.model_dump(mode="json"), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    etag = '"' + hashlib.sha256(body.encode("utf-8")).hexdigest()[:32] + '"'
    headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL, "Vary": "Accept-Language"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    response.headers.update(headers)
    return model


def _not_found(code: str) -> ApiError:
    return ApiError(status.HTTP_404_NOT_FOUND, "Not found.", code)


@router.get(
    "/domains",
    response_model=out.DomainPage,
    dependencies=[_only("locale", "limit", "offset")],
    summary="Published service domains, in taxonomy order (band, then position)",
)
def list_domains(
    request: Request,
    response: Response,
    db: DbSession,
    locale: LocaleQuery = None,
    limit: Limit = 50,
    offset: Offset = 0,
):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    docs = public.sorted_domains(cat)
    page = out.DomainPage(
        locale=loc,
        items=[public.domain_summary(cat, doc, loc) for doc in docs[offset : offset + limit]],
        total=len(docs),
        limit=limit,
        offset=offset,
    )
    return _respond(request, response, page)


@router.get(
    "/domains/by-slug/{slug}",
    response_model=out.DomainDetail,
    dependencies=[_only("locale")],
    responses={404: {"description": "`domain_not_found`"}},
    summary="One published domain by its slug in the requested locale",
)
def domain_by_slug(request: Request, response: Response, db: DbSession, slug: SlugPath, locale: LocaleQuery = None):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    doc = public.find_by_slug(cat.domains, loc, slug)
    if doc is None:
        raise _not_found("domain_not_found")
    return _respond(request, response, public.domain_detail(cat, doc, loc))


@router.get(
    "/domains/{key}",
    response_model=out.DomainDetail,
    dependencies=[_only("locale")],
    responses={404: {"description": "`domain_not_found`"}},
    summary="One published domain with its families, services and related domains",
)
def domain_by_key(request: Request, response: Response, db: DbSession, key: KeyPath, locale: LocaleQuery = None):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    doc = cat.domains.get(key)
    if doc is None:
        raise _not_found("domain_not_found")
    return _respond(request, response, public.domain_detail(cat, doc, loc))


@router.get(
    "/services",
    response_model=out.ServicePage,
    dependencies=[_only("locale", "domain", "offering_type", "delivery_status", "q", "sort", "limit", "offset")],
    responses={422: {"description": "`validation_error` or `invalid_filter` (unknown domain or parameter)"}},
    summary="Published services, assessments and workshops with filters",
)
def list_services(
    request: Request,
    response: Response,
    db: DbSession,
    locale: LocaleQuery = None,
    domain: Annotated[
        list[Annotated[str, Query(pattern=KEY_PATTERN)]] | None,
        Query(max_length=10, description="Primary domain key; repeat for OR."),
    ] = None,
    offering_type: Annotated[list[out.Offering] | None, Query(max_length=3)] = None,
    delivery_status: Annotated[list[out.Delivery] | None, Query(max_length=3)] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100, description="Substring of name or summary.")] = None,
    sort: Annotated[
        Literal["catalogue", "name"],
        Query(description="`catalogue`: domain order, type, position, key. `name`: name in the locale, key."),
    ] = "catalogue",
    limit: Limit = 20,
    offset: Offset = 0,
):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    domains = list(dict.fromkeys(domain or []))
    unknown = [key for key in domains if key not in cat.domains]
    if unknown:
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown domain: {unknown[0]}", "invalid_filter")
    docs = public.filter_services(
        cat,
        loc,
        domains=domains,
        offering_types=list(offering_type or []),
        delivery=list(delivery_status or []),
        q=q,
        sort=sort,
    )
    page = out.ServicePage(
        locale=loc,
        items=[public.service_summary(cat, doc, loc) for doc in docs[offset : offset + limit]],
        total=len(docs),
        limit=limit,
        offset=offset,
    )
    return _respond(request, response, page)


@router.get(
    "/services/by-slug/{slug}",
    response_model=out.ServiceDetail,
    dependencies=[_only("locale")],
    responses={404: {"description": "`service_not_found`"}},
    summary="One published service by its slug in the requested locale",
)
def service_by_slug(request: Request, response: Response, db: DbSession, slug: SlugPath, locale: LocaleQuery = None):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    doc = public.find_by_slug(cat.services, loc, slug)
    if doc is None:
        raise _not_found("service_not_found")
    return _respond(request, response, public.service_detail(cat, doc, loc))


@router.get(
    "/services/{key}",
    response_model=out.ServiceDetail,
    dependencies=[_only("locale")],
    responses={404: {"description": "`service_not_found`"}},
    summary="One published service, assessment or workshop by its stable key",
)
def service_by_key(request: Request, response: Response, db: DbSession, key: KeyPath, locale: LocaleQuery = None):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    doc = cat.services.get(key)
    if doc is None:
        raise _not_found("service_not_found")
    return _respond(request, response, public.service_detail(cat, doc, loc))


@router.get(
    "/services/{key}/related",
    response_model=out.RelatedResponse,
    dependencies=[_only("locale")],
    responses={404: {"description": "`service_not_found`"}},
    summary="Related services, assessments and workshops of one published service",
)
def service_related(request: Request, response: Response, db: DbSession, key: KeyPath, locale: LocaleQuery = None):
    loc = _locale(request, locale)
    cat = public.published_catalogue(db)
    doc = cat.services.get(key)
    if doc is None:
        raise _not_found("service_not_found")
    return _respond(request, response, out.RelatedResponse(locale=loc, key=key, related=public.related(cat, doc, loc)))
