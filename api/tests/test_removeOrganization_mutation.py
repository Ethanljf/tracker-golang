import pytest
from json_web_token import tokenize
from flask import Request
from pytest import fail
from graphene.test import Client
from unittest import TestCase
from werkzeug.test import create_environ
from app import app
from db import DB
from queries import schema
from backend.security_check import SecurityAnalysisBackend
from models import (
    Organizations,
    Domains,
    Users,
    User_affiliations,
    Scans,
    Dkim_scans,
    Dmarc_scans,
    Https_scans,
    Mx_scans,
    Spf_scans,
    Ssl_scans,
)

s, cleanup, session = DB()


def auth_header(token):
    env = create_environ()
    env.update(HTTP_AUTHORIZATION=token)
    return Request(env)


@pytest.fixture
def save():
    with app.app_context():
        yield s
        cleanup()


def test_mutation_removeOrganization_succeeds_for_super_admin(save):
    sa_user = Users(
        display_name="testsuperadmin",
        user_name="testsuperadmin@testemail.ca",
        password="testpassword123",
    )
    sa_user.user_affiliation.append(
        User_affiliations(
            permission="super_admin",
            user_organization=Organizations(acronym="SA", name="Super Admin"),
        )
    )
    sa_user.user_affiliation.append(
        User_affiliations(
            permission="super_admin",
            user_organization=Organizations(acronym="ORG1", name="Org One"),
        )
    )

    save(sa_user)

    token = tokenize(user_id=sa_user.id, roles=sa_user.roles)

    result = Client(schema).execute(
        """
         mutation {
             removed:removeOrganization(acronym: "ORG1") {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" in result:
        fail(
            "expected removeOrganization to succeed for SA user. Instead: {}".format(
                result
            )
        )

    created_org = result["data"].values()
    [status] = created_org

    assert status == {"status": True}


def test_mutation_removeOrganization_does_not_remove_super_admin_org(save):
    sa_user = Users(
        display_name="testsuperadmin",
        user_name="testsuperadmin@testemail.ca",
        password="testpassword123",
    )
    sa_user.user_affiliation.append(
        User_affiliations(
            permission="super_admin",
            user_organization=Organizations(acronym="SA", name="Super Admin"),
        )
    )

    save(sa_user)

    token = tokenize(user_id=sa_user.id, roles=sa_user.roles)

    result = Client(schema).execute(
        """
         mutation {
             removed:removeOrganization(acronym: "SA") {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" not in result:
        fail(
            "expected removing the SA org to fail, even for SA user. Instead: {}".format(
                result
            )
        )

    errors, data = result.values()
    [first] = errors
    message, _, _ = first.values()
    assert message == "Error, you cannot remove this organization"


def test_mutation_removeOrganization_fails_if_org_does_not_exist(save):
    sa_user = Users(
        display_name="testsuperadmin",
        user_name="testsuperadmin@testemail.ca",
        password="testpassword123",
    )
    sa_user.user_affiliation.append(
        User_affiliations(
            permission="super_admin",
            user_organization=Organizations(acronym="SA", name="Super Admin"),
        )
    )

    save(sa_user)

    token = tokenize(user_id=sa_user.id, roles=sa_user.roles)

    result = Client(schema).execute(
        """
         mutation {
             removeOrganization(
                 acronym: "RANDOM"
             ) {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" not in result:
        fail(
            "expected removeOrganization to fail for orgs that don't exist. Instead: {}".format(
                result
            )
        )

    errors, data = result.values()
    [first] = errors
    message, _, _ = first.values()
    assert message == "Error, organization does not exist"


def test_mutation_removeOrganization_fails_for_admin_users(save):
    admin = Users(
        display_name="admin", user_name="admin@example.com", password="testpassword123",
    )
    admin.user_affiliation.append(
        User_affiliations(
            permission="admin",
            user_organization=Organizations(acronym="ORG1", name="Org One",),
        )
    )

    save(admin)

    token = tokenize(user_id=admin.id, roles=admin.roles)

    result = Client(schema).execute(
        """
         mutation {
             removeOrganization(
                 acronym: "ORG1"
             ) {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" not in result:
        fail(
            "expected removeOrganization to fail for admins. Instead: {}".format(result)
        )

    errors, data = result.values()
    [first] = errors
    message, _, _ = first.values()
    assert message == "Error, you do not have permission to remove organizations."


def test_mutation_removeOrganization_fails_for_write_users(save):
    write_user = Users(
        display_name="writer",
        user_name="write_user@example.com",
        password="testpassword123",
    )

    write_user.user_affiliation.append(
        User_affiliations(
            permission="user_write",
            user_organization=Organizations(acronym="ORG1", name="Org One"),
        )
    )

    save(write_user)

    token = tokenize(user_id=write_user.id, roles=write_user.roles)

    result = Client(schema).execute(
        """
         mutation {
             removeOrganization(
                 acronym: "ORG1"
             ) {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" not in result:
        fail(
            "expected removeOrganization to fail for write users. Instead: {}".format(
                result
            )
        )

    errors, data = result.values()
    [first] = errors
    message, _, _ = first.values()
    assert message == "Error, you do not have permission to remove organizations."


def test_mutation_removeOrganization_fails_for_read_users(save):
    reader = Users(
        display_name="reader",
        user_name="reader@example.com",
        password="testpassword123",
    )

    reader.user_affiliation.append(
        User_affiliations(
            permission="user_read",
            user_organization=Organizations(acronym="ORG1", name="Org One"),
        )
    )

    save(reader)

    token = tokenize(user_id=reader.id, roles=reader.roles)

    result = Client(schema).execute(
        """
         mutation {
             removeOrganization(
                 acronym: "ORG1"
             ) {
                 status
             }
         }
        """,
        context_value=auth_header(token),
    )

    if "errors" not in result:
        fail(
            "expected removeOrganization to fail for read users. Instead: {}".format(
                result
            )
        )

    errors, data = result.values()
    [first] = errors
    message, _, _ = first.values()
    assert message == "Error, you do not have permission to remove organizations."