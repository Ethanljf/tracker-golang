"""empty message

Revision ID: 5cd6b0bb4549
Revises: 210111cbd5ae
Create Date: 2020-02-07 13:12:26.620069

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '5cd6b0bb4549'
down_revision = '210111cbd5ae'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('users', 'tfa_validated')
    op.drop_column('users', 'user_role')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('users', sa.Column('tfa_validated', sa.Boolean(), nullable=True))
    op.add_column('users', sa.Column('user_role', sa.String(), nullable=True))
    # ### end Alembic commands ###
