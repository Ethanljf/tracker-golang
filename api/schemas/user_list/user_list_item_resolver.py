from graphql import GraphQLError

from db import db_session
from functions.auth_functions import is_super_admin, is_admin
from functions.auth_wrappers import require_token
from models.Organizations import Organizations
from models.User_affiliations import User_affiliations
from schemas.user_list.user_list_item import UserListItem


@require_token
def resolve_user_item(self, info, **kwargs):
    """
    This function is used to resolve the UserList graphql object. The orgSlug
    given in the arguments will get all the users in that organizations.
    :param self: UserList SQLAlchemyObject type defined in the schemas directory
    :param info: Request information sent to the sever from a client
    :param kwargs: Field arguments and user_roles
    :return: Filtered User SQLAlchemyObject Type
    """
    # Get arguments from kwargs
    user_id = kwargs.get("user_id")
    user_roles = kwargs.get("user_roles")
    org_slug = kwargs.get("org_slug")

    org_orm = (
        db_session.query(Organizations).filter(Organizations.slug == org_slug).first()
    )

    if org_orm is None:
        raise GraphQLError("Error, organization does not exist")

    query = UserListItem.get_query(info)

    if is_admin(user_roles=user_roles, org_id=org_orm.id):
        query = query.filter(User_affiliations.organization_id == org_orm.id).all()
        return query
    else:
        raise GraphQLError("Error, you do not have permission to view this user lists")