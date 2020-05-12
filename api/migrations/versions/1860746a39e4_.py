"""empty message

Revision ID: b781fb62a115
Revises: 1860746a39e4
Create Date: 2020-05-06 13:19:46.906351

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b781fb62a115"
down_revision = "1860746a39e4"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("organizations", sa.Column("name", sa.String(), nullable=True))
    op.add_column("organizations", sa.Column("slug", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_organizations_slug"), "organizations", ["slug"], unique=False
    )
    op.drop_constraint("user_user_aff_key", "user_affiliations", type_="foreignkey")
    op.drop_constraint(
        "user_affiliations_organization_id_fkey",
        "user_affiliations",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "user_affiliations_organization_id_fkey",
        "user_affiliations",
        "organizations",
        ["organization_id"],
        ["id"],
        onupdate="CASCADE",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "user_affiliations_users_id_fkey",
        "user_affiliations",
        "users",
        ["user_id"],
        ["id"],
        onupdate="CASCADE",
        ondelete="CASCADE",
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        "user_affiliations_users_id_fkey", "user_affiliations", type_="foreignkey"
    )
    op.drop_constraint(
        "user_affiliations_organization_id_fkey",
        "user_affiliations",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "user_affiliations_organization_id_fkey",
        "user_affiliations",
        "organizations",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "user_user_aff_key", "user_affiliations", "users", ["user_id"], ["id"]
    )
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_column("organizations", "slug")
    op.drop_column("organizations", "name")
    # ### end Alembic commands ###