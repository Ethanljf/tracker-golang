import pyotp
import pytest

from pytest import fail

from app import app
from db import DB
from models import Users
from functions.error_messages import *
from tests.test_functions import json, run


@pytest.fixture()
def save():
    s, cleanup, db_session = DB()
    yield s
    cleanup()


# XXX: convert this to pytest style
@pytest.fixture(scope="function")
def user_schema_test_db_init():
    with app.app_context():
        test_user = Users(
            display_name="testuser",
            user_name="testuser@testemail.ca",
            password="testpassword123",
        )
        db_session.add(test_user)
        test_admin = Users(
            display_name="testadmin",
            user_name="testadmin@testemail.ca",
            password="testpassword123",
        )
        db_session.add(test_admin)
        db_session.commit()

        yield

        cleanup()


def test_successful_creation(save):
    """
    Test that ensures a user can be created successfully using the api endpoint
    """
    result = run(
        mutation="""
        mutation{
            createUser(displayName:"user-test", userName:"different-email@testemail.ca",
                password:"testpassword123", confirmPassword:"testpassword123"){
                user{
                    userName
                    displayName
                }
            }
        }
        """,
    )

    if "errors" in result:
        fail("Tried to create a user, instead: {}".format(json(result)))

    expected_result = {
        "data": {
            "createUser": {
                "user": {
                    "userName": "different-email@testemail.ca",
                    "displayName": "user-test",
                }
            }
        }
    }

    assert result == expected_result


def test_email_address_in_use():
    """Test that ensures each user has a unique email address"""
    result = run(
        mutation="""
        mutation{
            createUser(displayName:"testuser", userName:"testuser@testemail.ca",
                password:"testpassword123", confirmPassword:"testpassword123"){
                user{
                    userName
                }
            }
        }
        """,
    )

    if "errors" in result:
        fail("Error should create user, instead: {}".format(json(result)))

    error_result = run(
        mutation="""
        mutation{
            createUser(displayName:"testuser", userName:"testuser@testemail.ca",
                password:"testpassword123", confirmPassword:"testpassword123"){
                user{
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in error_result:
        fail(
            "Trying to create user with same username should fail, instead".format(
                json(result)
            )
        )

    [error] = error_result["errors"]
    assert error["message"] == error_email_in_use()


def test_password_too_short():
    """
    Test that ensure that a user's password meets the valid length requirements
    """
    result = run(
        mutation="""
        mutation{
            createUser(displayName:"testuser", userName:"test@test-email.ca", password:"test", confirmPassword:"test"){
                user{
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Password too short when creating user should error out, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == error_password_does_not_meet_requirements()


def test_passwords_do_not_match():
    """Test to ensure that user password matches their password confirmation"""
    result = run(
        mutation="""
        mutation{
            createUser(displayName:"testuser", userName:"test@test-email.ca", password:"A-Val1d-Pa$$word",
                confirmPassword:"also-A-Val1d-Pa$$word"){
                user{
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Passwords do not match when creating user should error, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == error_passwords_do_not_match()


def test_update_password_success(save):
    """
    Test to ensure that a user is returned when their password is updated
    successfully
    """
    test_user = Users(
        display_name="testuser",
        user_name="testuser@testemail.ca",
        password="testpassword123",
    )
    save(test_user)

    result = run(
        mutation="""
        mutation {
            updatePassword(userName: "testuser@testemail.ca", password: "another-super-long-password",
                confirmPassword: "another-super-long-password") {
                user {
                    userName
                    displayName
                }
            }
        }
        """,
        as_user=test_user,
    )

    if "errors" in result:
        fail("Tried to update password, instead: {}".format(json(result)))

    expected_result = {
        "data": {
            "updatePassword": {
                "user": {
                    "userName": "testuser@testemail.ca",
                    "displayName": "testuser",
                }
            }
        }
    }
    assert result == expected_result


def test_updated_passwords_do_not_match():
    """
    Test to ensure that user's new password matches their password confirmation
    """
    result = run(
        mutation="""
        mutation {
            updatePassword(userName: "test@test-email.ca", password: "a-super-long-password",
                confirmPassword: "another-super-long-password") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Tried to update passwords with mis-matching passwords, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == error_passwords_do_not_match()


def test_updated_password_too_short():
    """Test that ensure that a user's password meets the valid length requirements"""
    result = run(
        mutation="""
        mutation {
            updatePassword(userName: "test@test-email.ca", password: "password", confirmPassword: "password") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Tried to update password with too short password, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == error_password_does_not_meet_requirements()


def test_updated_password_no_user_email():
    """
    Test that ensures an empty string submitted as email will not be accepted
    """
    result = run(
        mutation="""
        mutation {
            updatePassword(userName: "", password: "valid-password", confirmPassword: "valid-password") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Tried to update password with no username, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == scalar_error_type("email address", "")


def test_successful_validation(save):
    """
    Test that ensures a validation is successful when all params are proper
    """
    test_user = Users(
        display_name="testuser",
        user_name="testuser@testemail.ca",
        password="testpassword123",
    )
    save(test_user)

    totp = pyotp.TOTP("base32secret3232")
    otp_code = (
        totp.now()
    )  # Generates a code that is valid for 30s. Plenty of time to execute the query

    result = run(
        mutation='''
        mutation {
            authenticateTwoFactor(userName: "testuser@testemail.ca", otpCode: "'''
        + otp_code
        + """") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" in result:
        fail("Tried to validate account, instead: {}".format(json(result)))

    expected_result = {
        "data": {
            "authenticateTwoFactor": {"user": {"userName": "testuser@testemail.ca"}}
        }
    }

    assert result == expected_result


def test_user_does_not_exist():
    """Test that an error is raised if the user specified does not exist"""
    result = run(
        mutation="""
        mutation {
            authenticateTwoFactor(userName: "anotheruser@testemail.ca", otpCode: "000000") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail(
            "Tried to validate account that does not exist, instead: {}".format(
                json(result)
            )
        )

    [error] = result["errors"]
    assert error["message"] == error_user_does_not_exist()


def test_invalid_otp_code(save):
    """Test that an error is raised if the user specified does not exist"""
    test_user = Users(
        display_name="testuser",
        user_name="testuser@testemail.ca",
        password="testpassword123",
    )
    save(test_user)

    result = run(
        mutation="""
        mutation {
            authenticateTwoFactor(userName: "testuser@testemail.ca", otpCode: "000000") {
                user {
                    userName
                }
            }
        }
        """,
    )

    if "errors" not in result:
        fail("Tried to validate with invalid code, instead: {}".format(json(result)))

    [error] = result["errors"]
    assert error["message"] == error_otp_code_is_invalid()
